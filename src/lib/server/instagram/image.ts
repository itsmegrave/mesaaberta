import { Resvg } from '@cf-wasm/resvg';
import jpeg from 'jpeg-js';
import QRCode from 'qrcode';
import type { InstagramEnv } from './api';
import type { TableView } from '../tables/queries';
import { imageUrl } from '../images';
import { toPlainText } from '$lib/text/rich';

export const WIDTH = 1080;
export const HEIGHT = 1350;
export const MAX_BYTES = 8 * 1024 * 1024;
const escape = (text: string) =>
  text.replace(
    /[<>&"']/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!,
  );
const hashtag = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}_]/gu, '');
export function shareFacts(table: TableView, origin: string) {
  const url = new URL(`/tables/${table.slug}`, origin).href;
  const date = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: table.timezone,
  }).format(table.startsAt);
  const modality = table.modality === 'online' ? 'Online' : 'Presencial';
  const kind =
    table.kind === 'one_shot' ? 'One-shot' : table.kind === 'adventure' ? 'Aventura' : 'Campanha';
  const seats = `${table.seatsLeft} vagas / ${table.capacity} lugares`;
  const description = toPlainText(table.description ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1000);
  const caption = `${table.title}\n${table.system.name} · ${kind} · ${modality}\n${date} (${table.timezone})\n${seats}\n\n${description}\n\nInscreva-se: ${url}\n\n#rpg #mesaaberta #${hashtag(table.system.slug)} #${modality.toLowerCase()} #${table.kind === 'one_shot' ? 'oneshot' : table.kind === 'adventure' ? 'adventure' : 'campaign'}`;
  return { url, date, modality, kind, seats, caption, description };
}

// SVG text is escaped and wrapped by glyph count (conservative for this bundled bold font).
export function lines(text: string, max = 23, limit = 4): string[] {
  const result: string[] = [];
  let line = '';
  for (const word of text.trim().split(/\s+/)) {
    for (const chunk of word.match(new RegExp(`.{1,${max}}`, 'gu')) ?? []) {
      if (Array.from(`${line} ${chunk}`.trim()).length > max && line) {
        result.push(line);
        line = '';
      }
      line = `${line} ${chunk}`.trim();
    }
  }
  if (line) result.push(line);
  if (result.length > limit) {
    result.length = limit;
    result[limit - 1] = result[limit - 1].slice(0, -1) + '…';
  }
  return result;
}

export async function shareSvg(
  table: TableView,
  origin: string,
  background?: string,
): Promise<string> {
  const facts = shareFacts(table, origin);
  const qr = QRCode.create(facts.url, { errorCorrectionLevel: 'M' });
  const cells: string[] = [];
  for (let y = 0; y < qr.modules.size; y++)
    for (let x = 0; x < qr.modules.size; x++) {
      if (qr.modules.get(y, x)) cells.push(`M${x + 4} ${y + 4}h1v1h-1z`);
    }
  const text = (value: string, x: number, y: number, size: number, color = '#ffffff') =>
    `<text x="${x}" y="${y}" font-size="${size}" fill="${color}">${escape(value)}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" font-family="DejaVu Sans" font-weight="bold">
 <rect width="1080" height="1350" fill="#151224"/>
 ${background ? `<image href="${background}" width="1080" height="1350" preserveAspectRatio="xMidYMid slice"/><rect width="1080" height="1350" fill="#151224" opacity="0.8"/>` : ''}
 <g transform="translate(64 64) scale(2.6)"><circle cx="17" cy="17" r="10.5" fill="#7054bd"/><g transform="rotate(-12 17 17)"><rect x="11" y="12" width="12" height="10" rx="1.2" fill="white"/><path d="M15 12v10M19 12v10M11 15.3h12M11 18.7h12" stroke="#7054bd" stroke-width=".8"/></g><circle cx="17" cy="4.6" r="3.4" fill="#79c990"/><circle cx="28.6" cy="22" r="3.4" fill="#ce91d4"/><circle cx="6.4" cy="24" r="3.4" fill="#eed196"/><circle cx="28" cy="9" r="2.8" fill="none" stroke="#f2c86a" stroke-width="1.6" stroke-dasharray="2.6 2.6"/></g>
 ${text('Mesa Aberta', 172, 120, 42)}
 ${lines(table.system.name, 38, 2)
   .map((line, i) => text(line, 64, 248 + i * 48, 40, '#f2c86a'))
   .join('')}
 ${lines(table.title)
   .map((line, i) => text(line, 64, 405 + i * 76, 64))
   .join('')}
 ${lines(facts.description, 60, 2)
   .map((line, i) => text(line, 64, 694 + i * 34, 26, '#d1c7eb'))
   .join('')}
 ${text(`${facts.modality} · ${facts.kind}`, 64, 780, 38)}
 ${lines(facts.date, 42, 2)
   .map((line, i) => text(line, 64, 854 + i * 46, 34))
   .join('')}
 ${text(table.timezone, 64, 948, 26, '#d1c7eb')}
 ${text(facts.seats, 64, 1015, 38, '#f2c86a')}
 <svg x="64" y="1082" width="210" height="210" viewBox="0 0 ${qr.modules.size + 8} ${qr.modules.size + 8}"><rect width="100%" height="100%" fill="white"/><path d="${cells.join('')}" fill="black"/></svg>
 ${text('Encontre sua próxima', 310, 1165, 34)}${text('aventura.', 310, 1210, 34)}${text(new URL(origin).hostname, 310, 1270, 26, '#d1c7eb')}
 </svg>`;
}

export async function renderShareImage(
  table: TableView,
  env: InstagramEnv,
  { useTableImage = false }: { useTableImage?: boolean } = {},
): Promise<Uint8Array> {
  const asset = async (path: string) => {
    const request = new Request(new URL(path, env.APP_ORIGIN));
    const response = env.ASSETS ? await env.ASSETS.fetch(request) : await fetch(request);
    if (!response.ok) throw new Error('Instagram font unavailable');
    return new Uint8Array(await response.arrayBuffer());
  };
  const font = await asset('/fonts/DejaVuSans-Bold.ttf');
  let background: string | undefined;
  const image = useTableImage ? imageUrl(env.SUPABASE_URL, table.imagePath) : null;
  if (image) {
    // Only fetch our own Storage, never a GM-provided URL. Bound time/size before decoding.
    // Workers supports manual/follow only. A redirect is non-OK below, so we never follow it.
    const response = await fetch(image, {
      signal: AbortSignal.timeout(15_000),
      redirect: 'manual',
    });
    if (!response.ok) throw new Error('Instagram background unavailable');
    const type = response.headers.get('content-type')?.split(';')[0];
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(type ?? ''))
      throw new Error('Instagram background format invalid');
    if (Number(response.headers.get('content-length')) > MAX_BYTES)
      throw new Error('Instagram background too large');
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > MAX_BYTES) throw new Error('Instagram background too large');
    background = `data:${type};base64,${Buffer.from(bytes).toString('base64')}`;
  }
  const renderer = await Resvg.async(await shareSvg(table, env.APP_ORIGIN!, background), {
    font: { fontBuffers: [font], loadSystemFonts: false, defaultFontFamily: 'DejaVu Sans' },
  });
  try {
    const rendered = renderer.render();
    try {
      const output = jpeg.encode(
        { width: rendered.width, height: rendered.height, data: rendered.pixels },
        85,
      ).data;
      if (output.byteLength > MAX_BYTES) throw new Error('Instagram JPEG too large');
      return new Uint8Array(output);
    } finally {
      rendered.free();
    }
  } finally {
    renderer.free();
  }
}
