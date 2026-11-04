import {
  attributesOf,
  readPage,
  resolveOverHttps,
  type Fetcher,
  type Resolver,
} from '../../crowdfunding/link-preview';

/**
 * Finding a game system's logo on the open web, for an admin to review before anyone sees it.
 * Logos are trademarks, so every find keeps where it came from and how sure the search is:
 *
 * 1. Wikidata: the item for the system (its label or an alias is the system's name, and it says it
 *    is a role-playing game). Its `logo image` (P154) is a file on Wikimedia Commons; Commons
 *    renders it as a PNG and tells its licence. That is the `wikidata` method.
 * 2. Commons itself: a file titled with the system's name and "logo" (most RPG items have no P154,
 *    but the file is often there). That is the `commons` method, `medium` when the Wikidata item
 *    matched exactly, else `low` (found by name only).
 * 3. The item's `official website` (P856): an `<img>` there that calls itself a logo and carries
 *    the system's name. That is the `website` method, and never better than `medium`.
 * 4. Wikipedia (English, then Portuguese): the article about the game, found through the Wikidata
 *    item or, when Wikidata does not know the system by that name, by searching Wikipedia (which
 *    also finds the item behind the article, for steps 1 and 3). The article's main picture is the
 *    `wikipedia` method: `medium` when its file name says logo, else `low` (it is often the cover).
 * 5. Logo.dev (when its keys are set): a brand whose name is the system's (its search, with the
 *    secret key), or the brand of the official site. Its logo is the `logodev` method, `medium` when
 *    the name matched or the domain carries the name, else `low` (a publisher's domain).
 * 6. Any other logo on the official site, `low`: a publisher's page shows its own logo as often as
 *    the game's.
 *
 * Systems neither Wikidata nor Wikipedia know (most Brazilian indie ones) come back with nothing,
 * and the admin adds their logo by hand. Nothing here throws on a bad answer from the web: it is
 * just no logo.
 */

export type LogoMethod = 'wikidata' | 'commons' | 'website' | 'wikipedia' | 'logodev';
export type LogoConfidence = 'high' | 'medium' | 'low';

export type LogoCandidate = {
  /** Where the picture's bytes are read from (PNG, JPEG or WebP; SVG is refused downstream). */
  imageUrl: string;
  /** The page that shows the logo and its terms: the file page on Commons or Wikipedia, or the site. */
  sourcePage: string;
  method: LogoMethod;
  confidence: LogoConfidence;
  /** Who the logo belongs to or who uploaded it, as the source says it, when it says. */
  attribution: string | null;
  /** The licence the source declares (Commons' short name), when there is one. */
  license: string | null;
  /** Why the confidence is what it is, for the reviewer. */
  note: string;
};

export type LogoSearch = {
  candidate: LogoCandidate | null;
  wikidataId: string | null;
  website: string | null;
  /**
   * Why there is no candidate, when there is none. `lookup_failed` is not an answer about the
   * system: Wikidata or Commons could not be read, so nothing should be recorded for it.
   */
  reason: 'no_wikidata_item' | 'no_logo' | 'only_svg' | 'lookup_failed' | null;
  /** With `lookup_failed` on a 429: the seconds Wikimedia asked to wait before trying again. */
  retryAfter?: number;
};

/** Logo.dev's keys: the secret one searches brands by name, the publishable one serves logos. */
export type LogoDevKeys = { secretKey?: string; publishableKey?: string };
export type FinderDeps = {
  fetcher?: Fetcher;
  resolve?: Resolver;
  timeoutMs?: number;
  logoDev?: LogoDevKeys;
};

/** Logo.dev's keys from a Worker's env (secrets `LOGO_DEV_SECRET_KEY`, `LOGO_DEV_PUBLISHABLE_KEY`). */
export function logoDevKeys(env: unknown): LogoDevKeys | undefined {
  const config = (env ?? {}) as {
    LOGO_DEV_SECRET_KEY?: unknown;
    LOGO_DEV_PUBLISHABLE_KEY?: unknown;
  };
  const text = (value: unknown) => (typeof value === 'string' && value ? value : undefined);
  const keys = {
    secretKey: text(config.LOGO_DEV_SECRET_KEY),
    publishableKey: text(config.LOGO_DEV_PUBLISHABLE_KEY),
  };
  return keys.publishableKey ? keys : undefined;
}

