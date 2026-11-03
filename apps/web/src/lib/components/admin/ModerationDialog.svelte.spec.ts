import '../../../routes/layout.css';
import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ModerationDialogHarness from './ModerationDialogHarness.svelte';

const { success } = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock('#lib/toaster.js', () => ({ toast: { success } }));

// The server's answer is not what this checks: the form says it worked as soon as it is sent.
vi.mock('#lib/forms/action-form.svelte.js', () => ({
  actionForm: (options: { initial: Record<string, string>; onSuccess: () => void }) => ({
    values: options.initial,
    errors: {},
    pending: false,
    delayed: false,
    timeout: false,
    reset: () => {},
    change: () => {},
    submit: (event: SubmitEvent) => {
      event.preventDefault();
      options.onSuccess();
    },
  }),
}));

describe('admin ModerationDialog', () => {
  it('closes and toasts its message when the row it was opened for is cleared', async () => {
    const errors: unknown[] = [];
    const onError = (event: ErrorEvent) => errors.push(event.error);
    window.addEventListener('error', onError);
    render(ModerationDialogHarness);

    await page.getByRole('button', { name: 'Abrir' }).click();
    await page.getByRole('button', { name: 'Rejeitar' }).click();

    await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
    expect(success).toHaveBeenCalledExactlyOnceWith('Lugar rejeitado.');
    expect(errors).toEqual([]);
    window.removeEventListener('error', onError);
  });
});
