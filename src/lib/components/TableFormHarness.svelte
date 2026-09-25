<script lang="ts">
	import { defaults, superForm } from 'sveltekit-superforms';
	import { zod4, zod4Client } from 'sveltekit-superforms/adapters';
	import TableForm from './TableForm.svelte';
	import type { FormMessage } from '$lib/forms/message';
	import { NEW_TABLE_VALUES, type TableFormValues } from '$lib/tables/form-values';
	import { tableFormSchema } from '$lib/tables/schema';

	type Props = {
		systems: { name: string; slug: string }[];
		submitLabel: string;
		values?: Partial<TableFormValues>;
		errors?: Record<string, string[]>;
		message?: FormMessage;
		imageUrl?: string | null;
		action?: string;
	};
	let { systems, submitLabel, values = {}, errors, message, imageUrl, action }: Props = $props();

	// svelte-ignore state_referenced_locally
	const superform = superForm(defaults({ ...NEW_TABLE_VALUES, ...values }, zod4(tableFormSchema)), {
		validators: zod4Client(tableFormSchema)
	});
	// svelte-ignore state_referenced_locally
	if (errors) superform.errors.set(errors);
	// svelte-ignore state_referenced_locally
	if (message) superform.message.set(message);
</script>

<TableForm {superform} {systems} {submitLabel} {imageUrl} {action} />
