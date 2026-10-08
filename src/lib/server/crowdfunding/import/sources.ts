import { todayIn } from '../../../crowdfunding/phase';
import { readMeta, attributesOf, decodeEntities } from '../link-preview';
import { isTabletopRpg, sourceUrlAllowed, validateCandidate } from './candidate';
import { findObject, object, readFlight } from './flight';
import type { Listing, SourceAdapter, SourceCandidate } from './types';
const plain = (html: string) =>
  decodeEntities(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
function* tags(html: string, name: string) {
  const lower = html.toLowerCase();
  let pos = 0;
  while (pos < html.length) {
    const p = lower.indexOf('<' + name, pos);
    if (p === -1) return;
    const end = lower.indexOf('>', p);
    if (end === -1) return;
    pos = end + 1;
    if (!/[\s/>]/.test(lower[p + name.length + 1] ?? '')) continue;
    if (end - p > 8000) continue;
    yield { attrs: attributesOf(html.slice(p + name.length + 1, end)), start: p, end };
  }
}
function element(html: string, name: string, className?: string): string | null {
  for (const t of tags(html, name)) {
    if (className && !(t.attrs.get('class') ?? '').split(/\s+/).includes(className)) continue;
    const lower = html.toLowerCase();
    let depth = 1,
      pos = t.end + 1;
    while (pos < lower.length) {
      const start = lower.indexOf('<', pos);
      if (start === -1) break;
      const end = lower.indexOf('>', start);
      if (end === -1) break;
      const tag = lower.slice(start + 1, end).trim();
      if (tag === '/' + name) depth--;
      else if (tag === name || tag.startsWith(name + ' ')) depth++;
      if (depth === 0) return html.slice(t.end + 1, start);
      pos = end + 1;
    }
  }
  return null;
}
export function parseCatarseListing(html: string, page: number): Listing {
  const data = findObject(
    readFlight(html).values(),
    (o) => Array.isArray(o.projects) && Number.isInteger(o.totalCount) && Number.isInteger(o.limit),
  );
  if (!data || (data.limit as number) < 1 || (data.totalCount as number) < 0)
    throw new Error('source_schema');
  const urls = (data.projects as unknown[])
    .map((p) => object(p)?.slug)
    .map((slug) => {
      if (typeof slug !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(slug))
        throw new Error('source_schema');
      return `https://www.catarse.com.br/${slug}`;
    });
  if (!urls.length && (page - 1) * (data.limit as number) < (data.totalCount as number))
    throw new Error('source_schema');
  return {
    urls,
    nextPage: page * (data.limit as number) < (data.totalCount as number) ? page + 1 : null,
  };
}
export function parseCatarseCampaign(html: string, url: string, now: Date): SourceCandidate | null {
  const flight = readFlight(html);
  const p = findObject(
    flight.values(),
    (o) =>
      typeof o.id === 'string' &&
      typeof o.slug === 'string' &&
      'startDate' in o &&
      'fundingType' in o,
  );
  if (!p) throw new Error('source_schema');
  if (
    !sourceUrlAllowed(url, 'catarse') ||
    !['Launch', 'PreLaunch'].includes(String(p.status)) ||
    !['All or Nothing', 'Flex'].includes(String(p.fundingType))
  )
    return null;
  const resolve = (v: unknown): unknown =>
    typeof v === 'string' && /^\$[a-f0-9]+$/.test(v) ? flight.get(v.slice(1)) : v;
  const story = resolve(p.story);
  const evidence = [p.title, p.summary, typeof story === 'string' ? plain(story) : ''].join(' ');
  if (!isTabletopRpg(evidence)) return null;
  const start = typeof p.startDate === 'string' ? new Date(p.startDate) : null,
    end = typeof p.endDate === 'string' ? new Date(p.endDate) : null;
  if (!start || !end || !Number.isFinite(+start) || !Number.isFinite(+end) || +end < +now)
    return null;
  const user = object(resolve(p.user));
  return validateCandidate(
    {
      source: 'catarse',
      externalId: String(p.id),
      url: `https://catarse.com.br/${p.slug}`,
      name: String(p.title ?? ''),
      owner: String(user?.publicName ?? ''),
      startsOn: todayIn(start),
      endsOn: todayIn(end),
      imageUrl: typeof p.thumbnail === 'string' ? p.thumbnail : null,
    },
    now,
  );
}
export function parseMeepleListing(html: string): Listing {
  if (!html.includes('class="project all"')) throw new Error('source_schema');
  const urls = [];
  for (const t of tags(html, 'a')) {
    if (!(t.attrs.get('class') ?? '').split(/\s+/).includes('projeto-titulo')) continue;
    const url = t.attrs.get('href');
    if (!url || !sourceUrlAllowed(url, 'meeplestarter')) throw new Error('source_schema');
    urls.push(url);
  }
  // This verified category includes archived campaigns; an empty selector result is a schema
  // failure until a real explicit empty-state contract is observed, never a silent success.
  if (urls.length === 0) throw new Error('source_schema');
  // Verified listing renders the entire category, with no page links or lazy loading.
  return { urls: [...new Set(urls)], nextPage: null };
}
export function parseMeepleCampaign(html: string, url: string, now: Date): SourceCandidate | null {
  const project = [...tags(html, 'div')].find((t) => t.attrs.has('data-main_project_id'));
  if (!project) throw new Error('source_schema');
  const title = element(html, 'h1'),
    summary = element(html, 'h2'),
    period = element(html, 'p', 'project-ending');
  if (!title || !sourceUrlAllowed(url, 'meeplestarter')) throw new Error('source_schema');
  const narrative = element(html, 'div', 'content-main') ?? '';
  if (!period || !isTabletopRpg(plain(title + ' ' + (summary ?? '') + ' ' + narrative)))
    return null;
  const dates = plain(period).match(
    /publicado em (\d{2})\/(\d{2})\/(\d{4})\s*e a campanha termina em (\d{2})\/(\d{2})\/(\d{4})/i,
  );
  if (!dates) return null;
  // Both current project templates declare the creator next to the project heading.
  const heading = element(html, 'div', 'project-titles') ?? '';
  const ownerText = element(heading, 'p') ?? element(html, 'p', 'project-author') ?? '';
  const owner = plain(ownerText)
    .replace(/^Por\s+/i, '')
    .trim();
  return validateCandidate(
    {
      source: 'meeplestarter',
      externalId: project.attrs.get('data-main_project_id')!,
      url: url.replace('mail.meeplestarter.com.br', 'meeplestarter.com.br'),
      name: plain(title),
      owner,
      startsOn: `${dates[3]}-${dates[2]}-${dates[1]}`,
      endsOn: `${dates[6]}-${dates[5]}-${dates[4]}`,
      imageUrl: readMeta(html, new URL(url)).imageUrl,
    },
    now,
  );
}
export const sourceAdapters: readonly SourceAdapter[] = [
  {
    source: 'catarse',
    list: async (page, read) =>
      parseCatarseListing(
        await read(`https://www.catarse.com.br/discovery?category=2&filterBy=recent&page=${page}`),
        page,
      ),
    detail: async (url, now, read) => parseCatarseCampaign(await read(url), url, now),
  },
  {
    source: 'meeplestarter',
    list: async (_page, read) =>
      parseMeepleListing(await read('https://mail.meeplestarter.com.br/projetos/categoria/rpg/6')),
    detail: async (url, now, read) => parseMeepleCampaign(await read(url), url, now),
  },
];
