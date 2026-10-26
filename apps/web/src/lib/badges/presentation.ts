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
  'one-shot-adventurer': {
    icon: 'game-icons:lantern-flame',
    tier: 0,
    name: m.badge_one_shot_adventurer_name,
    description: m.badge_one_shot_adventurer_description,
    goal: m.badge_one_shot_adventurer_goal,
    progress: m.badge_one_shot_adventurer_progress,
  },
  'beloved-gm': {
    icon: 'game-icons:hearts',
    tier: 0,
    name: m.badge_beloved_gm_name,
    description: m.badge_beloved_gm_description,
  },
  'full-table': {
    icon: 'game-icons:tabletop-players',
    tier: 0,
    name: m.badge_full_table_name,
    description: m.badge_full_table_description,
    goal: m.badge_full_table_goal,
    progress: m.badge_full_table_progress,
  },
  'wandering-gm': {
    icon: 'game-icons:walking-boot',
    tier: 0,
    name: m.badge_wandering_gm_name,
    description: m.badge_wandering_gm_description,
    goal: m.badge_wandering_gm_goal,
    progress: m.badge_wandering_gm_progress,
  },
  'open-door': {
    icon: 'game-icons:door',
    tier: 0,
    name: m.badge_open_door_name,
    description: m.badge_open_door_description,
    goal: m.badge_open_door_goal,
    progress: m.badge_open_door_progress,
  },
  'word-kept': {
    icon: 'game-icons:sands-of-time',
    tier: 0,
    name: m.badge_word_kept_name,
    description: m.badge_word_kept_description,
    goal: m.badge_word_kept_goal,
    progress: m.badge_word_kept_progress,
  },
  'table-guardian': {
    icon: 'game-icons:checked-shield',
    tier: 0,
    name: m.badge_table_guardian_name,
    description: m.badge_table_guardian_description,
    goal: m.badge_table_guardian_goal,
    progress: m.badge_table_guardian_progress,
  },
  promoter: {
    icon: 'game-icons:megaphone',
    tier: 0,
    name: m.badge_promoter_name,
    description: m.badge_promoter_description,
    goal: m.badge_promoter_goal,
    progress: m.badge_promoter_progress,
  },
  curator: {
    icon: 'game-icons:book-pile',
    tier: 0,
    name: m.badge_curator_name,
    description: m.badge_curator_description,
    goal: m.badge_curator_goal,
    progress: m.badge_curator_progress,
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
