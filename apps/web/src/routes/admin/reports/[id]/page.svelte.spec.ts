import '../../../layout.css';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

vi.mock('$app/forms', async (original) => ({
  ...(await original<typeof import('$app/forms')>()),
  applyAction: vi.fn(),
}));

const reporter = { id: '00000000-0000-4000-8000-000000000009', username: 'bia' };
const campaign = {
  id: '00000000-0000-4000-8000-000000000002',
  name: 'Ruínas de Aldor',
  owner: 'Editora Exemplo',
  url: 'https://www.catarse.me/ruinas',
  platform: 'catarse' as const,
  startsOn: '2026-10-01',
  endsOn: '2026-10-31',
  removedAt: null,
  submitter: null,
  importSource: 'catarse' as const,
};
const partner = {
  id: '00000000-0000-4000-8000-000000000003',
  name: 'Taverna Exemplo',
  siteUrl: 'https://taverna.example',
  links: [],
  backlinkUrl: null,
  approvedAt: new Date('2026-09-01T12:00:00Z'),
  removedAt: null,
  submitter: { id: '00000000-0000-4000-8000-000000000004', username: 'caio' },
  contactEmail: 'contato@taverna.example',
};
const show = (targetType: 'crowdfunding' | 'partner', over = {}) =>
  render(Page, {
    data: {
      report: {
        report: {
          id: '00000000-0000-4000-8000-000000000001',
          targetType,
          targetId: targetType === 'crowdfunding' ? campaign.id : partner.id,
          reason: 'broken_link',
          details: null,
          status: 'open',
          createdAt: new Date('2026-10-10T12:00:00Z'),
          resolvedAt: null,
          resolutionNote: null,
        },
        reporter,
        table: null,
        gm: null,
        player: null,
        crowdfunding: targetType === 'crowdfunding' ? campaign : null,
        partner: targetType === 'partner' ? partner : null,
        can: {
          review: true,
          close: true,
          closeTable: false,
          removeCrowdfunding: targetType === 'crowdfunding',
          removePartner: targetType === 'partner',
          ban: false,
        },
        ...over,
      },
      viewer: { timezone: 'America/Sao_Paulo' },
    } as never,
  });

describe('admin report page', () => {
  beforeEach(async () => {
    await page.viewport(1280, 900);
  });

  it("puts a campaign's platform and period in the context, next to who funds it", async () => {
    show('crowdfunding');

    const context = page.getByRole('region', { name: 'Contexto' });
    await expect.element(context.getByText('Plataforma')).toBeVisible();
    await expect.element(context.getByText('Catarse', { exact: true })).toBeVisible();
    await expect.element(context.getByText('Período')).toBeVisible();
    await expect.element(context.getByText('Quem está financiando')).toBeVisible();
  });

  it('credits an automatic import without inventing a member', async () => {
    show('crowdfunding');

    await expect.element(page.getByText('Importado automaticamente do Catarse')).toBeVisible();
    expect(document.body.textContent).not.toContain('@null');
  });

  it("writes to a partner's contact straight from the context", async () => {
    show('partner');

    await expect
      .element(page.getByRole('link', { name: 'contato@taverna.example' }))
      .toHaveAttribute('href', 'mailto:contato@taverna.example');
  });

  it('says, under the decision, that every button asks first and the reporter hears back', async () => {
    show('crowdfunding');

    const decision = page.getByRole('complementary', { name: 'Decisão' });
    await expect
      .element(
        decision.getByText(
          'Cada botão abre uma confirmação que explica o que acontece. Quem denunciou recebe um aviso quando a denúncia é encerrada, sem detalhes.',
        ),
      )
      .toBeVisible();
  });
});
