import { describe, expect, it } from 'vitest';
import { coverBox, opaqueBounds } from './fill-frame.js';

// An RGBA buffer where only the columns in [from, to) are opaque.
function bands(width: number, height: number, from: number, to: number) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = from; x < to; x++) data[(y * width + x) * 4 + 3] = 255;
  return data;
}

describe('opaqueBounds', () => {
  it('finds the picture between transparent side bands', () => {
    expect(opaqueBounds(bands(40, 10, 2, 37), 40, 10)).toEqual({
      x: 2,
      y: 0,
      width: 35,
      height: 10,
    });
  });

  it('takes the whole frame when the picture reaches every edge', () => {
    expect(opaqueBounds(bands(8, 2, 0, 8), 8, 2)).toEqual({ x: 0, y: 0, width: 8, height: 2 });
  });

  it('counts a softened, half-clear edge as empty', () => {
    const data = bands(4, 1, 1, 4);
    data[3] = 200;
    expect(opaqueBounds(data, 4, 1)).toEqual({ x: 1, y: 0, width: 3, height: 1 });
  });

  it('gives null for a fully transparent cut', () => {
    expect(opaqueBounds(new Uint8ClampedArray(16), 2, 2)).toBeNull();
  });
});

describe('coverBox', () => {
  it('keeps the frame ratio, trimming the height of a box that got narrower', () => {
    expect(coverBox({ x: 13, y: 0, width: 1551, height: 400 }, 4)).toEqual({
      x: 13,
      y: 6.125,
      width: 1551,
      height: 387.75,
    });
  });

  it('trims the width of a box that got shorter', () => {
    expect(coverBox({ x: 0, y: 10, width: 400, height: 80 }, 4)).toEqual({
      x: 40,
      y: 10,
      width: 320,
      height: 80,
    });
  });
});
