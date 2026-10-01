import { createRawSnippet } from 'svelte';
import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import NotificationAction from './NotificationAction.svelte';
import { postAction } from '$lib/forms/action';
import { applyAction } from '$app/forms';

vi.mock('$lib/forms/action', () => ({ postAction: vi.fn() }));
vi.mock('$app/forms', () => ({ applyAction: vi.fn(async () => {}) }));
afterEach(() => vi.resetAllMocks());

const children = createRawSnippet(() => ({ render: () => '<span>Marcar como lida</span>' }));
const submit = () => page.getByRole('button', { name: 'Marcar como lida' });
const formOf = () => submit().element().closest('form')!;
const field = (name: string) => formOf().querySelector<HTMLInputElement>(`input[name=${name}]`);

describe('NotificationAction', () => {
  it('is a plain POST to the feed’s action, so the bell works without JavaScript', async () => {
    render(NotificationAction, { action: 'read', next: '/tables', children });

    expect(formOf().method).toBe('post');
    expect(formOf().getAttribute('action')).toBe('/notifications?/read');
  });

  it('carries the notification and where to come back to', async () => {
    const id = '0f8fad5b-d9cb-469f-a165-70867728950e';
    render(NotificationAction, { action: 'open', id, next: '/tables?page=2', children });

    expect(field('id')?.value).toBe(id);
    expect(field('next')?.value).toBe('/tables?page=2');
  });

  it('sends no id for read all', async () => {
    render(NotificationAction, { action: 'readAll', next: '/tables', children });

    expect(field('id')).toBeNull();
  });

  it('draws a submit button with the classes it is given, not busy until sent', async () => {
    render(NotificationAction, { action: 'read', next: '/', buttonClass: 'btn h-12', children });

    await expect.element(submit()).toHaveAttribute('type', 'submit');
    await expect.element(submit()).toHaveClass('btn', 'h-12');
    await expect.element(submit()).not.toHaveAttribute('aria-busy');
  });

  it('submits read all once while pending and delegates the redirect to the router', async () => {
    let finish!: (result: Awaited<ReturnType<typeof postAction>>) => void;
    vi.mocked(postAction).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(NotificationAction, { action: 'readAll', next: '/tables', children });
    await submit().click();
    await expect.element(submit()).toBeDisabled();
    formOf().requestSubmit();
    expect(postAction).toHaveBeenCalledTimes(1);
    const body = vi.mocked(postAction).mock.calls[0][1];
    expect(body.get('next')).toBe('/tables');
    expect(body.has('id')).toBe(false);
    finish({ type: 'redirect', status: 303, location: '/tables' });
    await vi.waitFor(() =>
      expect(applyAction).toHaveBeenCalledWith({
        type: 'redirect',
        status: 303,
        location: '/tables',
      }),
    );
  });

  it('shows a transport error without retrying and allows an explicit retry', async () => {
    vi.mocked(postAction).mockRejectedValueOnce(new TypeError('offline'));
    render(NotificationAction, { action: 'read', next: '/tables', children });
    await submit().click();
    await expect.element(page.getByRole('alert')).toBeVisible();
    await expect.element(submit()).not.toBeDisabled();
    expect(postAction).toHaveBeenCalledTimes(1);
    vi.mocked(postAction).mockResolvedValueOnce({
      type: 'redirect',
      status: 303,
      location: '/tables',
    });
    await submit().click();
    await vi.waitFor(() => expect(applyAction).toHaveBeenCalledTimes(1));
    expect(postAction).toHaveBeenCalledTimes(2);
  });
});
