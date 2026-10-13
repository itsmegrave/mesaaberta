import '../../routes/layout.css';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import RunningCard from './RunningCard.svelte';

const person = (n: number, name: string) => ({
  playerId: `00000000-0000-4000-8000-00000000000${n}`,
  username: name,
});
const base = {
  slug: 'cronicas',
  title: 'Crônicas de Arton',
  tableStatus: 'active' as const,
  capacity: 4,
  timezone: 'America/Sao_Paulo',
  startsAt: new Date('2026-10-10T22:00:00Z'),
  players: [person(1, 'Ana'), person(2, 'Bruno')],
  requests: [person(3, 'Caio')],
};
const props = (over = {}) => ({ item: { ...base, ...over }, next: '/account/tables' });

describe('RunningCard', () => {
  beforeEach(async () => {
    await page.viewport(1280, 800);
  });

  it('shows the seats taken, the next session, and a way to edit or disable', async () => {
    render(RunningCard, props());

    await expect.element(page.getByText('2 de 4 vagas ocupadas')).toBeVisible();
    await expect.element(page.getByText(/sábado, 10 de outubro às 19:00/)).toBeVisible();
    await expect
      .element(page.getByRole('link', { name: 'Editar mesa' }))
      .toHaveAttribute('href', '/tables/cronicas/edit');
  });

  it('lists the players, each with a remove button that posts to the table and returns here', async () => {
    render(RunningCard, props());

    await expect.element(page.getByText('@Ana')).toBeVisible();
    const form = page.getByRole('button', { name: 'Remover' }).first().element().closest('form')!;

    expect(form.getAttribute('action')).toBe('/tables/cronicas?/remove');
    expect(form.querySelector<HTMLInputElement>('input[name=playerId]')?.value).toBe(
      base.players[0].playerId,
    );
    expect(form.querySelector<HTMLInputElement>('input[name=next]')?.value).toBe('/account/tables');
  });

  it('shows the queue of pending requests, with approve and decline for each', async () => {
    render(RunningCard, props());

    await expect.element(page.getByRole('heading', { name: 'Pedidos de vaga (1)' })).toBeVisible();
    await expect.element(page.getByText('@Caio')).toBeVisible();
    const approve = page.getByRole('button', { name: 'Aprovar' }).element().closest('form')!;
    const decline = page.getByRole('button', { name: 'Recusar' }).element().closest('form')!;

    expect(approve.getAttribute('action')).toBe('/tables/cronicas?/approve');
    expect(decline.getAttribute('action')).toBe('/tables/cronicas?/decline');
    expect(approve.querySelector<HTMLInputElement>('input[name=playerId]')?.value).toBe(
      base.requests[0].playerId,
    );
  });

  it('has no queue section when nobody is waiting', async () => {
    render(RunningCard, props({ requests: [] }));

    await expect.element(page.getByText(/Pedidos de vaga/)).not.toBeInTheDocument();
  });

  it('says so when nobody has a seat yet', async () => {
    render(RunningCard, props({ players: [], requests: [] }));

    await expect.element(page.getByText('Ninguém ainda.')).toBeVisible();
  });

  it('keeps showing the session date for a table that is not active, without a table status', async () => {
    render(RunningCard, props({ tableStatus: 'disabled' }));

    await expect.element(page.getByText('Mesa desativada')).not.toBeInTheDocument();
    await expect.element(page.getByText(/sábado, 10 de outubro às 19:00/)).toBeVisible();
  });

  it('shows names as text, never as markup', async () => {
    render(RunningCard, props({ requests: [person(4, '<img src=x onerror=alert(1)>')] }));

    await expect.element(page.getByText('@<img src=x onerror=alert(1)>')).toBeVisible();
    expect(document.querySelectorAll('img')).toHaveLength(0);
  });

  it('on a wide screen, always shows the players under a heading, with no fold button', async () => {
    render(RunningCard, props());

    await expect.element(page.getByRole('heading', { name: 'Participantes' })).toBeVisible();
    await expect.element(page.getByText('@Ana')).toBeVisible();
    await expect.element(page.getByText('Participantes (2)')).not.toBeVisible();
  });

  describe('on a phone', () => {
    beforeEach(async () => {
      await page.viewport(390, 844);
    });

    it('folds the players behind a button that says how many there are, and opens them', async () => {
      render(RunningCard, props());
      const toggle = page.getByRole('button', { name: 'Participantes (2)' });

      await expect.element(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect.element(page.getByText('@Ana')).not.toBeVisible();
      // The pending requests are not folded with them.
      await expect.element(page.getByText('@Caio')).toBeVisible();

      await toggle.click();

      await expect.element(toggle).toHaveAttribute('aria-expanded', 'true');
      await expect.element(page.getByText('@Ana')).toBeVisible();
      await expect.element(page.getByRole('button', { name: 'Remover' }).first()).toBeVisible();
    });

    it('starts with the players open when asked to', async () => {
      render(RunningCard, { ...props(), openPlayers: true });

      await expect
        .element(page.getByRole('button', { name: 'Participantes (2)' }))
        .toHaveAttribute('aria-expanded', 'true');
      await expect.element(page.getByText('@Bruno')).toBeVisible();
    });
  });
});
