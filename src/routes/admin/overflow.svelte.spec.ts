import '../layout.css';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Tables from './tables/+page.svelte';
import Users from './users/+page.svelte';
import Reports from './reports/+page.svelte';
import Catalog from './catalog/+page.svelte';
import Overview from './+page.svelte';

const location = vi.hoisted(() => ({ path: '/admin' }));
vi.mock('$app/navigation', () => ({ goto: vi.fn(), invalidateAll: vi.fn() }));
vi.mock('$app/state', () => ({
  navigating: { to: null },
  page: {
    get url() {
      return new URL(`http://localhost${location.path}`);
    },
    route: { id: '/admin' },
    data: {
      viewer: { timezone: 'America/Sao_Paulo' },
      adminCounts: { reports: 3, queue: 2, connections: 1, events: 0, partners: 0 },
    },
  },
}));
vi.mock('$lib/query/page.svelte', () => ({
  pageQuery: (read: () => unknown) => ({
    get data() {
      return read();
    },
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

const long = 'Uma mesa com um título realmente muito longo para testar a quebra de linha na tela';
// Where an element's box really ends on the right: an ancestor that clips (a truncated line, a
// scroller) cuts it, but <body> does not count, since clipping the whole page is what hides the bug.
function right(element: HTMLElement) {
  let edge = element.getBoundingClientRect().right;
  for (let up = element.parentElement; up && up !== document.body; up = up.parentElement) {
    if (getComputedStyle(up).overflowX !== 'visible') {
      edge = Math.min(edge, up.getBoundingClientRect().right);
    }
  }
  return edge;
}
const wide = () =>
  [...document.querySelectorAll<HTMLElement>('body *')].filter(
    (element) => right(element) > window.innerWidth,
  );
// How far anything sticks out on the right. Measured on every element, not the document's scroll
// width: the app clips sideways overflow (body and the content column), so in Chromium a too-wide
// list does not scroll, it is cut off, and iOS Safari lays the whole page out wider instead.
const sideways = () =>
  Math.max(0, ...[...document.querySelectorAll<HTMLElement>('body *')].map(right)) -
  window.innerWidth;
const culprits = () =>
  wide()
    .slice(0, 6)
    .map((element) => `${element.tagName.toLowerCase()}.${String(element.className).slice(0, 60)}`)
    .join(' | ');

describe('admin pages on a phone', () => {
  beforeEach(async () => {
    await page.viewport(390, 844);
  });

  it('Mesas does not scroll sideways', async () => {
    render(Tables, {
      data: {
        instagramAvailable: true,
        tables: {
          rows: [
            {
              id: '1',
              slug: 'a',
              title: long,
              status: 'awaiting_confirmation',
              system: 'Dungeons & Dragons 5ª edição',
              gm: 'um_mestre_com_nome_longo',
              gmId: 'g',
              cover: null,
              capacity: 5,
              seats: 3,
              startsAt: new Date('2026-10-10T22:00:00Z'),
              timezone: 'America/Sao_Paulo',
              instagramStatus: 'uncertain',
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
          query: '',
          status: 'all',
          instagram: 'all',
          sort: { id: 'created', dir: 'desc' },
          counts: {
            all: 1,
            active: 0,
            disabled: 0,
            awaiting_confirmation: 1,
            concluded: 0,
            not_held: 0,
          },
        },
      } as never,
    });
    await expect.element(page.getByRole('link', { name: long })).toBeVisible();
    expect(sideways(), culprits()).toBeLessThanOrEqual(0);
  });

  it('Usuários does not scroll sideways', async () => {
    render(Users, {
      data: {
        profiles: {
          rows: [
            {
              id: '1',
              username: 'um_usuario_com_nome_bem_longo_mesmo',
              name: 'Nome Completo Muito Muito Comprido Da Pessoa',
              avatar: null,
              createdAt: new Date('2026-01-01'),
              standing: 'active',
              playing: 2,
              running: 1,
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
          query: '',
          status: 'all',
          sort: { id: 'joined', dir: 'desc' },
          counts: { all: 1, active: 1, suspended: 0, banned: 0 },
        },
      } as never,
    });
    await expect.element(page.getByRole('link', { name: /um_usuario/ }).last()).toBeVisible();
    expect(sideways(), culprits()).toBeLessThanOrEqual(0);
  });

  it('Denúncias does not scroll sideways', async () => {
    render(Reports, {
      data: {
        reports: {
          rows: [
            {
              id: '1',
              targetType: 'table',
              reason: 'harassment',
              status: 'open',
              createdAt: new Date('2026-10-01T12:00:00Z'),
              table: long,
              gm: 'mestre',
              player: null,
              reporter: 'denunciante_com_nome_longo',
            },
          ],
          total: 1,
          page: 1,
          pages: 1,
          pageSize: 20,
          status: 'waiting',
          target: 'all',
          sort: { id: 'filed', dir: 'desc' },
          counts: { all: 1, waiting: 1, resolved: 0, dismissed: 0 },
        },
      } as never,
    });
    await expect.element(page.getByRole('link').first()).toBeVisible();
    expect(sideways(), culprits()).toBeLessThanOrEqual(0);
  });

  it('Catálogo does not scroll sideways', async () => {
    render(Catalog, {
      data: {
        kind: 'platform',
        query: '',
        status: 'all',
        sort: null,
        rows: [
          {
            id: '1',
            name: 'Uma plataforma com nome comprido demais',
            slug: 'uma-plataforma-com-nome-comprido-demais',
            status: 'approved',
            suggestedBy: 'alguem_com_nome_longo',
            uses: 3,
          },
        ],
        total: 1,
        page: 1,
        pages: 1,
        pageSize: 20,
        counts: { all: 1, active: 1, disabled: 0 },
        approved: [],
      } as never,
    });
    await expect
      .element(page.getByText('Uma plataforma com nome comprido demais').last())
      .toBeVisible();
    expect(sideways(), culprits()).toBeLessThanOrEqual(0);
  });

  it('Visão geral does not scroll sideways', async () => {
    render(Overview, {
      data: {
        people: { total: 26, active: 20, suspended: 4, banned: 2, new30d: 3 },
        tables: {
          total: 8,
          active: 5,
          disabled: 1,
          awaiting: 1,
          concluded: 1,
          notHeld: 0,
          online: 6,
          inPerson: 2,
          gms: 3,
        },
        seats: { confirmed: 12, pending: 0 },
        queue: { pending: 1, failed: 0 },
        suggestions: { platforms: 1, tags: 2 },
        attention: {
          reports: { oldestAt: new Date('2026-10-01T12:00:00Z') },
          posts: { count: 1, first: long },
          awaiting: {
            count: 1,
            first: { title: long, startsAt: new Date('2026-10-10T22:00:00Z'), timezone: 'UTC' },
          },
          suggestions: { platforms: 1, tags: 2, duplicates: 1 },
        },
        recent: [
          {
            id: 't',
            slug: 's',
            title: long,
            status: 'active',
            system: 'Dungeons & Dragons 5ª edição',
            gm: 'um_mestre_com_nome_longo',
            gmId: 'g',
            cover: null,
            startsAt: new Date('2026-10-10T22:00:00Z'),
            timezone: 'America/Sao_Paulo',
          },
        ],
        adminCounts: { reports: 3, queue: 2, connections: 1, events: 0, partners: 0 },
        updatedAt: new Date('2026-10-02T12:00:00Z'),
        viewer: { timezone: 'America/Sao_Paulo' },
      } as never,
    });
    await expect.element(page.getByText('Precisa de você')).toBeVisible();
    expect(sideways(), culprits()).toBeLessThanOrEqual(0);
  });
});
