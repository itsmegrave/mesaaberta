import { createRawSnippet } from 'svelte';
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Pill from './Pill.svelte';

const children = createRawSnippet(() => ({ render: () => '<span>Rascunho</span>' }));

describe('Pill', () => {
  it('is filled in the primary colour by default', async () => {
    await render(Pill, { children });
    const pill = page.getByText('Rascunho').element().parentElement!;
    expect(pill.classList.contains('preset-filled-primary-500')).toBe(true);
    expect(pill.classList.contains('rounded-full')).toBe(true);
  });

  it('takes the waiting colour or an outline, and the caller’s placement', async () => {
    await render(Pill, { children, tone: 'outline', class: 'shrink-0' });
    const pill = page.getByText('Rascunho').element().parentElement!;
    expect(pill.classList.contains('border')).toBe(true);
    expect(pill.classList.contains('shrink-0')).toBe(true);
    expect(pill.classList.contains('preset-filled-primary-500')).toBe(false);
  });
});
