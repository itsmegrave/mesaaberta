import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import ImageUpload from './ImageUpload.svelte';

// The page that holds the crop step is rendered on the server, where the DOM classes Cropper.js
// needs do not exist. Importing the library at the top of the component broke every such page.
describe('the crop step on the server', () => {
  it('renders a page with an image field without loading Cropper.js', () => {
    const { body } = render(ImageUpload, {
      props: { id: 'image', name: 'image', label: 'Imagem', hint: 'PNG', onpick: () => {} },
    });

    expect(body).toContain('type="file"');
  });
});
