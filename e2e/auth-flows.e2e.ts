import { expect, test } from '@playwright/test';
import { accountMenu, signIn, signOut } from './support/app';
import { PASSWORD, createUser, database, inbox, linkIn } from './support/users';

// The real thing, against the local Supabase: sign up, confirm by email, sign in, reset a password.
// The emails are read from the stack's inbox.
test.skip(({ isMobile }) => isMobile, 'signed-in flows run on desktop only');

const uniqueEmail = (prefix: string) =>
	`${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@example.test`;

test.describe('sign up', () => {
	test('creates the account, asks to confirm by email, and the link signs the person in', async ({
		page
	}) => {
		const email = uniqueEmail('signup');
		await page.goto('/signup');
		await page.getByLabel('Email').fill(email);
		await page.getByLabel('Senha').fill(PASSWORD);
		await page.getByRole('button', { name: 'Criar conta' }).click();

		await expect(page.getByRole('heading', { name: 'Confira seu email' })).toBeVisible();

		const [message] = await inbox(email, { waitFor: /confirm/i });
		const link = linkIn(message);
		expect(link, 'the confirmation email has a link').toBeTruthy();

		await page.goto(link!);

		// Back on our site, signed in, with the default name (nothing is made up from the address).
		await expect(page).toHaveURL(/localhost:4173\/$/);
		await expect(accountMenu(page, 'Jogador')).toBeVisible();

		const sql = database();
		try {
			const rows =
				await sql`select display_name, role, status from profiles where display_name = 'Jogador' order by created_at desc limit 1`;
			expect(rows[0]).toMatchObject({ role: 'member', status: 'active' });
		} finally {
			await sql.end();
		}
	});

	test('cannot sign in before the address is confirmed', async ({ page }) => {
		const email = uniqueEmail('unconfirmed');
		await page.goto('/signup');
		await page.getByLabel('Email').fill(email);
		await page.getByLabel('Senha').fill(PASSWORD);
		await page.getByRole('button', { name: 'Criar conta' }).click();
		await expect(page.getByRole('heading', { name: 'Confira seu email' })).toBeVisible();

		await page.goto('/login');
		await page.getByLabel('Email').fill(email);
		await page.getByLabel('Senha').fill(PASSWORD);
		await page.getByRole('button', { name: 'Entrar', exact: true }).click();

		await expect(page.getByRole('alert')).toContainText('Confirme seu email');
	});

	test('answers a repeat sign-up like a first one, so it cannot be used to find out who is registered', async ({
		page
	}) => {
		const user = await createUser('Já Cadastrada');

		await page.goto('/signup');
		await page.getByLabel('Email').fill(user.email);
		await page.getByLabel('Senha').fill('another password entirely');
		await page.getByRole('button', { name: 'Criar conta' }).click();

		await expect(page.getByRole('heading', { name: 'Confira seu email' })).toBeVisible();
	});

	test('refuses a password that is too short, before Supabase is asked', async ({ page }) => {
		await page.goto('/signup');
		await page.getByLabel('Email').fill(uniqueEmail('short'));
		await page.getByLabel('Senha').fill('short');
		// The browser's own minlength stops it first; the server check is covered by the unit tests.
		await page.getByRole('button', { name: 'Criar conta' }).click();

		await expect(page.getByRole('heading', { name: 'Confira seu email' })).toHaveCount(0);
		await expect(page).toHaveURL(/signup/);
	});
});

test.describe('sign in and out', () => {
	test('signs in with the right password, lands where it was going, and signs out', async ({
		page
	}) => {
		const user = await createUser('Ana Souza');

		await signIn(page, user, '/tables');
		await expect(page).toHaveURL(/\/tables$/);

		await signOut(page, user.name);
		await expect(page.getByRole('banner').getByText(user.name)).toHaveCount(0);
	});

	test('a wrong password and an unknown address get the same message', async ({ page }) => {
		const user = await createUser('Bruno Lima');

		await page.goto('/login');
		await page.getByLabel('Email').fill(user.email);
		await page.getByLabel('Senha').fill('the wrong password');
		await page.getByRole('button', { name: 'Entrar', exact: true }).click();
		const wrong = await page.getByRole('alert').textContent();

		await page.getByLabel('Email').fill(uniqueEmail('nobody'));
		await page.getByLabel('Senha').fill('the wrong password');
		await page.getByRole('button', { name: 'Entrar', exact: true }).click();
		const unknown = await page.getByRole('alert').textContent();

		expect(wrong).toContain('Email ou senha incorretos.');
		expect(unknown).toBe(wrong);
	});

	test('a signed-in visitor who opens the login page is sent on, not asked again', async ({
		page
	}) => {
		const user = await createUser('Caio Reis');
		await signIn(page, user);

		await page.goto('/login?next=%2Ftables');

		await expect(page).toHaveURL(/\/tables$/);
	});

	test('a protected page sends an anonymous visitor to log in and back afterwards', async ({
		page
	}) => {
		const user = await createUser('Dani Alves');

		await page.goto('/account/tables');
		await expect(page).toHaveURL(/login\?next=%2Faccount%2Ftables/);
		await page.getByLabel('Email').fill(user.email);
		await page.getByLabel('Senha').fill(user.password);
		await page.getByRole('button', { name: 'Entrar', exact: true }).click();

		await expect(page).toHaveURL(/\/account\/tables$/);
		await expect(page.getByRole('heading', { level: 1, name: 'Minhas mesas' })).toBeVisible();
	});

	test('does not follow a next that leaves the site', async ({ page }) => {
		const user = await createUser('Edu Motta');

		await page.goto('/login?next=https%3A%2F%2Fevil.example%2F');
		await page.getByLabel('Email').fill(user.email);
		await page.getByLabel('Senha').fill(user.password);
		await page.getByRole('button', { name: 'Entrar', exact: true }).click();

		await expect(accountMenu(page, user.name)).toBeVisible();
		expect(new URL(page.url()).host).toBe('localhost:4173');
	});
});

