// Renders public/icon.svg into the raster sizes the manifest and iOS need.
// Kept in the repo so the icon set is reproducible from the source SVG rather
// than being a set of binaries nobody can regenerate.
//
//   bun apps/web/scripts/make-icons.mjs
//
// Chromium is already a devDependency (Playwright), so this adds none.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pub = resolve(here, '../public');
const svg = readFileSync(resolve(pub, 'icon.svg'), 'utf8');

// Opaque variants sit on the brand ink so the orb's cyan and warm accents read
// on a white home screen as well as a dark one. iOS composites alpha on black,
// and Android crops a maskable icon to whatever shape the launcher uses.
const GROUND = 'radial-gradient(circle at 50% 38%, #3b2f6b 0%, #241b45 72%)';

const TARGETS = [
  { file: 'icons/icon-192.png', size: 192, scale: 1, ground: 'transparent' },
  { file: 'icons/icon-512.png', size: 512, scale: 1, ground: 'transparent' },
  // 0.68 keeps the mark inside the maskable safe zone (the inner 80% circle).
  { file: 'icons/maskable-192.png', size: 192, scale: 0.68, ground: GROUND },
  { file: 'icons/maskable-512.png', size: 512, scale: 0.68, ground: GROUND },
  { file: 'icons/apple-touch-icon.png', size: 180, scale: 0.9, ground: GROUND },
  { file: 'icons/favicon-32.png', size: 32, scale: 1, ground: 'transparent' },
];

const browser = await chromium.launch();
await mkdir(resolve(pub, 'icons'), { recursive: true });

for (const t of TARGETS) {
  const page = await browser.newPage({
    viewport: { width: t.size, height: t.size },
    deviceScaleFactor: 1,
  });
  await page.setContent(`<!doctype html><style>
    html,body{margin:0;width:${t.size}px;height:${t.size}px}
    body{background:${t.ground};display:grid;place-items:center}
    svg{width:${Math.round(t.size * t.scale)}px;height:${Math.round(t.size * t.scale)}px;display:block}
  </style>${svg}`);
  await page.screenshot({
    path: resolve(pub, t.file),
    omitBackground: t.ground === 'transparent',
  });
  await page.close();
  console.log('wrote', t.file, `${t.size}px`);
}
await browser.close();
