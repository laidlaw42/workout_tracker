const KEY = 'bodyweight'

// User bodyweight in kg (A38). Null when unset. Drives the % of bodyweight shown
// on active-session weight inputs (A39). kg-only — no units toggle exists yet.
export function getBodyweight(): number | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw == null || raw.trim() === '') return null
    const v = Number(raw)
    return Number.isFinite(v) && v > 0 ? v : null
  } catch {
    return null
  }
}

export function setBodyweight(kg: number | null): void {
  try {
    if (kg != null && Number.isFinite(kg) && kg > 0) localStorage.setItem(KEY, String(kg))
    else localStorage.removeItem(KEY)
  } catch {
    /* ignore storage errors */
  }
}

// Weight label for a logged (or in-progress) set, shared by the session card,
// the strength history table, and the mixed-session detail. A bodyweight move
// carrying an external load reads relative to bodyweight — added ("BW +10 kg")
// or assisted with a band/machine/foot ("BW -20 kg", A99); a plain barbell move
// reads as its bar weight ("60 kg"); an unloaded set reads "BW".
export function setWeightLabel(s: { weightKg?: number; additionalWeightKg?: number }): string {
  if (s.additionalWeightKg != null && s.additionalWeightKg !== 0) {
    return `BW ${s.additionalWeightKg > 0 ? '+' : ''}${s.additionalWeightKg} kg`
  }
  return s.weightKg != null ? `${s.weightKg} kg` : 'BW'
}

// Net effort as a % of bodyweight for a bodyweight movement (pull-up, hang, …)
// carrying `loadKg` of added (+) or assisted (−) load (A39/A99). Null when no
// bodyweight is set, or when assistance meets/exceeds bodyweight (non-physical).
// A plain-bodyweight effort (0 load) reads 100%. Shared by the strength set row
// and the hangboard weight editors so both surface the same live figure.
export function bodyweightLoadPct(loadKg: number): number | null {
  const bw = getBodyweight()
  if (bw == null || !Number.isFinite(loadKg)) return null
  const net = bw + loadKg
  return net > 0 ? Math.round((net / bw) * 100) : null
}
