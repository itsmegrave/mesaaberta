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
const normalized = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
const excludedProduct =
  /\b(videogame|video game|jogos? eletronicos?|jogos? digitais?|jogo de computador|jogo para (?:pc|windows|linux|android|ios|console)|jogo pc|mmorpg|jogo de tabuleiro|board game|card ?game|jogo de cartas|baralho|livro de receitas|culinaria|autobiografia)\b/;
/** Comparisons are not declarations of the funded product's type. */
function excludedNarrative(text: string): boolean {
  for (const match of text.matchAll(new RegExp(excludedProduct.source, 'g'))) {
    // Keep each context scan bounded even when an untrusted narrative repeats many comparisons.
    const context = text.slice(Math.max(0, match.index - 120), match.index);
    const sentence = Math.max(
      context.lastIndexOf('.'),
      context.lastIndexOf('!'),
      context.lastIndexOf('?'),
    );
    const before = context.slice(sentence + 1);
    if (
      /\b(?:diferente de|ao contrario de|em vez de|nao (?:e|sera|se trata de)|inspirad[oa]s? (?:em|por)|basead[oa]s? (?:em|nos)|adaptad[oa]s? (?:de|dos))\s+(?:(?:um|uma|uns|umas|o|os|a|as)\s+)?$/.test(
        before,
      )
    )
      continue;
    return true;
  }
  return false;
}
/** Conservative: RPG alone also describes videogames; require tabletop wording or an RPG book. */
export function isTabletopRpg(text: string): boolean {
  const s = normalized(text);
  if (excludedProduct.test(s)) return false;
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

/** Evidence is scoped to the funded product: never use creator bios or another campaign's rewards. */
export function isTabletopRpgProduct({
  title,
  summary,
  narrative,
  rewards,
}: {
  title: string;
  summary: string;
  narrative: string;
  rewards: string[];
}): boolean {
  const primary = normalized(`${title} ${summary}`);
  const text = normalized(narrative);
  if (excludedProduct.test(primary) || excludedNarrative(text)) return false;
  if (isTabletopRpg(`${title} ${summary}`) || isTabletopRpg(`${title} ${summary} ${narrative}`))
    return true;
  const identifiesRpg = /\b(?:rpg|ttrpg)\b/.test(primary);
  const identifiesSupplement = /\bsuplemento\b/.test(primary);
  const mechanics = [
    /\b(?:criacao|ficha|fichas) de personagens?\b/.test(text),
    /\b(?:narrador|narradora|mestre (?:do|de) jogo|mestre da mesa)\b/.test(text),
    /\b(?:rolagens? de dados?|roll under|dados? poli[ee]dricos?)\b/.test(text),
  ].filter(Boolean).length;
  if (identifiesRpg && mechanics >= 2) return true;
  const rulebook = normalized(rewards.join(' '));
  return (
    (identifiesRpg || identifiesSupplement) &&
    /\blivro (?:do jogador|de regras|basico|base)\b/.test(rulebook)
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
