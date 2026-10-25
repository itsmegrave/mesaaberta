// Screenshots of a page as a persona, on desktop and phone, from the server `bun run dev:local` runs.
// Usage: bun scripts/dev/shot.ts --as gm /t/os-sinos-de-sablewood/manage [--out dir] [--base url]
import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { parseArgs } from 'node:util';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    as: { type: 'string' },
    out: { type: 'string', default: 'screenshots' },
    base: { type: 'string', default: 'http://localhost:5173' },
  },
});
const path = positionals[0] ?? '/';
mkdirSync(values.out, { recursive: true });

const browser = await chromium.launch();
try {
  for (const [name, device] of [
    ['desktop', { viewport: { width: 1280, height: 900 } }],
    ['phone', devices['Pixel 7']],
  ] as const) {
    const page = await (await browser.newContext({ ...device })).newPage();
    const url = values.as
      ? `${values.base}/dev/login?as=${values.as}&next=${encodeURIComponent(path)}`
      : `${values.base}${path}`;
    const response = await page.goto(url, { waitUntil: 'networkidle' });
    const file = `${values.out}/${values.as ?? 'anonymous'}-${path.replace(/\W+/g, '-').replace(/^-|-$/g, '') || 'home'}-${name}.png`;
    await page.screenshot({ path: file, fullPage: true });
    console.log(`${response?.status()} ${page.url()} -> ${file}`);
  }
} finally {
  await browser.close();
}
