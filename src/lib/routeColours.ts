// Gym tape-colour palette (A26, extended in A43). Values are stored lowercase in
// ClimbingRoute.colour. Each has a `swatch` (CSS background for the picker dot);
// single hues also set `solid` (a hex) so RouteCard can render a coloured pill —
// Mixed / Wood / Feature stay neutral. Users can add their own colours (A43).
export interface RouteColour {
  value: string
  label: string
  swatch: string
  solid?: string
}

export interface CustomColour {
  name: string
  hex: string
}

// Ordered logically: neutrals (dark → light), then a warm → cool spectrum with
// each dark/pale variant sitting beside its base hue, and the gradient/neutral
// "specials" (Mixed / Wood / Feature) last.
export const ROUTE_COLOURS: RouteColour[] = [
  // Neutrals
  { value: 'black', label: 'Black', swatch: '#171717', solid: '#171717' },
  { value: 'grey', label: 'Grey', swatch: '#6b7280', solid: '#6b7280' },
  { value: 'white', label: 'White', swatch: '#f5f5f5', solid: '#f5f5f5' },
  { value: 'cream', label: 'Cream', swatch: '#f5eccb', solid: '#f5eccb' },
  // Reds
  { value: 'red', label: 'Red', swatch: '#ef4444', solid: '#ef4444' },
  { value: 'maroon', label: 'Maroon', swatch: '#7f1d1d', solid: '#7f1d1d' },
  // Oranges / browns
  { value: 'orange', label: 'Orange', swatch: '#f97316', solid: '#f97316' },
  { value: 'brown', label: 'Brown', swatch: '#92400e', solid: '#92400e' },
  // Yellows
  { value: 'yellow', label: 'Yellow', swatch: '#eab308', solid: '#eab308' },
  { value: 'pale_yellow', label: 'Pale yellow', swatch: '#fdf3a0', solid: '#fdf3a0' },
  // Greens
  { value: 'lime', label: 'Lime', swatch: '#84cc16', solid: '#84cc16' },
  { value: 'green', label: 'Green', swatch: '#22c55e', solid: '#22c55e' },
  { value: 'dark_green', label: 'Dark green', swatch: '#14532d', solid: '#14532d' },
  // Teals / cyans
  { value: 'teal', label: 'Teal', swatch: '#14b8a6', solid: '#14b8a6' },
  { value: 'cyan', label: 'Cyan', swatch: '#06b6d4', solid: '#06b6d4' },
  // Blues
  { value: 'blue', label: 'Blue', swatch: '#3b82f6', solid: '#3b82f6' },
  { value: 'navy', label: 'Navy', swatch: '#1e3a8a', solid: '#1e3a8a' },
  { value: 'indigo', label: 'Indigo', swatch: '#6366f1', solid: '#6366f1' },
  // Purples / pinks
  { value: 'purple', label: 'Purple', swatch: '#a855f7', solid: '#a855f7' },
  { value: 'pink', label: 'Pink', swatch: '#ec4899', solid: '#ec4899' },
  { value: 'pale_pink', label: 'Pale pink', swatch: '#fbcfe8', solid: '#fbcfe8' },
  // Specials (gradient / neutral placeholders)
  {
    value: 'mixed',
    label: 'Mixed',
    swatch: 'conic-gradient(#ef4444, #eab308, #22c55e, #3b82f6, #a855f7, #ef4444)',
  },
  {
    value: 'wood',
    label: 'Wood',
    swatch: 'repeating-linear-gradient(45deg, #b5895a, #b5895a 3px, #9c7248 3px, #9c7248 6px)',
  },
  { value: 'feature', label: 'Feature', swatch: '#9ca3af' },
]

const BY_VALUE = new Map(ROUTE_COLOURS.map((c) => [c.value, c]))

// --- User-defined custom colours (A43), stored in localStorage --------------

const CUSTOM_KEY = 'custom_route_colours'
let customCache: RouteColour[] | null = null

export function getCustomRouteColours(): CustomColour[] {
  try {
    const arr = JSON.parse(localStorage.getItem(CUSTOM_KEY) ?? '[]')
    return Array.isArray(arr)
      ? arr.filter((c) => c && typeof c.name === 'string' && typeof c.hex === 'string')
      : []
  } catch {
    return []
  }
}

function customAsRouteColours(): RouteColour[] {
  if (customCache) return customCache
  customCache = getCustomRouteColours().map((c) => ({
    value: c.name.toLowerCase(),
    label: c.name,
    swatch: c.hex,
    solid: c.hex,
  }))
  return customCache
}

function writeCustom(list: CustomColour[]): void {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(list))
  } catch {
    /* ignore */
  }
  customCache = null
}

// Built-in colours as RouteColour[], for the Settings list.
export const BUILTIN_ROUTE_COLOURS = ROUTE_COLOURS

// Custom colours resolved to RouteColour[], for the picker + Settings list.
export function customRouteColours(): RouteColour[] {
  return customAsRouteColours()
}

export function findRouteColour(value?: string): RouteColour | undefined {
  if (!value) return undefined
  const v = value.toLowerCase()
  return BY_VALUE.get(v) ?? customAsRouteColours().find((c) => c.value === v)
}

// Whether `name` (case-insensitive) already exists as a built-in or custom colour.
export function colourNameTaken(name: string): boolean {
  const n = name.trim().toLowerCase()
  if (!n) return false
  return (
    ROUTE_COLOURS.some((c) => c.value === n || c.label.toLowerCase() === n) ||
    getCustomRouteColours().some((c) => c.name.toLowerCase() === n)
  )
}

export function addCustomRouteColour(name: string, hex: string): void {
  const list = getCustomRouteColours()
  list.push({ name: name.trim(), hex })
  writeCustom(list)
}

export function removeCustomRouteColour(name: string): void {
  writeCustom(getCustomRouteColours().filter((c) => c.name.toLowerCase() !== name.trim().toLowerCase()))
}
