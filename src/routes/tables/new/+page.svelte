<script lang="ts">
	import TableForm from '$lib/components/TableForm.svelte';
	import { m } from '$lib/paraglide/messages';
	import { formatWait } from '$lib/tables/format';

	let { data, form } = $props();
</script>

<svelte:head>
	<title>{m.form_new_title()}</title>
</svelte:head>

<section class="py-10 md:py-16">
	<h1 class="text-4xl font-semibold tracking-tight md:text-6xl">{m.form_new_title()}</h1>
	<p class="mt-4 max-w-[44ch] text-lg">{m.form_new_lede()}</p>

	{#if form?.error}
		<p role="alert" class="mt-6 font-semibold text-danger">
			{form.error === 'forbidden'
				? m.form_error_forbidden()
				: form.error === 'rate_limited'
					? m.error_rate_limited({ wait: formatWait(form.retryAfter ?? 60) })
					: m.form_error_unavailable()}
		</p>
	{/if}

	<TableForm
		values={form?.values ?? data.values}
		errors={form?.errors}
		systems={data.systems}
		submitLabel={m.form_submit_new()}
	/>
</section>
