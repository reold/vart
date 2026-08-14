<script lang="ts">
  import './layout.css';
  import favicon from '$lib/assets/favicon.svg';
  import { base } from '$app/paths';

  let { children } = $props();
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
  <link rel="apple-touch-icon" href={`${base}/icons/apple-touch-icon.png`} />
  <link rel="manifest" href={`${base}/manifest.webmanifest`} />
  <meta name="theme-color" content="#000000" />
  <meta name="color-scheme" content="dark" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="VART" />
</svelte:head>

{@render children()}
