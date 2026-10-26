import { createRawSnippet } from 'svelte';
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import CardGrid from './CardGrid.svelte';
import EmptyState from './EmptyState.svelte';
import PageHead from './PageHead.svelte';

describe('PageHead', () => {
  it('draws the trail, the title and the lede', async () => {
    render(PageHead, { crumbs: [{ label: 'Mesas' }], title: 'Mesas abertas', lede: 'Ache uma.' });

    await expect
      .element(page.getByRole('heading', { level: 1, name: 'Mesas abertas' }))
      .toBeVisible();
    await expect.element(page.getByText('Ache uma.')).toBeVisible();
    await expect.element(page.getByRole('navigation')).toBeInTheDocument();
  });

  it('puts the actions next to the title only when there are some', async () => {
    const actions = createRawSnippet(() => ({ render: () => '<a href="/tables/new">Abrir</a>' }));
    render(PageHead, { title: 'Mesas', actions });

    const link = page.getByRole('link', { name: 'Abrir' }).element();
    const heading = page.getByRole('heading', { level: 1 }).element();
    // The heading is wrapped so the actions sit at the other end of the row.
    expect(link.parentElement).toBe(heading.parentElement?.parentElement);
    expect(document.querySelector('nav')).toBeNull();
  });
});

describe('CardGrid', () => {
  it('is a list by default', async () => {
    const children = createRawSnippet(() => ({ render: () => '<li>card</li>' }));
    await render(CardGrid, { class: 'mt-4', children });
    expect(document.querySelector('ul.grid.mt-4.lg\\:grid-cols-3')).not.toBeNull();
  });

  it('is a div when asked, for the skeleton', async () => {
    const box = createRawSnippet(() => ({ render: () => '<div>card</div>' }));
    await render(CardGrid, { as: 'div', children: box });
    expect(document.querySelector('div.grid.lg\\:grid-cols-3')).not.toBeNull();
    expect(document.querySelector('ul')).toBeNull();
  });
});

describe('EmptyState', () => {
  it('says the list is empty, with no link when there is nowhere to go back to', async () => {
    await render(EmptyState, { text: 'Nada aqui.', clearLabel: 'Limpar' });
    await expect.element(page.getByRole('status')).toHaveTextContent('Nada aqui.');
    expect(page.getByRole('link').elements()).toHaveLength(0);
  });

  it('links back to the whole list', async () => {
    await render(EmptyState, { text: 'Nada aqui.', clearHref: '/tables', clearLabel: 'Limpar' });
    await expect
      .element(page.getByRole('link', { name: 'Limpar' }))
      .toHaveAttribute('href', '/tables');
  });
});
