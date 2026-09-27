<script lang="ts">
	import type { Snippet } from 'svelte';
	import { defaults, superForm } from 'sveltekit-superforms';
	import { zod4 } from 'sveltekit-superforms/adapters';
	import type { FormMessage } from '$lib/forms/message';
	import { actionSchema } from '$lib/tables/registration';
	import { registrationError } from '$lib/tables/registration-errors';
	import { toast } from '$lib/toaster';

	type Props = {
		/** Where to post: `?/leave` on the table's own page, or the table's address plus `?/leave` from elsewhere. */
		action: string;
		playerId?: string;
		next?: string;
		class?: string;
		/** Runs when the action went through (the server answered with a redirect back to the page). */
		onsuccess?: () => void;
		/** Runs when the server refused, after the error is shown as a toast. */
		onfail?: (message: FormMessage) => void;
		children: Snippet;
	};

	let {
		action,
		playerId,
		next = '',
		class: className = '',
		onsuccess,
		onfail,
		children
	}: Props = $props();

	// A button-only form: the server validates, so the browser has nothing to check. Each form on a
	// page needs its own id.
	const { enhance } = superForm<{ playerId?: string; next: string }, FormMessage>(
		defaults({ playerId, next }, zod4(actionSchema)),
		{
			id: `${action}:${playerId ?? ''}`,
			resetForm: false,
			onResult({ result }) {
				if (result.type === 'redirect') onsuccess?.();
			},
			onUpdated({ form }) {
				if (form.valid || !form.message) return;
				toast.error(registrationError(form.message.code, form.message.retryAfter));
				onfail?.(form.message);
			}
		}
	);
</script>

<form method="POST" {action} use:enhance class={className}>
	{#if playerId}<input type="hidden" name="playerId" value={playerId} />{/if}
	{#if next}<input type="hidden" name="next" value={next} />{/if}
	{@render children()}
</form>