const USER_AGENT = 'MesaAbertaLogoFinder/1.0 (+https://github.com/itsmegrave/mesaaberta)';
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const wikipediaApi = (language: string) => `https://${language}.wikipedia.org/w/api.php`;
/** Wide enough for a crisp logo on a retina card, small enough to stay under the image cap. */
const THUMB_WIDTH = 512;
const LANGUAGES = ['en', 'pt'] as const;
/** The longest a `Retry-After` is waited for before the search gives up for now. */
const MAX_RETRY_WAIT_S = 5;

// "tabletop role-playing game". Items of other classes still count when their description says
// they are a role-playing game (RPG_WORDS), which covers editions and rule systems too.
const RPG_CLASSES = new Set(['Q1643932']);
const RPG_WORDS =
  /\b(rpg|ttrpg|role[- ]?playing|roleplaying|jogo de interpreta[cç][aã]o|jogo de rpg|juego de rol|jeu de r[oô]le)\b/i;

// --- Names ------------------------------------------------------------------------------------

/** A name as the search compares it: no accents, no case, no punctuation, single spaces. */
export const foldName = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const EDITION =
  /\s+(\d+(\.\d+)?\s?e|\d+(ª|º|a|nd|rd|th|st)?\s*(edi[cç][aã]o|edition|ed\.?)|v\d+(\.\d+)?|revised|revisado|revisada|rpg)$/i;

/**
 * The names the system is searched by, most exact first: as written, without what is in
 * parentheses ("Tormenta 20 (T20)"), and without an edition at the end ("Dungeons & Dragons 5e").
 * Only a match on one of the first two is `exact`.
 */
export function searchNames(name: string): { term: string; exact: boolean }[] {
  const names: { term: string; exact: boolean }[] = [];
  const add = (term: string, exact: boolean) => {
    const clean = term.replace(/\s+/g, ' ').trim();
    if (clean.length >= 2 && !names.some((n) => foldName(n.term) === foldName(clean)))
      names.push({ term: clean, exact });
  };
  add(name, true);
  const bare = name.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  add(bare, true);
  let base = bare;
  for (let i = 0; i < 3 && EDITION.test(base); i++) base = base.replace(EDITION, '').trim();
  add(base, false);
  return names;
}

// --- Wikidata -------------------------------------------------------------------------------

type Claim = {
  rank?: string;
  mainsnak?: { datavalue?: { value?: unknown } };
};
export type WikidataEntity = {
  id: string;
  labels?: Record<string, { value: string }>;
  aliases?: Record<string, { value: string }[]>;
  descriptions?: Record<string, { value: string }>;
  claims?: Record<string, Claim[]>;
  sitelinks?: Record<string, { title: string }>;
};

const claimValues = (entity: WikidataEntity, property: string) =>
  (entity.claims?.[property] ?? [])
    .filter((claim) => claim.rank !== 'deprecated')
    .sort((a, b) => (a.rank === 'preferred' ? -1 : 0) - (b.rank === 'preferred' ? -1 : 0))
    .map((claim) => claim.mainsnak?.datavalue?.value)
    .filter((value) => value !== undefined);

const stringClaims = (entity: WikidataEntity, property: string) =>
  claimValues(entity, property).filter((value): value is string => typeof value === 'string');

const itemClaims = (entity: WikidataEntity, property: string) =>
  claimValues(entity, property)
    .map((value) => (value as { id?: unknown }).id)
    .filter((id): id is string => typeof id === 'string');

/** Whether the item says it is a role-playing game, by its class or its description. */
export function isRpgItem(entity: WikidataEntity) {
  if (
    [...itemClaims(entity, 'P31'), ...itemClaims(entity, 'P279')].some((id) => RPG_CLASSES.has(id))
  )
    return true;
  return Object.values(entity.descriptions ?? {}).some((d) => RPG_WORDS.test(d.value));
}

const namesOf = (entity: WikidataEntity) => [
  ...Object.values(entity.labels ?? {}).map((label) => label.value),
  ...Object.values(entity.aliases ?? {}).flatMap((list) => list.map((alias) => alias.value)),
];

/**
 * The item that is this system: a role-playing game whose label or alias is one of the searched
 * names, the most exact name first, and among equals the one with a logo. Null when none is.
 */
