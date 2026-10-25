import { createRawSnippet } from 'svelte';
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MediaCard from './MediaCard.svelte';

const media = createRawSnippet(() => ({ render: () => '<img alt="" src="data:," />' }));
const children = createRawSnippet(() => ({ render: () => '<h3>Loja</h3>' }));
const footer = createRawSnippet(() => ({ render: () => '<button type="button">Copiar</button>' }));

describe('MediaCard', () => {
  it('puts the pill over the media and the footer after the body', async () => {
    await render(MediaCard, { media, children, footer, pill: 'Em análise', pillTone: 'warning' });

    const pill = page.getByText('Em análise').element();
    expect(pill.parentElement?.querySelector('img')).not.toBeNull();
    expect(pill.classList.contains('preset-filled-warning-500')).toBe(true);
    const heading = page.getByRole('heading', { name: 'Loja' }).element();
    const button = page.getByRole('button', { name: 'Copiar' }).element();
    expect(heading.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('draws no pill without one', async () => {
    await render(MediaCard, { media, children, footer });
    expect(document.querySelector('.chip')).toBeNull();
  });

  it('lifts and rings only when the card is one link', async () => {
    await render(MediaCard, { media, children, footer, linked: true });
    const card = document.querySelector('article')!;
    expect(card.classList.contains('focus-within:ring-2')).toBe(true);
    expect(card.classList.contains('relative')).toBe(true);
  });
});
