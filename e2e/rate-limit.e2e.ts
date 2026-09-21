import { expect, test } from '@playwright/test';
import { asUser, createTable, uniqueTitle } from './support/app';
import { createUser, database } from './support/users';

// The per-person limits on creating and joining tables, against the local Supabase.
test.skip(({ isMobile }) => isMobile, 'signed-in flows run on desktop only');

test.describe('rate limits', () => {
	test('the sixth table in an hour is refused with a message saying when to try again', async ({
		browser
	}) => {
		const gm = await createUser('Mestra Rita');
		const { page, context } = await asUser(browser, gm);
		for (let i = 1; i <= 5; i++) await createTable(page, { title: uniqueTitle(`Mesa ${i}`) });

		const title = uniqueTitle('Mesa demais');
		await page.goto('/tables/new');
		await page.getByLabel('Sistema de RPG').selectOption({ label: 'Daggerheart' });
		await page.getByLabel('Título').fill(title);
		await page.getByLabel('Descrição').fill('Isto deve continuar aqui.');
		await page.getByLabel('Primeira sessão').fill('2099-06-01T19:00');
		await page.getByRole('button', { name: 'Abrir mesa' }).click();

		await expect(page.getByRole('alert')).toContainText(
			/Você fez isso muitas vezes em pouco tempo\. Tente de novo em (\d+ min|1 h)\./
		);
		// Nothing was lost or half done: the form is still filled and no sixth table exists.
		await expect(page).toHaveURL(/tables\/new$/);
		await expect(page.getByLabel('Título')).toHaveValue(title);
		await expect(page.getByLabel('Descrição')).toHaveValue('Isto deve continuar aqui.');
		const sql = database();
		try {
			const [{ n }] = await sql`
				select count(*)::int as n from game_tables where gm_id = ${gm.id}`;
			expect(n).toBe(5);
		} finally {
			await sql.end();
		}
		await context.close();
	});

	test('a player past the join limit is told to wait and does not get the seat', async ({
		browser
	}) => {
		const gm = await createUser('Mestre Lauro');
		const { page: gmPage, context: gmContext } = await asUser(browser, gm);
		const slug = await createTable(gmPage, { title: uniqueTitle('Mesa lotada de pedidos') });
		const player = await createUser('Jogadora Vera');
		// Twenty joins already in the last hour: the same rows a real player would have left behind.
		const sql = database();
		try {
			await sql`
				insert into events (type, actor_id, payload, created_at)
				select 'PlayerJoined', ${player.id}, '{}'::jsonb, now() - interval '10 minutes'
				from generate_series(1, 20)`;
		} finally {
			await sql.end();
		}
		const { page, context } = await asUser(browser, player);

		await page.goto(`/tables/${slug}`);
		await page.getByRole('button', { name: 'Pegar vaga' }).click();

		await expect(page.getByRole('alert')).toContainText(
			/Você fez isso muitas vezes em pouco tempo\. Tente de novo em \d+ min\./
		);
		await expect(page.getByRole('button', { name: 'Pegar vaga' })).toBeVisible();
		await expect(page.getByText('Você está nesta mesa.')).toHaveCount(0);
		await expect(page.getByText('5 vagas restantes').first()).toBeVisible();
		await context.close();
		await gmContext.close();
	});
});
