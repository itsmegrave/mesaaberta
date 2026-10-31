import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Icon from './Icon.svelte';

describe('Icon', () => {
  it('draws the named icon inline, at the size asked, hidden from screen readers', async () => {
    const { container } = await render(Icon, { name: 'wrench', size: 18, class: 'text-muted' });
    const svg = container.querySelector('svg')!;

    expect(svg.getAttribute('width')).toBe('18');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('class')).toContain('text-muted');
    expect(svg.innerHTML).toContain('<path');
  });
  it('embeds the tadpole spinner geometry and can remove animation for reduced motion', async () => {
    const { container } = await render(Icon, { name: 'svg-spinners:tadpole', motion: false });
    const path = container.querySelector('path')!;
    expect(path.getAttribute('d')).toContain('M12,23');
    expect(container.querySelector('animateTransform')).toBeNull();
    expect(container.querySelector('svg')?.getAttribute('data-icon')).toBe('svg-spinners:tadpole');
  });
  it('draws without the Iconify CSS geometry, and gives each copy its own clip-path id', async () => {
    const { container } = await render(Icon, { name: 'clock' });
    const second = await render(Icon, { name: 'clock' });
    const ids = [container, second.container].map((c) => c.querySelector('clipPath')!.id);

    expect(container.querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(container.querySelector('path')!.getAttribute('d')).toBeTruthy();
    expect(ids[0]).not.toBe(ids[1]);
    expect(container.querySelector('[clip-path]')!.getAttribute('clip-path')).toBe(
      `url(#${ids[0]})`,
    );
  });
});
