// Generates the PWA / home-screen icons with zero dependencies (raw RGBA
// buffers encoded to PNG via Node's built-in zlib). One cohesive mark combining
// all three disciplines on a slate tile (A27):
//   • a double mountain peak  → climbing
//   • a dumbbell (two plates) → strength
//   • the dumbbell's bar is a heartbeat pulse → cardio
// White mark on a forest-green tile.
import { writeFileSync, mkdirSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
mkdirSync(outDir, { recursive: true })

const FOREST = [0x14, 0x53, 0x2d] // #14532d — forest green
const WHITE = [0xf8, 0xfa, 0xfc] // #f8fafc

// --- PNG encoding (RGBA) ----------------------------------------------------

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

// --- Geometry (design space is 512×512, mark centred ~(256,252)) ------------

const PEAK = [
  [168, 238],
  [214, 150],
  [242, 186],
  [296, 128],
  [344, 238],
]
const PLATES = [
  [150, 288, 26, 88, 10],
  [184, 302, 16, 60, 7],
  [312, 302, 16, 60, 7],
  [336, 288, 26, 88, 10],
]
const PULSE = [
  [200, 332],
  [232, 332],
  [244, 304],
  [258, 360],
  [270, 332],
  [312, 332],
]
const PULSE_HALF = 8

function inPoly(x, y, pts) {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]
    const [xj, yj] = pts[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
function inRoundRect(x, y, rx, ry, w, h, r) {
  if (x < rx || x > rx + w || y < ry || y > ry + h) return false
  const dx = Math.min(x - rx, rx + w - x)
  const dy = Math.min(y - ry, ry + h - y)
  if (dx >= r || dy >= r) return true
  return (r - dx) ** 2 + (r - dy) ** 2 <= r * r
}
function distSeg(px, py, ax, ay, bx, by) {
  const vx = bx - ax
  const vy = by - ay
  const c1 = vx * (px - ax) + vy * (py - ay)
  if (c1 <= 0) return Math.hypot(px - ax, py - ay)
  const c2 = vx * vx + vy * vy
  if (c2 <= c1) return Math.hypot(px - bx, py - by)
  const t = c1 / c2
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy))
}
function inMark(x, y) {
  if (inPoly(x, y, PEAK)) return true
  for (const [rx, ry, w, h, r] of PLATES) if (inRoundRect(x, y, rx, ry, w, h, r)) return true
  for (let i = 0; i < PULSE.length - 1; i++) {
    if (distSeg(x, y, PULSE[i][0], PULSE[i][1], PULSE[i + 1][0], PULSE[i + 1][1]) <= PULSE_HALF)
      return true
  }
  return false
}

// Supersample (SS×SS) then box-downsample for anti-aliasing, including alpha at
// the rounded corners.
function makeIcon(size, { rounded, scale = 1 }) {
  const SS = 3
  const R = size * SS
  const acc = new Float64Array(size * size * 4) // sum of premultiplied RGB + alpha
  const cx = 256
  const cy = 252
  for (let py = 0; py < R; py++) {
    for (let px = 0; px < R; px++) {
      const dx = ((px + 0.5) * 512) / R
      const dy = ((py + 0.5) * 512) / R
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      if (!rounded || inRoundRect(dx, dy, 0, 0, 512, 512, 112)) {
        const mx = scale === 1 ? dx : cx + (dx - cx) / scale
        const my = scale === 1 ? dy : cy + (dy - cy) / scale
        const c = inMark(mx, my) ? WHITE : FOREST
        ;[r, g, b] = c
        a = 255
      }
      const k = (Math.floor(py / SS) * size + Math.floor(px / SS)) * 4
      acc[k] += (r * a) / 255
      acc[k + 1] += (g * a) / 255
      acc[k + 2] += (b * a) / 255
      acc[k + 3] += a
    }
  }
  const n = SS * SS
  const out = Buffer.alloc(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    const aSum = acc[i * 4 + 3]
    if (aSum > 0) {
      out[i * 4] = Math.round((acc[i * 4] * 255) / aSum)
      out[i * 4 + 1] = Math.round((acc[i * 4 + 1] * 255) / aSum)
      out[i * 4 + 2] = Math.round((acc[i * 4 + 2] * 255) / aSum)
    }
    out[i * 4 + 3] = Math.round(aSum / n)
  }
  return encodePng(size, out)
}

const icons = [
  ['pwa-192.png', 192, { rounded: true }],
  ['pwa-512.png', 512, { rounded: true }],
  ['pwa-512-maskable.png', 512, { rounded: false, scale: 1.15 }], // full-bleed + safe-zone padding
  ['apple-touch-icon.png', 180, { rounded: false }], // iOS applies its own rounding
]
for (const [name, size, opts] of icons) {
  writeFileSync(join(outDir, name), makeIcon(size, opts))
  console.log('wrote', name)
}
