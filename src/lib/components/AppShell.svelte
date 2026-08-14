<script lang="ts">
  import type { Component, Snippet } from 'svelte';
  import {
    ChartNoAxesColumn,
    ClipboardCheck,
    GraduationCap,
    House,
    LogOut,
    Settings,
  } from '@lucide/svelte';
  import type { Me } from '$lib/types';

  let {
    user,
    active,
    onNavigate,
    onLogout,
    children,
  }: {
    user: Me;
    active: string;
    onNavigate: (view: string) => void;
    onLogout: () => void;
    children: Snippet;
  } = $props();

  const primaryNav: Array<{ id: string; label: string; icon: Component }> = [
    { id: 'home', label: 'Overview', icon: House },
    { id: 'attendance', label: 'Attendance', icon: ClipboardCheck },
    { id: 'reports', label: 'Reports', icon: ChartNoAxesColumn },
  ];

  function roleLabel(role: Me['role']) {
    return role === 'super_admin'
      ? 'Super admin'
      : role === 'teacher_admin'
        ? 'Teacher admin'
        : 'Teacher';
  }
</script>

<div class="min-h-dvh bg-apple-bg text-apple-label lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
  <aside class="sticky top-0 hidden h-dvh flex-col border-r border-apple-separator bg-apple-surface px-3 py-5 lg:flex">
    <div class="flex items-center gap-3 px-3 pb-7">
      <div class="grid size-10 place-items-center rounded-[13px] bg-apple-blue text-black shadow-sm shadow-apple-blue/20">
        <GraduationCap size={23} strokeWidth={2.2} />
      </div>
      <div>
        <p class="text-[17px] font-bold tracking-[-0.02em]">VART</p>
        <p class="text-[11px] font-semibold tracking-[0.12em] text-apple-secondary uppercase">Attendance</p>
      </div>
    </div>

    <nav class="space-y-1" aria-label="Primary navigation">
      {#each primaryNav as item}
        {@const Icon = item.icon}
        <button
          type="button"
          class:nav-active={active === item.id}
          class="nav-item"
          onclick={() => onNavigate(item.id)}
        >
          <Icon size={20} strokeWidth={active === item.id ? 2.35 : 2} />
          <span>{item.label}</span>
        </button>
      {/each}

      {#if user.role !== 'teacher'}
        <button
          type="button"
          class:nav-active={active === 'admin'}
          class="nav-item"
          onclick={() => onNavigate('admin')}
        >
          <Settings size={20} strokeWidth={active === 'admin' ? 2.35 : 2} />
          <span>Manage school</span>
        </button>
      {/if}
    </nav>

    <div class="mt-auto rounded-2xl bg-apple-bg p-3">
      <div class="flex items-center gap-3">
        <div class="grid size-9 shrink-0 place-items-center rounded-full bg-apple-indigo/10 text-sm font-bold text-apple-indigo">
          {user.display_name.slice(0, 1).toUpperCase()}
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-semibold">{user.display_name}</p>
          <p class="truncate text-xs text-apple-secondary">{roleLabel(user.role)}</p>
        </div>
        <button class="icon-button size-8" type="button" aria-label="Log out" title="Log out" onclick={onLogout}>
          <LogOut size={17} />
        </button>
      </div>
    </div>
  </aside>

  <div class="min-w-0">
    <header class="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-apple-separator/80 bg-apple-surface/96 px-4 backdrop-blur-xl lg:hidden">
      <button class="flex items-center gap-2" type="button" onclick={() => onNavigate('home')} aria-label="Go to overview">
        <span class="grid size-8 place-items-center rounded-[10px] bg-apple-blue text-black">
          <GraduationCap size={19} />
        </span>
        <span class="font-bold tracking-tight">VART</span>
      </button>
      <button class="flex items-center gap-2 rounded-full bg-apple-bg py-1.5 pr-2.5 pl-1.5" type="button" onclick={onLogout} aria-label="Log out">
        <span class="grid size-7 place-items-center rounded-full bg-apple-indigo/10 text-xs font-bold text-apple-indigo">
          {user.display_name.slice(0, 1).toUpperCase()}
        </span>
        <span class="max-w-24 truncate text-xs font-semibold">{user.display_name.split(' ')[0]}</span>
      </button>
    </header>

    <main class="mx-auto w-full max-w-[1440px] px-4 pt-6 pb-28 sm:px-6 lg:px-8 lg:pt-8 lg:pb-12">
      {@render children()}
    </main>
  </div>

  <nav class="fixed inset-x-0 bottom-0 z-40 border-t border-apple-separator bg-apple-surface/96 px-[max(0.75rem,env(safe-area-inset-left))] pt-1.5 pb-[max(0.4rem,env(safe-area-inset-bottom))] backdrop-blur-xl lg:hidden" aria-label="Mobile navigation">
    <div class="mx-auto grid max-w-md grid-cols-4">
      {#each primaryNav as item}
        {@const Icon = item.icon}
        <button
          type="button"
          class:mobile-nav-active={active === item.id}
          class="mobile-nav-item"
          onclick={() => onNavigate(item.id)}
        >
          <Icon size={22} strokeWidth={active === item.id ? 2.4 : 2} />
          <span>{item.label}</span>
        </button>
      {/each}
      {#if user.role !== 'teacher'}
        <button type="button" class:mobile-nav-active={active === 'admin'} class="mobile-nav-item" onclick={() => onNavigate('admin')}>
          <Settings size={22} strokeWidth={active === 'admin' ? 2.4 : 2} />
          <span>Manage</span>
        </button>
      {:else}
        <button type="button" class:mobile-nav-active={active === 'profile'} class="mobile-nav-item" onclick={onLogout}>
          <LogOut size={22} />
          <span>Log out</span>
        </button>
      {/if}
    </div>
  </nav>
</div>
