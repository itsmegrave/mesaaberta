import { describe, expect, it } from 'vitest';
import { indexingPolicy } from './policy';

const origin = 'https://mesaaberta.example';
const policy = (path: string, options = {}) =>
  indexingPolicy(new URL(path, 'https://untrusted.example'), origin, options);

describe('search indexing policy', () => {
  it('uses the configured origin and consolidates ignored and tracking parameters', () => {
    for (const path of ['/t', '/t?page=1', '/t?page=999', '/t?utm_source=community']) {
      expect(policy(path)).toEqual({ canonical: `${origin}/t`, index: true });
    }
    expect(policy('/t/a-public-table?utm_campaign=release').canonical).toBe(
      `${origin}/t/a-public-table`,
    );
  });

  it('normalizes filter order and repeats without indexing internal search states', () => {
    expect(
      policy('/t?tag=terror&system=fate&tag=terror&platform=discord&system=daggerheart'),
    ).toEqual({
      canonical: `${origin}/t?system=daggerheart&system=fate&platform=discord&tag=terror`,
      index: false,
    });
    expect(policy('/t?modality=wrong&modality=online')).toEqual({
      canonical: `${origin}/t`,
      index: true,
    });
    expect(policy('/t?modality=wrong')).toEqual({ canonical: `${origin}/t`, index: true });
    expect(policy('/cf?q=dragons&sort=newest').index).toBe(false);
    expect(policy('/p?q=community').index).toBe(false);
  });

  it('preserves real pagination and removes preview and attribution parameters', () => {
    expect(policy('/u/ana?page=2&as=visitor&utm_source=link')).toEqual({
      canonical: `${origin}/u/ana?page=2`,
      index: true,
    });
    expect(policy('/cf?status=ended&page=2')).toEqual({
      canonical: `${origin}/cf?status=ended&page=2`,
      index: true,
    });
    expect(policy('/cf?status=ended&page=1').canonical).toBe(`${origin}/cf?status=ended`);
    expect(policy('/p?page=2').canonical).toBe(`${origin}/p?page=2`);
    expect(policy('/p?sort=name').index).toBe(false);
    expect(policy('/cf?sort=ending').canonical).toBe(`${origin}/cf`);
    expect(policy('/changelog?page=2').index).toBe(false);
  });

  it('removes ignored crowdfunding page numbers while preserving ended-campaign pagination', () => {
    for (const path of ['/cf?page=2', '/cf?page=999', '/cf?status=running&page=999']) {
      expect(policy(path)).toEqual({ canonical: `${origin}/cf`, index: true });
    }
    expect(policy('/cf?status=ended&page=2')).toEqual({
      canonical: `${origin}/cf?status=ended&page=2`,
      index: true,
    });
    expect(policy('/cf?q=dragons&page=999').canonical).toBe(`${origin}/cf?q=dragons`);
  });

  it('keeps account flows, drafts, maintenance and errors out of search', () => {
    for (const path of [
      '/login',
      '/login?next=%2Fm',
      '/signup',
      '/forgot',
      '/reset',
      '/m',
      '/n',
      '/u/tables',
      '/u/profile/edit',
      '/t/new',
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
});
