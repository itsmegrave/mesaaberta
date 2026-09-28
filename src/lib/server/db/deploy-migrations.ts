/**
 * Whether the build should run the database migrations before the Worker is deployed. Only a
 * Cloudflare Workers Build of the production branch does, with the connection string in the
 * `MIGRATE_DATABASE_URL` build secret: local builds, GitHub CI and preview branches never touch the
 * production database. See the README, "Deploying".
 */
export type MigrationPlan =
  { run: true; url: string } | { run: false; reason: string; warn?: boolean };

export const PRODUCTION_BRANCH = 'main';

export function migrationPlan(env: Record<string, string | undefined>): MigrationPlan {
  if (env.WORKERS_CI !== '1') return { run: false, reason: 'not a Cloudflare build' };

  const branch = env.WORKERS_CI_BRANCH ?? '';
  if (branch !== PRODUCTION_BRANCH) {
    return { run: false, reason: `branch ${branch} is not the production branch` };
  }

  const url = env.MIGRATE_DATABASE_URL;
  if (!url) return { run: false, reason: 'MIGRATE_DATABASE_URL is not set', warn: true };

  return { run: true, url };
}
