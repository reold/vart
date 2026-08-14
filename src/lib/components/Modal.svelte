<script lang="ts">
  import type { Snippet } from 'svelte';
  import { X } from '@lucide/svelte';

  let {
    title,
    description,
    onClose,
    children,
  }: {
    title: string;
    description?: string;
    onClose: () => void;
    children: Snippet;
  } = $props();

  function handleKey(event: KeyboardEvent) {
    if (event.key === 'Escape') onClose();
  }
</script>

<svelte:window onkeydown={handleKey} />

<div class="fixed inset-0 z-50 grid items-end bg-black/30 p-0 backdrop-blur-[2px] sm:place-items-center sm:p-4" role="presentation" onclick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
  <div class="max-h-[92dvh] w-full overflow-y-auto rounded-t-[24px] bg-white shadow-2xl sm:max-w-[520px] sm:rounded-[24px]" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1">
    <header class="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-apple-separator bg-white/94 px-5 py-4 backdrop-blur-xl sm:px-6">
      <div><h2 id="modal-title" class="text-lg font-bold tracking-tight">{title}</h2>{#if description}<p class="mt-1 text-xs leading-5 text-apple-secondary">{description}</p>{/if}</div>
      <button class="icon-button shrink-0" type="button" aria-label="Close" onclick={onClose}><X size={18} /></button>
    </header>
    <div class="px-5 py-5 sm:px-6 sm:py-6">{@render children()}</div>
  </div>
</div>
