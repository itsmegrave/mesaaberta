import { m } from '#lib/paraglide/messages.js';
import type { IconName } from '#lib/icons/names.js';

export type BadgePresentation = {
  icon: IconName;
  /** A short text ("100!") drawn on the medal instead of the icon. */
  mark?: string;
  /** 1 to 3 on a ladder (the higher the stronger the look); 0 for a badge with one level. */
  tier: 0 | 1 | 2 | 3;
  /** The ladder this badge is a rung of, so a visitor sees only the highest one held. */
  ladder?: string;
  /** Given by the team only: the owner sees it locked as "Concedida pela equipe". */
  manual?: boolean;
  name: () => string;
  /** What it says once earned ("Jogou 5 sessões."). */
  description: () => string;
  /** What it asks while locked ("Jogar 5 sessões."). Missing: it cannot be worked toward. */
  goal?: () => string;
  /** "14 de 25 sessões" for the progress bar. */
  progress?: (values: { current: number }) => string;
};

/**
 * How each badge looks and reads. Keyed by the catalog's ids (`@mesaaberta/core/server/badges/catalog`)
 * plus the ones only a backfill or an admin gives. A badge missing here is not shown, so a new id
 * can ship in the catalog before its artwork does.
 */
export const BADGE_PRESENTATION: Record<string, BadgePresentation> = {
  'first-table': {
    icon: 'game-icons:wooden-chair',
    tier: 0,
    name: m.badge_first_table_name,
    description: m.badge_first_table_description,
    goal: m.badge_first_table_goal,
    progress: m.badge_first_table_progress,
  },
  'regular-player-1': {
    icon: 'game-icons:rolling-dices',
    tier: 1,
    ladder: 'regular-player',
    name: m.badge_regular_player_1_name,
    description: m.badge_regular_player_1_description,
    goal: m.badge_regular_player_1_goal,
    progress: m.badge_regular_player_1_progress,
  },
  'regular-player-2': {
    icon: 'game-icons:rolling-dices',
    tier: 2,
    ladder: 'regular-player',
    name: m.badge_regular_player_2_name,
    description: m.badge_regular_player_2_description,
    goal: m.badge_regular_player_2_goal,
    progress: m.badge_regular_player_2_progress,
  },
  'regular-player-3': {
    icon: 'game-icons:rolling-dices',
    tier: 3,
    ladder: 'regular-player',
    name: m.badge_regular_player_3_name,
    description: m.badge_regular_player_3_description,
    goal: m.badge_regular_player_3_goal,
    progress: m.badge_regular_player_3_progress,
  },
  'system-explorer': {
    icon: 'game-icons:compass',
    tier: 0,
    name: m.badge_system_explorer_name,
    description: m.badge_system_explorer_description,
    goal: m.badge_system_explorer_goal,
    progress: m.badge_system_explorer_progress,
  },
  'in-person-table': {
    icon: 'game-icons:round-table',
    tier: 0,
    name: m.badge_in_person_table_name,
    description: m.badge_in_person_table_description,
    goal: m.badge_in_person_table_goal,
    progress: m.badge_in_person_table_progress,
  },
  'thoughtful-critic': {
    icon: 'game-icons:quill-ink',
    tier: 0,
    name: m.badge_thoughtful_critic_name,
    description: m.badge_thoughtful_critic_description,
    goal: m.badge_thoughtful_critic_goal,
    progress: m.badge_thoughtful_critic_progress,
  },
  'gm-first': {
    icon: 'game-icons:spell-book',
    tier: 0,
    name: m.badge_gm_first_name,
    description: m.badge_gm_first_description,
    goal: m.badge_gm_first_goal,
    progress: m.badge_gm_first_progress,
  },
  'gm-master-1': {
    icon: 'game-icons:wizard-staff',
    tier: 1,
    ladder: 'gm-master',
    name: m.badge_gm_master_1_name,
    description: m.badge_gm_master_1_description,
    goal: m.badge_gm_master_1_goal,
    progress: m.badge_gm_master_1_progress,
  },
  'gm-master-2': {
    icon: 'game-icons:wizard-staff',
    tier: 2,
    ladder: 'gm-master',
    name: m.badge_gm_master_2_name,
    description: m.badge_gm_master_2_description,
    goal: m.badge_gm_master_2_goal,
    progress: m.badge_gm_master_2_progress,
  },
  'gm-master-3': {
    icon: 'game-icons:wizard-staff',
    tier: 3,
    ladder: 'gm-master',
    name: m.badge_gm_master_3_name,
    description: m.badge_gm_master_3_description,
    goal: m.badge_gm_master_3_goal,
    progress: m.badge_gm_master_3_progress,
  },
  partner: {
    icon: 'game-icons:shaking-hands',
    tier: 0,
    name: m.badge_partner_name,
    description: m.badge_partner_description,
    goal: m.badge_partner_goal,
    progress: m.badge_partner_progress,
  },
  'first-100': {
    icon: 'game-icons:podium',
    mark: '100!',
    tier: 0,
    name: m.badge_first_100_name,
    description: m.badge_first_100_description,
  },
  pioneer: {
    icon: 'game-icons:sunrise',
    tier: 0,
    name: m.badge_pioneer_name,
    description: m.badge_pioneer_description,
  },
  'community-helper': {
    icon: 'game-icons:laurels',
    tier: 0,
    manual: true,
    name: m.badge_community_helper_name,
    description: m.badge_community_helper_description,
    goal: m.badge_community_helper_goal,
    progress: m.badge_community_helper_progress,
  },
};

export const presentationOf = (badgeId: string): BadgePresentation | null =>
  BADGE_PRESENTATION[badgeId] ?? null;
