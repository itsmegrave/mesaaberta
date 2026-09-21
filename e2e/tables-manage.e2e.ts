import { expect, test } from '@playwright/test';
import { PNG, createTable, signIn, uniqueTitle } from './support/app';
import { createUser, database } from './support/users';

// A signed-in GM creating and managing tables, against the local Supabase.
test.skip(({ isMobile }) => isMobile, 'signed-in flows run on desktop only');

test.describe('creating a table', () => {
	test('a signed-in user opens a table and sees it live at its own address (the M1 goal)', async ({
		page,
		browser
	}) => {
		const gm = await createUser('Mestra Ana');
		const title = uniqueTitle('Mesa do Lich');
		await signIn(page, gm);

		const slug = await createTable(page, { title, description: 'Uma noite só.\nTraga dados.' });

		// The address is made from the title, in English path, no numeric id.
		expect(slug).toMatch(/^mesa-do-lich-[a-z0-9]+$/);
		await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
		await expect(page.getByRole('main').getByText(gm.username)).toBeVisible();
		await expect(page.getByText('5 vagas restantes').first()).toBeVisible();
		await expect(page.getByText('Você é o mestre desta mesa.')).toBeVisible();

		// An anonymous visitor sees the same table, at the same address, in the list too.
		const visitor = await browser.newContext();
		const anon = await visitor.newPage();
		await anon.goto(`/tables/${slug}`);
		await expect(anon.getByRole('heading', { level: 1 })).toHaveText(title);
		await anon.goto('/tables');
		await expect(anon.getByRole('link', { name: title })).toBeVisible();
		await visitor.close();
	});

	test('two tables with the same title get different addresses', async ({ page }) => {
		const gm = await createUser('Mestre Beto');
		const title = uniqueTitle('Repetida');
		await signIn(page, gm);

		const first = await createTable(page, { title });
		const second = await createTable(page, { title });

		expect(second).toBe(`${first}-2`);
	});

	test('refuses a title that is too short, saying so and keeping what was typed', async ({
		page
	}) => {
		const gm = await createUser('Mestra Cris');
		await signIn(page, gm);

		await page.goto('/tables/new');
		await page.getByLabel('Sistema de RPG').selectOption({ label: 'Daggerheart' });
		await page.getByLabel('Título').fill('ab');
		await page.getByLabel('Descrição').fill('Isto deve continuar aqui.');
		await page.getByLabel('Primeira sessão').fill('2099-06-01T19:00');
		// The browser's own minlength would stop it first; turn that off to reach the server's check.
		await page.getByLabel('Título').evaluate((el) => el.removeAttribute('minlength'));
		await page.getByRole('button', { name: 'Abrir mesa' }).click();

		await expect(page.getByText('Corrija os campos marcados.')).toBeVisible();
		await expect(page.getByLabel('Título')).toHaveValue('ab');
		await expect(page.getByLabel('Descrição')).toHaveValue('Isto deve continuar aqui.');
		await expect(page).toHaveURL(/tables\/new$/);
	});

	test('refuses a first session in the past', async ({ page }) => {
		const gm = await createUser('Mestre Davi');
		await signIn(page, gm);

		await page.goto('/tables/new');
		await page.getByLabel('Sistema de RPG').selectOption({ label: 'Daggerheart' });
		await page.getByLabel('Título').fill(uniqueTitle('Passada'));
		await page.getByLabel('Primeira sessão').fill('2020-01-01T19:00');
		await page.getByRole('button', { name: 'Abrir mesa' }).click();

		await expect(page.getByText('A primeira sessão precisa ser no futuro.')).toBeVisible();
	});

	test('a campaign asks how often it repeats', async ({ page }) => {
		const gm = await createUser('Mestra Eva');
		await signIn(page, gm);
		await page.goto('/tables/new');

		await expect(page.getByLabel('Repete')).toHaveCount(0);
		await page.getByLabel('Campanha (várias sessões)').check();

		await expect(page.getByLabel('Repete')).toBeVisible();
		await expect(page.getByLabel('Última sessão até')).toBeVisible();
	});
});

