import { describe, expect, it } from 'vitest';
import { inFlight } from './in-flight.svelte';

describe('inFlight', () => {
  it('counts the submits on their way, so the top bar shows while any one is', () => {
    const first = inFlight.start();
    const second = inFlight.start();
    expect(inFlight.count).toBe(2);

    first();
    expect(inFlight.count).toBe(1);
    second();
    expect(inFlight.count).toBe(0);
  });

  it('counts a finished submit once, even if its end is reported twice', () => {
    const done = inFlight.start();
    done();
    done();
    expect(inFlight.count).toBe(0);
  });
});
