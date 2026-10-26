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
});
