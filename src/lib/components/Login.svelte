<script lang="ts">
  import { onMount } from 'svelte';
  import {
    ArrowLeft,
    ChevronRight,
    CircleAlert,
    Delete,
    GraduationCap,
    LoaderCircle,
    LockKeyhole,
    RefreshCw,
    ShieldCheck,
  } from '@lucide/svelte';
  import { api, API_BASE, errorMessage } from '$lib/api';
  import type { Me, PublicUser } from '$lib/types';

  let { onAuthenticated }: { onAuthenticated: (user: Me) => void } = $props();

  let users = $state<PublicUser[]>([]);
  let selected = $state<PublicUser | null>(null);
  let pin = $state('');
  let loading = $state(true);
  let submitting = $state(false);
  let error = $state('');

  onMount(loadUsers);

  async function loadUsers() {
    loading = true;
    error = '';
    try {
      users = await api.publicUsers();
    } catch (e) {
      error = errorMessage(e);
    } finally {
      loading = false;
    }
  }

  function chooseUser(user: PublicUser) {
    selected = user;
    pin = '';
    error = '';
    setTimeout(() => document.querySelector<HTMLInputElement>('#pin-input')?.focus(), 50);
  }

  function addDigit(digit: string) {
    if (pin.length >= 6 || submitting) return;
    pin += digit;
    if (pin.length === 6) void submit();
  }

  function removeDigit() {
    pin = pin.slice(0, -1);
  }

  function handleInput(event: Event) {
    pin = (event.currentTarget as HTMLInputElement).value.replace(/\D/g, '').slice(0, 6);
  }

  async function submit() {
    if (!selected || pin.length !== 6 || submitting) return;
    submitting = true;
    error = '';
    try {
      const result = await api.login(selected.id, pin);
      onAuthenticated(result.user);
    } catch (e) {
      error = errorMessage(e);
      pin = '';
      setTimeout(() => document.querySelector<HTMLInputElement>('#pin-input')?.focus(), 50);
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>Sign in · VART</title>
  <meta name="description" content="Secure school attendance for teachers." />
</svelte:head>

<div class="relative flex min-h-dvh overflow-hidden bg-white">
  <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
    <div class="absolute -top-24 -left-32 size-[28rem] rounded-full bg-apple-blue/[0.07] blur-3xl"></div>
    <div class="absolute -right-48 bottom-[-10rem] size-[34rem] rounded-full bg-apple-indigo/[0.08] blur-3xl"></div>
  </div>

  <section class="relative flex min-h-dvh w-full flex-col px-5 py-6 sm:px-8 lg:w-[52%] lg:px-16 lg:py-10 xl:px-24">
    <header class="flex items-center gap-3">
      <span class="grid size-10 place-items-center rounded-[13px] bg-apple-blue text-white shadow-lg shadow-apple-blue/20">
        <GraduationCap size={23} />
      </span>
      <div>
        <div class="font-bold tracking-tight">VART</div>
        <div class="text-[10px] font-bold tracking-[0.15em] text-apple-secondary uppercase">School attendance</div>
      </div>
    </header>

    <div class="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center py-12">
      {#if selected}
        <button class="mb-7 flex w-fit items-center gap-1.5 text-sm font-semibold text-apple-blue" type="button" onclick={() => { selected = null; pin = ''; error = ''; }}>
          <ArrowLeft size={17} /> Choose another account
        </button>

        <div class="mb-8 text-center sm:text-left">
          <div class="mx-auto mb-5 grid size-16 place-items-center rounded-full bg-apple-indigo/10 text-2xl font-bold text-apple-indigo sm:mx-0">
            {selected.display_name.slice(0, 1).toUpperCase()}
          </div>
          <p class="text-sm font-semibold text-apple-secondary">Welcome back</p>
          <h1 class="mt-1 text-[30px] font-bold tracking-[-0.035em] text-apple-label">{selected.display_name}</h1>
          <p class="mt-2 text-[15px] text-apple-secondary">Enter your 6-digit PIN to continue.</p>
        </div>

        <form onsubmit={(event) => { event.preventDefault(); void submit(); }}>
          <label class="sr-only" for="pin-input">6-digit PIN</label>
          <input
            id="pin-input"
            class="absolute h-px w-px overflow-hidden opacity-0"
            type="password"
            inputmode="numeric"
            autocomplete="current-password"
            maxlength="6"
            value={pin}
            oninput={handleInput}
          />
          <button class="mb-5 flex w-full justify-center gap-3" type="button" onclick={() => document.querySelector<HTMLInputElement>('#pin-input')?.focus()} aria-label={`${pin.length} of 6 PIN digits entered`}>
            {#each Array(6) as _, index}
              <span class:pin-filled={index < pin.length} class:pin-error={!!error} class="pin-dot"></span>
            {/each}
          </button>

          {#if error}
            <div class="mb-4 flex items-start gap-2 rounded-xl bg-apple-red/[0.08] p-3 text-sm font-medium text-apple-red" role="alert">
              <CircleAlert class="mt-0.5 shrink-0" size={17} />
              <span>{error}</span>
            </div>
          {/if}

          <div class="mx-auto grid max-w-[310px] grid-cols-3 gap-x-5 gap-y-3" aria-label="PIN keypad">
            {#each ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as digit}
              <button class="keypad-button" type="button" onclick={() => addDigit(digit)}>{digit}</button>
            {/each}
            <span></span>
            <button class="keypad-button" type="button" onclick={() => addDigit('0')}>0</button>
            <button class="keypad-button text-apple-secondary" type="button" onclick={removeDigit} aria-label="Delete digit">
              <Delete size={23} />
            </button>
          </div>

          <button class="primary-button mt-7 w-full" type="submit" disabled={pin.length !== 6 || submitting}>
            {#if submitting}<LoaderCircle class="animate-spin" size={18} />{/if}
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p class="mt-5 flex items-center justify-center gap-1.5 text-xs text-apple-tertiary">
          <LockKeyhole size={13} /> Secure 90-day session
        </p>
      {:else}
        <div class="mb-8">
          <p class="text-sm font-semibold text-apple-blue">Good day</p>
          <h1 class="mt-1 text-[34px] leading-tight font-bold tracking-[-0.04em] text-apple-label">Who’s taking attendance?</h1>
          <p class="mt-3 max-w-sm text-[15px] leading-6 text-apple-secondary">Choose your account, then enter your private PIN.</p>
        </div>

        {#if loading}
          <div class="space-y-3" aria-label="Loading accounts">
            {#each Array(3) as _}
              <div class="h-[72px] animate-pulse rounded-2xl bg-apple-bg"></div>
            {/each}
          </div>
        {:else if error}
          <div class="rounded-2xl border border-apple-red/15 bg-apple-red/[0.05] p-5 text-center">
            <CircleAlert class="mx-auto text-apple-red" size={28} />
            <p class="mt-3 text-sm font-semibold">Attendance server unavailable</p>
            <p class="mt-1 text-sm leading-5 text-apple-secondary">{error}</p>
            <button class="secondary-button mt-4" type="button" onclick={loadUsers}>
              <RefreshCw size={16} /> Try again
            </button>
          </div>
        {:else if users.length === 0}
          <div class="rounded-2xl bg-apple-bg p-6 text-center">
            <p class="font-semibold">No active staff accounts</p>
            <p class="mt-1 text-sm text-apple-secondary">Ask a school administrator to add or enable your account.</p>
          </div>
        {:else}
          <div class="space-y-2.5">
            {#each users as user}
              <button class="group flex w-full items-center gap-3.5 rounded-2xl border border-apple-separator bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-apple-blue/25 hover:shadow-md focus-visible:ring-2 focus-visible:ring-apple-blue" type="button" onclick={() => chooseUser(user)}>
                <span class="grid size-11 shrink-0 place-items-center rounded-full bg-apple-blue/[0.09] font-bold text-apple-blue">
                  {user.display_name.slice(0, 1).toUpperCase()}
                </span>
                <span class="min-w-0 flex-1 truncate text-[15px] font-semibold">{user.display_name}</span>
                <ChevronRight class="text-apple-tertiary transition group-hover:translate-x-0.5 group-hover:text-apple-blue" size={19} />
              </button>
            {/each}
          </div>
        {/if}
      {/if}
    </div>

    <footer class="text-center text-xs text-apple-tertiary lg:text-left">
      {#if API_BASE}<span title={API_BASE}>Connected to the VART secure server</span>{:else}<span>Secure local connection</span>{/if}
    </footer>
  </section>

  <aside class="relative hidden w-[48%] items-center justify-center overflow-hidden bg-[#071B33] p-12 text-white lg:flex">
    <div class="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(0,122,255,0.35),transparent_38%),radial-gradient(circle_at_25%_85%,rgba(88,86,214,0.3),transparent_34%)]"></div>
    <div class="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.7)_1px,transparent_1px)] [background-size:44px_44px]"></div>
    <div class="relative max-w-md">
      <span class="mb-8 grid size-14 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur">
        <ShieldCheck size={29} />
      </span>
      <blockquote class="text-[30px] leading-[1.2] font-semibold tracking-[-0.035em]">“Less time on registers. More time for teaching.”</blockquote>
      <p class="mt-6 max-w-sm text-[15px] leading-6 text-white/60">A focused attendance workspace designed for the pace of a real classroom.</p>
      <div class="mt-10 flex gap-7 border-t border-white/10 pt-6">
        <div><div class="text-xl font-bold">7</div><div class="mt-1 text-xs text-white/50">period view</div></div>
        <div><div class="text-xl font-bold">1 tap</div><div class="mt-1 text-xs text-white/50">to mark status</div></div>
        <div><div class="text-xl font-bold">Live</div><div class="mt-1 text-xs text-white/50">school reports</div></div>
      </div>
    </div>
  </aside>
</div>
