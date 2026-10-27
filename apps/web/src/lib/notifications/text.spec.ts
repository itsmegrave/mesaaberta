import { describe, expect, it } from 'vitest';
import { isAlert, notificationIcon, notificationText, type Shown } from './text';

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

  it('words the follow notices with the GM or the new follower', () => {
    expect(notificationText(shown({ type: 'followed_table_opened', actor: 'mestre' }))).toBe(
      '@mestre abriu uma mesa nova: Mesa do Dragão.',
    );
    expect(notificationText(shown({ type: 'followed_seat_opened', actor: 'mestre' }))).toBe(
      'Abriu uma vaga em Mesa do Dragão, de @mestre.',
    );
    expect(notificationText(shown({ type: 'follow_started', actor: 'ana', metadata: {} }))).toBe(
      '@ana começou a seguir você.',
    );
  });

  it('tells the submitter an admin approved or turned down their place, and why', () => {
    const notice = (metadata: Record<string, string>) =>
      notificationText(shown({ type: 'moderation_notice', metadata }));
    expect(notice({ placeApproved: 'Taverna do Dado' })).toBe(
      'Seu lugar “Taverna do Dado” foi aprovado e já aparece em Onde jogar.',
    );
    expect(notice({ placeRemoved: 'Taverna do Dado', reason: 'place_closed' })).toBe(
      'Seu lugar “Taverna do Dado” não está em Onde jogar. Motivo: O lugar fechou.',
    );
    expect(notice({ placeRemoved: 'Taverna', reason: 'not_public', note: 'É uma casa' })).toMatch(
      /Recado: É uma casa$/,
    );
  });

  it('raises the alert when reports hide a place, and tells its keepers neutrally', () => {
    expect(
      notificationText(shown({ type: 'place_hidden_alert', metadata: { place: 'Taverna' } })),
    ).toBe('Alerta: “Taverna” recebeu muitas denúncias e foi ocultado. Restaure ou remova.');
    expect(isAlert({ type: 'place_hidden_alert', read: false })).toBe(true);
    expect(isAlert({ type: 'place_hidden_alert', read: true })).toBe(false);
    const notice = (metadata: Record<string, string>) =>
      notificationText(shown({ type: 'moderation_notice', metadata }));
    expect(notice({ placeHidden: 'Taverna' })).toMatch(/temporariamente oculto/);
    expect(notice({ placeRestored: 'Taverna' })).toBe(
      'Seu lugar “Taverna” voltou para Onde jogar.',
    );
  });

  it('names the suggestion an admin decided on, and where a merge sent it', () => {
    const metadata = { kind: 'tag', name: 'Gore', into: 'Terror' };
    expect(notificationText(shown({ type: 'catalog_suggestion_rejected', metadata }))).toBe(
      'Sua sugestão “Gore” não foi aceita no catálogo.',
    );
    expect(notificationText(shown({ type: 'catalog_suggestion_merged', metadata }))).toBe(
      'Sua sugestão “Gore” foi unida a “Terror”, que já existia.',
    );
  });

  it('names the badge that was earned, or says a new one arrived when it has no artwork yet', () => {
    expect(
      notificationText(shown({ type: 'badge_earned', metadata: { badgeId: 'first-table' } })),
    ).toBe('Você ganhou a conquista Primeira mesa.');
    expect(
      notificationText(shown({ type: 'badge_earned', metadata: { badgeId: 'not-yet' } })),
    ).toBe('Uma conquista nova chegou ao seu perfil.');
  });

  it('says what changed on a table, with the old and new start in the viewer timezone', () => {
    const base = { tableId: 't', slug: 'mesa', title: 'Mesa do Dragão' };
    const moved = shown({
      metadata: {
        ...base,
        changed: 'startsAt,locationArea',
        startsAtFrom: '2026-10-10T22:00:00.000Z',
        startsAtTo: '2026-10-11T21:00:00.000Z',
      },
    });
    // ICU words the date and time joint differently across versions (", " or " às "), so match around it.
    expect(notificationText(moved, 'America/Sao_Paulo')).toMatch(
      /^A mesa Mesa do Dragão mudou de horário: de sábado, 10 de outubro.+19:00 GMT-3 para domingo, 11 de outubro.+18:00 GMT-3\. Também mudou: local\.$/,
    );
    expect(notificationText(moved, 'Europe/Lisbon')).toMatch(
      /de sábado, 10 de outubro.+23:00 GMT\+1/,
    );
    expect(
      notificationText(
        shown({ metadata: { ...base, changed: 'durationMinutes,modality,locationArea' } }),
      ),
    ).toBe('A mesa Mesa do Dragão mudou: duração e local.');
    // A notice written before the summary existed stays generic.
    expect(notificationText(shown({}))).toBe(
      'A mesa Mesa do Dragão mudou. Confira data, horário e local.',
    );
  });

  it('reminds of a session with its start in the viewer timezone', () => {
    const base = { tableId: 't', slug: 'mesa', title: 'Mesa do Dragão' };
    const reminder = (metadata: Record<string, string>) =>
      shown({ type: 'session_reminder', metadata: { ...base, ...metadata } });
    expect(
      notificationText(
        reminder({ startsAt: '2026-10-10T22:00:00.000Z', window: '24h' }),
        'America/Sao_Paulo',
      ),
    ).toMatch(/^Lembrete: a sessão de Mesa do Dragão é sábado, 10 de outubro.+19:00 GMT-3\.$/);
    expect(
      notificationText(
        reminder({ startsAt: '2026-10-10T22:00:00.000Z', window: '1h' }),
        'Europe/Lisbon',
      ),
    ).toMatch(/^A sessão de Mesa do Dragão começa em menos de uma hora: .+23:00 GMT\+1\.$/);
    expect(notificationText(reminder({}))).toBe('A sessão de Mesa do Dragão está chegando.');
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
