<script lang="ts">
  import { onMount } from 'svelte';
  import {
    ArrowRight,
    CalendarDays,
    Check,
    ChevronRight,
    CircleAlert,
    Clock3,
    ClipboardCheck,
    GraduationCap,
    LoaderCircle,
    RefreshCw,
    Users,
  } from '@lucide/svelte';
  import { api } from '$lib/api';
  import type { Bootstrap, ClassToday } from '$lib/types';

  let {
    bootstrap,
    onTakeAttendance,
    onOpenReports,
  }: {
    bootstrap: Bootstrap;
    onTakeAttendance: (classId?: string) => void;
    onOpenReports: () => void;
  } = $props();

  let classStatus = $state<Record<string, ClassToday>>({});
  let loadingStatuses = $state(true);

  const activeClasses = $derived(
    [...bootstrap.classes]
      .filter((item) => item.active === 1)
      .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999) || a.name.localeCompare(b.name)),
  );
  const submitted = $derived(
    Object.values(classStatus).reduce(
      (total, value) => total + value.periods.filter((period) => period.status === 'submitted').length,
      0,
    ),
  );
  const totalStudents = $derived(
    Object.values(classStatus).reduce((total, value) => total + value.students_count, 0),
  );

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const dateLabel = new Intl.DateTimeFormat('en', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(now);

  onMount(loadStatuses);

  async function loadStatuses() {
    loadingStatuses = true;
    const results = await Promise.allSettled(activeClasses.map((item) => api.classToday(item.id)));
    const next: Record<string, ClassToday> = {};
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') next[activeClasses[index].id] = result.value;
    });
    classStatus = next;
    loadingStatuses = false;
  }
</script>

<svelte:head><title>Overview · VART</title></svelte:head>

