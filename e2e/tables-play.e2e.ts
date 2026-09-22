import { expect, test } from '@playwright/test';
import { asUser, createTable, uniqueTitle } from './support/app';
import { createUser, database } from './support/users';

// Players and GMs, each in their own browser, against the local Supabase and its real Postgres.
test.skip(({ isMobile }) => isMobile, 'signed-in flows run on desktop only');

const seats = (n: number) => (n === 1 ? '1 vaga restante' : `${n} vagas restantes`);

/** A GM with a table, and a helper to open a page as somebody else on it. */
async function setup(
	browser: Parameters<typeof asUser>[0],
	options: Parameters<typeof createTable>[1] extends infer T ? Partial<T> : never = {}
) {
	const gm = await createUser('Mestra Ana');
	const { page: gmPage, context: gmContext } = await asUser(browser, gm);
	const title = uniqueTitle('Mesa');
	const slug = await createTable(gmPage, { title, ...options });
	const players = [];
	for (const name of ['Bruno', 'Carla', 'Diego']) players.push(await createUser(name));

	return { gm, gmPage, gmContext, title, slug, players };
}

test.describe('joining a table that takes players at once', () => {
	test('a player takes a seat, the GM sees them, and they can leave', async ({ browser }) => {
		const { gmPage, gmContext, slug, players } = await setup(browser);
		const [bruno] = players;
		const { page, context } = await asUser(browser, bruno);

		await page.goto(`/tables/${slug}`);
		await expect(page.getByText(seats(5)).first()).toBeVisible();
		await page.getByRole('button', { name: 'Pegar vaga' }).click();

		await expect(page.getByText('Você está nesta mesa.')).toBeVisible();
		await expect(page.getByText(seats(4)).first()).toBeVisible();

		// The GM sees who sat down (names are only shown to the GM).
		await gmPage.goto(`/tables/${slug}`);
		await expect(gmPage.getByRole('heading', { name: 'Jogadores' })).toBeVisible();
		await expect(gmPage.getByRole('main').getByText(players[0].username)).toBeVisible();

		await page.getByRole('button', { name: 'Sair da mesa' }).click();
		await expect(page.getByRole('button', { name: 'Pegar vaga' })).toBeVisible();
		await expect(page.getByText(seats(5)).first()).toBeVisible();
		await context.close();
		await gmContext.close();
	});

	test('the GM cannot take a seat at their own table', async ({ browser }) => {
		const { gmPage, gmContext, slug } = await setup(browser);

		await gmPage.goto(`/tables/${slug}`);

		await expect(gmPage.getByRole('button', { name: /Pegar vaga|Pedir vaga/ })).toHaveCount(0);
		await gmContext.close();
	});

	test('the GM removes a player, who can then ask again', async ({ browser }) => {
		const { gmPage, gmContext, slug, players } = await setup(browser);
		const { page, context } = await asUser(browser, players[0]);
		await page.goto(`/tables/${slug}`);
		await page.getByRole('button', { name: 'Pegar vaga' }).click();
		await expect(page.getByText('Você está nesta mesa.')).toBeVisible();

		await gmPage.goto(`/tables/${slug}`);
		await gmPage.getByRole('button', { name: 'Remover' }).click();
		await expect(gmPage.getByText('Ninguém entrou ainda.')).toBeVisible();

		await page.reload();
		await expect(page.getByRole('button', { name: 'Pegar vaga' })).toBeVisible();
		await context.close();
		await gmContext.close();
	});

	test('a full table says so and offers no seat', async ({ browser }) => {
		const { gmContext, slug, players } = await setup(browser, { capacity: 1 });
		const first = await asUser(browser, players[0]);
		await first.page.goto(`/tables/${slug}`);
		await first.page.getByRole('button', { name: 'Pegar vaga' }).click();
		await expect(first.page.getByText('Você está nesta mesa.')).toBeVisible();

		const second = await asUser(browser, players[1]);
		await second.page.goto(`/tables/${slug}`);

		await expect(second.page.getByText('Mesa cheia').first()).toBeVisible();
		await expect(second.page.getByRole('button', { name: /Pegar vaga|Pedir vaga/ })).toHaveCount(0);
		await first.context.close();
		await second.context.close();
		await gmContext.close();
	});

	test('two players click at the same moment for the last seat: exactly one gets it', async ({
		browser
	}) => {
		const { gmContext, slug, players } = await setup(browser, { capacity: 1 });
		const a = await asUser(browser, players[0]);
		const b = await asUser(browser, players[1]);
		await Promise.all([a.page.goto(`/tables/${slug}`), b.page.goto(`/tables/${slug}`)]);

		await Promise.all([
			a.page.getByRole('button', { name: 'Pegar vaga' }).click(),
			b.page.getByRole('button', { name: 'Pegar vaga' }).click()
		]);

		await expect
			.poll(async () => {
				const winners = await Promise.all(
					[a.page, b.page].map((p) => p.getByText('Você está nesta mesa.').isVisible())
				);
				return winners.filter(Boolean).length;
			})
			.toBe(1);

		const sql = database();
		try {
			const [{ n }] = await sql`
				select count(*)::int as n from registrations r join game_tables t on t.id = r.table_id
				where t.slug = ${slug} and r.status = 'confirmed'`;
			expect(n).toBe(1);
		} finally {
			await sql.end();
		}
		await a.context.close();
		await b.context.close();
		await gmContext.close();
	});
});