export function pickEntity(
  name: string,
  entities: readonly WikidataEntity[],
): { entity: WikidataEntity; exact: boolean } | null {
  const rpgs = entities.filter(isRpgItem);
  for (const { term, exact } of searchNames(name)) {
    const wanted = foldName(term);
    const matches = rpgs.filter((entity) => namesOf(entity).some((n) => foldName(n) === wanted));
    if (matches.length === 0) continue;
    const withLogo = matches.find((entity) => stringClaims(entity, 'P154').length > 0);
    return { entity: withLogo ?? matches[0], exact };
  }
  return null;
}

// --- Official site --------------------------------------------------------------------------

const MAX_IMG_TAGS = 400;
const MAX_TAG_LENGTH = 2_000;

/** Each `<img ...>` of `html` in one pass, bounded like the meta reader in link-preview. */
function* imgTags(html: string) {
  const lower = html.toLowerCase();
  let from = 0;
  for (let count = 0; count < MAX_IMG_TAGS; count++) {
    const start = lower.indexOf('<img', from);
    if (start === -1) return;
    const end = lower.indexOf('>', start);
    if (end === -1) return;
    from = end + 1;
    if (end - start <= MAX_TAG_LENGTH) yield attributesOf(html.slice(start + 4, end));
  }
}

const isSvg = (url: string) => /\.svgz?(\?|#|$)/i.test(url) || url.startsWith('data:image/svg');

/**
 * The logo the official page shows: the first `<img>` whose class, id, alt or file name says
 * `logo`, preferring one that also carries the system's name (`mentionsName`). SVG and inline
 * (`data:`) pictures are skipped; `onlySvg` tells when that left nothing.
 */
export function findLogoInHtml(
  html: string,
  base: URL,
  name: string,
): { url: string; mentionsName: boolean } | { onlySvg: true } | null {
  const wanted = searchNames(name).map((n) => foldName(n.term).replace(/ /g, ''));
  let first: string | null = null;
  let sawSvg = false;
  for (const attributes of imgTags(html)) {
    const src =
      attributes.get('src') ?? attributes.get('data-src') ?? attributes.get('data-lazy-src');
    if (!src) continue;
    const said = ['class', 'id', 'alt', 'title'].map((key) => attributes.get(key) ?? '').join(' ');
    const file = src.split(/[?#]/)[0].split('/').pop() ?? '';
    if (!/logo|brand|marca/i.test(`${said} ${file}`)) continue;
    let url: URL;
    try {
      url = new URL(src, base);
    } catch {
      continue;
    }
    if (url.protocol !== 'https:' || isSvg(url.href)) {
      sawSvg ||= isSvg(url.href);
      continue;
    }
    const words = foldName(`${attributes.get('alt') ?? ''} ${file}`).replace(/ /g, '');
    if (wanted.some((w) => w.length >= 3 && words.includes(w)))
      return { url: url.href, mentionsName: true };
    first ??= url.href;
  }
  if (first) return { url: first, mentionsName: false };
  return sawSvg ? { onlySvg: true } : null;
}

// --- The search -----------------------------------------------------------------------------

/** Wikidata or Commons could not be read: the search says so instead of "nothing found". */
class LookupFailed extends Error {
  constructor(
    reason: string,
    /** Seconds Wikimedia asked to wait, on a 429. */
    readonly retryAfter?: number,
  ) {
    super(reason);
  }
}

/** A GET of a fixed, trusted API (Wikidata, Commons) as JSON. Throws `LookupFailed` on any failure. */
async function getJson<T>(
  fetcher: Fetcher,
  url: string,
  timeoutMs: number,
  retry = true,
): Promise<T> {
  let response: Response;
  try {
    response = await fetcher(url, {
      headers: { accept: 'application/json', 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new LookupFailed('network');
  }
  // Asked to slow down: wait as told, once, when it is short; otherwise the search stops.
  const wait = Number(response.headers.get('retry-after'));
  if (response.status === 429 && retry && Number.isFinite(wait) && wait <= MAX_RETRY_WAIT_S) {
    await response.body?.cancel().catch(() => undefined);
    await new Promise((done) => setTimeout(done, Math.max(1, wait) * 1000));
    return getJson(fetcher, url, timeoutMs, false);
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new LookupFailed(
      `http_${response.status}`,
      response.status === 429 && Number.isFinite(wait) && wait > 0 ? wait : undefined,
    );
  }
  try {
    return (await response.json()) as T;
  } catch {
    throw new LookupFailed('not_json');
  }
}

const query = (base: string, params: Record<string, string>) =>
  `${base}?${new URLSearchParams({ format: 'json', ...params })}`;

/** Wikidata items by id, with what the search reads of them (and their Wikipedia articles). */
async function readEntities(fetcher: Fetcher, ids: string[], timeoutMs: number) {
  const read = await getJson<{ entities?: Record<string, WikidataEntity> }>(
    fetcher,
    query(WIKIDATA_API, {
      action: 'wbgetentities',
      ids: ids.join('|'),
      props: 'labels|aliases|descriptions|claims|sitelinks',
      languages: 'pt|en|mul',
      sitefilter: LANGUAGES.map((language) => `${language}wiki`).join('|'),
    }),
    timeoutMs,
  );
  return Object.values(read.entities ?? {}).filter((entity) => !('missing' in entity));
}

/**
 * The Wikidata item that is this system, asking as little as it can (Wikimedia rate-limits
 * anonymous clients): each searched name in English, then in Portuguese only when English found
 * nothing new, the new hits read in one call, and it stops at the first exact match.
 */
async function findItem(fetcher: Fetcher, name: string, timeoutMs: number) {
  const entities: WikidataEntity[] = [];
  const seen = new Set<string>();
  for (const { term } of searchNames(name)) {
    for (const language of LANGUAGES) {
      const found = await getJson<{ search?: { id: string }[] }>(
        fetcher,
        query(WIKIDATA_API, {
          action: 'wbsearchentities',
          search: term,
          language,
          uselang: language,
          type: 'item',
          limit: '7',
        }),
        timeoutMs,
      );
      const fresh = (found.search ?? []).map((hit) => hit.id).filter((id) => !seen.has(id));
      if (fresh.length === 0) continue;
      for (const id of fresh) seen.add(id);
      entities.push(...(await readEntities(fetcher, fresh, timeoutMs)));
      const picked = pickEntity(name, entities);
      if (picked?.exact) return picked;
      break;
    }
  }
  return pickEntity(name, entities);
}

type CommonsInfo = {
  query?: {
    pages?: Record<
      string,
      {
        imageinfo?: {
          thumburl?: string;
          descriptionurl?: string;
          extmetadata?: Record<string, { value?: string }>;
        }[];
      }
    >;
  };
};

const plainText = (html: string | undefined) =>
  html
    ?.replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || null;

/**
 * A file on Commons (or on a Wikipedia, for its own non-free files) as a PNG/JPEG thumbnail, with
 * its file page, licence and author.
 */
async function wikiFile(fetcher: Fetcher, file: string, timeoutMs: number, api = COMMONS_API) {
  const info = await getJson<CommonsInfo>(
    fetcher,
    query(api, {
      action: 'query',
      titles: `File:${file}`,
      prop: 'imageinfo',
      iiprop: 'url|extmetadata',
      iiurlwidth: String(THUMB_WIDTH),
    }),
    timeoutMs,
  );
  const image = Object.values(info?.query?.pages ?? {})[0]?.imageinfo?.[0];
  if (!image?.thumburl) return null;
  const meta = image.extmetadata ?? {};
  return {
    imageUrl: image.thumburl,
    // The wikis answer the page protocol-relative ("//commons.wikimedia.org/...").
    sourcePage: image.descriptionurl
      ? new URL(image.descriptionurl, api).href
      : new URL(`/wiki/File:${encodeURIComponent(file.replace(/ /g, '_'))}`, api).href,
    license: plainText(meta.LicenseShortName?.value),
    attribution: plainText(meta.Artist?.value) ?? plainText(meta.Credit?.value),
  };
}

/**
 * A Commons file whose title is the system's name and the word logo ("Daggerheart logo.svg"),
 * through Commons' own search; the first whose title really carries the whole name.
 */
async function commonsLogoByTitle(fetcher: Fetcher, name: string, timeoutMs: number) {
  const terms = searchNames(name).filter((n) => n.exact);
  const term = terms.at(-1)?.term ?? name;
  const wanted = foldName(term).replace(/ /g, '');
  if (wanted.length < 3) return null;
  const found = await getJson<{ query?: { search?: { title: string }[] } }>(
    fetcher,
    query(COMMONS_API, {
      action: 'query',
      list: 'search',
      srnamespace: '6',
      srlimit: '10',
      srsearch: `intitle:logo intitle:"${term.replace(/"/g, '')}"`,
    }),
    timeoutMs,
  );
  for (const { title } of found.query?.search ?? []) {
    const file = title.replace(/^File:/, '');
    const squashed = foldName(file.replace(/\.[a-z0-9]+$/i, '')).replace(/ /g, '');
    // The name and "logo", with at most a short word between or after ("rpg", "2e", a year):
    // a name inside a longer title ("DJK Agon 08 Düsseldorf logo") is someone else's logo.
    const rest = squashed.startsWith(wanted)
      ? squashed.slice(wanted.length)
      : squashed.endsWith(wanted)
        ? squashed.slice(0, -wanted.length)
        : null;
    if (rest !== null && rest.includes('logo') && rest.replace('logo', '').length <= 6) return file;
  }
  return null;
}

// --- Wikipedia ------------------------------------------------------------------------------

export type ArticlePage = {
  title: string;
  index?: number;
  description?: string;
  /** The article's main picture (its infobox image), a file name without "File:". */
  pageimage?: string;
  pageprops?: { wikibase_item?: string };
};
export type Article = {
  language: (typeof LANGUAGES)[number];
  title: string;
  image: string | null;
  itemId: string | null;
};

const QUALIFIER = /\s*\(([^)]*)\)\s*$/;

/**
 * The article about this system among search results: its title, without a qualifier such as
 * "(role-playing game)", is one of the searched names, and the qualifier or the article's short
 * description says it is a role-playing game. The most exact name first, then the search's order.
 */
export function pickArticle(
  name: string,
  pages: readonly ArticlePage[],
): { page: ArticlePage; exact: boolean } | null {
  const ranked = [...pages].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  for (const { term, exact } of searchNames(name)) {
    const wanted = foldName(term);
    const page = ranked.find((candidate) => {
      const qualifier = candidate.title.match(QUALIFIER);
      const bare = qualifier ? candidate.title.slice(0, qualifier.index) : candidate.title;
      return (
        foldName(bare) === wanted &&
        ((qualifier && RPG_WORDS.test(qualifier[1])) || RPG_WORDS.test(candidate.description ?? ''))
      );
    });
    if (page) return { page, exact };
  }
  return null;
}

type ArticleAnswer = { query?: { pages?: Record<string, ArticlePage> } };
const ARTICLE_PROPS = {
  prop: 'pageimages|pageprops|description',
  piprop: 'name',
  // Most game articles show a non-free cover or logo, which the default (free only) leaves out.
  pilicense: 'any',
  ppprop: 'wikibase_item',
} as const;

const articleFrom = (language: Article['language'], page: ArticlePage): Article => ({
  language,
  title: page.title,
  image: page.pageimage ?? null,
  itemId: page.pageprops?.wikibase_item ?? null,
});

/** The article about the system, by searching Wikipedia in English, then in Portuguese. */
async function searchArticle(fetcher: Fetcher, name: string, timeoutMs: number) {
  const term =
    searchNames(name)
      .filter((n) => n.exact)
      .at(-1)?.term ?? name;
  for (const language of LANGUAGES) {
    const found = await getJson<ArticleAnswer>(
      fetcher,
      query(wikipediaApi(language), {
        action: 'query',
        generator: 'search',
        gsrsearch: term,
        gsrlimit: '5',
        ...ARTICLE_PROPS,
      }),
      timeoutMs,
    );
    const picked = pickArticle(name, Object.values(found.query?.pages ?? {}));
    if (picked) return { article: articleFrom(language, picked.page), exact: picked.exact };
  }
  return null;
}

/** The Wikipedia article of a Wikidata item, in English, else in Portuguese, when it has one. */
async function articleOf(fetcher: Fetcher, entity: WikidataEntity, timeoutMs: number) {
  for (const language of LANGUAGES) {
    const title = entity.sitelinks?.[`${language}wiki`]?.title;
    if (!title) continue;
    const found = await getJson<ArticleAnswer>(
      fetcher,
      query(wikipediaApi(language), { action: 'query', titles: title, ...ARTICLE_PROPS }),
      timeoutMs,
    );
    const page = Object.values(found.query?.pages ?? {})[0];
    if (page) return articleFrom(language, page);
  }
  return null;
}

// --- Logo.dev -------------------------------------------------------------------------------

const LOGO_DEV_API = 'https://api.logo.dev/v2/search';
/** "daggerheart.com" → "daggerheart"; "www.evilhat.com" → "evilhat". */
const domainName = (host: string) =>
  foldName(host.replace(/^www\./i, '').replace(/\.[^.]+$/, '')).replace(/ /g, '');

/** Logo.dev's picture for a domain, or null when it has none (it answers 404, not a monogram). */
async function logoDevImage(fetcher: Fetcher, domain: string, key: string, timeoutMs: number) {
  const url = `https://img.logo.dev/${encodeURIComponent(domain)}?${new URLSearchParams({
    token: key,
    size: String(THUMB_WIDTH),
    format: 'png',
    fallback: '404',
  })}`;
  try {
    // A GET whose body is dropped: the CDN answers 404 to every HEAD.
    const response = await fetcher(url, {
      headers: { 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(timeoutMs),
    });
    await response.body?.cancel().catch(() => undefined);
    return response.ok && response.headers.get('content-type')?.startsWith('image/') ? url : null;
  } catch {
    return null;
  }
}

/** The domain of the brand Logo.dev's search names exactly like the system, when one is. */
async function logoDevDomain(fetcher: Fetcher, name: string, key: string, timeoutMs: number) {
  const term =
    searchNames(name)
      .filter((n) => n.exact)
      .at(-1)?.term ?? name;
  let answer: { data?: { name?: string; domain?: string }[] };
  try {
    const response = await fetcher(
      `${LOGO_DEV_API}?${new URLSearchParams({ q: term, limit: '5' })}`,
      {
        headers: { authorization: `Bearer ${key}`, accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      return null;
    }
    answer = await response.json();
  } catch {
    return null;
  }
  const results = answer.data ?? [];
  for (const { term: searched, exact } of searchNames(name)) {
    const wanted = foldName(searched);
    const hit = results.find((r) => r.domain && r.name && foldName(r.name) === wanted);
    if (hit?.domain) return { domain: hit.domain, exact };
  }
  return null;
}

/**
 * The system's logo on Logo.dev: the brand its search names like the system, else the official
 * site's brand. Null without keys, or when Logo.dev has no logo for either. Logo.dev's own
 * failures are just no logo: it is an extra source, never a reason to stop the search.
 */
async function logoDevLogo(
  fetcher: Fetcher,
  name: string,
  website: string | null,
  exact: boolean,
  keys: LogoDevKeys | undefined,
  timeoutMs: number,
): Promise<LogoCandidate | null> {
  if (!keys?.publishableKey) return null;
  const wanted = searchNames(name).map((n) => foldName(n.term).replace(/ /g, ''));
  const tries: { domain: string; byName: boolean; exact: boolean }[] = [];
  const named = keys.secretKey
    ? await logoDevDomain(fetcher, name, keys.secretKey, timeoutMs)
    : null;
  if (named) tries.push({ domain: named.domain, byName: true, exact: named.exact });
  const site = URL.canParse(website ?? '') ? new URL(website!).hostname : null;
  if (site && site !== named?.domain) tries.push({ domain: site, byName: false, exact });
  for (const attempt of tries) {
    const imageUrl = await logoDevImage(fetcher, attempt.domain, keys.publishableKey, timeoutMs);
    if (!imageUrl) continue;
    const carriesName = wanted.some((w) => w.length >= 3 && domainName(attempt.domain) === w);
    const sure = attempt.exact && (attempt.byName || carriesName);
    return {
      imageUrl,
      sourcePage: `https://${attempt.domain}/`,
      method: 'logodev',
      confidence: sure ? 'medium' : 'low',
      attribution: 'Logos provided by Logo.dev',
      license: null,
      note: attempt.byName
        ? `Logo da marca "${attempt.domain}" no Logo.dev, achada pelo nome do sistema.`
        : carriesName
          ? `Logo do site oficial (${attempt.domain}) no Logo.dev, com o nome do sistema no domínio.`
          : `Logo do site oficial (${attempt.domain}) no Logo.dev: pode ser o logo da editora.`,
    };
  }
  return null;
}

/** Looks for the logo of the system called `name`. Never throws. */
export async function findSystemLogo(name: string, deps: FinderDeps = {}): Promise<LogoSearch> {
  try {
    return await search(name, deps);
  } catch (error) {
    if (!(error instanceof LookupFailed)) throw error;
    return {
      candidate: null,
      wikidataId: null,
      website: null,
      reason: 'lookup_failed',
      ...(error.retryAfter ? { retryAfter: error.retryAfter } : {}),
    };
  }
}

async function search(name: string, deps: FinderDeps): Promise<LogoSearch> {
  const fetcher = deps.fetcher ?? fetch;
  const resolve = deps.resolve ?? resolveOverHttps(fetcher);
  const timeoutMs = deps.timeoutMs ?? 8_000;

  const picked = await findItem(fetcher, name, timeoutMs);
  let entity = picked?.entity ?? null;
  let exact = picked?.exact ?? false;
  let article: Article | null = null;
  // Wikidata did not know the name: Wikipedia's search is looser (other spellings, the Portuguese
  // title), and its article leads back to the item.
  if (!entity) {
    const hit = await searchArticle(fetcher, name, timeoutMs);
    if (hit) {
      article = hit.article;
      exact = hit.exact;
      if (hit.article.itemId)
        entity = (await readEntities(fetcher, [hit.article.itemId], timeoutMs))[0] ?? null;
    }
  }
  const website = entity ? (stringClaims(entity, 'P856')[0] ?? null) : null;
  const item = entity ? `https://www.wikidata.org/wiki/${entity.id}` : null;
  const wikidataId = entity?.id ?? null;
  const found = (candidate: LogoCandidate): LogoSearch => ({
    candidate,
    wikidataId,
    website,
    reason: null,
  });

  const logoFile = entity ? stringClaims(entity, 'P154')[0] : undefined;
  if (entity && logoFile) {
    const file = await wikiFile(fetcher, logoFile, timeoutMs);
    if (file) {
      return found({
        ...file,
        method: 'wikidata',
        confidence: exact ? 'high' : 'medium',
        note: exact
          ? `Logo do item ${entity.id} do Wikidata, com o mesmo nome do sistema.`
          : `Logo do item ${entity.id} do Wikidata, com o nome sem a edição: pode ser o logo de outra edição.`,
      });
    }
  }

  // Most RPG items have no logo statement, but Commons often has the file anyway.
  const titled = await commonsLogoByTitle(fetcher, name, timeoutMs);
  if (titled) {
    const file = await wikiFile(fetcher, titled, timeoutMs);
    if (file) {
      return found({
        ...file,
        method: 'commons',
        confidence: exact && entity ? 'medium' : 'low',
        note: `Arquivo do Wikimedia Commons chamado "${titled}"${
          exact && entity
            ? `; o sistema é o item ${entity.id} do Wikidata`
            : ', achado só pelo nome'
        }.`,
      });
    }
  }

  // Logo.dev's logo when it is the system's own brand; a publisher's waits for the article.
  const brand = await logoDevLogo(fetcher, name, website, exact, deps.logoDev, timeoutMs);
  if (brand?.confidence === 'medium') return found(brand);

  // The official site's logo, kept for last unless it carries the system's name.
  let siteLogo: LogoCandidate | null = null;
  let onlySvg = false;
  if (website) {
    const page = await readPage(website, { fetcher, resolve });
    const logo = page && findLogoInHtml(page.html, page.finalUrl, name);
    if (page && logo && 'url' in logo) {
      siteLogo = {
        imageUrl: logo.url,
        sourcePage: page.finalUrl.href,
        method: 'website',
        confidence: logo.mentionsName && exact ? 'medium' : 'low',
        attribution: null,
        license: null,
        note: logo.mentionsName
          ? `Imagem marcada como logo no site oficial (${item}), com o nome do sistema.`
          : `Primeira imagem marcada como logo no site oficial (${item}): pode ser o logo da editora.`,
      };
      if (logo.mentionsName) return found(siteLogo);
    }
    onlySvg = !!logo && 'onlySvg' in logo;
  }

  article ??= entity ? await articleOf(fetcher, entity, timeoutMs) : null;
  if (article?.image) {
    const api = wikipediaApi(article.language);
    const file = await wikiFile(fetcher, article.image, timeoutMs, api);
    if (file) {
      const saysLogo = /logo/i.test(article.image);
      return found({
        ...file,
        method: 'wikipedia',
        confidence: saysLogo && exact ? 'medium' : 'low',
        note: `Imagem principal do artigo "${article.title}" da Wikipédia (${article.language})${
          saysLogo ? ', com logo no nome do arquivo' : ': pode ser a capa do livro, não o logo'
        }.`,
      });
    }
  }
  if (brand) return found(brand);
  if (siteLogo) return found(siteLogo);

  if (!entity && !article)
    return { candidate: null, wikidataId: null, website: null, reason: 'no_wikidata_item' };
  return { candidate: null, wikidataId, website, reason: onlySvg ? 'only_svg' : 'no_logo' };
}
