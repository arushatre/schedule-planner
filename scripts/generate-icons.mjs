// Renders the app icons to PNG with no dependencies (supersampled signed-distance shapes).
// Run: node scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'

const TEAL = [47, 93, 98]
const PAPER = [250, 248, 244]
const SHADE = [222, 216, 203]

function crc32(buffer) {
  let crc = ~0
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
  }
  return ~crc >>> 0
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data])
  const out = Buffer.alloc(body.length + 8)
  out.writeUInt32BE(data.length, 0)
  body.copy(out, 4)
  out.writeUInt32BE(crc32(body), body.length + 4)
  return out
}

function encodePng(size, rgba) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header.set([8, 6, 0, 0, 0], 8)
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const roundRect = (x, y, cx, cy, hw, hh, r) => {
  const qx = Math.abs(x - cx) - (hw - r)
  const qy = Math.abs(y - cy) - (hh - r)
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
}

const segment = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax
  const dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

// Colour of the icon at normalised (x, y); `null` = transparent.
function sample(x, y, { rounded, scale }) {
  if (rounded && roundRect(x, y, 0.5, 0.5, 0.5, 0.5, 0.22) > 0) return null
  // Content is scaled toward the centre for the maskable variant's safe zone.
  const u = (x - 0.5) / scale + 0.5
  const v = (y - 0.5) / scale + 0.5
  let color = TEAL
  if (roundRect(u, v, 0.5, 0.52, 0.27, 0.27, 0.06) <= 0) {
    color = PAPER
    if (v < 0.36) color = SHADE // calendar header band
  }
  const onCard = roundRect(u, v, 0.5, 0.52, 0.27, 0.27, 0.06) <= 0
  if (onCard && v >= 0.36) {
    const d = Math.min(segment(u, v, 0.4, 0.56, 0.48, 0.64), segment(u, v, 0.48, 0.64, 0.62, 0.46))
    if (d <= 0.032) color = TEAL
  }
  return color
}

function render(size, options) {
  const rgba = Buffer.alloc(size * size * 4)
  const samples = 3
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const color = sample((x + (sx + 0.5) / samples) / size, (y + (sy + 0.5) / samples) / size, options)
          if (color) { r += color[0]; g += color[1]; b += color[2]; a += 1 }
        }
      }
      const i = (y * size + x) * 4
      if (a) { rgba[i] = r / a; rgba[i + 1] = g / a; rgba[i + 2] = b / a }
      rgba[i + 3] = Math.round((a / (samples * samples)) * 255)
    }
  }
  return encodePng(size, rgba)
}

mkdirSync('public/icons', { recursive: true })
const outputs = [
  ['public/icons/icon-192.png', 192, { rounded: true, scale: 1 }],
  ['public/icons/icon-512.png', 512, { rounded: true, scale: 1 }],
  ['public/icons/maskable-512.png', 512, { rounded: false, scale: 0.8 }],
  ['public/icons/apple-touch-icon.png', 180, { rounded: false, scale: 0.92 }],
]
for (const [path, size, options] of outputs) writeFileSync(path, render(size, options))
console.log('Wrote', outputs.map(([path]) => path).join(', '))
