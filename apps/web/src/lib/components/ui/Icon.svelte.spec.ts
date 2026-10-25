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
});
