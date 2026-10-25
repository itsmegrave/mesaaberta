import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import UploadDialog from './UploadDialog.svelte';
import { bannerSchema } from '#lib/profile/photo.js';

async function picture() {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 400;
  canvas.getContext('2d')!.fillRect(0, 0, 800, 400);
  const blob = await new Promise<Blob>((done) => canvas.toBlob((b) => done(b!), 'image/png'));
  return new File([blob], 'capa.png', { type: 'image/png' });
}

describe('UploadDialog', () => {
  it('lets go of the picked picture when "Cancelar" closes it', async () => {
    render(UploadDialog, {
      id: 'banner',
      name: 'banner',
      action: '?/banner',
      kind: 'cover',
      schema: bannerSchema,
      label: 'Alterar capa',
      title: 'Editar capa',
      icon: 'image',
      errors: {},
      fallbackError: () => 'Falhou',
    });
    const trigger = page.getByRole('button', { name: 'Alterar capa' });

    await trigger.click();
    await expect.element(page.getByText(/Recomendado: 1600 × 400 px/)).toBeInTheDocument();
    await page.elementLocator(document.getElementById('banner')!).upload(await picture());
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await trigger.click();

    await expect.element(page.getByText(/Arraste e solte/)).toBeInTheDocument();
    expect(page.getByRole('button', { name: 'Usar este recorte' }).elements()).toHaveLength(0);
  });
});
