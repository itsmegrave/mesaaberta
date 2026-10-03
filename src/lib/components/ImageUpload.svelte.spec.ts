import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ImageUpload from './ImageUpload.svelte';

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

    await expect.element(page.getByRole('button', { name: 'Trocar imagem' })).toBeVisible();
    await expect.element(page.getByText('Você ajusta o corte.', { exact: false })).toBeVisible();
    expect(document.querySelector('img')).toBeNull();
    expect(page.getByRole('button', { name: 'Remover imagem' }).elements()).toHaveLength(0);
    expect(document.querySelector('input[name="removeImage"]')).toBeNull();
  });
});