test.describe('password reset', () => {
	test('the whole round trip: ask, open the emailed link, choose a new password, sign in with it', async ({
		page
	}) => {
		const user = await createUser('Fabi Costa');

		await page.goto('/forgot-password');
		await page.getByLabel('Email').fill(user.email);
		await page.getByRole('button', { name: 'Enviar link' }).click();
		await expect(page.getByRole('heading', { name: 'Confira seu email' })).toBeVisible();

		const [message] = await inbox(user.email, { waitFor: /reset|recover|password/i });
		const link = linkIn(message);
		expect(link, 'the reset email has a link').toBeTruthy();
		await page.goto(link!);

		// The link signed them in and brought them to the new-password page.
		await expect(page).toHaveURL(/\/reset-password$/);
		await expect(page.getByRole('heading', { level: 1, name: 'Nova senha' })).toBeVisible();

		await page.getByLabel('Nova senha', { exact: true }).fill('a completely new secret');
		await page.getByLabel('Repita a nova senha').fill('a completely new secret');
		await page.getByRole('button', { name: 'Salvar nova senha' }).click();

		await expect(page.getByRole('heading', { level: 1, name: 'Senha alterada' })).toBeVisible();
		await expect(accountMenu(page, user.name)).toBeVisible();

		await signOut(page, user.name);

		// The old password no longer works; the new one does.
		await page.goto('/login');
		await page.getByLabel('Email').fill(user.email);
		await page.getByLabel('Senha').fill(user.password);
		await page.getByRole('button', { name: 'Entrar', exact: true }).click();
		await expect(page.getByRole('alert')).toContainText('Email ou senha incorretos.');

		await signIn(page, { ...user, password: 'a completely new secret' });
	});

	test('two different passwords are refused, and nothing is changed', async ({ page }) => {
		const user = await createUser('Gabi Nunes');
		await page.goto('/forgot-password');
		await page.getByLabel('Email').fill(user.email);
		await page.getByRole('button', { name: 'Enviar link' }).click();
		const [message] = await inbox(user.email, { waitFor: /reset|recover|password/i });
		await page.goto(linkIn(message)!);

		await page.getByLabel('Nova senha', { exact: true }).fill('a completely new secret');
		await page.getByLabel('Repita a nova senha').fill('a completely NEW secret');
		await page.getByRole('button', { name: 'Salvar nova senha' }).click();

		await expect(page.getByText('As senhas não são iguais.')).toBeVisible();
		await expect(page.getByRole('heading', { level: 1, name: 'Senha alterada' })).toHaveCount(0);
	});

	test('a request for an address with no account looks the same and sends nothing', async ({
		page
	}) => {
		const nobody = uniqueEmail('nobody');

		await page.goto('/forgot-password');
		await page.getByLabel('Email').fill(nobody);
		await page.getByRole('button', { name: 'Enviar link' }).click();

		await expect(page.getByRole('heading', { name: 'Confira seu email' })).toBeVisible();
		await page.waitForTimeout(1500);
		expect(await inbox(nobody)).toEqual([]);
	});

	test('a link that is opened a second time no longer works', async ({ page, browser }) => {
		const user = await createUser('Hugo Prado');
		await page.goto('/forgot-password');
		await page.getByLabel('Email').fill(user.email);
		await page.getByRole('button', { name: 'Enviar link' }).click();
		const [message] = await inbox(user.email, { waitFor: /reset|recover|password/i });
		const link = linkIn(message)!;
		await page.goto(link);
		await expect(page).toHaveURL(/\/reset-password$/);

		// Another browser, with the used link: no session comes out of it.
		const other = await browser.newContext();
		const otherPage = await other.newPage();
		await otherPage.goto(link);

		await expect(otherPage).not.toHaveURL(/\/reset-password$/);
		await other.close();
	});
});
