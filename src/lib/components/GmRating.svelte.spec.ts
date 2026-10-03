import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import GmRating from './GmRating.svelte';

describe('GmRating.svelte', () => {
  it('shows the score and how many ratings stand behind it', async () => {
    render(GmRating, { rating: { score: 4.66, count: 12, isNew: false } });

    await expect.element(page.getByText('4,7 · 12 avaliações')).toBeVisible();
  });

  it('says "Novo mestre" and no score for a GM nobody has rated', async () => {
    render(GmRating, { rating: { score: null, count: 0, isNew: true } });

    await expect.element(page.getByText('Novo mestre')).toBeVisible();
  });

  it('keeps the count next to "Novo mestre" while there are too few ratings, never the score', async () => {
    render(GmRating, { rating: { score: 5, count: 2, isNew: true } });

    await expect.element(page.getByText('Novo mestre · 2 avaliações')).toBeVisible();
    await expect.element(page.getByText('5,0')).not.toBeInTheDocument();
  });
});
