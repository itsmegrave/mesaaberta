import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import type { ChangelogEntry } from '$lib/changelog/entries';
import { load } from './+page.server';

vi.mock('$app/environment', () => ({ dev: false }));

const { entry } = vi.hoisted(() => ({
  entry: (n: number, draft = false): ChangelogEntry => ({
    slug: `entrada-${n}`,
    date: '2026-09-29',
    title: `Entrada ${n}`,
    draft,
    summary: '<p>texto</p>',
    sections: [],
  }),
}));

// Newest first, as the module gives them: a draft on top, then 20 published entries.
vi.mock('$lib/server/changelog', () => ({
  changelog: [entry(0, true), ...Array.from({ length: 20 }, (_, i) => entry(i + 1))],
}));

const event = (search = '', profile: unknown = null) =>
  ({
    url: new URL(`https://mesaaberta.app/changelog${search}`),
    locals: { getProfile: vi.fn().mockResolvedValue(profile) },
  }) as unknown as RequestEvent;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the tests read whatever shape the load returns
const run = (e: RequestEvent) => (load as (e: RequestEvent) => Promise<any>)(e);
const slugs = (data: { entries: ChangelogEntry[] }) => data.entries.map((e) => e.slug);

describe('the changelog page load', () => {
  it('keeps drafts from a visitor', async () => {
    const data = await run(event());
    expect(slugs(data)).not.toContain('entrada-0');
  });

  it('keeps drafts from a signed-in player', async () => {
    const data = await run(event('', { role: 'user', status: 'active' }));
    expect(slugs(data)).not.toContain('entrada-0');
  });

  it('shows drafts to an admin, so an entry can be previewed', async () => {
    const data = await run(event('', { role: 'admin', status: 'active' }));
    expect(slugs(data)[0]).toBe('entrada-0');
  });

  it('keeps drafts hidden when the profile cannot be loaded', async () => {
    const e = event();
    vi.mocked(e.locals.getProfile).mockRejectedValue(new Error('down'));
    expect(slugs(await run(e))).not.toContain('entrada-0');
  });

  it('sends one page of entries per request, not the whole list', async () => {
    const first = await run(event());
    const second = await run(event('?page=2'));

    expect(first).toMatchObject({ page: 1, pages: 2 });
    expect(first.entries).toHaveLength(15);
    expect(slugs(second)).toEqual([
      'entrada-16',
      'entrada-17',
      'entrada-18',
      'entrada-19',
      'entrada-20',
    ]);
  });

  it('answers 404 for a page past the last', async () => {
    await expect(run(event('?page=9'))).rejects.toMatchObject({ status: 404 });
  });
});
