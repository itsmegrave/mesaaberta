import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import jpeg from 'jpeg-js';
import { HEIGHT, MAX_BYTES, renderShareImage, shareFacts, shareSvg, WIDTH } from './image';
import type { TableView } from '../tables/queries';
const table = {
  slug: 'a-ventura',
  title: 'Dragões & <aventuras>',
  system: { name: 'D&D 5e', slug: 'dnd-5e' },
  kind: 'one_shot',
  modality: 'online',
  capacity: 5,
  seatsLeft: 3,
  startsAt: new Date('2026-10-10T22:00:00Z'),
  nextAt: new Date('2026-10-10T22:00:00Z'),
  timezone: 'America/Sao_Paulo',
  imagePath: null,
  joinDetails: 'private-address',
  welcomeMessage: 'private-message',
} as unknown as TableView;
afterEach(() => vi.unstubAllGlobals());
describe('Instagram share image', () => {
  it('uses public facts, the table timezone, URL and valid hashtags', () => {
    const facts = shareFacts(table, 'https://mesaaberta.app');
    expect(facts.caption).toContain('19:00');
    expect(facts.caption).toContain('3 vagas / 5 lugares');
    expect(facts.caption).toContain('#rpg #mesaaberta #dnd5e #online #oneshot');
    expect(facts.caption).toContain('https://mesaaberta.app/tables/a-ventura');
    expect(facts.caption).not.toContain('private');
  });
  it('escapes user text before drawing the image', async () => {
    const svg = await shareSvg(table, 'https://mesaaberta.app');
    expect(svg).toContain('Dragões &amp; &lt;aventuras&gt;');
    expect(svg).not.toContain('private');
  });
  it('renders a real 1080×1350 JPEG below the publishing limit', async () => {
    const font = new Uint8Array(await readFile('static/fonts/DejaVuSans-Bold.ttf'));
    const output = await renderShareImage(table, {
      APP_ORIGIN: 'https://mesaaberta.app',
      ASSETS: { fetch: vi.fn(async () => new Response(font)) },
    });
    const decoded = jpeg.decode(output, { useTArray: true });
    expect(decoded.width).toBe(WIDTH);
    expect(decoded.height).toBe(HEIGHT);
    expect(output.length).toBeLessThan(MAX_BYTES);
    expect(Array.from(output.slice(0, 3))).toEqual([255, 216, 255]);
  });
});

it('uses Workers-compatible manual redirects and refuses redirected Storage images', async () => {
  const font = new Uint8Array(await readFile('static/fonts/DejaVuSans-Bold.ttf'));
  const fetchImage = vi.fn(
    async () =>
      new Response(null, { status: 302, headers: { location: 'https://other.test/image.jpg' } }),
  );
  vi.stubGlobal('fetch', fetchImage);
  await expect(
    renderShareImage(
      { ...table, imagePath: 'tables/background.jpg' },
      {
        APP_ORIGIN: 'https://mesaaberta.app',
        SUPABASE_URL: 'https://test.supabase.co',
        ASSETS: { fetch: async () => new Response(font) },
      },
    ),
  ).rejects.toThrow('Instagram background unavailable');
  expect(fetchImage).toHaveBeenCalledWith(
    expect.stringContaining('test.supabase.co/storage'),
    expect.objectContaining({ redirect: 'manual' }),
  );
  expect(fetchImage).toHaveBeenCalledOnce();
});
