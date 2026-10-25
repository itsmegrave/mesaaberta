import '../../../routes/layout.css';
import { createRawSnippet } from 'svelte';
import { page, userEvent } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Tip from './Tip.svelte';

const trigger = createRawSnippet(() => ({ render: () => '<span>i</span>' }));
const children = createRawSnippet(() => ({ render: () => '<span>Só o mestre vê.</span>' }));
const props = { label: 'Mais informações', trigger, children };
const button = () => page.getByRole('button', { name: 'Mais informações' });
const card = () => page.getByText('Só o mestre vê.');

describe('Tip', () => {
  it('is a button named by its label that builds no card while closed (no inline style)', async () => {
    render(Tip, props);

    await expect.element(button()).toHaveAttribute('type', 'button');
    expect(document.querySelector('[data-part="positioner"]')).toBeNull();
    expect(card().elements()).toHaveLength(0);
  });

  it('closes on Escape', async () => {
    render(Tip, { ...props, open: true });

    await expect.element(card()).toBeVisible();

    await userEvent.keyboard('{Escape}');
    await expect.poll(() => card().elements().length).toBe(0);
  });

  it('shows the card when its owner opens it, above the page layers', async () => {
    render(Tip, { ...props, open: true });

    await expect.element(card()).toBeVisible();
    expect(document.querySelector('[data-part="positioner"]')?.classList).toContain('z-50!');
  });
});
