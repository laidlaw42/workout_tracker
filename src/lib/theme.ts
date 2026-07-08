export interface ThemeOption {
  id: string
  label: string
  dark: boolean
}

// Ordered as dark/light pairs so the two-column Settings grid renders every
// dark theme in the left column and its light counterpart on the right.
export const THEMES: ThemeOption[] = [
  { id: 'dark', label: 'Dark', dark: true },
  { id: 'light', label: 'Light', dark: false },
  { id: 'solarized-dark', label: 'Solarized Dark', dark: true },
  { id: 'solarized-light', label: 'Solarized Light', dark: false },
  { id: 'forest-dark', label: 'Forest Dark', dark: true },
  { id: 'forest-light', label: 'Forest Light', dark: false },
  { id: 'darcula', label: 'Darcula Dark', dark: true },
  { id: 'darcula-light', label: 'Darcula Light', dark: false },
  { id: 'nord', label: 'Nord Dark', dark: true },
  { id: 'nord-light', label: 'Nord Light', dark: false },
  { id: 'sunset-dark', label: 'Sunset Dark', dark: true },
  { id: 'sunset', label: 'Sunset Light', dark: false },
  { id: 'slate-dark', label: 'Slate Dark', dark: true },
  { id: 'slate', label: 'Slate Light', dark: false },
  { id: 'gruvbox-dark', label: 'Gruvbox Dark', dark: true },
  { id: 'gruvbox-light', label: 'Gruvbox Light', dark: false },
  { id: 'bubblegum-dark', label: 'Bubblegum Dark', dark: true },
  { id: 'bubblegum-light', label: 'Bubblegum Light', dark: false },
  { id: 'synthwave-dark', label: 'Synthwave Dark', dark: true },
  { id: 'synthwave-light', label: 'Synthwave Light', dark: false },
  { id: 'crimson-dark', label: 'Crimson Dark', dark: true },
  { id: 'crimson-light', label: 'Crimson Light', dark: false },
]

// Three preview colours per theme — [background, primary, accent] — mirrored
// from themes.css, for the swatch shown beside each option in the theme picker
// (A28). Kept in sync with the [data-theme] rules there.
export const THEME_PREVIEWS: Record<string, [string, string, string]> = {
  dark: ['oklch(0.129 0.042 264.695)', 'oklch(0.929 0.013 255.508)', 'oklch(0.279 0.041 260.031)'],
  light: ['oklch(1 0 0)', 'oklch(0.208 0.042 265.755)', 'oklch(0.968 0.007 247.896)'],
  'solarized-dark': ['#002b36', '#268bd2', '#0a4b5a'],
  'solarized-light': ['#fdf6e3', '#268bd2', '#e3ddc9'],
  'forest-dark': ['#0e1a12', '#4ade80', '#24422e'],
  'forest-light': ['#f3f7f2', '#16a34a', '#d6e5d9'],
  darcula: ['#2b2b2b', '#9876aa', '#4b4b4b'],
  'darcula-light': ['#f7f7f8', '#6c4f9c', '#e7dff3'],
  nord: ['#2e3440', '#88c0d0', '#4c566a'],
  'nord-light': ['#eceff4', '#5e81ac', '#d8dee9'],
  'sunset-dark': ['#1c1113', '#fb923c', '#4a2a33'],
  sunset: ['#fff7ed', '#f97316', '#fed7aa'],
  'slate-dark': ['#0f172a', '#94a3b8', '#334155'],
  slate: ['#f8fafc', '#475569', '#e2e8f0'],
  'gruvbox-dark': ['#282828', '#fe8019', '#504945'],
  'gruvbox-light': ['#fbf1c7', '#d65d0e', '#ecdcb0'],
  'bubblegum-dark': ['#1a0f16', '#ec4899', '#4a2438'],
  'bubblegum-light': ['#fdf2f8', '#db2777', '#fbcfe8'],
  'synthwave-dark': ['#1b1036', '#ff5fd0', '#3c2280'],
  'synthwave-light': ['#fdf0ff', '#c026d3', '#efc9f7'],
  'crimson-dark': ['#1a0f11', '#ef4444', '#4a262b'],
  'crimson-light': ['#fef2f2', '#dc2626', '#fecaca'],
}

/** Theme ids whose `.dark` class should be toggled on. Kept in sync with the
 *  pre-paint list in index.html. */
export const DARK_THEME_IDS = THEMES.filter((t) => t.dark).map((t) => t.id)

const DEFAULT_THEME = 'dark'
const KEY = 'theme'

function isDark(id: string): boolean {
  // Known light themes are the only non-dark case; an unknown id falls back to
  // dark (the default theme), matching getTheme(). Reads DARK_THEME_IDS so that
  // export stays live and single-sourced with the index.html pre-paint list.
  return DARK_THEME_IDS.includes(id) || !THEMES.some((t) => t.id === id)
}

export function getTheme(): string {
  try {
    const stored = localStorage.getItem(KEY)
    if (stored && THEMES.some((t) => t.id === stored)) return stored
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME
}

export function applyTheme(id: string): void {
  const root = document.documentElement
  root.dataset.theme = id
  root.classList.toggle('dark', isDark(id))
  try {
    localStorage.setItem(KEY, id)
  } catch {
    /* ignore */
  }
}
