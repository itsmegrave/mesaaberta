<script lang="ts" module>
  import { getContext, setContext } from 'svelte';

  /** `always`: the sections collapse at every width; `phone`: only below `md`, open sections above. */
  export type AccordionCollapse = 'always' | 'phone';

  export type AccordionMode = {
    readonly collapse: AccordionCollapse;
    /** True on wide screens when the sections only collapse on phone: items render open, as plain sections. */
    readonly flat: boolean;
  };

  const key = Symbol('ma-accordion');
  export const accordionMode = (): AccordionMode => getContext<AccordionMode>(key);
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { MediaQuery } from 'svelte/reactivity';
  import { Accordion } from '@skeletonlabs/skeleton-svelte';

  // Collapsible sections that shorten a long page (design system: Accordion), one MAAccordionItem
  // each, divided by lines. Several can be open at once. `value` lists the open items: a page opens
  // the item that holds the thing to do now, and any item that holds an error. Never put a required
  // field without a value or the page's main action in an item that starts closed.
  let {
    value = $bindable([]),
    collapse = 'always',
    class: className = '',
    children,
  }: {
    value?: string[];
    collapse?: AccordionCollapse;
    class?: string;
    children: Snippet;
  } = $props();

  // 48rem is Tailwind's `md`. Before hydration the items render collapsible; their content carries
  // `md:block!` so a wide screen never sees a closed section.
  const wide = new MediaQuery('min-width: 48rem', false);

  setContext<AccordionMode>(key, {
    get collapse() {
      return collapse;
    },
    get flat() {
      return collapse === 'phone' && wide.current;
    },
  });
</script>

{#if collapse === 'phone' && wide.current}
  <div class="divide-y divide-surface-200-800 {className}">
    {@render children()}
  </div>
{:else}
  <Accordion
    multiple
    {value}
    onValueChange={(details) => (value = details.value)}
    class="divide-y divide-surface-200-800 {className}"
  >
    {@render children()}
  </Accordion>
{/if}
