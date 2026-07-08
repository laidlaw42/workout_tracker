// Pure scale + tick helpers for the hand-rolled SVG charts (D2), which replace
// recharts on the Progress screen. Dependency-free and unit-tested — the chart
// components render straight from these, so the tricky maths lives in one place.

// "Nice" axis bounds + ticks spanning [dataMin, dataMax] (Heckbert's algorithm).
// Deliberately does NOT force zero: the line charts zoom to the data range so a
// trend stays visible (matching recharts' default line behaviour). A flat series
// (min === max) is padded so it renders as a centred line, not a divide-by-zero.
export function niceTicks(
  dataMin: number,
  dataMax: number,
  maxTicks = 5,
): { min: number; max: number; ticks: number[] } {
  if (!Number.isFinite(dataMin) || !Number.isFinite(dataMax)) {
    return { min: 0, max: 1, ticks: [0, 1] }
  }
  if (dataMin > dataMax) [dataMin, dataMax] = [dataMax, dataMin]
  if (dataMin === dataMax) {
    const pad = dataMin === 0 ? 1 : Math.abs(dataMin) * 0.5
    dataMin -= pad
    dataMax += pad
  }
  const niceNum = (range: number, round: boolean) => {
    const exp = Math.floor(Math.log10(range))
    const f = range / 10 ** exp
    let nf: number
    if (round) nf = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10
    else nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10
    return nf * 10 ** exp
  }
  const span = niceNum(dataMax - dataMin, false)
  const step = niceNum(span / Math.max(1, maxTicks - 1), true)
  const min = Math.floor(dataMin / step) * step
  const max = Math.ceil(dataMax / step) * step
  // Round each tick to the step's precision so floating-point accumulation
  // ("0.30000000000000004") never leaks into a label.
  const decimals = Math.max(0, -Math.floor(Math.log10(step)))
  const ticks: number[] = []
  for (let v = min; v <= max + step / 2; v += step) {
    ticks.push(Number(v.toFixed(decimals + 2)))
  }
  return { min, max, ticks }
}

// Integer ticks from 0..max for bar counts — bars always baseline at zero. Small
// counts (≤ maxTicks) get one tick per integer; larger ranges are "niced" and
// filtered to whole numbers.
export function intTicks(dataMax: number, maxTicks = 5): { max: number; ticks: number[] } {
  const m = Math.max(1, Math.ceil(dataMax))
  if (m <= maxTicks) {
    return { max: m, ticks: Array.from({ length: m + 1 }, (_, i) => i) }
  }
  const { max, ticks } = niceTicks(0, m, maxTicks)
  return { max, ticks: ticks.filter((t) => Number.isInteger(t)) }
}

// Which category-label indices to show so labels don't overlap: always the first
// and last, then evenly-spaced interior labels, up to `maxLabels` total.
export function thinLabels(count: number, maxLabels: number): number[] {
  if (count <= 0) return []
  if (count === 1) return [0]
  const max = Math.max(2, Math.min(maxLabels, count))
  if (count <= max) return Array.from({ length: count }, (_, i) => i)
  const idx = new Set<number>()
  for (let i = 0; i < max; i++) {
    idx.add(Math.round((i * (count - 1)) / (max - 1)))
  }
  return [...idx].sort((a, b) => a - b)
}
