// Generates assets/sample-drop.png — a warm placeholder "screenshot" used only
// as the dev/emulator fallback for the photo picker. Run: node scripts/gen-sample.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const W = 900;
const H = 600;

// CRC32
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

// paint: warm gradient sky + a couple of "cards" so it reads as a saved screenshot
const raw = Buffer.alloc(H * (1 + W * 3));
function px(x, y, r, g, b) {
  const row = y * (1 + W * 3);
  const i = row + 1 + x * 3;
  raw[i] = r;
  raw[i + 1] = g;
  raw[i + 2] = b;
}
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 3)] = 0; // filter: none
  const t = y / H;
  for (let x = 0; x < W; x++) {
    // vertical warm gradient
    let r = Math.round(247 - t * 40);
    let g = Math.round(230 - t * 55);
    let b = Math.round(211 - t * 70);
    // an ember band near the top
    if (y > 90 && y < 150) {
      r = 200;
      g = 84;
      b = 46;
    }
    // two rounded-ish content blocks
    const inBlock = (bx, by, bw, bh) => x > bx && x < bx + bw && y > by && y < by + bh;
    if (inBlock(80, 210, 740, 150) || inBlock(80, 390, 740, 120)) {
      r = 255;
      g = 252;
      b = 247;
    }
    px(x, y, r, g, b);
  }
}

const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // color type: RGB
const idat = zlib.deflateSync(raw, { level: 9 });
const png = Buffer.concat([
  sig,
  chunk('IHDR', ihdr),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0)),
]);

const out = path.join(__dirname, '..', 'assets', 'sample-drop.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, png);
console.log('wrote', out, png.length, 'bytes');
