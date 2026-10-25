import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import BottomTabBar from './BottomTabBar.svelte';

describe('BottomTabBar.svelte', () => {
  const nav = () => page.getByRole('navigation', { name: 'Navegação móvel' });

  it('renders base tabs for standard member', async () => {
    render(BottomTabBar);

    await expect.element(nav()).toBeVisible();
    await expect.element(nav().getByRole('link', { name: 'Mesas' })).toHaveAttribute('href', '/t');
    await expect
      .element(nav().getByRole('link', { name: 'Abrir mesa' }))
      .toHaveAttribute('href', '/t/new');
    await expect
      .element(nav().getByRole('link', { name: 'Minhas mesas' }))
      .toHaveAttribute('href', '/u/tables');
    await expect.element(nav().getByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
  });

  it('offers the crowdfunding list with a short label and the full name for a screen reader', async () => {
    render(BottomTabBar);

    const tab = nav().getByRole('link', { name: 'Financiamentos coletivos' });
    await expect.element(tab).toHaveAttribute('href', '/cf');
    await expect.element(tab).toHaveTextContent('FCs');
  });

  it('leaves Parceiros to the footer', async () => {
    render(BottomTabBar);

    await expect.element(nav().getByRole('link', { name: 'Parceiros' })).not.toBeInTheDocument();
  });

  it('adds an Admin tab for admins, with the pending count', async () => {
    render(BottomTabBar, { isAdmin: true, pendingSuggestionsCount: 3 });

    await expect
      .element(nav().getByRole('link', { name: 'Admin: 3' }))
      .toHaveAttribute('href', '/admin');
    expect(nav().getByRole('link').elements()).toHaveLength(5);
  });

  it('has four tabs for everyone else', async () => {
    render(BottomTabBar);

    await expect.element(nav().getByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
    expect(nav().getByRole('link').elements()).toHaveLength(4);
  });
  it('uses the new game artwork for every mobile tab', async () => {
    render(BottomTabBar);
    const expected = {
      '/t': 'game-icons:tavern-sign',
      '/t/new': 'game-icons:dice-twenty-faces-twenty',
      '/u/tables': 'game-icons:tabletop-players',
    };
    for (const [href, icon] of Object.entries(expected)) {
      const svg = document.querySelector<SVGSVGElement>(`a[href="${href}"] svg`);
      expect(svg?.getAttribute('data-icon')).toBe(icon);
      expect(svg?.getAttribute('viewBox')).toBe('0 0 512 512');
      expect(svg?.querySelector('path')?.getBBox().width).toBeGreaterThan(0);
    }
  });
});
