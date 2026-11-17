import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import FileDrop from './FileDrop.svelte';
import FileDropHarness from './FileDropHarness.svelte';

async function picture() {
  const canvas = document.createElement('canvas');
  canvas.width = 40;
  canvas.height = 40;
  canvas.getContext('2d')!.fillRect(0, 0, 40, 40);
  const blob = await new Promise<Blob>((done) => canvas.toBlob((b) => done(b!), 'image/jpeg'));
  return new File([blob], 'post.jpg', { type: 'image/jpeg' });
}

const base = {
  id: 'media',
  name: 'media',
  label: 'Arquivo',
  formats: 'JPEG ou MP4 · até 20 MB',
  accept: 'image/jpeg,video/mp4',
};

describe('FileDrop.svelte', () => {
  it('offers a drop zone with the formats until a file is picked', async () => {
    render(FileDrop, base);

    await expect
      .element(page.getByText('Arraste o arquivo para cá ou clique para escolher'))
      .toBeVisible();
    await expect.element(page.getByText('JPEG ou MP4 · até 20 MB')).toBeVisible();
    const input = document.getElementById('media') as HTMLInputElement;
    expect(input.type).toBe('file');
    expect(input.name).toBe('media');
    expect(input.accept).toBe('image/jpeg,video/mp4');
  });

  it('shows the picked file with its preview, name and size, and takes it off', async () => {
    const picks: (File | undefined)[] = [];
    render(FileDrop, { ...base, onpick: (file) => picks.push(file) });

    await page.elementLocator(document.getElementById('media')!).upload(await picture());
    await expect.element(page.getByText('post.jpg')).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Trocar arquivo' })).toBeVisible();
    expect(document.querySelector('img')?.src).toMatch(/^blob:/);
    expect(picks.at(-1)?.name).toBe('post.jpg');
    expect((document.getElementById('media') as HTMLInputElement).files).toHaveLength(1);

    await page.getByRole('button', { name: 'Tirar post.jpg' }).click();
    await expect
      .element(page.getByText('Arraste o arquivo para cá ou clique para escolher'))
      .toBeVisible();
    expect(picks.at(-1)).toBeUndefined();
  });

  it('empties when its form is reset', async () => {
    render(FileDropHarness, base);

    await page.elementLocator(document.getElementById('media')!).upload(await picture());
    await expect.element(page.getByText('post.jpg')).toBeVisible();
    document.querySelector('form')!.reset();
    await expect.element(page.getByText('post.jpg')).not.toBeInTheDocument();
  });
});
