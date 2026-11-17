import { m } from '#lib/paraglide/messages.js';
import { PARTNER_TYPES, type PartnerType } from '@mesaaberta/core/partners/types';

/** Each kind's name, as the card, the form and the filters say it. */
export const partnerTypeLabels: Record<PartnerType, () => string> = {
  publisher: m.partner_type_publisher,
  shop: m.partner_type_shop,
  content: m.partner_type_content,
  podcast: m.partner_type_podcast,
  collective: m.partner_type_collective,
  community: m.partner_type_community,
  event: m.partner_type_event,
  venue: m.partner_type_venue,
  art: m.partner_type_art,
  translation: m.partner_type_translation,
  platform: m.partner_type_platform,
  other: m.partner_type_other,
};

/** The kinds as options, in the list's order. */
export const partnerTypeOptions = () =>
  PARTNER_TYPES.map((value) => ({ value, label: partnerTypeLabels[value]() }));
