// Fixed gym tape-colour palette (A26). Values are stored lowercase in
// ClimbingRoute.colour. Each has a `swatch` (CSS background for the picker dot);
// single hues also set `solid` (a hex) so RouteCard can render a coloured pill —
// Mixed / Wood / Feature stay neutral.
export interface RouteColour {
  value: string
  label: string
  swatch: string
  solid?: string
}

export const ROUTE_COLOURS: RouteColour[] = [
  { value: 'red', label: 'Red', swatch: '#ef4444', solid: '#ef4444' },
  { value: 'yellow', label: 'Yellow', swatch: '#eab308', solid: '#eab308' },
  { value: 'green', label: 'Green', swatch: '#22c55e', solid: '#22c55e' },
  { value: 'orange', label: 'Orange', swatch: '#f97316', solid: '#f97316' },
  { value: 'pink', label: 'Pink', swatch: '#ec4899', solid: '#ec4899' },
  { value: 'purple', label: 'Purple', swatch: '#a855f7', solid: '#a855f7' },
  { value: 'brown', label: 'Brown', swatch: '#92400e', solid: '#92400e' },
  { value: 'blue', label: 'Blue', swatch: '#3b82f6', solid: '#3b82f6' },
  { value: 'indigo', label: 'Indigo', swatch: '#6366f1', solid: '#6366f1' },
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

export function findRouteColour(value?: string): RouteColour | undefined {
  return value ? BY_VALUE.get(value.toLowerCase()) : undefined
}
