import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { OUTPUT, render } from '../../../../../scripts/design-tokens';
import { designTokens, type CssSources } from './design-tokens';

const minimal = (layout = ''): CssSources => ({
  tailwindTheme: `@theme {
    --spacing: 0.25rem; --container-xl: 36rem; --radius-xs: 0.125rem; --radius-lg: 0.5rem;
    --text-xs: 0.75rem; --text-xs--line-height: calc(1 / 0.75);
    --text-sm: 0.875rem; --text-sm--line-height: calc(1.25 / 0.875);
    --text-base: 1rem; --text-base--line-height: calc(1.5 / 1);
    --text-lg: 1.125rem; --text-lg--line-height: calc(1.75 / 1.125);
    --text-2xl: 1.5rem; --text-2xl--line-height: calc(2 / 1.5);
    --text-3xl: 1.875rem; --text-3xl--line-height: calc(2.25 / 1.875);
    --text-4xl: 2.25rem; --text-4xl--line-height: calc(2.5 / 2.25);
    --text-5xl: 3rem; --text-5xl--line-height: 1;
    --text-6xl: 3.75rem; --text-6xl--line-height: 1;
    --text-7xl: 4.5rem; --text-7xl--line-height: 1;
    --font-weight-semibold: 600; --tracking-tight: -0.025em; --tracking-wide: 0.025em;
    --leading-tight: 1.25; --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
    --shadow-2xl: 0 25px 50px -12px rgb(0 0 0 / 0.25);
  }`,
  cerberus: `[data-theme='cerberus'] {
    --typo-base--font-family: system-ui;
    --color-surface-50: oklch(0.99 0 0); --color-surface-200: oklch(0.8 0 0);
    --color-surface-300: oklch(0.72 0 0); --color-surface-600: oklch(0.45 0 0);
    --color-surface-800: oklch(0.3 0 0); --color-surface-900: oklch(0.25 0 0);
    --color-surface-950: oklch(0.18 0 0);
    --color-root-bg-light: var(--color-surface-50); --color-root-bg-dark: var(--color-surface-950);
    --color-primary-400: oklch(0.63 0.19 255.71); --color-primary-500: oklch(0.57 0.21 258.29);
    --color-primary-600: oklch(0.52 0.19 258.15); --color-primary-contrast-500: oklch(0.2 0 0);
    --color-warning-contrast-500: oklch(0.52 0.13 51.44);
    --color-warning-400: oklch(0.85 0.12 75); --color-warning-500: oklch(0.82 0.14 72);
    --color-warning-950: oklch(0.52 0.13 51.44);
    --color-error-300: oklch(0.72 0.14 25); --color-error-800: oklch(0.51 0.19 28.72);
    --color-success-500: #56e3c2; --color-tertiary-400: #fc2a97; --color-secondary-300: #a06adb;
  }`,
  layout,
});

const LAYOUT = `
  @theme { --font-brand: 'Cinzel Variable', Georgia, serif; }
  [data-theme='cerberus'] { --color-primary-contrast-500: oklch(1 0 0); }
  @utility bg-panel { background-color: light-dark(var(--color-surface-50), var(--color-surface-900)); }
  @utility bg-surface-wash {
    background-color: light-dark(
      color-mix(in oklab, var(--color-surface-950) 7%, transparent),
      color-mix(in oklab, var(--color-surface-50) 8%, transparent)
    );
  }
  @utility text-error-alert { color: light-dark(var(--color-error-800), var(--color-error-300)); }
  @utility text-muted { color: light-dark(var(--color-surface-600), var(--color-surface-300)); }
  /* A comment { with braces } is skipped. */
  @utility text-lamp { color: light-dark(var(--color-warning-950), var(--color-warning-400)); }
  @utility bg-lamp-wash {
    background-color: light-dark(
      color-mix(in oklab, var(--color-warning-500) 24%, transparent),
      color-mix(in oklab, var(--color-warning-400) 14%, transparent)
    );
  }
  @utility text-link { color: light-dark(var(--color-primary-600), var(--color-primary-400)); }
`;

const colour = (name: string, layout = LAYOUT) =>
  designTokens(minimal(layout)).color.tokens.find((token) => token.name === name)?.value;

describe('designTokens', () => {
  it('turns Cerberus oklch into the hex the browser paints', () => {
    expect(colour('bg')).toEqual({ light: '#fcfcfc', dark: '#121212' });
    expect(colour('primary')).toBe('#0770ef');
  });

  it('reads a pair from a layout.css utility', () => {
    expect(colour('ink-muted')).toEqual({ light: '#555555', dark: '#a4a4a4' });
  });

  it('turns a mix with transparent into rgba', () => {
    expect(colour('wash')).toEqual({
      light: 'rgba(18,18,18,0.07)',
      dark: 'rgba(252,252,252,0.08)',
    });
  });

  it('lets layout.css override the theme, as the cascade does', () => {
    expect(colour('on-primary')).toBe('#ffffff');
  });

  it('resolves text styles and lengths from Tailwind classes', () => {
    const tokens = designTokens(minimal(LAYOUT));
    const hero = tokens.type.groups[0].styles.find((style) => style.name === 'display-hero');
    expect(hero).toMatchObject({
      fontSize: '72px',
      lineHeight: '72px',
      fontWeight: 600,
      letterSpacing: '-0.025em',
    });
    const body = tokens.type.groups[1].styles.find((style) => style.name === 'body');
    expect(body).toMatchObject({ fontSize: '16px', lineHeight: '24px', fontWeight: 400 });
    expect(tokens.size.tokens.find((token) => token.name === 'w-aside')?.value).toBe('384px');
    expect(tokens.size.tokens.find((token) => token.name === 'w-side')?.value).toBe('576px');
    expect(tokens.radius.tokens.find((token) => token.name === 'radius-full')?.value).toBe(
      '9999px',
    );
  });

  it('fails loudly when a utility the map names is gone', () => {
    expect(() => colour('ink-muted', LAYOUT.replace('text-muted', 'text-quiet'))).toThrow(
      'layout.css has no @utility text-muted',
    );
  });
});

describe('design/tokens.json', () => {
  it('is up to date: run `bun scripts/design-tokens.ts` after changing the theme or the map', () => {
    expect(readFileSync(OUTPUT, 'utf8')).toBe(render());
  });
});
