import { parse, stringify } from 'devalue';
import { page, userEvent } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { applyAction } from '$app/forms';
import { invalidateAll } from '$app/navigation';
import Harness from './ActionFormHarness.svelte';
import { postAction } from './action';

vi.mock('$app/navigation', () => ({ invalidateAll: vi.fn(async () => {}) }));
vi.mock('$app/forms', async (original) => ({
  ...(await original<typeof import('$app/forms')>()),
  // Component tests have no initialized SvelteKit app/transport decoders.
  deserialize: (text: string) => {
    const result = JSON.parse(text);
    if (result.data) result.data = parse(result.data);
    return result;
  },
  applyAction: vi.fn(async () => {}),
}));

const response = (type: string, data: unknown = {}, status = 200) =>
  new Response(JSON.stringify({ type, status, data: stringify(data) }));
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('errors on blur', () => {
  it('shows nothing while someone is typing, and the error once they leave the field', async () => {
    render(Harness, { onSuccess: vi.fn() });
    const name = page.getByLabelText('name');

    await name.fill('a');
    expect(page.getByRole('alert').elements()).toHaveLength(0);
    await userEvent.tab();

    await expect.element(page.getByRole('alert')).toHaveTextContent('too_small');
  });

  it('clears the error as soon as the value is edited, and checks again on leaving', async () => {
    render(Harness, { onSuccess: vi.fn() });
    const name = page.getByLabelText('name');
    await name.fill('a');
    await userEvent.tab();
    await expect.element(page.getByRole('alert')).toBeVisible();

    await name.fill('valid name');
    expect(page.getByRole('alert').elements()).toHaveLength(0);
    await userEvent.tab();

    expect(page.getByRole('alert').elements()).toHaveLength(0);
  });
});

describe('action form submission', () => {
  it('rejects a cross-origin action before sending form data', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    await expect(postAction('https://other.example/action', new FormData())).rejects.toThrow(
      'same-origin',
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it('blocks invalid values before issuing a write', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    render(Harness, { onSuccess: vi.fn() });
    await page.getByRole('button', { name: 'Save' }).click();
    await expect.element(page.getByRole('alert')).toHaveTextContent('too_small');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('issues a single write while pending and preserves edited values after a business failure', async () => {
    let finish!: (response: Response) => void;
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const success = vi.fn();
    render(Harness, { onSuccess: success });
    const input = page.getByRole('textbox', { name: 'name' });
    await input.fill('Terror');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect.element(page.getByText('pending')).toBeVisible();
    await page.getByRole('button', { name: 'Save' }).click();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      credentials: 'same-origin',
      headers: { accept: 'application/json', 'x-sveltekit-action': 'true' },
    });
    expect((fetch.mock.calls[0][1]?.body as FormData).get('name')).toBe('Terror');
    await input.fill('Horror');
    finish(response('failure', { form: { errors: { name: ['taken'] } } }, 400));
    await expect.element(page.getByRole('alert')).toHaveTextContent('taken');
    await expect.element(input).toHaveValue('Horror');
    expect(success).not.toHaveBeenCalled();
    expect(invalidateAll).not.toHaveBeenCalled();
  });
  it('refreshes after confirmed success without resetting the draft', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response('success'));
    const success = vi.fn();
    render(Harness, { onSuccess: success });
    await page.getByRole('textbox').fill('Terror');
    await page.getByRole('button', { name: 'Save' }).click();
    await vi.waitFor(() => expect(success).toHaveBeenCalledTimes(1));
    expect(invalidateAll).toHaveBeenCalledTimes(1);
    await expect.element(page.getByRole('textbox')).toHaveValue('Terror');
  });
  it('does not retry a failed transport or discard typed text', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));
    render(Harness, { onSuccess: vi.fn() });
    await page.getByRole('textbox').fill('Terror');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect.element(page.getByRole('alert')).toHaveTextContent('transport failed');
    expect(fetch).toHaveBeenCalledTimes(1);
    await expect.element(page.getByRole('textbox')).toHaveValue('Terror');
  });
  it('hands redirects to the SvelteKit router', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ type: 'redirect', status: 303, location: '/login' })),
    );
    render(Harness, { onSuccess: vi.fn() });
    await page.getByRole('textbox').fill('Terror');
    await page.getByRole('button', { name: 'Save' }).click();
    await vi.waitFor(() =>
      expect(applyAction).toHaveBeenCalledWith({
        type: 'redirect',
        status: 303,
        location: '/login',
      }),
    );
  });
});
