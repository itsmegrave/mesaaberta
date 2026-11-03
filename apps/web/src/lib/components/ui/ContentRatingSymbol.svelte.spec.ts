import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ContentRatingSymbol from './ContentRatingSymbol.svelte';

describe('ContentRatingSymbol', () => {
  it.each([
    ['L', 'Classificação indicativa: Livre'],
    ['6', 'Classificação indicativa: Não recomendado para menores de 6 anos'],
    ['14', 'Classificação indicativa: Não recomendado para menores de 14 anos'],
    ['18', 'Classificação indicativa: Não recomendado para menores de 18 anos'],
  ])('names %s in ClassInd words', async (rating, name) => {
    render(ContentRatingSymbol, { rating });

    await expect.element(page.getByRole('img', { name })).toBeVisible();
  });

  it('draws the official colour inside the white border, at the size asked', async () => {
    render(ContentRatingSymbol, { rating: '16', size: 70 });

    const svg = page.getByRole('img').element() as SVGSVGElement;
    expect(svg.getAttribute('width')).toBe('70');
    const [border, square] = svg.querySelectorAll('rect');
    // The colours themselves are layout.css tokens (`--color-classind-*`), not loaded here.
    expect(border!.getAttribute('class')).toContain('fill-white');
    expect(square!.getAttribute('class')).toContain('fill-classind-16');
  });

  it.each([null, undefined, '', '21'])('draws nothing for %s', async (rating) => {
    const { container } = await render(ContentRatingSymbol, { rating });

    expect(container.querySelector('svg')).toBeNull();
  });
});
