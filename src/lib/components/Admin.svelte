<script lang="ts">
  import { onMount } from 'svelte';
  import {
    BookOpen,
    ArchiveRestore,
    CalendarRange,
    Check,
    ChevronDown,
    CircleAlert,
    CircleCheck,
    GraduationCap,
    KeyRound,
    LoaderCircle,
    Pencil,
    Plus,
    RefreshCw,
    Search,
    ShieldCheck,
    UserPlus,
    UserRoundCog,
    Users,
  } from '@lucide/svelte';
  import { api, errorMessage } from '$lib/api';
  import type { AcademicYear, Bootstrap, Enrollment, Role, SchoolClass, Student, Subject, User } from '$lib/types';
  import Modal from './Modal.svelte';

  let { bootstrap }: { bootstrap: Bootstrap } = $props();

  type Tab = 'staff' | 'students' | 'classes' | 'subjects' | 'enrollments' | 'years';
  type ModalType = 'staff' | 'edit-staff' | 'student' | 'class' | 'subject' | 'enrollment' | 'year' | 'pin' | null;

  let tab = $state<Tab>('staff');
  let modal = $state<ModalType>(null);
  let users = $state<User[]>([]);
  let students = $state<Student[]>([]);
  let classes = $state<SchoolClass[]>([]);
  let subjects = $state<Subject[]>([]);
  let years = $state<AcademicYear[]>([]);
  let enrollments = $state<Enrollment[]>([]);
  let selectedClassId = $state('');
  let selectedUser = $state<User | null>(null);
  let loading = $state(true);
  let saving = $state(false);
  let error = $state('');
  let toast = $state('');
  let search = $state('');

  // Shared modal form state
  let formName = $state('');
  let formLogin = $state('');
  let formPin = $state('');
  let formRole = $state<Role>('teacher');
  let formSubjectId = $state('');
  let formAdmission = $state('');
  let formSort = $state<number | undefined>(undefined);
  let formStudentId = $state('');
  let formRoll = $state('');
  let formStarts = $state('');
  let formEnds = $state('');
  let formYearName = $state('');
  let formYearStart = $state('');
  let formYearEnd = $state('');
  let formYearActive = $state(true);

  const filteredStudents = $derived(students.filter((item) => `${item.name} ${item.admission_no}`.toLowerCase().includes(search.toLowerCase())));
  const filteredUsers = $derived(users.filter((item) => `${item.display_name} ${item.login_name ?? ''}`.toLowerCase().includes(search.toLowerCase())));
  const activeStudents = $derived(students.filter((item) => item.active === 1));
  const activeClasses = $derived(classes.filter((item) => item.active === 1).sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999)));

  onMount(loadAll);

  async function loadAll() {
    loading = true;
    error = '';
    const results = await Promise.allSettled([
      api.users(),
      api.students(),
      api.adminClasses(),
      api.subjects(),
      api.academicYears(),
    ]);
    if (results[0].status === 'fulfilled') users = results[0].value;
    if (results[1].status === 'fulfilled') students = results[1].value;
    if (results[2].status === 'fulfilled') classes = results[2].value;
    if (results[3].status === 'fulfilled') subjects = results[3].value;
    if (results[4].status === 'fulfilled') years = results[4].value;
    const firstError = results.find((item) => item.status === 'rejected');
    if (firstError?.status === 'rejected') error = errorMessage(firstError.reason);
    if (!selectedClassId) selectedClassId = (results[2].status === 'fulfilled' ? results[2].value : classes).find((item) => item.active === 1)?.id ?? '';
    loading = false;
    if (selectedClassId) void loadEnrollments();
  }

  async function loadEnrollments() {
    if (!selectedClassId) {
      enrollments = [];
      return;
    }
    try {
      enrollments = await api.enrollments(selectedClassId);
    } catch (e) {
      error = errorMessage(e);
    }
  }

  function resetForm() {
    formName = '';
    formLogin = '';
    formPin = '';
    formRole = 'teacher';
    formSubjectId = '';
    formAdmission = '';
    formSort = undefined;
    formStudentId = '';
    formRoll = '';
    formStarts = bootstrap.academic_year?.starts_on ?? new Date().toISOString().slice(0, 10);
    formEnds = '';
    formYearName = '';
    formYearStart = '';
    formYearEnd = '';
    formYearActive = true;
    selectedUser = null;
    error = '';
  }

  function openModal(type: Exclude<ModalType, null>) {
    resetForm();
    modal = type;
  }

  function editUser(user: User) {
    resetForm();
    selectedUser = user;
    formName = user.display_name;
    formLogin = user.login_name ?? '';
    formRole = user.role;
    formSubjectId = user.default_subject_id ?? '';
    modal = 'edit-staff';
  }

  function notify(message: string) {
    toast = message;
    setTimeout(() => { if (toast === message) toast = ''; }, 3000);
  }

  async function submitModal() {
    saving = true;
    error = '';
    try {
      if (modal === 'staff') {
        await api.createUser({ display_name: formName.trim(), login_name: formLogin.trim() || undefined, role: formRole, pin: formPin, default_subject_id: formSubjectId || undefined });
        users = await api.users();
        notify('Staff account created');
      } else if (modal === 'edit-staff' && selectedUser) {
        await api.updateUser(selectedUser.id, {
          display_name: formName.trim(),
          role: formRole,
          ...(formLogin.trim() ? { login_name: formLogin.trim() } : {}),
          ...(formSubjectId ? { default_subject_id: formSubjectId } : {}),
        });
        users = await api.users();
        notify('Staff member updated');
      } else if (modal === 'student') {
        await api.createStudent({ admission_no: formAdmission.trim(), name: formName.trim() });
        students = await api.students();
        notify('Student added');
      } else if (modal === 'class') {
        await api.createClass({ name: formName.trim(), sort_order: formSort });
        classes = await api.adminClasses();
        notify('Class created');
      } else if (modal === 'subject') {
        await api.createSubject({ name: formName.trim() });
        subjects = await api.subjects();
        notify('Subject created');
      } else if (modal === 'enrollment') {
        await api.createEnrollment({ student_id: formStudentId, class_id: selectedClassId, roll_no: formRoll.trim() || undefined, starts_on: formStarts, ends_on: formEnds || null });
        await loadEnrollments();
        notify('Student enrolled');
      } else if (modal === 'year') {
        await api.createAcademicYear({ name: formYearName.trim(), starts_on: formYearStart, ends_on: formYearEnd, active: formYearActive });
        years = await api.academicYears();
        notify('Academic year created');
      } else if (modal === 'pin' && selectedUser) {
        await api.resetPin(selectedUser.id, formPin);
        notify(`PIN reset for ${selectedUser.display_name}`);
      }
      modal = null;
    } catch (e) {
      error = errorMessage(e);
    } finally {
      saving = false;
    }
  }

  async function toggleUser(user: User) {
    try {
      await api.setUserEnabled(user.id, user.status !== 'active');
      users = await api.users();
      notify(user.status === 'active' ? 'Staff account disabled' : 'Staff account enabled');
    } catch (e) { error = errorMessage(e); }
  }

  async function resetPin(user: User) {
    resetForm();
    selectedUser = user;
    modal = 'pin';
  }

  async function toggleStudent(student: Student) {
    try {
      await api.updateStudent(student.id, { active: student.active !== 1 });
      students = await api.students();
      notify(student.active === 1 ? 'Student deactivated' : 'Student reactivated');
    } catch (e) { error = errorMessage(e); }
  }

  async function toggleClass(item: SchoolClass) {
    try {
      await api.updateClass(item.id, { active: item.active !== 1 });
      classes = await api.adminClasses();
      notify(item.active === 1 ? 'Class archived' : 'Class restored');
    } catch (e) { error = errorMessage(e); }
  }

  async function toggleSubject(item: Subject) {
    try {
      await api.updateSubject(item.id, { active: item.active !== 1 });
      subjects = await api.subjects();
      notify(item.active === 1 ? 'Subject archived' : 'Subject restored');
    } catch (e) { error = errorMessage(e); }
  }

  async function removeEnrollment(item: Enrollment) {
    if (!confirm(`Remove ${item.student_name} from this class roster?`)) return;
    try {
      await api.deleteEnrollment(item.id);
      await loadEnrollments();
      notify('Enrollment removed');
    } catch (e) { error = errorMessage(e); }
  }

  function roleLabel(role: Role) {
    return role === 'super_admin' ? 'Super admin' : role === 'teacher_admin' ? 'Teacher admin' : 'Teacher';
  }

  function subjectLabel(subjectId: string | null) {
    if (!subjectId) return null;
    return subjects.find((subject) => subject.id === subjectId)?.name ?? 'Unknown subject';
  }
