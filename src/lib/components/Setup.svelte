<script lang="ts">
  import { CircleAlert, GraduationCap, LoaderCircle, ShieldCheck, Sparkles } from '@lucide/svelte';
  import { api, errorMessage } from '$lib/api';
  import type { Me } from '$lib/types';

  let { onAuthenticated }: { onAuthenticated: (user: Me) => void } = $props();

  let displayName = $state('');
  let loginName = $state('');
  let pin = $state('');
  let confirmPin = $state('');
  let error = $state('');
  let submitting = $state(false);

  async function submit() {
    error = '';
    if (!displayName.trim()) {
      error = 'Enter the administrator’s name.';
      return;
    }
    if (!/^\d{6}$/.test(pin)) {
      error = 'PIN must be exactly 6 digits.';
      return;
    }
    if (pin !== confirmPin) {
      error = 'The PINs do not match.';
      return;
    }

    submitting = true;
    try {
      const result = await api.createFirstAdmin({
        display_name: displayName.trim(),
        login_name: loginName.trim() || undefined,
        pin,
      });
      if (!result.user_id) throw new Error('The administrator was created, but no account ID was returned.');
      const login = await api.login(result.user_id, pin);
      onAuthenticated(login.user);
    } catch (e) {
      error = errorMessage(e);
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head><title>Set up VART</title></svelte:head>

<div class="min-h-dvh bg-apple-bg px-4 py-8 sm:grid sm:place-items-center sm:py-12">
  <main class="mx-auto w-full max-w-[560px] overflow-hidden rounded-[28px] bg-apple-surface shadow-xl shadow-black/[0.06] ring-1 ring-white/10">
    <div class="bg-[#071B33] px-6 py-8 text-white sm:px-10">
      <div class="flex items-center justify-between">
        <span class="grid size-11 place-items-center rounded-[14px] bg-apple-blue text-black"><GraduationCap size={25} /></span>
        <span class="rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold tracking-wider text-white/80 uppercase">First-time setup</span>
      </div>
      <h1 class="mt-8 text-[30px] leading-tight font-bold tracking-[-0.035em]">Welcome to VART</h1>
      <p class="mt-2 max-w-md text-sm leading-6 text-white/80">Create the first administrator. We’ll also create and activate the current June–May academic year.</p>
    </div>

    <form class="space-y-5 px-6 py-8 sm:px-10" onsubmit={(event) => { event.preventDefault(); void submit(); }}>
      <div>
        <label class="field-label" for="display-name">Full name</label>
        <input class="field-input" id="display-name" bind:value={displayName} autocomplete="name" placeholder="e.g. Head Teacher" required />
      </div>
      <div>
        <label class="field-label" for="login-name">Login name <span class="font-normal text-apple-tertiary">(optional)</span></label>
        <input class="field-input" id="login-name" bind:value={loginName} autocomplete="username" placeholder="e.g. headteacher" />
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="field-label" for="setup-pin">6-digit PIN</label>
          <input class="field-input tracking-[0.25em]" id="setup-pin" bind:value={pin} type="password" inputmode="numeric" enterkeyhint="next" pattern="[0-9][0-9][0-9][0-9][0-9][0-9]" maxlength="6" autocomplete="new-password" placeholder="••••••" required />
        </div>
        <div>
          <label class="field-label" for="confirm-pin">Confirm PIN</label>
          <input class="field-input tracking-[0.25em]" id="confirm-pin" bind:value={confirmPin} type="password" inputmode="numeric" enterkeyhint="done" pattern="[0-9][0-9][0-9][0-9][0-9][0-9]" maxlength="6" autocomplete="new-password" placeholder="••••••" required />
        </div>
      </div>

      {#if error}
        <div class="flex items-start gap-2 rounded-xl bg-apple-red/[0.16] p-3 text-sm font-medium text-apple-red" role="alert">
          <CircleAlert class="mt-0.5 shrink-0" size={17} /> {error}
        </div>
      {/if}

      <div class="flex items-start gap-3 rounded-2xl bg-apple-green/[0.14] p-4">
        <ShieldCheck class="mt-0.5 shrink-0 text-apple-green" size={19} />
        <p class="text-xs leading-5 text-apple-secondary">This account has full access to staff, students, classes, academic years and reports. Keep its PIN private.</p>
      </div>

      <button class="primary-button w-full" type="submit" disabled={submitting}>
        {#if submitting}<LoaderCircle class="animate-spin" size={18} />{:else}<Sparkles size={18} />{/if}
        {submitting ? 'Setting up your school…' : 'Create school workspace'}
      </button>
    </form>
  </main>
</div>
