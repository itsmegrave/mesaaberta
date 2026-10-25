<script lang="ts" generics="N extends string">
  // A person's or a partner's links: a row per link, each a network and an address, to add, remove
  // and (with `reorder`) move. The form gets them as the repeated `linkNetwork` and `linkUrl` fields,
  // in row order, so a native POST sends them as they are shown.
  import MAButton from '#lib/components/ui/MAButton.svelte';
  import SearchSelect from '#lib/components/ui/SearchSelect.svelte';
  import TextInput from '#lib/components/ui/TextInput.svelte';
  import FieldError from '#lib/components/ui/FieldError.svelte';
  import { LinkList } from '#lib/forms/link-list.svelte.js';

  let {
    networks = $bindable(),
    urls = $bindable(),
    items,
    max,
    idPrefix,
    legend,
    hint,
    empty,
    reorder = false,
    error,
    rowErrors,
    placeholder,
    inputmode = () => 'url',
    labels,
    inputClass,
    buttonClass,
  }: {
    networks: N[];
    urls: string[];
    /** The networks a row can pick. */
    items: { name: string; slug: N }[];
    max: number;
    /** Starts every id: `<prefix>-network-<row>`, `<prefix>-url-<row>`. */
    idPrefix: string;
    legend: string;
    /** Under the legend, read with the whole list. Its id is `<prefix>s-hint`. */
    hint?: string;
    /** Said when there is no row. */
    empty?: string;
    /** Up and down buttons on each row. */
    reorder?: boolean;
    /** A problem with the whole list (too many, the same link twice). */
    error?: string;
    /** What is wrong with row `index`'s address and network. */
    rowErrors: (index: number) => { url?: string; network?: string };
    placeholder: (network: N) => string;
    inputmode?: (network: N) => 'text' | 'url';
    labels: {
      network: (n: number) => string;
      url: (n: number, network: N) => string;
      remove: (n: number) => string;
      up?: (n: number) => string;
      down?: (n: number) => string;
      add: string;
      removed: () => string;
      moved?: (n: number, position: number) => string;
    };
    inputClass: string;
    buttonClass: string;
  } = $props();

  const hintId = $derived(`${idPrefix}s-hint`);
  const urlId = (id: number) => `${idPrefix}-url-${id}`;
  // svelte-ignore state_referenced_locally
  const list = new LinkList(
    {
      get networks() {
        return networks;
      },
      set networks(next) {
        networks = next as N[];
      },
      get urls() {
        return urls;
      },
      set urls(next) {
        urls = next;
      },
    },
    { max, network: 'instagram' as N, urlId, removed: labels.removed, moved: labels.moved },
  );
</script>

<fieldset class="grid gap-3" aria-describedby={hint ? hintId : undefined}>
  <legend class="font-semibold">{legend}</legend>
  {#if hint}<p id={hintId} class="text-sm">{hint}</p>{/if}

  <FieldError id="{idPrefix}s" class="" message={error} />

  {#if empty && list.ids.length === 0}
    <p class="text-sm">{empty}</p>
  {/if}

  <ul class="grid gap-4">
    {#each list.ids as id, index (id)}
      {@const problem = rowErrors(index)}
      <li class="grid gap-2 rounded-lg border border-surface-200-800 p-3">
        <div class="grid gap-2 sm:grid-cols-4">
          <SearchSelect
            id="{idPrefix}-network-{id}"
            name="linkNetwork"
            label={labels.network(index + 1)}
            labelClass="sr-only"
            class="grid"
            {items}
            value={[networks[index]]}
            placeholder={labels.network(index + 1)}
            invalid={!!problem.network}
            onchange={(picked) => (networks[index] = (picked[0] ?? 'instagram') as N)}
          />
          <TextInput
            id={urlId(id)}
            name="linkUrl"
            type="text"
            inputmode={inputmode(networks[index])}
            autocapitalize="none"
            spellcheck="false"
            placeholder={placeholder(networks[index])}
            aria-label={labels.url(index + 1, networks[index])}
            bind:value={urls[index]}
            class="{inputClass} sm:col-span-3"
            aria-invalid={problem.url ? 'true' : undefined}
            aria-describedby={problem.url ? `${urlId(id)}-error` : undefined}
          />
        </div>
        <FieldError id={urlId(id)} class="" message={problem.url ?? problem.network} />
        <div class={reorder ? 'flex flex-wrap gap-2' : undefined}>
          {#if reorder}
            <MAButton
              size="custom"
              class={buttonClass}
              disabled={index === 0}
              aria-label={labels.up?.(index + 1)}
              onclick={() => list.move(index, -1)}
            >
              <span aria-hidden="true">↑</span>
            </MAButton>
            <MAButton
              size="custom"
              class={buttonClass}
              disabled={index === list.ids.length - 1}
              aria-label={labels.down?.(index + 1)}
              onclick={() => list.move(index, 1)}
            >
              <span aria-hidden="true">↓</span>
            </MAButton>
          {/if}
          <MAButton
            size="custom"
            class={buttonClass}
            aria-label={labels.remove(index + 1)}
            onclick={() => list.remove(index)}
          >
            <span aria-hidden="true">×</span>
          </MAButton>
        </div>
      </li>
    {/each}
  </ul>

  <div>
    <MAButton
      size="custom"
      class={buttonClass}
      disabled={!list.canAdd}
      bind:element={list.addButton}
      onclick={() => list.add()}
    >
      {labels.add}
    </MAButton>
  </div>
  <p class="sr-only" role="status">{list.announcement}</p>
</fieldset>
