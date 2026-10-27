import { afterEach, describe, expect, it, vi } from 'vitest';
import { originOf, revealRadius, revealTheme } from './theme-transition';

const root = document.documentElement;

const reducedMotion = (reduce: boolean) =>
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        matches: query.includes('reduced-motion') && reduce,
        media: query,
      }) as MediaQueryList,
  );

afterEach(() => {
  vi.restoreAllMocks();
  delete root.dataset.themeReveal;
});

describe('revealRadius', () => {
  it('reaches the farthest corner of the viewport', () => {
    expect(revealRadius({ x: 0, y: 0 }, 300, 400)).toBe(500);
    expect(revealRadius({ x: 300, y: 400 }, 300, 400)).toBe(500);
    expect(revealRadius({ x: 150, y: 200 }, 300, 400)).toBe(250);
  });
});

describe('originOf', () => {
  it('is the centre of the control, or nothing without one', () => {
    const button = document.createElement('button');
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 20, 40, 60));
    expect(originOf(button)).toEqual({ x: 30, y: 50 });
    expect(originOf(null)).toBeUndefined();
  });
});

describe('revealTheme', () => {
  it('grows the new theme from the control inside a view transition', async () => {
    reducedMotion(false);
    const start = vi.spyOn(document, 'startViewTransition');
    const change = vi.fn();

    const done = revealTheme(change, { x: 10, y: 10 });
    expect(root.dataset.themeReveal).toBe('');
    await done;

    expect(start).toHaveBeenCalledOnce();
    expect(change).toHaveBeenCalledOnce();
  });

  it('changes in place, with no transition, under reduced motion', async () => {
    reducedMotion(true);
    const start = vi.spyOn(document, 'startViewTransition');
    const change = vi.fn();

    await revealTheme(change, { x: 10, y: 10 });

    expect(change).toHaveBeenCalledOnce();
    expect(start).not.toHaveBeenCalled();
    expect(root.dataset.themeReveal).toBeUndefined();
  });

  it('changes in place when the system switched (no control to grow from)', async () => {
    reducedMotion(false);
    const start = vi.spyOn(document, 'startViewTransition');
    const change = vi.fn();

    await revealTheme(change);

    expect(change).toHaveBeenCalledOnce();
    expect(start).not.toHaveBeenCalled();
  });
});
