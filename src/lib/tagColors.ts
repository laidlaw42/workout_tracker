// Fixed 12-colour palette for tag chips (A35). New tags are assigned the next
// colour in order (cycling), so a fresh set of tags is visually distinct. Hex
// values are theme-agnostic — tag chips render them via inline style, matching
// the route-colour / theme-swatch pattern already used in the app.
export const TAG_PALETTE: string[] = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // amber
  '#84cc16', // lime
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#a855f7', // purple
  '#ec4899', // pink
  '#78716c', // stone
]

// The colour a tag created at position `order` receives (cycles through the palette).
export function paletteColourForOrder(order: number): string {
  return TAG_PALETTE[((order % TAG_PALETTE.length) + TAG_PALETTE.length) % TAG_PALETTE.length]
}

// Fallback tint for a tag with no stored metadata yet.
export const TAG_FALLBACK_COLOUR = '#78716c'