<div class="page-enter">
  <header class="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <p class="text-sm font-semibold text-apple-blue">{dateLabel}</p>
      <h1 class="page-title mt-1">{greeting}, {bootstrap.user.display_name.split(' ')[0]}</h1>
      <p class="mt-2 text-[15px] text-apple-secondary">Here’s today’s attendance at a glance.</p>
    </div>
    <button class="primary-button w-full sm:w-auto" type="button" onclick={() => onTakeAttendance()}>
      <ClipboardCheck size={18} /> Take attendance
    </button>
  </header>

  {#if !bootstrap.academic_year}
    <div class="mb-6 flex items-start gap-3 rounded-2xl border border-apple-orange/60 bg-apple-orange/[0.16] p-4 text-sm">
      <CircleAlert class="mt-0.5 shrink-0 text-apple-orange" size={20} />
      <div><p class="font-semibold">No active academic year</p><p class="mt-0.5 text-apple-secondary">An administrator must create an active academic year before attendance can be submitted.</p></div>
    </div>
  {/if}

  <section class="mb-8 grid gap-3 sm:grid-cols-3">
    <div class="metric-card">
      <span class="metric-icon bg-apple-blue/10 text-apple-blue"><ClipboardCheck size={20} /></span>
      <div><p class="metric-value">{loadingStatuses ? '—' : `${submitted}/${activeClasses.length * 7}`}</p><p class="metric-label">Periods submitted</p></div>
    </div>
    <div class="metric-card">
      <span class="metric-icon bg-apple-green/10 text-apple-green"><Users size={20} /></span>
      <div><p class="metric-value">{loadingStatuses ? '—' : totalStudents}</p><p class="metric-label">Students on rosters</p></div>
    </div>
    <div class="metric-card">
      <span class="metric-icon bg-apple-indigo/10 text-apple-indigo"><CalendarDays size={20} /></span>
      <div><p class="metric-value text-[20px]!">{bootstrap.academic_year?.name ?? 'Not set'}</p><p class="metric-label">Academic year</p></div>
    </div>
  </section>

  <div class="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px]">
    <section>
      <div class="mb-3 flex items-center justify-between">
        <div>
          <h2 class="section-title">Today by class</h2>
          <p class="mt-1 text-sm text-apple-secondary">Tap a class to continue its register.</p>
        </div>
        <button class="icon-button" type="button" onclick={loadStatuses} aria-label="Refresh class status" title="Refresh">
          <RefreshCw class={loadingStatuses ? 'animate-spin' : ''} size={17} />
        </button>
      </div>

      {#if activeClasses.length === 0}
        <div class="empty-card">
          <GraduationCap class="text-apple-tertiary" size={32} />
          <h3>No classes yet</h3>
          <p>Add a class in Manage school to start taking attendance.</p>
        </div>
      {:else}
        <div class="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {#each activeClasses as item}
            {@const today = classStatus[item.id]}
            {@const done = today?.periods.filter((period) => period.status === 'submitted').length ?? 0}
            {@const next = done >= 7 ? null : (today?.periods.find((period) => period.status !== 'submitted')?.period_no ?? 1)}
            <button class="group surface-card p-4 text-left transition hover:-translate-y-0.5 hover:border-apple-blue/25 hover:shadow-md" type="button" onclick={() => onTakeAttendance(item.id)}>
              <div class="flex items-start justify-between">
                <span class="grid size-11 place-items-center rounded-[14px] bg-apple-blue/[0.09] text-base font-bold text-apple-blue">{item.name.slice(0, 3)}</span>
                <ChevronRight class="text-apple-tertiary transition group-hover:translate-x-0.5 group-hover:text-apple-blue" size={19} />
              </div>
              <h3 class="mt-4 text-lg font-bold tracking-tight">Class {item.name}</h3>
              <p class="mt-0.5 text-xs text-apple-secondary">{today ? `${today.students_count} students` : 'Roster unavailable'}</p>
              <div class="mt-4 flex gap-1" aria-label={`${done} of 7 periods submitted`}>
                {#each Array(7) as _, index}
                  <span class:period-done={index < done} class="h-1.5 flex-1 rounded-full bg-apple-fill"></span>
                {/each}
              </div>
              <div class="mt-3 flex items-center justify-between text-xs">
                <span class="font-medium text-apple-secondary">{done} of 7 complete</span>
                {#if loadingStatuses && !today}
                  <LoaderCircle class="animate-spin text-apple-tertiary" size={14} />
                {:else if next}
                  <span class="font-semibold text-apple-blue">Next: period {next}</span>
                {:else}
                  <span class="flex items-center gap-1 font-semibold text-apple-green"><Check size={13} /> All done</span>
                {/if}
              </div>
            </button>
          {/each}
        </div>
      {/if}
    </section>

    <aside class="space-y-4">
      <div class="surface-card overflow-hidden p-0!">
        <div class="border-b border-apple-separator p-4">
          <h2 class="section-title">Quick actions</h2>
        </div>
        <button class="quick-action group" type="button" onclick={() => onTakeAttendance()}>
          <span class="grid size-9 place-items-center rounded-xl bg-apple-blue/10 text-apple-blue"><ClipboardCheck size={18} /></span>
          <span class="flex-1"><span>Take attendance</span><small>Start or continue a period</small></span>
          <ArrowRight size={17} />
        </button>
        <button class="quick-action group border-t border-apple-separator" type="button" onclick={onOpenReports}>
          <span class="grid size-9 place-items-center rounded-xl bg-apple-indigo/10 text-apple-indigo"><CalendarDays size={18} /></span>
          <span class="flex-1"><span>View day report</span><small>Review all seven periods</small></span>
          <ArrowRight size={17} />
        </button>
      </div>

      <div class="rounded-2xl bg-[#071B33] p-5 text-white shadow-sm">
        <Clock3 class="text-apple-blue" size={21} />
        <h3 class="mt-4 font-semibold">Copy-previous is on</h3>
        <p class="mt-1.5 text-xs leading-5 text-white/75">Each new period starts with statuses from the most recently submitted period, so you only mark changes.</p>
      </div>
    </aside>
  </div>
</div>
