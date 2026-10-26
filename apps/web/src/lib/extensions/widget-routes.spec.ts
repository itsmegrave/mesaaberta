import { describe, expect, it } from 'vitest';
import { placementRoute, showsWidgets } from './widget-routes';

describe('placementRoute', () => {
  it('drops the layout groups from a route id', () => {
    expect(placementRoute('/(tables)/t/[slug]')).toBe('/t/[slug]');
    expect(placementRoute('/(messages)/messages')).toBe('/messages');
    expect(placementRoute('/u/tables')).toBe('/u/tables');
    expect(placementRoute(null)).toBeNull();
  });
});

describe('where widgets may float', () => {
  it('shows on the pages people browse', () => {
    for (const route of [
      '/',
      '/tables',
      '/t/[slug]',
      '/u/tables',
      '/m/[id]',
      '/notifications',
      '/u/[username]',
    ])
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
      '/tables/new',
      '/t/[slug]/edit',
      '/t/[slug]/manage',
      '/p/[id]/edit',
      '/crowdfunding/new',
      '/u/profile/setup',
      '/u/profile/edit',
      '/[ext]/w/[id]',
    ])
      expect(showsWidgets(route), String(route)).toBe(false);
  });
});
