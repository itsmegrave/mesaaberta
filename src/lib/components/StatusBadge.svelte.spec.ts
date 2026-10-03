import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import StatusBadge, { type Status } from './StatusBadge.svelte';

describe('StatusBadge', () => {
  it.each<[Status, string]>([
    ['user:active', 'Ativo'],
    ['user:suspended', 'Suspenso'],
    ['user:banned', 'Banido'],
    ['table:active', 'Ativa'],
    ['table:awaiting_confirmation', 'Aguardando confirmação'],
    ['table:concluded', 'Concluída'],
    ['table:not_held', 'Não realizada'],
    ['table:disabled', 'Desativada'],
    ['seat:pending', 'Pendente'],
    ['seat:confirmed', 'Confirmada'],
  ])('says %s in words, so the colour is never the only signal', async (status, word) => {
    render(StatusBadge, { status });

    await expect.element(page.getByText(word, { exact: true })).toBeVisible();
  });

  it('hides the dot from screen readers and draws "not held" hollow', async () => {
    const { container } = await render(StatusBadge, { status: 'table:not_held' });

    const dot = container.querySelector('span[aria-hidden="true"]');
    expect(dot).not.toBeNull();
    expect(dot?.className).toContain('bg-transparent');
  });
});
