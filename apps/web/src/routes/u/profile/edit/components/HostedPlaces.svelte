<script lang="ts">
  // "Mestra na casa" in Editar perfil: the places where this person accepted to be a house GM, each
  // with "Sair". Leaving takes them off the place's "Quem mestra aqui" and tells whoever runs it.
  import PostButton from '#lib/components/PostButton.svelte';
  import { toast } from '#lib/toaster.js';
  import { m } from '#lib/paraglide/messages.js';
  import { placeHostLeaveSchema } from '@mesaaberta/core/places/hosts';

  let {
    places,
    class: className = '',
  }: { places: { id: string; slug: string; name: string }[]; class?: string } = $props();
</script>

<section aria-labelledby="hosted-places" class={className}>
  <h3 id="hosted-places" class="text-2xl leading-tight font-semibold tracking-tight">
    {m.profile_hosted_title()}
  </h3>
  <p class="mt-2 max-w-prose text-muted">{m.profile_hosted_lede()}</p>
  <ul class="mt-2 divide-y divide-surface-200-800">
    {#each places as place (place.id)}
      <li class="flex flex-wrap items-center gap-3 py-3">
        <a
          href="/pp/{place.slug}"
          class="min-w-0 flex-1 truncate font-semibold text-surface-950-50 no-underline hover:underline"
          >{place.name}</a
        >
        <PostButton
          action="?/leaveHouse"
          fields={{ placeId: place.id }}
          schema={placeHostLeaveSchema}
          errorMessage={m.place_hosts_err_generic}
          success={m.profile_hosted_left({ place: place.name })}
          onFailure={() => toast.error(m.place_hosts_err_generic())}
          variant="secondary"
          size="sm"
          buttonClass="font-semibold">{m.profile_hosted_leave()}</PostButton
        >
      </li>
    {/each}
  </ul>
</section>
