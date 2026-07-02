// Continuous colour bands for climbing grades. Each grade gets a distinct hex
// interpolated within its band, so pickers, pills, and charts share one scheme.

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

// Linear interpolation between two hex colours (t in [0, 1]).
function lerpHex(from: string, to: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(from)
  const [r2, g2, b2] = hexToRgb(to)
  const c = Math.max(0, Math.min(1, t))
  return rgbToHex(r1 + (r2 - r1) * c, g1 + (g2 - g1) * c, b1 + (b2 - b1) * c)
}

// Readable text colour (near-black / near-white) for a coloured pill background.
export function contrastText(hex: string): string {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255)
  const lin = (x: number) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4))
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  return L > 0.5 ? '#0a0a0a' : '#fafafa'
}

// --- Ewbanks / gym (numeric) ------------------------------------------------

// Five colour bands, low → high. Rendered as five *equal, contiguous* segments
// across the grade range and interpolated within — so the progression is smooth
// and strictly one-directional (green → magenta), with magenta reserved for the
// top 20%. No gaps → no accidental fallback to the magenta band.
const NUM_BANDS: [string, string][] = [
  ['#4ade80', '#16a34a'], // green
  ['#facc15', '#fb923c'], // yellow → orange
  ['#f97316', '#dc2626'], // orange → red
  ['#dc2626', '#7f1d1d'], // red → deep red
  ['#e879f9', '#86198f'], // magenta
]

// Optionally pass a { min, max } range (e.g. a gym's configured grade range) so
// the bands are computed relative to that range — the lowest grade maps to the
// green end and the highest to magenta, regardless of the absolute values.
// Without a range the absolute 1–35 Ewbanks scale is used.
export function gradeToColor(grade: number, range?: { min: number; max: number }): string {
  const min = range && range.max > range.min ? range.min : 1
  const max = range && range.max > range.min ? range.max : 35
  const t = max > min ? Math.max(0, Math.min(1, (grade - min) / (max - min))) : 0
  // Locate the band (each spans 1/5 of the range) and interpolate within it.
  const scaled = t * NUM_BANDS.length // 0 .. 5
  const i = Math.min(NUM_BANDS.length - 1, Math.floor(scaled))
  const [from, to] = NUM_BANDS[i]
  return lerpHex(from, to, scaled - i)
}

// --- V-grades (string, with VB/V0 sub-grades) -------------------------------

interface VBand {
  grades: string[]
  from: string
  to: string
}
const V_BANDS: VBand[] = [
  { grades: ['VB-', 'VB', 'VB+'], from: '#4ade80', to: '#16a34a' }, // green
  { grades: ['V0-', 'V0', 'V0+'], from: '#facc15', to: '#ca8a04' }, // yellow
  { grades: ['V1', 'V2', 'V3', 'V4'], from: '#fb923c', to: '#c2410c' }, // orange
  { grades: ['V5', 'V6', 'V7', 'V8', 'V9', 'V10'], from: '#f87171', to: '#991b1b' }, // red
  { grades: ['V11', 'V12', 'V13', 'V14', 'V15', 'V16', 'V17'], from: '#e879f9', to: '#86198f' }, // magenta
]

export function vGradeToColor(grade: string): string {
  for (const band of V_BANDS) {
    const i = band.grades.indexOf(grade)
    if (i !== -1) {
      const t = band.grades.length === 1 ? 0 : i / (band.grades.length - 1)
      return lerpHex(band.from, band.to, t)
    }
  }
  return '#9ca3af' // unknown grade → neutral grey
}
