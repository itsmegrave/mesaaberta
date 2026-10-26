import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ImageUpload from './ImageUpload.svelte';

async function picture() {
  const canvas = document.createElement('canvas');
  canvas.width = 500;
  canvas.height = 200;
  canvas.getContext('2d')!.fillRect(0, 0, 500, 200);
  const blob = await new Promise<Blob>((done) => canvas.toBlob((b) => done(b!), 'image/png'));
  return new File([blob], 'mesa.png', { type: 'image/png' });
}

const base = {
  id: 'picture',
  name: 'picture',
  label: 'Foto',
  hint: 'PNG, JPEG ou WebP',
  currentUrl: '/eu.png',
  onpick: () => {},
};

describe('ImageUpload.svelte', () => {
  it("keeps a table's image and offers to take it off with the form", async () => {
    render(ImageUpload, base);

    await expect.element(page.getByRole('button', { name: 'Remover imagem' })).toBeVisible();
    expect(document.querySelector('img')?.className).toContain('aspect-5/2');
  });

  it("leaves a person's photo to the page, and its removal to its own action", async () => {
    render(ImageUpload, {
      ...base,
      kind: 'avatar',
      dropText: 'Arraste uma imagem para cá. Você ajusta o corte.',
    });

    await page.getByRole('button', { name: 'Trocar imagem' }).click();
    await expect.element(page.getByText('Você ajusta o corte.', { exact: false })).toBeVisible();
    await expect.element(page.getByText(/Recomendado: 512 × 512 px/)).toBeVisible();
    expect(document.querySelector('img')).toBeNull();
    expect(page.getByRole('button', { name: 'Remover imagem' }).elements()).toHaveLength(0);
    expect(document.querySelector('input[name="removeImage"]')).toBeNull();
  });

  it('frames the picked picture in the modal and lets go of it when the modal closes', async () => {
    const picks: File[][] = [];
    render(ImageUpload, { ...base, currentUrl: null, onpick: (files) => picks.push(files) });

    await page.getByRole('button', { name: 'Escolher imagem' }).click();
    await expect.element(page.getByText(/Recomendado: 1200 × 480 px/)).toBeVisible();
    await page.elementLocator(document.getElementById('picture')!).upload(await picture());
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect
      .element(page.getByRole('button', { name: 'Usar este recorte' }))
      .not.toBeInTheDocument();
    expect(picks.at(-1) ?? []).toEqual([]);

    await page.getByRole('button', { name: 'Escolher imagem' }).click();
    await expect.element(page.getByText(/Arraste e solte/)).toBeVisible();
    await page.elementLocator(document.getElementById('picture')!).upload(await picture());
    await page.getByRole('button', { name: 'Usar este recorte' }).click();

    await expect.element(page.getByRole('button', { name: /^Tirar / })).toBeVisible();
    expect(picks.at(-1)).toHaveLength(1);
    expect(document.querySelector('img')?.getAttribute('src')).toMatch(/^blob:/);
  });
});
