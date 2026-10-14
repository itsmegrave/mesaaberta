import { describe, expect, it } from 'vitest';
import { routeTemplate } from './api-client';

describe('routeTemplate', () => {
  it('keeps static routes', () => {
    expect(routeTemplate('/v1/account/password/code')).toBe('/v1/account/password/code');
    expect(routeTemplate('/v1/admin/moderation/report.review')).toBe(
      '/v1/admin/moderation/report.review',
    );
  });

  it('hides a table slug and an id', () => {
    expect(routeTemplate('/v1/tables/mesa-do-fulano/join')).toBe('/v1/tables/:param/join');
    expect(routeTemplate('/v1/manage/mesa-do-fulano/publish')).toBe('/v1/manage/:param/publish');
    expect(routeTemplate('/v1/table-writes/mesa-do-fulano/update')).toBe(
      '/v1/table-writes/:param/update',
    );
    expect(routeTemplate('/v1/table-writes')).toBe('/v1/table-writes');
    expect(routeTemplate('/v1/submissions/partners/6f1c2b3e-1a2b-4c3d-8e4f-0a1b2c3d4e5f')).toBe(
      '/v1/submissions/partners/:param',
    );
  });
});
