import { describe, expect, it } from 'vitest';
import { indexingPolicy } from './policy';

const origin = 'https://mesaaberta.example';
const policy = (path: string, options = {}) =>
  indexingPolicy(new URL(path, 'https://untrusted.example'), origin, options);

describe('search indexing policy', () => {
  it('uses the configured origin and consolidates ignored and tracking parameters', () => {
    for (const path of [
      '/tables',
      '/tables?page=1',
      '/tables?page=999',
      '/tables?utm_source=community',
    ]) {
      expect(policy(path)).toEqual({ canonical: `${origin}/tables`, index: true });
    }
    expect(policy('/t/a-public-table?utm_campaign=release').canonical).toBe(
      `${origin}/t/a-public-table`,
    );
  });

  it('normalizes filter order and repeats without indexing internal search states', () => {
    expect(
      policy('/tables?tag=terror&system=fate&tag=terror&platform=discord&system=daggerheart'),
    ).toEqual({
      canonical: `${origin}/tables?system=daggerheart&system=fate&platform=discord&tag=terror`,
      index: false,
    });
    expect(policy('/tables?modality=wrong&modality=online')).toEqual({
      canonical: `${origin}/tables`,
      index: true,
    });
    expect(policy('/tables?modality=wrong')).toEqual({
      canonical: `${origin}/tables`,
      index: true,
    });
    expect(policy('/crowdfunding?q=dragons&sort=newest').index).toBe(false);
    expect(policy('/partners?q=community').index).toBe(false);
  });

  it('preserves real pagination and removes preview and attribution parameters', () => {
    expect(policy('/u/ana?page=2&as=visitor&utm_source=link')).toEqual({
      canonical: `${origin}/u/ana?page=2`,
      index: true,
    });
    expect(policy('/crowdfunding?status=ended&page=2')).toEqual({
      canonical: `${origin}/crowdfunding?status=ended&page=2`,
      index: true,
    });
    expect(policy('/crowdfunding?status=ended&page=1').canonical).toBe(
      `${origin}/crowdfunding?status=ended`,
    );
    expect(policy('/partners?page=2').canonical).toBe(`${origin}/partners?page=2`);
    expect(policy('/partners?sort=name').index).toBe(false);
    expect(policy('/crowdfunding?sort=ending').canonical).toBe(`${origin}/crowdfunding`);
    expect(policy('/changelog?page=2').index).toBe(false);
    expect(policy('/blog?page=2')).toEqual({ canonical: `${origin}/blog?page=2`, index: false });
    expect(policy('/blog/por-que-um-blog?utm_source=x')).toEqual({
      canonical: `${origin}/blog/por-que-um-blog`,
      index: true,
    });
    expect(policy('/blog/rascunho', { draft: true }).index).toBe(false);
    expect(policy('/blog/rss.xml').canonical).toBeNull();
  });

  it('removes ignored crowdfunding page numbers while preserving ended-campaign pagination', () => {
    for (const path of [
      '/crowdfunding?page=2',
      '/crowdfunding?page=999',
      '/crowdfunding?status=running&page=999',
    ]) {
      expect(policy(path)).toEqual({ canonical: `${origin}/crowdfunding`, index: true });
    }
    expect(policy('/crowdfunding?status=ended&page=2')).toEqual({
      canonical: `${origin}/crowdfunding?status=ended&page=2`,
      index: true,
    });
    expect(policy('/crowdfunding?q=dragons&page=999').canonical).toBe(
      `${origin}/crowdfunding?q=dragons`,
    );
  });

  it('keeps account flows, drafts, maintenance and errors out of search', () => {
    for (const path of [
      '/login',
      '/login?next=%2Fmessages',
      '/signup',
      '/forgot',
      '/reset',
      '/messages',
      '/notifications',
      '/u/tables',
      '/u/profile/edit',
      '/tables/new',
      '/admin',
      '/unknown',
    ]) {
      expect(policy(path)).toEqual({ canonical: null, index: false });
    }
    expect(policy('/t/draft', { draft: true }).index).toBe(false);
    expect(policy('/t/missing', { status: 404 })).toEqual({ canonical: null, index: false });
    expect(policy('/', { maintenance: true }).index).toBe(false);
    expect(policy('/u/ana').index).toBe(true);
  });

  it('indexes Quem mestra and its pages, but not a filtered or reordered list', () => {
    expect(policy('/gamemasters?page=2&utm_source=x')).toEqual({
      canonical: `${origin}/gamemasters?page=2`,
      index: true,
    });
    for (const query of ['q=ana', 'system=dnd', 'modality=online', 'open=1', 'sort=score'])
      expect(policy(`/gamemasters?${query}`).index).toBe(false);
  });

  it('indexes Onde jogar, its places and its pages, but not a filtered list or the new place form', () => {
    expect(policy('/places?page=2&utm_source=x')).toEqual({
      canonical: `${origin}/places?page=2`,
      index: true,
    });
    for (const query of [
      'q=taverna',
      'state=pe',
      'city=pe-recife',
      'kind=bar',
      'amenity=accessible',
      'sort=name',
    ])
      expect(policy(`/places?${query}`).index).toBe(false);
    expect(policy('/pp/taverna-do-dado')).toEqual({
      canonical: `${origin}/pp/taverna-do-dado`,
      index: true,
    });
    expect(policy('/pp/taverna-do-dado', { draft: true }).index).toBe(false);
    expect(policy('/pp/new')).toEqual({ canonical: null, index: false });
  });

  it('indexes the systems directory and its pages, keeping the list and page but not the order', () => {
    expect(policy('/systems?page=1&utm_source=x')).toEqual({
      canonical: `${origin}/systems`,
      index: true,
    });
    expect(policy('/systems?show=all&page=3')).toEqual({
      canonical: `${origin}/systems?show=all&page=3`,
      index: true,
    });
    expect(policy('/systems?sort=az').index).toBe(false);
    expect(policy('/systems?q=cthulhu').index).toBe(false);
    expect(policy('/s/tormenta-20?ref=x')).toEqual({
      canonical: `${origin}/s/tormenta-20`,
      index: true,
    });
    expect(policy('/s/tormenta-20', { status: 404 }).index).toBe(false);
  });
});
