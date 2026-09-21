import { expect, test, type Page } from '@playwright/test';
import { signOut } from './support/app';
import { PASSWORD, createUser, database } from './support/users';

// The onboarding step after sign-up, and the gate that holds an incomplete profile there. Against
// the local Supabase and its real Postgres.
test.skip(({ isMobile }) => isMobile, 'signed-in flows run on desktop only');

const unique = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** Signs in through the login form as somebody without a username, who is sent to the onboarding. */
async function signInIncomplete(page: Page, user: { email: string }, next = '/') {
	await page.goto(`/login?next=${encodeURIComponent(next)}`);
	await page.getByLabel('Email').fill(user.email);
	await page.getByLabel('Senha').fill(PASSWORD);
	await page.getByRole('button', { name: 'Entrar', exact: true }).click();
	await expect(page).toHaveURL(/\/onboarding/);
}

test.describe('an incomplete profile', () => {
	test('is sent to the onboarding after signing in, and on to where it was going once it is done', async ({
		page
	}) => {
		const user = await createUser('Legado Antigo', { incomplete: true });
		await signInIncomplete(page, user, '/tables/new');
		await expect(page).toHaveURL(/\/onboarding\?next=%2Ftables%2Fnew$/);
		await expect(page.getByRole('heading', { name: 'Complete seu perfil' })).toBeVisible();

		// The name from the account is already there; only the username is missing.
		await expect(page.getByLabel('Nome', { exact: true })).toHaveValue('Legado Antigo');
		await page.getByLabel('Nome de usuário').fill(`legado-${unique()}`);
		await page.getByRole('button', { name: 'Salvar e continuar' }).click();

		await expect(page).toHaveURL(/\/tables\/new$/);
		await expect(page.getByRole('heading', { name: 'Abrir uma mesa' })).toBeVisible();
	});

	test('cannot reach the authenticated pages, but the public ones stay open', async ({ page }) => {
		const user = await createUser('Sem Nome', { incomplete: true });
		await signInIncomplete(page, user);

		for (const path of ['/tables/new', '/account/tables']) {
			await page.goto(path);
			await expect(page).toHaveURL(new RegExp(`/onboarding\\?next=${encodeURIComponent(path)}$`));
		}
		await page.goto('/tables');
		await expect(page).toHaveURL(/\/tables$/);
		await page.goto('/');
		await expect(page).toHaveURL(/localhost:4173\/$/);
	});

	test('can still sign out from the onboarding', async ({ page }) => {
		const user = await createUser('Quer Sair', { incomplete: true });
		await signInIncomplete(page, user);

		await signOut(page, 'Jogador');

		// Signed out: an authenticated page asks to log in again.
		await page.goto('/tables/new');
		await expect(page).toHaveURL(/\/login/);
	});
});

