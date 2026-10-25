<script lang="ts" module>
  import { getContext, setContext } from 'svelte';

  /** `half`: label and value share the row; `label`: a narrow label column, the value takes the rest. */
  export type DetailLayout = 'half' | 'label';

  const key = Symbol('detail-list');
  export const detailLayout = (): DetailLayout => getContext<DetailLayout>(key) ?? 'half';
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';

  // A list of labelled facts (a user's data, a report's context), one `DetailRow` each, divided by
  // lines. Pages set the margin and any outer border through `class`.
  let {
    layout = 'half',
    class: className = '',
    children,
  }: { layout?: DetailLayout; class?: string; children: Snippet } = $props();

  // svelte-ignore state_referenced_locally
  setContext(key, layout);
</script>

<dl class="divide-y divide-surface-200-800 {className}">
  {@render children()}
</dl>
