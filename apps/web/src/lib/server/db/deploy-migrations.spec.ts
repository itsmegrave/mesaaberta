import { describe, expect, it } from 'vitest';
import { migrationPlan } from './deploy-migrations';

const cloudflare = {
  WORKERS_CI: '1',
  WORKERS_CI_BRANCH: 'main',
  MIGRATE_DATABASE_URL: 'postgres://x',
};

describe('migrationPlan', () => {
  it('migrates on a Cloudflare build of main that has the database string', () => {
    expect(migrationPlan(cloudflare)).toEqual({ run: true, url: 'postgres://x' });
  });

  it('skips everywhere else: locally, in CI, and on preview branches, which must never touch production', () => {
    expect(migrationPlan({})).toMatchObject({ run: false, reason: 'not a Cloudflare build' });
    expect(migrationPlan({ CI: 'true', MIGRATE_DATABASE_URL: 'postgres://x' })).toMatchObject({
      run: false,
    });
    expect(migrationPlan({ ...cloudflare, WORKERS_CI_BRANCH: 'feat/x' })).toMatchObject({
      run: false,
      reason: 'branch feat/x is not the production branch',
    });
  });

  it('fails the build on main when the secret is not set, so code never runs ahead of the schema', () => {
    expect(migrationPlan({ WORKERS_CI: '1', WORKERS_CI_BRANCH: 'main' })).toEqual({
      run: false,
      reason: 'MIGRATE_DATABASE_URL is not set',
      fail: true,
    });
  });

  it('lets a deploy that needs no migration opt out, loudly', () => {
    expect(
      migrationPlan({
        WORKERS_CI: '1',
        WORKERS_CI_BRANCH: 'main',
        ALLOW_BUILD_WITHOUT_MIGRATIONS: 'true',
      }),
    ).toEqual({
      run: false,
      reason: 'MIGRATE_DATABASE_URL is not set (opted out)',
      warn: true,
    });
  });
});
