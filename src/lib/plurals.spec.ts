import { describe, expect, it } from 'vitest';
import { m } from '$lib/paraglide/messages.js';

// The label for a count has its own form for none and for one, never "0 mesas" or "1 mesas".
describe('labels with a count', () => {
  it.each([
    [() => m.dash_count({ count: 0 }), 'nenhuma mesa'],
    [() => m.dash_count({ count: 1 }), '1 mesa'],
    [() => m.dash_count({ count: 3 }), '3 mesas'],
    [() => m.tables_count({ count: 0 }), 'Nenhuma mesa com sessão marcada'],
    [() => m.tables_count({ count: 1 }), '1 mesa com sessão marcada'],
    [() => m.tables_count({ count: 2 }), '2 mesas com sessão marcada'],
    [() => m.table_seats_left({ count: 0 }), 'Nenhuma vaga restante'],
    [() => m.table_seats_left({ count: 1 }), '1 vaga restante'],
    [() => m.table_seats_left({ count: 4 }), '4 vagas restantes'],
    [() => m.form_capacity_seats({ count: 1 }), '1 vaga'],
    [() => m.form_capacity_seats({ count: 6 }), '6 vagas'],
    [() => m.rating_count({ count: 0 }), 'Sem avaliações'],
    [() => m.rating_count({ count: 1 }), '1 avaliação'],
    [() => m.rating_count({ count: 12 }), '12 avaliações'],
    [() => m.admin_announce_audience_size({ count: 1 }), '1 conta'],
    [() => m.admin_announce_audience_size({ count: '1.200' }), '1.200 contas'],
    [() => m.admin_history_notified({ count: 0 }), 'Não chegou a nenhuma conta'],
    [() => m.dash_banner({ count: 1, title: 'A' }), '1 pedido de vaga esperando você em A'],
    [() => m.dash_banner({ count: 2, title: 'A' }), '2 pedidos de vaga esperando você em A'],
  ])('%#', (label, text) => {
    expect(label()).toBe(text);
  });
});
