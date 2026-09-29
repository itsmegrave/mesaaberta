import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Slow } from './slow.svelte';

describe('Slow', () => {
  let cleanup = () => {};
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  /** A value that changes over time, watched by a `Slow` inside an effect root. */
  function watch(delay: number) {
    let value = $state<string | null>(null);
    let slow!: Slow<string>;
    cleanup = $effect.root(() => {
      slow = new Slow(() => value, delay);
    });
    return {
      slow,
      set: (next: string | null) => {
        value = next;
        flushSync();
      },
    };
  }

  it('shows nothing while the value is new, so a quick navigation does not flash', () => {
    const { slow, set } = watch(150);
    set('/tables');
    vi.advanceTimersByTime(149);
    expect(slow.current).toBeNull();
  });

  it('shows the value once it has lasted past the delay', () => {
    const { slow, set } = watch(150);
    set('/tables');
    vi.advanceTimersByTime(150);
    expect(slow.current).toBe('/tables');
  });

  it('clears as soon as the value goes away, and starts over for the next one', () => {
    const { slow, set } = watch(150);
    set('/tables');
    vi.advanceTimersByTime(150);
    set(null);
    expect(slow.current).toBeNull();

    set('/notifications');
    vi.advanceTimersByTime(100);
    expect(slow.current).toBeNull();
  });
});
