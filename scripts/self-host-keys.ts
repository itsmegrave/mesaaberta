// Prints a new Auth secret and the two API keys signed with it, for the Docker stack's `.env`
// (see "Self-hosting with Docker" in the README). The defaults in docker-compose.yml are Supabase's
// public demo keys: anyone can sign a token with them, so replace them before others can reach the
// site. Only Docker is needed:
//   docker run --rm -v "$PWD":/app -w /app oven/bun:1.4 bun scripts/self-host-keys.ts >> .env
// Then `docker compose up -d` again. Existing sessions end, since their tokens no longer verify.
const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const text = (value: unknown) => base64url(new TextEncoder().encode(JSON.stringify(value)));

const secret = base64url(crypto.getRandomValues(new Uint8Array(48)));
const key = await crypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(secret),
  { name: 'HMAC', hash: 'SHA-256' },
  false,
  ['sign'],
);

// The same claims Supabase puts in a project's legacy keys, valid for ten years.
const sign = async (role: 'anon' | 'service_role') => {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${text({ alg: 'HS256', typ: 'JWT' })}.${text({
    iss: 'supabase',
    role,
    iat: now,
    exp: now + 10 * 365 * 24 * 60 * 60,
  })}`;
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${base64url(new Uint8Array(signature))}`;
};

console.log(`SUPABASE_JWT_SECRET=${secret}
SUPABASE_ANON_KEY=${await sign('anon')}
SUPABASE_SERVICE_KEY=${await sign('service_role')}`);
