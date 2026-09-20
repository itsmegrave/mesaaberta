<script lang="ts">
	import { Avatar as BitsAvatar } from 'bits-ui';

	type AvatarSize = 28 | 32 | 36 | 40 | 44 | 48 | 64 | 80 | 120;

	interface Props {
		src?: string | null;
		name?: string | null;
		size?: AvatarSize | number;
		color?: 'sage' | 'rose' | 'periwinkle';
		class?: string;
	}

	let { src = null, name = null, size = 36, color, class: className = '' }: Props = $props();

	const colors = ['bg-sage', 'bg-rose', 'bg-periwinkle'] as const;

	const fallbackColorClass = $derived.by(() => {
		if (color === 'sage') return 'bg-sage';
		if (color === 'rose') return 'bg-rose';
		if (color === 'periwinkle') return 'bg-periwinkle';
		if (!name) return 'bg-sage';
		const code = name.charCodeAt(0) + (name.charCodeAt(name.length - 1) || 0);
		return colors[code % colors.length];
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

<BitsAvatar.Root
	class="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-display font-bold text-[#12272b] select-none {sizeClass} {fallbackColorClass} {className}"
>
	{#if src}
		<BitsAvatar.Image {src} alt="" aria-hidden="true" class="size-full object-cover" />
	{/if}
	<BitsAvatar.Fallback
		aria-hidden="true"
		class="flex size-full items-center justify-center {fallbackColorClass}"
	>
		{initial}
	</BitsAvatar.Fallback>
</BitsAvatar.Root>
