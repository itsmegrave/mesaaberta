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
 * 2. The item's `official website` (P856): an `<img>` there that calls itself a logo. That is the
 *    `website` method, and never better than `medium`: a publisher's page shows the publisher's own
 *    logo as often as the game's.
 *
 * Systems Wikidata does not know (most Brazilian indie ones) come back with nothing, and the admin
 * adds their logo by hand. Nothing here throws on a bad answer from the web: it is just no logo.
 */

export type LogoMethod = 'wikidata' | 'website';
export type LogoConfidence = 'high' | 'medium' | 'low';

export type LogoCandidate = {
  /** Where the picture's bytes are read from (PNG, JPEG or WebP; SVG is refused downstream). */
  imageUrl: string;
  /** The page that shows the logo and its terms: the Commons file page or the official site. */
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
  /** Why there is no candidate, when there is none. */
  /**
   * Why there is no candidate, when there is none. `lookup_failed` is not an answer about the
   * system: Wikidata or Commons could not be read, so nothing should be recorded for it.
   */
  reason: 'no_wikidata_item' | 'no_logo' | 'only_svg' | 'lookup_failed' | null;
  /** With `lookup_failed` on a 429: the seconds Wikimedia asked to wait before trying again. */
  retryAfter?: number;
};

export type FinderDeps = { fetcher?: Fetcher; resolve?: Resolver; timeoutMs?: number };

const USER_AGENT = 'MesaAbertaLogoFinder/1.0 (+https://github.com/itsmegrave/mesaaberta)';
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
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
      const read = await getJson<{ entities?: Record<string, WikidataEntity> }>(
        fetcher,
        query(WIKIDATA_API, {
          action: 'wbgetentities',
          ids: fresh.join('|'),
          props: 'labels|aliases|descriptions|claims',
          languages: 'pt|en|mul',
        }),
        timeoutMs,
      );
      entities.push(...Object.values(read.entities ?? {}));
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

/** A Commons file as a PNG thumbnail, with its file page, licence and author. */
async function commonsFile(fetcher: Fetcher, file: string, timeoutMs: number) {
  const info = await getJson<CommonsInfo>(
    fetcher,
    query(COMMONS_API, {
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
    sourcePage:
      image.descriptionurl ??
      `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, '_'))}`,
    license: plainText(meta.LicenseShortName?.value),
    attribution: plainText(meta.Artist?.value) ?? plainText(meta.Credit?.value),
  };
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
  if (!picked)
    return { candidate: null, wikidataId: null, website: null, reason: 'no_wikidata_item' };
  const { entity, exact } = picked;
  const website = stringClaims(entity, 'P856')[0] ?? null;
  const item = `https://www.wikidata.org/wiki/${entity.id}`;

  const logoFile = stringClaims(entity, 'P154')[0];
  if (logoFile) {
    const file = await commonsFile(fetcher, logoFile, timeoutMs);
    if (file) {
      return {
        candidate: {
          ...file,
          method: 'wikidata',
          confidence: exact ? 'high' : 'medium',
          note: exact
            ? `Logo do item ${entity.id} do Wikidata, com o mesmo nome do sistema.`
            : `Logo do item ${entity.id} do Wikidata, com o nome sem a edição: pode ser o logo de outra edição.`,
        },
        wikidataId: entity.id,
        website,
        reason: null,
      };
    }
  }

  if (website) {
    const page = await readPage(website, { fetcher, resolve });
    if (page) {
      const found = findLogoInHtml(page.html, page.finalUrl, name);
      if (found && 'url' in found) {
        return {
          candidate: {
            imageUrl: found.url,
            sourcePage: page.finalUrl.href,
            method: 'website',
            confidence: found.mentionsName && exact ? 'medium' : 'low',
            attribution: null,
            license: null,
            note: found.mentionsName
              ? `Imagem marcada como logo no site oficial (${item}), com o nome do sistema.`
              : `Primeira imagem marcada como logo no site oficial (${item}): pode ser o logo da editora.`,
          },
          wikidataId: entity.id,
          website,
          reason: null,
        };
      }
      if (found && 'onlySvg' in found)
        return { candidate: null, wikidataId: entity.id, website, reason: 'only_svg' };
    }
  }
  return { candidate: null, wikidataId: entity.id, website, reason: 'no_logo' };
}
