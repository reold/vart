<script lang="ts">
  import { onMount } from 'svelte';
  import { CircleAlert, GraduationCap, LoaderCircle, LogOut, RefreshCw } from '@lucide/svelte';
  import { api, ApiError, API_BASE, errorMessage } from '$lib/api';
  import type { Bootstrap, Me } from '$lib/types';
  import Admin from '$lib/components/Admin.svelte';
  import AppShell from '$lib/components/AppShell.svelte';
  import Attendance from '$lib/components/Attendance.svelte';
  import Dashboard from '$lib/components/Dashboard.svelte';
  import Login from '$lib/components/Login.svelte';
  import Reports from '$lib/components/Reports.svelte';
  import Setup from '$lib/components/Setup.svelte';

  type Mode = 'loading' | 'login' | 'setup' | 'app' | 'error';
  type View = 'home' | 'attendance' | 'reports' | 'admin';

  let mode = $state<Mode>('loading');
  let view = $state<View>('home');
  let user = $state<Me | null>(null);
  let bootstrap = $state<Bootstrap | null>(null);
  let appError = $state('');
  let initialClassId = $state<string | undefined>(undefined);

  onMount(boot);

  async function boot() {
    mode = 'loading';
    appError = '';
    const hash = window.location.hash.replace('#', '');
    if (['home', 'attendance', 'reports', 'admin'].includes(hash)) view = hash as View;

    try {
      const current = await api.me();
      await startApp(current);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await determineLoggedOutScreen();
      } else {
        // The setup check gives a more useful logged-out experience when /me is unavailable.
        await determineLoggedOutScreen();
      }
    }
  }

  async function determineLoggedOutScreen() {
    try {
      const setup = await api.setupStatus();
      mode = setup.setup_complete || setup.has_users ? 'login' : 'setup';
    } catch {
      // Public user loading on the login screen supplies retry UI and the specific error.
      mode = 'login';
    }
  }

  async function startApp(current: Me) {
    user = current;
    mode = 'loading';
    appError = '';
    try {
      bootstrap = await api.bootstrap();
      // /me is authoritative, while bootstrap has the compact role identity.
      mode = 'app';
      if (view === 'admin' && current.role === 'teacher') view = 'home';
    } catch (e) {
      appError = errorMessage(e);
      if (e instanceof ApiError && e.status === 401 && API_BASE) {
        appError = 'Your sign-in succeeded, but the browser could not reuse the session. This static site needs the API cookie set to SameSite=None, or the app and API must share one origin.';
      }
      mode = 'error';
    }
  }

  function navigate(next: string) {
    if (!['home', 'attendance', 'reports', 'admin'].includes(next)) return;
    if (next === 'admin' && user?.role === 'teacher') return;
    view = next as View;
    initialClassId = undefined;
    window.location.hash = next;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function takeAttendance(classId?: string) {
    initialClassId = classId;
    view = 'attendance';
    window.location.hash = 'attendance';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function logout() {
    try { await api.logout(); } catch { /* The local UI still signs out if the session already expired. */ }
    user = null;
    bootstrap = null;
    view = 'home';
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    mode = 'login';
  }
</script>

{#if mode === 'loading'}
  <div class="grid min-h-dvh place-items-center bg-apple-bg">
    <div class="text-center">
      <span class="mx-auto grid size-14 place-items-center rounded-[18px] bg-apple-blue text-white shadow-lg shadow-apple-blue/20"><GraduationCap size={29} /></span>
      <LoaderCircle class="mx-auto mt-6 animate-spin text-apple-blue" size={24} />
      <p class="mt-3 text-sm font-medium text-apple-secondary">Opening VART…</p>
    </div>
  </div>
{:else if mode === 'login'}
  <Login onAuthenticated={startApp} />
{:else if mode === 'setup'}
  <Setup onAuthenticated={startApp} />
{:else if mode === 'error'}
  <div class="grid min-h-dvh place-items-center bg-apple-bg px-4">
    <div class="w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-xl shadow-black/[0.05] ring-1 ring-black/[0.04]">
      <span class="mx-auto grid size-14 place-items-center rounded-2xl bg-apple-red/[0.09] text-apple-red"><CircleAlert size={28} /></span>
      <h1 class="mt-5 text-xl font-bold tracking-tight">Couldn’t open your workspace</h1>
      <p class="mt-2 text-sm leading-6 text-apple-secondary">{appError}</p>
      <div class="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <button class="primary-button" type="button" onclick={() => user ? startApp(user) : boot()}><RefreshCw size={17} /> Try again</button>
        <button class="secondary-button" type="button" onclick={logout}><LogOut size={17} /> Sign out</button>
      </div>
    </div>
  </div>
{:else if mode === 'app' && user && bootstrap}
  <AppShell {user} active={view} onNavigate={navigate} onLogout={logout}>
    {#if view === 'home'}
      <Dashboard {bootstrap} onTakeAttendance={takeAttendance} onOpenReports={() => navigate('reports')} />
    {:else if view === 'attendance'}
      <Attendance {bootstrap} {initialClassId} onDone={() => navigate('home')} />
    {:else if view === 'reports'}
      <Reports {bootstrap} />
    {:else if view === 'admin' && user.role !== 'teacher'}
      <Admin {bootstrap} />
    {/if}
  </AppShell>
{/if}
