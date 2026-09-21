<script lang="ts">
	import ProfileForm from '$lib/components/ProfileForm.svelte';
	import { m } from '$lib/paraglide/messages';

	let { data } = $props();
</script>

<svelte:head>
	<title>{m.profile_title()}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<section class="py-16 md:py-24">
	<h1 class="text-4xl font-semibold tracking-tight md:text-6xl">{m.profile_title()}</h1>
	<p class="mt-4 max-w-[44ch] text-lg">{m.profile_lede()}</p>

	<div class="mt-8">
		<ProfileForm form={data.form} />
	</div>
</section>
