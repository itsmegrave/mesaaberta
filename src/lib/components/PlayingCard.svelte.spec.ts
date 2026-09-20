import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import PlayingCard from './PlayingCard.svelte';

const base = {
	slug: 'mesa-do-dragao',
	title: 'Mesa do Dragão',
	systemName: 'Daggerheart',
	gmName: 'Mestra Ana',
	status: 'confirmed' as const,
	tableStatus: 'active' as const,
	timezone: 'America/Sao_Paulo',
	nextAt: new Date('2026-10-10T22:00:00Z'),
	canRate: false,
	rating: null
};

const props = (over = {}) => ({ item: { ...base, ...over }, next: '/account/tables' });

describe('PlayingCard', () => {
	it("shows the table, its GM and the next session in the table's timezone, linked to the table", async () => {
		render(PlayingCard, props());

		await expect
			.element(page.getByRole('link', { name: 'Mesa do Dragão' }))
			.toHaveAttribute('href', '/tables/mesa-do-dragao');
		await expect.element(page.getByText('Mestre: Mestra Ana')).toBeVisible();
		await expect.element(page.getByText(/sábado, 10 de outubro às 19:00/)).toBeVisible();
		await expect.element(page.getByText('Você tem uma vaga')).toBeVisible();
	});

	it("leaves with a POST to the table's own action and comes back to the dashboard", async () => {
		render(PlayingCard, props());

		const form = page.getByRole('button', { name: 'Sair da mesa' }).element().closest('form')!;

		expect(form.method).toBe('post');
		expect(form.getAttribute('action')).toBe('/tables/mesa-do-dragao?/leave');
		expect(form.querySelector<HTMLInputElement>('input[name=next]')?.value).toBe('/account/tables');
	});

	it('shows a pending request as waiting for the GM, with a cancel action', async () => {
		render(PlayingCard, props({ status: 'pending' }));

		await expect.element(page.getByText('Aguardando o mestre')).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Cancelar pedido' })).toBeVisible();
		await expect.element(page.getByText('Você tem uma vaga')).not.toBeInTheDocument();
	});

	it('prompts to rate after the first session, pointing at the rating form', async () => {
		render(PlayingCard, props({ canRate: true }));

		await expect.element(page.getByText(/Você jogou\. Avalie/)).toBeVisible();
		await expect
			.element(page.getByRole('link', { name: 'Avaliar' }))
			.toHaveAttribute('href', '/tables/mesa-do-dragao#avaliar');
	});

	it('shows the rating already given, and offers to change it', async () => {
		render(PlayingCard, props({ canRate: true, rating: { tableScore: 4, gmScore: 5 } }));

		await expect.element(page.getByText(/Sua avaliação: mesa 4, mestre 5/)).toBeVisible();
		await expect.element(page.getByRole('link', { name: 'Mudar' })).toBeVisible();
	});

	it('does not prompt to rate before it is time', async () => {
		render(PlayingCard, props({ canRate: false }));

		await expect.element(page.getByText(/Avalie esta mesa/)).not.toBeInTheDocument();
	});

	it('says so when the table has been disabled', async () => {
		render(PlayingCard, props({ tableStatus: 'disabled' }));

		await expect.element(page.getByText('Mesa desativada')).toBeVisible();
	});
});
