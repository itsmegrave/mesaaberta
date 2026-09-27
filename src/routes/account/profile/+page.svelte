<script lang="ts">
	import { page } from '$app/state';
	import Avatar from '$lib/components/Avatar.svelte';
	import ProfileForm from '$lib/components/ProfileForm.svelte';
	import { localizedHref } from '$lib/i18n/locales';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import { toast } from '$lib/toaster';

	let { data, form } = $props();

	const locale = getLocale();

	const card = 'rounded-lg border border-surface-200-800 bg-panel p-6 md:p-8';
	const heading = 'text-2xl leading-tight font-semibold tracking-[-0.02em] md:text-[26px]';

	const photoNotice = $derived(page.url.searchParams.get('foto'));

	const photoErrors: Record<string, () => string> = {
		empty: m.account_photo_error_empty,
		too_big: m.account_photo_error_too_big,
		not_an_image: m.account_photo_error_type,
		upload_failed: m.account_photo_error_failed
	};

	const check = 'M5 12.5l4.5 4.5L19 7.5';
	const cross = 'M6 6l12 12M18 6L6 18';
</script>

<svelte:head>
	<title>{m.account_profile_title()} · Mesa Aberta</title>
	<meta name="robots" content="noindex" />
</svelte:head>

{#snippet mark(path: string)}
	<svg
		width="18"
		height="18"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="1.8"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
		class="mt-1 shrink-0"><path d={path} /></svg
	>
{/snippet}

<section class="pt-2 pb-4 md:pt-12">
	<h1
		class="text-[40px] leading-[1.05] font-semibold tracking-[-0.02em] text-balance md:text-[68px]"
	>
		{m.account_profile_title()}
	</h1>
	<p class="mt-2.5 max-w-[52ch] text-[17px] text-muted md:mt-3.5 md:text-xl">
		{m.account_profile_lede()}
	</p>

	<div class="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
		<div class="grid gap-6">
			<section aria-labelledby="photo-heading" class={card}>
				<h2 id="photo-heading" class={heading}>{m.account_photo()}</h2>
				<div class="mt-5 flex flex-col gap-5 sm:flex-row sm:items-start">
					<Avatar src={data.avatarUrl} name={data.form.data.name || data.username} size={80} />
					<div class="grid gap-3">
						<form
							method="POST"
							action="?/photo"
							enctype="multipart/form-data"
							class="flex flex-wrap items-center gap-3"
						>
							<label for="photo" class="sr-only">{m.account_photo_file()}</label>
							<input
								id="photo"
								name="photo"
								type="file"
								accept="image/png,image/jpeg,image/webp"
								aria-describedby="photo-hint{form?.photoError ? ' photo-error' : ''}"
								class="max-w-full text-sm file:mr-3 file:rounded-lg file:border-[1.5px] file:border-surface-200-800 file:bg-panel file:px-3 file:py-2 file:font-semibold"
							/>
							<button
								type="submit"
								class="btn h-11 rounded-lg border-[1.5px] border-surface-950-50 px-4 font-semibold"
								>{m.account_photo_upload()}</button
							>
						</form>
						{#if data.hasUploadedPhoto}
							<form method="POST" action="?/removePhoto">
								<button
									type="submit"
									class="btn h-11 rounded-lg border-[1.5px] border-surface-200-800 px-4 font-semibold hover:preset-tonal"
									>{m.account_photo_remove()}</button
								>
							</form>
						{/if}
						<p id="photo-hint" class="max-w-[52ch] text-[15px] text-muted">
							{m.account_photo_hint()}
						</p>
						{#if form?.photoError}
							<p id="photo-error" role="alert" class="text-sm font-semibold text-error-700-300">
								{photoErrors[form.photoError]?.() ?? m.account_photo_error_failed()}
							</p>
						{/if}
						{#if photoNotice}
							<p role="status" class="text-sm font-semibold">
								{photoNotice === 'salva' ? m.account_photo_saved() : m.account_photo_removed()}
							</p>
						{/if}
					</div>
				</div>
			</section>

			<section aria-labelledby="details" class={card}>
				<h2 id="details" class={heading}>{m.account_details()}</h2>
				<div class="mt-6 grid max-w-xl gap-1">
					<label for="email" class="label-text block font-semibold">{m.account_email()}</label>
					<p id="email-hint" class="text-sm text-surface-700-300">{m.account_email_hint()}</p>
					<input
						id="email"
						type="email"
						value={data.email}
						readonly
						aria-describedby="email-hint"
						class="mt-1 input h-12 w-full rounded-lg border-surface-200-800 bg-surface-950/5 px-3 text-muted dark:bg-surface-50/5"
					/>
				</div>
				<div class="mt-6">
					<ProfileForm
						form={data.form}
						action="?/save"
						usernameLocked
						submitLabel={m.account_profile_save()}
						onsaved={() => toast.success(m.account_profile_saved())}
					/>
				</div>
			</section>

			<section aria-labelledby="your-data" class={card}>
				<h2 id="your-data" class={heading}>{m.account_data_title()}</h2>
				<p class="mt-3 max-w-[60ch]">
					{m.account_data_text()}
					<a href={localizedHref('/privacy', locale)} class="link-underline text-surface-950-50"
						>{m.privacy_title()}</a
					>.
				</p>
				<a
					href={localizedHref('/account/export', locale)}
					download
					data-sveltekit-reload
					class="mt-5 btn h-12 gap-2.5 rounded-lg border-[1.5px] border-primary-500 px-6 font-semibold"
				>
					<svg
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.8"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
						class="shrink-0"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg
					>
					{m.account_export()}
				</a>

				<div class="mt-8 border-t border-surface-200-800 pt-6">
					<h3 class="text-lg font-semibold">{m.account_delete_title()}</h3>
					<p class="mt-2 max-w-[60ch] text-muted">{m.account_delete_text()}</p>
					<form method="POST" action="?/delete" class="mt-4 grid max-w-sm gap-3">
						<label for="confirm" class="label-text font-semibold"
							>{m.account_delete_confirm()}</label
						>
						<input
							id="confirm"
							name="confirm"
							type="text"
							autocomplete="off"
							autocapitalize="none"
							spellcheck="false"
							placeholder={data.username}
							aria-invalid={form?.deleteError ? 'true' : undefined}
							aria-describedby={form?.deleteError ? 'confirm-error' : undefined}
							class="input h-12 w-full rounded-lg border-surface-200-800 bg-panel px-3"
						/>
						{#if form?.deleteError}
							<p id="confirm-error" role="alert" class="text-sm font-semibold text-error-700-300">
								{m.account_delete_error()}
							</p>
						{/if}
						<div>
							<button
								type="submit"
								class="btn h-12 rounded-lg border-[1.5px] border-surface-200-800 px-6 font-semibold text-error-800 hover:preset-tonal dark:text-error-300"
							>
								{m.account_delete_button()}
							</button>
						</div>
					</form>
				</div>
			</section>
		</div>

		<aside aria-labelledby="seen" class={card}>
			<h2 id="seen" class="text-xl font-semibold">{m.account_seen_title()}</h2>
			<ul class="mt-4 grid gap-3 text-[15px]">
				<li class="flex gap-3">{@render mark(check)}{m.account_seen_username()}</li>
				<li class="flex gap-3">{@render mark(check)}{m.account_seen_rating()}</li>
				<li class="flex gap-3 text-muted">{@render mark(cross)}{m.account_seen_email()}</li>
				<li class="flex gap-3 text-muted">{@render mark(cross)}{m.account_seen_comments()}</li>
			</ul>
		</aside>
	</div>
</section>
