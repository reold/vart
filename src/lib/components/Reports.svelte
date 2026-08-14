<script lang="ts">
  import { onMount } from 'svelte';
  import {
    CalendarDays,
    ChartNoAxesColumn,
    ChevronDown,
    CircleAlert,
    FileChartColumn,
    LoaderCircle,
    RefreshCw,
    Search,
    TrendingDown,
    UserRound,
    Users,
  } from '@lucide/svelte';
  import { api, errorMessage } from '$lib/api';
  import type { Bootstrap, DayAttendance, LowAttendance, ReportStatus, Student, StudentReport } from '$lib/types';

  let { bootstrap }: { bootstrap: Bootstrap } = $props();

  type Tab = 'day' | 'student' | 'low';
  let tab = $state<Tab>('day');
  let selectedClassId = $state('');
  let date = $state(new Date().toISOString().slice(0, 10));
  let dayReport = $state<DayAttendance | null>(null);
  let students = $state<Student[]>([]);
  let selectedStudentId = $state('');
  let studentReport = $state<StudentReport | null>(null);
  let lowReport = $state<LowAttendance | null>(null);
  let threshold = $state(75);
  let search = $state('');
  let loading = $state(false);
  let error = $state('');

  const activeClasses = $derived(
    [...bootstrap.classes].filter((item) => item.active === 1).sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999)),
  );
  const filteredStudents = $derived(
    students.filter((item) => `${item.name} ${item.admission_no}`.toLowerCase().includes(search.toLowerCase())),
  );
  const dayStudents = $derived.by(() => {
    if (!dayReport) return [];
    const rows = new Map<string, { id: string; name: string; admission: string; roll: string | null }>();
    for (const period of dayReport.periods) {
      for (const mark of period.marks) {
        if (!rows.has(mark.student_id)) rows.set(mark.student_id, { id: mark.student_id, name: mark.name, admission: mark.admission_no, roll: mark.roll_no });
      }
    }
    return [...rows.values()].sort((a, b) => Number(a.roll ?? 9999) - Number(b.roll ?? 9999) || a.name.localeCompare(b.name));
  });

  onMount(async () => {
    selectedClassId = activeClasses[0]?.id ?? '';
    void loadStudents();
    if (selectedClassId) await loadDay();
  });

  async function loadStudents() {
    try {
      students = (await api.students()).filter((item) => item.active === 1);
    } catch {
      // Reports that do not need a student list still work.
    }
  }

  async function loadDay() {
    if (!selectedClassId) return;
    loading = true;
    error = '';
    try {
      dayReport = await api.dayAttendance(selectedClassId, date);
    } catch (e) {
      error = errorMessage(e);
      dayReport = null;
    } finally {
      loading = false;
    }
  }

  async function loadStudent(id: string) {
    selectedStudentId = id;
    if (!id) {
      studentReport = null;
      return;
    }
    loading = true;
    error = '';
    try {
      studentReport = await api.studentReport(id);
    } catch (e) {
      error = errorMessage(e);
      studentReport = null;
    } finally {
      loading = false;
    }
  }

  async function loadLow() {
    loading = true;
    error = '';
    try {
      lowReport = await api.lowAttendance(threshold);
    } catch (e) {
      error = errorMessage(e);
      lowReport = null;
    } finally {
      loading = false;
    }
  }

  function markFor(studentId: string, periodNo: number) {
    return dayReport?.periods.find((item) => item.period_no === periodNo)?.marks.find((item) => item.student_id === studentId)?.status ?? null;
  }

  function statusLetter(status: ReportStatus) {
    if (!status) return '—';
    const clean = status.replace('inferred_', '');
    return clean === 'present' ? 'P' : clean === 'absent' ? 'A' : 'L';
  }

  function statusTitle(status: ReportStatus) {
    if (!status) return 'No submitted or inferred status';
    return `${status.startsWith('inferred_') ? 'Inferred ' : ''}${status.replace('inferred_', '')}`;
  }

  function percentColor(value: number) {
    return value < 60 ? 'text-apple-red' : value < 75 ? 'text-apple-orange' : 'text-apple-green';
  }

  function formatDate(value: string) {
    const [year, month, day] = value.split('-').map(Number);
    return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(year, month - 1, day));
  }
