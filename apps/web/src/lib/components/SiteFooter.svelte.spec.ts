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

const site = { CONTACT_EMAIL: 'oi@example.test', INSTAGRAM_HANDLE: 'mesa.example' };

beforeEach(() => {
  location.pathname = '/';
});

describe('SiteFooter.svelte', () => {
  it('links the pages, the contact address and the credits', async () => {
    render(SiteFooter, { site });

    const footer = browserPage.getByRole('contentinfo');
    await expect.element(footer.getByRole('link', { name: 'Mesas' })).toHaveAttribute('href', '/t');
    await expect
      .element(footer.getByRole('link', { name: 'Parceiros' }))
      .toHaveAttribute('href', '/p');
    await expect
      .element(footer.getByRole('link', { name: 'Financiamentos coletivos' }))
      .toHaveAttribute('href', '/cf');
    await expect
      .element(footer.getByRole('link', { name: 'oi@example.test' }))
      .toHaveAttribute('href', 'mailto:oi@example.test');
    await expect
      .element(footer.getByRole('link', { name: 'Instagram da Mesa Aberta, @mesa.example' }))
      .toHaveAttribute('href', 'https://www.instagram.com/mesa.example/');
    await expect.element(footer.getByRole('link', { name: 'itsmegrave' })).toBeVisible();
  });

  it('marks the page you are on', async () => {
    location.pathname = '/cf/new';
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
});
