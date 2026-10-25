import '../../layout.css';
import { page } from 'vitest/browser';
import { expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Panel from './fixture-panel.svelte';
import Page from './+page.svelte';

// The page is the frame; the extension's own panel is tested where the extension lives.
it('is the Conexões page around whatever panel the extension brings', async () => {
  await page.viewport(1280, 900);
  render(Page, { data: { Panel, label: 'Painel de teste' } as never });

  await expect.element(page.getByRole('heading', { level: 1, name: 'Conexões' })).toBeVisible();
  await expect.element(page.getByRole('region', { name: 'Painel de teste' })).toBeVisible();
});
