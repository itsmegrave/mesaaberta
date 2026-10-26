import { render } from 'vitest-browser-svelte';
import { page as browserPage } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SiteFooter from './SiteFooter.svelte';

const location = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('$app/state', () => ({
  page: {
    get url() {
      return new URL(`http://localhost${location.pathname}`);
    },
  },
}));

const notes = vi.hoisted(() => [] as { text: string; link?: { label: string; href: string } }[]);
vi.mock('#lib/extensions/panels.js', () => ({ footerNotes: notes }));

const site = { CONTACT_EMAIL: 'oi@example.test', INSTAGRAM_HANDLE: 'mesa.example' };

beforeEach(() => {
  location.pathname = '/';
  notes.length = 0;
});

describe('SiteFooter.svelte', () => {
  it('links the pages, the contact address and the credits', async () => {
    render(SiteFooter, { site });

    const footer = browserPage.getByRole('contentinfo');
    await expect
      .element(footer.getByRole('link', { name: 'Mesas' }))
      .toHaveAttribute('href', '/tables');
    await expect
      .element(footer.getByRole('link', { name: 'Parceiros' }))
      .toHaveAttribute('href', '/partners');
    await expect
      .element(footer.getByRole('link', { name: 'Financiamentos coletivos' }))
      .toHaveAttribute('href', '/crowdfunding');
    await expect
      .element(footer.getByRole('link', { name: 'oi@example.test' }))
      .toHaveAttribute('href', 'mailto:oi@example.test');
    await expect
      .element(footer.getByRole('link', { name: 'Instagram da Mesa Aberta, @mesa.example' }))
      .toHaveAttribute('href', 'https://www.instagram.com/mesa.example/');
    await expect.element(footer.getByRole('link', { name: 'itsmegrave' })).toBeVisible();
  });

  it('marks the page you are on', async () => {
    location.pathname = '/crowdfunding/new';
    render(SiteFooter, { site });

    await expect
      .element(browserPage.getByRole('link', { name: 'Financiamentos coletivos' }))
      .toHaveAttribute('aria-current', 'page');
    await expect
      .element(browserPage.getByRole('link', { name: 'Mesas' }))
      .not.toHaveAttribute('aria-current');
  });

  it('leaves Instagram out when the deployment has no handle', async () => {
    render(SiteFooter, { site: { CONTACT_EMAIL: 'oi@example.test' } });

    await expect
      .element(browserPage.getByRole('link', { name: /Instagram/ }))
      .not.toBeInTheDocument();
  });

  it('adds the notes a private build declares after the community sentence', async () => {
    notes.push({
      text: 'Conheça a',
      link: { label: 'Taverna', href: 'https://example.test/taverna' },
    });
    render(SiteFooter, { site });

    await expect.element(browserPage.getByText(/comunidade\. Conheça a/)).toBeVisible();
    await expect
      .element(browserPage.getByRole('link', { name: 'Taverna' }))
      .toHaveAttribute('href', 'https://example.test/taverna');
  });

  it('names no one else in the public build', async () => {
    render(SiteFooter, { site });

    await expect
      .element(browserPage.getByText('Feito pela comunidade, para a comunidade.'))
      .toBeVisible();
    await expect
      .element(browserPage.getByRole('link', { name: 'Lenindragons' }))
      .not.toBeInTheDocument();
  });

  it('lists each directory that is on under "Páginas", after the other pages', async () => {
    render(SiteFooter, { site });
    await expect
      .element(browserPage.getByRole('link', { name: 'Sistemas' }))
      .not.toBeInTheDocument();

    location.pathname = '/s/tormenta-20';
    render(SiteFooter, { site, directories: { systems: true, gms: true } });
    const heading = browserPage.getByRole('heading', { name: 'Páginas' }).last().element();
    const names = [...heading.parentElement!.querySelectorAll('a')].map((link) =>
      link.textContent?.trim(),
    );
    expect(names).toEqual([
      'Mesas',
      'Parceiros',
      'Financiamentos coletivos',
      'Sistemas',
      'Quem mestra',
    ]);
    // A system's page is part of the systems directory.
    await expect
      .element(browserPage.getByRole('link', { name: 'Sistemas' }).last())
      .toHaveAttribute('aria-current', 'page');
    await expect
      .element(browserPage.getByRole('link', { name: 'Quem mestra' }))
      .toHaveAttribute('href', '/gamemasters');
  });
});
