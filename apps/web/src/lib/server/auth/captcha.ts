/**
 * Cloudflare Turnstile on the email forms (sign-up, sign-in, password reset). Supabase checks the
 * answer: once "CAPTCHA protection" is on in its dashboard, those three calls are refused without
 * a valid one. The widget shows only while `TURNSTILE_SITE_KEY` is set, so the order is: set the
 * site key, release, then turn the protection on in Supabase with the secret key.
 */

/** The public site key, or null while the widget is off. It only names the widget. */
export function captchaSiteKey(env: { TURNSTILE_SITE_KEY?: string } | undefined): string | null {
  const key = env?.TURNSTILE_SITE_KEY?.trim();
  return key ? key : null;
}

/** The form field the widget writes its answer to (Turnstile's `response-field-name`). */
export const CAPTCHA_FIELD = 'captchaToken';

/** The answer the form sent, or null. Never logged: it is single-use but still a credential. */
export function captchaTokenFrom(data: FormData): string | null {
  const value = data.get(CAPTCHA_FIELD);
  return typeof value === 'string' && value && value.length <= 4096 ? value : null;
}

/** The answer as a field of the api call's body: none at all when the form sent none. */
export function captchaField(data: FormData): { captchaToken?: string } {
  const captchaToken = captchaTokenFrom(data);
  return captchaToken ? { captchaToken } : {};
}
