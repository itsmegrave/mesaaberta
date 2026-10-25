import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MODE_COLOURS, resolveMode } from './theme';

describe('resolveMode', () => {
  it.each([
    ['light', true, 'light'],
    ['light', false, 'light'],
    ['dark', true, 'dark'],
    ['dark', false, 'dark'],
  ] as const)('a chosen %s wins over the system (dark: %s)', (choice, prefersDark, mode) => {
    expect(resolveMode(choice, prefersDark)).toBe(mode);
  });

  it('follows the system when nothing was chosen', () => {
    expect(resolveMode('system', true)).toBe('dark');
    expect(resolveMode('system', false)).toBe('light');
  });
});

describe('browser chrome colours', () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

  it('app.html and the web manifest use the colours of MODE_COLOURS', () => {
    const html = read('../../app.html');
    const manifest = JSON.parse(read('../../../static/site.webmanifest'));

    const metas = [
      ...html.matchAll(
        /<meta name="theme-color" content="(#[0-9a-f]{6})" media="\(prefers-color-scheme: (\w+)\)"/g,
      ),
    ];
    expect(Object.fromEntries(metas.map(([, colour, scheme]) => [scheme, colour]))).toEqual(
      MODE_COLOURS,
    );
    expect(html).toContain(
      `var colours = { light: '${MODE_COLOURS.light}', dark: '${MODE_COLOURS.dark}' }`,
    );
    expect(manifest.theme_color).toBe(MODE_COLOURS.light);
    expect(manifest.background_color).toBe(MODE_COLOURS.light);
  });
});
