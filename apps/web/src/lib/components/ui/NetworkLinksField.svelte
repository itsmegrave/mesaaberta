<script lang="ts" generics="N extends string">
  // A person's or a partner's links: a row per link, each a network and an address, to add, remove
  // and (with `reorder`) move. The form gets them as the repeated `linkNetwork` and `linkUrl` fields,
  // in row order, so a native POST sends them as they are shown.
  import MAButton from '#lib/components/ui/MAButton.svelte';
  import SearchSelect from '#lib/components/ui/SearchSelect.svelte';
  import TextInput from '#lib/components/ui/TextInput.svelte';
  import FieldError from '#lib/components/ui/FieldError.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
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

  // 44px icon buttons with no border, so a row reads as one line (DS LinksField).
  const iconButton =
    'btn size-11 shrink-0 rounded-lg p-0 hover:bg-surface-wash disabled:opacity-40';
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

  <!-- One line per link: the network, the address, then the move and remove icon buttons. On a
       phone the two fields stack and the buttons close the row. -->
  <ul class="grid gap-3">
    {#each list.ids as id, index (id)}
      {@const problem = rowErrors(index)}
      <li class="grid gap-1 border-b border-surface-200-800 pb-3 last:border-0 sm:border-0 sm:pb-0">
        <!-- On a phone the buttons share the network's line and the address takes the next one. -->
        <div class="flex flex-wrap items-center gap-2">
          <SearchSelect
            id="{idPrefix}-network-{id}"
            name="linkNetwork"
            label={labels.network(index + 1)}
            labelClass="sr-only"
            class="grid min-w-0 flex-1 sm:w-44 sm:flex-none"
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
            class="{inputClass} order-last w-full min-w-0 sm:order-none sm:w-auto sm:flex-1"
            aria-invalid={problem.url ? 'true' : undefined}
            aria-describedby={problem.url ? `${urlId(id)}-error` : undefined}
          />
          <div class="flex gap-1 sm:order-last">
            {#if reorder}
              <MAButton
                size="custom"
                class="{iconButton} text-muted"
                disabled={index === 0}
                aria-label={labels.up?.(index + 1)}
                onclick={() => list.move(index, -1)}
              >
                <Icon name="arrow-up" size={18} />
              </MAButton>
              <MAButton
                size="custom"
                class="{iconButton} text-muted"
                disabled={index === list.ids.length - 1}
                aria-label={labels.down?.(index + 1)}
                onclick={() => list.move(index, 1)}
              >
                <Icon name="arrow-down" size={18} />
              </MAButton>
            {/if}
            <MAButton
              size="custom"
              class="{iconButton} text-error-alert"
              aria-label={labels.remove(index + 1)}
              onclick={() => list.remove(index)}
            >
              <Icon name="trash" size={18} />
            </MAButton>
          </div>
        </div>
        <FieldError id={urlId(id)} class="" message={problem.url ?? problem.network} />
      </li>
    {/each}
  </ul>

  <div>
    <MAButton
      size="custom"
      class="{buttonClass} gap-2"
      disabled={!list.canAdd}
      bind:element={list.addButton}
      onclick={() => list.add()}
    >
      <Icon name="plus" size={18} />{labels.add}
    </MAButton>
  </div>
  <p class="sr-only" role="status">{list.announcement}</p>
</fieldset>
