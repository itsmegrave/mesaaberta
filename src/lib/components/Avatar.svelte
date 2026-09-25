<script lang="ts">
	import { Avatar } from '@skeletonlabs/skeleton-svelte';

	type AvatarSize = 28 | 32 | 36 | 40 | 44 | 48 | 64 | 80 | 120;

	interface Props {
		src?: string | null;
		name?: string | null;
		size?: AvatarSize | number;
		color?: 'primary' | 'secondary' | 'tertiary';
		class?: string;
	}

	let { src = null, name = null, size = 36, color, class: className = '' }: Props = $props();

	const colours = {
		primary: 'preset-filled-primary-500',
		secondary: 'preset-filled-secondary-500',
		tertiary: 'preset-filled-tertiary-500'
	} as const;
	const order = ['primary', 'secondary', 'tertiary'] as const;

	const fallbackColorClass = $derived.by(() => {
		if (color) return colours[color];
		if (!name) return colours.primary;
		const code = name.charCodeAt(0) + (name.charCodeAt(name.length - 1) || 0);
		return colours[order[code % order.length]];
	});

	const initial = $derived((name?.trim()?.[0] || '?').toUpperCase());

	const sizeClass = $derived.by(() => {
		switch (size) {
			case 28:
				return 'size-7 text-xs';
			case 32:
				return 'size-8 text-sm';
			case 36:
				return 'size-9 text-base';
			case 40:
				return 'size-10 text-base';
			case 44:
				return 'size-11 text-lg';
			case 48:
				return 'size-12 text-xl';
			case 64:
				return 'size-16 text-2xl';
			case 80:
				return 'size-20 text-3xl';
			case 120:
				return 'size-[120px] text-5xl';
			default:
				return 'size-9 text-base';
		}
	});
</script>

<Avatar
	class="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold select-none {sizeClass} {className}"
>
	{#if src}
		<Avatar.Image {src} alt="" aria-hidden="true" class="size-full object-cover" />
	{/if}
	<Avatar.Fallback
		aria-hidden="true"
		class="flex size-full items-center justify-center {fallbackColorClass}"
	>
		{initial}
	</Avatar.Fallback>
</Avatar>
