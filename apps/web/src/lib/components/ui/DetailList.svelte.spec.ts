import '../../../routes/layout.css';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Harness from './DetailListHarness.svelte';

const box = (text: string) =>
  page.getByText(text, { exact: true }).element().getBoundingClientRect();

describe('DetailList', () => {
  beforeEach(async () => {
    await page.viewport(1024, 800);
  });

  it('pairs each label with its value as a description list', async () => {
    render(Harness);

    await expect.element(page.getByRole('term').first()).toHaveTextContent('Nome');
    await expect.element(page.getByRole('definition').first()).toHaveTextContent('Ana');
    // The row's classes go on the value.
    await expect.element(page.getByRole('definition').nth(1)).toHaveClass('font-mono');
  });

  // At 1024px wide the list is about as wide as the page.
  it('splits the row in halves by default', async () => {
    render(Harness);

    expect(box('Ana').left - box('Nome').left).toBeGreaterThan(400);
  });

  it('gives the value the width beside a narrow label in the label layout', async () => {
    render(Harness, { layout: 'label' });

    expect(box('Ana').left - box('Nome').left).toBeLessThan(200);
  });

  it('stacks the label over the value on a phone', async () => {
    await page.viewport(390, 800);
    render(Harness, { layout: 'label' });

    expect(box('Ana').top).toBeGreaterThan(box('Nome').top);
  });
});
