<script lang="ts">
  import { onMount } from 'svelte';
  import {
    ArrowLeft,
    Check,
    ChevronDown,
    ChevronRight,
    CircleAlert,
    CircleCheck,
    Clock3,
    ClipboardCheck,
    LoaderCircle,
    RefreshCw,
    RotateCcw,
    Save,
    Sparkles,
    UserCheck,
    UserRoundCheck,
    Users,
  } from '@lucide/svelte';
  import { api, errorMessage } from '$lib/api';
  import type {
    AttendanceDraft,
    AttendanceStatus,
    Bootstrap,
    ClassToday,
    MarkInput,
    SchoolClass,
    Subject,
    SubmitResult,
  } from '$lib/types';

  let {
    bootstrap,
    initialClassId,
    onDone,
  }: {
    bootstrap: Bootstrap;
    initialClassId?: string;
    onDone?: () => void;
  } = $props();

  type Step = 'classes' | 'periods' | 'register' | 'success';
  type EditableMark = MarkInput & { name: string; admission_no: string; roll_no: string | null; was_hidden: boolean };

  let step = $state<Step>('classes');
  let selectedClass = $state<SchoolClass | null>(null);
  let today = $state<ClassToday | null>(null);
  let suggestedPeriod = $state<number | null>(null);
  let draft = $state<AttendanceDraft | null>(null);
  let marks = $state<Record<string, EditableMark>>({});
  let subjects = $state<Subject[]>([]);
  let selectedSubjectId = $state('');
  let classStatuses = $state<Record<string, ClassToday>>({});
  let classStatusLoading = $state(true);
  let loading = $state(false);
  let submitting = $state(false);
  let error = $state('');
  let showEarlier = $state(false);
  let result = $state<SubmitResult | null>(null);

  const activeClasses = $derived(
    [...bootstrap.classes]
      .filter((item) => item.active === 1)
      .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999) || a.name.localeCompare(b.name)),
  );
  const markList = $derived(Object.values(marks));
  const presentCount = $derived(markList.filter((mark) => mark.status === 'present').length);
  const absentCount = $derived(markList.filter((mark) => mark.status === 'absent').length);
  const lateCount = $derived(markList.filter((mark) => mark.status === 'late').length);
  const earlierAbsent = $derived(markList.filter((mark) => mark.was_hidden && mark.status === 'absent'));
  const visibleMarks = $derived(markList.filter((mark) => !mark.was_hidden || mark.status !== 'absent'));

  onMount(async () => {
    void loadClassStatuses();
    if (initialClassId) {
      const found = activeClasses.find((item) => item.id === initialClassId);
      if (found) await openClass(found);
    }
  });

  async function loadClassStatuses() {
    classStatusLoading = true;
    const results = await Promise.allSettled(activeClasses.map((item) => api.classToday(item.id)));
    const next: Record<string, ClassToday> = {};
    results.forEach((item, index) => {
      if (item.status === 'fulfilled') next[activeClasses[index].id] = item.value;
    });
    classStatuses = next;
    classStatusLoading = false;
  }

  async function openClass(item: SchoolClass) {
    selectedClass = item;
    step = 'periods';
    loading = true;
    error = '';
    try {
      const [day, suggestion] = await Promise.all([api.classToday(item.id), api.suggestPeriod(item.id)]);
      today = day;
      suggestedPeriod = suggestion.next_period;
      classStatuses = { ...classStatuses, [item.id]: day };
    } catch (e) {
      error = errorMessage(e);
    } finally {
      loading = false;
    }
  }

  async function openPeriod(periodNo: number) {
    if (!selectedClass) return;
    loading = true;
    error = '';
    try {
      const wasSubmitted = today?.periods.find((item) => item.period_no === periodNo)?.status === 'submitted';
      const [nextDraft, subjectList, existingDay] = await Promise.all([
        api.draft(selectedClass.id, periodNo),
        subjects.length ? Promise.resolve(subjects) : api.subjects().catch(() => []),
        wasSubmitted ? api.dayAttendance(selectedClass.id, today?.date) : Promise.resolve(null),
      ]);
      draft = nextDraft;
      subjects = subjectList.filter((item) => item.active === 1);
      selectedSubjectId = nextDraft.subject?.id ?? bootstrap.default_subject?.id ?? '';
      const existing = existingDay?.periods.find((item) => item.period_no === periodNo)?.marks ?? [];
      const existingById = new Map(existing.map((item) => [item.student_id, item]));
      marks = Object.fromEntries(
        nextDraft.students.map((student) => {
          const saved = existingById.get(student.student_id);
          return [
            student.student_id,
            {
              student_id: student.student_id,
              name: student.name,
              admission_no: student.admission_no,
              roll_no: student.roll_no,
              was_hidden: student.hidden_as_absent_earlier && !saved,
              status: saved?.status ?? student.default_status,
              late_minutes: saved?.late_minutes ?? (student.default_status === 'late' ? 0 : null),
              note: saved?.note ?? null,
            },
          ];
        }),
      );
      showEarlier = false;
      step = 'register';
    } catch (e) {
      error = errorMessage(e);
    } finally {
      loading = false;
    }
  }

  function setStatus(id: string, status: AttendanceStatus) {
    const current = marks[id];
    if (!current) return;
    marks = {
      ...marks,
      [id]: {
        ...current,
        status,
        late_minutes: status === 'late' ? (current.late_minutes ?? 0) : null,
      },
    };
  }

  function setLateMinutes(id: string, event: Event) {
    const rawValue = Number((event.currentTarget as HTMLInputElement).value);
    const value = Math.max(0, Math.trunc(Number.isFinite(rawValue) ? rawValue : 0));
    marks = { ...marks, [id]: { ...marks[id], late_minutes: value } };
  }

  function markAllPresent() {
    marks = Object.fromEntries(Object.entries(marks).map(([id, mark]) => [id, { ...mark, status: 'present', late_minutes: null }]));
  }

  function resetMarks() {
    if (!draft) return;
    marks = Object.fromEntries(
      draft.students.map((student) => [
        student.student_id,
        {
          ...marks[student.student_id],
          status: student.default_status,
          late_minutes: student.default_status === 'late' ? 0 : null,
        },
      ]),
    );
  }

  async function submit() {
    if (!draft || !selectedClass || markList.length !== draft.students.length) return;
    submitting = true;
    error = '';
    try {
      result = await api.submitAttendance({
        class_id: selectedClass.id,
        subject_id: selectedSubjectId || null,
        session_date: draft.session_date,
        period_no: draft.period_no,
        marks: markList.map(({ student_id, status, late_minutes, note }) => {
          const mark: MarkInput = { student_id, status };
          if (status === 'late') {
            mark.late_minutes = Math.max(0, Math.trunc(late_minutes ?? 0));
          }
          if (note?.trim()) mark.note = note.trim();
          return mark;
        }),
      });
      step = 'success';
      const day = await api.classToday(selectedClass.id).catch(() => null);
      if (day) {
        today = day;
        classStatuses = { ...classStatuses, [selectedClass.id]: day };
      }
    } catch (e) {
      error = errorMessage(e);
    } finally {
      submitting = false;
    }
  }

  function back() {
    error = '';
    if (step === 'register') step = 'periods';
    else if (step === 'periods') {
      selectedClass = null;
      today = null;
      step = 'classes';
    } else if (step === 'success') step = 'periods';
  }

  function formatServerDate(value: string) {
    const [year, month, day] = value.split('-').map(Number);
    return new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(year, month - 1, day));
  }