</script>

<svelte:head><title>Reports · VART</title></svelte:head>

<div class="page-enter">
  <header class="mb-6">
    <p class="eyebrow">Insights</p>
    <h1 class="page-title mt-1">Attendance reports</h1>
    <p class="mt-2 text-[15px] text-apple-secondary">Review daily registers and monitor attendance over time.</p>
  </header>

  <div class="mb-6 overflow-x-auto border-b border-apple-separator">
    <nav class="flex min-w-max gap-6" aria-label="Report type">
      <button class:tab-active={tab === 'day'} class="tab-button" type="button" onclick={() => tab = 'day'}><CalendarDays size={17} /> Class day</button>
      <button class:tab-active={tab === 'student'} class="tab-button" type="button" onclick={() => tab = 'student'}><UserRound size={17} /> Student</button>
      <button class:tab-active={tab === 'low'} class="tab-button" type="button" onclick={() => { tab = 'low'; if (!lowReport) void loadLow(); }}><TrendingDown size={17} /> Low attendance</button>
    </nav>
  </div>

  {#if error}<div class="error-banner mb-5"><CircleAlert size={18} /><span>{error}</span></div>{/if}

  {#if tab === 'day'}
    <section>
      <div class="surface-card mb-5 grid gap-3 p-4 sm:grid-cols-[1fr_190px_auto] sm:items-end">
        <label><span class="field-label">Class</span><span class="relative block"><select class="field-input appearance-none pr-9" bind:value={selectedClassId}>{#each activeClasses as item}<option value={item.id}>Class {item.name}</option>{/each}</select><ChevronDown class="pointer-events-none absolute top-3.5 right-3 text-apple-tertiary" size={16} /></span></label>
        <label><span class="field-label">Date</span><input class="field-input" type="date" bind:value={date} /></label>
        <button class="primary-button h-11" type="button" onclick={loadDay} disabled={!selectedClassId || loading}>{#if loading}<LoaderCircle class="animate-spin" size={17} />{:else}<RefreshCw size={17} />{/if}View report</button>
      </div>

      {#if loading && !dayReport}
        <div class="grid min-h-72 place-items-center"><LoaderCircle class="animate-spin text-apple-blue" size={28} /></div>
      {:else if dayReport}
        <div class="mb-5 grid gap-3 sm:grid-cols-4">
          <div class="metric-card"><span class="metric-icon bg-apple-blue/10 text-apple-blue"><FileChartColumn size={19} /></span><div><p class="metric-value">{dayReport.daily_summary.total_periods}</p><p class="metric-label">Periods marked</p></div></div>
          <div class="metric-card"><span class="metric-icon bg-apple-green/10 text-apple-green"><Users size={19} /></span><div><p class="metric-value">{dayReport.daily_summary.present_count}</p><p class="metric-label">Present marks</p></div></div>
          <div class="metric-card"><span class="metric-icon bg-apple-red/10 text-apple-red"><Users size={19} /></span><div><p class="metric-value">{dayReport.daily_summary.absent_count}</p><p class="metric-label">Absent marks</p></div></div>
          <div class="metric-card"><span class="metric-icon bg-apple-indigo/10 text-apple-indigo"><ChartNoAxesColumn size={19} /></span><div><p class="metric-value">{Number(dayReport.daily_summary.attendance_percentage ?? 0).toFixed(1)}%</p><p class="metric-label">Raw attendance</p></div></div>
        </div>

        <div class="surface-card overflow-hidden p-0!">
          <div class="flex items-center justify-between border-b border-apple-separator p-4">
            <div><h2 class="section-title">Class {dayReport.class_name}</h2><p class="mt-0.5 text-xs text-apple-secondary">{formatDate(dayReport.date)} · raw submitted data</p></div>
            <div class="flex items-center gap-2 text-[10px] font-bold text-apple-tertiary"><span class="status-legend bg-apple-green/15 text-apple-green">P</span><span class="status-legend bg-apple-red/15 text-apple-red">A</span><span class="status-legend bg-apple-orange/15 text-apple-orange">L</span></div>
          </div>
          {#if dayStudents.length === 0}
            <div class="empty-card border-0! py-14"><CalendarDays class="text-apple-tertiary" size={30} /><h3>No attendance submitted</h3><p>No periods have been recorded for this class and date.</p></div>
          {:else}
            <div class="overflow-x-auto">
              <table class="report-table min-w-[700px]">
                <thead><tr><th class="sticky left-0 z-10 min-w-52 bg-apple-bg! text-left!">Student</th>{#each Array(7) as _, index}<th>P{index + 1}</th>{/each}</tr></thead>
                <tbody>
                  {#each dayStudents as student}
                    <tr><td class="sticky left-0 z-10 bg-apple-surface"><strong>{student.name}</strong><small>{student.roll ? `Roll ${student.roll} · ` : ''}{student.admission}</small></td>{#each Array(7) as _, index}{@const status = markFor(student.id, index + 1)}<td><span title={statusTitle(status)} class="report-status status-{status ?? 'none'}">{statusLetter(status)}</span></td>{/each}</tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>
      {/if}
    </section>
  {:else if tab === 'student'}
    <section class="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
      <div class="surface-card h-fit p-3">
        <label class="relative block"><span class="sr-only">Search students</span><Search class="absolute top-3 left-3 text-apple-tertiary" size={16} /><input class="field-input pl-9" bind:value={search} placeholder="Search students" /></label>
        <div class="mt-2 max-h-[430px] overflow-y-auto">
          {#if students.length === 0}<p class="p-5 text-center text-sm text-apple-secondary">No active students found.</p>{/if}
          {#each filteredStudents as student}
            <button class:student-picker-active={selectedStudentId === student.id} class="student-picker" type="button" onclick={() => loadStudent(student.id)}>
              <span class="student-avatar size-9! bg-apple-blue/10 text-apple-blue">{student.name.slice(0, 1)}</span><span class="min-w-0 flex-1"><strong>{student.name}</strong><small>{student.admission_no}</small></span>
            </button>
          {/each}
        </div>
      </div>

      <div>
        {#if loading}
          <div class="grid min-h-72 place-items-center"><LoaderCircle class="animate-spin text-apple-blue" size={28} /></div>
        {:else if studentReport}
          <div class="mb-5 overflow-hidden rounded-2xl bg-[#071B33] p-5 text-white sm:p-6">
            <div class="flex flex-col gap-5 sm:flex-row sm:items-center">
              <span class="grid size-14 place-items-center rounded-2xl bg-white/10 text-xl font-bold">{studentReport.student.name.slice(0, 1)}</span>
              <div class="min-w-0 flex-1"><h2 class="truncate text-xl font-bold">{studentReport.student.name}</h2><p class="mt-1 text-xs text-white/75">{studentReport.student.class_name ? `Class ${studentReport.student.class_name} · ` : ''}{studentReport.student.roll_no ? `Roll ${studentReport.student.roll_no} · ` : ''}{studentReport.student.admission_no}</p></div>
              <div class="sm:text-right"><p class="text-3xl font-bold {percentColor(studentReport.attendance_percentage)}">{studentReport.attendance_percentage.toFixed(1)}%</p><p class="mt-1 text-xs text-white/80">year attendance</p></div>
            </div>
            <div class="mt-6 grid grid-cols-3 border-t border-white/10 pt-5 text-center sm:text-left"><div><p class="font-bold">{studentReport.total_days}</p><p class="text-xs text-white/80">school days</p></div><div><p class="font-bold">{studentReport.total_credit.toFixed(1)}</p><p class="text-xs text-white/80">credits earned</p></div><div><p class="font-bold">{studentReport.total_denominator}</p><p class="text-xs text-white/80">period total</p></div></div>
          </div>

          <div class="surface-card overflow-hidden p-0!">
            <div class="border-b border-apple-separator p-4"><h3 class="section-title">Period breakdown</h3><p class="mt-1 text-xs text-apple-secondary">Faded cells are inferred from the nearest submitted period.</p></div>
            {#if studentReport.period_breakdown.length === 0}
              <div class="empty-card border-0! py-12"><FileChartColumn class="text-apple-tertiary" size={30} /><h3>No attendance history</h3><p>This student has no counted attendance days this year.</p></div>
            {:else}
              <div class="overflow-x-auto">
                <table class="report-table min-w-[650px]"><thead><tr><th class="min-w-32 text-left!">Date</th>{#each Array(7) as _, index}<th>P{index + 1}</th>{/each}<th>Credit</th></tr></thead><tbody>{#each studentReport.period_breakdown as day}<tr><td><strong>{formatDate(day.date)}</strong></td>{#each day.periods as period}<td><span title={statusTitle(period.status)} class:inferred-status={period.status?.startsWith('inferred_')} class="report-status status-{period.status?.replace('inferred_', '') ?? 'none'}">{statusLetter(period.status)}</span></td>{/each}<td><strong>{day.daily_credit.toFixed(1)}/{day.daily_denominator}</strong></td></tr>{/each}</tbody></table>
              </div>
            {/if}
          </div>
        {:else}
          <div class="empty-card min-h-72"><UserRound class="text-apple-tertiary" size={34} /><h3>Choose a student</h3><p>Select a student to view their full-year attendance with seven-period inference.</p></div>
        {/if}
      </div>
    </section>
  {:else}
    <section>
      <div class="surface-card mb-5 flex flex-col gap-4 p-4 sm:flex-row sm:items-end">
        <label class="sm:w-48"><span class="field-label">Below threshold</span><span class="relative block"><input class="field-input pr-9" type="number" min="0" max="100" bind:value={threshold} /><span class="pointer-events-none absolute top-3 right-3 text-sm font-semibold text-apple-secondary">%</span></span></label>
        <button class="primary-button h-11" type="button" onclick={loadLow} disabled={loading}>{#if loading}<LoaderCircle class="animate-spin" size={17} /> Scanning students…{:else}<RefreshCw size={17} /> Run report{/if}</button>
        <p class="text-xs leading-5 text-apple-tertiary sm:ml-auto sm:max-w-xs">Uses inferred seven-period attendance and may take a moment for large rosters.</p>
      </div>

      {#if loading && !lowReport}
        <div class="grid min-h-72 place-items-center"><div class="text-center"><LoaderCircle class="mx-auto animate-spin text-apple-blue" size={28} /><p class="mt-3 text-sm text-apple-secondary">Calculating each student’s attendance…</p></div></div>
      {:else if lowReport}
        <div class="surface-card overflow-hidden p-0!">
          <div class="flex items-center justify-between border-b border-apple-separator p-4 sm:p-5"><div><h2 class="section-title">Students below {lowReport.threshold}%</h2><p class="mt-1 text-xs text-apple-secondary">{lowReport.count} {lowReport.count === 1 ? 'student needs' : 'students need'} attention</p></div><span class="grid size-10 place-items-center rounded-xl bg-apple-orange/10 font-bold text-apple-orange">{lowReport.count}</span></div>
          {#if lowReport.students.length === 0}
            <div class="empty-card border-0! py-14"><ChartNoAxesColumn class="text-apple-green" size={32} /><h3>Everyone is on track</h3><p>No students are below the selected threshold.</p></div>
          {:else}
            <div class="divide-y divide-apple-separator">
              {#each lowReport.students as student, index}
                <button class="flex w-full items-center gap-3 p-4 text-left transition hover:bg-apple-bg/70 sm:px-5" type="button" onclick={() => { tab = 'student'; void loadStudent(student.student_id); }}>
                  <span class="w-5 text-center text-xs font-semibold text-apple-tertiary">{index + 1}</span>
                  <span class="student-avatar bg-apple-orange/10 text-apple-orange">{student.name.slice(0, 1)}</span>
                  <span class="min-w-0 flex-1"><strong class="block truncate text-sm">{student.name}</strong><small class="text-apple-secondary">Class {student.class_name}{student.roll_no ? ` · Roll ${student.roll_no}` : ''} · {student.admission_no}</small></span>
                  <span class="text-right"><strong class="block text-lg {percentColor(student.attendance_percentage)}">{student.attendance_percentage.toFixed(1)}%</strong><small class="text-apple-tertiary">{student.total_credit.toFixed(1)}/{student.total_denominator}</small></span>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </section>
  {/if}
</div>
