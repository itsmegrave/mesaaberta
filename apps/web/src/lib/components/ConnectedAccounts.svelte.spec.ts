import '../../routes/layout.css';
import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import ConnectedAccounts from './ConnectedAccounts.svelte';

vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/account/profile') } }));

const show = (over = {}) =>
  render(ConnectedAccounts, {
    connections: {
      providers: [
        { provider: 'google', connected: true },
        { provider: 'discord', connected: false },
      ],
      email: false,
      total: 1,
      ...over,
    },
  });

describe('ConnectedAccounts.svelte', () => {
  it('shows each provider with its state and a way to connect the ones that are not', async () => {
    show();

    await expect.element(page.getByText('Conectado', { exact: true })).toBeVisible();
    await expect.element(page.getByText('Não conectado')).toBeVisible();
    await expect
      .element(page.getByRole('link', { name: 'Conectar Discord' }))
      .toHaveAttribute('href', '/account/connect/discord');
  });

  it('offers no way to disconnect the only way to sign in, and says why', async () => {
    show();

    await expect
      .element(page.getByRole('button', { name: 'Desconectar Google' }))
      .not.toBeInTheDocument();
    await expect.element(page.getByText(/única forma de entrar/)).toBeVisible();
  });

  it('offers to disconnect once there is another way to sign in', async () => {
    show({
      providers: [
        { provider: 'google', connected: true },
        { provider: 'discord', connected: true },
      ],
      total: 2,
    });

    await expect.element(page.getByRole('button', { name: 'Desconectar Google' })).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Desconectar Discord' })).toBeVisible();
  });

  it('lists email and password as a way to sign in', async () => {
    show({ email: true, total: 2 });

    await expect.element(page.getByText('Email e senha')).toBeVisible();
  });
});
