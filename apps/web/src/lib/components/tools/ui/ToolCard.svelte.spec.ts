import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ToolCard from './ToolCard.svelte';

const base = {
  name: 'Owlbear Rodeo',
  kind: 'vtt' as const,
  siteUrl: 'https://www.owlbear.rodeo',
  description: 'Mesa virtual leve no navegador.',
  logoUrl: '/tools/owlbear-rodeo.png',
  platformSlug: 'owlbear-rodeo',
  openTables: 12,
  pending: false,
};

describe('ToolCard', () => {
  it("opens the tool's site in a new tab, names it without www and says it leaves", async () => {
    render(ToolCard, { tool: base });

    const link = page.getByRole('link', { name: /owlbear\.rodeo/ });
    await expect.element(link).toHaveAttribute('href', 'https://www.owlbear.rodeo');
    await expect.element(link).toHaveAttribute('target', '_blank');
    await expect.element(link).toHaveAttribute('rel', 'noopener noreferrer');
    await expect.element(link).toHaveAccessibleName(/abre o site em nova aba/);
    await expect.element(page.getByText('Mesa virtual', { exact: true })).toBeVisible();
  });

  it('links a table platform to its open tables', async () => {
    render(ToolCard, { tool: base });

    await expect
      .element(page.getByRole('link', { name: '12 mesas abertas' }))
      .toHaveAttribute('href', '/tables?platform=owlbear-rodeo');
  });

  it('shows the initial without a logo, no tables link without any, and "Em análise" while it waits', async () => {
    render(ToolCard, {
      tool: { ...base, logoUrl: null, openTables: 0, pending: true, name: 'zoom' },
    });

    await expect.element(page.getByText('Z', { exact: true })).toBeInTheDocument();
    await expect.element(page.getByText('Em análise')).toBeVisible();
    await expect
      .element(page.getByRole('link', { name: /mesas? abertas?/ }))
      .not.toBeInTheDocument();
  });
});
