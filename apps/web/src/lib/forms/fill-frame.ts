/**
 * A cut that must fill its frame edge to edge (the profile banner): transparent bands at the sides
 * of the cut, whether they come from the picture itself or from the frame reaching a pixel past its
 * edge, showed as an empty strip on the profile. These find the picture's opaque part and stretch it,
 * at its own ratio, back over the whole frame.
 */

type Box = { x: number; y: number; width: number; height: number };

/** Below this alpha a pixel counts as empty: a band's softened edge would still read as a line. */
const SOLID = 250;

/** The smallest box holding every solid pixel of an RGBA buffer, or null when none is. */
export function opaqueBounds(data: ArrayLike<number>, width: number, height: number): Box | null {
  let top = height;
  let bottom = -1;
  let left = width;
  let right = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] < SOLID) continue;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  }
  if (bottom < 0) return null;
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

/** The largest box of `ratio` (width over height) inside `box`, in its middle. */
export function coverBox(box: Box, ratio: number): Box {
  let width = box.width;
  let height = width / ratio;
  if (height > box.height) {
    height = box.height;
    width = height * ratio;
  }
  return {
    x: box.x + (box.width - width) / 2,
    y: box.y + (box.height - height) / 2,
    width,
    height,
  };
}

/**
 * The canvas itself when the picture already reaches every edge; otherwise a new canvas of the
 * same size with the opaque part scaled up to cover it.
 */
export function fillFrame(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const { width, height } = canvas;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context || width === 0 || height === 0) return canvas;
  const bounds = opaqueBounds(context.getImageData(0, 0, width, height).data, width, height);
  if (!bounds || (bounds.width === width && bounds.height === height)) return canvas;
  const source = coverBox(bounds, width / height);
  const filled = document.createElement('canvas');
  filled.width = width;
  filled.height = height;
  const target = filled.getContext('2d');
  if (!target) return canvas;
  target.imageSmoothingQuality = 'high';
  target.drawImage(canvas, source.x, source.y, source.width, source.height, 0, 0, width, height);
  return filled;
}
