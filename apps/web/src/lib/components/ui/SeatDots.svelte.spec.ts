import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SeatDots from './SeatDots.svelte';

describe('SeatDots', () => {
  it('draws one chair per seat, the taken ones first', () => {
    render(SeatDots, { taken: 3, capacity: 5 });

    const chairs = [...document.querySelectorAll('[data-chair]')];
    expect(chairs.map((chair) => chair.getAttribute('data-chair'))).toEqual([
      'taken',
      'taken',
      'taken',
      'free',
      'free',
    ]);
    expect(chairs[0].getAttribute('class')).toContain('fill-success-500');
    expect(chairs[3].getAttribute('class')).toContain('stroke-lamp');
  });

  it('draws a seat held by an invite as an unfilled primary meeple, between taken and free', () => {
    render(SeatDots, { taken: 2, capacity: 5, reserved: 1 });

    const chairs = [...document.querySelectorAll('[data-seat-state]')];
    expect(chairs.map((chair) => chair.getAttribute('data-seat-state'))).toEqual([
      'taken',
      'taken',
      'reserved',
      'free',
      'free',
    ]);
    expect(chairs[2].getAttribute('class')).toContain('stroke-primary-500');
    expect(chairs[2].getAttribute('data-chair')).toBe('free');
  });

  it('draws a free seat as an unfilled meeple', () => {
    render(SeatDots, { taken: 0, capacity: 1 });

    const [backrest, meeple] = document.querySelectorAll('[data-chair="free"] path');
    expect(backrest.getAttribute('class')).toContain('fill-none');
    expect(meeple.getAttribute('class')).toContain('fill-none');
    expect(meeple.hasAttribute('stroke-dasharray')).toBe(false);
  });

  it("draws the person as the app's meeple icon", () => {
    render(SeatDots, { taken: 1, capacity: 1 });

    const meeple = document.querySelectorAll('[data-chair] path')[1];
    expect(meeple.getAttribute('d')).toMatch(/^M256 54\.99/);
  });

  it('creates the chairs as SVG, not HTML', () => {
    render(SeatDots, { taken: 1, capacity: 1 });

    expect(document.querySelector('[data-chair]')?.namespaceURI).toBe('http://www.w3.org/2000/svg');
  });
});
