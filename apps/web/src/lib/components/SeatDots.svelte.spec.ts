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

  it('dashes only the head of a free seat, not its backrest', () => {
    render(SeatDots, { taken: 0, capacity: 1 });

    expect(
      document.querySelector('[data-chair="free"] circle')?.getAttribute('stroke-dasharray'),
    ).toBe('6 5.8');
    expect(
      document.querySelector('[data-chair="free"] path')?.hasAttribute('stroke-dasharray'),
    ).toBe(false);
  });

  it('creates the chairs as SVG, not HTML', () => {
    render(SeatDots, { taken: 1, capacity: 1 });

    expect(document.querySelector('[data-chair]')?.namespaceURI).toBe('http://www.w3.org/2000/svg');
  });
});
