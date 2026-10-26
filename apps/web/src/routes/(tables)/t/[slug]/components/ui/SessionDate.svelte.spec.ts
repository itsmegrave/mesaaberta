import { createRawSnippet } from 'svelte';
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SessionDate from './SessionDate.svelte';
import SummaryRow from './SummaryRow.svelte';

const startsAt = new Date('2026-09-27T02:00:00Z');

describe('SessionDate', () => {
  it('shows the tile and the session in the table’s zone', async () => {
    await render(SessionDate, { startsAt, timezone: 'America/Sao_Paulo' });

    const tile = document.querySelector('[aria-hidden="true"]')!;
    expect(tile.textContent?.replace(/\s+/g, ' ').trim()).toBe('sáb 26 set');
    await expect.element(page.getByText('Próxima sessão')).toBeVisible();
    expect(document.querySelectorAll('p')).toHaveLength(2);
  });

  it('says the table’s state once it is past the open one', async () => {
    await render(SessionDate, {
      startsAt,
      timezone: 'America/Sao_Paulo',
      stateLabel: 'Concluída',
      large: true,
    });
    await expect.element(page.getByText('Concluída')).toBeVisible();
    expect(document.querySelector('.text-3xl')?.textContent).toBe('26');
  });
});

describe('SummaryRow', () => {
  it('pairs the label with its value', async () => {
    const children = createRawSnippet(() => ({ render: () => '<span>Toda semana</span>' }));
    await render(SummaryRow, { label: 'Frequência', class: 'flex gap-1', children });

    const term = document.querySelector('dt')!;
    expect(term.textContent?.trim()).toBe('Frequência');
    expect(term.nextElementSibling?.tagName).toBe('DD');
    expect(term.nextElementSibling?.classList.contains('flex')).toBe(true);
    expect(term.nextElementSibling?.textContent).toBe('Toda semana');
  });
});
