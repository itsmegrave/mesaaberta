/** The time zone campaign dates are read in: the audience is Brazilian and a date has no zone of its own. */
export const CAMPAIGN_TIME_ZONE = 'America/Sao_Paulo';

/** From the dates alone, never stored: before the start, between start and end, or after the end. */
export type CrowdfundingPhase = 'upcoming' | 'running' | 'ended';

/** The last days of a running campaign are called out. */
export const LAST_DAYS = 3;

/** Today as `YYYY-MM-DD` in the campaign time zone. */
export function todayIn(now: Date, timeZone = CAMPAIGN_TIME_ZONE): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86_400_000;

/** Whole days from `from` to `to` (both `YYYY-MM-DD`); negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round(dayNumber(to) - dayNumber(from));
}

export type Campaign = { startsOn: string; endsOn: string };

/** The end date is the last day: a campaign ending today is still running today. */
export function phaseOf(campaign: Campaign, now: Date = new Date()): CrowdfundingPhase {
  const today = todayIn(now);
  if (today < campaign.startsOn) return 'upcoming';
  if (today > campaign.endsOn) return 'ended';
  return 'running';
}

/** Days left of a running campaign, counting today (0 on the last day), or `null` otherwise. */
export function daysLeft(campaign: Campaign, now: Date = new Date()): number | null {
  return phaseOf(campaign, now) === 'running' ? daysBetween(todayIn(now), campaign.endsOn) : null;
}

/** Days until an upcoming campaign opens, or `null` once it has. */
export function daysToStart(campaign: Campaign, now: Date = new Date()): number | null {
  return phaseOf(campaign, now) === 'upcoming'
    ? daysBetween(todayIn(now), campaign.startsOn)
    : null;
}

export function isLastDays(campaign: Campaign, now: Date = new Date()): boolean {
  const left = daysLeft(campaign, now);
  return left !== null && left <= LAST_DAYS;
}
