import type { RequestEvent } from '@sveltejs/kit';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { profileSocialLinks, profiles } from '$lib/server/db/schema';
import { createTestDb } from '$lib/server/db/test-db';
import { actions, load } from './+page.server';

let test: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => (test = await createTestDb()));
afterAll(() => test.close());

const id = (n: number) => `00000000-0000-4000-8000-0000000005${String(n).padStart(2, '0')}`;

const event = (
	n: number | null,
	{
		metadata = {},
		search = '',
		fields
	}: { metadata?: object; search?: string; fields?: [string, string][] } = {}
) => {
	const url = new URL(`https://x.test/onboarding${search}`);
	const body = new FormData();
	for (const [key, value] of fields ?? []) body.append(key, value);

	return {
		locals: {
			db: test.db,
			getUser: async () => (n === null ? null : { id: id(n), user_metadata: metadata })
		},
		url,
		request: new Request(url, { method: 'POST', body })
	} as unknown as RequestEvent;
};

// The results are read for whatever the test looks at: load data, an action failure, a thrown redirect.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const run = (fn: unknown, e: RequestEvent) => (fn as (e: RequestEvent) => Promise<any>)(e);
const submit = (e: RequestEvent) => run((actions as Record<string, unknown>).default, e);
const redirected = (promise: Promise<unknown>) =>
	promise.then(
		() => null,
		(thrown) => thrown as { status: number; location: string }
	);

describe('the onboarding page', () => {
	describe('load', () => {
		it('sends an anonymous visitor to log in, and back here', async () => {
			expect(
				await redirected(run(load, event(null, { search: '?next=/tables/new' })))
			).toMatchObject({
				status: 303,
				location: '/login?next=%2Fonboarding%3Fnext%3D%2Ftables%2Fnew'
			});
		});

		it('creates the missing profile, fills in the name from the provider and suggests a username from it', async () => {
			const { form, next } = await run(
				load,
				event(1, { metadata: { full_name: 'Ana Souza' }, search: '?next=/tables/new' })
			);

			expect(form.data).toMatchObject({ username: 'ana-souza', name: 'Ana Souza' });
			expect(form.errors).toEqual({});
			expect(next).toBe('/tables/new');
			const [row] = await test.db
				.select()
				.from(profiles)
				.where(eq(profiles.id, id(1)));
			expect(row).toMatchObject({ name: 'Ana Souza', username: null });
		});

		it('does not suggest a username somebody has, nor one that is not acceptable', async () => {
			await test.db.insert(profiles).values({ id: id(90), username: 'bruno-lima' });

			const taken = await run(load, event(2, { metadata: { full_name: 'Bruno Lima' } }));
			const admin = await run(load, event(3, { metadata: { full_name: 'Admin' } }));

			expect(taken.form.data.username).toBe('');
			expect(admin.form.data.username).toBe('');
		});

		it('sends someone who already has a username on to where they were going', async () => {
			await test.db.insert(profiles).values({ id: id(4), username: 'carla' });

			expect(
				await redirected(run(load, event(4, { search: '?next=/account/tables' })))
			).toMatchObject({
				status: 303,
				location: '/account/tables'
			});
		});

		it('never goes on to an address that leaves the site', async () => {
			await test.db.insert(profiles).values({ id: id(5), username: 'diego' });

			expect(
				await redirected(run(load, event(5, { search: '?next=//evil.example' })))
			).toMatchObject({
				location: '/'
			});
		});
	});

	describe('the form action', () => {
		const fields = (over: Record<string, string> = {}): [string, string][] =>
			Object.entries({ username: 'eva', name: '', age: '', gender: '', city: '', ...over });

		it('saves the profile with its links and goes on to where the person was going', async () => {
			const thrown = await redirected(
				submit(
					event(10, {
						search: '?next=/tables/new',
						fields: [
							...fields({ username: 'Eva-Lima', name: 'Eva Lima', age: '29', city: 'Recife' }),
							['linkNetwork', 'instagram'],
							['linkUrl', 'instagram.com/eva'],
							['linkNetwork', 'website'],
							['linkUrl', '']
						]
					})
				)
			);

			expect(thrown).toMatchObject({ status: 303, location: '/tables/new' });
			const [row] = await test.db
				.select()
				.from(profiles)
				.where(eq(profiles.id, id(10)));
			expect(row).toMatchObject({
				username: 'eva-lima',
				name: 'Eva Lima',
				age: 29,
				city: 'Recife'
			});
			const links = await test.db
				.select()
				.from(profileSocialLinks)
				.where(eq(profileSocialLinks.profileId, id(10)));
			expect(links).toMatchObject([
				{ network: 'instagram', url: 'https://instagram.com/eva', position: 0 }
			]);
		});

		it('needs only the username', async () => {
			expect(
				await redirected(submit(event(11, { fields: fields({ username: 'fabio' }) })))
			).toMatchObject({
				status: 303,
				location: '/'
			});
		});

		it('refuses an invalid form with the field errors, and saves nothing', async () => {
			const result = await submit(event(12, { fields: fields({ username: 'admin', age: '9' }) }));

			expect(result.status).toBe(400);
			expect(result.data.form.errors).toMatchObject({ username: ['reserved'], age: ['invalid'] });
			expect(
				await test.db
					.select()
					.from(profiles)
					.where(eq(profiles.id, id(12)))
			).toEqual([]);
		});

		it('says a username is taken, on the username field, whatever the case', async () => {
			await test.db.insert(profiles).values({ id: id(91), username: 'gabi' });

			const result = await submit(event(13, { fields: fields({ username: 'GABI' }) }));

			expect(result.status).toBe(400);
			expect(result.data.form.errors).toEqual({ username: ['taken'] });
		});

		it('lets exactly one of two people who submit the same username at the same moment have it', async () => {
			const results = await Promise.all([
				redirected(submit(event(14, { fields: fields({ username: 'corrida' }) }))),
				submit(event(15, { fields: fields({ username: 'corrida' }) })).catch((e) => e)
			]);

			const won = results.filter((r) => r && 'location' in r);
			const lost = results.filter((r) => r && 'data' in r);
			expect(won).toHaveLength(1);
			expect(lost).toHaveLength(1);
			expect(lost[0].data.form.errors).toEqual({ username: ['taken'] });
			expect(
				await test.db.select().from(profiles).where(eq(profiles.username, 'corrida'))
			).toHaveLength(1);
		});
	});
});
