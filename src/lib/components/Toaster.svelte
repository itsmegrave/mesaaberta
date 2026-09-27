<script lang="ts">
	import { Toast } from '@skeletonlabs/skeleton-svelte';
	import { m } from '$lib/paraglide/messages';
	import { toaster } from '$lib/toaster';
</script>

<Toast.Group {toaster}>
	{#snippet children(toast)}
		<Toast {toast}>
			<Toast.Message>
				<Toast.Title>{toast.title}</Toast.Title>
			</Toast.Message>
			<Toast.CloseTrigger aria-label={m.toast_close()} />
		</Toast>
	{/snippet}
</Toast.Group>
