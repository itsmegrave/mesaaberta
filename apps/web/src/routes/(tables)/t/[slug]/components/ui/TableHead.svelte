<script lang="ts">
  // The head of a GM's table pages (Gerenciar and Editar): "Você mestra a mesa", the system and the
  // kind, then the table's title with its "3 dots" right after it.
  import KebabMenu, { type KebabItem } from '#lib/components/ui/KebabMenu.svelte';
  import Pill from '#lib/components/ui/Pill.svelte';
  import { m } from '#lib/paraglide/messages.js';

  let {
    title,
    detail,
    menu,
  }: {
    title: string;
    /** "Shadow of the Weird Wizard · Campanha". */
    detail: string;
    menu: KebabItem[];
  } = $props();
</script>

<p class="mt-6 flex flex-wrap items-center gap-3 lg:mt-8">
  <Pill tone="outline">{m.manage_you_are_gm()}</Pill>
  <span class="font-semibold text-muted">{detail}</span>
</p>
<div class="mt-3 flex items-center gap-4">
  <h1 class="min-w-0 text-3xl leading-none font-semibold tracking-tight text-balance md:text-5xl">
    {title}
  </h1>
  <KebabMenu name={title} items={menu} />
</div>
