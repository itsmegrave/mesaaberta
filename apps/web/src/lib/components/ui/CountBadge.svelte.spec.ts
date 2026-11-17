import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import CountBadge from './CountBadge.svelte';

const badge = () => document.querySelector('.badge');

describe('CountBadge', () => {
  it('shows nothing at zero', () => {
    render(CountBadge, { count: 0 });

    expect(badge()).toBeNull();
  });

  it('caps the number past max', () => {
    render(CountBadge, { count: 12 });

    expect(badge()?.textContent).toBe('9+');
  });

  it('caps at a larger max', () => {
    render(CountBadge, { count: 120, max: 99 });

    expect(badge()?.textContent).toBe('99+');
  });

  it('shows the whole number when it is not capped', () => {
    render(CountBadge, { count: 12, capped: false });

    expect(badge()?.textContent).toBe('12');
  });

  it('takes its colour from the tone', () => {
    render(CountBadge, { count: 3, tone: 'error' });

    expect(badge()?.getAttribute('class')).toContain('preset-filled-error-700');
  });
});
