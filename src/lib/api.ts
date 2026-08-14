import type {
  AcademicYear,
  AttendanceDraft,
  Bootstrap,
  ClassToday,
  DayAttendance,
  Enrollment,
  LowAttendance,
  MarkInput,
  Me,
  PeriodSuggestion,
  PublicUser,
  SchoolClass,
  Student,
  StudentReport,
  Subject,
  SubmitResult,
  User,
  WriteResult,
} from './types';

const configuredBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '');

/**
 * Dev requests are same-origin and proxied by Vite. A static GitHub Pages build
 * uses the configured Worker URL. VITE_API_URL can point at another deployment.
 */
export const API_BASE = import.meta.env.DEV
  ? ''
  : (configuredBase ?? 'https://vart.reold.workers.dev');

export class ApiError extends Error {
  status: number;
  details: string[];

  constructor(message: string, status: number, details: string[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    });
  } catch {
    throw new ApiError(
      'Could not reach the attendance server. Check your connection and try again.',
      0,
    );
  }

  const contentType = response.headers.get('content-type') ?? '';
  const data = contentType.includes('application/json')
    ? await response.json().catch(() => ({}))
    : await response.text().catch(() => '');

  if (!response.ok) {
    const details = Array.isArray(data?.errors) ? data.errors.map(String) : [];
    const message =
      data?.error || details[0] || (typeof data === 'string' && data) || `Request failed (${response.status})`;
    throw new ApiError(message, response.status, details);
  }

  return data as T;
}

function json(method: string, body?: unknown): RequestInit {
  return { method, body: body === undefined ? undefined : JSON.stringify(body) };
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export const api = {
  setupStatus: () => request<{ setup_complete: boolean; has_users: boolean }>('/setup/status'),
  createFirstAdmin: (body: { display_name: string; login_name?: string; pin: string }) =>
    request<WriteResult>('/setup/create-first-admin', json('POST', body)),

  publicUsers: () => request<PublicUser[]>('/auth/users-public'),
  login: (user_id: string, pin: string) =>
    request<{ success: boolean; user: Me }>('/auth/login', json('POST', { user_id, pin })),
  logout: () => request<WriteResult>('/auth/logout', json('POST')),
  me: () => request<Me>('/me'),
  reauthPin: (pin: string) => request<WriteResult>('/auth/reauth-pin', json('POST', { pin })),

  bootstrap: () => request<Bootstrap>('/app/bootstrap'),
  classes: () => request<SchoolClass[]>('/classes'),
  classToday: (classId: string) => request<ClassToday>(`/classes/${encodeURIComponent(classId)}/today`),
  suggestPeriod: (classId: string) =>
    request<PeriodSuggestion>(`/classes/${encodeURIComponent(classId)}/suggest-next-period`),
  draft: (classId: string, periodNo: number) =>
    request<AttendanceDraft>(
      `/classes/${encodeURIComponent(classId)}/periods/${periodNo}/draft`,
    ),
  submitAttendance: (body: {
    class_id: string;
    subject_id?: string | null;
    session_date: string;
    period_no: number;
    marks: MarkInput[];
  }) => request<SubmitResult>('/attendance/submit', json('POST', body)),

  users: () => request<User[]>('/admin/users'),
  createUser: (body: {
    display_name: string;
    login_name?: string;
    role: string;
    pin: string;
    default_subject_id?: string;
  }) => request<WriteResult>('/admin/users', json('POST', body)),
  updateUser: (id: string, body: Partial<Pick<User, 'display_name' | 'login_name' | 'role' | 'default_subject_id'>>) =>
    request<WriteResult>(`/admin/users/${encodeURIComponent(id)}`, json('PUT', body)),
  resetPin: (id: string, pin: string) =>
    request<WriteResult>(`/admin/users/${encodeURIComponent(id)}/reset-pin`, json('POST', { pin })),
  setUserEnabled: (id: string, enabled: boolean) =>
    request<WriteResult>(`/admin/users/${encodeURIComponent(id)}/${enabled ? 'enable' : 'disable'}`, json('POST')),
  revokeSessions: (id: string) =>
    request<WriteResult>(`/admin/users/${encodeURIComponent(id)}/revoke-sessions`, json('POST')),

  students: () => request<Student[]>('/admin/students'),
  createStudent: (body: { admission_no: string; name: string }) =>
    request<WriteResult>('/admin/students', json('POST', body)),
  updateStudent: (id: string, body: Partial<Pick<Student, 'admission_no' | 'name' | 'leaving_date'>> & { active?: boolean }) =>
    request<WriteResult>(`/admin/students/${encodeURIComponent(id)}`, json('PUT', body)),
  deleteStudent: (id: string) =>
    request<WriteResult>(`/admin/students/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  adminClasses: () => request<SchoolClass[]>('/admin/classes'),
  createClass: (body: { name: string; sort_order?: number }) =>
    request<WriteResult>('/admin/classes', json('POST', body)),
  updateClass: (id: string, body: { name?: string; active?: boolean; sort_order?: number }) =>
    request<WriteResult>(`/admin/classes/${encodeURIComponent(id)}`, json('PUT', body)),

  subjects: () => request<Subject[]>('/admin/subjects'),
  createSubject: (body: { name: string }) =>
    request<WriteResult>('/admin/subjects', json('POST', body)),
  updateSubject: (id: string, body: { name?: string; active?: boolean }) =>
    request<WriteResult>(`/admin/subjects/${encodeURIComponent(id)}`, json('PUT', body)),

  academicYears: () => request<AcademicYear[]>('/admin/academic-years'),
  createAcademicYear: (body: { name: string; starts_on: string; ends_on: string; active?: boolean }) =>
    request<WriteResult>('/admin/academic-years', json('POST', body)),

  enrollments: (classId: string) =>
    request<Enrollment[]>(`/admin/classes/${encodeURIComponent(classId)}/enrollments`),
  createEnrollment: (body: {
    student_id: string;
    class_id: string;
    roll_no?: string;
    starts_on: string;
    ends_on?: string | null;
  }) => request<WriteResult>('/admin/enrollments', json('POST', body)),
  deleteEnrollment: (id: string) =>
    request<WriteResult>(`/admin/enrollments/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  dayAttendance: (classId: string, date?: string) => {
    const params = new URLSearchParams({ class_id: classId });
    if (date) params.set('date', date);
    return request<DayAttendance>(`/admin/attendance/day?${params}`);
  },
  studentReport: (studentId: string) =>
    request<StudentReport>(`/reports/student/${encodeURIComponent(studentId)}`),
  lowAttendance: (threshold = 75) =>
    request<LowAttendance>(`/reports/low-attendance?threshold=${encodeURIComponent(threshold)}`),
};
