import { TOOL_KINDS, type ToolKind } from '@mesaaberta/core/tools/schema';
import { m } from '#lib/paraglide/messages.js';

/** A tool's kind on its card and in the admin list ("Mesa virtual"). */
export const toolKindLabels: Record<ToolKind, () => string> = {
  vtt: m.tool_kind_vtt,
  chat: m.tool_kind_chat,
  call: m.tool_kind_call,
  helper: m.tool_kind_helper,
};

/** The heading of a kind's section on the page ("Mesas virtuais"). */
export const toolGroupLabels: Record<ToolKind, () => string> = {
  vtt: m.tool_group_vtt,
  chat: m.tool_kind_chat,
  call: m.tool_kind_call,
  helper: m.tool_kind_helper,
};

/** The kinds as the form's choices, in the page's order. */
export const toolKindOptions = () =>
  TOOL_KINDS.map((value) => ({ value, label: toolKindLabels[value]() }));

/** The site's name without `https://` and `www.`, as the card shows it. */
export function toolHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
