import type { IconName } from '$lib/icons/names';

/** The icon that stands for how a table meets: a globe online, a round table in person. */
export const modalityIcon = (modality: 'online' | 'in_person'): IconName =>
  modality === 'in_person' ? 'game-icons:round-table' : 'globe';
