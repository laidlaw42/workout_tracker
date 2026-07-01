// Tags are plain strings, lowercased and deduplicated (order preserved).
export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of tags) {
    const v = t.trim().toLowerCase()
    if (v && !seen.has(v)) {
      seen.add(v)
      out.push(v)
    }
  }
  return out
}
