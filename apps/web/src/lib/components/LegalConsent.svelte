<script lang="ts">
  import { m } from '#lib/paraglide/messages.js';

  // Signing in with a provider creates the account too, so the login page says it as well.
  let { mode }: { mode: 'signup' | 'login' } = $props();
</script>

<p class="text-sm text-muted">
  {mode === 'signup' ? m.legal_consent_signup() : m.legal_consent_login()}
  <a href="/terms" class="link-underline text-surface-950-50">{m.terms_title()}</a>
  {m.legal_consent_and()}
  <a href="/privacy" class="link-underline text-surface-950-50">{m.privacy_title()}</a>. {m.legal_consent_emails()}
</p>
