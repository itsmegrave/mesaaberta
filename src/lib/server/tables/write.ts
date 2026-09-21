import { eq, like } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { gameTables, systems } from '../db/schema';
import { authorize, type Actor } from '../auth/policy';
import { Invalid, NotFound } from '../errors';
import { recordEvent } from '../events/outbox';
import { TABLE_CREATION_LIMIT, enforceRateLimit } from '../rate-limit';
import { instantToLocal, localToInstant } from './schedule';
import { slugify, tableSlug } from '$lib/slug';
import type { TableInput } from '$lib/tables/schema';

const MAX_SLUG_ATTEMPTS = 5;

/** A Postgres unique violation on the slug index (drizzle wraps the driver's error as `cause`). */
function isSlugConflict(error: unknown): boolean {
	const { code, constraint_name, constraint, message } = ((error as { cause?: unknown }).cause ??
		error) as Record<string, string | undefined>;

	return code === '23505' && `${constraint_name ?? constraint ?? message}`.includes('slug');
}

async function systemIdOf(db: AnyDb, slug: string) {
	const [system] = await db.select({ id: systems.id }).from(systems).where(eq(systems.slug, slug));
	if (!system) throw new Invalid('systemSlug', 'invalid');

	return system.id;
}

/** The columns a form controls. Never the slug, the GM, the status or the calendar sequence. */
async function columnsOf(db: AnyDb, input: TableInput) {
	return {
		systemId: await systemIdOf(db, input.systemSlug),
		title: input.title,
		description: input.description,
		extraInfo: input.extraInfo,
		kind: input.kind,
		capacity: input.capacity,
		startsAt: localToInstant(input.startsAtLocal, input.timezone),
		durationMinutes: input.durationMinutes,
		timezone: input.timezone,
		recurrence: input.recurrence,
		// The whole last day counts, so it ends one minute before midnight there.
		until: input.untilLocalDate
			? localToInstant(`${input.untilLocalDate}T23:59`, input.timezone)
			: null,
		joinMode: input.joinMode
	};
}

/**
 * Creates a table; the creator becomes its GM. The slug comes from the title. The unique index
 * has the last word: if another request takes the slug between the check and the insert, this
 * tries the next one, so two simultaneous creates both succeed. Throws `RateLimited` past
 * `TABLE_CREATION_LIMIT`; the check runs after the form is validated, so a rejected form never
 * counts, and in the same transaction as the insert, so a refused request leaves nothing behind.
 */
export async function createTable(
	db: AnyDb,
	actor: Actor | null,
	input: TableInput,
	{ now = new Date(), imagePath = null }: { now?: Date; imagePath?: string | null } = {}
): Promise<{ slug: string; eventId: string }> {
	authorize(actor, 'table:create');

	const columns = { ...(await columnsOf(db, input)), imagePath };
	if (columns.startsAt < now) throw new Invalid('startsAtLocal', 'in_the_past');

	const base = slugify(input.title, { fallback: 'mesa' });

	for (let attempt = 1; ; attempt++) {
		const existing = await db
			.select({ slug: gameTables.slug })
			.from(gameTables)
			.where(like(gameTables.slug, `${base}%`));
		const taken = new Set(existing.map((row) => row.slug));
		const slug = tableSlug(input.title, (candidate) => taken.has(candidate));

		try {
			// The table and its event commit together, or neither does. A slug conflict rolls both
			// back, and the retry writes a fresh pair.
			const eventId = await db.transaction(async (tx) => {
				await enforceRateLimit(tx as unknown as AnyDb, actor!.id, TABLE_CREATION_LIMIT, now);

				const [created] = await tx
					.insert(gameTables)
					.values({ ...columns, slug, gmId: actor!.id })
					.returning({ id: gameTables.id });

				return recordEvent(
					tx as unknown as AnyDb,
					{
						type: 'TableCreated',
						actorId: actor!.id,
						payload: { tableId: created.id, slug, title: input.title }
					},
					{ now }
				);
			});
			return { slug, eventId };
		} catch (error) {
			if (!isSlugConflict(error) || attempt === MAX_SLUG_ATTEMPTS) throw error;
		}
	}
}

async function findForWrite(db: AnyDb, slug: string) {
	const [table] = await db.select().from(gameTables).where(eq(gameTables.slug, slug));
	if (!table) throw new NotFound(`no table with slug "${slug}"`);

	return table;
}

/** A table as the edit form shows it. Works for a disabled table too, so its GM can find it. */
export async function loadTableForEdit(db: AnyDb, actor: Actor | null, slug: string) {
	const table = await findForWrite(db, slug);
	authorize(actor, 'table:edit', table);

	const [system] = await db
		.select({ slug: systems.slug })
		.from(systems)
		.where(eq(systems.id, table.systemId));

	return {
		slug: table.slug,
		status: table.status,
		systemSlug: system.slug,
		title: table.title,
		description: table.description,
		extraInfo: table.extraInfo ?? '',
		kind: table.kind,
		capacity: table.capacity,
		startsAtLocal: instantToLocal(table.startsAt, table.timezone),
		timezone: table.timezone,
		durationMinutes: table.durationMinutes,
		repeat:
			table.recurrence === 'FREQ=WEEKLY;INTERVAL=2' ? 'biweekly' : table.recurrence ? 'weekly' : '',
		until: table.until ? instantToLocal(table.until, table.timezone).slice(0, 10) : '',
		joinMode: table.joinMode,
		imagePath: table.imagePath
	};
}

/**
 * Saves the form. The slug never changes, so shared links and calendar invites keep working, and
 * the calendar sequence goes up so invites replace the old event.
 */
export async function updateTable(
	db: AnyDb,
	actor: Actor | null,
	slug: string,
	input: TableInput,
	{ imagePath }: { imagePath?: string } = {}
): Promise<{ eventId: string }> {
	const table = await findForWrite(db, slug);
	authorize(actor, 'table:edit', table);

	const columns = await columnsOf(db, input);
	const eventId = await db.transaction(async (tx) => {
		await tx
			.update(gameTables)
			// No new image leaves the current one as it is.
			.set({
				...columns,
				...(imagePath ? { imagePath } : {}),
				icalSequence: table.icalSequence + 1
			})
			.where(eq(gameTables.id, table.id));

		return recordEvent(tx as unknown as AnyDb, {
			type: 'TableUpdated',
			actorId: actor!.id,
			payload: { tableId: table.id, slug: table.slug, title: input.title }
		});
	});

	return { eventId };
}

/** Takes a table off the public pages. */
export async function disableTable(
	db: AnyDb,
	actor: Actor | null,
	slug: string
): Promise<{ eventId: string }> {
	const table = await findForWrite(db, slug);
	authorize(actor, 'table:disable', table);

	const eventId = await db.transaction(async (tx) => {
		await tx
			.update(gameTables)
			.set({ status: 'disabled', icalSequence: table.icalSequence + 1 })
			.where(eq(gameTables.id, table.id));

		return recordEvent(tx as unknown as AnyDb, {
			type: 'TableDisabled',
			actorId: actor!.id,
			payload: { tableId: table.id, slug: table.slug, title: table.title }
		});
	});

	return { eventId };
}
