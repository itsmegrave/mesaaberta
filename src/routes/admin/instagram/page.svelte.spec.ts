import '../../layout.css';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

const future = new Date(Date.now() + 30 * 24 * 3600 * 1000);
const past = new Date(Date.now() - 24 * 3600 * 1000);

const show = (over: Record<string, unknown> = {}) =>
  render(Page, {
    data: {
      account: null,
      configured: true,
      connected: false,
      connectionError: false,
      uncertain: [],
      ...over,
    } as never,
  });

describe('admin connections (Instagram)', () => {
  beforeEach(async () => {
    await page.viewport(1280, 900);
  });

  it('is the Conexões page, with the Instagram connection as its own area under the Instagram icon', async () => {
    show();

    await expect.element(page.getByRole('heading', { level: 1, name: 'Conexões' })).toBeVisible();
    const area = page.getByRole('region', { name: 'Instagram da Mesa Aberta' });
    await expect.element(area).toBeVisible();
    expect(area.element().querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });

  it('links to the public profile, @mesaaberta.app', async () => {
    show();

    await expect
      .element(page.getByRole('link', { name: '@mesaaberta.app' }))
      .toHaveAttribute('href', 'https://www.instagram.com/mesaaberta.app/');
  });

  it('says it is not connected, and offers to connect', async () => {
    show();

    await expect.element(page.getByText('Não conectado')).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Conectar Instagram' })).toBeEnabled();
  });

  it('says it is connected, with the account, and offers nothing to connect', async () => {
    show({ account: { username: 'mesaaberta.app', expiresAt: future } });

    await expect.element(page.getByText('Conectado', { exact: true })).toBeVisible();
    await expect.element(page.getByText(/mesaaberta\.app/).first()).toBeVisible();
    await expect
      .element(page.getByRole('button', { name: 'Conectar Instagram' }))
      .not.toBeInTheDocument();
  });

  it('says the connection expired, and offers to reconnect', async () => {
    show({ account: { username: 'mesaaberta.app', expiresAt: past } });

    await expect.element(page.getByText('Conexão expirada')).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Conectar Instagram' })).toBeEnabled();
  });
});
