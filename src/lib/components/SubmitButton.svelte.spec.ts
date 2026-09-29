import { createRawSnippet } from 'svelte';
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SubmitButton from './SubmitButton.svelte';

const children = createRawSnippet(() => ({ render: () => '<span>Salvar</span>' }));
const button = () => page.getByRole('button', { name: /Salvar|Ainda salvando/ });

describe('SubmitButton', () => {
  it('is a plain submit button while nothing is pending', async () => {
    render(SubmitButton, { children });

    await expect.element(button()).toHaveAttribute('type', 'submit');
    await expect.element(button()).not.toHaveAttribute('aria-disabled');
    await expect.element(button()).not.toHaveAttribute('aria-busy');
    expect(button().element().querySelector('svg')).toBeNull();
  });

  it('shows a spinner once the submit is slow, and says it is busy without losing focus', async () => {
    render(SubmitButton, { children, delayed: true });

    await expect.element(button()).toHaveAttribute('aria-busy', 'true');
    // aria-disabled, not disabled: the button keeps its place in the tab order and its focus.
    await expect.element(button()).toHaveAttribute('aria-disabled', 'true');
    expect((button().element() as HTMLButtonElement).disabled).toBe(false);
    expect(button().element().querySelector('svg')).not.toBeNull();
    await expect.element(button()).toHaveTextContent('Salvar');
  });

  it('says it is still saving when the submit takes very long', async () => {
    render(SubmitButton, { children, delayed: true, timeout: true });

    await expect.element(button()).toHaveTextContent('Ainda salvando…');
  });

  it('ignores a click while busy, so a slow form is never sent twice', async () => {
    let submits = 0;
    const form = document.createElement('form');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submits++;
    });
    render(SubmitButton, { children, delayed: true });
    // Moved into a real form, so a click that got through would submit it.
    form.appendChild(button().element());
    document.body.appendChild(form);

    // A DOM click: Playwright itself refuses to click an aria-disabled button, as a person would.
    (button().element() as HTMLButtonElement).click();

    expect(submits).toBe(0);
    form.remove();
  });

  it('ignores a second click from the moment the form is sent, before the spinner shows', async () => {
    let submits = 0;
    const form = document.createElement('form');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submits++;
    });
    render(SubmitButton, { children, submitting: true });
    form.appendChild(button().element());
    document.body.appendChild(form);

    (button().element() as HTMLButtonElement).click();

    expect(submits).toBe(0);
    // Nothing shows yet, so a quick submit does not flash a spinner.
    await expect.element(button()).not.toHaveAttribute('aria-busy');
    expect(button().element().querySelector('svg')).toBeNull();
    form.remove();
  });

  it('takes the classes of the button it replaces', async () => {
    render(SubmitButton, { children, class: 'btn h-12 preset-filled-primary-500' });

    await expect.element(button()).toHaveClass('btn', 'h-12', 'preset-filled-primary-500');
  });
});
