import { m } from '$lib/paraglide/messages';
import { longDay } from './format';
import { daysLeft, daysToStart, isLastDays, phaseOf, type Campaign } from './phase';

/**
 * What a card says about where a campaign stands, from its dates alone: how long is left (in
 * warning when the last days begin), when it opens, or when it ended. `warn` is the last-days look.
 */
export function situationOf(
  campaign: Campaign,
  locale: string,
  now: Date = new Date(),
): { text: string; warn: boolean } {
  const phase = phaseOf(campaign, now);
  if (phase === 'ended') {
    return {
      text: m.crowdfunding_ended_on({ date: longDay(campaign.endsOn, locale) }),
      warn: false,
    };
  }
  if (phase === 'upcoming') {
    return {
      text: m.crowdfunding_starts_in({ count: daysToStart(campaign, now) ?? 0 }),
      warn: false,
    };
  }
  const left = daysLeft(campaign, now) ?? 0;
  if (isLastDays(campaign, now)) {
    return {
      text: left === 0 ? m.crowdfunding_ends_today() : m.crowdfunding_last_days({ count: left }),
      warn: true,
    };
  }
  return { text: m.crowdfunding_ends_in({ count: left }), warn: false };
}
