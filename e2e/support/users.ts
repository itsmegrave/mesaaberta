import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { stack } from './stack';

// Test users, created straight in the local Auth with the service key (already confirmed), so tests
// that are not about sign-up do not have to go through it. Every helper here is for tests only.

export const PASSWORD = 'correct horse battery';

const admin = () =>
	createClient(stack().API_URL, stack().SECRET_KEY, {
		auth: { persistSession: false, autoRefreshToken: false }
	});

const slugOf = (text: string) =>
	text
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');

const unique = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** `username` is what the app shows for them (the header, the GM's list of players). */
export type TestUser = {
	id: string;
	email: string;
	password: string;
	name: string;
	username: string;
};

/**
 * A confirmed user, with a finished profile (a username) so the app treats them as someone who has
 * signed in before and finished the onboarding. `name` is their name; the username is made from it
 * plus a random tail, so the same name can be used by tests running side by side.
 */
export async function createUser(
	name: string,
	options: { role?: 'member' | 'admin' } = {}
): Promise<TestUser> {
	const email = `${name.toLowerCase().replace(/\W+/g, '-')}-${unique()}@example.test`;
	const { data, error } = await admin().auth.admin.createUser({
		email,
		password: PASSWORD,
		email_confirm: true,
		user_metadata: { name }
	});
	if (error || !data.user) throw new Error(`could not create a test user: ${error?.message}`);

	const username = `${slugOf(name).slice(0, 14)}-${Math.random().toString(36).slice(2, 10)}`;
	const sql = database();
	try {
		await sql`insert into profiles (id, username, name, role) values (${data.user.id}, ${username}, ${name}, ${options.role ?? 'member'}) on conflict (id) do nothing`;
	} finally {
		await sql.end();
	}

	return { id: data.user.id, email, password: PASSWORD, name, username };
}

/** A direct connection to the app's database, for what the UI cannot do (back-dating a session, reading a row). */
export const database = () => postgres(stack().DB_URL, { max: 1, onnotice: () => {} });

/** The emails Auth has caught for an address, newest first: `{ id, subject, text }`. */
export async function inbox(email: string, { waitFor }: { waitFor?: RegExp } = {}) {
	const base = stack().MAILPIT_URL;
	const deadline = Date.now() + 15_000;

	for (;;) {
		const list = (await (
			await fetch(`${base}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)
		).json()) as {
			messages: { ID: string; Subject: string }[];
		};
		const messages = await Promise.all(
			list.messages.map(async ({ ID, Subject }) => {
				const full = (await (await fetch(`${base}/api/v1/message/${ID}`)).json()) as {
					Text: string;
					HTML: string;
				};
				return { id: ID, subject: Subject, text: full.Text, html: full.HTML };
			})
		);
		const found = waitFor ? messages.filter((m) => waitFor.test(m.subject + m.text)) : messages;
		if (found.length > 0 || Date.now() > deadline) return found;

		await new Promise((resolve) => setTimeout(resolve, 300));
	}
}

/** The first link in an email that points at Auth (the confirmation or recovery link). */
export const linkIn = (message: { text: string; html: string }) =>
	(message.html + message.text)
		.match(/https?:\/\/[^\s"'<>]*\/auth\/v1\/verify[^\s"'<>]*/)?.[0]
		?.replace(/&amp;/g, '&');
