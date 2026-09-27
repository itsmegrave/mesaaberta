<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import TableForm from '$lib/components/TableForm.svelte';
	import { localizedHref } from '$lib/i18n/locales';
	import { getLocale } from '$lib/paraglide/runtime';
	import { m } from '$lib/paraglide/messages';
	import { tableFormSchema } from '$lib/tables/schema';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	const superform = superForm(data.form, { validators: zod4Client(tableFormSchema) });
</script>

<svelte:head>
	<title>{m.form_new_title()}</title>
</svelte:head>

<section class="pt-2 pb-4 md:pt-12">
	<h1
		class="text-[40px] leading-[1.05] font-semibold tracking-[-0.02em] text-balance md:text-[68px]"
	>
		{m.form_new_title()}
	</h1>
	<p class="mt-2.5 max-w-[46ch] text-[17px] text-muted md:mt-3.5 md:text-xl">{m.form_new_lede()}</p>

	<TableForm
		{superform}
		systems={data.systems}
		submitLabel={m.form_submit_new()}
		cancelHref={localizedHref('/tables', getLocale())}
		gmName={data.account?.username ?? undefined}
	/>
</section>
