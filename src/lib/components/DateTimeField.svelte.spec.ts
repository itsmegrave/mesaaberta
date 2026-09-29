import { page, userEvent } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import DateTimeField from './DateTimeField.svelte';

const hidden = () =>
  document.querySelector<HTMLInputElement>('input[type="hidden"][name="startsAtLocal"]')?.value;
const base = { id: 'startsAtLocal', name: 'startsAtLocal', label: 'Primeira sessão' };

describe('DateTimeField.svelte', () => {
  it('shows the saved day the way Brazil writes it, and the hour next to it', async () => {
    render(DateTimeField, { ...base, withTime: true, value: '2099-06-01T20:30' });

    await expect.element(page.getByLabelText('Primeira sessão')).toHaveValue('01/06/2099');
    await expect.element(page.getByLabelText('Hora de Primeira sessão')).toHaveValue('20:30');
    expect(hidden()).toBe('2099-06-01T20:30');
  });

  it('picks a day on the calendar, at 19:00 until an hour is typed', async () => {
    render(DateTimeField, { ...base, withTime: true, value: '2099-06-01T20:30' });

    await page.getByRole('button', { name: 'Abrir o calendário de Primeira sessão' }).click();
    await page.getByRole('button', { name: /15/ }).first().click();
    await expect.poll(hidden).toBe('2099-06-15T20:30');

    await page.getByLabelText('Hora de Primeira sessão').fill('21:00');
    await expect.poll(hidden).toBe('2099-06-15T21:00');
  });

  it('takes a day typed as dd/mm/aaaa', async () => {
    render(DateTimeField, { ...base, withTime: true, value: '' });

    const day = page.getByLabelText('Primeira sessão');
    await day.fill('10/10/2099');
    await userEvent.keyboard('{Enter}');
    await expect.poll(hidden).toBe('2099-10-10T19:00');
  });

  it('sends only the day without the hour', async () => {
    render(DateTimeField, { id: 'until', name: 'until', label: 'Última sessão até', value: '' });

    await page.getByLabelText('Última sessão até').fill('20/12/2099');
    await userEvent.keyboard('{Enter}');
    await expect
      .poll(() => document.querySelector<HTMLInputElement>('input[name="until"]')?.value)
      .toBe('2099-12-20');
  });
});
