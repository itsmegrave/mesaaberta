import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ThemeToggle from './ThemeToggle.svelte';

const root = document.documentElement;

beforeEach(() => {
  localStorage.clear();
  delete root.dataset.mode;
  document.head.insertAdjacentHTML(
    'beforeend',
    '<meta name="theme-color" content="#fcfcfc" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#121212" media="(prefers-color-scheme: dark)">',
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  document.head.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
});

const metas = () =>
  [...document.head.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map(
    (m) => m.content,
  );

describe('ThemeToggle', () => {
  it('is a labelled icon button toggle with fixed label "Tema escuro"', async () => {
    render(ThemeToggle);

    const button = page.getByRole('button', { name: 'Tema escuro' });
    await expect.element(button).toBeInTheDocument();
    await expect.element(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('toggles to dark on first click and saves choice', async () => {
    render(ThemeToggle);

    const button = page.getByRole('button', { name: 'Tema escuro' });
    await button.click();

    await expect.element(button).toHaveAttribute('aria-pressed', 'true');
    expect(root.dataset.mode).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(metas()).toEqual(['#121212', '#121212']);
  });

  it('toggles back to light on second click and saves choice', async () => {
    render(ThemeToggle);

    const button = page.getByRole('button', { name: 'Tema escuro' });
    await button.click();
    await button.click();

    await expect.element(button).toHaveAttribute('aria-pressed', 'false');
    expect(root.dataset.mode).toBe('light');
    expect(localStorage.getItem('theme')).toBe('light');
    expect(metas()).toEqual(['#fcfcfc', '#fcfcfc']);
  });

  it('shows the remembered choice when it loads', async () => {
    localStorage.setItem('theme', 'dark');

    render(ThemeToggle);

    const button = page.getByRole('button', { name: 'Tema escuro' });
    await expect.element(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps a manual choice when storage is blocked and the system preference changes', async () => {
    const mql = new EventTarget() as MediaQueryList;
    Object.defineProperty(mql, 'matches', { value: false });
    vi.spyOn(window, 'matchMedia').mockReturnValue(mql);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    render(ThemeToggle);

    const button = page.getByRole('button', { name: 'Tema escuro' });
    await button.click();

    // The new theme lands once the view transition has taken its snapshot.
    await expect.poll(() => root.dataset.mode).toBe('dark');
    mql.dispatchEvent(new MediaQueryListEvent('change', { matches: false }));
    expect(root.dataset.mode).toBe('dark');
  });

  it('shows the moon while light and the sun while dark, so the icon names what a click does', async () => {
    render(ThemeToggle);

    const button = page.getByRole('button', { name: 'Tema escuro' });
    const shown = () => button.element().querySelector('[data-shown="true"] [data-icon]');
    expect(shown()?.getAttribute('data-icon')).toBe('moon');
    await button.click();

    await expect.poll(() => shown()?.getAttribute('data-icon')).toBe('sun');
    // The moon stays in place to fade out; it is hidden, not removed.
    expect(
      button.element().querySelector('[data-shown="false"] [data-icon="moon"]'),
    ).not.toBeNull();
  });

  it('turns the icon only after a change, and never with reduced motion', async () => {
    render(ThemeToggle);

    const button = page.getByRole('button', { name: 'Tema escuro' });
    const glyph = () => button.element().querySelector('[data-shown]') as HTMLElement;
    expect(glyph().className).not.toContain('transition');
    await button.click();

    expect(glyph().className).toContain('transition');
    expect(glyph().className).toContain('motion-reduce:transition-none');
  });

  it('draws the rail item: the same icon and no label, pressed while dark', async () => {
    render(ThemeToggle, { rail: true });

    const button = page.getByRole('button', { name: 'Tema escuro' });
    // Icons only on the rail: the tooltip names it.
    expect(button.element().textContent?.trim()).toBe('');
    await expect.element(button).toHaveAttribute('aria-pressed', 'false');
    await button.click();

    await expect.element(button).toHaveAttribute('aria-pressed', 'true');
    expect(
      button.element().querySelector('[data-shown="true"] [data-icon]')?.getAttribute('data-icon'),
    ).toBe('sun');
  });

  it('grows the new theme from the button, and changes in place with reduced motion', async () => {
    const start = vi.spyOn(document, 'startViewTransition');
    render(ThemeToggle);

    const button = page.getByRole('button', { name: 'Tema escuro' });
    await button.click();
    await expect.element(button).toHaveAttribute('aria-pressed', 'true');
    expect(start).toHaveBeenCalledOnce();

    const reduce = window.matchMedia;
    vi.spyOn(window, 'matchMedia').mockImplementation((query) =>
      query.includes('reduced-motion')
        ? ({ matches: true, media: query } as MediaQueryList)
        : reduce.call(window, query),
    );
    await button.click();
    await expect.element(button).toHaveAttribute('aria-pressed', 'false');
    expect(root.dataset.mode).toBe('light');
    expect(start).toHaveBeenCalledOnce();
  });
});
