<script lang="ts">
	import { Popover, Portal } from '@skeletonlabs/skeleton-svelte';
	import Avatar from '$lib/components/Avatar.svelte';
	import { localizedHref } from '$lib/i18n/locales';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	let {
		name,
		avatarUrl,
		isAdmin = false,
		pendingSuggestionsCount = 0
	}: {
		name: string;
		avatarUrl: string | null;
		isAdmin?: boolean;
		pendingSuggestionsCount?: number;
	} = $props();

	const locale = getLocale();
	const item =
		'btn hover:preset-tonal flex h-11 w-full items-center justify-start gap-3 rounded-lg px-3 text-left text-base font-semibold';
</script>

<Popover positioning={{ placement: 'bottom-end', offset: { mainAxis: 8 } }}>
	<Popover.Trigger
		aria-label="{m.nav_account_menu()}: {name}"
		class="btn flex size-11 items-center justify-center rounded-full border border-surface-200-800 bg-panel p-0 font-semibold hover:preset-tonal md:h-11 md:w-auto md:gap-2.5 md:pr-3 md:pl-1.5"
	>
		<Avatar src={avatarUrl} {name} size={32} />
		<span class="hidden max-w-[14ch] truncate md:inline">{name}</span>
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.8"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
			class="hidden shrink-0 md:block"
		>
			<path d="M6 9l6 6 6-6" />
		</svg>
	</Popover.Trigger>

	<Portal>
		<Popover.Positioner class="z-50!">
			<Popover.Content
				class="w-[272px] card border border-surface-200-800 bg-surface-100-900 p-2 shadow-2xl"
			>
				<!-- User info header -->
				<div class="flex items-center gap-3 p-2.5 pb-3">
					<Avatar src={avatarUrl} {name} size={40} />
					<div class="min-w-0 flex-1">
						<div
							data-testid="account-user-name"
							class="truncate text-[17px] leading-tight font-bold"
						>
							{name}
						</div>
					</div>
				</div>

				<hr class="mx-2 mb-1.5" />

				<nav aria-label={m.nav_account_menu()} class="flex flex-col gap-0.5">
					<a href={localizedHref('/perfil', locale)} class={item}>
						<svg
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.8"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
							class="shrink-0"
						>
							<circle cx="12" cy="8" r="4" />
							<path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
						</svg>
						{m.nav_profile()}
					</a>

					<a href={localizedHref('/account/tables', locale)} class={item}>
						<svg
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.8"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
							class="shrink-0"
						>
							<rect x="3.5" y="5" width="17" height="15.5" rx="3" />
							<path d="M3.5 10h17M8 3v4M16 3v4" />
						</svg>
						{m.nav_my_tables()}
					</a>

					{#if isAdmin}
						<a href={localizedHref('/admin', locale)} class={item}>
							<svg
								width="20"
								height="20"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.8"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
								class="shrink-0"
							>
								<path d="M12 3l7 3v5.5c0 4.5-3 7.5-7 9.5-4-2-7-5-7-9.5V6l7-3z" />
								<path d="M9 12l2 2 4-4" />
							</svg>
							{m.nav_admin()}
							{#if pendingSuggestionsCount > 0}
								<span
									class="ml-auto badge min-w-6 rounded-full preset-filled-warning-500 px-1.5 font-bold"
								>
									{pendingSuggestionsCount}
								</span>
							{/if}
						</a>
					{/if}

					<form method="POST" action="/logout" class="m-0">
						<button type="submit" class={item}>
							<svg
								width="20"
								height="20"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.8"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
								class="shrink-0"
							>
								<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M4 12h11M11 8l4 4-4 4" />
							</svg>
							{m.nav_sign_out()}
						</button>
					</form>
				</nav>
			</Popover.Content>
		</Popover.Positioner>
	</Portal>
</Popover>
