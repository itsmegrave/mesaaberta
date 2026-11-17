import '../../../routes/layout.css';
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Harness from './MAAccordionHarness.svelte';

describe('MAAccordion', () => {
  it('names each section with a heading button that says whether it is open', async () => {
    await page.viewport(390, 844);
    render(Harness);

    const present = page.getByRole('button', { name: /Quem compareceu\?/ });
    const activity = page.getByRole('button', { name: /Atividade recente/ });
    await expect.element(present).toHaveAttribute('aria-expanded', 'true');
    await expect.element(activity).toHaveAttribute('aria-expanded', 'false');
    await expect
      .element(page.getByRole('heading', { name: /Atividade recente/ }))
      .toBeInTheDocument();
    await expect.element(page.getByText('Beatriz Nunes')).toBeVisible();
    await expect.element(page.getByText('Lucas Ferreira pediu a vaga')).not.toBeVisible();
  });

  it('shows what a closed section holds and its count', async () => {
    await page.viewport(390, 844);
    render(Harness);

    await expect.element(page.getByText('Última há 2 horas')).toBeVisible();
    await expect.element(page.getByText('2', { exact: true })).toBeVisible();
  });

  it('keeps several sections open at once', async () => {
    await page.viewport(390, 844);
    render(Harness);

    await page.getByRole('button', { name: /Atividade recente/ }).click();

    await expect.element(page.getByText('Lucas Ferreira pediu a vaga')).toBeVisible();
    await expect.element(page.getByText('Beatriz Nunes')).toBeVisible();
    await expect.element(page.getByTestId('open')).toHaveTextContent('present,activity');
  });

  it('renders open, plain sections on wide screens when it only collapses on phone', async () => {
    await page.viewport(1280, 800);
    render(Harness, { collapse: 'phone' });

    await expect.element(page.getByText('Lucas Ferreira pediu a vaga')).toBeVisible();
    await expect
      .element(page.getByRole('heading', { name: /Atividade recente/ }))
      .toBeInTheDocument();
    expect(page.getByRole('button', { name: /Atividade recente/ }).query()).toBeNull();
  });

  it('collapses on phone when it only collapses on phone', async () => {
    await page.viewport(390, 844);
    render(Harness, { collapse: 'phone' });

    await expect.element(page.getByText('Lucas Ferreira pediu a vaga')).not.toBeVisible();
    await page.getByRole('button', { name: /Atividade recente/ }).click();
    await expect.element(page.getByText('Lucas Ferreira pediu a vaga')).toBeVisible();
  });
});
