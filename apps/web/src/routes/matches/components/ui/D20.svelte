<script lang="ts">
  // A d20 showing one face: 20 for Quero jogar junto, 1 for Agora não. Illustration geometry on a
  // 24px grid: the outline, the face on top and the edges to the outline.
  let { face, size = 40 }: { face: number; size?: number } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.4"
  stroke-linejoin="round"
  aria-hidden="true"
>
  <path d="M12 1.5l9.5 5.5v11L12 23.5l-9.5-5.5v-11z" class="fill-punk-paper" />
  <path d="M12 4l7.5 13h-15z" class="fill-punk-yellow" />
  <path
    d="M12 1.5V4M12 4L2.5 7M12 4l9.5 3M4.5 17L2.5 7M19.5 17l2-10M4.5 17l-2 1M19.5 17l2 1M4.5 17l7.5 6.5 7.5-6.5"
  />
  <text
    x="12"
    y="15.4"
    text-anchor="middle"
    stroke="none"
    class="fill-current font-comic"
    font-size="7.6">{face}</text
  >
</svg>
