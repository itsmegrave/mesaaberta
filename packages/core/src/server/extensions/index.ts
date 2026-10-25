import type { Handler } from '../events/types';
import { isFlagName } from '../flags/registry';
import type { Extension } from './contract';
import { extensions as installed } from './installed';

export type * from './contract';

/** The installed extensions. Tests pass their own list to the functions that take one. */
export const extensions: readonly Extension[] = installed;

/** The extension with this id, or undefined (a path nobody installed answers 404). */
export function extensionById(
  id: string,
  list: readonly Extension[] = extensions,
): Extension | undefined {
  return list.find((extension) => extension.id === id);
}

/** The event handlers the extensions register beside their connectors'. */
export function extensionHandlers(list: readonly Extension[] = extensions): readonly Handler[] {
  return list.flatMap((extension) => extension.handlers ?? []);
}

/**
 * The flags the extensions declare, with their defaults. A name the app already uses is refused,
 * so an extension cannot change what a public flag means.
 */
export function extensionFlagDefaults(
  list: readonly Extension[] = extensions,
): Readonly<Record<string, boolean>> {
  const defaults: Record<string, boolean> = {};
  for (const extension of list) {
    for (const [name, value] of Object.entries(extension.flags ?? {})) {
      if (isFlagName(name) || Object.hasOwn(defaults, name))
        throw new Error(`Extension flag "${name}" is already taken`);
      defaults[name] = value;
    }
  }
  return defaults;
}

/** The extensions that show widgets, in install order (the first one's widgets win a page). */
export function widgetExtensions(
  list: readonly Extension[] = extensions,
): readonly (Extension & { widgets: NonNullable<Extension['widgets']> })[] {
  return list.filter(
    (extension): extension is Extension & { widgets: NonNullable<Extension['widgets']> } =>
      !!extension.widgets,
  );
}