test.describe('a table where the GM approves each player', () => {
	test('a request takes no seat; the GM approves it from the dashboard and the player has the seat', async ({
		browser
	}) => {
		const { gmPage, gmContext, slug, players } = await setup(browser, { joinMode: 'approval' });
		const { page, context } = await asUser(browser, players[0]);

		await page.goto(`/tables/${slug}`);
		await page.getByRole('button', { name: 'Pedir vaga' }).click();
		await expect(page.getByText('Seu pedido foi enviado. O mestre vai responder.')).toBeVisible();
		await expect(page.getByText(seats(5)).first()).toBeVisible(); // a request takes no seat

		await gmPage.goto('/account/tables');
		await expect(gmPage.getByRole('heading', { name: 'Pedidos de vaga (1)' })).toBeVisible();
		await expect(gmPage.getByText(players[0].username)).toBeVisible();
		await gmPage.getByRole('button', { name: 'Aprovar' }).click();

		await expect(gmPage).toHaveURL(/\/account\/tables$/); // the action came back to the dashboard
		await expect(
			gmPage.getByText('2 de 5 vagas ocupadas').or(gmPage.getByText('1 de 5 vagas ocupadas'))
		).toBeVisible();

		await page.reload();
		await expect(page.getByText('Você está nesta mesa.')).toBeVisible();
		await expect(page.getByText(seats(4)).first()).toBeVisible();
		await context.close();
		await gmContext.close();
	});

	test('a declined request disappears and the player can ask again', async ({ browser }) => {
		const { gmPage, gmContext, slug, players } = await setup(browser, { joinMode: 'approval' });
		const { page, context } = await asUser(browser, players[0]);
		await page.goto(`/tables/${slug}`);
		await page.getByRole('button', { name: 'Pedir vaga' }).click();

		await gmPage.goto('/account/tables');
		await gmPage.getByRole('button', { name: 'Recusar' }).click();
		await expect(gmPage.getByText('Pedidos de vaga')).toHaveCount(0);

		await page.reload();
		await expect(page.getByRole('button', { name: 'Pedir vaga' })).toBeVisible();
		await context.close();
		await gmContext.close();
	});

	test('cannot approve past the capacity: the second request stays pending', async ({
		browser
	}) => {
		const { gmPage, gmContext, slug, players } = await setup(browser, {
			joinMode: 'approval',
			capacity: 1
		});
		const first = await asUser(browser, players[0]);
		const second = await asUser(browser, players[1]);
		for (const { page } of [first, second]) {
			await page.goto(`/tables/${slug}`);
			await page.getByRole('button', { name: 'Pedir vaga' }).click();
			await expect(page.getByText('Seu pedido foi enviado. O mestre vai responder.')).toBeVisible();
		}

		await gmPage.goto(`/tables/${slug}`);
		await gmPage.getByRole('button', { name: 'Aprovar' }).first().click();
		await expect(gmPage.getByRole('button', { name: 'Aprovar' })).toHaveCount(1);
		await gmPage.getByRole('button', { name: 'Aprovar' }).click();

		await expect(gmPage.getByRole('alert')).toContainText('A mesa lotou.');
		await second.page.reload();
		// Whichever request was second is still waiting, not seated.
		const seated = await Promise.all(
			[first.page, second.page].map(
				async (p) => (await p.reload(), p.getByText('Você está nesta mesa.').isVisible())
			)
		);
		expect(seated.filter(Boolean)).toHaveLength(1);
		await first.context.close();
		await second.context.close();
		await gmContext.close();
	});
});

