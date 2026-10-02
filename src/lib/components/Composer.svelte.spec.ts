import { page, userEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { initialForm } from '$lib/forms/contract';
import Composer from './Composer.svelte';

// There is no SvelteKit app around a component test, so handing a result to the router has nothing
// to talk to (the failed request below has nowhere to go).
vi.mock('$app/forms', async (original) => ({
  ...(await original<typeof import('$app/forms')>()),
  applyAction: vi.fn(),
}));

const setup = async (tableId?: string) => {
  const onpending = vi.fn(() => 'pending-1');
  const form = initialForm({ body: '', tableId });
  render(Composer, { form, onpending, onsent: vi.fn(), onfailed: vi.fn() });
  return { onpending, box: page.getByRole('textbox', { name: 'Mensagem' }) };
};

describe('Composer.svelte', () => {
  it('sends on Enter', async () => {
    const { onpending, box } = await setup();
    await box.fill('Olá, mestre');
    await userEvent.keyboard('{Enter}');
    await vi.waitFor(() => expect(onpending).toHaveBeenCalledWith('Olá, mestre'));
  });

  it('breaks the line on Shift+Enter instead of sending', async () => {
    const { onpending, box } = await setup();
    await box.fill('primeira');
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}');
    await userEvent.keyboard('segunda');
    await expect.element(box).toHaveValue('primeira\nsegunda');
    expect(onpending).not.toHaveBeenCalled();
  });

  it('does not send an empty message', async () => {
    const { onpending, box } = await setup();
    await box.fill('   ');
    await userEvent.keyboard('{Enter}');
    expect(onpending).not.toHaveBeenCalled();
  });
  it('inserts an emoji at the cursor without replacing the draft or sending', async () => {
    const { onpending, box } = await setup();
    await box.fill('Olá mesa');
    await userEvent.keyboard('{Home}{ArrowRight}{ArrowRight}{ArrowRight}');
    await page.getByRole('button', { name: 'Escolher emoji' }).click();
    await page.getByRole('combobox', { name: 'Procurar' }).fill('dado');
    await page.getByRole('option', { name: /dado/ }).first().click();
    await expect.element(box).toHaveValue('Olá🎲 mesa');
    await expect.element(box).toHaveFocus();
    expect(onpending).not.toHaveBeenCalled();
  });
});
