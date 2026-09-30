/**
 * The Lucide icons the app draws, through Iconify. Add a name here, then run `pnpm icons` to copy
 * its drawing into `lucide.generated.ts`: only these are bundled, and nothing is fetched at run
 * time (the CSP allows no request to Iconify's API). Names: https://icon-sets.iconify.design/lucide/
 */
export const ICON_NAMES = [
  'calendar',
  'circle-x',
  'user-plus',
  'user-check',
  'user-x',
  'user-minus',
  'star',
  'tag',
  'shield',
  'megaphone',
  'wrench',
  'triangle-alert',
  'sparkles',
  'gift',
  'info',
  'chevron-down',
  'users',
  'dices',
  'flag',
  'refresh-cw',
  'arrow-right',
  'external-link',
  'search',
  'chevron-left',
  'chevron-right',
  'plus',
] as const;

export type IconName = (typeof ICON_NAMES)[number];
