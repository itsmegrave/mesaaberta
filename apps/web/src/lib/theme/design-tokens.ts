import {
  colorTokens,
  radiusTokens,
  shadowTokens,
  sizeTokens,
  spacingTokens,
  typeGroups,
  type ScaleToken,
} from './tokens';

/**
 * Builds the design system's `tokens.json` from the CSS the app ships (Trello #269): the Cerberus
 * theme, Tailwind's theme and layout.css. Pure, so the script writes it and a spec checks the
 * committed copy against it. Colours come out as hex, or `rgba()` for the translucent ones (the
 * format has no `color-mix()`); lengths in px.
 */

export type CssSources = { cerberus: string; tailwindTheme: string; layout: string };
type Vars = Map<string, string>;

const ROOT_FONT_PX = 16;

/** Every `--name: value;` declaration, later sources winning, as the cascade does here. */
const declarations = (...sheets: string[]): Vars => {
  const vars: Vars = new Map();
  for (const sheet of sheets) {
    const css = sheet.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const [, name, value] of css.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+);/g))
      vars.set(name, value.replace(/\s+/g, ' ').trim());
  }
  return vars;
};

/** layout.css `@utility name { property: value }` → the value of its one colour property. */
const utilities = (css: string) => {
  const found = new Map<string, string>();
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const [, name, body] of clean.matchAll(/@utility\s+([\w-]+)\s*\{([^{}]*)\}/g)) {
    const color =
      /(?:^|;)\s*(?:color|background-color|border-color|fill|stroke)\s*:\s*([^;]+);/.exec(body);
    if (color) found.set(name, color[1].replace(/\s+/g, ' ').trim());
  }
  return found;
};

/** Splits a comma list at its top level: `a(b, c), d` → [`a(b, c)`, `d`]. */
const topLevel = (list: string) => {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < list.length; i++) {
    if (list[i] === '(') depth++;
    else if (list[i] === ')') depth--;
    else if (list[i] === ',' && depth === 0) {
      parts.push(list.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(list.slice(start).trim());
  return parts;
};

/** The arguments of a function call that is the whole expression, or null. */
const call = (name: string, expression: string) => {
  const trimmed = expression.trim();
  return trimmed.startsWith(`${name}(`) && trimmed.endsWith(')')
    ? topLevel(trimmed.slice(name.length + 1, -1))
    : null;
};

/** Replaces `var(--x)` with its value, all the way down. */
const resolveVars = (expression: string, vars: Vars, depth = 0): string => {
  if (depth > 20) throw new Error(`variable loop in ${expression}`);
  const next = expression.replace(/var\((--[\w-]+)\)/g, (_, name: string) => {
    const value = vars.get(name);
    if (value === undefined) throw new Error(`${name} is not defined`);
    return value;
  });
  return next === expression ? next : resolveVars(next, vars, depth + 1);
};

/** The light and dark halves of an expression; the same for both without `light-dark()`. */
const themes = (expression: string) => {
  const pair = call('light-dark', expression);
  return pair ? { light: pair[0], dark: pair[1] } : { light: expression, dark: expression };
};

type Rgb = [number, number, number];

const oklchToRgb = (l: number, c: number, h: number): Rgb => {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
  return linear.map((channel) => {
    const v = channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, v)) * 255);
  }) as Rgb;
};

const parseColor = (value: string): Rgb => {
  const hex = /^#([0-9a-f]{6})$/i.exec(value.trim());
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)) as Rgb;
  const oklch = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(value.trim());
  if (oklch) {
    const l = Number(oklch[1]) / (oklch[2] ? 100 : 1);
    return oklchToRgb(l, Number(oklch[3]), Number(oklch[4]));
  }
  throw new Error(`cannot read the colour ${value}`);
};

