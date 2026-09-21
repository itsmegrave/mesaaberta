import { and, eq } from 'drizzle-orm';
import { createSupabaseAdmin, emailOf, type SupabaseAdmin } from '../auth/admin-client';
import { buildInvite, tableUrl, type CalendarTable } from '../calendar/ics';
import type { AnyDb } from '../db/client';
import { gameTables, profiles, registrations } from '../db/schema';
import type { Mailer } from '../mail/mailer';
import { resendMailer } from '../mail/resend';
import {
	templateIdFor,
	templateVariables,
	type TemplateEnv,
	type TemplateKey,
	type TemplateVariables
} from '../mail/templates';
import { formatSession } from '../../tables/format';
import type { Handler, StoredEvent } from './types';
import { NAMELESS } from '../db/public-name';

/** Secrets stay in the Worker environment. Do not put any of these in `wrangler.jsonc`. */
export type InviteEnv = TemplateEnv & {
	RESEND_API_KEY?: string;
	RESEND_FROM?: string;
	SUPABASE_URL?: string;
	/** A Supabase secret key (`sb_secret_...`). It bypasses RLS: server-only. */
	SUPABASE_SECRET_KEY?: string;
	/** The legacy `service_role` key, still accepted until Supabase retires it (end of 2026). */
	SUPABASE_SERVICE_ROLE_KEY?: string;
	APP_ORIGIN?: string;
};

/** What the handler needs once `inviteHandler` has checked the environment and picked the admin key. */
type InviteConfig = TemplateEnv & {
	RESEND_API_KEY: string;
	RESEND_FROM: string;
	SUPABASE_URL: string;
	SUPABASE_SECRET_KEY: string;
	APP_ORIGIN: string;
};

type Recipient = { id: string; name: string | null; username: string | null };

const calendarColumns = {
	id: gameTables.id,
	slug: gameTables.slug,
	title: gameTables.title,
	description: gameTables.description,
	extraInfo: gameTables.extraInfo,
	kind: gameTables.kind,
	startsAt: gameTables.startsAt,
	durationMinutes: gameTables.durationMinutes,
	timezone: gameTables.timezone,
	recurrence: gameTables.recurrence,
	until: gameTables.until,
	icalSequence: gameTables.icalSequence,
	gmId: gameTables.gmId
};

/** Resend accepts `Name <address@example.com>`; iCalendar's ORGANIZER needs only the address. */
const addressOf = (from: string) => from.match(/<([^<>]+)>\s*$/)?.[1] ?? from;

async function tableOf(db: AnyDb, tableId: string) {
	const [table] = await db
		.select(calendarColumns)
		.from(gameTables)
		.where(eq(gameTables.id, tableId));
	if (!table) throw new Error('Table for invite event no longer exists');
	return table as CalendarTable;
}

async function profileOf(db: AnyDb, id: string): Promise<Recipient[]> {
	const [profile] = await db
		.select({ id: profiles.id, name: profiles.name, username: profiles.username })
		.from(profiles)
		.where(eq(profiles.id, id));
	return profile ? [profile] : [];
}

async function confirmedRecipients(db: AnyDb, tableId: string): Promise<Recipient[]> {
	return db
		.select({ id: profiles.id, name: profiles.name, username: profiles.username })
		.from(registrations)
		.innerJoin(profiles, eq(profiles.id, registrations.playerId))
		.where(and(eq(registrations.tableId, tableId), eq(registrations.status, 'confirmed')));
}

async function recipientsFor(
	db: AnyDb,
	event: StoredEvent,
	table: CalendarTable & { gmId: string }
): Promise<Recipient[]> {
	if ('playerId' in event.payload) {
		return event.type === 'JoinRequested'
			? profileOf(db, table.gmId)
			: profileOf(db, event.payload.playerId);
	}
	if (event.type === 'TableCreated') return profileOf(db, table.gmId);
	const players = await confirmedRecipients(db, event.payload.tableId);
	const gm = await profileOf(db, table.gmId);
	return [...gm, ...players];
}

type Context = TemplateVariables['CONTEXT'];

/**
 * Sends calendar REQUESTs for confirmed joins and table changes, and CANCELs when a player leaves
 * or the table is disabled. A Resend idempotency key makes retries of an outbox event safe even if
 * the first attempt reached Resend before the Worker stopped.
 */
