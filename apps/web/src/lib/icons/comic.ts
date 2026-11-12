import type { IconName } from './names';

/**
 * Overdrive's sticker icons: a filled shape with an ink outline and a hard shadow, each one tilted its
 * own way. Drawn on a 24-unit grid (the canvas's "Ícones Overdrive" board). `<Icon>` draws one beside
 * the classic icon of the same name and the stylesheet shows the one the theme on <html> asks for, so
 * the right one is on screen from the first paint. Names left out keep the classic icon in Overdrive.
 */
export interface ComicIcon {
  /** The filled silhouette (its shadow is the same path, moved down and right). */
  shape: string;
  /** Ink lines drawn over the shape, unfilled. */
  detail: string;
  /** A theme fill utility for the shape. */
  fill: string;
  /** Degrees, so the stickers do not line up. */
  tilt: number;
}

const D20 = {
  shape: 'M12 1.5 L21.5 7 L21.5 17 L12 22.5 L2.5 17 L2.5 7 Z',
  detail: 'M12 6 L18 16 L6 16 Z M12 6 L12 1.5 M18 16 L21.5 17 M6 16 L2.5 17',
};

export const COMIC_ICONS: Partial<Record<IconName, ComicIcon>> = {
  'game-icons:tavern-sign': {
    shape: 'M3 8 L21 7 L20 19 L4 20 Z',
    detail: 'M2 3 L22 2.5 M7 3 L7 8 M17 2.8 L17 7.3 M8 12 L16 11.7 M8 15.5 L13.5 15.3',
    fill: 'fill-primary-500',
    tilt: -5,
  },
  'game-icons:dice-twenty-faces-twenty': { ...D20, fill: 'fill-warning-400', tilt: 8 },
  'game-icons:tabletop-players': {
    shape: 'M5 2 L17 2 L20 5 L20 22 L5 22 Z',
    detail: 'M8 8 L16 8 M8 12 L16 12 M8 16 L13 16 M17 2 L17 5 L20 5',
    fill: 'fill-tertiary-400',
    tilt: -4,
  },
  'game-icons:treasure-map': {
    shape:
      'M12 1 L14.5 7 L21 5 L17.5 10.5 L23 13 L17 15 L19 21.5 L13 18.5 L10 23 L8.5 17 L2 18.5 L6 13 L1 9.5 L7.5 8.5 L6.5 2.5 L11 6.5 Z',
    detail: 'M15 9 L13 13 L9 15 L11 11 Z',
    fill: 'fill-success-500',
    tilt: 10,
  },
  'game-icons:scroll-quill': {
    shape: 'M2 3 L22 4 L21 15 L12 15 L6 21 L7.5 15 L3 15 Z',
    detail: 'M7 8.5 L7 8.6 M12 8.5 L12 8.6 M17 8.5 L17 8.6',
    fill: 'fill-surface-50',
    tilt: -8,
  },
  bell: {
    shape: 'M6 16 L6 10.5 A6 6 0 0 1 18 10.5 L18 16 L20.5 18.5 L3.5 18.5 Z',
    detail: 'M10 21.5 L14 21.5 M1 7 L3 8.5 M23 7 L21 8.5',
    fill: 'fill-secondary-300',
    tilt: 12,
  },
  'arrow-left': {
    shape: 'M2 12 L11 3 L11 8 L22 8 L21 16 L11 16 L11 21 Z',
    detail: '',
    fill: 'fill-tertiary-400',
    tilt: -5,
  },
  calendar: {
    shape: 'M3 5 L21 4 L21 21 L3 21 Z',
    detail: 'M3 10 L21 10 M8 2 L8 7 M16 2 L16 7 M9 14 L11 16 L15 12.5',
    fill: 'fill-warning-400',
    tilt: -3,
  },
  'game-icons:position-marker': {
    shape: 'M12 23 L5 13 A8 8 0 1 1 19 13 Z',
    detail: 'M12 6.5 A3 3 0 1 0 12.01 6.5',
    fill: 'fill-secondary-300',
    tilt: 7,
  },
  star: {
    shape: 'M12 1 L15 8.5 L23 9 L17 14 L19 22 L12 17.5 L5 22 L7 14 L1 9 L9 8.5 Z',
    detail: '',
    fill: 'fill-warning-400',
    tilt: -10,
  },
  'game-icons:wooden-chair': {
    shape:
      'M6 2 L18 2 L18 12 L21 12 L21 15 L19 15 L19 23 L16 23 L16 15 L8 15 L8 23 L5 23 L5 15 L3 15 L3 12 L6 12 Z',
    detail: 'M9 6 L15 6 M9 9 L15 9',
    fill: 'fill-success-500',
    tilt: 4,
  },
  'game-icons:book-cover': {
    shape: 'M4 3 L18 2 L20 4 L20 22 L6 22 L4 20 Z',
    detail: 'M6 22 L6 4 L18 4 M9 8 L16 8 M9 11 L14 11',
    fill: 'fill-primary-500',
    tilt: 5,
  },
  'game-icons:pointy-hat': {
    shape: 'M12 1 L18 15 L22 17 L22 20 L2 20 L2 17 L6 15 Z',
    detail: 'M6.5 15 L17.5 15 M12 6 L12.5 7.5 L14 8 L12.5 8.5 L12 10 L11.5 8.5 L10 8 L11.5 7.5 Z',
    fill: 'fill-tertiary-400',
    tilt: -6,
  },
  'game-icons:open-treasure-chest': {
    shape: 'M2 11 L22 11 L21 22 L3 22 Z M3 10 L5 3 L19 3 L21 10 Z',
    detail: 'M2 15 L22 15 M10 13 L14 13 L14 17 L10 17 Z',
    fill: 'fill-secondary-300',
    tilt: 6,
  },
  'game-icons:toolbox': {
    shape: 'M2 8 L22 8 L22 21 L2 21 Z',
    detail: 'M8 8 L8 4 L16 4 L16 8 M2 13 L22 13 M10 12 L14 12 L14 15 L10 15 Z',
    fill: 'fill-success-500',
    tilt: -4,
  },
  'game-icons:card-play': {
    shape: 'M6 2 L19 3 L18 22 L5 21 Z',
    detail: 'M12 8 L14.5 12 L12 16 L9.5 12 Z',
    fill: 'fill-surface-50',
    tilt: 7,
  },
};
