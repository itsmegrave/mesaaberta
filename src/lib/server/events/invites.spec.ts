import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { gameTables, profiles, registrations, systems } from '../db/schema';
import { createTestDb } from '../db/test-db';
import { formatSession } from '../../tables/format';
import { TEMPLATE_VARIABLES } from '../mail/templates';
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
	RESEND_FROM: 'Mesa Aberta <no-reply@mesaaberta.app>',
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

	it('sends the inline copy for the two plain notifications when no template is configured', async () => {
		const sent = capture();

		await createInviteHandler(env, sent.request, admin('mestre@example.com')).handle(
			event('JoinRequested'),
			test.db
		);
		await createInviteHandler(env, sent.request, admin('ana@example.com')).handle(
			event('JoinDeclined'),
			test.db
		);

		expect(sent.bodies[0]).toMatchObject({
			to: ['mestre@example.com'],
			subject: 'Nova solicitação: Mesa do Dragão',
			text: 'Há uma nova solicitação para a mesa "Mesa do Dragão".'
		});
		expect(sent.bodies[1]).toMatchObject({
			to: ['ana@example.com'],
			subject: 'Solicitação recusada: Mesa do Dragão',
			text: 'Sua solicitação para a mesa "Mesa do Dragão" foi recusada.'
		});
		expect(sent.bodies[0]).not.toHaveProperty('template');
		expect(sent.bodies[1]).not.toHaveProperty('template');
		expect(sent.headers[0]).toMatchObject({
			'Idempotency-Key': `${event('JoinRequested').id}:${gm}:notification`
		});
	});

	describe('with hosted Resend templates', () => {
		const templated = {
			...env,
			RESEND_TEMPLATE_INVITE: 'tpl-invite',
			RESEND_TEMPLATE_CANCEL: 'tpl-cancel',
			RESEND_TEMPLATE_JOIN_REQUESTED: 'tpl-requested',
			RESEND_TEMPLATE_JOIN_DECLINED: 'tpl-declined'
		};
		const startsAt = formatSession(new Date('2026-10-10T22:00:00Z'), 'America/Sao_Paulo', 'pt-BR');

		it('sends the invite template with the .ics attachment and the idempotency key', async () => {
			const sent = capture();

			await createInviteHandler(templated, sent.request, admin()).handle(
				event('PlayerJoined'),
				test.db
			);

			expect(sent.bodies).toHaveLength(1);
			const [body] = sent.bodies;
			expect(body.template).toEqual({
				id: 'tpl-invite',
				variables: {
					RECIPIENT_NAME: 'Ana',
					TABLE_TITLE: 'Mesa do Dragão',
					TABLE_URL: 'https://mesaaberta.app/tables/mesa',
					CONTEXT: 'REQUEST',
					STARTS_AT: startsAt,
					FALLBACK_TEXT: expect.stringContaining('vaga confirmada')
				}
			});
			expect(body).not.toHaveProperty('text');
			expect(body).not.toHaveProperty('html');
			expect(body.subject).toBe('Convite: Mesa do Dragão');
			expect(Buffer.from(body.attachments[0].content, 'base64').toString()).toContain(
				'METHOD:REQUEST'
			);
			expect(sent.headers[0]).toMatchObject({
				'Idempotency-Key': `${event('PlayerJoined').id}:${player}:REQUEST`
			});
		});

		it('sends the cancel template with a CANCEL attachment', async () => {
			const sent = capture();

			await createInviteHandler(templated, sent.request, admin()).handle(
				event('PlayerLeft'),
				test.db
			);

			const [body] = sent.bodies;
			expect(body.template.id).toBe('tpl-cancel');
			expect(body.template.variables.CONTEXT).toBe('CANCEL');
			expect(body.template.variables.FALLBACK_TEXT).toContain('cancelada');
			expect(Buffer.from(body.attachments[0].content, 'base64').toString()).toContain(
				'METHOD:CANCEL'
			);
			expect(sent.headers[0]).toMatchObject({
				'Idempotency-Key': `${event('PlayerLeft').id}:${player}:CANCEL`
			});
		});

		it('sends the join-requested template to the GM, without an attachment', async () => {
			const sent = capture();

			await createInviteHandler(templated, sent.request, admin('mestre@example.com')).handle(
				event('JoinRequested'),
				test.db
			);

			const [body] = sent.bodies;
			expect(body.to).toEqual(['mestre@example.com']);
			expect(body.template.id).toBe('tpl-requested');
			expect(body.template.variables).toMatchObject({
				RECIPIENT_NAME: 'Mestre',
				CONTEXT: 'JOIN_REQUESTED',
				FALLBACK_TEXT: 'Há uma nova solicitação para a mesa "Mesa do Dragão".'
			});
			expect(body).not.toHaveProperty('attachments');
			expect(sent.headers[0]).toMatchObject({
				'Idempotency-Key': `${event('JoinRequested').id}:${gm}:notification`
			});
		});

		it('sends the join-declined template to the player, without an attachment', async () => {
			const sent = capture();

			await createInviteHandler(templated, sent.request, admin()).handle(
				event('JoinDeclined'),
				test.db
			);

			const [body] = sent.bodies;
			expect(body.template.id).toBe('tpl-declined');
			expect(body.template.variables).toMatchObject({
				RECIPIENT_NAME: 'Ana',
				CONTEXT: 'JOIN_DECLINED'
			});
			expect(body).not.toHaveProperty('attachments');
			expect(sent.headers[0]).toMatchObject({
				'Idempotency-Key': `${event('JoinDeclined').id}:${player}:notification`
			});
		});

		it('falls back to the inline copy for a template that is not configured, and templates the rest', async () => {
			const sent = capture();
			const onlyInvite = { ...env, RESEND_TEMPLATE_INVITE: 'tpl-invite' };

			await createInviteHandler(onlyInvite, sent.request, admin()).handle(
				event('PlayerLeft'),
				test.db
			);
			await createInviteHandler(onlyInvite, sent.request, admin()).handle(
				event('PlayerJoined'),
				test.db
			);

			expect(sent.bodies[0]).not.toHaveProperty('template');
			expect(sent.bodies[0].text).toContain('foi cancelada');
			expect(sent.bodies[1].template.id).toBe('tpl-invite');
		});

		it('sends only the allowlisted variables, never an id, address, token or secret', async () => {
			const sent = capture();

			for (const type of ['PlayerJoined', 'PlayerLeft', 'JoinRequested', 'JoinDeclined'] as const) {
				await createInviteHandler(templated, sent.request, admin()).handle(event(type), test.db);
			}

			expect(sent.bodies).toHaveLength(4);
			for (const body of sent.bodies) {
				expect(Object.keys(body.template.variables).sort()).toEqual([...TEMPLATE_VARIABLES].sort());
				const variables = JSON.stringify(body.template.variables);
				for (const forbidden of [
					event('PlayerJoined').id,
					player,
					gm,
					tableId,
					'ana@example.com',
					're_test',
					'sb_secret_test'
				]) {
					expect(variables).not.toContain(forbidden);
				}
			}
		});

		it('throws when Resend refuses a templated send, so the sweeper retries', async () => {
			const sent = capture(422);

			await expect(
				createInviteHandler(templated, sent.request, admin()).handle(event('PlayerJoined'), test.db)
			).rejects.toThrow('Resend request failed (422)');
		});

		it('takes the template ids through inviteHandler from the Worker environment', () => {
			expect(inviteHandler({ ...templated })?.name).toBe('calendar-invites-v1');
		});
	});
});

/** Records what would reach Resend; the real API is never called. */
function capture(status = 200) {
	const bodies: Array<Record<string, any>> = [];
	const headers: Array<Record<string, string>> = [];
	const request = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
		bodies.push(JSON.parse(String(init?.body)));
		headers.push(init?.headers as Record<string, string>);
		return new Response('{}', { status });
	}) as unknown as typeof fetch;
	return { request, bodies, headers };
}
