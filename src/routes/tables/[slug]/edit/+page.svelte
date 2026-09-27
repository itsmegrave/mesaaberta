<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import ActionForm from '$lib/components/ActionForm.svelte';
	import TableForm from '$lib/components/TableForm.svelte';
	import { localizedHref } from '$lib/i18n/locales';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import { tableFormSchema } from '$lib/tables/schema';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	const superform = superForm(data.form, { validators: zod4Client(tableFormSchema) });
</script>

<svelte:head>
	<title>{m.form_edit_title()}</title>
</svelte:head>

<section class="py-10 md:py-16">
	<a href={localizedHref(`/tables/${data.slug}`, getLocale())} class="anchor">
		{m.form_view_table()}
	</a>

	<h1 class="mt-6 h1">{m.form_edit_title()}</h1>

	{#if data.status === 'disabled'}
		<p role="status" class="mt-4 max-w-[44ch] font-semibold">{m.form_edit_disabled()}</p>
	{/if}

	<TableForm
		{superform}
		systems={data.systems}
		imageUrl={data.imageUrl}
		action="?/save"
		submitLabel={m.form_submit_edit()}
	/>

	{#if data.status === 'active'}
		<div class="mt-12 max-w-2xl border-t border-surface-200-800 pt-6">
			<p class="mb-3">{m.form_disable_hint()}</p>
			<ActionForm action="?/disable">
				<button type="submit" class="btn preset-outlined-error-500">{m.form_disable()}</button>
			</ActionForm>
		</div>
	{/if}
</section>
