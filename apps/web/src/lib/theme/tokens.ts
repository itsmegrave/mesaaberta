/**
 * The design system's tokens, named after what the app actually paints (Trello #269). Each entry
 * points at the CSS the screens use: a Skeleton/Cerberus variable, a `@utility` from layout.css, or
 * the Tailwind classes a component carries. `bun scripts/design-tokens.ts` resolves them into
 * `design/tokens.json`, the design system's format, and a spec fails when that file is stale.
 *
 * Change a value in the theme or layout.css, not here; change an entry here when a screen starts
 * painting a token from somewhere else.
 */

/** A colour: a CSS expression (`light-dark()` for a pair), or a layout.css `@utility` to read it from. */
export type ColorToken = {
  name: string;
  usage: string;
} & ({ css: string } | { utility: string });

/** A text style from the Tailwind classes that set it (size, leading, weight, tracking). */
export type TypeToken = { name: string; classes: string; usage: string; sample: string };

/** A length or shadow from one Tailwind class (`gap-3`, `w-96`, `rounded-lg`, `shadow-2xl`). */
export type ScaleToken = { name: string; className: string; usage: string };

export const colorTokens: ColorToken[] = [
  {
    name: 'bg',
    css: 'light-dark(var(--color-root-bg-light), var(--color-root-bg-dark))',
    usage: 'Page background (Cerberus surface-50 / surface-950).',
  },
  {
    name: 'ink',
    css: 'light-dark(var(--color-surface-950), var(--color-surface-50))',
    usage: 'Text and icons on `bg`, `surface`, `field` and `wash`.',
  },
  {
    name: 'ink-muted',
    utility: 'text-muted',
    usage: 'Secondary text, hints, meta lines and input borders on `bg` and `surface`.',
  },
  {
    name: 'primary',
    css: 'var(--color-primary-500)',
    usage:
      'Primary buttons, active tabs and nav items, selected day, chat launcher, focus ring. Not for text on `bg` (use `link`).',
  },
  {
    name: 'warning',
    utility: 'text-lamp',
    usage:
      '"Open or needs attention" only: seats left, open seats, pending requests, badges with counts.',
  },
  {
    name: 'surface',
    utility: 'bg-panel',
    usage: 'Cards, panels, menus, drawer, tab bar.',
  },
  {
    name: 'field',
    // Skeleton's `input` and `textarea` fill.
    css: 'light-dark(var(--color-surface-50), var(--color-surface-950))',
    usage: 'Inside inputs, selects and textareas.',
  },
  {
    name: 'on-primary',
    css: 'var(--color-primary-contrast-500)',
    usage:
      "Text and icons on a `primary` fill. Cerberus' own pair is 3.6:1, which is why layout.css makes it white.",
  },
  {
    name: 'on-warning',
    css: 'var(--color-warning-contrast-500)',
    usage: 'Text on a `warning` fill (count badges, `preset-filled-warning-500`).',
  },
  {
    name: 'danger',
    utility: 'text-error-alert',
    usage: 'Destructive actions and errors: text, error borders, "Suspenso".',
  },
  {
    name: 'danger-fill',
    css: 'var(--color-error-700)',
    usage:
      'Fill of destructive buttons and error counts (`preset-filled-error-700`), with white text.',
  },
  {
    name: 'line',
    // `border-surface-200-800`, the dividers and card borders on most screens.
    css: 'light-dark(var(--color-surface-200), var(--color-surface-800))',
    usage: 'Dividers and card borders (decorative, not control borders).',
  },
  {
    name: 'wash',
    utility: 'bg-surface-wash',
    usage: 'Hover, selected row, segmented-control track, dropzone background.',
  },
  {
    name: 'warning-wash',
    utility: 'bg-lamp-wash',
    usage: 'Background of attention banners and open-seat dots.',
  },
  {
    name: 'link',
    utility: 'text-link',
    usage: 'Text links on `bg` and `surface`: primary-600 in light, primary-300 in dark.',
  },
  {
    name: 'seat-1',
    css: 'var(--color-success-500)',
    usage: 'First taken seat; success dot (Ativo/Ativa); ok toast disc. Mark only, never text.',
  },
  { name: 'seat-2', css: 'var(--color-tertiary-400)', usage: 'Second taken seat. Mark only.' },
  { name: 'seat-3', css: 'var(--color-secondary-300)', usage: 'Third taken seat. Mark only.' },
];

