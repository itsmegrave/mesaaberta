import { createRawSnippet } from 'svelte';
import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { z } from 'zod';
import PostButton from './PostButton.svelte';
import { postAction } from '#lib/forms/action.js';

vi.mock('#lib/forms/action.js', () => ({ postAction: vi.fn() }));
vi.mock('$app/forms', () => ({ applyAction: vi.fn(async () => {}) }));
vi.mock('$app/navigation', () => ({ refreshAll: vi.fn(async () => {}) }));
afterEach(() => vi.resetAllMocks());

const children = createRawSnippet(() => ({ render: () => '<span>Aprovar</span>' }));
const submit = () => page.getByRole('button', { name: 'Aprovar' });
const formOf = () => submit().element().closest('form')!;
const field = (name: string) => formOf().querySelector<HTMLInputElement>(`input[name=${name}]`);
const schema = z.object({ id: z.string().min(1), muted: z.boolean().optional() });
const base = { action: '?/approve', schema, errorMessage: () => 'Não deu.', children };

describe('PostButton', () => {
  it('is a plain POST with its fields hidden, so it works without JavaScript', async () => {
    render(PostButton, { ...base, fields: { id: 'a1', next: '' } });

    expect(formOf().method).toBe('post');
    expect(formOf().getAttribute('action')).toBe('?/approve');
    expect(field('id')?.value).toBe('a1');
    await expect.element(submit()).toHaveAttribute('type', 'submit');
  });

  it('posts no field that is empty or missing', async () => {
    render(PostButton, { ...base, fields: { id: 'a1', next: '', playerId: undefined } });

    expect(field('next')).toBeNull();
    expect(field('playerId')).toBeNull();
  });

  it('posts a field the caller changed, and hands the posted values to onSuccess', async () => {
    vi.mocked(postAction).mockResolvedValue({ type: 'success', status: 200, location: '' });
    const onSuccess = vi.fn();
    const { rerender } = await render(PostButton, {
      ...base,
      fields: { id: 'a1', muted: true },
      refresh: false,
      onSuccess,
    });

    await rerender({ fields: { id: 'a1', muted: false } });
    await expect.poll(() => field('muted')?.value).toBe('false');
    await submit().click();

    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalledWith({ id: 'a1', muted: false }));
    expect(vi.mocked(postAction).mock.calls[0][1].get('muted')).toBe('false');
  });

  it('sends once while pending', async () => {
    vi.mocked(postAction).mockImplementation(() => new Promise(() => {}));
    render(PostButton, { ...base, fields: { id: 'a1' } });

    await submit().click();
    await expect.element(submit()).toHaveAttribute('aria-busy', 'true');
    formOf().requestSubmit();

    expect(postAction).toHaveBeenCalledTimes(1);
  });

  it("shows the caller's words for a refusal, and nothing before it", async () => {
    vi.mocked(postAction).mockResolvedValue({
      type: 'failure',
      status: 400,
      location: '',
      data: { form: { valid: false, data: {}, errors: { id: ['gone'] } } },
    });
    render(PostButton, {
      ...base,
      fields: { id: 'a1' },
      error: (errors) => (errors.id?.[0] === 'gone' ? 'Já foi aprovada.' : undefined),
    });

    expect(page.getByRole('alert').elements()).toHaveLength(0);
    await submit().click();

    await expect.element(page.getByRole('alert')).toHaveTextContent('Já foi aprovada.');
  });

  it('checks the schema before posting', async () => {
    render(PostButton, {
      ...base,
      fields: { id: '' },
      error: (errors) => (errors.id ? 'Falta o id.' : undefined),
    });

    await submit().click();

    await expect.element(page.getByRole('alert')).toHaveTextContent('Falta o id.');
    expect(postAction).not.toHaveBeenCalled();
  });
});
