<script lang="ts">
  import MAAvatar from '#lib/components/ui/MAAvatar.svelte';
  import { m } from '#lib/paraglide/messages.js';

  /**
   * A few people as overlapping 24px avatars and "+N" for the rest, then what they are ("Quem
   * mestra"). The pictures are decorative; the label and the count say it in words.
   */
  let {
    people,
    total,
    label,
  }: {
    people: { username: string; avatarUrl: string | null }[];
    /** Everyone the stack stands for; more than shown adds "+N". */
    total: number;
    label: string;
  } = $props();

  const more = $derived(Math.max(0, total - people.length));
</script>

{#if people.length > 0}
  <div class="flex items-center gap-2">
    <span class="flex items-center" aria-hidden="true">
      {#each people as person, index (person.username)}
        <span class="flex rounded-full border-2 border-surface-50-950 {index > 0 ? '-ml-2' : ''}">
          <MAAvatar src={person.avatarUrl} name={person.username} size={24} />
        </span>
      {/each}
      {#if more > 0}
        <span class="ml-2 text-xs font-semibold text-muted"
          >{m.directory_people_more({ count: more })}</span
        >
      {/if}
    </span>
    <span class="text-xs font-semibold text-muted">{label}</span>
  </div>
{/if}
