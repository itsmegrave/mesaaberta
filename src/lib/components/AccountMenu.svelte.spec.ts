import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import AccountMenu from './AccountMenu.svelte';

describe('AccountMenu.svelte', () => {
  const trigger = (name = 'Marina Alves') =>
    page.getByRole('button', { name: new RegExp(name, 'i') });
  const menu = () => page.getByRole('navigation', { name: 'Menu da conta' });

  it('renders trigger with user name and aria-label', async () => {
    render(AccountMenu, { name: 'Marina Alves', avatarUrl: null });

    await expect.element(trigger()).toBeVisible();
    await expect.element(menu()).not.toBeInTheDocument();
  });

  it('opens beside the side navigation when compact', async () => {
    render(AccountMenu, {
      name: 'Marina Alves',
      avatarUrl: null,
      placement: 'right-end',
      compact: true,
    });

    await trigger().click();

    await expect.element(menu()).toBeVisible();
  });

  it('opens the popover on click and shows navigation without repeating user details', async () => {
    render(AccountMenu, { name: 'Marina Alves', avatarUrl: null });

    await trigger().click();

    await expect.element(menu()).toBeVisible();
    await expect.element(page.getByTestId('account-user-name')).not.toBeInTheDocument();
    await expect
      .element(menu().getByRole('link', { name: 'Editar perfil' }))
      .not.toBeInTheDocument();
    await expect
      .element(menu().getByRole('link', { name: 'Minhas mesas' }))
      .not.toBeInTheDocument();
    await expect.element(menu().getByRole('button', { name: 'Sair' })).toBeVisible();
  });

  it('links to the messages, with how many conversations have something unread', async () => {
    render(AccountMenu, { name: 'Marina Alves', avatarUrl: null, messagesUnread: 3 });

    await trigger().click();

    const link = menu().getByRole('link', { name: 'Mensagens, 3 não lidas' });
    await expect.element(link).toHaveAttribute('href', '/messages');
    await expect.element(page.getByTestId('messages-count')).toHaveTextContent('3');
  });

  it('does not duplicate the Admin link in the profile menu', async () => {
    render(AccountMenu, {
      name: 'Admin User',
      avatarUrl: null,
    });

    await trigger('Admin User').click();

    await expect.element(menu().getByRole('link', { name: /Admin/i })).not.toBeInTheDocument();
  });

  it('links "Ver meu perfil" to the public page, without an @ in the address', async () => {
    render(AccountMenu, { name: 'Marina Alves', username: 'marina', avatarUrl: null });

    await trigger().click();

    await expect
      .element(menu().getByRole('link', { name: 'Ver meu perfil' }))
      .toHaveAttribute('href', '/u/marina');
  });

  it('has no public profile to show before a username is chosen', async () => {
    render(AccountMenu, { name: 'Marina Alves', avatarUrl: null });

    await trigger().click();

    await expect
      .element(menu().getByRole('link', { name: 'Ver meu perfil' }))
      .not.toBeInTheDocument();
  });
});
