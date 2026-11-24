#!/usr/bin/env node
// ---------------------------------------------------------------------------
// slim_glb.mjs
// Purpose : Shrinks the textures inside a .glb for phones and the web, leaving everything else (meshes, skin,
//           animations, materials, metadata) byte for byte. Meshy exports four 2048-4096 px PNGs per model
//           (44 MB for the Reaper scythe); a phone needs about 1024 px JPEGs.
// Usage   : node tools/slim_glb.mjs <in.glb> <out.glb> [--size 1024] [--quality 0.85]
// Notes   : The images are resized and re-encoded as JPEG by the Playwright Chromium smoke already uses (canvas,
//           high-quality smoothing), so no new dependency. JPEG is core glTF (no extension needed). Every
//           bufferView is copied in order into a new BIN chunk with 4-byte alignment; only image views change.
//           The asset block and any extras are kept as they were (Meshy's terms forbid removing AI identifiers;
//           its exports carry none in the JSON or PNG chunks, checked 2026-11-24).
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : def;
};
const [input, output] = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
if (!input || !output) {
  console.error("usage: node tools/slim_glb.mjs <in.glb> <out.glb> [--size 1024] [--quality 0.85]");
  process.exit(2);
}
const SIZE = opt("size", 1024);
const QUALITY = opt("quality", 0.85);

// ---- read the GLB ----------------------------------------------------------------
const glb = readFileSync(input);
if (glb.readUInt32LE(0) !== 0x46546c67) throw new Error(`${input} is not a .glb`);
const jsonLen = glb.readUInt32LE(12);
const json = JSON.parse(glb.subarray(20, 20 + jsonLen).toString("utf8"));
const binStart = 20 + jsonLen + 8;
const binLen = glb.readUInt32LE(20 + jsonLen);
const bin = glb.subarray(binStart, binStart + binLen);
const viewData = json.bufferViews.map((v) => bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength));

// ---- re-encode the images ------------------------------------------------------------
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const [i, img] of (json.images ?? []).entries()) {
    if (img.bufferView === undefined) continue; // an external file: not ours to touch
    const src = `data:${img.mimeType};base64,${viewData[img.bufferView].toString("base64")}`;
    const out = await page.evaluate(async ({ src, size, quality }) => {
      const im = new Image();
      im.src = src;
      await im.decode();
      const scale = Math.min(1, size / Math.max(im.width, im.height));
      const w = Math.max(1, Math.round(im.width * scale));
      const h = Math.max(1, Math.round(im.height * scale));
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const g = c.getContext("2d");
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = "high";
      g.drawImage(im, 0, 0, w, h);
      return { url: c.toDataURL("image/jpeg", quality), from: `${im.width}x${im.height}`, to: `${w}x${h}` };
    }, { src, size: SIZE, quality: QUALITY });
    const bytes = Buffer.from(out.url.split(",")[1], "base64");
    console.log(`[slim] image ${i} ${img.name ?? ""}: ${out.from} ${(viewData[img.bufferView].length / 1e6).toFixed(2)} MB -> ${out.to} ${(bytes.length / 1e6).toFixed(2)} MB`);
    viewData[img.bufferView] = bytes;
    img.mimeType = "image/jpeg";
  }
} finally {
  await browser.close();
}

// ---- write the GLB back ----------------------------------------------------------------
const pad4 = (n) => (n + 3) & ~3;
let offset = 0;
const parts = [];
json.bufferViews.forEach((v, i) => {
  const data = viewData[i];
  v.byteOffset = offset;
  v.byteLength = data.length;
  parts.push(data, Buffer.alloc(pad4(data.length) - data.length));
  offset = pad4(offset + data.length);
});
const newBin = Buffer.concat(parts);
json.buffers = [{ byteLength: newBin.length }];
let jsonBuf = Buffer.from(JSON.stringify(json), "utf8");
jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(pad4(jsonBuf.length) - jsonBuf.length, 0x20)]);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + newBin.length, 8);
const chunk = (len, type) => {
  const b = Buffer.alloc(8);
  b.writeUInt32LE(len, 0);
  b.writeUInt32LE(type, 4);
  return b;
};
writeFileSync(output, Buffer.concat([header, chunk(jsonBuf.length, 0x4e4f534a), jsonBuf, chunk(newBin.length, 0x004e4942), newBin]));
console.log(`[slim] ${input} ${(glb.length / 1e6).toFixed(1)} MB -> ${output} ${((12 + 16 + jsonBuf.length + newBin.length) / 1e6).toFixed(1)} MB`);
