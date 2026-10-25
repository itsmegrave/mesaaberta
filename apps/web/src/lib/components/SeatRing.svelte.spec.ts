import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SeatRing from './SeatRing.svelte';

describe('SeatRing', () => {
  it('draws a chair per seat plus the GM, around the table', () => {
    render(SeatRing, { capacity: 5, seatsLeft: 2 });

    // The GM and the 3 taken seats are solid; the 2 free ones have a dashed head.
    expect(document.querySelectorAll('[data-chair]').length).toBe(6);
    expect(document.querySelectorAll('[data-chair="taken"]').length).toBe(4);
    expect(document.querySelectorAll('[data-chair="free"]').length).toBe(2);
    expect(document.querySelectorAll('[data-chair="free"] circle[stroke-dasharray]').length).toBe(
      2,
    );

    const svg = document.querySelector('svg');
    expect(svg?.getAttribute('aria-label')).toBe('3 de 5 vagas ocupadas');
  });

  it('puts the GM first, at the top', () => {
    render(SeatRing, { capacity: 5, seatsLeft: 5 });

    const first = document.querySelector('[data-chair]');
    expect(first?.getAttribute('class')).toContain('fill-primary-contrast-500');
    expect(first?.getAttribute('transform')).toMatch(/^translate\(50\.0 16\.0\) rotate\(0\)/);
  });

  it('renders full table properly', () => {
    render(SeatRing, { capacity: 4, seatsLeft: 0 });

    const svg = document.querySelector('svg');
    expect(svg?.getAttribute('aria-label')).toBe('4 de 4 vagas ocupadas');
    expect(document.querySelectorAll('[data-chair="free"]').length).toBe(0);
  });

  it('renders empty table properly', () => {
    render(SeatRing, { capacity: 6, seatsLeft: 6 });

    const svg = document.querySelector('svg');
    expect(svg?.getAttribute('aria-label')).toBe('0 de 6 vagas ocupadas');
    expect(document.querySelectorAll('[data-chair="free"]').length).toBe(6);
  });

  it('sets width and height from size prop', () => {
    render(SeatRing, { capacity: 5, seatsLeft: 2, size: 112 });

    const svg = document.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('112');
    expect(svg?.getAttribute('height')).toBe('112');
  });
});
