import sharp from "sharp";
import path from "node:path";

const src = "public/icons/hlapp.jpg";
const outDir = "public/icons";
const BG = { r: 47, g: 155, b: 106, alpha: 1 };

function circleSvg(size) {
  const r = size / 2;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<circle cx="${r}" cy="${r}" r="${r}" fill="#fff"/></svg>`,
  );
}

async function circularPng(size) {
  return sharp(src)
    .resize(size, size, { fit: "cover" })
    .composite([{ input: circleSvg(size), blend: "dest-in" }])
    .png()
    .toBuffer();
}

async function writeAny(size, name) {
  await sharp(await circularPng(size)).png().toFile(path.join(outDir, name));
  console.log("any", name);
}

async function writeMaskable(size, name, pad = 0.1) {
  const inner = Math.round(size * (1 - pad * 2));
  const offset = Math.round((size - inner) / 2);
  const circled = await circularPng(inner);
  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: circled, left: offset, top: offset }])
    .png()
    .toFile(path.join(outDir, name));
  console.log("maskable", name);
}

await writeAny(192, "hl-192.png");
await writeAny(512, "hl-512.png");
await writeAny(180, "hl-apple-touch.png");
await writeAny(32, "hl-32.png");
await writeMaskable(512, "hl-512-maskable.png", 0.1);
console.log("done");
