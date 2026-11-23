import type { Handle } from '@sveltejs/kit/hooks';

// The Content-Security-Policy is set by SvelteKit itself (`kit.csp` in vite.config.ts), because
// the per-request nonce has to be stamped on the inline scripts it renders.
const headers = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  // One year, this host only. No `includeSubDomains` or `preload` until the domain is settled:
  // both are hard to take back.
  'strict-transport-security': 'max-age=31536000',
  // Powerful browser features the app never uses stay off, also for anything embedded. Passkeys
  // (publickey-credentials-*) are left at their default.
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=()',
};

export const handleSecurityHeaders: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);

  for (const [name, value] of Object.entries(headers)) {
    if (!response.headers.has(name)) response.headers.set(name, value);
  }

  return response;
};
