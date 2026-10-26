import '../../../routes/layout.css';
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

  it('puts the name inside the button, not beside it, in the open side navigation', async () => {
    render(AccountMenu, {
      name: 'Marina Alves',
      username: 'marina',
      avatarUrl: null,
      placement: 'top-start',
      wide: true,
    });

    await expect.element(trigger().getByText('Marina Alves')).toBeVisible();
    await expect.element(page.getByRole('link', { name: 'Marina Alves' })).not.toBeInTheDocument();
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
    await expect.element(link).toHaveAttribute('href', '/m');
    await expect.element(page.getByTestId('messages-count')).toHaveTextContent('3');
  });

  it('links admins to the admin area, with what waits there on the item and the avatar', async () => {
    render(AccountMenu, {
      name: 'Admin User',
      avatarUrl: null,
      isAdmin: true,
      adminPending: 4,
      messagesUnread: 2,
    });

    const button = page.getByRole('button', {
      name: 'Menu da conta: Admin User, 2 mensagens não lidas, Admin: 4',
    });
    expect(button.element().querySelector('.preset-filled-warning-500')?.textContent?.trim()).toBe(
      '6',
    );
    await button.click();

    await expect
      .element(menu().getByRole('link', { name: 'Admin: 4' }))
      .toHaveAttribute('href', '/admin');
    await expect.element(page.getByTestId('admin-count')).toHaveTextContent('4');
  });

  it('does not count the admin area for a member', async () => {
    render(AccountMenu, { name: 'Marina Alves', avatarUrl: null, adminPending: 4 });

    await expect
      .element(page.getByRole('button', { name: 'Menu da conta: Marina Alves' }))
      .toBeVisible();
  });

  it('links "Perfil" to the public page, without an @ in the address', async () => {
    render(AccountMenu, { name: 'Marina Alves', username: 'marina', avatarUrl: null });

    await trigger().click();

    await expect
      .element(menu().getByRole('link', { name: 'Perfil' }))
      .toHaveAttribute('href', '/u/marina');
  });

  it('has no public profile to show before a username is chosen', async () => {
    render(AccountMenu, { name: 'Marina Alves', avatarUrl: null });

    await trigger().click();

    await expect.element(menu().getByRole('link', { name: 'Perfil' })).not.toBeInTheDocument();
  });

  it('is Perfil, Mensagens, Admin, Tema and Sair', async () => {
    render(AccountMenu, {
      name: 'Marina Alves',
      username: 'marina',
      avatarUrl: null,
      isAdmin: true,
    });

    await trigger().click();

    expect(
      menu()
        .getByRole('link')
        .elements()
        .map((el) => el.textContent?.trim()),
    ).toEqual(['Perfil', 'Mensagens', 'Admin']);
    await expect.element(menu().getByRole('radiogroup', { name: 'Tema' })).toBeVisible();
    await expect.element(menu().getByRole('button', { name: 'Sair' })).toBeVisible();
  });

  it('switches the theme with Claro | Escuro and keeps the menu open', async () => {
    render(AccountMenu, { name: 'Marina Alves', avatarUrl: null });

    await trigger().click();
    await menu().getByRole('radio', { name: 'Escuro' }).click();

    await expect.element(menu().getByRole('radio', { name: 'Escuro' })).toBeChecked();
    await expect.element(menu().getByRole('radio', { name: 'Claro' })).not.toBeChecked();
    expect(document.documentElement.dataset.mode).toBe('dark');

    await menu().getByRole('radio', { name: 'Claro' }).click();
    await expect.element(menu().getByRole('radio', { name: 'Claro' })).toBeChecked();
  });

  it('opens as a sheet on the phone, with the same items', async () => {
    render(AccountMenu, { name: 'Marina Alves', avatarUrl: null, isAdmin: true, sheet: true });

    await trigger().click();

    await expect.element(page.getByRole('dialog', { name: 'Menu da conta' })).toBeVisible();
    await expect.element(menu().getByRole('link', { name: 'Admin' })).toBeVisible();
    await expect.element(menu().getByRole('radiogroup', { name: 'Tema' })).toBeVisible();
  });

  it('shows the unread messages on the avatar, in warning, and says it in the name', async () => {
    render(AccountMenu, { name: 'Marina Alves', avatarUrl: null, messagesUnread: 2 });

    const button = page.getByRole('button', {
      name: 'Menu da conta: Marina Alves, 2 mensagens não lidas',
    });
    await expect.element(button).toBeVisible();
    expect(button.element().querySelector('.preset-filled-warning-500')?.textContent?.trim()).toBe(
      '2',
    );
  });

  it('has no admin link for a member', async () => {
    render(AccountMenu, { name: 'Marina Alves', avatarUrl: null });

    await trigger().click();

    await expect.element(menu().getByRole('link', { name: /Admin/ })).not.toBeInTheDocument();
  });

  // The test page must stay put, so the links' default navigation is cancelled.
  const stayOnPage = (e: Event) => e.preventDefault();

  it.each(['Perfil', 'Mensagens', 'Admin'])(
    'closes the phone sheet after "%s" is followed',
    async (name) => {
      document.addEventListener('click', stayOnPage);
      try {
        render(AccountMenu, {
          name: 'Marina Alves',
          username: 'marina',
          avatarUrl: null,
          isAdmin: true,
          sheet: true,
        });

        await trigger().click();
        await menu().getByRole('link', { name }).click();

        await expect
          .element(page.getByRole('dialog', { name: 'Menu da conta' }))
          .not.toBeInTheDocument();
      } finally {
        document.removeEventListener('click', stayOnPage);
      }
    },
  );

  it('closes the popover after a link is followed', async () => {
    document.addEventListener('click', stayOnPage);
    try {
      render(AccountMenu, { name: 'Marina Alves', username: 'marina', avatarUrl: null });

      await trigger().click();
      await menu().getByRole('link', { name: 'Mensagens' }).click();

      // A closed popover keeps its content in the page, hidden.
      await expect
        .poll(() => document.querySelector('[data-part="content"]')?.getAttribute('data-state'))
        .toBe('closed');
    } finally {
      document.removeEventListener('click', stayOnPage);
    }
  });

  it('keeps the phone sheet open while the theme changes', async () => {
    render(AccountMenu, { name: 'Marina Alves', avatarUrl: null, sheet: true });

    await trigger().click();
    await menu().getByRole('radio', { name: 'Escuro' }).click();

    await expect.element(page.getByRole('dialog', { name: 'Menu da conta' })).toBeVisible();
    await menu().getByRole('radio', { name: 'Claro' }).click();
  });
});
