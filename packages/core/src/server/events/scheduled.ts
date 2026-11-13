import type { ImportEnv } from '../crowdfunding/import/runner';
import { runDailyImports } from '../crowdfunding/import/runner';
import { runImageBackfill, type ImageBackfillEnv } from '../image-backfill';
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
  env: ImportEnv & LogoSearchEnv & ImageBackfillEnv,
  {
    log,
    sweeper = runSweeper,
    importer = runDailyImports,
    logoSearch = runLogoSearch,
    imageBackfill = runImageBackfill,
  }: {
    log: Logger;
    sweeper?: typeof runSweeper;
    importer?: typeof runDailyImports;
    logoSearch?: typeof runLogoSearch;
    imageBackfill?: typeof runImageBackfill;
  },
) {
  if (controller.cron === DAILY_IMPORT_CRON)
    await importer(env, { scheduledTime: controller.scheduledTime, log });
  else if (controller.cron === SWEEPER_CRON)
    await sweeper(env, { handlers: handlersFor(env), log });
  // The two slow background jobs that work through a backlog a few items a run: the game systems'
  // logo search (admin review after) and turning stored PNGs and JPEGs into WebP. One failing does
  // not stop the other.
  else if (controller.cron === LOGO_SEARCH_CRON) {
    const [search, images] = await Promise.allSettled([
      logoSearch(env, { log }),
      imageBackfill(env, { log }),
    ]);
    if (images.status === 'fulfilled' && images.value.converted + images.value.failed > 0)
      log.info('images.backfill_run', images.value);
    if (images.status === 'rejected')
      log.warn('images.backfill_failed', { code: 'image_backfill_failed', error: images.reason });
    if (search.status === 'rejected') throw search.reason;
  } else log.warn('scheduled.unknown_trigger', { code: 'unknown_cron' });
}
