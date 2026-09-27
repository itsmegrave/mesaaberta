import { expect, test } from '@playwright/test';
import { PNG, signIn } from './support/app';
import { createUser, database } from './support/users';

// The profile page: editing, the data export and closing the account. Against the local Supabase.
test.skip(({ isMobile }) => isMobile, 'signed-in flows run on desktop only');

test('the account menu leads to the profile, where the details are saved and the username stays', async ({
	page
}) => {
	const user = await createUser('Perfil Editado');
	await signIn(page, user);

	await page
		.getByRole('banner')
		.getByRole('button', { name: /menu da conta/i })
		.click();
	await page
		.getByRole('navigation', { name: 'Menu da conta' })
		.getByRole('link', { name: /perfil/i })
		.click();
	await expect(page).toHaveURL(/\/account\/profile$/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Seu perfil');

	await expect(page.getByLabel('Email')).toHaveValue(user.email);
	await expect(page.getByLabel('Nome de usuário')).toHaveAttribute('readonly', '');
	await page.getByLabel('Cidade').fill('Recife');
	await page.getByRole('button', { name: 'Salvar perfil' }).click();
	await expect(page.getByText('Perfil salvo.')).toBeVisible();

	await page.reload();
	await expect(page.getByLabel('Cidade')).toHaveValue('Recife');
	await expect(page.getByLabel('Nome de usuário')).toHaveValue(user.username);
});

test('downloads a copy of the account data as JSON', async ({ page }) => {
	const user = await createUser('Dados Exportados');
	await signIn(page, user, '/account/profile');

	const download = page.waitForEvent('download');
	await page.getByRole('link', { name: 'Baixar meus dados' }).click();
	const file = await download;

	expect(file.suggestedFilename()).toMatch(/^mesa-aberta-dados-\d{4}-\d{2}-\d{2}\.json$/);
	const data = JSON.parse(
		await (await file.createReadStream()).toArray().then((c) => Buffer.concat(c).toString())
	);
	expect(data.account).toEqual({ id: user.id, email: user.email });
	expect(data.profile.username).toBe(user.username);
});

test('closing the account asks for the username, then removes the person and signs them out', async ({
	page
}) => {
	const user = await createUser('Conta Apagada');
	await signIn(page, user, '/account/profile');

	await page.getByLabel('Digite seu @usuário para confirmar').fill('outra-pessoa');
	await page.getByRole('button', { name: 'Apagar minha conta' }).click();
	await expect(page.getByRole('alert')).toContainText('O @usuário digitado não confere.');

	await page.getByLabel('Digite seu @usuário para confirmar').fill(user.username);
	await page.getByRole('button', { name: 'Apagar minha conta' }).click();
	await expect(page).toHaveURL(/localhost:\d+\/$/);
	await expect(
		page.getByRole('banner').getByRole('button', { name: /menu da conta/i })
	).toHaveCount(0);

	const sql = database();
	try {
		const [profile] = await sql`select username, name from profiles where id = ${user.id}`;
		expect(profile).toEqual({ username: null, name: null });
		const [auth] = await sql`select count(*)::int as n from auth.users where id = ${user.id}`;
		expect(auth.n).toBe(0);
	} finally {
		await sql.end();
	}
});

test('uploads a profile picture to the own folder, shows it in the header, and removes it', async ({
	page
}) => {
	const user = await createUser('Foto Enviada');
	await signIn(page, user, '/account/profile');
	await expect(page.getByRole('button', { name: 'Remover foto enviada' })).toHaveCount(0);

	await page.getByLabel('Escolher foto').setInputFiles({
		name: 'eu.png',
		mimeType: 'image/png',
		buffer: PNG
	});
	await page.getByRole('button', { name: 'Enviar foto' }).click();
	await expect(page.getByText('Foto atualizada.')).toBeVisible();

	const sql = database();
	try {
		const [{ avatar_path: path }] =
			await sql`select avatar_path from profiles where id = ${user.id}`;
		expect(path).toMatch(new RegExp(`^${user.id}/[0-9a-f-]+\\.png$`));
		await expect(
			page.getByRole('banner').locator(`img[src$="/profile-avatars/${path}"]`)
		).toHaveCount(1);

		await page.getByRole('button', { name: 'Remover foto enviada' }).click();
		await expect(page.getByText('Foto removida.', { exact: false })).toBeVisible();
		const [after] = await sql`select avatar_path from profiles where id = ${user.id}`;
		expect(after.avatar_path).toBeNull();
		const [file] =
			await sql`select count(*)::int as n from storage.objects where bucket_id = 'profile-avatars' and name = ${path}`;
		expect(file.n).toBe(0);
	} finally {
		await sql.end();
	}
});

test('refuses a file that is not a picture', async ({ page }) => {
	const user = await createUser('Foto Falsa');
	await signIn(page, user, '/account/profile');

	await page.getByLabel('Escolher foto').setInputFiles({
		name: 'eu.png',
		mimeType: 'image/png',
		buffer: Buffer.from('<svg onload="alert(1)"></svg>')
	});
	await page.getByRole('button', { name: 'Enviar foto' }).click();
	await expect(page.getByRole('alert')).toContainText('Envie uma foto PNG, JPEG ou WebP.');
});