test.describe('ratings', () => {
	test('only after the first session: the form appears, averages follow, and it goes when the player does', async ({
		browser
	}) => {
		const { gmPage, gmContext, slug, players } = await setup(browser, { capacity: 3 });
		const { page, context } = await asUser(browser, players[0]);
		await page.goto(`/tables/${slug}`);
		await page.getByRole('button', { name: 'Pegar vaga' }).click();
		await expect(page.getByText('Você está nesta mesa.')).toBeVisible();

		// The first session is years away: nothing to rate yet.
		await expect(page.getByRole('heading', { name: 'Avalie esta mesa' })).toHaveCount(0);

		// Back-date the session, as if it had been played.
		const sql = database();
		try {
			await sql`update game_tables set starts_at = now() - interval '3 days' where slug = ${slug}`;

			await page.reload();
			await expect(page.getByRole('heading', { name: 'Avalie esta mesa' })).toBeVisible();
			await page.getByRole('group', { name: 'A mesa' }).getByLabel('5', { exact: true }).check();
			await page.getByRole('group', { name: 'O mestre' }).getByLabel('4', { exact: true }).check();
			await page.getByLabel('Comentário (opcional)').fill('Noite ótima.');
			await page.getByRole('button', { name: 'Enviar avaliação' }).click();

			await expect(
				page.getByText('Sua avaliação está salva. Você pode mudá-la quando quiser.')
			).toBeVisible();
			await expect(page.getByText('Nota da mesa:').first()).toContainText('5,0');
			await expect(page.getByText('Nota do mestre:').first()).toContainText('4,0');

			// The dashboard shows what was given, and the GM cannot rate their own table.
			await page.goto('/account/tables');
			await expect(page.getByText('Sua avaliação: mesa 5, mestre 4')).toBeVisible();
			await gmPage.goto(`/tables/${slug}`);
			await expect(gmPage.getByRole('heading', { name: 'Avalie esta mesa' })).toHaveCount(0);

			// Changing it updates the average; the comment is stored but never shown to anyone else.
			await page.goto(`/tables/${slug}`);
			await page.getByRole('group', { name: 'O mestre' }).getByLabel('2', { exact: true }).check();
			await page.getByRole('button', { name: 'Atualizar avaliação' }).click();
			await expect(page.getByText('Nota do mestre:').first()).toContainText('2,0');
			await expect(gmPage.getByText('Noite ótima.')).toHaveCount(0);

			// Removing the player removes their rating with them.
			await gmPage.goto(`/tables/${slug}`);
			await gmPage.getByRole('button', { name: 'Remover' }).click();
			await expect(gmPage.getByText('Ninguém entrou ainda.')).toBeVisible();
			const rows =
				await sql`select 1 from ratings r join game_tables t on t.id = r.table_id where t.slug = ${slug}`;
			expect(rows).toHaveLength(0);
			await gmPage.goto(`/tables/${slug}`);
			await expect(gmPage.getByText('Nota do mestre:')).toHaveCount(0);
		} finally {
			await sql.end();
		}
		await context.close();
		await gmContext.close();
	});

	test('someone with no seat, or only a pending request, cannot rate', async ({ browser }) => {
		const { gmContext, slug, players } = await setup(browser, { joinMode: 'approval' });
		const { page, context } = await asUser(browser, players[0]);
		await page.goto(`/tables/${slug}`);
		await page.getByRole('button', { name: 'Pedir vaga' }).click();

		const sql = database();
		try {
			await sql`update game_tables set starts_at = now() - interval '3 days' where slug = ${slug}`;
		} finally {
			await sql.end();
		}
		await page.reload();

		await expect(page.getByRole('heading', { name: 'Avalie esta mesa' })).toHaveCount(0);
		await context.close();
		await gmContext.close();
	});
});

test.describe('the dashboard', () => {
	test('shows what I play and what I run, and leaving comes back to it', async ({ browser }) => {
		const { gmPage, gmContext, title, slug, players } = await setup(browser);
		const { page, context } = await asUser(browser, players[0]);
		await page.goto(`/tables/${slug}`);
		await page.getByRole('button', { name: 'Pegar vaga' }).click();
		await expect(page.getByText('Você está nesta mesa.')).toBeVisible();

		await page.goto('/account/tables');
		await expect(page.getByRole('heading', { name: 'Jogando' })).toBeVisible();
		await expect(page.getByRole('link', { name: title })).toBeVisible();
		await expect(page.getByText('Você tem uma vaga')).toBeVisible();

		await gmPage.goto('/account/tables');
		await expect(gmPage.getByRole('heading', { name: 'Mestrando' })).toBeVisible();
		await expect(gmPage.getByText('1 de 5 vagas ocupadas')).toBeVisible();
		await expect(gmPage.getByText(players[0].username)).toBeVisible();

		await page.getByRole('button', { name: 'Sair da mesa' }).click();
		await expect(page).toHaveURL(/\/account\/tables$/);
		await expect(page.getByText('Você ainda não está em nenhuma mesa.')).toBeVisible();
		await context.close();
		await gmContext.close();
	});
});
