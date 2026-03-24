// Generates a simple PC-Pilot icon as PNG and ICO
// Run: node scripts/generate-icon.js

const fs = require('fs');
const path = require('path');

const size = 256;
const channels = 4; // RGBA
const pixels = Buffer.alloc(size * size * channels, 0);

function setPixel(x, y, r, g, b, a = 255) {
  if (x < 0 || x >= size || y < 0 || y >= size) return;
  const idx = (y * size + x) * channels;
  pixels[idx] = r;
  pixels[idx + 1] = g;
  pixels[idx + 2] = b;
  pixels[idx + 3] = a;
}

function fillRect(x1, y1, x2, y2, r, g, b) {
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      setPixel(x, y, r, g, b);
    }
  }
}

function fillCircle(cx, cy, radius, r, g, b) {
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2) {
        setPixel(x, y, r, g, b);
      }
    }
  }
}

// Background — rounded dark square
const bg = { r: 30, g: 30, b: 40 };
const accent = { r: 34, g: 197, b: 94 }; // green #22c55e

fillCircle(128, 128, 120, bg.r, bg.g, bg.b);

// "P" letter
const thick = 18;
// Vertical bar
fillRect(60, 50, 60 + thick, 210, accent.r, accent.g, accent.b);
// Top horizontal
fillRect(60, 50, 170, 50 + thick, accent.r, accent.g, accent.b);
// Middle horizontal
fillRect(60, 120, 170, 120 + thick, accent.r, accent.g, accent.b);
// Right vertical (top half)
fillRect(170 - thick, 50, 170, 120 + thick, accent.r, accent.g, accent.b);

// Dot below P
fillCircle(110, 185, 14, accent.r, accent.g, accent.b);

// Write as BMP wrapped in ICO format
function createBMP(pixelData, w, h) {
  const rowSize = w * 4;
  const bmpSize = 40 + rowSize * h * 2; // header + pixels + mask
  const buf = Buffer.alloc(bmpSize);

  // BITMAPINFOHEADER
  buf.writeUInt32LE(40, 0);          // header size
  buf.writeInt32LE(w, 4);            // width
  buf.writeInt32LE(h * 2, 8);        // height (doubled for ICO: image + mask)
  buf.writeUInt16LE(1, 12);          // planes
  buf.writeUInt16LE(32, 14);         // bpp
  buf.writeUInt32LE(0, 16);          // compression
  buf.writeUInt32LE(rowSize * h, 20); // image size

  // Pixel data — bottom-up, BGRA
  for (let y = h - 1; y >= 0; y--) {
    for (let x = 0; x < w; x++) {
      const srcIdx = (y * w + x) * 4;
      const dstIdx = 40 + ((h - 1 - y) * w + x) * 4;
      buf[dstIdx] = pixelData[srcIdx + 2];     // B
      buf[dstIdx + 1] = pixelData[srcIdx + 1]; // G
      buf[dstIdx + 2] = pixelData[srcIdx];     // R
      buf[dstIdx + 3] = pixelData[srcIdx + 3]; // A
    }
  }

  return buf;
}

function createICO(pixelData, w, h) {
  const bmp = createBMP(pixelData, w, h);
  const headerSize = 6 + 16; // ICO header + 1 entry
  const buf = Buffer.alloc(headerSize + bmp.length);

  // ICO header
  buf.writeUInt16LE(0, 0);     // reserved
  buf.writeUInt16LE(1, 2);     // type: ICO
  buf.writeUInt16LE(1, 4);     // count

  // ICO entry
  buf[6] = 0;                  // width (0 = 256)
  buf[7] = 0;                  // height (0 = 256)
  buf[8] = 0;                  // palette
  buf[9] = 0;                  // reserved
  buf.writeUInt16LE(1, 10);    // planes
  buf.writeUInt16LE(32, 12);   // bpp
  buf.writeUInt32LE(bmp.length, 14); // size
  buf.writeUInt32LE(headerSize, 18); // offset

  bmp.copy(buf, headerSize);
  return buf;
}

// Write PNG using minimal implementation
function createPNG(pixelData, w, h) {
  const zlib = require('zlib');

  // Add filter byte (0 = None) to each row
  const rawData = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    rawData[y * (1 + w * 4)] = 0; // filter: None
    pixelData.copy(rawData, y * (1 + w * 4) + 1, y * w * 4, (y + 1) * w * 4);
  }

  const compressed = zlib.deflateSync(rawData);

  function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc ^= buf[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeAndData = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typeAndData), 0);
    return Buffer.concat([len, typeAndData, crc]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

fs.writeFileSync(path.join(assetsDir, 'icon.ico'), createICO(pixels, size, size));
fs.writeFileSync(path.join(assetsDir, 'icon.png'), createPNG(pixels, size, size));

console.log('Icons generated in assets/');
console.log('  - icon.ico (256x256, for Windows build)');
console.log('  - icon.png (256x256, for Linux build)');
