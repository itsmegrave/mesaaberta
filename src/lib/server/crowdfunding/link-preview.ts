import { isPublicAddress } from './address';

/**
 * Reading a campaign page (its title and picture) from the server, for a link a member typed. The
 * address is untrusted, so every request is guarded: https on the default port only, a host name
 * (never an IP literal) that resolves to public addresses only, a few redirects each checked again,
 * a short timeout, a size cap and HTML or an image only. Nothing here throws: a page that cannot be
 * read is just a preview with nothing in it, and the member types the name themselves.
 *
 * Workers have no DNS API, so names are resolved over DNS-over-HTTPS. Workers also cannot pin the
 * address a request connects to, so a name that changes its answer between the check and the fetch
 * is not caught here; the Workers runtime itself refuses to connect to private networks.
 */
export type LinkPreview = { title: string | null; imageUrl: string | null };

export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;
export type Resolver = (host: string) => Promise<string[]>;

export const PREVIEW_LIMITS = {
  maxRedirects: 3,
  timeoutMs: 4_000,
  maxHtmlBytes: 256 * 1024,
  maxImageBytes: 2 * 1024 * 1024,
} as const;

const USER_AGENT = 'MesaAbertaLinkPreview/1.0 (+https://mesaaberta.app)';
const LOCAL_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home', '.corp'];

/** The addresses a name resolves to (A and AAAA), through Cloudflare's DNS-over-HTTPS. */
export const resolveOverHttps =
  (fetcher: Fetcher = fetch): Resolver =>
  async (host) => {
    const answers = await Promise.all(
      (['A', 'AAAA'] as const).map(async (type) => {
        const response = await fetcher(
          `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`,
          {
            headers: { accept: 'application/dns-json' },
            signal: AbortSignal.timeout(PREVIEW_LIMITS.timeoutMs),
          },
        );
        if (!response.ok) return [];
        const body = (await response.json()) as { Answer?: { type: number; data: string }[] };
        const wanted = type === 'A' ? 1 : 28;
        return (body.Answer ?? []).filter((a) => a.type === wanted).map((a) => a.data);
      }),
    );
    return answers.flat();
  };

/** Whether `url` is one this server may request: https, no credentials, a public name. */
export async function isSafeTarget(url: URL, resolve: Resolver): Promise<boolean> {
  if (url.protocol !== 'https:') return false;
  if (url.username || url.password) return false;
  if (url.port && url.port !== '443') return false;
  const host = url.hostname.toLowerCase();
  // An IP literal, in any notation URL parsing accepts, is never a campaign page.
  if (host.startsWith('[') || /^[\d.]+$/.test(host) || /^0x/i.test(host)) return false;
  if (host === 'localhost' || !host.includes('.')) return false;
  if (LOCAL_SUFFIXES.some((suffix) => host.endsWith(suffix))) return false;
  let addresses: string[];
  try {
    addresses = await resolve(host);
  } catch {
    return false;
  }
  return addresses.length > 0 && addresses.every(isPublicAddress);
}

type Guarded = { response: Response; finalUrl: URL };

/** GET with the guards above, following redirects by hand so each hop is checked. */
async function guardedGet(
  start: string,
  accept: string,
  { fetcher, resolve }: { fetcher: Fetcher; resolve: Resolver },
): Promise<Guarded | null> {
  let url: URL;
  try {
    url = new URL(start);
  } catch {
    return null;
  }
  for (let hop = 0; hop <= PREVIEW_LIMITS.maxRedirects; hop++) {
    if (!(await isSafeTarget(url, resolve))) return null;
    let response: Response;
    try {
      response = await fetcher(url.href, {
        method: 'GET',
        redirect: 'manual',
        headers: { accept, 'user-agent': USER_AGENT },
        signal: AbortSignal.timeout(PREVIEW_LIMITS.timeoutMs),
      });
    } catch {
      return null;
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      await response.body?.cancel().catch(() => undefined);
      if (!location) return null;
      try {
        url = new URL(location, url);
      } catch {
        return null;
      }
      continue;
    }
    return response.ok ? { response, finalUrl: url } : null;
  }
  return null;
}

/** Reads at most `limit` bytes of the body, or `null` when it is bigger than that. */
async function readCapped(response: Response, limit: number): Promise<Uint8Array | null> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > limit) {
    await response.body?.cancel().catch(() => undefined);
    return null;
  }
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

const decodeEntities = (text: string) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, entity: string) => {
    if (entity[0] === '#') {
      const code =
        entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : whole;
    }
    return ENTITIES[entity.toLowerCase()] ?? whole;
  });

const attributeOf = (tag: string, name: string) => {
  const found = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return found ? decodeEntities(found[1] ?? found[2] ?? found[3] ?? '') : null;
};

/** The title and picture a page declares: Open Graph first, then Twitter's, then the <title>. */
export function readMeta(html: string, base: URL): LinkPreview {
  const head = html.slice(
    0,
    html.search(/<\/head>/i) === -1 ? undefined : html.search(/<\/head>/i),
  );
  const meta = new Map<string, string>();
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = (attributeOf(tag, 'property') ?? attributeOf(tag, 'name'))?.toLowerCase();
    const content = attributeOf(tag, 'content');
    if (key && content && !meta.has(key)) meta.set(key, content.trim());
  }
  const titleTag = head.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const title =
    meta.get('og:title') ??
    meta.get('twitter:title') ??
    (titleTag ? decodeEntities(titleTag) : null);
  const image =
    meta.get('og:image') ?? meta.get('og:image:url') ?? meta.get('twitter:image') ?? null;
  let imageUrl: string | null = null;
  if (image) {
    try {
      imageUrl = new URL(image, base).href;
    } catch {
      imageUrl = null;
    }
  }
  const clean = title?.replace(/\s+/g, ' ').trim();
  return { title: clean ? clean : null, imageUrl };
}

/** The title and picture of the campaign page at `link`, or nothing when it cannot be read. */
export async function readLinkPreview(
  link: string,
  deps: { fetcher?: Fetcher; resolve?: Resolver } = {},
): Promise<LinkPreview> {
  const fetcher = deps.fetcher ?? fetch;
  const resolve = deps.resolve ?? resolveOverHttps(fetcher);
  const empty: LinkPreview = { title: null, imageUrl: null };
  const page = await guardedGet(link, 'text/html', { fetcher, resolve });
  if (!page) return empty;
  if (
    !/^(text\/html|application\/xhtml\+xml)\b/i.test(
      page.response.headers.get('content-type') ?? '',
    )
  ) {
    await page.response.body?.cancel().catch(() => undefined);
    return empty;
  }
  const bytes = await readCapped(page.response, PREVIEW_LIMITS.maxHtmlBytes);
  if (!bytes) return empty;
  return readMeta(new TextDecoder('utf-8', { fatal: false }).decode(bytes), page.finalUrl);
}

/** The picture at `imageUrl` as bytes, guarded like a page. The caller still judges its type by its bytes. */
export async function readRemoteImage(
  imageUrl: string,
  deps: { fetcher?: Fetcher; resolve?: Resolver } = {},
): Promise<Uint8Array | null> {
  const fetcher = deps.fetcher ?? fetch;
  const resolve = deps.resolve ?? resolveOverHttps(fetcher);
  const image = await guardedGet(imageUrl, 'image/png,image/jpeg,image/webp', { fetcher, resolve });
  if (!image) return null;
  if (!/^image\//i.test(image.response.headers.get('content-type') ?? '')) {
    await image.response.body?.cancel().catch(() => undefined);
    return null;
  }
  return readCapped(image.response, PREVIEW_LIMITS.maxImageBytes);
}
