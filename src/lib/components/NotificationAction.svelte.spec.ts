import { createRawSnippet } from 'svelte';
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import NotificationAction from './NotificationAction.svelte';

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
    render(NotificationAction, { action: 'read', next: '/', buttonClass: 'btn h-11', children });

    await expect.element(submit()).toHaveAttribute('type', 'submit');
    await expect.element(submit()).toHaveClass('btn', 'h-11');
    await expect.element(submit()).not.toHaveAttribute('aria-busy');
  });
});
