const KEY = 'user_name'

export function getUserName(): string {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

export function setUserName(name: string): void {
  try {
    const trimmed = name.trim()
    if (trimmed) localStorage.setItem(KEY, trimmed)
    else localStorage.removeItem(KEY)
  } catch {
    /* ignore storage errors */
  }
}
