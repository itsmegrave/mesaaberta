import '../../layout.css';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

vi.mock('$app/state', () => ({
  page: { url: new URL('http://localhost/u/ana'), params: { username: 'ana' } },
}));

const review = (n: number) => ({
  username: `jogadora-${n}`,
  avatarUrl: null,
  score: 5,
  text: `Comentário ${n}`,
  createdAt: new Date('2026-10-01T12:00:00Z'),
  table: { title: `Mesa ${n}`, slug: `mesa-${n}` },
});

const show = (
  links: { network: string; text: string; href: string | null }[],
  name?: string,
  reviews: ReturnType<typeof review>[] = [],
  directoryLinks: {
    hostedAt?: { slug: string; name: string }[];
    looksAfter?: { id: string; name: string }[];
  } = {},
) =>
  render(Page, {
    data: {
      profile: {
        username: 'ana',
        name: name ?? null,
        avatarUrl: null,
        links,
        totals: { played: 0, hosted: 0 },
        rating: { score: null, count: 0, isNew: true },
        hostedAt: directoryLinks.hostedAt ?? [],
        looksAfter: directoryLinks.looksAfter ?? [],
      },
      tables: [],
      reviews,
      page: 1,
      pages: 1,
      total: 0,
      isOwner: false,
      previewing: false,
      canonical: 'http://localhost/u/ana',
    } as never,
  });

describe('public profile social links', () => {
  beforeEach(async () => {
    await page.viewport(390, 800);
  });

  it('shows each network with its icon and the handle beside it, opening the profile', async () => {
    show([
      { network: 'instagram', text: '@ana', href: 'https://instagram.com/ana' },
      { network: 'website', text: 'ana.example', href: 'https://ana.example/' },
    ]);

    const instagram = page.getByRole('link', { name: 'Abrir Instagram em nova aba' });
    await expect.element(instagram).toHaveAttribute('href', 'https://instagram.com/ana');
    await expect.element(instagram).toHaveTextContent('@ana');
    await expect.element(instagram).toHaveAttribute('title', 'Instagram');
    await expect.element(page.getByText('ana.example')).toBeVisible();
  });

  it('shows a Discord handle with the network as a tooltip and no link', async () => {
    show([{ network: 'discord', text: '@ana_rpg', href: null }]);

    await expect.element(page.getByText('@ana_rpg')).toBeVisible();
    await expect.element(page.getByTitle('Discord')).toBeVisible();
    await expect
      .element(page.getByRole('link', { name: 'Abrir Discord em nova aba' }))
      .not.toBeInTheDocument();
  });
});

describe('public profile title', () => {
  it('is the @usuário, with the name under it only when there is one to show', async () => {
    show([], 'Ana Souza');

    await expect.element(page.getByRole('heading', { level: 1 })).toHaveTextContent('@ana');
    await expect.element(page.getByText('Ana Souza')).toBeVisible();
  });

  it('has no name line when the person keeps the name private', async () => {
    show([]);

    await expect.element(page.getByRole('heading', { level: 1 })).toHaveTextContent('@ana');
    await expect.element(page.getByText('Ana Souza')).not.toBeInTheDocument();
  });
});

describe('public profile reviews', () => {
  beforeEach(async () => {
    await page.viewport(1024, 800);
  });

  it('has no section while nobody chose to show a comment', async () => {
    show([]);

    await expect
      .element(page.getByRole('heading', { name: 'Avaliações da mestragem' }))
      .not.toBeInTheDocument();
  });

  it('shows three comments, and the button grows the list in place', async () => {
    show([], undefined, [1, 2, 3, 4, 5].map(review));

    const list = page.getByRole('list', { name: 'Avaliações de @ana' });
    await expect.element(list).toBeVisible();
    expect(list.getByRole('listitem').all()).toHaveLength(3);
    await expect.element(page.getByText('“Comentário 1”')).toBeVisible();
    await expect
      .element(page.getByRole('link', { name: 'Mesa 1' }))
      .toHaveAttribute('href', '/t/mesa-1');
    await expect.element(page.getByRole('link', { name: '@jogadora-1' })).toBeVisible();
    await expect.element(list.getByText('5 de 5').first()).toBeInTheDocument();

    const more = page.getByRole('button', { name: 'Ver todas as 5 avaliações' });
    await expect.element(more).toHaveAttribute('aria-expanded', 'false');
    await more.click();
    await expect.element(page.getByText('“Comentário 5”')).toBeVisible();
    expect(list.getByRole('listitem').all()).toHaveLength(5);
    await expect
      .element(page.getByRole('button', { name: 'Mostrar menos' }))
      .toHaveAttribute('aria-expanded', 'true');
  });

  it('folds the comments on a phone under a header that says how many there are', async () => {
    await page.viewport(390, 800);
    show([], undefined, [1, 2, 3, 4, 5].map(review));

    const toggle = page.getByRole('button', { name: /^Avaliações da mestragem/ });
    await expect.element(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect.element(page.getByText('5 avaliações')).toBeVisible();
    // Hidden content is out of the accessibility tree.
    const list = page.getByRole('list', { name: 'Avaliações de @ana' });
    await expect.element(list).not.toBeInTheDocument();

    await toggle.click();
    await expect.element(page.getByText('“Comentário 1”')).toBeVisible();
    await expect
      .element(page.getByRole('button', { name: 'Ver todas as 5 avaliações' }))
      .toBeVisible();
  });
});

describe('public profile directory links', () => {
  it('says where the person mestra na casa and which partners they look after', async () => {
    show([], undefined, [], {
      hostedAt: [{ slug: 'taverna', name: 'Taverna do Dado' }],
      looksAfter: [{ id: 'p1', name: 'Goblin Games' }],
    });
    await expect.element(page.getByText('Mestra em')).toBeVisible();
    await expect
      .element(page.getByRole('link', { name: 'Taverna do Dado' }))
      .toHaveAttribute('href', '/pp/taverna');
    await expect.element(page.getByText('Cuida de')).toBeVisible();
    await expect
      .element(page.getByRole('link', { name: 'Goblin Games' }))
      .toHaveAttribute('href', '/p/p1');
  });

  it('has neither line when there is nothing to say', async () => {
    show([]);
    await expect.element(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(page.getByText('Mestra em').elements()).toHaveLength(0);
    expect(page.getByText('Cuida de').elements()).toHaveLength(0);
  });
});
