<script lang="ts">
	import { page } from '$app/state';
	import { localizedHref } from '$lib/i18n/locales';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	const notFound = $derived(page.status === 404);
	const title = $derived(notFound ? m.error_not_found_title() : m.error_generic_title());
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>

<section class="py-16 md:py-24">
	<h1 class="text-4xl font-semibold tracking-tight md:text-6xl">{title}</h1>
	<p class="mt-4 max-w-[44ch] text-lg">
		{notFound ? m.error_not_found_text() : m.error_generic_text()}
	</p>
	<a href={localizedHref('/', getLocale())} class="mt-6 inline-block text-link">
		{m.error_back_home()}
	</a>
</section>
