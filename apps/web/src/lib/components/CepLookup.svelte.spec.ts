import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import Harness from '$lib/query/CepHarness.svelte';
import CepLookup from './CepLookup.svelte';
const found = (city: string) =>
  Response.json({ status: 'found', place: { neighbourhood: null, city, state: 'SP' } });
afterEach(() => vi.restoreAllMocks());
describe('CEP query', () => {
  it('does not call the endpoint for incomplete input', async () => {
    const request = vi.spyOn(window, 'fetch');
    await render(CepLookup, { value: '123' });
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(request).not.toHaveBeenCalled();
  });
  it('aborts an obsolete lookup and ignores its late result', async () => {
    let finish!: (response: Response) => void;
    const request = vi
      .spyOn(window, 'fetch')
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      )
      .mockResolvedValue(found('Campinas'));
    const view = await render(CepLookup, { value: '01001000' });
    await expect.poll(() => request.mock.calls.length).toBe(1);
    const signal = request.mock.calls[0][1]?.signal;
    await view.rerender({ value: '13010000' });
    await expect.element(page.getByRole('status')).toHaveTextContent('Campinas - SP');
    finish(found('São Paulo'));
    await expect.element(page.getByRole('status')).not.toHaveTextContent('São Paulo - SP');
    expect(signal?.aborted).toBe(true);
  });
  it('shows a manual fallback after an outage', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue(new Response('', { status: 503 }));
    await render(CepLookup, { value: '01001000', area: 'Manual area' });
    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent('Não foi possível consultar o CEP. Preencha a região para continuar.');
  });
  it('fills an empty region, clears an obsolete auto-fill and preserves manual edits', async () => {
    vi.spyOn(window, 'fetch').mockImplementation(async (path) =>
      found(String(path).includes('01001000') ? 'São Paulo' : 'Campinas'),
    );
    const view = await render(Harness, { value: '01001000' });
    await expect.element(page.getByLabelText('region')).toHaveValue('São Paulo - SP');
    await view.rerender({ value: '' });
    await expect.element(page.getByLabelText('region')).toHaveValue('');
    await view.rerender({ value: '13010000' });
    await expect.element(page.getByLabelText('region')).toHaveValue('Campinas - SP');
    await page.getByLabelText('region').fill('My venue');
    await view.rerender({ value: '01001000' });
    await expect.element(page.getByRole('status')).toHaveTextContent('São Paulo - SP');
    await expect.element(page.getByLabelText('region')).toHaveValue('My venue');
  });
});