</script>

<svelte:head><title>Manage school · VART</title></svelte:head>

<div class="page-enter">
  <header class="mb-6 flex items-end justify-between gap-4">
    <div><p class="eyebrow">Administration</p><h1 class="page-title mt-1">Manage school</h1><p class="mt-2 text-[15px] text-apple-secondary">Staff, students, classes and academic settings.</p></div>
    <button class="icon-button" type="button" onclick={loadAll} aria-label="Refresh data"><RefreshCw class={loading ? 'animate-spin' : ''} size={18} /></button>
  </header>

  {#if toast}
    <div class="fixed top-4 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-2 rounded-full bg-apple-label px-4 py-2.5 text-sm font-semibold whitespace-nowrap text-apple-bg shadow-xl" role="status"><CircleCheck class="text-apple-green" size={17} />{toast}</div>
  {/if}

  {#if error}<div class="error-banner mb-5"><CircleAlert size={18} /><span>{error}</span><button type="button" onclick={() => error = ''}>Dismiss</button></div>{/if}

  <div class="mb-6 overflow-x-auto border-b border-apple-separator">
    <nav class="flex min-w-max gap-5" aria-label="Administration section">
      <button class:tab-active={tab === 'staff'} class="tab-button" type="button" onclick={() => { tab = 'staff'; search = ''; }}><ShieldCheck size={17} /> Staff</button>
      <button class:tab-active={tab === 'students'} class="tab-button" type="button" onclick={() => { tab = 'students'; search = ''; }}><Users size={17} /> Students</button>
      <button class:tab-active={tab === 'classes'} class="tab-button" type="button" onclick={() => tab = 'classes'}><GraduationCap size={17} /> Classes</button>
      <button class:tab-active={tab === 'subjects'} class="tab-button" type="button" onclick={() => tab = 'subjects'}><BookOpen size={17} /> Subjects</button>
      <button class:tab-active={tab === 'enrollments'} class="tab-button" type="button" onclick={() => { tab = 'enrollments'; void loadEnrollments(); }}><UserPlus size={17} /> Enrollments</button>
      <button class:tab-active={tab === 'years'} class="tab-button" type="button" onclick={() => tab = 'years'}><CalendarRange size={17} /> Academic years</button>
    </nav>
  </div>

  {#if loading}
    <div class="grid min-h-72 place-items-center"><LoaderCircle class="animate-spin text-apple-blue" size={28} /></div>
  {:else if tab === 'staff'}
    <section>
      <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label class="relative block sm:w-72"><span class="sr-only">Search staff</span><Search class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-apple-tertiary" size={16} /><input class="field-input pl-9!" type="search" enterkeyhint="search" autocomplete="off" bind:value={search} placeholder="Search staff" /></label>
        <button class="primary-button" type="button" onclick={() => openModal('staff')}><Plus size={17} /> Add staff member</button>
      </div>
      <div class="surface-card overflow-hidden p-0!">
        {#each filteredUsers as user}
          {@const assignedSubject = subjectLabel(user.default_subject_id)}
          <div class="flex items-center gap-3 border-b border-apple-separator p-4 last:border-0 sm:px-5">
            <span class="student-avatar {user.status === 'active' ? 'bg-apple-indigo/10 text-apple-indigo' : 'bg-apple-fill text-apple-tertiary'}">{user.display_name.slice(0, 1)}</span>
            <span class="min-w-0 flex-1"><span class="flex items-center gap-2"><strong class="truncate text-sm sm:text-[15px]">{user.display_name}</strong>{#if user.id === bootstrap.user.id}<span class="badge-blue">You</span>{/if}</span><small class="block text-apple-secondary">{roleLabel(user.role)}{assignedSubject ? ` · ${assignedSubject}` : ' · No default subject'}{user.login_name ? ` · ${user.login_name}` : ''}</small></span>
            <span class="hidden rounded-full px-2.5 py-1 text-[11px] font-semibold sm:block {user.status === 'active' ? 'bg-apple-green/10 text-apple-green' : 'bg-apple-fill text-apple-secondary'}">{user.status === 'active' ? 'Active' : 'Disabled'}</span>
            <div class="flex gap-1">
              <button class="icon-button" type="button" title="Edit staff member" aria-label={`Edit ${user.display_name}`} onclick={() => editUser(user)}><Pencil size={16} /></button>
              <button class="icon-button" type="button" title="Reset PIN" aria-label={`Reset PIN for ${user.display_name}`} onclick={() => resetPin(user)}><KeyRound size={16} /></button>
              {#if user.id !== bootstrap.user.id}<button class="secondary-button h-9 px-3! text-xs" type="button" onclick={() => toggleUser(user)}>{user.status === 'active' ? 'Disable' : 'Enable'}</button>{/if}
            </div>
          </div>
        {/each}
      </div>
    </section>
  {:else if tab === 'students'}
    <section>
      <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label class="relative block sm:w-72"><span class="sr-only">Search students</span><Search class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-apple-tertiary" size={16} /><input class="field-input pl-9!" type="search" enterkeyhint="search" autocomplete="off" bind:value={search} placeholder="Name or admission number" /></label>
        <button class="primary-button" type="button" onclick={() => openModal('student')}><Plus size={17} /> Add student</button>
      </div>
      <div class="surface-card overflow-hidden p-0!">
        {#each filteredStudents as student}
          <div class="flex items-center gap-3 border-b border-apple-separator p-4 last:border-0 sm:px-5">
            <span class="student-avatar {student.active === 1 ? 'bg-apple-blue/10 text-apple-blue' : 'bg-apple-fill text-apple-tertiary'}">{student.name.slice(0, 1)}</span>
            <span class="min-w-0 flex-1"><strong class="block truncate text-sm sm:text-[15px]">{student.name}</strong><small class="text-apple-secondary">{student.admission_no}{student.leaving_date ? ` · Left ${student.leaving_date}` : ''}</small></span>
            <span class="hidden rounded-full px-2.5 py-1 text-[11px] font-semibold sm:block {student.active === 1 ? 'bg-apple-green/10 text-apple-green' : 'bg-apple-fill text-apple-secondary'}">{student.active === 1 ? 'Active' : 'Inactive'}</span>
            <button class="secondary-button h-9 px-3! text-xs" type="button" onclick={() => toggleStudent(student)}>{student.active === 1 ? 'Deactivate' : 'Reactivate'}</button>
          </div>
        {/each}
      </div>
      <p class="mt-3 text-xs text-apple-tertiary">Students with attendance history are deactivated rather than deleted, preserving reports.</p>
    </section>
  {:else if tab === 'classes'}
    <section>
      <div class="mb-4 flex items-center justify-between"><div><h2 class="section-title">Classes</h2><p class="mt-1 text-sm text-apple-secondary">Controls the order shown to teachers.</p></div><button class="primary-button" type="button" onclick={() => openModal('class')}><Plus size={17} /> Add class</button></div>
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {#each [...classes].sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999)) as item}
          <div class="surface-card p-4 {item.active !== 1 ? 'opacity-60' : ''}"><div class="flex items-start justify-between"><span class="grid size-11 place-items-center rounded-[14px] bg-apple-blue/10 font-bold text-apple-blue">{item.name.slice(0, 3)}</span><button class="icon-button" type="button" title={item.active === 1 ? 'Archive class' : 'Restore class'} aria-label={item.active === 1 ? `Archive class ${item.name}` : `Restore class ${item.name}`} onclick={() => toggleClass(item)}>{#if item.active === 1}<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-[18px]"><path stroke-linecap="round" stroke-linejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" /></svg>{:else}<ArchiveRestore size={18} />{/if}</button></div><h3 class="mt-4 text-lg font-bold">Class {item.name}</h3><p class="mt-1 text-xs text-apple-secondary">Sort order {item.sort_order ?? 'automatic'} · {item.active === 1 ? 'Active' : 'Archived'}</p></div>
        {/each}
      </div>
    </section>
  {:else if tab === 'subjects'}
    <section>
      <div class="mb-4 flex items-center justify-between"><div><h2 class="section-title">Subjects</h2><p class="mt-1 text-sm text-apple-secondary">Available when submitting a register.</p></div><button class="primary-button" type="button" onclick={() => openModal('subject')}><Plus size={17} /> Add subject</button></div>
      <div class="surface-card overflow-hidden p-0!">
        {#each subjects as subject}
          <div class="flex items-center gap-3 border-b border-apple-separator p-4 last:border-0 sm:px-5"><span class="grid size-10 place-items-center rounded-xl bg-apple-purple/10 text-apple-purple"><BookOpen size={18} /></span><span class="min-w-0 flex-1"><strong class="block text-sm sm:text-[15px]">{subject.name}</strong><small class="text-apple-secondary">{subject.active === 1 ? 'Available' : 'Archived'}</small></span><button class="secondary-button h-9 px-3! text-xs" type="button" onclick={() => toggleSubject(subject)}>{subject.active === 1 ? 'Archive' : 'Restore'}</button></div>
        {/each}
      </div>
    </section>
  {:else if tab === 'enrollments'}
    <section>
      <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <label class="sm:w-64"><span class="field-label">Class roster</span><span class="relative block"><select class="field-input appearance-none pr-9" bind:value={selectedClassId} onchange={loadEnrollments}>{#each activeClasses as item}<option value={item.id}>Class {item.name}</option>{/each}</select><ChevronDown class="pointer-events-none absolute top-3.5 right-3 text-apple-tertiary" size={16} /></span></label>
        <button class="primary-button" type="button" onclick={() => openModal('enrollment')} disabled={!selectedClassId}><UserPlus size={17} /> Enroll student</button>
      </div>
      <div class="surface-card overflow-hidden p-0!">
        {#if enrollments.length === 0}<div class="empty-card border-0! py-12"><Users class="text-apple-tertiary" size={30} /><h3>No active enrollments</h3><p>Add students to this class roster.</p></div>{/if}
        {#each enrollments as enrollment}
          <div class="flex items-center gap-3 border-b border-apple-separator p-4 last:border-0 sm:px-5"><span class="student-avatar bg-apple-blue/10 text-apple-blue">{enrollment.student_name.slice(0, 1)}</span><span class="min-w-0 flex-1"><strong class="block truncate text-sm sm:text-[15px]">{enrollment.student_name}</strong><small class="text-apple-secondary">{enrollment.roll_no ? `Roll ${enrollment.roll_no} · ` : ''}{enrollment.admission_no} · from {enrollment.starts_on}{enrollment.ends_on ? ` to ${enrollment.ends_on}` : ''}</small></span><button class="secondary-button h-9 px-3! text-xs text-apple-red" type="button" onclick={() => removeEnrollment(enrollment)}>Remove</button></div>
        {/each}
      </div>
    </section>
  {:else if tab === 'years'}
    <section>
      <div class="mb-4 flex items-center justify-between"><div><h2 class="section-title">Academic years</h2><p class="mt-1 text-sm text-apple-secondary">Exactly one year must be active for attendance.</p></div><button class="primary-button" type="button" onclick={() => openModal('year')}><Plus size={17} /> Add year</button></div>
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {#each years as year}
          <div class="surface-card p-5 {year.active === 1 ? 'border-apple-green/25!' : ''}"><div class="flex items-center justify-between"><span class="grid size-10 place-items-center rounded-xl bg-apple-indigo/10 text-apple-indigo"><CalendarRange size={19} /></span>{#if year.active === 1}<span class="flex items-center gap-1 rounded-full bg-apple-green/10 px-2.5 py-1 text-[11px] font-semibold text-apple-green"><Check size={12} /> Active</span>{/if}</div><h3 class="mt-4 text-lg font-bold">{year.name}</h3><p class="mt-1 text-xs text-apple-secondary">{year.starts_on} — {year.ends_on}</p></div>
        {/each}
      </div>
    </section>
  {/if}
</div>

{#if modal}
  <Modal
    title={modal === 'staff' ? 'Add staff member' : modal === 'edit-staff' ? `Edit ${selectedUser?.display_name}` : modal === 'student' ? 'Add student' : modal === 'class' ? 'Add class' : modal === 'subject' ? 'Add subject' : modal === 'enrollment' ? 'Enroll student' : modal === 'year' ? 'Add academic year' : `Reset ${selectedUser?.display_name}’s PIN`}
    description={modal === 'pin' ? 'Their existing PIN will stop working immediately.' : undefined}
    onClose={() => { modal = null; error = ''; }}
  >
    <form class="space-y-4" onsubmit={(event) => { event.preventDefault(); void submitModal(); }}>
      {#if modal === 'staff' || modal === 'edit-staff'}
        <label><span class="field-label">Display name</span><input class="field-input" bind:value={formName} autocomplete="off" required /></label>
        <label><span class="field-label">Login name <span class="font-normal text-apple-tertiary">(optional)</span></span><input class="field-input" bind:value={formLogin} autocomplete="off" /></label>
        <div class="grid gap-4 {modal === 'staff' ? 'sm:grid-cols-2' : ''}">
          <label><span class="field-label">Role</span><span class="relative block"><select class="field-input appearance-none pr-9" bind:value={formRole}><option value="teacher">Teacher</option><option value="teacher_admin">Teacher admin</option>{#if bootstrap.user.role === 'super_admin'}<option value="super_admin">Super admin</option>{/if}</select><ChevronDown class="pointer-events-none absolute top-3.5 right-3 text-apple-tertiary" size={16} /></span></label>
          {#if modal === 'staff'}<label><span class="field-label">6-digit PIN</span><input class="field-input tracking-[0.2em]" bind:value={formPin} type="password" inputmode="numeric" enterkeyhint="done" pattern="[0-9][0-9][0-9][0-9][0-9][0-9]" maxlength="6" autocomplete="new-password" required /></label>{/if}
        </div>
        <label><span class="field-label">Default subject <span class="font-normal text-apple-tertiary">(optional)</span></span><span class="relative block"><select class="field-input appearance-none pr-9" bind:value={formSubjectId}><option value="">{modal === 'staff' ? 'None' : 'Leave unchanged'}</option>{#each subjects.filter((item) => item.active === 1) as subject}<option value={subject.id}>{subject.name}</option>{/each}</select><ChevronDown class="pointer-events-none absolute top-3.5 right-3 text-apple-tertiary" size={16} /></span></label>
      {:else if modal === 'student'}
        <label><span class="field-label">Student name</span><input class="field-input" bind:value={formName} required /></label><label><span class="field-label">Admission number</span><input class="field-input" bind:value={formAdmission} required /></label>
      {:else if modal === 'class'}
        <label><span class="field-label">Class name</span><input class="field-input" bind:value={formName} placeholder="e.g. 9C" required /></label><label><span class="field-label">Sort order <span class="font-normal text-apple-tertiary">(optional)</span></span><input class="field-input" bind:value={formSort} type="number" inputmode="numeric" min="0" /></label>
      {:else if modal === 'subject'}
        <label><span class="field-label">Subject name</span><input class="field-input" bind:value={formName} placeholder="e.g. Biology" required /></label>
      {:else if modal === 'enrollment'}
        <label><span class="field-label">Student</span><span class="relative block"><select class="field-input appearance-none pr-9" bind:value={formStudentId} required><option value="" disabled>Choose a student</option>{#each activeStudents.filter((student) => !enrollments.some((item) => item.student_id === student.id)) as student}<option value={student.id}>{student.name} · {student.admission_no}</option>{/each}</select><ChevronDown class="pointer-events-none absolute top-3.5 right-3 text-apple-tertiary" size={16} /></span></label><div class="grid gap-4 sm:grid-cols-2"><label><span class="field-label">Roll number</span><input class="field-input" bind:value={formRoll} /></label><label><span class="field-label">Starts on</span><input class="field-input" bind:value={formStarts} type="date" required /></label></div><label><span class="field-label">Ends on <span class="font-normal text-apple-tertiary">(optional)</span></span><input class="field-input" bind:value={formEnds} type="date" /></label>
      {:else if modal === 'year'}
        <label><span class="field-label">Year name</span><input class="field-input" bind:value={formYearName} placeholder="e.g. 2027–2028" required /></label><div class="grid gap-4 sm:grid-cols-2"><label><span class="field-label">Starts on</span><input class="field-input" bind:value={formYearStart} type="date" required /></label><label><span class="field-label">Ends on</span><input class="field-input" bind:value={formYearEnd} type="date" required /></label></div><label class="flex items-center gap-3 rounded-xl bg-apple-bg p-3"><input class="size-4 accent-apple-blue" type="checkbox" bind:checked={formYearActive} /><span><strong class="block text-sm">Make this the active year</strong><small class="text-apple-secondary">This deactivates the current year.</small></span></label>
      {:else if modal === 'pin'}
        <label><span class="field-label">New 6-digit PIN</span><input class="field-input tracking-[0.2em]" bind:value={formPin} type="password" inputmode="numeric" enterkeyhint="done" pattern="[0-9][0-9][0-9][0-9][0-9][0-9]" maxlength="6" autocomplete="new-password" required /></label>
      {/if}

      {#if error}<div class="flex items-start gap-2 rounded-xl bg-apple-red/[0.16] p-3 text-sm font-medium text-apple-red"><CircleAlert class="mt-0.5 shrink-0" size={17} />{error}</div>{/if}
      <div class="flex justify-end gap-2 pt-2"><button class="secondary-button" type="button" onclick={() => { modal = null; error = ''; }}>Cancel</button><button class="primary-button" type="submit" disabled={saving}>{#if saving}<LoaderCircle class="animate-spin" size={17} />{/if}{saving ? 'Saving…' : modal === 'pin' ? 'Reset PIN' : 'Save'}</button></div>
    </form>
  </Modal>
{/if}
