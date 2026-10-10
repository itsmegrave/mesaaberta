import type { ImportEnv } from '../crowdfunding/import/runner';
import { runDailyImports } from '../crowdfunding/import/runner';
import type { InstagramEnv } from '../instagram/api';
import type { Logger } from '../logger';
import { handlersFor } from './handlers';
import { runSweeper } from './sweeper';
export const DAILY_IMPORT_CRON = '0 4 * * *';
export const SWEEPER_CRON = '*/5 * * * *';
/** Multiple triggers can coincide. Each invocation has exactly one responsibility. */
export async function runScheduled(
  controller: { cron: string; scheduledTime: number },
  env: ImportEnv & InstagramEnv,
  {
    log,
    sweeper = runSweeper,
    importer = runDailyImports,
  }: { log: Logger; sweeper?: typeof runSweeper; importer?: typeof runDailyImports },
) {
  if (controller.cron === DAILY_IMPORT_CRON)
    await importer(env, { scheduledTime: controller.scheduledTime, log });
  else if (controller.cron === SWEEPER_CRON)
    await sweeper(env, { handlers: handlersFor(env), log });
  else log.warn('unknown scheduled trigger', { code: 'unknown_cron' });
}
