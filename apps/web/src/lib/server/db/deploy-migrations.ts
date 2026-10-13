/**
 * Whether the build should run the database migrations before the Worker is deployed. Only a
 * Cloudflare Workers Build of the production branch does, with the connection string in the
 * `MIGRATE_DATABASE_URL` build secret: local builds, GitHub CI and preview branches never touch the
 * production database. See the README, "Deploying".
 */
export type MigrationPlan =
  | { run: true; url: string }
  /**
   * `fail`: stop the build. A production build without the migration string would deploy code that
   * can use a schema the database does not have yet, which breaks the live site. `warn`: skipped on
   * purpose, said out loud.
   */
  | { run: false; reason: string; warn?: boolean; fail?: boolean };

export const PRODUCTION_BRANCH = 'main';

export function migrationPlan(env: Record<string, string | undefined>): MigrationPlan {
  if (env.WORKERS_CI !== '1') return { run: false, reason: 'not a Cloudflare build' };

  const branch = env.WORKERS_CI_BRANCH ?? '';
  if (branch !== PRODUCTION_BRANCH) {
    return { run: false, reason: `branch ${branch} is not the production branch` };
  }

  const url = env.MIGRATE_DATABASE_URL;
  if (!url) {
    // An explicit opt-out for a deploy that is known to need no migration (and that you will run by hand).
    if (env.ALLOW_BUILD_WITHOUT_MIGRATIONS === 'true') {
      return { run: false, reason: 'MIGRATE_DATABASE_URL is not set (opted out)', warn: true };
    }
    return { run: false, reason: 'MIGRATE_DATABASE_URL is not set', fail: true };
  }

  return { run: true, url };
}
