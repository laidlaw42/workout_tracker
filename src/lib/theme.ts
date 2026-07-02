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

/** Whether a stored theme id is still a valid, known theme. */
export function isValidTheme(id: string | null | undefined): boolean {
  return !!id && THEMES.some((t) => t.id === id)
}

/** Theme ids whose `.dark` class should be toggled on. Kept in sync with the
 *  pre-paint list in index.html. */
export const DARK_THEME_IDS = THEMES.filter((t) => t.dark).map((t) => t.id)

const DEFAULT_THEME = 'dark'
const KEY = 'theme'

function isDark(id: string): boolean {
  return THEMES.find((t) => t.id === id)?.dark ?? true
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
