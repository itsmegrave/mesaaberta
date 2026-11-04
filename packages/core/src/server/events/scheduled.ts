import type { ImportEnv } from '../crowdfunding/import/runner';
import { runDailyImports } from '../crowdfunding/import/runner';
import type { Logger } from '../logger';
import { LOGO_SEARCH_CRON, runLogoSearch, type LogoSearchEnv } from '../systems/logos/background';
import { handlersFor } from './handlers';
import { runSweeper } from './sweeper';
export const DAILY_IMPORT_CRON = '0 4 * * *';
export const SWEEPER_CRON = '*/5 * * * *';
export { LOGO_SEARCH_CRON };
/** Multiple triggers can coincide. Each invocation has exactly one responsibility. */
export async function runScheduled(
  controller: { cron: string; scheduledTime: number },
  env: ImportEnv & LogoSearchEnv,
  {
    log,
    sweeper = runSweeper,
    importer = runDailyImports,
    logoSearch = runLogoSearch,
  }: {
    log: Logger;
    sweeper?: typeof runSweeper;
    importer?: typeof runDailyImports;
    logoSearch?: typeof runLogoSearch;
  },
) {
  if (controller.cron === DAILY_IMPORT_CRON)
    await importer(env, { scheduledTime: controller.scheduledTime, log });
  else if (controller.cron === SWEEPER_CRON)
    await sweeper(env, { handlers: handlersFor(env), log });
  // The game systems' logo search, a few systems a run until none is left (admin review after).
  else if (controller.cron === LOGO_SEARCH_CRON) await logoSearch(env, { log });
  else log.warn('scheduled.unknown_trigger', { code: 'unknown_cron' });
}
