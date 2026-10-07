import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { todayIn } from '$lib/crowdfunding/phase';
import CrowdfundingCard from './CrowdfundingCard.svelte';

/** A `YYYY-MM-DD` date `days` from today in São Paulo, so the card's situation does not age. */
const inDays = (days: number) => {
  const [year, month, day] = todayIn(new Date()).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
};

const base = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Tormenta Gamefound',
  owner: 'Jambô Editora',
  url: 'https://www.catarse.me/tormenta',
  platform: 'catarse' as const,
  startsOn: inDays(-5),
  endsOn: inDays(10),
  imageUrl: null,
  submitter: 'ana',
};

describe('CrowdfundingCard', () => {
  it("opens the campaign's own page on its site, in a new tab, and says so", async () => {
    render(CrowdfundingCard, { campaign: base });

    const link = page.getByRole('link', { name: /Tormenta Gamefound/ });
    await expect.element(link).toHaveAttribute('href', 'https://www.catarse.me/tormenta');
    await expect.element(link).toHaveAttribute('target', '_blank');
    await expect.element(link).toHaveAttribute('rel', 'noopener noreferrer');
    await expect.element(link).toHaveAccessibleName(/abre Catarse em nova aba/);
  });

  it('names the host of an unknown site for the screen reader', async () => {
    render(CrowdfundingCard, {
      campaign: { ...base, platform: 'other', url: 'https://www.exemplo.com.br/jogo' },
    });

    await expect
      .element(page.getByRole('link', { name: /Tormenta Gamefound/ }))
      .toHaveAccessibleName(/abre exemplo\.com\.br em nova aba/);
  });

  it('credits who is funding it and who added it, apart', async () => {
    render(CrowdfundingCard, { campaign: base });

    await expect.element(page.getByText('Quem está financiando: Jambô Editora')).toBeVisible();
    await expect.element(page.getByText('Enviado por @ana')).toBeVisible();
  });

  it('counts the days left, calmly', async () => {
    render(CrowdfundingCard, { campaign: base });

    await expect.element(page.getByText('Termina em 10 dias')).toBeVisible();
    expect(document.querySelector('[data-warn]')).toBeNull();
  });

  it('warns once the last days begin', async () => {
    render(CrowdfundingCard, { campaign: { ...base, endsOn: inDays(2) } });

    await expect.element(page.getByText('Últimos 2 dias')).toBeVisible();
    expect(document.querySelector('[data-warn]')).not.toBeNull();
  });

  it('says when an upcoming one opens', async () => {
    render(CrowdfundingCard, { campaign: { ...base, startsOn: inDays(4), endsOn: inDays(20) } });

    await expect.element(page.getByText('Começa em 4 dias')).toBeVisible();
  });

  it('has no "Denunciar" unless it is told the visitor may report', async () => {
    render(CrowdfundingCard, { campaign: base });

    await expect.element(page.getByRole('button', { name: /Denunciar/ })).not.toBeInTheDocument();
  });

  it('hands the campaign over when "Denunciar" is pressed', async () => {
    const onreport = vi.fn();
    render(CrowdfundingCard, { campaign: base, onreport });

    await page.getByRole('button', { name: 'Denunciar Tormenta Gamefound' }).click();

    expect(onreport).toHaveBeenCalledWith(expect.objectContaining({ id: base.id }));
  });

  it('shows the chest and the host when there is no picture', async () => {
    render(CrowdfundingCard, { campaign: base });

    await expect.element(page.getByText('catarse.me')).toBeVisible();
    expect(document.querySelector('img')).toBeNull();
  });

  it('shows the picture when there is one', async () => {
    render(CrowdfundingCard, { campaign: { ...base, imageUrl: 'https://img.example/capa.png' } });

    expect(document.querySelector('img')?.getAttribute('src')).toBe('https://img.example/capa.png');
  });
});
