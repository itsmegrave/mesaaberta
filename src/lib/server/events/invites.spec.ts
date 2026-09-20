import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { gameTables, profiles, registrations, systems } from '../db/schema';
import { createTestDb } from '../db/test-db';
import { createInviteHandler, inviteHandler } from './invites';
import type { SupabaseAdmin } from '../auth/admin-client';
import type { StoredEvent } from './types';

let test: Awaited<ReturnType<typeof createTestDb>>;
const gm = '00000000-0000-4000-8000-000000000811';
const player = '00000000-0000-4000-8000-000000000812';
const tableId = '00000000-0000-4000-8000-000000000813';

const event = (type: StoredEvent['type']): StoredEvent =>
	({
		id: '00000000-0000-4000-8000-000000000814',
		type,
		actorId: player,
		createdAt: new Date('2026-10-01T12:00:00Z'),
		attempts: 0,
		payload: { tableId, slug: 'mesa', playerId: player }
	}) as StoredEvent;

beforeAll(async () => {
	test = await createTestDb();
	const [system] = await test.db.select({ id: systems.id }).from(systems).limit(1);
	await test.db.insert(profiles).values([
		{ id: gm, displayName: 'Mestre' },
		{ id: player, displayName: 'Ana' }
	]);
	await test.db.insert(gameTables).values({
		id: tableId,
		slug: 'mesa',
		systemId: system.id,
		title: 'Mesa do Dragão',
		description: 'Uma aventura.',
		kind: 'one_shot',
		capacity: 4,
		startsAt: new Date('2026-10-10T22:00:00Z'),
		durationMinutes: 180,
		timezone: 'America/Sao_Paulo',
		gmId: gm
	});
});
afterAll(() => test.close());
beforeEach(async () => {
	await test.db.delete(registrations);
});

const env = {
	RESEND_API_KEY: 're_test',
	RESEND_FROM: 'Mesa Aberta <convites@mesaaberta.app>',
	SUPABASE_URL: 'https://example.supabase.co',
	SUPABASE_SECRET_KEY: 'sb_secret_test',
	APP_ORIGIN: 'https://mesaaberta.app'
};

const admin = (email = 'ana@example.com'): SupabaseAdmin => ({
	auth: { admin: { getUserById: vi.fn(async () => ({ data: { user: { email } }, error: null })) } }
});

describe('calendar invite handler', () => {
	it('does not exist until every secret it needs is configured', () => {
		expect(inviteHandler(undefined)).toBeNull();
		expect(inviteHandler({ RESEND_API_KEY: 'x' })).toBeNull();
		expect(inviteHandler(env)?.name).toBe('calendar-invites-v1');
	});

	it('takes the admin key under either name, so the legacy service_role key keeps working', () => {
		const { SUPABASE_SECRET_KEY, ...rest } = env;

		expect(inviteHandler({ ...rest, SUPABASE_SERVICE_ROLE_KEY: SUPABASE_SECRET_KEY })?.name).toBe(
			'calendar-invites-v1'
		);
		expect(inviteHandler(rest)).toBeNull();
	});

	it('sends a private REQUEST attachment for a confirmed player', async () => {
		const calls: Array<{ url: string; init?: RequestInit }> = [];
		const request = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
			calls.push({ url: String(url), init });
			return new Response('{}', { status: 200 });
		}) as unknown as typeof fetch;

		const client = admin();
		await createInviteHandler(env, request, client).handle(event('PlayerJoined'), test.db);

		expect(client.auth.admin.getUserById).toHaveBeenCalledWith(player);
		expect(calls).toHaveLength(1);
		expect(calls[0].url).toBe('https://api.resend.com/emails');
		expect(calls[0].init?.headers).toMatchObject({
			'Idempotency-Key': `${event('PlayerJoined').id}:${player}:REQUEST`
		});
		const body = JSON.parse(String(calls[0].init?.body));
		expect(body).toMatchObject({
			to: ['ana@example.com'],
			subject: 'Convite: Mesa do Dragão',
			text: expect.stringContaining('vaga confirmada')
		});
		expect(Buffer.from(body.attachments[0].content, 'base64').toString()).toContain(
			'METHOD:REQUEST'
		);
		expect(Buffer.from(body.attachments[0].content, 'base64').toString()).toContain(
			'ATTENDEE;CN=Ana'
		);
	});

	it('sends a CANCEL attachment to the player after they leave', async () => {
		const sentRequests: RequestInit[] = [];
		const request = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
			if (init) sentRequests.push(init);
			return new Response('{}', { status: 200 });
		});

		await createInviteHandler(env, request as unknown as typeof fetch, admin()).handle(
			event('PlayerLeft'),
			test.db
		);

		const sent = JSON.parse(String(sentRequests[0]?.body));
		expect(sent.subject).toBe('Cancelada: Mesa do Dragão');
		expect(sent.attachments[0].content_type).toContain('method=CANCEL');
		expect(Buffer.from(sent.attachments[0].content, 'base64').toString()).toContain(
			'METHOD:CANCEL'
		);
	});
});
