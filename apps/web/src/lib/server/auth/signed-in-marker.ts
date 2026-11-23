import type { Cookies } from '@sveltejs/kit';

/**
 * "Just signed in": set by every sign-in that succeeds here (e-mail and password, a provider's
 * callback or a confirmation link, a passkey), read by the first page that asks for widgets, which then
 * clears it. A popup that opens on sign-in waits for it. Short-lived: a sign-in whose first pages
 * never show widgets (onboarding, say) does not leave it waiting for days.
 */
export const SIGNED_IN_COOKIE = 'ma_signed_in';

export function markSignedIn(cookies: Pick<Cookies, 'set'>) {
  cookies.set(SIGNED_IN_COOKIE, '1', {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 30 * 60,
  });
}

/** Whether this request comes right after a sign-in; clears the mark so it is read once. */
export function takeSignedIn(cookies: Pick<Cookies, 'get' | 'delete'>): boolean {
  if (cookies.get(SIGNED_IN_COOKIE) !== '1') return false;
  cookies.delete(SIGNED_IN_COOKIE, { path: '/' });
  return true;
}
