<script lang="ts">
	import { Popover } from 'bits-ui';
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
</script>

<Popover.Root>
	<Popover.Trigger
		aria-label="{m.nav_account_menu()}: {name}"
		class="flex size-11 cursor-pointer items-center justify-center rounded-full border border-line bg-surface font-display text-base font-semibold text-ink transition-colors hover:bg-wash md:h-11 md:w-auto md:gap-2.5 md:pr-3 md:pl-1.5"
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

	<Popover.Portal>
		<Popover.Content
			align="end"
			sideOffset={8}
			class="z-50 w-[272px] rounded-2xl border border-line bg-surface p-2 text-ink shadow-2xl outline-none"
		>
			<!-- User info header -->
			<div class="flex items-center gap-3 p-2.5 pb-3">
				<Avatar src={avatarUrl} {name} size={40} />
				<div class="min-w-0 flex-1">
					<div
						data-testid="account-user-name"
						class="truncate font-display text-[17px] leading-tight font-bold text-ink"
					>
						{name}
					</div>
				</div>
			</div>

			<div class="mx-2 mb-1.5 h-px bg-line"></div>

			<nav aria-label={m.nav_account_menu()} class="flex flex-col gap-0.5">
				<a
					href={localizedHref('/perfil', locale)}
					class="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left font-display text-base font-semibold text-ink transition-colors hover:bg-wash"
				>
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

				<a
					href={localizedHref('/account/tables', locale)}
					class="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left font-display text-base font-semibold text-ink transition-colors hover:bg-wash"
				>
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
					<a
						href={localizedHref('/admin', locale)}
						class="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left font-display text-base font-semibold text-ink transition-colors hover:bg-wash"
					>
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
								class="ml-auto inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-lamp px-1.5 font-display text-sm font-bold text-on-lamp"
							>
								{pendingSuggestionsCount}
							</span>
						{/if}
					</a>
				{/if}

				<form method="POST" action="/logout" class="m-0">
					<button
						type="submit"
						class="flex h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-left font-display text-base font-semibold text-ink transition-colors hover:bg-wash"
					>
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
	</Popover.Portal>
</Popover.Root>
