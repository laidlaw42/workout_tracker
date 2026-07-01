export interface ThemeOption {
  id: string
  label: string
  dark: boolean
}

export const THEMES: ThemeOption[] = [
  { id: 'dark', label: 'Dark', dark: true },
  { id: 'light', label: 'Light', dark: false },
  { id: 'solarized-dark', label: 'Solarized Dark', dark: true },
  { id: 'solarized-light', label: 'Solarized Light', dark: false },
  { id: 'forest-dark', label: 'Forest Dark', dark: true },
  { id: 'forest-light', label: 'Forest Light', dark: false },
  { id: 'darcula', label: 'Darcula', dark: true },
  { id: 'nord', label: 'Nord', dark: true },
  { id: 'sunset', label: 'Sunset', dark: false },
  { id: 'slate', label: 'Slate', dark: false },
]

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