</script>

<svelte:head><title>Attendance · VART</title></svelte:head>

<div class="page-enter">
  {#if step === 'classes'}
    <header class="mb-7 flex items-end justify-between gap-4">
      <div><p class="eyebrow">Daily register</p><h1 class="page-title mt-1">Take attendance</h1><p class="mt-2 text-[15px] text-apple-secondary">Choose a class to see today’s seven periods.</p></div>
      <button class="icon-button" type="button" onclick={loadClassStatuses} aria-label="Refresh classes"><RefreshCw class={classStatusLoading ? 'animate-spin' : ''} size={18} /></button>
    </header>

    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {#each activeClasses as item}
        {@const status = classStatuses[item.id]}
        {@const done = status?.periods.filter((period) => period.status === 'submitted').length ?? 0}
        <button class="group surface-card p-5 text-left transition hover:-translate-y-0.5 hover:border-apple-blue/25 hover:shadow-md" type="button" onclick={() => openClass(item)}>
          <div class="flex items-start justify-between">
            <span class="grid size-12 place-items-center rounded-2xl bg-apple-blue/10 text-lg font-bold text-apple-blue">{item.name.slice(0, 3)}</span>
            <ChevronRight class="text-apple-tertiary transition group-hover:translate-x-0.5 group-hover:text-apple-blue" size={20} />
          </div>
          <h2 class="mt-5 text-xl font-bold tracking-tight">Class {item.name}</h2>
          <p class="mt-1 text-sm text-apple-secondary">{status ? `${status.students_count} students` : 'Loading roster…'}</p>
          <div class="mt-5 flex gap-1.5">
            {#each Array(7) as _, index}<span class:period-done={index < done} class="h-2 flex-1 rounded-full bg-apple-fill"></span>{/each}
          </div>
          <p class="mt-2.5 text-xs font-semibold {done === 7 ? 'text-apple-green' : 'text-apple-secondary'}">{done === 7 ? 'All periods complete' : `${done} of 7 periods complete`}</p>
        </button>
      {/each}
    </div>
  {:else if step === 'periods'}
    <header class="mb-7">
      <button class="back-button mb-5" type="button" onclick={back}><ArrowLeft size={17} /> All classes</button>
      <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p class="eyebrow">Today’s register</p><h1 class="page-title mt-1">Class {selectedClass?.name}</h1><p class="mt-2 text-[15px] text-apple-secondary">{today ? `${today.students_count} students · ${formatServerDate(today.date)}` : 'Loading today’s periods…'}</p></div>
        {#if suggestedPeriod}
          <button class="primary-button" type="button" onclick={() => openPeriod(suggestedPeriod!)}><Sparkles size={17} /> Start period {suggestedPeriod}</button>
        {/if}
      </div>
    </header>

    {#if error}
      <div class="error-banner mb-4"><CircleAlert size={18} /><span>{error}</span><button type="button" onclick={() => selectedClass && openClass(selectedClass)}>Retry</button></div>
    {/if}

    {#if loading}
      <div class="grid min-h-64 place-items-center"><LoaderCircle class="animate-spin text-apple-blue" size={28} /></div>
    {:else if today}
      <div class="surface-card overflow-hidden p-0!">
        {#each today.periods as period}
          {@const isDone = period.status === 'submitted'}
          {@const isNext = suggestedPeriod === period.period_no}
          <button class="group flex w-full items-center gap-4 border-b border-apple-separator p-4 text-left transition last:border-0 hover:bg-apple-bg/70 sm:p-5" type="button" onclick={() => openPeriod(period.period_no)}>
            <span class="grid size-11 shrink-0 place-items-center rounded-[14px] {isDone ? 'bg-apple-green/10 text-apple-green' : isNext ? 'bg-apple-blue text-black' : 'bg-apple-bg text-apple-secondary'}">
              {#if isDone}<Check size={21} strokeWidth={2.5} />{:else}<span class="font-bold">{period.period_no}</span>{/if}
            </span>
            <span class="min-w-0 flex-1">
              <span class="flex items-center gap-2"><strong class="text-[15px]">Period {period.period_no}</strong>{#if isNext}<span class="badge-blue">Suggested</span>{/if}</span>
              <span class="mt-0.5 block text-xs text-apple-secondary">{isDone ? `Submitted${period.submitted_at ? ` · ${new Date(period.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}` : 'Not submitted'}</span>
            </span>
            <span class="text-xs font-semibold {isDone ? 'text-apple-blue' : 'text-apple-secondary'}">{isDone ? 'Review' : 'Start'}</span>
            <ChevronRight class="text-apple-tertiary transition group-hover:translate-x-0.5" size={18} />
          </button>
        {/each}
      </div>
      <p class="mt-4 flex items-center gap-1.5 text-xs text-apple-tertiary"><Clock3 size={14} /> Dates follow the server’s UTC day.</p>
    {/if}
  {:else if step === 'register' && draft}
    <header class="mb-5">
      <button class="back-button mb-5" type="button" onclick={back}><ArrowLeft size={17} /> Class {selectedClass?.name}</button>
      <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div class="flex items-center gap-2"><p class="eyebrow">Class {selectedClass?.name}</p><span class="text-apple-tertiary">·</span><p class="eyebrow">{formatServerDate(draft.session_date)}</p></div>
          <h1 class="page-title mt-1">Period {draft.period_no}</h1>
          <p class="mt-2 flex items-center gap-1.5 text-sm text-apple-secondary">
            {#if draft.summary.copied_from_period !== null}<RotateCcw size={14} /><span>Copied from period {draft.summary.copied_from_period}; mark only changes.</span>{:else}<Sparkles size={14} /><span>Fresh register; everyone starts present.</span>{/if}
          </p>
        </div>
        <div class="flex gap-2">
          <button class="secondary-button flex-1 whitespace-nowrap lg:flex-none" type="button" onclick={resetMarks}><RotateCcw size={16} /> Reset</button>
          <button class="secondary-button flex-1 whitespace-nowrap text-apple-blue lg:flex-none" type="button" onclick={markAllPresent}><UserCheck size={16} /> All present</button>
        </div>
      </div>
    </header>

    <section class="sticky top-16 z-20 -mx-4 mb-4 border-y border-apple-separator bg-apple-surface/96 px-4 py-3 backdrop-blur-xl sm:mx-0 sm:rounded-2xl sm:border lg:top-3">
      <div class="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div class="flex flex-1 items-center gap-4 sm:flex-none">
          <div><p class="text-xl font-bold tabular-nums text-apple-green">{presentCount}</p><p class="text-[10px] font-bold tracking-wide text-apple-tertiary uppercase">Present</p></div>
          <div class="h-8 w-px bg-apple-separator"></div>
          <div><p class="text-xl font-bold tabular-nums text-apple-red">{absentCount}</p><p class="text-[10px] font-bold tracking-wide text-apple-tertiary uppercase">Absent</p></div>
          <div class="h-8 w-px bg-apple-separator"></div>
          <div><p class="text-xl font-bold tabular-nums text-apple-orange">{lateCount}</p><p class="text-[10px] font-bold tracking-wide text-apple-tertiary uppercase">Late</p></div>
        </div>
        {#if subjects.length > 0}
          <label class="relative ml-auto min-w-[150px]">
            <span class="sr-only">Subject</span>
            <select class="field-input h-10 appearance-none py-0 pr-9 text-sm" bind:value={selectedSubjectId}>
              <option value="">No subject</option>
              {#each subjects as subject}<option value={subject.id}>{subject.name}</option>{/each}
            </select>
            <ChevronDown class="pointer-events-none absolute top-3 right-3 text-apple-tertiary" size={15} />
          </label>
        {/if}
      </div>
    </section>

    {#if error}<div class="error-banner mb-4"><CircleAlert size={18} /><span>{error}</span></div>{/if}

    {#if earlierAbsent.length > 0}
      <div class="mb-4 overflow-hidden rounded-2xl border border-apple-red/15 bg-apple-red/[0.045]">
        <button class="flex w-full items-center gap-3 p-4 text-left" type="button" onclick={() => showEarlier = !showEarlier}>
          <span class="grid size-9 place-items-center rounded-xl bg-apple-red/10 text-apple-red"><Users size={18} /></span>
          <span class="flex-1"><strong class="block text-sm">Absent earlier</strong><small class="text-apple-secondary">{earlierAbsent.length} {earlierAbsent.length === 1 ? 'student' : 'students'} carried from period {draft.summary.copied_from_period}</small></span>
          <ChevronDown class={`text-apple-secondary transition ${showEarlier ? 'rotate-180' : ''}`} size={18} />
        </button>
        {#if showEarlier}
          <div class="border-t border-apple-red/10 bg-apple-surface/85 px-3">
            {#each earlierAbsent as mark}
              <div class="flex items-center gap-3 border-b border-apple-separator/70 py-3 last:border-0">
                <span class="student-avatar bg-apple-red/10 text-apple-red">{mark.name.slice(0, 1)}</span>
                <span class="min-w-0 flex-1"><strong class="block truncate text-sm">{mark.name}</strong><small class="text-apple-secondary">{mark.roll_no ? `Roll ${mark.roll_no} · ` : ''}{mark.admission_no}</small></span>
                <button class="rounded-full bg-apple-green/10 px-3 py-1.5 text-xs font-semibold text-apple-green" type="button" onclick={() => setStatus(mark.student_id, 'present')}>Arrived now</button>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <div class="surface-card overflow-hidden p-0!">
      {#each visibleMarks as mark, index}
        <div class="border-b border-apple-separator p-3 last:border-0 sm:flex sm:items-center sm:gap-4 sm:p-4">
          <div class="flex min-w-0 items-center gap-3 sm:flex-1">
            <span class="student-avatar {mark.status === 'absent' ? 'bg-apple-red/10 text-apple-red' : mark.status === 'late' ? 'bg-apple-orange/10 text-apple-orange' : 'bg-apple-blue/[0.09] text-apple-blue'}">{mark.name.slice(0, 1)}</span>
            <span class="min-w-0 flex-1"><strong class="block truncate text-sm sm:text-[15px]">{mark.name}</strong><small class="text-apple-secondary">{mark.roll_no ? `Roll ${mark.roll_no} · ` : ''}{mark.admission_no}</small></span>
          </div>
          <div class="mt-3 grid grid-cols-3 rounded-xl bg-apple-bg p-1 sm:mt-0 sm:w-[282px]">
            <button class:status-present={mark.status === 'present'} class="status-button" type="button" onclick={() => setStatus(mark.student_id, 'present')}><span class="sm:hidden">P</span><span class="hidden sm:inline">Present</span></button>
            <button class:status-absent={mark.status === 'absent'} class="status-button" type="button" onclick={() => setStatus(mark.student_id, 'absent')}><span class="sm:hidden">A</span><span class="hidden sm:inline">Absent</span></button>
            <button class:status-late={mark.status === 'late'} class="status-button" type="button" onclick={() => setStatus(mark.student_id, 'late')}><span class="sm:hidden">L</span><span class="hidden sm:inline">Late</span></button>
          </div>
          {#if mark.status === 'late'}
            <label class="mt-2 flex items-center justify-end gap-2 text-xs text-apple-secondary sm:mt-0">
              <input class="h-9 w-16 rounded-lg border border-apple-separator bg-apple-surface px-2 text-center font-semibold outline-none focus:border-apple-blue focus:ring-2 focus:ring-apple-blue/15" type="number" min="0" max="300" step="1" value={mark.late_minutes ?? 0} oninput={(event) => setLateMinutes(mark.student_id, event)} aria-label={`Late minutes for ${mark.name}`} /> min
            </label>
          {/if}
        </div>
      {/each}
    </div>

    <div class="sticky bottom-[72px] z-20 -mx-4 mt-5 border-t border-apple-separator bg-apple-surface/96 px-4 py-3 backdrop-blur-xl sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 lg:bottom-0">
      <button class="primary-button h-12 w-full sm:ml-auto sm:flex sm:w-auto sm:min-w-48" type="button" onclick={submit} disabled={submitting || markList.length === 0}>
        {#if submitting}<LoaderCircle class="animate-spin" size={18} />{:else}<Save size={18} />{/if}
        {submitting ? 'Submitting…' : `Submit period ${draft.period_no}`}
      </button>
    </div>
  {:else if step === 'success' && result}
    <div class="mx-auto grid min-h-[70dvh] max-w-xl place-items-center">
      <div class="w-full text-center">
        <div class="mx-auto grid size-20 place-items-center rounded-full bg-apple-green/10 text-apple-green"><CircleCheck size={42} strokeWidth={1.8} /></div>
        <p class="mt-6 text-sm font-semibold text-apple-green">Attendance saved</p>
        <h1 class="mt-1 text-[32px] font-bold tracking-[-0.04em]">Period {result.summary.period_no} is complete</h1>
        <p class="mt-2 text-[15px] text-apple-secondary">Class {selectedClass?.name} · {formatServerDate(result.summary.session_date)}</p>
        <div class="mt-7 grid grid-cols-3 overflow-hidden rounded-2xl border border-apple-separator bg-apple-surface shadow-sm">
          <div class="p-4"><p class="text-2xl font-bold text-apple-green">{result.summary.present_count}</p><p class="mt-1 text-xs text-apple-secondary">Present</p></div>
          <div class="border-x border-apple-separator p-4"><p class="text-2xl font-bold text-apple-red">{result.summary.absent_count}</p><p class="mt-1 text-xs text-apple-secondary">Absent</p></div>
          <div class="p-4"><p class="text-2xl font-bold text-apple-orange">{result.summary.late_count}</p><p class="mt-1 text-xs text-apple-secondary">Late</p></div>
        </div>
        <div class="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button class="primary-button" type="button" onclick={() => { step = 'periods'; result = null; }}>Continue this class <ChevronRight size={17} /></button>
          <button class="secondary-button" type="button" onclick={() => { if (onDone) onDone(); else { step = 'classes'; selectedClass = null; } }}>Back to overview</button>
        </div>
      </div>
    </div>
  {/if}
</div>
