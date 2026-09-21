<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import TableForm from '$lib/components/TableForm.svelte';
	import { m } from '$lib/paraglide/messages';
	import { tableFormSchema } from '$lib/tables/schema';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	const superform = superForm(data.form, { validators: zod4Client(tableFormSchema) });
</script>

<svelte:head>
	<title>{m.form_new_title()}</title>
</svelte:head>

<section class="py-10 md:py-16">
	<h1 class="h1">{m.form_new_title()}</h1>
	<p class="mt-4 max-w-[44ch] text-lg">{m.form_new_lede()}</p>

	<TableForm {superform} systems={data.systems} submitLabel={m.form_submit_new()} />
</section>
