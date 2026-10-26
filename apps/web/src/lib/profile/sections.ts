import type { ProfileInput } from '@mesaaberta/core/profile/schema';
import type { IconName } from '#lib/icons/names.js';
import { m } from '#lib/paraglide/messages.js';

/**
 * The parts of "Editar perfil", in the order of the side menu. Each is its own page with its own
 * form, so a save never carries the fields of another part.
 */
export const profileSections = (): { path: string; label: string; icon: IconName }[] => [
  { path: '/u/profile/edit', label: m.profile_section_public(), icon: 'game-icons:meeple' },
  { path: '/u/profile/edit/about', label: m.profile_section_about(), icon: 'user-id' },
  { path: '/u/profile/edit/account', label: m.profile_section_account(), icon: 'lock' },
  { path: '/u/profile/edit/messages', label: m.profile_section_messages(), icon: 'mail' },
  { path: '/u/profile/edit/data', label: m.profile_section_data(), icon: 'shield' },
];

/** The profile fields each form of a section sends. Everything else keeps what is stored. */
export const PROFILE_SECTION_FIELDS = {
  public: ['name', 'showName', 'bio', 'linkNetwork', 'linkUrl'],
  about: ['ageRange', 'gender', 'genderOther', 'city', 'timezone'],
} as const satisfies Record<string, readonly (keyof ProfileInput)[]>;

export type ProfileSection = keyof typeof PROFILE_SECTION_FIELDS;

/**
 * The posted form of one section, completed with the stored values of every field it doesn't own,
 * so the whole profile can be checked and saved as before. A field the section owns is taken as
 * sent, even when it was sent empty (all links removed, say). The username is never a section's.
 */
export function withStoredFields(
  data: FormData,
  stored: ProfileInput,
  section: ProfileSection,
): FormData {
  const own = new Set<string>(PROFILE_SECTION_FIELDS[section]);
  for (const [field, value] of Object.entries(stored)) {
    if (own.has(field)) continue;
    data.delete(field);
    for (const item of Array.isArray(value) ? value : [value]) data.append(field, String(item));
  }
  return data;
}
