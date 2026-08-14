export type Role = 'teacher' | 'teacher_admin' | 'super_admin';
export type AttendanceStatus = 'present' | 'absent' | 'late';

export interface Me {
  id: string;
  display_name: string;
  role: Role;
  default_subject_id: string | null;
}

export interface PublicUser {
  id: string;
  display_name: string;
}

export interface SchoolClass {
  id: string;
  name: string;
  active: 0 | 1;
  sort_order: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface Subject {
  id: string;
  name: string;
  active: 0 | 1;
  created_at?: string;
  updated_at?: string;
}

export interface AcademicYear {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  active: 0 | 1;
  created_at?: string;
  updated_at?: string;
}

export interface Bootstrap {
  academic_year: AcademicYear | null;
  classes: SchoolClass[];
  default_subject: Subject | null;
  user: Pick<Me, 'id' | 'display_name' | 'role'>;
}

export interface TodayPeriod {
  period_no: number;
  status: 'submitted' | 'draft' | 'not_submitted';
  submitted_at: string | null;
}

export interface ClassToday {
  class: SchoolClass;
  date: string;
  academic_year: AcademicYear;
  periods: TodayPeriod[];
  students_count: number;
}

export interface PeriodSuggestion {
  next_period: number | null;
  submitted_periods: number[];
  message?: string;
}

export interface DraftStudent {
  student_id: string;
  admission_no: string;
  roll_no: string | null;
  name: string;
  default_status: AttendanceStatus;
  hidden_as_absent_earlier: boolean;
}

export interface AttendanceDraft {
  class: SchoolClass;
  subject: Subject | null;
  session_date: string;
  period_no: number;
  students: DraftStudent[];
  summary: {
    copied_from_period: number | null;
    total_students: number;
    present_count: number;
    absent_count: number;
    late_count: number;
  };
}

export interface MarkInput {
  student_id: string;
  status: AttendanceStatus;
  late_minutes?: number | null;
  note?: string | null;
}

export interface SubmitResult {
  success: boolean;
  session_id: string;
  summary: {
    period_no: number;
    session_date: string;
    total_students: number;
    present_count: number;
    absent_count: number;
    late_count: number;
  };
}

export interface Student {
  id: string;
  admission_no: string;
  name: string;
  active: 0 | 1;
  leaving_date: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface User extends Me {
  login_name: string | null;
  status: 'active' | 'disabled';
  created_at?: string;
  updated_at?: string;
}

export interface Enrollment {
  id: string;
  student_id: string;
  class_id: string;
  roll_no: string | null;
  starts_on: string;
  ends_on: string | null;
  active: number;
  student_name: string;
  admission_no: string;
}

export interface DayMark {
  student_id: string;
  admission_no: string;
  name: string;
  roll_no: string | null;
  status: AttendanceStatus;
  late_minutes: number | null;
  note: string | null;
}

export interface DayPeriod {
  period_no: number;
  status: 'submitted' | 'draft' | 'not_submitted';
  submitted_at: string | null;
  teacher_id: string | null;
  marks: DayMark[];
}

export interface DayAttendance {
  date: string;
  class_id: string;
  class_name: string;
  periods: DayPeriod[];
  daily_summary: {
    total_periods: number;
    total_students: number;
    present_count: number;
    absent_count: number;
    late_count: number;
    attendance_percentage: number;
  };
}

export type ReportStatus = AttendanceStatus | `inferred_${AttendanceStatus}` | null;

export interface StudentReport {
  student: {
    id: string;
    admission_no: string;
    name: string;
    class_id: string | null;
    class_name: string | null;
    roll_no: string | null;
  };
  academic_year: AcademicYear;
  total_days: number;
  total_credit: number;
  total_denominator: number;
  attendance_percentage: number;
  period_breakdown: Array<{
    date: string;
    periods: Array<{ period_no: number; status: ReportStatus; credit: number }>;
    daily_credit: number;
    daily_denominator: number;
  }>;
}

export interface LowAttendance {
  threshold: number;
  count: number;
  students: Array<{
    student_id: string;
    admission_no: string;
    name: string;
    class_name: string;
    roll_no: string | null;
    attendance_percentage: number;
    total_credit: number;
    total_denominator: number;
  }>;
}

export interface WriteResult {
  success: boolean;
  message?: string;
  user_id?: string;
  student_id?: string;
  class_id?: string;
  subject_id?: string;
  academic_year_id?: string;
  enrollment_id?: string;
}
