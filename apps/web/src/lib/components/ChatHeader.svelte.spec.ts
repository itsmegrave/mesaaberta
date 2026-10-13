import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ChatHeader from './ChatHeader.svelte';

const direct = {
  kind: 'direct' as const,
  table: null,
  other: { username: 'bruno', avatarUrl: null },
  muted: false,
};
const trail = () => page.getByRole('navigation', { name: 'Trilha de navegação' });

describe('ChatHeader', () => {
  it('in the drawer, is the trail "Mensagens › name": the first crumb shows the list again', async () => {
    const onback = vi.fn();
    render(ChatHeader, { conversation: direct, onback });

    await trail().getByRole('button', { name: 'Mensagens' }).click();

    expect(onback).toHaveBeenCalledOnce();
    await expect
      .element(trail().getByRole('link', { name: '@bruno' }))
      .toHaveAttribute('aria-current', 'page');
  });

  it('has no back arrow or "Voltar" button', async () => {
    render(ChatHeader, { conversation: direct, onback: () => {} });

    expect(page.getByRole('button', { name: /voltar/i }).elements()).toHaveLength(0);
    expect(page.getByRole('link', { name: /voltar/i }).elements()).toHaveLength(0);
  });

  it('on a page, is the shared trail from "Início" through "Mensagens"', async () => {
    render(ChatHeader, { conversation: direct });

    await expect
      .element(trail().getByRole('link', { name: 'Início' }))
      .toHaveAttribute('href', '/');
    await expect
      .element(trail().getByRole('link', { name: 'Mensagens' }))
      .toHaveAttribute('href', '/messages');
    await expect.element(trail().getByText('@bruno')).toHaveAttribute('aria-current', 'page');
  });

  it('names a table conversation after the table and links to it', async () => {
    render(ChatHeader, {
      conversation: {
        kind: 'table',
        table: { slug: 'a-torre', title: 'A Torre', imageUrl: null },
        other: null,
        muted: false,
      },
      onback: () => {},
    });

    await expect
      .element(trail().getByRole('link', { name: 'A Torre' }))
      .toHaveAttribute('href', '/tables/a-torre');
  });
});
