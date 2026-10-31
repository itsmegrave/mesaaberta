import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Icon from './Icon.svelte';

const use = (container: HTMLElement) => container.querySelector('use')!.getAttribute('href')!;

describe('Icon', () => {
  it('draws the named icon from the sprite, at the size asked, hidden from screen readers', async () => {
    const { container } = await render(Icon, { name: 'wrench', size: 18, class: 'text-muted' });
    const svg = container.querySelector('svg')!;

    expect(svg.getAttribute('width')).toBe('18');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('class')).toContain('text-muted');
    expect(svg.getAttribute('data-icon')).toBe('wrench');
    expect(use(container)).toMatch(/sprite\.generated.*\.svg#wrench$/);
  });

  it('names a collection icon without its colon', async () => {
    const { container } = await render(Icon, { name: 'game-icons:meeple' });
    expect(use(container)).toMatch(/#game-icons--meeple$/);
  });

  it('uses the still tadpole spinner for reduced motion', async () => {
    const moving = await render(Icon, { name: 'svg-spinners:tadpole' });
    const still = await render(Icon, { name: 'svg-spinners:tadpole', motion: false });

    expect(use(moving.container)).toMatch(/#svg-spinners--tadpole$/);
    expect(use(still.container)).toMatch(/#svg-spinners--tadpole--still$/);
    expect(still.container.querySelector('svg')?.getAttribute('data-icon')).toBe(
      'svg-spinners:tadpole',
    );
  });

  it('only names icons the sprite has, and the still spinner has no animation', async () => {
    const sprite = await (
      await fetch(use((await render(Icon, { name: 'clock' })).container))
    ).text();
    const doc = new DOMParser().parseFromString(sprite, 'image/svg+xml');

    for (const id of ['clock', 'game-icons--meeple', 'svg-spinners--tadpole--still']) {
      expect(doc.getElementById(id)?.tagName).toBe('symbol');
    }
    expect(
      doc.getElementById('svg-spinners--tadpole--still')!.querySelector('animateTransform'),
    ).toBeNull();
    expect(
      doc.getElementById('svg-spinners--tadpole')!.querySelector('animateTransform'),
    ).not.toBeNull();
  });
});
