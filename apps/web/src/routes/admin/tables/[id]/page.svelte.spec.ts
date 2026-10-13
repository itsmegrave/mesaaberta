import '../../../layout.css';
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

const data = (over = {}) =>
  ({
    table: {
      id: '00000000-0000-4000-8000-000000000001',
      slug: 'delfos',
      title: 'Delfos',
      status: 'awaiting_confirmation',
      system: 'D&D 5.5e',
      gm: 'mestre',
      gmId: 'g',
      startsAt: new Date('2026-10-10T22:00:00Z'),
      timezone: 'America/Sao_Paulo',
      capacity: 5,
    },
    history: {
      entries: [
        {
          id: 'e1',
          type: 'TableUpdated',
          at: new Date('2026-10-01T15:30:00Z'),
          actor: { id: 'g', username: 'mestre' },
          subject: null,
          table: 'Delfos',
          removed: false,
          changes: { title: { from: 'Antes', to: 'Delfos' } },
        },
      ],
      more: false,
      retentionDays: 90,
    },
    viewer: { timezone: 'America/Sao_Paulo' },
    ...over,
  }) as never;

describe('admin table page', () => {
  it('summarises the table: who runs it, its one date and where it stands', async () => {
    render(Page, { data: data() });

    await expect.element(page.getByRole('heading', { name: 'Delfos', level: 1 })).toBeVisible();
    expect(document.body.textContent).toContain('@mestre');
    expect(document.body.textContent).toMatch(/10 out/);
  });

  it('lists what happened, with who did it and what an edit changed', async () => {
    render(Page, { data: data() });

    await expect.element(page.getByRole('heading', { name: 'Histórico' })).toBeVisible();
    expect(document.body.textContent).toMatch(/@mestre\s+editou/);
    expect(document.body.textContent).toContain('Antes');
  });

  it('says so when nothing was recorded', async () => {
    render(Page, {
      data: data({ history: { entries: [], more: false, retentionDays: 90 } }),
    });

    await expect.element(page.getByText('Nada registrado ainda.')).toBeVisible();
  });
});
