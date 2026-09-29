import { describe, expect, it } from 'vitest';
import { notificationIcon, notificationText, type Shown } from './text';

const shown = (over: Partial<Shown>): Shown => ({
  type: 'table_updated',
  icon: null,
  title: null,
  body: null,
  metadata: { tableId: 't', slug: 'mesa', title: 'Mesa do Dragão' },
  actor: null,
  ...over,
});

describe('notificationText', () => {
  it('words a domain notification with the table and whoever caused it', () => {
    expect(notificationText(shown({ type: 'join_requested', actor: 'ana' }))).toBe(
      '@ana pediu uma vaga em Mesa do Dragão.',
    );
    expect(notificationText(shown({ type: 'table_cancelled' }))).toBe(
      'A mesa Mesa do Dragão foi cancelada.',
    );
  });

  it('says someone when the account behind it is gone', () => {
    expect(notificationText(shown({ type: 'player_left' }))).toBe('Alguém saiu de Mesa do Dragão.');
  });

  it('shows an announcement as it was written', () => {
    expect(
      notificationText(
        shown({ type: 'system_announcement', title: 'Manutenção', body: 'Sábado, 2h' }),
      ),
    ).toBe('Manutenção: Sábado, 2h');
  });

  it('falls back for a type it does not know', () => {
    expect(notificationText(shown({ type: 'something_new' }))).toBe('Nova notificação.');
  });
});

describe('notificationIcon', () => {
  it("uses the notification's own icon, else its type's", () => {
    expect(notificationIcon({ type: 'system_announcement', icon: 'calendar' })).toBe('calendar');
    expect(notificationIcon({ type: 'rating_received', icon: null })).toBe('star');
    expect(notificationIcon({ type: 'rating_received', icon: 'not-an-icon' })).toBe('star');
  });
});
