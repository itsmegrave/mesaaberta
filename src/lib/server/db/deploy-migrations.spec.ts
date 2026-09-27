import { describe, expect, it } from 'vitest';
import { migrationPlan } from './deploy-migrations';

const cloudflare = {
	WORKERS_CI: '1',
	WORKERS_CI_BRANCH: 'main',
	MIGRATE_DATABASE_URL: 'postgres://x'
};

describe('migrationPlan', () => {
	it('migrates on a Cloudflare build of main that has the database string', () => {
		expect(migrationPlan(cloudflare)).toEqual({ run: true, url: 'postgres://x' });
	});

	it('skips everywhere else: locally, in CI, and on preview branches, which must never touch production', () => {
		expect(migrationPlan({})).toMatchObject({ run: false, reason: 'not a Cloudflare build' });
		expect(migrationPlan({ CI: 'true', MIGRATE_DATABASE_URL: 'postgres://x' })).toMatchObject({
			run: false
		});
		expect(migrationPlan({ ...cloudflare, WORKERS_CI_BRANCH: 'feat/x' })).toMatchObject({
			run: false,
			reason: 'branch feat/x is not the production branch'
		});
	});

	it('skips with a warning on main when the secret is not set yet, so the deploy still goes out', () => {
		expect(migrationPlan({ WORKERS_CI: '1', WORKERS_CI_BRANCH: 'main' })).toEqual({
			run: false,
			reason: 'MIGRATE_DATABASE_URL is not set',
			warn: true
		});
	});
});
