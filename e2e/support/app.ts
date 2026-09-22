import { expect, type Browser, type Page } from '@playwright/test';
import type { TestUser } from './users';

/** Signs in through the real login form, then waits until the header shows who is signed in. */
export async function signIn(
	page: Page,
	user: Pick<TestUser, 'email' | 'password' | 'username'>,
	next = '/'
) {
	await page.goto(`/login?next=${encodeURIComponent(next)}`);
	await page.getByLabel('Email').fill(user.email);
	await page.getByLabel('Senha').fill(user.password);
	await page.getByRole('button', { name: 'Entrar', exact: true }).click();

	await expect(accountMenu(page, user.username)).toBeVisible();
}

/** The account-menu trigger in the header. The profile can show a display name instead of a username. */
export const accountMenu = (page: Page, _name: string) =>
	page.getByRole('banner').getByRole('button', { name: /menu da conta/i });

/** Signs out through the account menu. */
export async function signOut(page: Page, name: string) {
	await accountMenu(page, name).click();
	await page.getByRole('button', { name: 'Sair' }).click();

	await expect(accountMenu(page, name)).toHaveCount(0);
}

/** Signed-in flows are long; they run on the desktop project only (the pages themselves run on both). */
export const desktopOnly = (isMobile: boolean) => ({
	skip: isMobile,
	reason: 'signed-in flows run on desktop only'
});

export type NewTable = {
	title: string;
	system?: string;
	kind?: 'one_shot' | 'campaign';
	capacity?: number;
	joinMode?: 'auto' | 'approval';
	description?: string;
	image?: { name: string; mimeType: string; buffer: Buffer };
};

/** A title no other test uses, so tests that share a database do not collide. */
export const uniqueTitle = (prefix: string) =>
	`${prefix} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** Fills and submits the create form as the signed-in user. Returns the slug from the URL it lands on. */
export async function createTable(page: Page, table: NewTable) {
	await page.goto('/tables/new');
	await page.getByLabel('Sistema de RPG').selectOption({ label: table.system ?? 'Daggerheart' });
	await page.getByLabel('Título').fill(table.title);
	if (table.description) await page.getByLabel('Descrição').fill(table.description);
	if (table.kind === 'campaign') await page.getByLabel('Campanha (várias sessões)').check();
	await page.getByLabel('Vagas').fill(String(table.capacity ?? 5));
	await page.getByLabel('Primeira sessão').fill('2099-06-01T19:00');
	if (table.joinMode === 'approval') await page.getByLabel(/Com a sua aprovação/).check();
	if (table.image) await page.getByLabel('Imagem').setInputFiles(table.image);
	await page.getByRole('button', { name: 'Abrir mesa' }).click();

	await expect(page).toHaveURL(/\/tables\/[^/]+$/);
	return new URL(page.url()).pathname.split('/').at(-1)!;
}

/** A real 1x1 PNG, for the upload. */
export const PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
	'base64'
);

/** A page in its own browser context (its own cookies), signed in as this user. Close the context when done. */
export async function asUser(
	browser: Browser,
	user: Pick<TestUser, 'email' | 'password' | 'username'>
) {
	const context = await browser.newContext();
	const page = await context.newPage();
	await signIn(page, user);
	return { page, context };
}
