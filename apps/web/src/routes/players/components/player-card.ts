import { m } from '#lib/paraglide/messages.js';

const DAY_MS = 86_400_000;

/** The card's line of facts: "procurando há 3 dias · 5 mesas jogadas". */
export function playerFacts(
  player: { lookingSince: Date | string; played: number },
  now: Date,
): string {
  const days = Math.max(
    0,
    Math.floor((now.getTime() - new Date(player.lookingSince).getTime()) / DAY_MS),
  );
  return [
    m.players_looking_since({ count: days }),
    m.players_played({ count: player.played }),
  ].join(' · ');
}
