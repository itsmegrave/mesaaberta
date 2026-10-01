import { createRawSnippet } from 'svelte';
import { page } from 'vitest/browser';
import { describe, expect, it, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { toast } from '$lib/toaster';
import Layout from './+layout.svelte';

const children = createRawSnippet(() => ({ render: () => '<p>Page content</p>' }));
// From the profile, so the layout does not set a cookie or reload in these tests.
const viewer = { timezone: 'America/Sao_Paulo', source: 'profile' } as const;
const shell = {
  cacheIdentity: 'anonymous',
  accountRead: {
    summary: null,
    readSeed: {
      resource: 'account' as const,
      viewer: 'anonymous',
      params: '',
      fields: ['summary'],
      updatedAt: Date.now(),
    },
  },
  maintenance: false,
  maintenanceBypass: false,
  viewer,
};
const signedOut = { authEnabled: false, released: false, ...shell, account: null };
const memberAccount = {
  displayName: 'Ana Souza',
  username: 'ana',
  avatarUrl: null,
  isAdmin: false,
  pendingSuggestionsCount: 0,
  messagesUnread: 0,
  notifications: { unread: 0, latest: [] },
};
const adminAccount = {
  displayName: 'Mestre Silva',
  username: 'ana',
  avatarUrl: null,
  isAdmin: true,
  pendingSuggestionsCount: 3,
  messagesUnread: 0,
  notifications: { unread: 0, latest: [] },
};

describe('+layout.svelte', () => {
  beforeEach(async () => {
    localStorage.removeItem('nav-expanded');
    await page.viewport(1280, 800);
  });

  it('skip link targets the id of the main region', async () => {
    render(Layout, { children, data: signedOut });

    const mainId = page.getByRole('main').element().id;
    const skipHref = page.getByRole('link', { name: /pular/i }).element().getAttribute('href');

    expect(mainId).not.toBe('');
    expect(skipHref).toBe(`#${mainId}`);
  });

  it('renders page content inside the main region', async () => {
    render(Layout, { children, data: signedOut });

    await expect.element(page.getByRole('main')).toHaveTextContent('Page content');
  });

  it('links the header brand to the home page', async () => {
    render(Layout, { children, data: signedOut });

    await expect
      .element(
        page
          .getByRole('navigation', { name: 'Navegação principal' })
          .getByRole('link', { name: 'Mesa Aberta' }),
      )
      .toHaveAttribute('href', '/');
  });

  it('shows expanded account controls and keeps labels inside the collapsed rail', async () => {
    render(Layout, { children, data: { ...signedOut, released: true, account: adminAccount } });
    const nav = page.getByRole('navigation', { name: 'Navegação principal' });
    const collapse = nav.getByRole('button', { name: 'Recolher menu' });
    await expect.element(collapse).toHaveTextContent('Recolher menu');
    await expect.element(nav.getByText('Mestre Silva', { exact: true })).toBeVisible();
    const theme = nav.getByRole('button', { name: 'Tema escuro' }).element();
    const bell = nav.getByRole('button', { name: 'Notificações', exact: true }).element();
    expect(theme.parentElement).toBe(bell.parentElement);
    expect(theme.parentElement?.previousElementSibling?.tagName).toBe('HR');
    await collapse.click();
    await expect
      .element(nav.getByRole('button', { name: 'Expandir menu' }))
      .toHaveAttribute('aria-expanded', 'false');
    const label = nav.getByRole('link', { name: 'Minhas mesas' }).element()
      .lastElementChild as HTMLElement;
    expect(getComputedStyle(label).whiteSpace).toBe('normal');
    expect(label.scrollWidth).toBeLessThanOrEqual(label.clientWidth);
    await nav.getByRole('button', { name: 'Expandir menu' }).click();
    await expect.element(collapse).toHaveTextContent('Recolher menu');
  });

  describe('footer credits', () => {
    it.each([
      ['itsmegrave', 'https://github.com/itsmegrave'],
      ['Lenindragons', 'https://linktr.ee/lenindragonsrpg'],
      ['Reporte aqui', 'https://mesaaberta.canny.io/feedback'],
    ])('links %s to %s', async (name, href) => {
      render(Layout, { children, data: signedOut });

      await expect
        .element(page.getByRole('contentinfo').getByRole('link', { name }))
        .toHaveAttribute('href', href);
    });
  });

  describe('tables link', () => {
    it('is hidden until the platform is released, so nobody is sent to an unfinished page', async () => {
      render(Layout, { children, data: signedOut });

      await expect
        .element(
          page
            .getByRole('navigation', { name: 'Navegação principal' })
            .getByRole('link', { name: 'Mesas' }),
        )
        .not.toBeInTheDocument();
    });

    it('appears once it is released on desktop', async () => {
      render(Layout, { children, data: { ...signedOut, released: true } });

      await expect
        .element(
          page
            .getByRole('navigation', { name: 'Navegação principal' })
            .getByRole('link', { name: 'Mesas' }),
        )
        .toHaveAttribute('href', '/tables');
    });
  });

  describe('account area', () => {
    const navigation = () => page.getByRole('navigation', { name: 'Navegação principal' });

    it('has no sign-in link while login is not configured, so nobody is sent to a dead end', async () => {
      render(Layout, { children, data: signedOut });

      await expect
        .element(navigation().getByRole('link', { name: 'Entrar' }))
        .not.toBeInTheDocument();
    });

    it('keeps sign-in hidden until the platform is released', async () => {
      render(Layout, {
        children,
        data: { authEnabled: true, released: false, ...shell, account: null },
      });

      await expect
        .element(navigation().getByRole('link', { name: 'Entrar' }))
        .not.toBeInTheDocument();
    });

    it('offers sign-in to an anonymous visitor once login and the platform are enabled', async () => {
      render(Layout, {
        children,
        data: { authEnabled: true, released: true, ...shell, account: null },
      });

      await expect
        .element(navigation().getByRole('link', { name: 'Entrar' }))
        .toHaveAttribute('href', '/login');
    });

    it('shows the account trigger, and reveals sign-out only when the menu is opened', async () => {
      render(Layout, {
        children,
        data: {
          authEnabled: true,
          released: false,
          ...shell,
          account: memberAccount,
        },
      });

      const menu = navigation().getByRole('button', { name: /Ana Souza/i });
      await expect.element(menu).toBeVisible();
      await expect.element(page.getByRole('button', { name: 'Sair' })).not.toBeInTheDocument();

      await menu.click();

      await expect.element(page.getByRole('button', { name: 'Sair' })).toBeVisible();
    });

    const accountMenu = () => page.getByRole('navigation', { name: 'Menu da conta' });

    it('links to the dashboard and profile from the account menu', async () => {
      render(Layout, {
        children,
        data: {
          authEnabled: true,
          released: false,
          ...shell,
          account: memberAccount,
        },
      });
      await navigation()
        .getByRole('button', { name: /Ana Souza/i })
        .click();

      await expect
        .element(accountMenu().getByRole('link', { name: 'Perfil' }))
        .toHaveAttribute('href', '/account/profile');
      await expect
        .element(accountMenu().getByRole('link', { name: 'Minhas mesas' }))
        .not.toBeInTheDocument();
      await expect
        .element(accountMenu().getByRole('link', { name: /Admin/i }))
        .not.toBeInTheDocument();
    });

    it('shows admin link and suggestion count badge for admins', async () => {
      render(Layout, {
        children,
        data: {
          authEnabled: true,
          released: false,
          ...shell,
          account: adminAccount,
        },
      });
      await navigation()
        .getByRole('button', { name: /Mestre Silva/i })
        .click();

      const adminLink = navigation().getByRole('link', { name: /Admin/i });
      await expect.element(adminLink).toBeVisible();
      await expect.element(adminLink).toHaveAttribute('href', '/admin');
      await expect.element(adminLink.getByText('Admin', { exact: true })).toBeVisible();
      await expect.element(adminLink.getByLabelText('Admin: 3')).toHaveTextContent('3');
    });

    it('signs out with a POST to /logout, never a link', async () => {
      render(Layout, {
        children,
        data: {
          authEnabled: true,
          released: false,
          ...shell,
          account: memberAccount,
        },
      });
      await navigation()
        .getByRole('button', { name: /Ana Souza/i })
        .click();

      const form = accountMenu().getByRole('button', { name: 'Sair' }).element().closest('form');

      expect(form?.method).toBe('post');
      expect(form?.getAttribute('action')).toBe('/logout');
    });

    it('shows the open table link on desktop when released and signed in', async () => {
      render(Layout, {
        children,
        data: {
          authEnabled: true,
          released: true,
          ...shell,
          account: memberAccount,
        },
      });

      await expect
        .element(navigation().getByRole('link', { name: 'Abrir mesa' }))
        .toHaveAttribute('href', '/tables/new');
    });

    it('shows the unread count on the bell, and the latest notifications when it opens', async () => {
      render(Layout, {
        children,
        data: {
          authEnabled: true,
          released: true,
          ...shell,
          account: {
            ...memberAccount,
            notifications: {
              unread: 2,
              latest: [
                {
                  id: 'n1',
                  type: 'join_requested',
                  category: 'registration' as const,
                  icon: null,
                  title: null,
                  body: null,
                  link: '/tables/mesa/manage',
                  metadata: { tableId: 't', slug: 'mesa', title: 'Mesa do Dragão' },
                  readAt: null,
                  read: false,
                  createdAt: new Date('2026-10-01T12:00:00Z'),
                  actor: 'bia',
                },
              ],
            },
          },
        },
      });

      const bell = navigation().getByRole('button', { name: 'Notificações: 2 sem ler' });
      await expect.element(bell).toBeVisible();
      // Closed, the menu is not in the page, so its text never doubles what the page says.
      expect(document.body.textContent).not.toContain('pediu uma vaga');
      await bell.click();

      const item = page.getByRole('button', { name: /@bia pediu uma vaga em Mesa do Dragão/ });
      await expect.element(item).toBeVisible();
      const form = item.element().closest('form');
      expect(form?.getAttribute('action')).toBe('/notifications?/open');
      await expect
        .element(page.getByRole('link', { name: 'Ver todas' }))
        .toHaveAttribute('href', '/notifications');
    });

    it('shows no bell to a visitor who is signed out', async () => {
      render(Layout, { children, data: { ...signedOut, authEnabled: true, released: true } });

      await expect
        .element(navigation().getByRole('button', { name: /Notificações/ }))
        .not.toBeInTheDocument();
    });
  });

  describe('mobile bottom tab bar', () => {
    beforeEach(async () => {
      await page.viewport(390, 844);
    });

    it('renders bottom tab bar when released', async () => {
      render(Layout, {
        children,
        data: {
          authEnabled: true,
          released: true,
          ...shell,
          account: memberAccount,
        },
      });

      const nav = page.getByRole('navigation', { name: 'Navegação móvel' });
      await expect.element(nav).toBeVisible();
      await expect
        .element(nav.getByRole('link', { name: 'Mesas' }))
        .toHaveAttribute('href', '/tables');
      await expect
        .element(nav.getByRole('link', { name: 'Abrir mesa' }))
        .toHaveAttribute('href', '/tables/new');
      await expect
        .element(nav.getByRole('link', { name: 'Minhas mesas' }))
        .toHaveAttribute('href', '/account/tables');
    });

    it('includes Admin tab on bottom tab bar for admins', async () => {
      render(Layout, {
        children,
        data: {
          authEnabled: true,
          released: true,
          ...shell,
          account: adminAccount,
        },
      });

      const nav = page.getByRole('navigation', { name: 'Navegação móvel' });
      await expect
        .element(nav.getByRole('link', { name: 'Admin' }))
        .toHaveAttribute('href', '/admin');
    });
  });

  describe('toaster', () => {
    it('renders toasts triggered in the application', async () => {
      toast.clear();
      render(Layout, { children, data: signedOut });

      toast.success('Vaga confirmada!');

      await expect.element(page.getByText('Vaga confirmada!')).toBeVisible();
    });
  });
});

describe('maintenance', () => {
  it('shows only the brand on the maintenance screen: no navigation, tab bar or footer', async () => {
    render(Layout, { children, data: { ...signedOut, released: true, maintenance: true } });

    await expect.element(page.getByRole('navigation')).not.toBeInTheDocument();
    await expect.element(page.getByRole('contentinfo')).not.toBeInTheDocument();
    await expect.element(page.getByRole('main')).toHaveTextContent('Page content');
    await expect.element(page.getByRole('banner')).toHaveTextContent('Mesa Aberta');
  });

  it('tells an admin who got through that the site is down for everyone else', async () => {
    render(Layout, {
      children,
      data: { ...signedOut, account: adminAccount, maintenanceBypass: true },
    });

    await expect
      .element(page.getByRole('status').filter({ hasText: /Modo de manutenção/ }))
      .toHaveTextContent('Modo de manutenção ativo: só a administração vê o site.');
  });

  it('has no banner while the site is up', async () => {
    render(Layout, { children, data: signedOut });

    await expect.element(page.getByText(/Modo de manutenção/)).not.toBeInTheDocument();
  });
});
