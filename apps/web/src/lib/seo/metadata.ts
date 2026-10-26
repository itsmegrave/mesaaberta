import { m } from '#lib/paraglide/messages.js';
import { toPlainText } from '@mesaaberta/core/text/rich';

const text = (value: string, limit = 160) => {
  const clean = value.replace(/\s+/g, ' ').trim();
  return [...clean].length > limit
    ? `${[...clean]
        .slice(0, limit - 1)
        .join('')
        .trimEnd()}…`
    : clean;
};
const imageUrl = (value: unknown, fallback: string) => {
  try {
    const url = new URL(typeof value === 'string' ? value : '');
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : fallback;
  } catch {
    return fallback;
  }
};
type PublicData = {
  table?: {
    title: string;
    description?: string | null;
    system: { name: string };
    imageUrl?: string | null;
    status?: string;
    [key: string]: unknown;
  };
  system?: {
    name: string;
    [key: string]: unknown;
  };
  facts?: { openTables: number; totalTables: number; gmCount: number };
  post?: { title: string; summary: string };
  profile?: {
    username: string | null;
    bio?: string | null;
    avatarUrl?: string | null;
    [key: string]: unknown;
  };
};
export function publicMetadata(path: string, data: PublicData, origin: string) {
  const fallback = `${origin}/android-chrome-512x512.png`;
  const listings: Record<string, [string, string]> = {
    '/': [m.home_title(), m.home_description()],
    '/tables': [m.seo_tables_title(), m.tables_description()],
    '/partners': [m.seo_partners_title(), m.partner_description()],
    '/crowdfunding': [m.seo_crowdfunding_title(), m.crowdfunding_description()],
    '/systems': [m.seo_systems_title(), m.systems_description()],
    '/changelog': [`${m.changelog_title()} · Mesa Aberta`, m.changelog_description()],
    '/blog': [m.blog_feed_title(), m.blog_description()],
    '/privacy': [`${m.privacy_title()} · Mesa Aberta`, m.privacy_description()],
    '/terms': [`${m.terms_title()} · Mesa Aberta`, m.terms_description()],
  };
  if (listings[path]) {
    const [title, description] = listings[path];
    return { title, description, image: fallback, type: 'website' };
  }
  if (/^\/t\/[^/]+$/.test(path) && data.table) {
    const table = data.table;
    const title = m.seo_table_title({
      title: text(table.title, 100),
      system: text(table.system.name, 60),
    });
    const description = text(
      m.seo_table_description({
        system: text(table.system.name, 60),
        description: toPlainText(table.description ?? ''),
      }),
    );
    return { title, description, image: imageUrl(table.imageUrl, fallback), type: 'website' };
  }
  if (/^\/s\/[^/]+$/.test(path) && data.system && data.facts) {
    const name = text(data.system.name, 60);
    const facts = [
      m.directory_open_tables({ count: data.facts.openTables }),
      m.systems_tables_here({ count: data.facts.totalTables }),
      m.systems_gm_count({ count: data.facts.gmCount }),
    ]
      // Mid-sentence: "nenhuma mesa aberta", never "Nenhuma".
      .map((fact) => fact.charAt(0).toLocaleLowerCase('pt-BR') + fact.slice(1))
      .join(', ');
    return {
      title: m.seo_system_title({ name }),
      description: text(m.seo_system_description({ name, facts })),
      image: fallback,
      type: 'website',
    };
  }
  if (/^\/blog\/[^/]+$/.test(path) && data.post) {
    return {
      title: `${text(data.post.title, 100)} · Mesa Aberta`,
      description: text(data.post.summary),
      image: fallback,
      type: 'article',
    };
  }
  if (/^\/u\/[^/]+$/.test(path) && data.profile?.username) {
    const profile = data.profile;
    return {
      title: m.seo_profile_title({ username: `@${profile.username}` }),
      description: text(
        profile.bio || m.public_profile_description({ username: `@${profile.username}` }),
      ),
      image: imageUrl(profile.avatarUrl, fallback),
      type: 'profile',
    };
  }
  return null;
}
