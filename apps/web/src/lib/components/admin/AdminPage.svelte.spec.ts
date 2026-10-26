import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AdminPage from './AdminPage.svelte';

vi.mock('$app/state', () => ({
  page: {
    url: new URL('http://localhost/admin/tables'),
    route: { id: '/admin/tables' },
    data: {
      adminCounts: {
        reports: 0,
        queue: 0,
        connections: 0,
        events: 0,
        partners: 0,
        places: 0,
        hiddenPlaces: 0,
      },
    },
  },
}));

describe('AdminPage', () => {
  it('names the browser tab after the page', async () => {
    render(AdminPage, { title: 'Mesas' });

    await vi.waitFor(() => expect(document.title).toBe('Mesas | Mesa Aberta'));
  });

  it('takes the tab title a detail page gives instead', async () => {
    render(AdminPage, { title: 'Os Sinos', tabTitle: 'Denúncia | Mesa Aberta' });

    await vi.waitFor(() => expect(document.title).toBe('Denúncia | Mesa Aberta'));
  });
});
