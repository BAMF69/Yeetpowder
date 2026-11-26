// Browser-native resize/encode, no new dependency. Run after fetch_level_textures.py.
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const cache = resolve(root, '.asset_cache/level-textures');
const out = resolve(root, 'public/assets/textures/terrain');
await mkdir(out, { recursive: true });
const sources = JSON.parse(await readFile(resolve(cache, 'sources.json'), 'utf8'));
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  for (const asset of sources) for (const [slot, source] of Object.entries(asset.maps)) {
    const input = await readFile(resolve(cache, source.file));
    const result = await page.evaluate(async (encoded) => {
      const img = new Image(); img.src = 'data:image/jpeg;base64,' + encoded;
      await img.decode();
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
      const ctx = canvas.getContext('2d'); ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, 512, 512);
      return canvas.toDataURL('image/jpeg', 0.88).split(',')[1];
    }, input.toString('base64'));
    const bytes = Buffer.from(result, 'base64');
    await writeFile(resolve(out, source.file), bytes);
    source.shipped_sha256 = createHash('sha256').update(bytes).digest('hex');
    source.bytes = bytes.length;
    source.size = 512;
    console.log(`${source.file}: ${bytes.length} bytes`);
  }
  await writeFile(resolve(root, 'docs/licenses/terrain-sources.json'), JSON.stringify(sources, null, 2) + '\n');
} finally { await browser.close(); }
