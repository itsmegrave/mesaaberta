import { createRawSnippet } from 'svelte';
import { page } from 'vitest/browser';
import { describe, expect, it, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { toast } from '#lib/toaster.js';
import Layout from './+layout.svelte';

const children = createRawSnippet(() => ({ render: () => '<p>Page content</p>' }));
// From the profile, so the layout does not set a cookie or reload in these tests.
const viewer = { timezone: 'America/Sao_Paulo', source: 'profile' } as const;
const shell = {
  cacheIdentity: 'anonymous',
  blogLive: false,
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
  site: {
    APP_ORIGIN: 'https://mesaaberta.app',
    CONTACT_EMAIL: 'contato@mesaaberta.app',
    PRIVACY_CONTROLLER_NAME: 'Pessoa Responsável',
    PRIVACY_EMAIL: 'privacidade@mesaaberta.app',
    INSTAGRAM_HANDLE: 'mesaaberta.app',
  },
};
const signedOut = { authEnabled: false, ...shell, account: null };
const memberAccount = {
  displayName: 'Ana Souza',
  username: 'ana',
  avatarUrl: null,
  isAdmin: false,
  pendingSuggestionsCount: 0,
  messagesUnread: 0,
  notifications: { unread: 0, latest: [], seenAt: '2026-10-25T12:00:00.000Z' },
};
const adminAccount = {
  displayName: 'Mestre Silva',
  username: 'ana',
  avatarUrl: null,
  isAdmin: true,
  pendingSuggestionsCount: 3,
  messagesUnread: 0,
  notifications: { unread: 0, latest: [], seenAt: '2026-10-25T12:00:00.000Z' },
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

  it('opens as a sidebar: collapse beside the wordmark, an account group, a theme switch and the account pinned last', async () => {
    render(Layout, {
      children,
      data: {
        ...signedOut,
        account: {
          ...adminAccount,
          messagesUnread: 2,
          notifications: { unread: 4, latest: [], seenAt: '2026-10-25T12:00:00.000Z' },
        },
      },
    });
    const nav = page.getByRole('navigation', { name: 'Navegação principal' });
    const collapse = nav.getByRole('button', { name: 'Recolher menu' });
    const brand = nav.getByRole('link', { name: 'Mesa Aberta' }).element();

    expect(collapse.element().parentElement).toBe(brand.parentElement);
    for (const name of ['Mesas', 'Abrir uma mesa', 'Minhas mesas']) {
      await expect.element(nav.getByRole('link', { name })).toBeVisible();
    }
    // Parceiros is not linked from the app chrome; /p is reached directly.
    await expect.element(nav.getByRole('link', { name: 'Parceiros' })).not.toBeInTheDocument();
    await expect.element(nav.getByText('Sua conta', { exact: true })).toBeVisible();
    // Mensagens lives in the account menu, not in the group.
    expect(nav.getByRole('link', { name: /^Mensagens/ }).elements()).toHaveLength(0);
    await expect
      .element(nav.getByRole('button', { name: 'Notificações: 4 sem ler' }))
      .toBeVisible();
    // Admin and the theme live in the account menu, which is last.
    expect(nav.getByRole('link', { name: /Admin/ }).elements()).toHaveLength(0);
    expect(nav.getByRole('switch', { name: 'Tema escuro' }).elements()).toHaveLength(0);
    const account = nav.getByRole('button', { name: /Mestre Silva/i }).element();
    expect(nav.element().contains(account)).toBe(true);
  });

  it('draws the open side nav without an inline style, which the CSP blocks', async () => {
    render(Layout, { children, data: { ...signedOut, account: adminAccount } });
    const nav = page.getByRole('navigation', { name: 'Navegação principal' });

    await expect.element(nav.getByRole('button', { name: /Mestre Silva/i })).toBeVisible();
    expect(nav.element().querySelectorAll('[style]')).toHaveLength(0);
  });

  it('collapses to an 80px rail with the same groups as the open nav: Sua conta, then the account', async () => {
    render(Layout, { children, data: { ...signedOut, account: adminAccount } });
    const nav = page.getByRole('navigation', { name: 'Navegação principal' });
    await nav.getByRole('button', { name: 'Recolher menu' }).click();

    await expect
      .element(nav.getByRole('button', { name: 'Expandir menu' }))
      .toHaveAttribute('aria-expanded', 'false');
    const bell = nav.getByRole('button', { name: 'Notificações', exact: true }).element();
    const account = nav.getByRole('button', { name: /Mestre Silva/i }).element();
    // Notificações keeps the "Sua conta" group, as when open; its label is hidden.
    await expect.element(nav.getByText('Sua conta', { exact: true })).not.toBeInTheDocument();
    expect(bell.parentElement?.contains(account)).toBe(false);
    // Admin and the theme are in the account menu, not on the rail.
    expect(nav.getByRole('link', { name: 'Admin' }).elements()).toHaveLength(0);
    expect(nav.getByRole('button', { name: 'Tema escuro' }).elements()).toHaveLength(0);
    // The width animates, so wait for it to settle.
    await expect.poll(() => nav.element().getBoundingClientRect().width).toBe(80);
    const label = nav.getByRole('link', { name: 'Minhas mesas' }).element()
      .lastElementChild as HTMLElement;
    expect(getComputedStyle(label).whiteSpace).toBe('normal');
    expect(label.scrollWidth).toBeLessThanOrEqual(label.clientWidth);
    // The test runner's pane splitter overlaps the left edge of the scaled test frame, where the
    // 80px rail's button sits, so a pointer click lands on the splitter; click the element itself.
    (nav.getByRole('button', { name: 'Expandir menu' }).element() as HTMLElement).click();
    await expect
      .element(nav.getByRole('button', { name: 'Recolher menu' }))
      .toHaveAttribute('aria-expanded', 'true');
  });

  describe('footer links', () => {
    it.each([
      ['itsmegrave', 'https://github.com/itsmegrave'],
      ['GitHub', 'https://github.com/itsmegrave/mesaaberta'],
      ['contato@mesaaberta.app', 'mailto:contato@mesaaberta.app'],
      ['Parceiros', '/p'],
      ['Instagram da Mesa Aberta, @mesaaberta.app', 'https://www.instagram.com/mesaaberta.app/'],
    ])('links %s to %s', async (name, href) => {
      render(Layout, { children, data: signedOut });

      await expect
        .element(page.getByRole('contentinfo').getByRole('link', { name }))
        .toHaveAttribute('href', href);
    });
  });

  describe('tables link', () => {
    it('is available to anonymous visitors on desktop', async () => {
      render(Layout, { children, data: { ...signedOut } });

      await expect
        .element(
          page
            .getByRole('navigation', { name: 'Navegação principal' })
            .getByRole('link', { name: 'Mesas' }),
        )
        .toHaveAttribute('href', '/t');
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

    it('offers sign-in to an anonymous visitor when login is configured', async () => {
      render(Layout, {
        children,
        data: { authEnabled: true, ...shell, account: null },
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
          ...shell,
          account: memberAccount,
        },
      });
      await navigation()
        .getByRole('button', { name: /Ana Souza/i })
        .click();

      await expect
        .element(accountMenu().getByRole('link', { name: 'Perfil' }))
        .toHaveAttribute('href', '/u/ana');
      await expect
        .element(accountMenu().getByRole('link', { name: 'Editar perfil' }))
        .not.toBeInTheDocument();
      await expect
        .element(accountMenu().getByRole('link', { name: 'Minhas mesas' }))
        .not.toBeInTheDocument();
      await expect
        .element(accountMenu().getByRole('link', { name: /Admin/i }))
        .not.toBeInTheDocument();
    });

    it('shows the admin link and the suggestion count in the account menu for admins', async () => {
      render(Layout, {
        children,
        data: {
          authEnabled: true,
          ...shell,
          account: adminAccount,
        },
      });
      await navigation()
        .getByRole('button', { name: /Mestre Silva/i })
        .click();

      const adminLink = accountMenu().getByRole('link', { name: 'Admin: 3' });
      await expect.element(adminLink).toBeVisible();
      await expect.element(adminLink).toHaveAttribute('href', '/admin');
      await expect.element(adminLink.getByTestId('admin-count')).toHaveTextContent('3');
    });

    it('signs out with a POST to /logout, never a link', async () => {
      render(Layout, {
        children,
        data: {
          authEnabled: true,
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

    it('shows the open table link on desktop when signed in', async () => {
      render(Layout, {
        children,
        data: {
          authEnabled: true,
          ...shell,
          account: memberAccount,
        },
      });

      await expect
        .element(navigation().getByRole('link', { name: 'Abrir uma mesa' }))
        .toHaveAttribute('href', '/t/new');
    });

    it('shows the unread count on the bell, and the latest notifications when it opens', async () => {
      render(Layout, {
        children,
        data: {
          authEnabled: true,
          ...shell,
          account: {
            ...memberAccount,
            notifications: {
              seenAt: '2026-10-25T12:00:00.000Z',
              unread: 2,
              latest: [
                {
                  id: 'n1',
                  type: 'join_requested',
                  category: 'registration' as const,
                  icon: null,
                  title: null,
                  body: null,
                  link: '/t/mesa/manage',
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
      expect(form?.getAttribute('action')).toBe('/n?/open');
      await expect
        .element(page.getByRole('link', { name: 'Ver todas' }))
        .toHaveAttribute('href', '/n');
    });

    it('shows no bell to a visitor who is signed out', async () => {
      render(Layout, { children, data: { ...signedOut, authEnabled: true } });

      await expect
        .element(navigation().getByRole('button', { name: /Notificações/ }))
        .not.toBeInTheDocument();
    });
  });

  describe('mobile bottom tab bar', () => {
    beforeEach(async () => {
      await page.viewport(390, 844);
    });

    it('renders the bottom tab bar for signed-in visitors', async () => {
      render(Layout, {
        children,
        data: {
          authEnabled: true,
          ...shell,
          account: memberAccount,
        },
      });

      const nav = page.getByRole('navigation', { name: 'Navegação móvel' });
      await expect.element(nav).toBeVisible();
      await expect.element(nav.getByRole('link', { name: 'Mesas' })).toHaveAttribute('href', '/t');
      await expect
        .element(nav.getByRole('link', { name: 'Abrir mesa' }))
        .toHaveAttribute('href', '/t/new');
      await expect
        .element(nav.getByRole('link', { name: 'Minhas mesas' }))
        .toHaveAttribute('href', '/u/tables');
    });

    it('offers navigation and sign-in to anonymous visitors on mobile', async () => {
      render(Layout, { children, data: { ...signedOut, authEnabled: true } });

      const nav = page.getByRole('navigation', { name: 'Navegação móvel' });
      await expect.element(nav).toBeVisible();
      await expect.element(nav.getByRole('link', { name: 'Mesas' })).toHaveAttribute('href', '/t');
      await expect
        .element(page.getByRole('banner').getByRole('link', { name: 'Entrar' }))
        .toHaveAttribute('href', '/login');
    });

    it('leaves Parceiros off the bar', async () => {
      render(Layout, { children, data: { ...signedOut, authEnabled: true } });

      await expect
        .element(
          page
            .getByRole('navigation', { name: 'Navegação móvel' })
            .getByRole('link', { name: 'Parceiros' }),
        )
        .not.toBeInTheDocument();
    });

    it('puts Admin and the theme in the phone account sheet, not on the tab bar', async () => {
      render(Layout, {
        children,
        data: {
          authEnabled: true,
          ...shell,
          account: adminAccount,
        },
      });

      const bar = page.getByRole('navigation', { name: 'Navegação móvel' });
      expect(bar.getByRole('link', { name: /Admin/ }).elements()).toHaveLength(0);
      const banner = page.getByRole('banner');
      expect(banner.getByRole('button', { name: 'Tema escuro' }).elements()).toHaveLength(0);

      await banner.getByRole('button', { name: /Mestre Silva/i }).click();
      const sheet = page.getByRole('dialog', { name: 'Menu da conta' });
      await expect
        .element(sheet.getByRole('link', { name: 'Admin: 3' }))
        .toHaveAttribute('href', '/admin');
      await expect.element(sheet.getByRole('radiogroup', { name: 'Tema' })).toBeVisible();
    });

    it('keeps the theme button in the phone header for visitors', async () => {
      render(Layout, { children, data: { ...signedOut, authEnabled: true } });

      await expect
        .element(page.getByRole('banner').getByRole('button', { name: 'Tema escuro' }))
        .toBeInTheDocument();
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
    render(Layout, { children, data: { ...signedOut, maintenance: true } });

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
