import { page, userEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import KebabMenu from './KebabMenu.svelte';

const trigger = () => page.getByRole('button', { name: 'Mais ações: Mesa do Dragão' });

describe('KebabMenu', () => {
  it('is a button named after what it acts on, and says it opens a menu', async () => {
    render(KebabMenu, { name: 'Mesa do Dragão', items: [{ id: 'a', label: 'Editar' }] });

    await expect.element(trigger()).toHaveAttribute('aria-haspopup', 'menu');
  });

  it('runs the chosen item and closes', async () => {
    const onselect = vi.fn();
    render(KebabMenu, {
      name: 'Mesa do Dragão',
      items: [{ id: 'copy', label: 'Copiar link', onselect }],
    });

    await trigger().click();
    await page.getByRole('menuitem', { name: 'Copiar link' }).click();

    expect(onselect).toHaveBeenCalledOnce();
    await expect
      .element(page.getByRole('menuitem', { name: 'Copiar link' }))
      .not.toBeInTheDocument();
  });

  it('puts the destructive item last, after the others, whatever order it was given', async () => {
    render(KebabMenu, {
      name: 'Mesa do Dragão',
      items: [
        { id: 'remove', label: 'Remover…', destructive: true },
        { id: 'edit', label: 'Editar' },
        { id: 'copy', label: 'Copiar link' },
      ],
    });

    await trigger().click();

    const names = page
      .getByRole('menuitem')
      .elements()
      .map((element) => element.textContent?.trim());
    expect(names).toEqual(['Editar', 'Copiar link', 'Remover…']);
  });

  it('does not run a disabled item', async () => {
    const onselect = vi.fn();
    render(KebabMenu, {
      name: 'Mesa do Dragão',
      items: [{ id: 'x', label: 'Indisponível', onselect, disabled: true }],
    });

    await trigger().click();
    await page.getByRole('menuitem', { name: 'Indisponível' }).click({ force: true });

    expect(onselect).not.toHaveBeenCalled();
  });

  it('closes on Escape and returns focus to the button', async () => {
    render(KebabMenu, { name: 'Mesa do Dragão', items: [{ id: 'a', label: 'Editar' }] });

    await trigger().click();
    await expect.element(page.getByRole('menuitem', { name: 'Editar' })).toBeVisible();
    await userEvent.keyboard('{Escape}');

    await expect.element(page.getByRole('menuitem', { name: 'Editar' })).not.toBeInTheDocument();
    await expect.element(trigger()).toHaveFocus();
  });
});
