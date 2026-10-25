import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import NextSession from './NextSession.svelte';

describe('NextSession', () => {
  it('says when the next session is, in the table’s zone, with the calendar icon', async () => {
    await render(NextSession, {
      startsAt: new Date('2026-09-27T18:00:00Z'),
      timezone: 'America/Sao_Paulo',
    });

    const line = page.getByText('Próxima sessão:').element().parentElement!;
    expect(line.textContent).toMatch(/27 de setembro/);
    expect(line.textContent).toMatch(/15:00/);
    expect(document.querySelector('[data-icon="calendar"]')).not.toBeNull();
  });
});
