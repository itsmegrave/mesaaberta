import type { Handler } from '../events/types';
import type { Extension } from './contract';
import { extensions as installed } from './installed';

export type { Extension } from './contract';

/** The installed extensions. Tests pass their own list to the functions that take one. */
export const extensions: readonly Extension[] = installed;

/** The event handlers the extensions register beside their connectors'. */
export function extensionHandlers(list: readonly Extension[] = extensions): readonly Handler[] {
  return list.flatMap((extension) => extension.handlers ?? []);
}
