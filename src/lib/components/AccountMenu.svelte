<script lang="ts">
	import { localizedHref } from '$lib/i18n/locales';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	let { name, avatarUrl }: { name: string; avatarUrl: string | null } = $props();
</script>

<!-- A native <details>: it needs no script and no inline styles, which the Content-Security-Policy
     forbids (a positioned popover library writes them). -->
<details class="group relative">
	<summary
		aria-label="{m.nav_account_menu()}: {name}"
		class="flex cursor-pointer list-none items-center gap-2 rounded px-2 py-1 font-semibold marker:hidden hover:bg-petrol/10 [&::-webkit-details-marker]:hidden"
	>
		{#if avatarUrl}
			<img
				src={avatarUrl}
				alt=""
				width="28"
				height="28"
				referrerpolicy="no-referrer"
				class="size-7 rounded-full"
			/>
		{:else}
			<span
				aria-hidden="true"
				class="grid size-7 place-items-center rounded-full bg-petrol text-sm text-celadon"
			>
				{name.slice(0, 1).toUpperCase()}
			</span>
		{/if}
		<span class="max-w-[12ch] truncate">{name}</span>
	</summary>

	<div class="absolute right-0 z-10 mt-1 rounded border border-petrol/15 bg-white p-2 shadow-md">
		<a
			href={localizedHref('/account/tables', getLocale())}
			class="block rounded px-3 py-2 whitespace-nowrap hover:bg-petrol/10"
		>
			{m.nav_my_tables()}
		</a>
		<form method="POST" action="/logout">
			<button
				type="submit"
				class="w-full rounded px-3 py-2 text-left whitespace-nowrap hover:bg-petrol/10"
			>
				{m.nav_sign_out()}
			</button>
		</form>
	</div>
</details>
