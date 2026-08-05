import sharp from "sharp";
import path from "node:path";

const src = "public/icons/hlapp.jpg";
const outDir = "public/icons";
/** Solid white behind the circular mark — avoids black corners on installed PWAs. */
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

function circleSvg(size) {
  const r = size / 2;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<circle cx="${r}" cy="${r}" r="${r}" fill="#fff"/></svg>`,
  );
}

async function circularOnWhite(size, pad = 0) {
  const inner = Math.round(size * (1 - pad * 2));
  const offset = Math.round((size - inner) / 2);
  const circled = await sharp(src)
    .resize(inner, inner, { fit: "cover" })
    .composite([{ input: circleSvg(inner), blend: "dest-in" }])
    .png()
    .toBuffer();

  return sharp({
    create: { width: size, height: size, channels: 4, background: WHITE },
  })
    .composite([{ input: circled, left: offset, top: offset }])
    .png()
    .toBuffer();
}

async function write(size, name, pad = 0) {
  await sharp(await circularOnWhite(size, pad))
    .png()
    .toFile(path.join(outDir, name));
  console.log("wrote", name);
}

await write(192, "hl-192.png");
await write(512, "hl-512.png");
await write(180, "hl-apple-touch.png");
await write(32, "hl-32.png");
// Maskable also on white (safe-zone padding) so home-screen tiles stay light.
await write(512, "hl-512-maskable.png", 0.1);
console.log("done");
