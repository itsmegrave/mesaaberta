import { createRawSnippet } from 'svelte';
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MACheckbox from './MACheckbox.svelte';

const children = createRawSnippet(() => ({ render: () => '<span>Avisar de mesas novas</span>' }));

describe('MACheckbox', () => {
  it('is named by its text and posts its name and value', async () => {
    await render(MACheckbox, { children, name: 'tables', value: 'true', checked: true });
    const box = page.getByRole('checkbox', { name: 'Avisar de mesas novas' });
    await expect.element(box).toBeChecked();
    const input = box.element() as HTMLInputElement;
    expect(input.name).toBe('tables');
    expect(input.value).toBe('true');
    expect(input.classList.contains('checkbox')).toBe(true);
  });

  it('toggles from a click on its text, and keeps the caller’s row classes', async () => {
    await render(MACheckbox, { children, name: 'seats', class: 'text-sm' });
    await page.getByText('Avisar de mesas novas').click();
    await expect.element(page.getByRole('checkbox')).toBeChecked();
    const row = page.getByRole('checkbox').element().closest('label')!;
    expect(row.classList.contains('text-sm')).toBe(true);
    expect(row.classList.contains('min-h-11')).toBe(true);
  });

  it('keeps the box by the first line when the text wraps', async () => {
    await render(MACheckbox, { children, name: 'confirm', align: 'start' });
    const input = page.getByRole('checkbox').element();
    expect(input.classList.contains('mt-1')).toBe(true);
    expect(input.closest('label')!.classList.contains('items-start')).toBe(true);
  });
});
