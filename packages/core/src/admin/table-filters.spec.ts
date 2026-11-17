import { expect, it } from 'vitest';
import { tableFilters } from './table-filters';

const post = (query: string) => tableFilters(new URLSearchParams(query)).post;

it('reads the post filter, and the old `instagram` name from saved links', () => {
  expect(post('')).toBe('all');
  expect(post('post=uncertain')).toBe('uncertain');
  expect(post('instagram=failed')).toBe('failed');
  expect(post('post=queued&instagram=failed')).toBe('queued');
  expect(post('post=nope')).toBe('all');
});
