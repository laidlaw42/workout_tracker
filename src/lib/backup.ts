// Backup + restore.
//
// A backup is the exact JSON produced by exportAllData() (a full snapshot of all
// Dexie tables) — identical to "Export data" in Settings. "Back up now" shares that
// JSON via the OS share sheet (Save to Files / iCloud Drive / anywhere), falling
// back to a plain download when sharing files isn't supported. Restoring is a file
// import (Settings → Import data / Import and merge).

import { exportAllData } from '@/db/helpers'

// --- Filename ------------------------------------------------------------------

function pad(n: number): string {
  return String(n).padStart(2, '0')
}
export function backupFilename(now = new Date()): string {
  const d = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const t = `${pad(now.getHours())}${pad(now.getMinutes())}`
  return `workout-tracker-backup-${d}-${t}.json`
}

// --- Web Share / download ------------------------------------------------------

function jsonFile(json: string, filename: string): File {
  return new File([json], filename, { type: 'application/json' })
}

export function canShareFiles(): boolean {
  try {
    return (
      typeof navigator !== 'undefined' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [jsonFile('{}', 'probe.json')] })
    )
  } catch {
    return false
  }
}

export function downloadBackup(json: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// Share the file via the OS share sheet; falls back to download when files can't be
// shared. Returns 'shared' | 'downloaded'. A user cancel of the share sheet throws
// AbortError, which the caller treats as a non-error.
async function shareBackup(json: string, filename: string): Promise<'shared' | 'downloaded'> {
  if (canShareFiles()) {
    await navigator.share({ files: [jsonFile(json, filename)], title: filename })
    return 'shared'
  }
  downloadBackup(json, filename)
  return 'downloaded'
}

// --- Run a backup --------------------------------------------------------------

export interface BackupResult {
  destination: 'Files' | 'Download'
  ok: boolean
  detail?: string
}

// Share a fresh snapshot (identical JSON to "Export data") via the share sheet,
// with a download fallback. Returns how it went, or null if the user cancelled the
// share sheet. Must be called from a user gesture — the share sheet needs one.
export async function runBackup(): Promise<BackupResult | null> {
  const json = await exportAllData()
  const filename = backupFilename()
  try {
    const how = await shareBackup(json, filename)
    return { destination: how === 'shared' ? 'Files' : 'Download', ok: true }
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return null // user cancelled the share sheet
    return { destination: 'Download', ok: false, detail: (e as Error).message }
  }
}
