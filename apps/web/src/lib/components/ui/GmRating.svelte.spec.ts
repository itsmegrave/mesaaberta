import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import GmRating from './GmRating.svelte';

describe('GmRating.svelte', () => {
  it('shows the score and how many ratings stand behind it', async () => {
    render(GmRating, { rating: { score: 4.66, count: 12, isNew: false } });

    await expect.element(page.getByText('4,7', { exact: true })).toBeVisible();
    await expect.element(page.getByText('(12 avaliações)')).toBeVisible();
  });

  it('says "Estreia na mestragem" and no score for a GM nobody has rated', async () => {
    render(GmRating, { rating: { score: null, count: 0, isNew: true } });

    await expect.element(page.getByText('Estreia na mestragem')).toBeVisible();
    await expect.element(page.getByText(/avaliaç/)).not.toBeInTheDocument();
  });

  it('keeps the count next to the debut while there are too few ratings, never the score', async () => {
    render(GmRating, { rating: { score: 5, count: 2, isNew: true } });

    await expect.element(page.getByText('Estreia na mestragem')).toBeVisible();
    await expect.element(page.getByText('(2 avaliações)')).toBeVisible();
    await expect.element(page.getByText('5,0')).not.toBeInTheDocument();
  });

  it('is one labelled group as a pill, so the whole reading is announced once', async () => {
    render(GmRating, { rating: { score: 4.8, count: 12, isNew: false }, variant: 'pill' });

    await expect
      .element(page.getByRole('group', { name: 'Nota da mestragem: 4,8, em 12 avaliações' }))
      .toBeVisible();
  });

  it('is just the score or "Estreia" on cards, with the full reading for screen readers', async () => {
    render(GmRating, { rating: { score: null, count: 1, isNew: true }, variant: 'short' });

    await expect.element(page.getByText('Estreia', { exact: true })).toBeVisible();
    await expect
      .element(page.getByText('Nota da mestragem: estreia, 1 avaliação, ainda sem nota'))
      .toBeInTheDocument();
  });
});