const toHex = ([r, g, b]: Rgb) =>
  `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;

/** One theme's half of a colour, as hex or `rgba()`. */
const paint = (expression: string): string => {
  const mix = call('color-mix', expression);
  if (mix) {
    // `color-mix(in oklab, <colour> N%, transparent)`: the colour at N% opacity.
    const [space, first, second] = mix;
    const share = /^(.*)\s+([\d.]+)%$/.exec(first);
    if (space !== 'in oklab' || second !== 'transparent' || !share)
      throw new Error(`cannot read ${expression}`);
    const [r, g, b] = parseColor(share[1]);
    return `rgba(${r},${g},${b},${Number(share[2]) / 100})`;
  }
  return toHex(parseColor(expression));
};

/** A length in px: `0.5rem`, `4px`, `calc(var(--spacing) * 24)` already resolved. */
const px = (value: string): string => {
  const product = /^calc\(\s*([\d.]+)rem\s*\*\s*([\d.]+)\s*\)$/.exec(value);
  if (product) return `${Number(product[1]) * Number(product[2]) * ROOT_FONT_PX}px`;
  const rem = /^([\d.]+)rem$/.exec(value);
  if (rem) return `${Number(rem[1]) * ROOT_FONT_PX}px`;
  if (/^[\d.]+px$/.test(value)) return value;
  throw new Error(`cannot read the length ${value}`);
};

/** `calc(2.25 / 1.875)` or `1` → a number. */
const ratio = (value: string) => {
  const division = /^calc\(\s*([\d.]+)\s*\/\s*([\d.]+)\s*\)$/.exec(value);
  return division ? Number(division[1]) / Number(division[2]) : Number(value);
};

/** The value of one Tailwind class from the scale tokens. */
const scaleValue = ({ className }: ScaleToken, vars: Vars): string => {
  const spacing = /^(?:gap|p|px|py|m|w|h|size)-(\d+(?:\.\d+)?)$/.exec(className);
  if (spacing) return px(resolveVars(`calc(var(--spacing) * ${spacing[1]})`, vars));
  const container = /^(?:w|max-w)-(xs|sm|md|lg|xl|\dxl)$/.exec(className);
  if (container) return px(resolveVars(`var(--container-${container[1]})`, vars));
  const outline = /^outline-(\d+)$/.exec(className);
  if (outline) return `${outline[1]}px`;
  if (className === 'rounded-full') return '9999px';
  const radius = /^rounded-([\w-]+)$/.exec(className);
  if (radius) return px(resolveVars(`var(--radius-${radius[1]})`, vars));
  const shadow = /^shadow-([\w-]+)$/.exec(className);
  if (shadow) return resolveVars(`var(--shadow-${shadow[1]})`, vars).replace(/\s+/g, ' ');
  throw new Error(`no rule for the class ${className}`);
};

/** Size, line height, weight and letter spacing from a text style's Tailwind classes. */
const textStyle = (classes: string, vars: Vars) => {
  let fontSize = '';
  let lineHeight: number | null = null;
  let fontWeight = 400;
  let letterSpacing: string | undefined;
  for (const name of classes.split(/\s+/)) {
    const size = /^text-(xs|sm|base|lg|xl|\dxl)$/.exec(name);
    const leading = /^leading-(\w+)$/.exec(name);
    const weight = /^font-(\w+)$/.exec(name);
    const tracking = /^tracking-(\w+)$/.exec(name);
    if (size) {
      fontSize = px(resolveVars(`var(--text-${size[1]})`, vars));
      lineHeight ??= ratio(resolveVars(`var(--text-${size[1]}--line-height)`, vars));
    } else if (leading) {
      lineHeight =
        leading[1] === 'none' ? 1 : ratio(resolveVars(`var(--leading-${leading[1]})`, vars));
    } else if (weight) {
      fontWeight = Number(resolveVars(`var(--font-weight-${weight[1]})`, vars));
    } else if (tracking) {
      letterSpacing = resolveVars(`var(--tracking-${tracking[1]})`, vars);
    } else throw new Error(`no rule for the class ${name}`);
  }
  if (!fontSize) throw new Error(`no text size in ${classes}`);
  const size = parseFloat(fontSize);
  return {
    fontSize,
    lineHeight: `${Math.round(size * (lineHeight ?? 1))}px`,
    fontWeight,
    ...(letterSpacing && { letterSpacing }),
  };
};

export type DesignTokens = ReturnType<typeof designTokens>;

/** The design system's `tokens.json`, built from the app's CSS. */
export const designTokens = (sources: CssSources, meta: Record<string, unknown> = {}) => {
  const vars = declarations(sources.tailwindTheme, sources.cerberus, sources.layout);
  const fromLayout = utilities(sources.layout);

  const colour = colorTokens.map((token) => {
    const expression =
      'utility' in token
        ? (fromLayout.get(token.utility) ??
          (() => {
            throw new Error(`layout.css has no @utility ${token.utility}`);
          })())
        : token.css;
    const { light, dark } = themes(resolveVars(expression, vars));
    const value = { light: paint(light), dark: paint(dark) };
    return {
      name: token.name,
      value: value.light === value.dark ? value.light : value,
      usage: token.usage,
    };
  });

  const scale = (tokens: ScaleToken[]) =>
    tokens.map((token) => ({
      name: token.name,
      value: scaleValue(token, vars),
      usage: `${token.usage} (\`${token.className}\`)`,
    }));

  return {
    name: 'Mesa Aberta',
    version: 1,
    meta: { source: 'github', ...meta },
    color: {
      themes: [
        { id: 'light', name: 'Claro' },
        { id: 'dark', name: 'Escuro' },
      ],
      tokens: colour,
    },
    type: {
      fonts: [],
      families: {
        sans: resolveVars('var(--typo-base--font-family)', vars),
        wordmark: resolveVars('var(--font-brand)', vars),
      },
      groups: typeGroups.map((group) => ({
        name: group.name,
        family: group.family,
        styles: group.styles.map((style) => ({
          name: style.name,
          ...textStyle(style.classes, vars),
          usage: `${style.usage} (\`${style.classes}\`)`,
          sample: style.sample,
        })),
      })),
    },
    spacing: { tokens: scale(spacingTokens) },
    radius: { tokens: scale(radiusTokens) },
    size: { tokens: scale(sizeTokens) },
    shadow: { tokens: scale(shadowTokens) },
  };
};
