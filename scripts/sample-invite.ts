// Writes sample invites to ./sample-invites/ so they can be imported by hand into Gmail, Outlook and
// Apple Calendar (double-click, or attach them to an email to yourself). Usage: pnpm calendar:sample
// [your@email]. Nothing is sent anywhere.
import { mkdirSync, writeFileSync } from 'node:fs';
import { buildInvite, type CalendarTable } from '../src/lib/server/calendar/ics.ts';

const email = process.argv[2] ?? 'voce@example.com';
const organizer = { email: 'no-reply@mesaaberta.app', name: 'Mesa Aberta' };
const baseUrl = 'https://mesaaberta.app';

const oneShot: CalendarTable = {
	id: '3f1c2d4e-1111-4222-8333-444455556666',
	slug: 'mesa-do-dragao',
	title: 'Mesa do Dragão, com vírgula; e ponto e vírgula',
	description: 'Uma aventura de uma noite.\nTraga dados.',
	extraInfo: 'Regras da casa: nenhuma.',
	kind: 'one_shot',
	startsAt: new Date(Date.now() + 7 * 86_400_000),
	durationMinutes: 240,
	timezone: 'America/Sao_Paulo',
	recurrence: null,
	until: null,
	icalSequence: 0
};

const campaign: CalendarTable = {
	...oneShot,
	id: '9a8b7c6d-5555-4666-8777-888899990000',
	slug: 'cronicas-de-arton',
	title: 'Crônicas de Arton',
	kind: 'campaign',
	recurrence: 'FREQ=WEEKLY',
	until: new Date(Date.now() + 90 * 86_400_000)
};

mkdirSync('sample-invites', { recursive: true });
const files = {
	'one-shot-request.ics': buildInvite({
		table: oneShot,
		method: 'REQUEST',
		attendee: { email, name: 'Você' },
		organizer,
		baseUrl
	}),
	'campaign-request.ics': buildInvite({
		table: campaign,
		method: 'REQUEST',
		attendee: { email, name: 'Você' },
		organizer,
		baseUrl
	}),
	// Import the request first, then this: the event should disappear.
	'campaign-cancel.ics': buildInvite({
		table: { ...campaign, icalSequence: 1 },
		method: 'CANCEL',
		attendee: { email, name: 'Você' },
		organizer,
		baseUrl
	})
};

for (const [name, content] of Object.entries(files))
	writeFileSync(`sample-invites/${name}`, content);
console.log(`Wrote ${Object.keys(files).join(', ')} to sample-invites/`);
