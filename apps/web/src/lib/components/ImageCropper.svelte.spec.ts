import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import ImageCropper from './ImageCropper.svelte';

async function picture(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#c33';
  context.fillRect(0, 0, width, height);
  const blob = await new Promise<Blob>((done) => canvas.toBlob((b) => done(b!), 'image/png'));
  return new File([blob], 'retrato.png', { type: 'image/png' });
}

const size = (file: File) =>
  new Promise<{ width: number; height: number }>((done) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      done({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = url;
  });

describe('ImageCropper', () => {
  it('sends one square, reduced file, named after the original', async () => {
    const onconfirm = vi.fn();
    render(ImageCropper, {
      file: await picture(1600, 900),
      aspectRatio: 1,
      width: 512,
      round: true,
      onconfirm,
      oncancel: vi.fn(),
    });

    await expect.element(page.getByText('Enquadrar a imagem', { exact: true })).toBeInTheDocument();
    await expect.element(page.getByTestId('crop-preview')).toBeInTheDocument();
    await page.getByRole('button', { name: 'Aproximar' }).click();
    await page.getByRole('button', { name: 'Usar este recorte' }).click();

    await vi.waitFor(() => expect(onconfirm).toHaveBeenCalledOnce());
    const cropped: File = onconfirm.mock.calls[0][0];
    expect(cropped.name).toMatch(/^retrato\.(webp|png|jpg)$/);
    expect(cropped.size).toBeLessThanOrEqual(2 * 1024 * 1024);
    expect(await size(cropped)).toEqual({ width: 512, height: 512 });
  });

  it('cuts to the ratio it is given', async () => {
    const onconfirm = vi.fn();
    render(ImageCropper, {
      file: await picture(1000, 1000),
      aspectRatio: 5 / 2,
      width: 1000,
      onconfirm,
      oncancel: vi.fn(),
    });

    await page.getByRole('button', { name: 'Usar este recorte' }).click();

    await vi.waitFor(() => expect(onconfirm).toHaveBeenCalledOnce());
    expect(await size(onconfirm.mock.calls[0][0])).toEqual({ width: 1000, height: 400 });
  });

  it('gives the picture back untouched when cancelled', async () => {
    const oncancel = vi.fn();
    const onconfirm = vi.fn();
    render(ImageCropper, { file: await picture(400, 400), onconfirm, oncancel });

    await page.getByRole('button', { name: 'Cancelar' }).click();

    expect(oncancel).toHaveBeenCalled();
    expect(onconfirm).not.toHaveBeenCalled();
  });
});
