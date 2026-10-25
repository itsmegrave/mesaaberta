import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import BadgeMedal from './BadgeMedal.svelte';

const medal = () => document.querySelector('[data-badge-medal]');

describe('BadgeMedal', () => {
  it('draws the icon on an earned medal, hidden from screen readers', () => {
    render(BadgeMedal, { icon: 'game-icons:compass' });

    expect(medal()?.getAttribute('data-badge-medal')).toBe('earned');
    expect(medal()?.getAttribute('aria-hidden')).toBe('true');
    expect(medal()?.querySelector('[data-icon="game-icons:compass"]')).not.toBeNull();
  });

  it('draws the mark instead of the icon', () => {
    render(BadgeMedal, { icon: 'game-icons:podium', mark: '100!' });

    expect(medal()?.querySelector('text')?.textContent).toBe('100!');
    expect(medal()?.querySelector('[data-icon]')).toBeNull();
  });

  it('draws a locked medal with a dashed rim', () => {
    render(BadgeMedal, { icon: 'game-icons:compass', locked: true });

    expect(medal()?.getAttribute('data-badge-medal')).toBe('locked');
    expect(medal()?.querySelector('[stroke-dasharray]')).not.toBeNull();
  });
});
