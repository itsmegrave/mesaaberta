import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SessionPicker from './SessionPicker.svelte';

const hidden = (name: string) =>
  document.querySelector<HTMLInputElement>(`input[type="hidden"][name="${name}"]`)?.value;
const base = { timezone: 'America/Sao_Paulo', min: '2099-01-01' };

describe('SessionPicker.svelte', () => {
  it('shows the saved day, hour and length, and says them back in one sentence', async () => {
    render(SessionPicker, { ...base, startsAt: '2099-06-01T20:30', duration: 3 });

    await expect.element(page.getByRole('combobox', { name: 'Hora' })).toHaveValue('20');
    await expect.element(page.getByRole('combobox', { name: 'Minutos' })).toHaveValue('30');
    await expect.element(page.getByRole('radio', { name: '3 h' })).toBeChecked();
    await expect.element(page.getByRole('status')).toBeVisible();
    expect(page.getByRole('status').element().textContent).toContain('20:30, por 3 h');
    expect(page.getByRole('status').element().textContent).toContain('America/Sao Paulo');
    expect(hidden('startsAtLocal')).toBe('2099-06-01T20:30');
  });

  it('picks a day on the calendar, at 19:00 until an hour is chosen', async () => {
    render(SessionPicker, { ...base, startsAt: '', duration: 4 });

    await page.getByRole('button', { name: /15/ }).first().click();
    await expect.poll(() => hidden('startsAtLocal')).toMatch(/^\d{4}-\d{2}-15T19:00$/);

    await page.getByRole('combobox', { name: 'Hora' }).selectOptions('21');
    await page.getByRole('combobox', { name: 'Minutos' }).selectOptions('45');
    await expect.poll(() => hidden('startsAtLocal')).toMatch(/-15T21:45$/);
  });

  it('asks for a day before anything else', async () => {
    render(SessionPicker, { ...base, startsAt: '', duration: 4 });

    expect(page.getByRole('status').element().textContent).toContain(
      'Escolha o dia da primeira sessão.',
    );
    await expect.element(page.getByRole('combobox', { name: 'Hora' })).toBeDisabled();
  });

  it('chooses the length from the segments, or types another', async () => {
    render(SessionPicker, { ...base, startsAt: '2099-06-01T20:00', duration: 4 });

    await page.getByRole('radio', { name: '2 h' }).click();
    await expect.poll(() => hidden('durationHours')).toBe('2');

    await page.getByRole('radio', { name: 'Outra' }).click();
    await page.getByLabelText('Duração em horas').fill('5.5');
    await expect.poll(() => hidden('durationHours')).toBe('5.5');
  });

  it('opens "Outra" for a saved length that is not one of the segments', async () => {
    render(SessionPicker, { ...base, startsAt: '2099-06-01T20:00', duration: 6 });

    await expect.element(page.getByRole('radio', { name: 'Outra' })).toBeChecked();
    await expect.element(page.getByLabelText('Duração em horas')).toHaveValue(6);
  });
});
