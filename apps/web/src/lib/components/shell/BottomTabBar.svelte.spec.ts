import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import BottomTabBar from './BottomTabBar.svelte';
import type { DirectoryLink } from '#lib/navigation/directory-nav.js';

describe('BottomTabBar.svelte', () => {
  const nav = () => page.getByRole('navigation', { name: 'Navegação móvel' });

  it('renders base tabs for standard member', async () => {
    render(BottomTabBar);

    await expect.element(nav()).toBeVisible();
    await expect
      .element(nav().getByRole('link', { name: 'Mesas' }))
      .toHaveAttribute('href', '/tables');
    await expect
      .element(nav().getByRole('link', { name: 'Abrir mesa' }))
      .toHaveAttribute('href', '/tables/new');
    await expect
      .element(nav().getByRole('link', { name: 'Minhas mesas' }))
      .toHaveAttribute('href', '/u/tables');
    await expect.element(nav().getByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
  });

  it('offers the crowdfunding list with a short label and the full name for a screen reader', async () => {
    render(BottomTabBar);

    const tab = nav().getByRole('link', { name: 'Financiamentos coletivos' });
    await expect.element(tab).toHaveAttribute('href', '/crowdfunding');
    await expect.element(tab).toHaveTextContent('FCs');
  });

  it('leaves Parceiros off the bar', async () => {
    render(BottomTabBar);

    await expect.element(nav().getByRole('link', { name: 'Parceiros' })).not.toBeInTheDocument();
  });

  // Admin moved to the account menu, so admins get the same four tabs.
  it('has four tabs for everyone', async () => {
    render(BottomTabBar);

    await expect.element(nav().getByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
    expect(nav().getByRole('link').elements()).toHaveLength(4);
  });
  it('uses the new game artwork for every mobile tab', async () => {
    render(BottomTabBar);
    const expected = {
      '/tables': 'game-icons:tavern-sign',
      '/tables/new': 'game-icons:dice-twenty-faces-twenty',
      '/u/tables': 'game-icons:tabletop-players',
    };
    for (const [href, icon] of Object.entries(expected)) {
      const svg = document.querySelector<SVGSVGElement>(`a[href="${href}"] svg`);
      expect(svg?.getAttribute('data-icon')).toBe(icon);
      expect(svg?.getAttribute('viewBox')).toBe('0 0 512 512');
      expect(svg?.querySelector('path')?.getBBox().width).toBeGreaterThan(0);
    }
  });

  describe('Explorar', () => {
    const directory = (href: `/${string}`, label: string): DirectoryLink => ({
      href,
      icon: 'game-icons:book-cover',
      label: () => label,
      shortLabel: () => label.split(' ')[0],
      description: () => `Sobre ${label}`,
      current: () => false,
    });
    const two = [
      directory('/systems', 'Sistemas de RPG'),
      directory('/places', 'Lugares para jogar'),
    ];

    it('is not on the bar while every directory is off', async () => {
      render(BottomTabBar, { directories: [] });

      await expect.element(nav().getByRole('button', { name: 'Explorar' })).not.toBeInTheDocument();
    });

    it('opens a sheet with every directory, its name and a line about it, and closes with Esc', async () => {
      render(BottomTabBar, { directories: two });

      const trigger = nav().getByRole('button', { name: 'Explorar' });
      await expect.element(trigger).toHaveAttribute('aria-haspopup', 'dialog');
      await trigger.click();
      const sheet = page.getByRole('dialog', { name: 'Explorar' });
      await expect.element(sheet).toBeVisible();
      await expect
        .element(sheet.getByRole('link', { name: /Lugares para jogar/ }))
        .toHaveAttribute('href', '/places');
      await expect.element(sheet.getByText('Sobre Sistemas de RPG')).toBeVisible();

      await userEvent.keyboard('{Escape}');
      await expect.element(sheet).not.toBeInTheDocument();
      await expect.element(trigger).toHaveFocus();
    });

    it('closes the sheet with its X', async () => {
      render(BottomTabBar, { directories: two });

      await nav().getByRole('button', { name: 'Explorar' }).click();
      await page.getByRole('button', { name: 'Fechar' }).click();
      await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
