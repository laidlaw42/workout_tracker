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

// --- Ewbanks (numeric) ------------------------------------------------------

interface NumBand {
  min: number
  max: number
  from: string
  to: string
}
const EWBANKS_BANDS: NumBand[] = [
  { min: 1, max: 10, from: '#4ade80', to: '#16a34a' }, // green
  { min: 11, max: 17, from: '#facc15', to: '#fb923c' }, // yellow → orange
  { min: 18, max: 24, from: '#f97316', to: '#dc2626' }, // orange → red
  { min: 25, max: 30, from: '#dc2626', to: '#7f1d1d' }, // red → deep red
  { min: 31, max: 35, from: '#e879f9', to: '#86198f' }, // magenta
]

export function gradeToColor(grade: number, _system: 'ewbanks' = 'ewbanks'): string {
  const g = Math.max(1, Math.min(35, Math.round(grade)))
  const band = EWBANKS_BANDS.find((b) => g >= b.min && g <= b.max) ?? EWBANKS_BANDS[EWBANKS_BANDS.length - 1]
  const t = band.max === band.min ? 0 : (g - band.min) / (band.max - band.min)
  return lerpHex(band.from, band.to, t)
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
