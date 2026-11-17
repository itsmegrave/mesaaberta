import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import ScoreLine from './ScoreLine.svelte';

const props = { label: 'Nota como participante', debut: 'Estreia como participante' };

describe('ScoreLine.svelte', () => {
  it('shows the score, the words after it and the count', async () => {
    render(ScoreLine, {
      ...props,
      rating: { score: 4.62, count: 8, isNew: false },
      suffix: 'como participante',
    });

    await expect.element(page.getByText('4,6')).toBeVisible();
    await expect.element(page.getByText('como participante')).toBeVisible();
    await expect.element(page.getByText('(8)')).toBeVisible();
    await expect.element(page.getByText(', 8 avaliações')).toBeInTheDocument();
  });

  it('shows the debut and no number below the minimum', async () => {
    render(ScoreLine, { ...props, rating: { score: 5, count: 2, isNew: true } });

    await expect.element(page.getByText('Estreia como participante')).toBeVisible();
    await expect.element(page.getByText('5,0')).not.toBeInTheDocument();
  });
});
