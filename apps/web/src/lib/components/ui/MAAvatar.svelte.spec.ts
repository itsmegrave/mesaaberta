import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MAAvatar from './MAAvatar.svelte';

describe('MAAvatar', () => {
  it('renders fallback initial with user display name', async () => {
    render(MAAvatar, { name: 'Marina Alves' });

    const fallback = page.getByText('M');
    await expect.element(fallback).toBeInTheDocument();
  });

  it('renders image when src is provided with decorative alt=""', async () => {
    render(MAAvatar, {
      src: 'https://example.com/photo.jpg',
      name: 'Marina Alves',
    });

    const img = document.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('alt')).toBe('');
    expect(img?.getAttribute('aria-hidden')).toBe('true');
  });

  it('applies the requested semantic color', async () => {
    render(MAAvatar, { name: 'Carlos', color: 'secondary' });

    const fallback = document.querySelector('[data-part="fallback"]');
    expect(fallback?.classList.contains('preset-filled-secondary-500')).toBe(true);
  });

  it('falls back to ? when name is missing or empty', async () => {
    render(MAAvatar, {});

    const fallback = page.getByText('?');
    await expect.element(fallback).toBeInTheDocument();
  });
});
