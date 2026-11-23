import type { WidgetPayload } from '@mesaaberta/core/server/extensions/contract';
import { readFromApi } from './api-read';

/** A widget as the api answers it, with the extension that drew it. */
export type ExtensionWidget = { ext: string; widget: WidgetPayload };

/**
 * The widgets the signed-in person may see on the page with this route id, read by the api (which
 * aims them: never at a suspended account or one still onboarding). `signedIn`: the first page
 * since signing in, where a popup that opens on sign-in shows.
 */
export async function widgetsFor(
  locals: App.Locals,
  actorId: string,
  routeId: string,
  { signedIn = false }: { signedIn?: boolean } = {},
) {
  const { widgets } = await readFromApi<{ widgets: ExtensionWidget[] }>(
    locals,
    actorId,
    `/v1/widgets?route=${encodeURIComponent(routeId)}${signedIn ? '&signedIn=1' : ''}`,
  );
  return widgets;
}
