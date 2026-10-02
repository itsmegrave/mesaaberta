import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Breadcrumbs from './Breadcrumbs.svelte';

const trail = () => page.getByRole('navigation', { name: 'Trilha de navegação' });

describe('Breadcrumbs', () => {
  it('is a labelled list that starts at the home page', async () => {
    render(Breadcrumbs, { items: [{ label: 'Mesas' }] });

    await expect.element(trail()).toBeInTheDocument();
    const steps = trail().getByRole('listitem');
    expect(steps.elements()).toHaveLength(2);
    await expect
      .element(trail().getByRole('link', { name: 'Início' }))
      .toHaveAttribute('href', '/');
  });

  it('links every level above, by its readable name', async () => {
    render(Breadcrumbs, {
      items: [
        { label: 'Minhas mesas', href: '/account/tables' },
        { label: 'A Torre das Marés Mortas', href: '/tables/a-torre' },
        { label: 'Editar mesa' },
      ],
    });

    await expect
      .element(trail().getByRole('link', { name: 'Minhas mesas' }))
      .toHaveAttribute('href', '/account/tables');
    await expect
      .element(trail().getByRole('link', { name: 'A Torre das Marés Mortas' }))
      .toHaveAttribute('href', '/tables/a-torre');
  });

  it('marks the current page, which is text and not a link', async () => {
    render(Breadcrumbs, {
      items: [{ label: 'Minhas mesas', href: '/account/tables' }, { label: 'Abrir mesa' }],
    });

    const current = trail().getByText('Abrir mesa');
    await expect.element(current).toHaveAttribute('aria-current', 'page');
    expect(current.element().closest('a')).toBeNull();
  });

  it('hides the separators from screen readers', async () => {
    render(Breadcrumbs, { items: [{ label: 'Mesas' }] });

    for (const svg of trail().element().querySelectorAll('svg')) {
      expect(svg.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('starts with the house icon on "Início"', async () => {
    render(Breadcrumbs, { items: [{ label: 'Mesas' }] });

    const home = trail().getByRole('link', { name: 'Início' }).element();
    expect(home.querySelector('[data-icon="game-icons:house"]')).not.toBeNull();
  });

  it('keeps a short trail whole, with no "…" menu', async () => {
    render(Breadcrumbs, {
      items: [{ label: 'Minhas mesas', href: '/account/tables' }, { label: 'Abrir mesa' }],
    });

    expect(trail().getByRole('button').elements()).toHaveLength(0);
  });

  it('folds the middle of a trail over three levels into a menu for phones', async () => {
    render(Breadcrumbs, {
      items: [
        { label: 'Minhas mesas', href: '/account/tables' },
        { label: 'A Torre das Marés Mortas', href: '/tables/a-torre' },
        { label: 'Editar mesa' },
      ],
    });

    await expect
      .element(trail().getByRole('button', { name: 'Mostrar os níveis do meio' }))
      .toBeInTheDocument();
  });
});
