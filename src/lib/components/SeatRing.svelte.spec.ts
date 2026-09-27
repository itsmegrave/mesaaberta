import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SeatRing from './SeatRing.svelte';

describe('SeatRing', () => {
	it('renders table surface and correct number of seat circles', () => {
		render(SeatRing, { capacity: 5, seatsLeft: 2 });

		const circles = document.querySelectorAll('circle');
		// 1 center table + 5 seats = 6 circles
		expect(circles.length).toBe(6);

		const svg = document.querySelector('svg');
		expect(svg?.getAttribute('aria-label')).toBe('3 de 5 vagas ocupadas');
	});

	it('renders full table properly', () => {
		render(SeatRing, { capacity: 4, seatsLeft: 0 });

		const svg = document.querySelector('svg');
		expect(svg?.getAttribute('aria-label')).toBe('4 de 4 vagas ocupadas');
	});

	it('renders empty table properly', () => {
		render(SeatRing, { capacity: 6, seatsLeft: 6 });

		const svg = document.querySelector('svg');
		expect(svg?.getAttribute('aria-label')).toBe('0 de 6 vagas ocupadas');
	});

	it('sets width and height from size prop', () => {
		render(SeatRing, { capacity: 5, seatsLeft: 2, size: 112 });

		const svg = document.querySelector('svg');
		expect(svg?.getAttribute('width')).toBe('112');
		expect(svg?.getAttribute('height')).toBe('112');
	});
});
