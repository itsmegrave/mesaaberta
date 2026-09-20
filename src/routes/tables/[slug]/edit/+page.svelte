<script lang="ts">
	import TableForm from '$lib/components/TableForm.svelte';
	import { localizedHref } from '$lib/i18n/locales';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	let { data, form } = $props();
</script>

<svelte:head>
	<title>{m.form_edit_title()}</title>
</svelte:head>

<section class="py-10 md:py-16">
	<a href={localizedHref(`/tables/${data.slug}`, getLocale())} class="text-link">
		{m.form_view_table()}
	</a>

	<h1 class="mt-6 text-4xl font-semibold tracking-tight md:text-6xl">{m.form_edit_title()}</h1>

	{#if data.status === 'disabled'}
		<p role="status" class="mt-4 max-w-[44ch] font-semibold">{m.form_edit_disabled()}</p>
	{/if}

	{#if form?.error}
		<p role="alert" class="mt-6 font-semibold text-danger">
			{form.error === 'forbidden' ? m.form_error_forbidden() : m.form_error_unavailable()}
		</p>
	{/if}

	<TableForm
		values={form?.values ?? data.values}
		errors={form?.errors}
		systems={data.systems}
		imageUrl={data.imageUrl}
		action="?/save"
		submitLabel={m.form_submit_edit()}
	/>

	{#if data.status === 'active'}
		<form method="POST" action="?/disable" class="mt-12 max-w-2xl border-t border-petrol/15 pt-6">
			<p class="mb-3">{m.form_disable_hint()}</p>
			<button
				type="submit"
				class="rounded border border-danger px-5 py-3 font-semibold text-danger"
			>
				{m.form_disable()}
			</button>
		</form>
	{/if}
</section>
