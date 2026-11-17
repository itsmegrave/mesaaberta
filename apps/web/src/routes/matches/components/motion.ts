import { backOut, cubicOut } from 'svelte/easing';

/** Whether the person asked for less motion: every Combinar animation then just appears. */
export const reduced = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A duration, or none under reduced motion. */
export const ms = (duration: number) => (reduced() ? 0 : duration);

/**
 * The answered card flying off the deck: to the right for Quero jogar junto, to the left for Agora
 * não, spinning a little, from wherever the pointer let it go. It stays above the next card.
 */
export function throwCard(node: HTMLElement, { side }: { side: 'yes' | 'no' | null }) {
  if (!side || reduced()) return { duration: 0 };
  node.dataset.leaving = '1';
  node.style.zIndex = '20';
  const from = Number(node.dataset.dx) || 0;
  const sign = side === 'yes' ? 1 : -1;
  return {
    duration: 360,
    easing: cubicOut,
    css: (t: number, u: number) => {
      const x = from + sign * u * 640;
      return `transform: translate(${x}px, ${-u * 40}px) rotate(${x / 18}deg); opacity: ${0.4 + t * 0.6}`;
    },
  };
}

/** The next card coming up from behind the one that left. */
export function riseCard(_node: Element) {
  return {
    duration: ms(260),
    easing: backOut,
    css: (t: number, u: number) =>
      `transform: translateY(${u * 8}px) scale(${0.95 + t * 0.05}) rotate(${u * 2}deg)`,
  };
}

/** A sticker slapped on: it lands big and settles, with its own tilt kept in a class outside. */
export function slap(_node: Element, { delay = 0 }: { delay?: number } = {}) {
  return {
    delay: ms(delay),
    duration: ms(320),
    easing: backOut,
    css: (t: number) => `transform: scale(${1.8 - t * 0.8}); opacity: ${Math.min(1, t * 2)}`,
  };
}
