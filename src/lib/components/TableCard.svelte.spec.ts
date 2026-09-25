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
	capacity: 5,
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
		await expect.element(page.getByText(/sábado, 10 de outubro às 19:00/)).toBeInTheDocument();
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

	it('renders cover image with decorative alt="" and overlay chips', async () => {
		render(TableCard, {
			table: {
				...base,
				imageUrl: 'https://example.com/cover.jpg'
			}
		});

		const img = document.querySelector('img');
		expect(img).not.toBeNull();
		expect(img?.getAttribute('alt')).toBe('');
		expect(img?.getAttribute('src')).toBe('https://example.com/cover.jpg');

		// Seat ring rendered
		const svg = document.querySelector('svg[aria-label="2 de 5 vagas ocupadas"]');
		expect(svg).not.toBeNull();
		expect(svg?.getAttribute('width')).toBe('64');
	});

	it('renders solid petrol tile without cover image and larger seat ring', async () => {
		render(TableCard, { table: { ...base, imageUrl: null } });

		expect(document.querySelector('img')).toBeNull();

		const svg = document.querySelector('svg[aria-label="2 de 5 vagas ocupadas"]');
		expect(svg).not.toBeNull();
		expect(svg?.getAttribute('width')).toBe('112');
	});

	it('renders chips line with first platform ("Discord +1") and first tag with "+N"', async () => {
		render(TableCard, {
			table: {
				...base,
				platforms: [
					{ name: 'Discord', slug: 'discord' },
					{ name: 'Foundry VTT', slug: 'foundry-vtt' }
				],
				tags: [
					{ name: 'Dungeon crawl', slug: 'dungeon-crawl' },
					{ name: 'Terror', slug: 'terror' },
					{ name: 'Iniciantes', slug: 'iniciantes' }
				]
			}
		});

		await expect.element(page.getByText(/Discord \+1/)).toBeVisible();
		await expect.element(page.getByText('Dungeon crawl')).toBeVisible();
		await expect.element(page.getByText('+2')).toBeVisible();
	});

	it('shows plain text, never markup, from a title', async () => {
		render(TableCard, { table: { ...base, title: '<img src=x onerror=alert(1)>' } });

		await expect
			.element(page.getByRole('link', { name: '<img src=x onerror=alert(1)>' }))
			.toBeVisible();
		expect(document.querySelectorAll('img')).toHaveLength(0);
	});
});
