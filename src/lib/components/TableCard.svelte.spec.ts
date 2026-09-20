import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TableCard from './TableCard.svelte';

const base = {
	slug: 'mesa-do-dragao',
	title: 'Mesa do Dragão',
	kind: 'one_shot' as const,
	system: { name: 'Dungeons & Dragons 5e (2014)' },
	gmName: 'Mestre Ana',
	seatsLeft: 3,
	timezone: 'America/Sao_Paulo',
	nextAt: new Date('2026-10-10T22:00:00Z')
};

describe('TableCard', () => {
	it('links the title to the table at its own slug', async () => {
		render(TableCard, { table: base });

		await expect
			.element(page.getByRole('link', { name: 'Mesa do Dragão' }))
			.toHaveAttribute('href', '/tables/mesa-do-dragao');
	});

	it("shows the system, the kind, the GM and the next session in the table's timezone", async () => {
		render(TableCard, { table: base });

		await expect.element(page.getByText('Dungeons & Dragons 5e (2014)')).toBeVisible();
		await expect.element(page.getByText('One-shot')).toBeVisible();
		await expect.element(page.getByText('Mestre: Mestre Ana')).toBeVisible();
		await expect.element(page.getByText(/sábado, 10 de outubro às 19:00/)).toBeVisible();
	});

	it('badges a campaign as one', async () => {
		render(TableCard, { table: { ...base, kind: 'campaign' } });

		await expect.element(page.getByText('Campanha')).toBeVisible();
	});

	it.each([
		[5, '5 vagas restantes'],
		[1, '1 vaga restante'],
		[0, 'Mesa cheia']
	])('says %i seats left as %j', async (seatsLeft, text) => {
		render(TableCard, { table: { ...base, seatsLeft } });

		await expect.element(page.getByText(text)).toBeVisible();
	});

	it('shows plain text, never markup, from a title', async () => {
		render(TableCard, { table: { ...base, title: '<img src=x onerror=alert(1)>' } });

		await expect
			.element(page.getByRole('link', { name: '<img src=x onerror=alert(1)>' }))
			.toBeVisible();
		expect(document.querySelectorAll('img')).toHaveLength(0);
	});
});