test.describe('the welcome message', () => {
	const welcomeOf = async (slug: string) => {
		const sql = database();
		try {
			const [row] = await sql`select welcome_message from game_tables where slug = ${slug}`;
			return row.welcome_message as string | null;
		} finally {
			await sql.end();
		}
	};

	test('every new table starts with the friendly default, token and all', async ({ page }) => {
		const gm = await createUser('Mestra Lara');
		await signIn(page, gm);
		await page.goto('/tables/new');

		const field = page.getByLabel('Mensagem de boas-vindas');
		await expect(field).toHaveValue(
			/Olá, aventureiro\(a\)! Que alegria ter você na mesa '\{nome da mesa\}'!/
		);
		await expect(field).toHaveValue(/WhatsApp: \(##\) #####-##### \. Até breve!/);
	});

	test('is kept as written, edited later, and cleared for good', async ({ page }) => {
		const gm = await createUser('Mestre Wagner');
		await signIn(page, gm);
		const slug = await createTable(page, { title: uniqueTitle('Com boas-vindas') });
		expect(await welcomeOf(slug)).toContain("na mesa '{nome da mesa}'");

		await page.getByRole('link', { name: 'Editar mesa' }).click();
		const field = page.getByLabel('Mensagem de boas-vindas');
		await expect(field).toHaveValue(/WhatsApp/);
		await field.fill('Bem-vinda! Me chama no (11) 90000-0000.');
		await page.getByRole('button', { name: 'Salvar alterações' }).click();
		await expect(page).toHaveURL(new RegExp(`/tables/${slug}$`));
		expect(await welcomeOf(slug)).toBe('Bem-vinda! Me chama no (11) 90000-0000.');

		// Saving other changes keeps it.
		await page.getByRole('link', { name: 'Editar mesa' }).click();
		await page.getByLabel('Título').fill('Renomeada');
		await page.getByRole('button', { name: 'Salvar alterações' }).click();
		await expect(page).toHaveURL(new RegExp(`/tables/${slug}$`));
		expect(await welcomeOf(slug)).toBe('Bem-vinda! Me chama no (11) 90000-0000.');

		// Emptying it means no message, not the default again.
		await page.getByRole('link', { name: 'Editar mesa' }).click();
		await page.getByLabel('Mensagem de boas-vindas').fill('');
		await page.getByRole('button', { name: 'Salvar alterações' }).click();
		await expect(page).toHaveURL(new RegExp(`/tables/${slug}$`));
		expect(await welcomeOf(slug)).toBeNull();
		await page.getByRole('link', { name: 'Editar mesa' }).click();
		await expect(page.getByLabel('Mensagem de boas-vindas')).toHaveValue('');
	});

	test('is never shown on the public table page', async ({ page, browser }) => {
		const gm = await createUser('Mestra Nina');
		await signIn(page, gm);
		await page.goto('/tables/new');
		await page.getByLabel('Sistema de RPG').selectOption({ label: 'Daggerheart' });
		await page.getByLabel('Título').fill(uniqueTitle('Privada'));
		await page.getByLabel('Primeira sessão').fill('2099-06-01T19:00');
		await page.getByLabel('Mensagem de boas-vindas').fill('Segredo só para quem entrar.');
		await page.getByRole('button', { name: 'Abrir mesa' }).click();
		await expect(page).toHaveURL(/\/tables\/[^/]+$/);

		const visitor = await browser.newContext();
		const anon = await visitor.newPage();
		await anon.goto(page.url());
		await expect(anon.getByText('Segredo só para quem entrar.')).toHaveCount(0);
		await visitor.close();
	});

	test('a message over the limit is refused, and what was typed stays', async ({ page }) => {
		const gm = await createUser('Mestre Otto');
		await signIn(page, gm);
		await page.goto('/tables/new');

		await page.getByLabel('Sistema de RPG').selectOption({ label: 'Daggerheart' });
		await page.getByLabel('Título').fill(uniqueTitle('Longa'));
		await page.getByLabel('Primeira sessão').fill('2099-06-01T19:00');
		const field = page.getByLabel('Mensagem de boas-vindas');
		// The browser's own maxlength would stop the typing; turn it off to reach the server's check.
		await field.evaluate((el) => el.removeAttribute('maxlength'));
		await field.fill('x'.repeat(1001));
		await page.getByRole('button', { name: 'Abrir mesa' }).click();

		await expect(page.getByText('Corrija os campos marcados.')).toBeVisible();
		await expect(field).toHaveValue('x'.repeat(1001));
		await expect(page).toHaveURL(/tables\/new$/);
	});
});

test.describe('images', () => {
	test('uploads a picture to Storage and keeps its path on the table', async ({
		page,
		request
	}) => {
		const gm = await createUser('Mestra Fernanda');
		await signIn(page, gm);

		const slug = await createTable(page, {
			title: uniqueTitle('Com imagem'),
			image: { name: 'capa.png', mimeType: 'image/png', buffer: PNG }
		});

		const sql = database();
		try {
			const [row] = await sql`select image_path from game_tables where slug = ${slug}`;
			expect(row.image_path).toMatch(/^tables\/[0-9a-f-]{36}\.png$/);

			// The file is really in the bucket, publicly readable.
			const url = `${process.env.E2E_API_URL ?? 'http://127.0.0.1:54341'}/storage/v1/object/public/table-images/${row.image_path}`;
			const stored = await request.get(url);
			expect(stored.status()).toBe(200);
			expect(stored.headers()['content-type']).toContain('image/png');
		} finally {
			await sql.end();
		}
	});

	test('refuses a file that only pretends to be an image, and creates no table', async ({
		page
	}) => {
		const gm = await createUser('Mestre Gil');
		const title = uniqueTitle('Falsa imagem');
		await signIn(page, gm);

		await page.goto('/tables/new');
		await page.getByLabel('Sistema de RPG').selectOption({ label: 'Daggerheart' });
		await page.getByLabel('Título').fill(title);
		await page.getByLabel('Primeira sessão').fill('2099-06-01T19:00');
		await page.getByLabel('Imagem').setInputFiles({
			name: 'capa.png',
			mimeType: 'image/png',
			buffer: Buffer.from('<script>alert(1)</script>')
		});
		await page.getByRole('button', { name: 'Abrir mesa' }).click();

		await expect(page.getByText('Use uma imagem PNG, JPEG ou WebP.')).toBeVisible();
		const sql = database();
		try {
			expect(await sql`select 1 from game_tables where title = ${title}`).toHaveLength(0);
		} finally {
			await sql.end();
		}
	});
});

test.describe('editing and disabling', () => {
	test('the GM renames a table and its address stays', async ({ page }) => {
		const gm = await createUser('Mestra Helena');
		await signIn(page, gm);
		const slug = await createTable(page, { title: uniqueTitle('Nome antigo') });

		await page.getByRole('link', { name: 'Editar mesa' }).click();
		await expect(page).toHaveURL(new RegExp(`/tables/${slug}/edit$`));
		await page.getByLabel('Título').fill('Nome novo');
		await page.getByRole('button', { name: 'Salvar alterações' }).click();

		await expect(page).toHaveURL(new RegExp(`/tables/${slug}$`));
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nome novo');
	});

	test('another member cannot edit it, and is not offered the link', async ({ page, browser }) => {
		const gm = await createUser('Mestre Igor');
		const other = await createUser('Jogadora Julia');
		await signIn(page, gm);
		const slug = await createTable(page, { title: uniqueTitle('Só do Igor') });

		const context = await browser.newContext();
		const otherPage = await context.newPage();
		await signIn(otherPage, other);
		await otherPage.goto(`/tables/${slug}`);
		await expect(otherPage.getByRole('link', { name: 'Editar mesa' })).toHaveCount(0);

		const response = await otherPage.goto(`/tables/${slug}/edit`);
		expect(response?.status()).toBe(403);
		await context.close();
	});

	test('an admin can edit any table', async ({ page, browser }) => {
		const gm = await createUser('Mestra Kátia');
		const admin = await createUser('Admin Lucas', { role: 'admin' });
		await signIn(page, gm);
		const slug = await createTable(page, { title: uniqueTitle('Da Kátia') });

		const context = await browser.newContext();
		const adminPage = await context.newPage();
		await signIn(adminPage, admin);
		await adminPage.goto(`/tables/${slug}`);
		await adminPage.getByRole('link', { name: 'Editar mesa' }).click();
		await adminPage.getByLabel('Título').fill('Editada pelo admin');
		await adminPage.getByRole('button', { name: 'Salvar alterações' }).click();

		await expect(adminPage.getByRole('heading', { level: 1 })).toHaveText('Editada pelo admin');
		await context.close();
	});

	test('disabling takes a table off the public pages, and its address answers 404', async ({
		page,
		browser
	}) => {
		const gm = await createUser('Mestre Marcos');
		const title = uniqueTitle('Vai sumir');
		await signIn(page, gm);
		const slug = await createTable(page, { title });

		await page.goto(`/tables/${slug}/edit`);
		await page.getByRole('button', { name: 'Desativar mesa' }).click();
		await expect(page).toHaveURL(/\/tables$/);
		await expect(page.getByRole('link', { name: title })).toHaveCount(0);

		const visitor = await browser.newContext();
		const anon = await visitor.newPage();
		const response = await anon.goto(`/tables/${slug}`);
		expect(response?.status()).toBe(404);
		await visitor.close();

		// The GM still finds it, marked, on their dashboard.
		await page.goto('/account/tables');
		await expect(page.getByText(title)).toBeVisible();
		await expect(page.getByText('Mesa desativada')).toBeVisible();
	});
});
