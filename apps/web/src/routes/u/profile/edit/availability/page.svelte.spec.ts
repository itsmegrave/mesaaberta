import '../../../../layout.css';
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

const show = (slots: string[]) =>
  render(Page, {
    data: { form: { data: { slots }, errors: {}, valid: false } } as never,
    form: null as never,
  });

const posted = () =>
  [...document.querySelectorAll<HTMLInputElement>('input[name="slots"]:checked')].map(
    (input) => input.value,
  );

describe('Quando posso jogar', () => {
  it('draws a week of 21 named checkboxes with the saved ones ticked', async () => {
    show(['fri-night']);
    expect(page.getByRole('checkbox').elements()).toHaveLength(21);
    await expect.element(page.getByRole('checkbox', { name: 'Sexta, Noite' })).toBeChecked();
    await expect.element(page.getByRole('checkbox', { name: 'Segunda, Manhã' })).not.toBeChecked();
  });

  it('ticks and unticks a slot, posting the ticked ones', async () => {
    show(['fri-night']);
    await page.getByRole('checkbox', { name: 'Sábado, Tarde' }).click();
    await page.getByRole('checkbox', { name: 'Sexta, Noite' }).click();
    expect(posted()).toEqual(['sat-afternoon']);
  });
});
