import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import CatalogDialog from './CatalogDialog.svelte';

describe('catalog dialogs on the server', () => {
  it('leaves native approval buttons accessible when the dialog is closed and scripts are disabled', () => {
    const { body } = render(CatalogDialog, {
      props: {
        mode: 'rename',
        kind: 'tag',
        entry: { id: '00000000-0000-4000-8000-000000000001', name: 'Terror' },
        label: 'Renomear',
      },
    });
    expect(body).toContain('Renomear');
    expect(body).not.toContain('data-part="positioner"');
    expect(body).not.toContain('data-part="backdrop"');
  });
});
