<script lang="ts">
	import { toast } from '$lib/stores/toast.svelte';
	import * as m from '$lib/paraglide/messages';
	import autoAnimate from '@formkit/auto-animate';
</script>

<div
	use:autoAnimate
	class="pointer-events-none fixed top-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2 p-4 sm:p-0"
	aria-live="polite"
	aria-atomic="false"
>
	{#each toast.toasts as t (t.id)}
		<div
			role="status"
			class="pointer-events-auto flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-3 font-body text-[15px] text-ink shadow-lg transition-all"
		>
			<span class="inline-flex items-center gap-2.5">
				{#if t.variant === 'success'}
					<span aria-hidden="true" class="size-2 shrink-0 rounded-full bg-sage"></span>
				{:else if t.variant === 'pending' || t.variant === 'warning'}
					<span aria-hidden="true" class="size-2 shrink-0 rounded-full bg-lamp"></span>
				{:else if t.variant === 'error'}
					<span aria-hidden="true" class="size-2 shrink-0 rounded-full bg-danger"></span>
				{:else}
					<span aria-hidden="true" class="size-2 shrink-0 rounded-full bg-periwinkle"></span>
				{/if}
				<span>{t.message}</span>
			</span>
			<button
				type="button"
				aria-label={m.toast_close()}
				onclick={() => toast.dismiss(t.id)}
				class="flex shrink-0 cursor-pointer border-0 bg-transparent p-1 text-ink2 transition-colors hover:text-ink focus-visible:outline-focus"
			>
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
					class="shrink-0"
				>
					<path d="M6 6l12 12M18 6L6 18"></path>
				</svg>
			</button>
		</div>
	{/each}
</div>