test.describe('the onboarding form', () => {
	test('saves the details and the links in the order chosen', async ({ page }) => {
		const user = await createUser('Cheia Detalhes', { incomplete: true });
		await signInIncomplete(page, user);
		const username = `detalhes-${unique()}`;

		await page.getByLabel('Nome de usuário').fill(username);
		await page.getByLabel('Idade', { exact: true }).fill('31');
		await page.getByLabel('Gênero').fill('mulher');
		await page.getByLabel('Cidade').fill('Recife');
		await page.getByRole('button', { name: 'Adicionar link' }).click();
		await page.getByLabel('Rede do link 1').selectOption('instagram');
		await page.getByLabel('Endereço do link 1').fill('instagram.com/detalhes');
		await page.getByRole('button', { name: 'Adicionar link' }).click();
		await page.getByLabel('Rede do link 2').selectOption('github');
		await page.getByLabel('Endereço do link 2').fill('https://github.com/detalhes');
		// Reordered with the keyboard-operable buttons.
		await page.getByRole('button', { name: 'Subir link 2' }).click();
		await page.getByRole('button', { name: 'Salvar e continuar' }).click();

		await expect(page).toHaveURL(/localhost:4173\/$/);
		const sql = database();
		try {
			const [profile] = await sql`select * from profiles where id = ${user.id}`;
			expect(profile).toMatchObject({ username, age: 31, gender: 'mulher', city: 'Recife' });
			const links =
				await sql`select network, url from profile_social_links where profile_id = ${user.id} order by position`;
			expect(links).toEqual([
				{ network: 'github', url: 'https://github.com/detalhes' },
				{ network: 'instagram', url: 'https://instagram.com/detalhes' }
			]);
		} finally {
			await sql.end();
		}
	});

	test('says a username is taken as soon as it is typed, and refuses it on save too', async ({
		page
	}) => {
		const taken = await createUser('Dona Do Nome');
		const user = await createUser('Chegou Depois', { incomplete: true });
		await signInIncomplete(page, user);

		await page.getByLabel('Nome de usuário').fill(taken.username.toUpperCase());
		await expect(page.getByText('Esse nome já está em uso. Escolha outro.')).toBeVisible();

		// The check is only advice: saving still goes to the server, which decides.
		await page.getByRole('button', { name: 'Salvar e continuar' }).click();
		await expect(page.getByText('Esse nome já está em uso. Escolha outro.')).toBeVisible();
		await expect(page).toHaveURL(/\/onboarding/);
	});

	test('explains what is wrong, next to the field, and keeps what was typed', async ({ page }) => {
		const user = await createUser('Erra Tudo', { incomplete: true });
		await signInIncomplete(page, user);

		await page.getByLabel('Nome de usuário').fill('admin');
		await page.getByLabel('Cidade').fill('Natal');
		await page.getByRole('button', { name: 'Salvar e continuar' }).click();

		await expect(page.getByText('Esse nome é reservado. Escolha outro.')).toBeVisible();
		await expect(page.getByLabel('Nome de usuário')).toHaveAttribute('aria-invalid', 'true');
		await expect(page.getByLabel('Cidade')).toHaveValue('Natal');
	});

	test('sends someone who already has a username on, and needs no script to be filled in', async ({
		browser
	}) => {
		const done = await createUser('Ja Completo');
		const context = await browser.newContext({ javaScriptEnabled: false });
		const page = await context.newPage();
		await page.goto(`/login?next=${encodeURIComponent('/tables')}`);
		await page.getByLabel('Email').fill(done.email);
		await page.getByLabel('Senha').fill(PASSWORD);
		await page.getByRole('button', { name: 'Entrar', exact: true }).click();
		await expect(page).toHaveURL(/\/tables$/);
		await page.goto('/onboarding?next=/tables');
		await expect(page).toHaveURL(/\/tables$/);
		await context.close();

		// Without JavaScript the form is a plain POST, so nobody is locked out by the gate.
		const legacy = await createUser('Sem Script', { incomplete: true });
		const plain = await (await browser.newContext({ javaScriptEnabled: false })).newPage();
		await plain.goto('/login');
		await plain.getByLabel('Email').fill(legacy.email);
		await plain.getByLabel('Senha').fill(PASSWORD);
		await plain.getByRole('button', { name: 'Entrar', exact: true }).click();
		await expect(plain).toHaveURL(/\/onboarding/);
		await plain.getByLabel('Nome de usuário').fill(`semscript-${unique()}`);
		await plain.getByRole('button', { name: 'Salvar e continuar' }).click();
		await expect(plain).toHaveURL(/localhost:4173\/$/);
		await plain.context().close();
	});

	test('renders and hydrates without a single CSP violation', async ({ page }) => {
		const user = await createUser('Politica Csp', { incomplete: true });
		await page.addInitScript(() =>
			document.addEventListener('securitypolicyviolation', (event) =>
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				((window as any).__violations ??= []).push(`${event.violatedDirective} ${event.blockedURI}`)
			)
		);
		const messages: string[] = [];
		page.on('console', (message) => {
			if (/content security policy/i.test(message.text())) messages.push(message.text());
		});

		await signInIncomplete(page, user);
		await page.getByRole('button', { name: 'Adicionar link' }).click();
		await page.getByLabel('Nome de usuário').fill(`csp-${unique()}`);
		await expect(page.getByText('Esse nome está livre.')).toBeVisible();

		const reported = await page.evaluate(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			() => (window as any).__violations ?? []
		);
		expect([...messages, ...reported]).toEqual([]);
	});
});
