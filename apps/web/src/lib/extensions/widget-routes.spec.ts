import { describe, expect, it } from 'vitest';
import { showsWidgets } from './widget-routes';

describe('where widgets may float', () => {
  it('shows on the pages people browse', () => {
    for (const route of ['/', '/t', '/t/[slug]', '/u/tables', '/m/[id]', '/n', '/u/[username]'])
      expect(showsWidgets(route), route).toBe(true);
  });

  it('never over the admin, auth, legal pages, forms or a widget’s own page', () => {
    for (const route of [
      null,
      '/admin',
      '/admin/[ext]',
      '/login',
      '/forgot',
      '/maintenance',
      '/terms',
      '/t/new',
      '/t/[slug]/edit',
      '/t/[slug]/manage',
      '/p/[id]/edit',
      '/cf/new',
      '/u/profile/setup',
      '/u/profile/edit',
      '/[ext]/w/[id]',
    ])
      expect(showsWidgets(route), String(route)).toBe(false);
  });
});
