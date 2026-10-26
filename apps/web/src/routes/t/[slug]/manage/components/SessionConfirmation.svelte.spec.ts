import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SessionConfirmation from './SessionConfirmation.svelte';

const players = [
  { playerId: '00000000-0000-4000-8000-000000000001', username: 'ana', avatarUrl: null },
  { playerId: '00000000-0000-4000-8000-000000000002', username: 'bia', avatarUrl: null },
];
// The step links only change the step: follow one as a script would, by its click handler. (The
// unstyled links sit at the frame's edge, where a pointer click can miss them.)
const follow = (name: string) =>
  (page.getByRole('link', { name }).element() as HTMLElement).click();
// Saturday 26 September 2026, 19:00 in São Paulo.
const startsAt = new Date('2026-09-26T22:00:00Z');
// The test frame is phone sized, where the list of who showed up starts folded.
const openAttendance = () => page.getByRole('button', { name: /^Quem compareceu\?/ }).click();

describe('SessionConfirmation', () => {
  it('asks first whether the session happened, with its date', async () => {
    render(SessionConfirmation, { next: '/t/mesa/manage', players, startsAt });

    await expect
      .element(page.getByRole('heading', { name: 'A sessão de sábado aconteceu?' }))
      .toBeVisible();
    await expect.element(page.getByText('sábado, 26 de setembro, 19:00')).toBeVisible();
    await expect
      .element(page.getByRole('link', { name: 'Sim, aconteceu' }))
      .toHaveAttribute('href', '/t/mesa/manage?etapa=presenca');
    await expect
      .element(page.getByRole('button', { name: 'Não aconteceu' }))
      .toHaveAttribute('type', 'submit');
    await expect
      .element(page.getByRole('link', { name: 'Adiar sessão' }))
      .toHaveAttribute('href', '/t/mesa/manage?etapa=adiar');
    await expect.element(page.getByRole('checkbox')).not.toBeInTheDocument();
  });

  it('lists the confirmed players, all checked, in the presence step, and counts them', async () => {
    render(SessionConfirmation, { next: '/t/mesa/manage', players, startsAt });

    follow('Sim, aconteceu');

    await expect.element(page.getByRole('heading', { name: 'Marque a presença' })).toBeVisible();
    await openAttendance();
    const ana = page.getByRole('checkbox', { name: /^ana/ });
    await expect.element(ana).toBeChecked();
    await expect.element(page.getByRole('checkbox', { name: /^bia/ })).toBeChecked();
    await expect.element(page.getByText('2 de 2 presentes').first()).toBeVisible();
    const form = ana.element().closest('form')!;
    expect(form.getAttribute('action')).toBe('?/happened');
    // Without this marker the server cannot tell an empty list from a form that never asked.
    expect(form.querySelector('input[name="attendance"]')).not.toBeNull();
    await expect.element(page.getByRole('button', { name: 'Confirmar presença' })).toBeVisible();

    follow('Voltar');
    await expect
      .element(page.getByRole('heading', { name: 'A sessão de sábado aconteceu?' }))
      .toBeVisible();
  });

  it('folds who showed up on a phone, keeps the count in its header and still sends everyone', async () => {
    render(SessionConfirmation, { next: '/t/mesa/manage', players, step: 'presenca' });

    const toggle = page.getByRole('button', { name: /^Quem compareceu\?/ });
    await expect.element(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect.element(page.getByText('2 de 2 presentes').first()).toBeVisible();
    // Hidden content is out of the accessibility tree, but its boxes still post.
    await expect.element(page.getByRole('checkbox', { name: /^ana/ })).not.toBeInTheDocument();
    const form = toggle.element().closest('form')!;
    expect(new FormData(form).getAll('present')).toEqual(players.map((p) => p.playerId));

    await toggle.click();
    await page.getByRole('checkbox', { name: /^bia/ }).click();
    await expect.element(page.getByText('1 de 2 presentes').first()).toBeVisible();
  });

  it('sends only the players left checked, and marks the others absent', async () => {
    render(SessionConfirmation, { next: '/t/mesa/manage', players, step: 'presenca' });
    await openAttendance();

    await page.getByRole('checkbox', { name: /^bia/ }).click();

    await expect.element(page.getByText('Ausente', { exact: true })).toBeVisible();
    await expect.element(page.getByText('1 de 2 presentes').first()).toBeVisible();
    const form = page.getByRole('checkbox', { name: /^ana/ }).element().closest('form')!;
    expect(new FormData(form).getAll('present')).toEqual([players[0].playerId]);
  });

  it('locks a player who already rated as present, and still sends them', async () => {
    render(SessionConfirmation, {
      next: '/t/mesa/manage',
      players: [players[0], { ...players[1], rated: true }],
      multi: true,
      step: 'presenca',
    });
    await openAttendance();

    // The note is part of the label, so it is read with the name.
    const bia = page.getByRole('checkbox', { name: /^bia/ });
    await expect.element(bia).toBeChecked();
    await expect.element(bia).toBeDisabled();
    await expect
      .element(page.getByText('Já avaliou a mesa, então conta como presente.'))
      .toBeVisible();

    await page.getByRole('checkbox', { name: /^ana/ }).click();
    const form = bia.element().closest('form')!;
    expect(new FormData(form).getAll('present')).toEqual([players[1].playerId]);
  });

  it('confirms straight away when no one has a seat', async () => {
    render(SessionConfirmation, { next: '/t/mesa/manage', players: [] });

    const yes = page.getByRole('button', { name: 'Sim, aconteceu' });
    await expect.element(yes).toHaveAttribute('type', 'submit');
    expect(yes.element().closest('form')?.getAttribute('action')).toBe('?/happened');
  });

  it('for a campaign, asks if more sessions come and posts to the session-held action', async () => {
    render(SessionConfirmation, {
      next: '/t/mesa/manage',
      players,
      multi: true,
      nextSession: '2026-10-03T19:00',
      step: 'presenca',
    });
    await openAttendance();

    const form = page.getByRole('checkbox', { name: /^ana/ }).element().closest('form')!;
    expect(form.getAttribute('action')).toBe('?/sessionHeld');
    // The next date comes from the calendar picker, prefilled, with no duration.
    expect(new FormData(form).get('nextStartsAtLocal')).toBe('2026-10-03T19:00');
    expect(form.querySelector('input[name="durationHours"]')).toBeNull();
    await expect
      .element(page.getByText('sábado, 3 de outubro, às 19:00 · No seu fuso (GMT-3)'))
      .toBeVisible();
    await expect
      .element(page.getByRole('button', { name: 'Confirmar, a mesa continua' }))
      .toBeVisible();

    await page.getByRole('radio', { name: /Foi a última sessão/ }).click();

    expect(form.getAttribute('action')).toBe('?/happened');
    await expect
      .element(page.getByRole('button', { name: 'Confirmar e concluir a mesa' }))
      .toBeVisible();
  });

  it('for an adventure, asks for the next date with nothing prefilled', async () => {
    render(SessionConfirmation, {
      next: '/t/mesa/manage',
      players: [],
      multi: true,
      step: 'presenca',
    });

    await expect
      .element(page.getByText('Aventuras não têm repetição: diga quando é a próxima sessão.'))
      .toBeVisible();
    await expect.element(page.getByText('Escolha o dia e o horário.')).toBeVisible();
  });

  it('for a campaign that did not happen, skips the session or closes the table', async () => {
    render(SessionConfirmation, {
      next: '/t/mesa/manage',
      players,
      multi: true,
      nextSession: '2026-10-08T19:00',
    });

    follow('Não aconteceu');

    const skip = page.getByRole('button', { name: 'Não aconteceu, pular sessão' });
    await expect.element(skip).toBeVisible();
    const form = skip.element().closest('form')!;
    expect(form.getAttribute('action')).toBe('?/sessionSkipped');
    expect(new FormData(form).get('nextStartsAtLocal')).toBe('2026-10-08T19:00');

    await page.getByRole('radio', { name: /Encerrar a mesa/ }).click();

    expect(form.getAttribute('action')).toBe('?/notHeld');
    await expect
      .element(page.getByRole('button', { name: 'Não aconteceu, encerrar a mesa' }))
      .toBeVisible();
  });

  it('postpones with the calendar picker, not a native date field', async () => {
    render(SessionConfirmation, { next: '/t/mesa/manage', players, step: 'adiar' });

    await expect.element(page.getByRole('heading', { name: 'Adiar a sessão' })).toBeVisible();
    const submit = page.getByRole('button', { name: 'Adiar sessão' });
    const form = submit.element().closest('form')!;
    expect(form.getAttribute('action')).toBe('?/postpone');
    expect(form.querySelector('input[type="datetime-local"]')).toBeNull();
    expect(form.querySelector('input[name="startsAtLocal"]')).not.toBeNull();
    await expect
      .element(
        page.getByText(
          'Quem joga recebe um aviso com a nova data e o convite do calendário é atualizado.',
        ),
      )
      .toBeVisible();
  });
});
