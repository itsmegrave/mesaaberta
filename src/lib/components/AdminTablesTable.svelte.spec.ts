import '../../routes/layout.css';
import { page } from 'vitest/browser';
import { afterEach, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Table from './AdminTablesTable.svelte';
import Toaster from './Toaster.svelte';
import { toast } from '$lib/toaster';
vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/admin/tables') } }));
vi.mock('$app/navigation', () => ({ goto: vi.fn(), invalidateAll: vi.fn(async () => {}) }));
vi.mock('$app/forms', () => ({
  deserialize: () => ({ type: 'failure', status: 502, data: { publishError: 'failed' } }),
  applyAction: vi.fn(),
}));
afterEach(() => {
  toast.clear();
  vi.unstubAllGlobals();
});
const data = {
  rows: [
    {
      id: '00000000-0000-4000-8000-000000000001',
      slug: 'rompe-cofres',
      title: 'Rompe-Cofres',
      system: 'Daggerheart',
      status: 'active',
      nextAt: new Date('2099-01-01'),
      timezone: 'UTC',
      instagramStatus: 'failed',
    },
  ],
  total: 1,
  page: 1,
  pageSize: 20,
  query: '',
  status: 'all',
};
it('keeps publishing in the row menu, shows pending feedback and reports failure as a toast', async () => {
  let finish!: (response: Response) => void;
  const request = vi.fn(() => new Promise<Response>((resolve) => (finish = resolve)));
  vi.stubGlobal('fetch', request);
  render(Toaster);
  render(Table, { data: data as never, instagramAvailable: true });
  await page.getByRole('button', { name: 'Ações da mesa: Rompe-Cofres' }).click();
  await page.getByRole('button', { name: 'Gerar e publicar no Instagram' }).click();
  await expect.element(page.getByRole('button', { name: 'Gerando e publicando…' })).toBeDisabled();
  expect(request).toHaveBeenCalledOnce();
  finish(new Response('{}'));
  await expect
    .element(
      page.getByText(
        'Não foi possível publicar a mesa. Confira a conexão e tente novamente mais tarde.',
      ),
    )
    .toBeVisible();
  await expect
    .element(page.getByRole('button', { name: 'Ações da mesa: Rompe-Cofres' }))
    .not.toHaveAttribute('aria-busy', 'true');
});
it('prevents publishing when Instagram is unavailable', async () => {
  render(Table, { data: data as never, instagramAvailable: false });
  await page.getByRole('button', { name: 'Ações da mesa: Rompe-Cofres' }).click();
  await expect
    .element(page.getByRole('button', { name: 'Gerar e publicar no Instagram' }))
    .toBeDisabled();
});