export function createInviteHandler(
	env: InviteConfig,
	request: typeof fetch = fetch,
	admin: SupabaseAdmin = createSupabaseAdmin(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY),
	mailer: Mailer = resendMailer(env, request)
): Handler {
	return {
		name: 'calendar-invites-v1',
		types: [
			'TableCreated',
			'JoinRequested',
			'JoinApproved',
			'PlayerJoined',
			'JoinDeclined',
			'PlayerLeft',
			'TableUpdated',
			'TableDisabled'
		],
		async handle(event, db) {
			const table = (await tableOf(db, event.payload.tableId)) as CalendarTable & { gmId: string };
			const recipients = await recipientsFor(db, event, table);
			const notification = event.type === 'JoinRequested' || event.type === 'JoinDeclined';
			const method =
				event.type === 'PlayerLeft' || event.type === 'TableDisabled' ? 'CANCEL' : 'REQUEST';
			const startsAt = formatSession(table.startsAt, table.timezone, 'pt-BR');
			const url = tableUrl(env.APP_ORIGIN, table.slug);
			/** A hosted template when its id is configured; otherwise the mail keeps its inline copy. */
			const hosted = (
				key: TemplateKey,
				context: Context,
				recipient: Recipient,
				fallbackText: string
			) => {
				const id = templateIdFor(env, key);
				if (!id) return {};
				const variables = templateVariables({
					RECIPIENT_NAME: recipient.name || recipient.username || NAMELESS,
					TABLE_TITLE: table.title,
					TABLE_URL: url,
					CONTEXT: context,
					STARTS_AT: startsAt,
					FALLBACK_TEXT: fallbackText
				});
				return { template: { id, variables } };
			};
			for (const recipient of recipients) {
				const email = await emailOf(admin, recipient.id);
				if (notification) {
					const toGm = event.type === 'JoinRequested';
					const text = toGm
						? `Há uma nova solicitação para a mesa "${table.title}".`
						: `Sua solicitação para a mesa "${table.title}" foi recusada.`;
					await mailer.send({
						to: email,
						subject: toGm
							? `Nova solicitação: ${table.title}`
							: `Solicitação recusada: ${table.title}`,
						text,
						...(toGm
							? hosted('joinRequested', 'JOIN_REQUESTED', recipient, text)
							: hosted('joinDeclined', 'JOIN_DECLINED', recipient, text)),
						idempotencyKey: `${event.id}:${recipient.id}:notification`
					});
					continue;
				}
				const ics = buildInvite({
					table,
					method,
					attendee: { email, name: recipient.name || recipient.username || NAMELESS },
					organizer: { email: addressOf(env.RESEND_FROM), name: 'Mesa Aberta' },
					baseUrl: env.APP_ORIGIN
				});
				const subject =
					method === 'REQUEST' ? `Convite: ${table.title}` : `Cancelada: ${table.title}`;
				const text =
					method === 'REQUEST'
						? `Você tem uma vaga confirmada em "${table.title}". O convite de calendário está anexado.`
						: `Sua participação em "${table.title}" foi cancelada. O cancelamento de calendário está anexado.`;
				await mailer.send({
					to: email,
					subject,
					text,
					...(method === 'REQUEST'
						? hosted('invite', 'REQUEST', recipient, text)
						: hosted('cancel', 'CANCEL', recipient, text)),
					attachments: [
						{
							filename: 'mesa-aberta.ics',
							content: ics,
							contentType: `text/calendar; method=${method}; charset=utf-8`
						}
					],
					idempotencyKey: `${event.id}:${recipient.id}:${method}`
				});
			}
		}
	};
}

/** No secrets in local development means no handler; events still complete as audit rows. */
export function inviteHandler(env: InviteEnv | undefined): Handler | null {
	const secretKey = env?.SUPABASE_SECRET_KEY || env?.SUPABASE_SERVICE_ROLE_KEY;
	if (!env?.RESEND_API_KEY || !env.RESEND_FROM || !env.SUPABASE_URL || !secretKey) return null;

	return createInviteHandler({
		RESEND_TEMPLATE_INVITE: env.RESEND_TEMPLATE_INVITE,
		RESEND_TEMPLATE_CANCEL: env.RESEND_TEMPLATE_CANCEL,
		RESEND_TEMPLATE_JOIN_REQUESTED: env.RESEND_TEMPLATE_JOIN_REQUESTED,
		RESEND_TEMPLATE_JOIN_DECLINED: env.RESEND_TEMPLATE_JOIN_DECLINED,
		RESEND_API_KEY: env.RESEND_API_KEY,
		RESEND_FROM: env.RESEND_FROM,
		SUPABASE_URL: env.SUPABASE_URL,
		SUPABASE_SECRET_KEY: secretKey,
		APP_ORIGIN: env.APP_ORIGIN || 'https://mesaaberta.app'
	});
}