export const typeGroups: { name: string; family: 'sans' | 'wordmark'; styles: TypeToken[] }[] = [
  {
    name: 'Display',
    family: 'sans',
    styles: [
      {
        name: 'display-hero',
        classes: 'text-7xl leading-none font-semibold tracking-tight',
        usage: 'Largest display size, 56px. Not used for page titles any more.',
        sample: 'Tem uma cadeira vazia na mesa.',
      },
      {
        name: 'display-page',
        classes: 'text-6xl leading-none font-semibold tracking-tight',
        usage: 'Landing hero on large screens (`lg:text-6xl`, 48px).',
        sample: 'Mesas abertas',
      },
      {
        name: 'heading-1',
        classes: 'text-5xl leading-none font-semibold tracking-tight',
        usage: 'Desktop page titles (h1, `md:text-5xl`, 40px).',
        sample: 'Minhas mesas',
      },
      {
        name: 'heading-2',
        classes: 'text-4xl leading-none font-semibold tracking-tight',
        usage: 'Phone hero (32px).',
        sample: 'Próximas mesas',
      },
      {
        name: 'heading-3',
        classes: 'text-3xl leading-tight font-semibold tracking-tight',
        usage: 'Phone page titles (h1, 28px).',
        sample: 'Avaliações como mestre',
      },
      {
        name: 'heading-4',
        classes: 'text-2xl font-semibold',
        usage:
          'Desktop section titles (`md:text-2xl`, 24px); drawer title. Phone section titles and card titles are `text-xl`.',
        sample: 'A Cripta do Rei Afogado',
      },
    ],
  },
  {
    name: 'Text',
    family: 'sans',
    styles: [
      {
        name: 'body-lg',
        classes: 'text-lg',
        usage: 'Ledes under page titles.',
        sample: 'Escolha uma mesa, veja quantas vagas restam e quando é a próxima sessão.',
      },
      {
        name: 'body',
        classes: 'text-base',
        usage: 'Body copy, inputs, buttons.',
        sample: 'Entre na hora ou peça a vaga, conforme a mesa.',
      },
      {
        name: 'label',
        classes: 'text-sm font-semibold',
        usage: 'Field labels, breadcrumbs, meta lines.',
        sample: 'Primeira sessão',
      },
      {
        name: 'caption',
        classes: 'text-xs font-semibold',
        usage: 'Badges, chips, nav labels.',
        sample: '3 vagas restantes',
      },
    ],
  },
  {
    name: 'Wordmark',
    family: 'wordmark',
    styles: [
      {
        name: 'wordmark',
        classes: 'text-lg font-semibold tracking-wide',
        usage: 'The "Mesa Aberta" wordmark next to the mark. Nowhere else.',
        sample: 'Mesa Aberta',
      },
    ],
  },
];

export const spacingTokens: ScaleToken[] = [
  { name: 'space-1', className: 'gap-1', usage: 'Icon-to-text in chips.' },
  { name: 'space-2', className: 'gap-2', usage: 'Gaps inside rows, between chips.' },
  { name: 'space-3', className: 'gap-3', usage: 'Gaps between buttons; card inner gaps.' },
  {
    name: 'space-4',
    className: 'p-4',
    usage: 'Phone page gutter; card padding on phones; field stacks.',
  },
  { name: 'space-5', className: 'p-5', usage: 'Card padding from `md` up.' },
  { name: 'space-6', className: 'gap-6', usage: 'Gap between page sections on phones; grid gaps.' },
  { name: 'space-8', className: 'gap-8', usage: 'Gap between page sections from `md` up.' },
  {
    name: 'space-12',
    className: 'gap-12',
    usage: 'Rarely: big landing gaps. Page sections are 32px apart from `md` up (`md:gap-8`).',
  },
  {
    name: 'touch-target',
    className: 'h-11',
    usage: 'Buttons and fields (44px); minimum for anything tappable on a phone.',
  },
];

export const radiusTokens: ScaleToken[] = [
  { name: 'radius-xs', className: 'rounded-xs', usage: 'Bubble tails, tiny marks.' },
  {
    name: 'radius-base',
    className: 'rounded-lg',
    usage: 'Fields, buttons, cards, menus, panels.',
  },
  {
    name: 'radius-full',
    className: 'rounded-full',
    usage: 'Pills, badges, segmented controls, avatars, seats, the chat launcher.',
  },
];

export const sizeTokens: ScaleToken[] = [
  { name: 'w-nav-rail', className: 'w-20', usage: 'Collapsed desktop nav column.' },
  { name: 'w-menu', className: 'w-66', usage: 'Kebab and account menus.' },
  {
    name: 'w-aside',
    className: 'w-96',
    usage: 'Sticky side panel on table/form pages; toasts; the messages drawer.',
  },
  { name: 'w-side', className: 'max-w-xl', usage: 'Form and profile column width.' },
  {
    name: 'focus-ring',
    className: 'outline-4',
    usage: 'Width of the keyboard focus outline: solid `primary`, 2px offset.',
  },
];

export const shadowTokens: ScaleToken[] = [
  {
    name: 'shadow-popover',
    className: 'shadow-2xl',
    usage: 'Menus, popovers, dialogs, toasts, the messages drawer.',
  },
  { name: 'shadow-launcher', className: 'shadow-lg', usage: 'Chat launcher only.' },
];
