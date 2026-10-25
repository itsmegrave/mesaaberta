import { m } from '#lib/paraglide/messages.js';
import type { IconName } from '#lib/icons/names.js';

export type BadgePresentation = {
  icon: IconName;
  /** 1 to 3 on a ladder (the higher the stronger the look); 0 for a badge with one level. */
  tier: 0 | 1 | 2 | 3;
  name: () => string;
  description: () => string;
};

/**
 * How each badge looks and reads. Keyed by the catalog's ids (`@mesaaberta/core/server/badges/catalog`)
 * plus the ones only a backfill or an admin gives. A badge missing here is not shown, so a new id
 * can ship in the catalog before its artwork does.
 */
export const BADGE_PRESENTATION: Record<string, BadgePresentation> = {
  'first-table': {
    icon: 'game-icons:rolling-dices',
    tier: 0,
    name: m.badge_first_table_name,
    description: m.badge_first_table_description,
  },
  'regular-player-1': {
    icon: 'game-icons:wooden-chair',
    tier: 1,
    name: m.badge_regular_player_1_name,
    description: m.badge_regular_player_1_description,
  },
  'regular-player-2': {
    icon: 'game-icons:wooden-chair',
    tier: 2,
    name: m.badge_regular_player_2_name,
    description: m.badge_regular_player_2_description,
  },
  'regular-player-3': {
    icon: 'game-icons:wooden-chair',
    tier: 3,
    name: m.badge_regular_player_3_name,
    description: m.badge_regular_player_3_description,
  },
  'system-explorer': {
    icon: 'game-icons:compass',
    tier: 0,
    name: m.badge_system_explorer_name,
    description: m.badge_system_explorer_description,
  },
  'in-person-table': {
    icon: 'game-icons:round-table',
    tier: 0,
    name: m.badge_in_person_table_name,
    description: m.badge_in_person_table_description,
  },
  'thoughtful-critic': {
    icon: 'game-icons:quill-ink',
    tier: 0,
    name: m.badge_thoughtful_critic_name,
    description: m.badge_thoughtful_critic_description,
  },
  'gm-first': {
    icon: 'game-icons:spell-book',
    tier: 0,
    name: m.badge_gm_first_name,
    description: m.badge_gm_first_description,
  },
  'gm-master-1': {
    icon: 'game-icons:wizard-staff',
    tier: 1,
    name: m.badge_gm_master_1_name,
    description: m.badge_gm_master_1_description,
  },
  'gm-master-2': {
    icon: 'game-icons:wizard-staff',
    tier: 2,
    name: m.badge_gm_master_2_name,
    description: m.badge_gm_master_2_description,
  },
  'gm-master-3': {
    icon: 'game-icons:wizard-staff',
    tier: 3,
    name: m.badge_gm_master_3_name,
    description: m.badge_gm_master_3_description,
  },
  partner: {
    icon: 'game-icons:shaking-hands',
    tier: 0,
    name: m.badge_partner_name,
    description: m.badge_partner_description,
  },
  pioneer: {
    icon: 'game-icons:sunrise',
    tier: 0,
    name: m.badge_pioneer_name,
    description: m.badge_pioneer_description,
  },
};

export const presentationOf = (badgeId: string): BadgePresentation | null =>
  BADGE_PRESENTATION[badgeId] ?? null;
