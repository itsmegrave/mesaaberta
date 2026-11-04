import {
  DAILY_IMPORT_CRON,
  LOGO_SEARCH_CRON,
  SWEEPER_CRON,
} from '@mesaaberta/core/server/events/scheduled';

type Options = {
  /** How often the sweeper runs. Cloudflare's trigger is every five minutes; so is the default. */
  sweepEverySeconds?: number;
  now?: () => Date;
  /** Whether the logo search runs too (every ten minutes). On by default. */
  logoSearch?: boolean;
};

/**
 * What Cloudflare's Cron Triggers do, for a process that has no triggers (Bun, Docker): `tick()`
 * runs the sweeper when `sweepEverySeconds` have passed and the daily import once per UTC day, from
 * 04:00 (as `0 4 * * *`). The import is also guarded by its own per-source, per-date lease, so a
 * restart after 04:00 or a second process cannot run it twice. A run never overlaps itself.
 */
export function createScheduler(
  run: (cron: string, scheduledTime: number) => Promise<void>,
  { sweepEverySeconds = 300, now = () => new Date(), logoSearch = true }: Options = {},
) {
  const busy = new Set<string>();
  let lastSweep = Number.NEGATIVE_INFINITY;
  let lastLogoSearch = Number.NEGATIVE_INFINITY;
  let lastImportDay = '';

  const fire = async (cron: string) => {
    if (busy.has(cron)) return;
    busy.add(cron);
    try {
      await run(cron, now().getTime());
    } finally {
      busy.delete(cron);
    }
  };

  return {
    async tick() {
      const current = now();
      const fired: Promise<void>[] = [];

      if (current.getTime() - lastSweep >= sweepEverySeconds * 1000) {
        lastSweep = current.getTime();
        fired.push(fire(SWEEPER_CRON));
      }
      // The logo search, every ten minutes like its Cron Trigger (`*/10 * * * *`).
      if (logoSearch && current.getTime() - lastLogoSearch >= 600_000) {
        lastLogoSearch = current.getTime();
        fired.push(fire(LOGO_SEARCH_CRON));
      }
      const day = current.toISOString().slice(0, 10);
      if (current.getUTCHours() >= 4 && lastImportDay !== day) {
        lastImportDay = day;
        fired.push(fire(DAILY_IMPORT_CRON));
      }
      await Promise.all(fired);
    },
  };
}
