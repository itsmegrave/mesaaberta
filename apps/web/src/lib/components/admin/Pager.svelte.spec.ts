import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Pager from './Pager.svelte';

const href = (number: number) => (number === 1 ? '/t' : `/t?page=${number}`);
const nav = () => page.getByRole('navigation', { name: 'Páginas' });

describe('Pager', () => {
  it('draws nothing for a single page', async () => {
    await render(Pager, { page: 1, pages: 1, href });
    expect(document.querySelector('nav')).toBeNull();
    await render(Pager, { page: 1, pages: 1, href, compact: true });
    expect(document.querySelector('nav')).toBeNull();
  });

  it('links every page by its address, the first without ?page', async () => {
    await render(Pager, { page: 2, pages: 3, href });
    await expect
      .element(nav().getByRole('link', { name: 'Página anterior' }))
      .toHaveAttribute('href', '/t');
    await expect
      .element(nav().getByRole('link', { name: 'Próxima página' }))
      .toHaveAttribute('href', '/t?page=3');
    expect(document.querySelector('[aria-current="page"]')?.textContent).toBe('2');
  });

  it('in its compact form, says the page and offers only the steps there are', async () => {
    await render(Pager, { page: 1, pages: 3, href, compact: true, class: 'mt-8' });

    await expect.element(nav()).toHaveTextContent('Página 1 de 3');
    expect(nav().getByRole('link').elements()).toHaveLength(1);
    await expect
      .element(nav().getByRole('link', { name: 'Próxima página' }))
      .toHaveAttribute('href', '/t?page=2');
    expect(nav().element().classList.contains('mt-8')).toBe(true);
  });
});
