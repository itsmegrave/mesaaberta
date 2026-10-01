/** Server-only environment. Keep credentials out of vars, event payloads, and request logs. */
export type InstagramEnv = {
  INSTAGRAM_APP_ID?: string;
  INSTAGRAM_APP_SECRET?: string;
  INSTAGRAM_TOKEN_KEY?: string;
  INSTAGRAM_API_VERSION?: string;
  GROWTHBOOK_API_HOST?: string;
  GROWTHBOOK_CLIENT_KEY?: string;
  APP_ORIGIN?: string;
  SUPABASE_URL?: string;
  ASSETS?: { fetch(request: Request): Promise<Response> };
};
export const SCOPES = 'instagram_business_basic,instagram_business_content_publish';
export const configured = (env: InstagramEnv | undefined) =>
  Boolean(
    env?.INSTAGRAM_APP_ID &&
    env.INSTAGRAM_APP_SECRET &&
    env.INSTAGRAM_TOKEN_KEY &&
    env.APP_ORIGIN?.startsWith('https://'),
  );
export const callbackUrl = (env: InstagramEnv) =>
  new URL('/admin/instagram/callback', env.APP_ORIGIN!).href;

export class InstagramError extends Error {
  constructor(
    public code: number,
    public retryable: boolean,
  ) {
    // API errors can echo secrets. Store only the numeric code, never their message or request URL.
    super(`Instagram API error (${code})`);
  }
}

export async function responseJson<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & { error?: { code?: number; is_transient?: boolean } };
  if (!response.ok || data.error)
    throw new InstagramError(
      data.error?.code ?? response.status,
      response.status === 429 || response.status >= 500 || data.error?.is_transient === true,
    );
  return data;
}

export async function graph<T>(
  env: InstagramEnv,
  token: string,
  path: string,
  params: Record<string, string> = {},
  method = 'GET',
): Promise<T> {
  const url = new URL(
    `https://graph.instagram.com/${env.INSTAGRAM_API_VERSION ?? 'v25.0'}/${path}`,
  );
  const init: RequestInit = {
    method,
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20_000),
  };
  if (method === 'GET') url.search = new URLSearchParams(params).toString();
  else init.body = new URLSearchParams(params);
  return responseJson<T>(await fetch(url, init));
}

export async function exchangeCode(env: InstagramEnv, code: string) {
  const short = await responseJson<{ access_token?: string; data?: { access_token: string }[] }>(
    await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      signal: AbortSignal.timeout(20_000),
      body: new URLSearchParams({
        client_id: env.INSTAGRAM_APP_ID!,
        client_secret: env.INSTAGRAM_APP_SECRET!,
        grant_type: 'authorization_code',
        redirect_uri: callbackUrl(env),
        code,
      }),
    }),
  );
  const token =
    short.access_token ?? (short.data?.length === 1 ? short.data[0].access_token : undefined);
  if (!token) throw new Error('Instagram token response invalid');
  const url = new URL('https://graph.instagram.com/access_token');
  url.search = new URLSearchParams({
    grant_type: 'ig_exchange_token',
    client_secret: env.INSTAGRAM_APP_SECRET!,
    access_token: token,
  }).toString();
  return responseJson<{ access_token: string; expires_in: number }>(
    await fetch(url, { signal: AbortSignal.timeout(20_000) }),
  );
}

export async function refreshToken(token: string) {
  const url = new URL('https://graph.instagram.com/refresh_access_token');
  url.search = new URLSearchParams({
    grant_type: 'ig_refresh_token',
    access_token: token,
  }).toString();
  return responseJson<{ access_token: string; expires_in: number }>(
    await fetch(url, { signal: AbortSignal.timeout(20_000) }),
  );
}

const keyFor = (secret: string) => {
  const bytes = Uint8Array.from(atob(secret), (c) => c.charCodeAt(0));
  if (bytes.length !== 32) throw new Error('Instagram encryption key must be 32 bytes');
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
};
export async function encryptToken(token: string, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const bytes = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await keyFor(secret),
    new TextEncoder().encode(token),
  );
  return `${Buffer.from(iv).toString('base64')}.${Buffer.from(bytes).toString('base64')}`;
}
export async function decryptToken(value: string, secret: string): Promise<string> {
  const [iv, bytes] = value
    .split('.')
    .map((part) => Uint8Array.from(atob(part), (c) => c.charCodeAt(0)));
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await keyFor(secret), bytes);
  return new TextDecoder().decode(plain);
}
