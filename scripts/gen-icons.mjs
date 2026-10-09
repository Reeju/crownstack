// Generates the PWA icons procedurally (no binary source assets, SPEC §5.1).
// Usage: pnpm icons
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BLUE = [0x2f, 0x6d, 0xe1];
const GOLD = [0xf7, 0xc9, 0x48];
const GOLD_DARK = [0xc9, 0x96, 0x1a];
const WHITE = [0xff, 0xff, 0xff];

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const inEllipse = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

/** Colour of the artwork at (x, y) in a unit square centred on 0, or null for background. */
function artwork(x, y) {
  // Crown: band plus three points.
  if (y > -0.2 && y < -0.1 && Math.abs(x) < 0.2) return WHITE;
  for (const px of [-0.15, 0, 0.15]) {
    const h = (y + 0.36) / 0.16; // 0 at the tip, 1 at the band
    if (h >= 0 && h <= 1 && Math.abs(x - px) < 0.075 * h) return WHITE;
  }
  // Coin stack, drawn top to bottom so upper coins overlap lower ones.
  for (let i = 0; i < 4; i++) {
    const cy = -0.04 + i * 0.1;
    if (inEllipse(x, y, 0, cy, 0.24, 0.07)) return GOLD;
    if (Math.abs(x) < 0.24 && y > cy && y < cy + 0.06) return GOLD_DARK;
    if (inEllipse(x, y, 0, cy + 0.06, 0.24, 0.07)) return GOLD_DARK;
  }
  return null;
}

function render(size, { maskable }) {
  const SS = 3;
  const rgba = Buffer.alloc(size * size * 4);
  const scale = maskable ? 0.72 : 1; // keep artwork inside the maskable safe zone
  const corner = maskable ? 0 : 0.22;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let s = 0; s < SS * SS; s++) {
        const x = (px + ((s % SS) + 0.5) / SS) / size - 0.5;
        const y = (py + (Math.floor(s / SS) + 0.5) / SS) / size - 0.5;
        const dx = Math.max(Math.abs(x) - (0.5 - corner), 0);
        const dy = Math.max(Math.abs(y) - (0.5 - corner), 0);
        if (dx * dx + dy * dy > corner * corner) continue;
        const c = artwork(x / scale, (y - 0.02) / scale) ?? BLUE;
        r += c[0];
        g += c[1];
        b += c[2];
        a += 1;
      }
      const o = (py * size + px) * 4;
      if (a > 0) rgba.set([r / a, g / a, b / a, (a / (SS * SS)) * 255], o);
    }
  }
  return encodePng(size, rgba);
}

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon-192.png', render(192, { maskable: false }));
writeFileSync('public/icons/icon-512.png', render(512, { maskable: false }));
writeFileSync('public/icons/icon-maskable-512.png', render(512, { maskable: true }));
writeFileSync('public/icons/apple-touch-icon.png', render(180, { maskable: true }));
console.log('icons written to public/icons');
