import '../layout.css';
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SignedInHome from './SignedInHome.svelte';

const now = new Date('2026-11-01T12:00:00Z');
const rating = { score: 4.8, count: 12, isNew: false };
const table = (slug: string) => ({
  id: slug,
  slug,
  title: `Mesa ${slug}`,
  kind: 'one_shot',
  description: '',
  extraInfo: null,
  capacity: 4,
  minPlayers: null,
  plannedSessions: null,
  startsAt: new Date('2026-11-05T22:00:00Z'),
  durationMinutes: 180,
  timezone: 'America/Sao_Paulo',
  recurrence: null,
  until: null,
  joinMode: 'auto',
  modality: 'online',
  locationArea: null,
  taken: 1,
  gmName: 'mestre',
  status: 'active',
  publishedAt: new Date('2026-10-31T12:00:00Z'),
  reserved: 0,
  system: { name: 'Tormenta20', slug: 'tormenta20' },
  seatsLeft: 3,
  everyWeeks: null,
  platforms: [],
  tags: [],
  gmRating: rating,
  imageUrl: null,
});

const home = (over: Record<string, unknown> = {}) => ({
  signedInHome: true,
  name: 'Marina',
  username: 'marina',
  now,
  waiting: {
    items: [
      { kind: 'requests', slug: 'torre', title: 'A Torre das Marés', count: 2 },
      { kind: 'confirm', slug: 'neon', title: 'Noites de Neon' },
    ],
    total: 2,
  },
  sessions: {
    next: [
      {
        slug: 'sinos',
        title: 'Os Sinos de Sablewood',
        startsAt: new Date('2026-11-02T18:00:00Z'),
        timezone: 'America/Sao_Paulo',
        running: false,
      },
    ],
    thisWeek: 1,
  },
  account: {
    gm: rating,
    player: { score: null, count: 0, isNew: true },
    unreadRatings: 2,
    newestReview: null,
    latestBadge: null,
    followers: 23,
  },
  feed: [
    {
      kind: 'table',
      username: 'rafael',
      slug: 'torre',
      title: 'A Torre das Marés',
      badgeId: null,
      at: new Date('2026-11-01T09:00:00Z'),
    },
  ],
  rows: { followed: [table('f1')], systems: [table('s1')], fresh: [table('n1')] },
  favoriteSystems: ['tormenta20'],
  showFavoriteSystems: true,
  suggestions: [],
  systemsCatalog: null,
  following: 8,
  newTableDays: 14,
  ...over,
});

const show = (over?: Record<string, unknown>) =>
  render(SignedInHome, { data: home(over) as never });

describe('the signed-in Início', () => {
  it('greets the person and sums up their week, with no landing page', async () => {
    show();

    await expect
      .element(page.getByRole('heading', { level: 1, name: 'Olá, Marina' }))
      .toBeVisible();
    await expect
      .element(page.getByText('Você tem 1 sessão esta semana e 2 coisas esperando você.'))
      .toBeVisible();
    await expect
      .element(page.getByRole('heading', { name: 'Como funciona' }))
      .not.toBeInTheDocument();
  });

  it('lists what waits, the next sessions, the account and the rows in order', async () => {
    show();

    await expect.element(page.getByText('2 pedidos de vaga em A Torre das Marés')).toBeVisible();
    await expect
      .element(page.getByRole('link', { name: 'Confirmar sessão' }))
      .toHaveAttribute('href', '/t/neon/manage');
    await expect.element(page.getByText('Os Sinos de Sablewood')).toBeVisible();
    await expect.element(page.getByText('2 novas avaliações')).toBeVisible();
    await expect
      .element(page.getByText(/23 pessoas seguem você\. Você segue 8 pessoas\./))
      .toBeVisible();
    // De quem você segue is news, so it starts closed with a count in its header.
    const feed = page.getByRole('button', { name: /De quem você segue/ });
    await expect.element(feed).toHaveAttribute('aria-expanded', 'false');
    await expect.element(page.getByText(/^1 novidade · /)).toBeVisible();
    await feed.click();
    await expect.element(page.getByText('@rafael abriu A Torre das Marés')).toBeVisible();

    const headings = page
      .getByRole('heading', { level: 2 })
      .elements()
      .map((h) => h.textContent?.trim());
    expect(headings.slice(-3)).toEqual([
      'Dos seus sistemas',
      'Mesas de quem você segue',
      'Novas mesas',
    ]);
    await expect
      .element(page.getByRole('link', { name: /Todas as mesas desses sistemas/ }))
      .toHaveAttribute('href', '/tables?system=tormenta20');
  });

  it('offers the systems picker and people to follow to someone new', async () => {
    show({
      favoriteSystems: [],
      systemsCatalog: [
        { name: 'Tormenta20', slug: 'tormenta20' },
        { name: 'Daggerheart', slug: 'daggerheart' },
      ],
      rows: { followed: [], systems: [], fresh: [] },
      following: 0,
      suggestions: [{ id: 'p1', username: 'helena', avatarUrl: null, ran: 1, played: 0 }],
      waiting: { items: [], total: 0 },
      sessions: { next: [], thisWeek: 0 },
      feed: [],
    });

    await expect.element(page.getByText('Nada esperando você.')).toBeVisible();
    await expect
      .element(page.getByRole('heading', { name: 'Quais sistemas você joga?' }))
      .toBeVisible();
    await page.getByText('Daggerheart').click();
    await expect.element(page.getByText('1 de 10 escolhidos')).toBeVisible();
    await expect.element(page.getByText('mestrou 1 mesa para você')).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Seguir @helena' })).toBeVisible();
    await expect
      .element(page.getByRole('heading', { name: 'Esperando você' }))
      .not.toBeInTheDocument();
  });

  it('says so when the rows are empty, and drops the follow row when following is off', async () => {
    show({ rows: { followed: null, systems: [], fresh: [] }, following: null });

    await expect
      .element(page.getByText(/Nenhuma mesa dos seus sistemas com vaga agora/))
      .toBeVisible();
    await expect
      .element(page.getByRole('heading', { name: 'Mesas de quem você segue' }))
      .not.toBeInTheDocument();
  });

  it('folds the cards with nothing to do now, their headers saying what they hold', async () => {
    const base = home();
    show({
      sessions: { ...base.sessions, thisWeek: 0 },
      account: { ...base.account, unreadRatings: 0 },
    });

    const sessions = page.getByRole('button', { name: /Suas próximas sessões/ });
    await expect.element(sessions).toHaveAttribute('aria-expanded', 'false');
    await expect.element(page.getByText(/^1 sessão · /)).toBeVisible();
    const account = page.getByRole('button', { name: /Sua conta/ });
    await expect.element(account).toHaveAttribute('aria-expanded', 'false');
    await expect.element(page.getByText(/· Participante estreia$/)).toBeVisible();
    await expect
      .element(page.getByRole('button', { name: /Esperando você/ }))
      .toHaveAttribute('aria-expanded', 'true');
  });
});
