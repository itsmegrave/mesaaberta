import { createRawSnippet } from 'svelte';
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MAButton from './MAButton.svelte';

const children = createRawSnippet(() => ({ render: () => '<span>Salvar</span>' }));
const button = () => page.getByRole('button', { name: /Salvar|Ainda salvando/ });

describe('MAButton as a submit button', () => {
  it('is a plain submit button while nothing is pending', async () => {
    render(MAButton, { type: 'submit', children });

    await expect.element(button()).toHaveAttribute('type', 'submit');
    await expect.element(button()).not.toHaveAttribute('aria-disabled');
    await expect.element(button()).not.toHaveAttribute('aria-busy');
    expect(button().element().querySelector('svg')).toBeNull();
  });

  it('shows a spinner once the submit is slow, and says it is busy without losing focus', async () => {
    render(MAButton, { type: 'submit', children, delayed: true });

    await expect.element(button()).toHaveAttribute('aria-busy', 'true');
    // aria-disabled, not disabled: the button keeps its place in the tab order and its focus.
    await expect.element(button()).toHaveAttribute('aria-disabled', 'true');
    expect((button().element() as HTMLButtonElement).disabled).toBe(false);
    expect(button().element().querySelector('svg')).not.toBeNull();
    await expect.element(button()).toHaveTextContent('Salvar');
  });

  it('is aria-disabled and busy from the moment it is sending, never before the first attempt', async () => {
    render(MAButton, { type: 'submit', children, submitting: true });

    await expect.element(button()).toHaveAttribute('aria-disabled', 'true');
    await expect.element(button()).toHaveAttribute('aria-busy', 'true');
  });

  it('says it is still saving when the submit takes very long', async () => {
    render(MAButton, { type: 'submit', children, delayed: true, timeout: true });

    await expect.element(button()).toHaveTextContent('Ainda salvando…');
  });

  it('ignores a click while busy, so a slow form is never sent twice', async () => {
    let submits = 0;
    const form = document.createElement('form');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submits++;
    });
    render(MAButton, { type: 'submit', children, delayed: true });
    // Moved into a real form, so a click that got through would submit it.
    form.appendChild(button().element());
    document.body.appendChild(form);

    // A DOM click: Playwright itself refuses to click an aria-disabled button, as a person would.
    (button().element() as HTMLButtonElement).click();

    expect(submits).toBe(0);
    form.remove();
  });

  it('looks busy from the moment it is sending, before the spinner, so a tap is never silent', async () => {
    render(MAButton, { type: 'submit', children, submitting: true });

    await expect.element(button()).toHaveAttribute('aria-busy', 'true');
    // Dimmed with a progress cursor (the specs run without the stylesheet, so read the classes).
    await expect.element(button()).toHaveClass(/opacity-85/);
    await expect.element(button()).toHaveClass(/cursor-progress/);
  });

  it('looks like itself again once nothing is pending', async () => {
    render(MAButton, { type: 'submit', children });

    await expect.element(button()).not.toHaveClass(/opacity-85/);
    await expect.element(button()).not.toHaveClass(/cursor-progress/);
  });

  it('ignores a second click from the moment the form is sent, before the spinner shows', async () => {
    let submits = 0;
    const form = document.createElement('form');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submits++;
    });
    render(MAButton, { type: 'submit', children, submitting: true });
    form.appendChild(button().element());
    document.body.appendChild(form);

    (button().element() as HTMLButtonElement).click();

    expect(submits).toBe(0);
    // Announced as busy at once, but nothing is drawn yet, so a quick submit does not flash a spinner.
    await expect.element(button()).toHaveAttribute('aria-busy', 'true');
    expect(button().element().querySelector('svg')).toBeNull();
    form.remove();
  });

  it('takes the classes of the button it replaces', async () => {
    render(MAButton, { type: 'submit', children, class: 'btn h-12 preset-filled-primary-500' });

    await expect.element(button()).toHaveClass('btn', 'h-12', 'preset-filled-primary-500');
  });
});
