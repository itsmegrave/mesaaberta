<script lang="ts">
	import { localizedHref } from '$lib/i18n/locales';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	// Signing in with a provider creates the account too, so the login page says it as well.
	let { mode }: { mode: 'signup' | 'login' } = $props();

	const locale = getLocale();
</script>

<p class="text-sm text-muted">
	{mode === 'signup' ? m.legal_consent_signup() : m.legal_consent_login()}
	<a href={localizedHref('/terms', locale)} class="link-underline text-surface-950-50"
		>{m.terms_title()}</a
	>
	{m.legal_consent_and()}
	<a href={localizedHref('/privacy', locale)} class="link-underline text-surface-950-50"
		>{m.privacy_title()}</a
	>. {m.legal_consent_emails()}
</p>
