import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import OverdrivePedal from './OverdrivePedal.svelte';
import { initOverdrive, resetHintClaim } from '#lib/theme/overdrive.svelte.js';

const root = document.documentElement;
const fetchSpy = () =>
  vi.spyOn(window, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));

beforeEach(() => {
  localStorage.clear();
  root.dataset.theme = 'cerberus';
  resetHintClaim();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  root.dataset.theme = 'cerberus';
});

describe('OverdrivePedal', () => {
  it('shows nothing while use_overdrive_theme is off, and keeps a stored press for later', async () => {
    localStorage.setItem('theme-style', 'overdrive');
    initOverdrive(false);
    render(OverdrivePedal);
    await expect.element(page.getByRole('button', { name: 'Overdrive' })).not.toBeInTheDocument();
    expect(root.dataset.theme).toBe('cerberus');
    expect(localStorage.getItem('theme-style')).toBe('overdrive');
  });

  it('turns Overdrive on and off, remembers it and reports each change', async () => {
    const send = fetchSpy();
    initOverdrive(true);
    render(OverdrivePedal, { variant: 'menu' });
    const pedal = page.getByRole('button', { name: 'Overdrive' });
    await expect.element(pedal).toHaveAttribute('aria-pressed', 'false');

    await pedal.click();
    await expect.element(pedal).toHaveAttribute('aria-pressed', 'true');
    expect(root.dataset.theme).toBe('overdrive');
    expect(localStorage.getItem('theme-style')).toBe('overdrive');
    const body = JSON.parse(send.mock.lastCall![1]!.body as string);
    expect(body).toMatchObject({ kind: 'changed', theme: 'overdrive' });

    await pedal.click();
    await expect.element(pedal).toHaveAttribute('aria-pressed', 'false');
    expect(root.dataset.theme).toBe('cerberus');
    expect(localStorage.getItem('theme-style')).toBeNull();
  });

  it('comes back pressed on the next page', async () => {
    localStorage.setItem('theme-style', 'overdrive');
    initOverdrive(true);
    render(OverdrivePedal, { variant: 'rail' });
    await expect
      .element(page.getByRole('button', { name: 'Overdrive' }))
      .toHaveAttribute('aria-pressed', 'true');
    expect(root.dataset.theme).toBe('overdrive');
  });

  it('plays "Pise aqui!" once, then never again in this browser', async () => {
    vi.useFakeTimers();
    initOverdrive(true);
    render(OverdrivePedal, { variant: 'labelled' });
    await vi.advanceTimersByTimeAsync(2100);
    await expect.element(page.getByText('PISE AQUI!')).toBeInTheDocument();
    expect(localStorage.getItem('overdrive-hint-seen')).toBe('1');
    await vi.advanceTimersByTimeAsync(3300);
    await expect.element(page.getByText('PISE AQUI!')).not.toBeInTheDocument();

    resetHintClaim();
    render(OverdrivePedal, { variant: 'labelled' });
    await vi.advanceTimersByTimeAsync(2100);
    await expect.element(page.getByText('PISE AQUI!')).not.toBeInTheDocument();
  });
});
