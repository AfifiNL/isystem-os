/**
 * One-shot generator for iSystem favicon + app icons.
 *
 * Source: reviewed iSystem dark-on-light and light-on-dark PNG assets.
 * Outputs:
 *   src/app/favicon.ico      (multi-size ICO: 16, 32, 48)
 *   src/app/icon.png         (512x512)
 *   src/app/apple-icon.png   (180x180)
 *   public/isystem-assets/favicon-dark.png  (for dark-mode link tag, optional)
 *
 * Run: node scripts/generate-favicons.mjs
 */
import sharp from "sharp";
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const LIGHT_SRC = path.join(ROOT, "public/isystem-assets/isystem-logo-dark.png"); // logo for light bg
const DARK_SRC = path.join(ROOT, "public/isystem-assets/isystem-logo-light.png"); // logo for dark bg
const APP_DIR = path.join(ROOT, "src/app");
const PUB_DIR = path.join(ROOT, "public/isystem-assets");

async function renderSquare(srcPath, size, { background }) {
  const svgBuffer = await fs.readFile(srcPath);
  // Rasterize the wide logo to a height that leaves padding in a square canvas.
  const targetLogoWidth = Math.round(size * 0.88);
  const logo = await sharp(svgBuffer, { density: 600 })
    .resize({ width: targetLogoWidth * 4, withoutEnlargement: false })
    .png()
    .toBuffer();
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background,
    },
  })
    .composite([
      {
        input: await sharp(logo).resize({ width: targetLogoWidth }).toBuffer(),
        gravity: "center",
      },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

// Build a Microsoft ICO containing embedded PNGs.
// Header layout: ICONDIR (6B) + N * ICONDIRENTRY (16B each) + concatenated PNGs.
function buildIco(pngBuffers) {
  const count = pngBuffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(count, 4);

  const entries = Buffer.alloc(16 * count);
  let offset = 6 + 16 * count;
  for (let i = 0; i < count; i++) {
    const png = pngBuffers[i];
    // First byte of IHDR payload (offset 16 in the PNG) gives the width.
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    const e = i * 16;
    entries.writeUInt8(width >= 256 ? 0 : width, e + 0);
    entries.writeUInt8(height >= 256 ? 0 : height, e + 1);
    entries.writeUInt8(0, e + 2);  // palette
    entries.writeUInt8(0, e + 3);  // reserved
    entries.writeUInt16LE(1, e + 4);   // color planes
    entries.writeUInt16LE(32, e + 6);  // bpp
    entries.writeUInt32LE(png.length, e + 8);
    entries.writeUInt32LE(offset, e + 12);
    offset += png.length;
  }

  return Buffer.concat([header, entries, ...pngBuffers]);
}

async function main() {
  const white = { r: 255, g: 255, b: 255, alpha: 1 };
  const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
  const brandNavy = { r: 0, g: 47, b: 88, alpha: 1 }; // #002F58

  // ICO set: solid white background (most browser chrome is light).
  const ico16 = await renderSquare(LIGHT_SRC, 16, { background: white });
  const ico32 = await renderSquare(LIGHT_SRC, 32, { background: white });
  const ico48 = await renderSquare(LIGHT_SRC, 48, { background: white });
  const ico = buildIco([ico16, ico32, ico48]);
  await fs.writeFile(path.join(APP_DIR, "favicon.ico"), ico);

  // App icon: 512x512 PNG, white background so Google SERP thumbnail is readable.
  const icon512 = await renderSquare(LIGHT_SRC, 512, { background: white });
  await fs.writeFile(path.join(APP_DIR, "icon.png"), icon512);

  // Apple touch icon: 180x180, brand navy background for iOS home-screen polish.
  const apple = await renderSquare(DARK_SRC, 180, { background: brandNavy });
  await fs.writeFile(path.join(APP_DIR, "apple-icon.png"), apple);

  // Dark-mode favicon asset (referenced via media-query link tag).
  const darkFavicon = await renderSquare(DARK_SRC, 512, { background: transparent });
  await fs.writeFile(path.join(PUB_DIR, "favicon-dark.png"), darkFavicon);

  console.log("favicons generated:");
  console.log(" - src/app/favicon.ico  (", ico.length, "bytes )");
  console.log(" - src/app/icon.png     (", icon512.length, "bytes )");
  console.log(" - src/app/apple-icon.png (", apple.length, "bytes )");
  console.log(" - public/isystem-assets/favicon-dark.png (", darkFavicon.length, "bytes )");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
