import { todayIn } from '../../../crowdfunding/phase';
import { normalizeCampaignUrl } from '../../../crowdfunding/url';
import type { ImportSource, SourceCandidate } from './types';
export const SOURCE_HOSTS: Record<ImportSource, readonly string[]> = {
  catarse: ['www.catarse.com.br', 'catarse.com.br', 'catarse.me', 'www.catarse.me'],
  meeplestarter: ['mail.meeplestarter.com.br', 'meeplestarter.com.br', 'www.meeplestarter.com.br'],
};
export function sourceUrlAllowed(url: string, source: ImportSource): boolean {
  try {
    const u = new URL(url);
    return (
      u.protocol === 'https:' &&
      !u.username &&
      !u.password &&
      (!u.port || u.port === '443') &&
      SOURCE_HOSTS[source].includes(u.hostname)
    );
  } catch {
    return false;
  }
}
/** Conservative: RPG alone also describes videogames; require tabletop wording or an RPG book. */
export function isTabletopRpg(text: string): boolean {
  const s = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  // A broad games category or an author's hobby is not evidence about the funded product.
  if (
    /\b(videogame|video game|jogo para pc|jogo pc|jogo de tabuleiro|board game|card ?game|jogo de cartas|baralho|livro de receitas|culinaria|autobiografia)\b/.test(
      s,
    )
  )
    return false;
  const direct =
    /\b(?:um|novo|jogo de|sistema de|e um|e)\s+(?:novo\s+)?rpgs? de mesa\b|\b(?:um|e um) jogo de interpretacao de personagens\b|\b(?:sistema|suplemento|aventura|cenario|manual|livro(?: basico| de regras)?)\s+(?:(?:de|do|para)\s+)?rpg\b/g;
  for (const match of s.matchAll(direct)) {
    const context = s.slice(Math.max(0, match.index - 50), match.index);
    if (!/\b(?:inspirad[oa]s?|basead[oa]s?|autor|autora|gosta|joga)\b[^.!?]*$/.test(context))
      return true;
  }
  // TTRPG names are explicit when used as a product title, not in an author/background sentence.
  return (
    /\bttrpg\b/.test(s.split(/[.!?]/, 1)[0]) &&
    !/\b(?:autor|autora|gosto|gosta|joga|hobby|inspirad[oa])\b/.test(s.split(/[.!?]/, 1)[0])
  );
}

const validDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
export function validateCandidate(input: SourceCandidate, now: Date): SourceCandidate | null {
  const url = normalizeCampaignUrl(input.url);
  if (
    !url ||
    !sourceUrlAllowed(url, input.source) ||
    !input.externalId ||
    input.externalId.length > 200 ||
    !validDate(input.startsOn) ||
    !validDate(input.endsOn) ||
    input.endsOn < input.startsOn ||
    input.endsOn < todayIn(now)
  )
    return null;
  const name = input.name.trim(),
    owner = input.owner.trim();
  if (!name || name.length > 120 || !owner || owner.length > 80) return null;
  return { ...input, url, name, owner };
}
/** All verified host aliases share a lock and a lookup, including member submissions. */
export function campaignUrlAliases(raw: string): string[] {
  const normalized = normalizeCampaignUrl(raw);
  if (!normalized) return [];
  const u = new URL(normalized);
  const source = (Object.keys(SOURCE_HOSTS) as ImportSource[]).find((s) =>
    SOURCE_HOSTS[s].includes(u.hostname),
  );
  if (!source) return [normalized];
  return [
    ...new Set(
      SOURCE_HOSTS[source].map((host) => {
        const a = new URL(u);
        a.hostname = host;
        return normalizeCampaignUrl(a.href)!;
      }),
    ),
  ].sort();
}
