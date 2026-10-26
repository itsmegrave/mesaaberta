import '../../../../layout.css';
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

const systems = Array.from({ length: 14 }, (_, n) => ({
  name: `Sistema ${n + 1}`,
  slug: `s${n + 1}`,
}));

const show = (picked: string[], show = true) =>
  render(Page, {
    data: {
      systems,
      form: { data: { systems: picked, show }, errors: {}, valid: false },
    } as never,
    form: null as never,
  });

describe('Sistemas favoritos', () => {
  it('lists the chosen systems with a button to take each out, and counts them', async () => {
    show(['s2']);

    const yours = page.getByRole('list', { name: 'Seus sistemas' });
    await expect.element(yours.getByText('Sistema 2')).toBeVisible();
    await expect.element(page.getByText('1 de 10')).toBeVisible();

    await page.getByRole('button', { name: 'Tirar Sistema 2' }).click();
    await expect.element(page.getByText('Nenhum sistema escolhido ainda.')).toBeVisible();
    await expect.element(page.getByText('0 de 10')).toBeVisible();
  });

  it('offers the twelve most played as checkboxes that add and remove a system', async () => {
    show([]);

    const popular = page.getByRole('group', { name: 'Mais jogados na Mesa Aberta' });
    expect(popular.getByRole('checkbox').elements()).toHaveLength(12);
    await popular.getByText('Sistema 3').click();

    await expect
      .element(page.getByRole('list', { name: 'Seus sistemas' }).getByText('Sistema 3'))
      .toBeVisible();
    // The search box posts the picks.
    expect(
      [...document.querySelectorAll<HTMLInputElement>('input[name="systems"]')].map((i) => i.value),
    ).toEqual(['s3']);
  });

  it('stops offering more once ten are chosen', async () => {
    show(['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's13']);

    const popular = page.getByRole('group', { name: 'Mais jogados na Mesa Aberta' });
    await expect.element(popular.getByRole('checkbox', { name: 'Sistema 10' })).toBeDisabled();
    await expect.element(popular.getByRole('checkbox', { name: 'Sistema 1' })).toBeEnabled();
  });

  it('has the switch that shows them on the public profile', async () => {
    show([], false);
    await expect
      .element(page.getByRole('checkbox', { name: 'Mostrar no meu perfil público' }))
      .not.toBeChecked();
    await expect.element(page.getByRole('button', { name: 'Salvar sistemas' })).toBeVisible();
  });
});
