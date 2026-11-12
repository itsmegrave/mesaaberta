import type { MatchPerson } from '@mesaaberta/core/server/matches/service';
import { m } from '#lib/paraglide/messages.js';

/** A colour seat for a person's card, steady across visits (from the @usuário). */
export function seatOf(username: string): 1 | 2 | 3 {
  let sum = 0;
  for (const char of username) sum = (sum + char.charCodeAt(0)) % 997;
  return ((sum % 3) + 1) as 1 | 2 | 3;
}

/** "Joga e mestra · Curitiba · online": the role, the city (presencial) and the formats. */
export function cardLine(person: Pick<MatchPerson, 'tableRole' | 'city' | 'online' | 'inPerson'>) {
  const role =
    person.tableRole === 'both'
      ? m.profile_table_role_both()
      : person.tableRole === 'gm'
        ? m.profile_table_role_gm()
        : person.tableRole === 'player'
          ? m.profile_table_role_player()
          : null;
  const formats = [
    person.online ? m.match_format_online() : null,
    person.inPerson ? (person.city ?? m.match_format_in_person()) : null,
  ];
  return [role, ...formats].filter(Boolean).join(' · ');
}
