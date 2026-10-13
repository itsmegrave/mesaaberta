import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import StarRating from './StarRating.svelte';

describe('StarRating.svelte', () => {
  it('is five stars under its label', async () => {
    render(StarRating, { name: 'gmScore', label: 'O mestre' });

    await expect.element(page.getByText('O mestre')).toBeVisible();
    expect(document.querySelectorAll('[data-part="item"]')).toHaveLength(5);
  });

  it('sends the score a click sets, and tells the form', async () => {
    const onchange = vi.fn();
    render(StarRating, { name: 'gmScore', label: 'O mestre', onchange });

    (document.querySelectorAll('[data-part="item"]')[3] as HTMLElement).click();

    await vi.waitFor(() => expect(onchange).toHaveBeenCalledWith(4));
    expect(document.querySelector<HTMLInputElement>('input[name="gmScore"]')?.value).toBe('4');
  });

  it('shows the score it was given', async () => {
    render(StarRating, { name: 'gmScore', label: 'O mestre', value: 3 });

    const items = [...document.querySelectorAll('[data-part="item"]')];
    expect(items.filter((item) => item.hasAttribute('data-highlighted'))).toHaveLength(3);
  });
});
