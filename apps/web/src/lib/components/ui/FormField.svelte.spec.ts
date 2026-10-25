import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import FormFieldHarness from './FormFieldHarness.svelte';

describe('FormField', () => {
  it('puts the label, then the hint, then the control, then the error', async () => {
    render(FormFieldHarness, { hint: 'Como aparece na lista.', error: 'Muito curto.' });

    const order = [
      document.querySelector('label'),
      document.getElementById('title-hint'),
      document.querySelector('input'),
      document.getElementById('title-error'),
    ];
    for (let index = 1; index < order.length; index++) {
      expect(
        order[index - 1]!.compareDocumentPosition(order[index]!) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it('marks an optional field "(opcional)" next to its label', async () => {
    render(FormFieldHarness, { optional: true });

    await expect.element(page.getByText('(opcional)')).toBeVisible();
    await expect.element(page.getByLabelText(/Título/)).toBeVisible();
  });

  it('shows no mark on a required field', async () => {
    render(FormFieldHarness);

    expect(page.getByText('(opcional)').elements()).toHaveLength(0);
  });

  it('shows what is typed against what is allowed, red past the limit', async () => {
    const screen = await render(FormFieldHarness, { counter: { count: 23, max: 80 } });
    await expect.element(page.getByText('23 / 80')).toBeVisible();
    expect(page.getByText('23 / 80').element().className).not.toContain('error');

    await screen.rerender({ counter: { count: 81, max: 80 } });
    expect(page.getByText('81 / 80').element().className).toContain('error');
  });

  it('describes the control with the hint and the error, and flags it invalid', async () => {
    render(FormFieldHarness, { hint: 'Dica', error: 'Erro' });

    const input = page.getByLabelText('Título');
    await expect.element(input).toHaveAttribute('aria-describedby', 'title-hint title-error');
    await expect.element(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('leaves the control alone when there is nothing to say', async () => {
    render(FormFieldHarness);

    const input = page.getByLabelText('Título');
    await expect.element(input).not.toHaveAttribute('aria-describedby');
    await expect.element(input).not.toHaveAttribute('aria-invalid');
  });
});
