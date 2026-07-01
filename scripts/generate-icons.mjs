// Generates placeholder PWA icons (solid #3b82f6 with a white "W") with zero
// dependencies: raw RGBA buffers encoded to PNG via Node's built-in zlib.
import { writeFileSync, mkdirSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
mkdirSync(outDir, { recursive: true })

const BG = [0x3b, 0x82, 0xf6, 0xff] // #3b82f6
const FG = [0xff, 0xff, 0xff, 0xff] // white

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}

function encodePng(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type: RGBA
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0 // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function makeIcon(size, padRatio) {
  const rgba = Buffer.alloc(size * size * 4)
  for (let i = 0; i < size * size; i++) rgba.set(BG, i * 4)

  const setPx = (x, y) => {
    x = Math.round(x)
    y = Math.round(y)
    if (x < 0 || y < 0 || x >= size || y >= size) return
    rgba.set(FG, (y * size + x) * 4)
  }
  const sw = Math.max(2, Math.round(size * 0.09))
  const stroke = ([x0, y0], [x1, y1]) => {
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0))
    for (let s = 0; s <= steps; s++) {
      const t = s / steps
      const cx = x0 + (x1 - x0) * t
      const cy = y0 + (y1 - y0) * t
      for (let dx = -sw / 2; dx <= sw / 2; dx++)
        for (let dy = -sw / 2; dy <= sw / 2; dy++) setPx(cx + dx, cy + dy)
    }
  }

  const pad = size * padRatio
  const x0 = pad
  const x1 = size - pad
  const y0 = pad
  const y1 = size - pad
  const w = x1 - x0
  const h = y1 - y0
  const p1 = [x0, y0]
  const p2 = [x0 + w * 0.28, y1]
  const p3 = [x0 + w * 0.5, y0 + h * 0.5]
  const p4 = [x0 + w * 0.72, y1]
  const p5 = [x1, y0]
  stroke(p1, p2)
  stroke(p2, p3)
  stroke(p3, p4)
  stroke(p4, p5)

  return encodePng(size, rgba)
}

const icons = [
  ['pwa-192.png', 192, 0.28],
  ['pwa-512.png', 512, 0.28],
  ['pwa-512-maskable.png', 512, 0.36], // extra safe-zone padding for maskable
  ['apple-touch-icon.png', 180, 0.28],
]
for (const [name, size, pad] of icons) {
  writeFileSync(join(outDir, name), makeIcon(size, pad))
  console.log('wrote', name)
}
