// A89 — cloud backup + restore.
//
// A backup is the exact JSON produced by exportAllData() (a full snapshot of all
// Dexie tables). It can be sent to any combination of connected destinations:
//
//   - Web Share ("Save to Files / Other"): navigator.share() with the JSON file,
//     letting the OS share sheet save it to iCloud Drive, Proton Drive, Files, or
//     any installed app. The most reliable PWA route on iOS.
//   - Download: a plain file download — the always-available fallback (A89 keeps
//     the existing download behaviour when no cloud provider is connected).
//   - Google Drive / Dropbox / OneDrive: OAuth 2.0 (PKCE) to an app-scoped
//     folder. These need the app's own OAuth client IDs (see BACKUP_CLIENT_IDS);
//     without them the provider reports "not configured".
//
// Trigger modes (independent toggles): after every session, a daily schedule, and
// manual "Back up now". Errors are surfaced (never swallowed) with a retry hook.

import { exportAllData } from '@/db/helpers'

export type OAuthProviderId = 'gdrive' | 'dropbox' | 'onedrive'
export type ProviderId = OAuthProviderId | 'share'

export interface ProviderMeta {
  id: ProviderId
  label: string
  oauth: boolean
}

// "share" covers iCloud, Proton Drive and everything else reachable via the OS
// share sheet / Files picker (A89 groups them as "Save to Files / Other").
export const PROVIDERS: ProviderMeta[] = [
  { id: 'gdrive', label: 'Google Drive', oauth: true },
  { id: 'dropbox', label: 'Dropbox', oauth: true },
  { id: 'onedrive', label: 'OneDrive', oauth: true },
  { id: 'share', label: 'Save to Files / Other', oauth: false },
]

export function providerLabel(id: ProviderId): string {
  return PROVIDERS.find((p) => p.id === id)?.label ?? id
}

// --- Config: the app's OAuth client IDs (registered by the app owner) ----------
// Supplied at build time via Vite env vars; a runtime override in localStorage
// lets the owner paste them without a rebuild. Empty → provider not configured.
const ENV = import.meta.env as unknown as Record<string, string | undefined>
export const BACKUP_CLIENT_IDS: Record<OAuthProviderId, string> = {
  gdrive: ENV.VITE_GDRIVE_CLIENT_ID ?? '',
  dropbox: ENV.VITE_DROPBOX_CLIENT_ID ?? '',
  onedrive: ENV.VITE_ONEDRIVE_CLIENT_ID ?? '',
}

function clientId(id: OAuthProviderId): string {
  try {
    const override = JSON.parse(localStorage.getItem('backup_client_ids') ?? '{}')
    if (override && typeof override[id] === 'string' && override[id]) return override[id]
  } catch {
    /* ignore */
  }
  return BACKUP_CLIENT_IDS[id]
}

export function isProviderConfigured(id: ProviderId): boolean {
  if (id === 'share') return typeof navigator !== 'undefined'
  return clientId(id) !== ''
}

// --- Trigger + schedule settings (localStorage) --------------------------------

const K = {
  afterSession: 'backup_after_session',
  scheduled: 'backup_scheduled',
  scheduleTime: 'backup_schedule_time', // 'HH:mm'
  lastRun: 'backup_last_run', // ISO string
  token: (id: OAuthProviderId) => `backup_oauth_${id}`,
} as const

function getFlag(key: string): boolean {
  return localStorage.getItem(key) === '1'
}
function setFlag(key: string, on: boolean): void {
  localStorage.setItem(key, on ? '1' : '0')
}

export const backupAfterSession = {
  get: () => getFlag(K.afterSession),
  set: (on: boolean) => setFlag(K.afterSession, on),
}
export const backupScheduled = {
  get: () => getFlag(K.scheduled),
  set: (on: boolean) => setFlag(K.scheduled, on),
}
export function getScheduleTime(): string {
  return localStorage.getItem(K.scheduleTime) || '20:00'
}
export function setScheduleTime(hhmm: string): void {
  localStorage.setItem(K.scheduleTime, hhmm)
}
export function getLastRun(): Date | null {
  const v = localStorage.getItem(K.lastRun)
  const t = v ? Date.parse(v) : NaN
  return Number.isNaN(t) ? null : new Date(t)
}
function markRun(now: Date): void {
  localStorage.setItem(K.lastRun, now.toISOString())
}

// --- OAuth token store ---------------------------------------------------------

interface TokenSet {
  accessToken: string
  refreshToken?: string
  expiresAt: number // epoch ms
  account?: string
}

function getTokens(id: OAuthProviderId): TokenSet | null {
  try {
    const v = JSON.parse(localStorage.getItem(K.token(id)) ?? 'null')
    return v && typeof v.accessToken === 'string' ? (v as TokenSet) : null
  } catch {
    return null
  }
}
function setTokens(id: OAuthProviderId, t: TokenSet | null): void {
  if (t) localStorage.setItem(K.token(id), JSON.stringify(t))
  else localStorage.removeItem(K.token(id))
}

export function isConnected(id: ProviderId): boolean {
  if (id === 'share') return false // share is a fallback, not a persistent connection
  return getTokens(id) != null
}
export function connectedAccount(id: OAuthProviderId): string | undefined {
  return getTokens(id)?.account
}
export function connectedOAuthProviders(): OAuthProviderId[] {
  return PROVIDERS.filter((p) => p.oauth && isConnected(p.id)).map((p) => p.id as OAuthProviderId)
}
export function disconnect(id: OAuthProviderId): void {
  setTokens(id, null)
}

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

// Share the file via the OS share sheet; falls back to download when files can't
// be shared. Returns 'shared' | 'downloaded'. A user cancel of the share sheet
// throws AbortError, which callers treat as a non-error.
async function shareBackup(json: string, filename: string): Promise<'shared' | 'downloaded'> {
  if (canShareFiles()) {
    await navigator.share({ files: [jsonFile(json, filename)], title: filename })
    return 'shared'
  }
  downloadBackup(json, filename)
  return 'downloaded'
}

// --- OAuth (PKCE) --------------------------------------------------------------
// Provider-specific endpoints + upload. Kept behind isProviderConfigured() so the
// UI degrades gracefully when the app owner hasn't supplied client IDs.

interface OAuthConfig {
  authUrl: string
  tokenUrl: string
  scope: string
  // Upload the JSON to the provider's app folder; returns nothing on success.
  upload: (token: string, json: string, filename: string) => Promise<void>
  // List prior backups newest-first: { id, name, modified }.
  list: (token: string) => Promise<{ id: string; name: string; modified: number }[]>
  // Fetch a backup's JSON contents by id.
  download: (token: string, fileId: string) => Promise<string>
  // Read the connected account label from the provider.
  account: (token: string) => Promise<string | undefined>
}

const redirectUri = () =>
  typeof window !== 'undefined' ? `${window.location.origin}${import.meta.env.BASE_URL}` : ''

const OAUTH: Record<OAuthProviderId, OAuthConfig> = {
  // Google Drive — app-scoped hidden folder (drive.appdata), no access to the
  // user's other files.
  gdrive: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/drive.appdata',
    async upload(token, json, filename) {
      const meta = { name: filename, parents: ['appDataFolder'] }
      const boundary = 'wt' + Math.random().toString(36).slice(2)
      const body =
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
        `${JSON.stringify(meta)}\r\n--${boundary}\r\n` +
        `Content-Type: application/json\r\n\r\n${json}\r\n--${boundary}--`
      const res = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body,
        },
      )
      if (!res.ok) throw new Error(`Google Drive upload failed (${res.status})`)
    },
    async list(token) {
      const res = await fetch(
        'https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime)&pageSize=50',
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (!res.ok) throw new Error(`Google Drive list failed (${res.status})`)
      const data = await res.json()
      return (data.files ?? []).map((f: { id: string; name: string; modifiedTime: string }) => ({
        id: f.id,
        name: f.name,
        modified: Date.parse(f.modifiedTime),
      }))
    },
    async download(token, fileId) {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`Google Drive download failed (${res.status})`)
      return res.text()
    },
    async account(token) {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` },
      })
      return res.ok ? (await res.json()).email : undefined
    },
  },
  // Dropbox — app folder (scoped app).
  dropbox: {
    authUrl: 'https://www.dropbox.com/oauth2/authorize',
    tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
    scope: 'files.content.write files.content.read account_info.read',
    async upload(token, json, filename) {
      const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/octet-stream',
          'Dropbox-API-Arg': JSON.stringify({ path: `/${filename}`, mode: 'add', autorename: true }),
        },
        body: json,
      })
      if (!res.ok) throw new Error(`Dropbox upload failed (${res.status})`)
    },
    async list(token) {
      const res = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '' }),
      })
      if (!res.ok) throw new Error(`Dropbox list failed (${res.status})`)
      const data = await res.json()
      return (data.entries ?? [])
        .filter((e: { '.tag': string; name: string }) => e['.tag'] === 'file' && e.name.endsWith('.json'))
        .map((e: { id: string; name: string; server_modified: string }) => ({
          id: e.id,
          name: e.name,
          modified: Date.parse(e.server_modified),
        }))
        .sort((a: { modified: number }, b: { modified: number }) => b.modified - a.modified)
    },
    async download(token, fileId) {
      const res = await fetch('https://content.dropboxapi.com/2/files/download', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Dropbox-API-Arg': JSON.stringify({ path: fileId }) },
      })
      if (!res.ok) throw new Error(`Dropbox download failed (${res.status})`)
      return res.text()
    },
    async account(token) {
      const res = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      return res.ok ? (await res.json()).email : undefined
    },
  },
  // OneDrive — Microsoft Graph app folder.
  onedrive: {
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scope: 'Files.ReadWrite.AppFolder User.Read offline_access',
    async upload(token, json, filename) {
      const res = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${encodeURIComponent(filename)}:/content`,
        { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: json },
      )
      if (!res.ok) throw new Error(`OneDrive upload failed (${res.status})`)
    },
    async list(token) {
      const res = await fetch(
        'https://graph.microsoft.com/v1.0/me/drive/special/approot/children?$orderby=lastModifiedDateTime desc&$top=50',
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (!res.ok) throw new Error(`OneDrive list failed (${res.status})`)
      const data = await res.json()
      return (data.value ?? [])
        .filter((f: { name: string }) => f.name.endsWith('.json'))
        .map((f: { id: string; name: string; lastModifiedDateTime: string }) => ({
          id: f.id,
          name: f.name,
          modified: Date.parse(f.lastModifiedDateTime),
        }))
    },
    async download(token, fileId) {
      const res = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`OneDrive download failed (${res.status})`)
      return res.text()
    },
    async account(token) {
      const res = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
      return res.ok ? (await res.json()).userPrincipalName : undefined
    },
  },
}

// PKCE helpers.
function randomString(len = 64): string {
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => ('0' + (b & 0xff).toString(16)).slice(-2)).join('')
}
async function sha256Base64Url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  let str = ''
  for (const b of new Uint8Array(digest)) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Start the OAuth authorize redirect. Stashes the PKCE verifier + which provider
// we're connecting so the redirect handler can complete the exchange.
export async function beginConnect(id: OAuthProviderId): Promise<void> {
  const cid = clientId(id)
  if (!cid) throw new Error(`${providerLabel(id)} isn't configured (missing OAuth client ID).`)
  const cfg = OAUTH[id]
  const verifier = randomString()
  const challenge = await sha256Base64Url(verifier)
  sessionStorage.setItem('backup_pkce', JSON.stringify({ id, verifier }))
  const params = new URLSearchParams({
    client_id: cid,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: cfg.scope,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent',
  })
  window.location.href = `${cfg.authUrl}?${params.toString()}`
}

// On app load, complete an OAuth redirect if `?code=…` is present. Returns the
// connected provider id (for a success toast) or null.
export async function completeConnectFromRedirect(): Promise<OAuthProviderId | null> {
  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')
  const stashed = sessionStorage.getItem('backup_pkce')
  if (!code || !stashed) return null
  sessionStorage.removeItem('backup_pkce')
  // Clean the code out of the URL regardless of outcome.
  url.searchParams.delete('code')
  url.searchParams.delete('scope')
  url.searchParams.delete('state')
  window.history.replaceState({}, '', url.toString())
  const { id, verifier } = JSON.parse(stashed) as { id: OAuthProviderId; verifier: string }
  const cfg = OAUTH[id]
  const res = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId(id),
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      code_verifier: verifier,
    }),
  })
  if (!res.ok) throw new Error(`${providerLabel(id)} sign-in failed (${res.status}).`)
  const data = await res.json()
  const token: TokenSet = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  }
  try {
    token.account = await cfg.account(token.accessToken)
  } catch {
    /* account label is best-effort */
  }
  setTokens(id, token)
  return id
}

// Return a valid access token, refreshing silently if it's expired. Throws if it
// can't be refreshed (caller prompts the user to reconnect).
async function validToken(id: OAuthProviderId): Promise<string> {
  const t = getTokens(id)
  if (!t) throw new Error(`${providerLabel(id)} isn't connected.`)
  if (t.expiresAt - 60_000 > Date.now()) return t.accessToken
  if (!t.refreshToken) throw new Error(`${providerLabel(id)} session expired — reconnect it.`)
  const res = await fetch(OAUTH[id].tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId(id),
      grant_type: 'refresh_token',
      refresh_token: t.refreshToken,
    }),
  })
  if (!res.ok) throw new Error(`${providerLabel(id)} session expired — reconnect it.`)
  const data = await res.json()
  const next: TokenSet = {
    ...t,
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? t.refreshToken,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  }
  setTokens(id, next)
  return next.accessToken
}

export async function listCloudBackups(id: OAuthProviderId) {
  return OAUTH[id].list(await validToken(id))
}
export async function fetchCloudBackup(id: OAuthProviderId, fileId: string): Promise<string> {
  return OAUTH[id].download(await validToken(id), fileId)
}

// --- Run a backup --------------------------------------------------------------

export interface BackupResult {
  destination: string
  ok: boolean
  detail?: string
}

// Send a fresh snapshot to every connected cloud provider; if none is connected,
// fall back to the share sheet / download. `interactive` allows the share sheet
// (a user gesture); background triggers (after-session) pass false and download
// silently instead of popping the share sheet.
export async function runBackup(interactive: boolean): Promise<BackupResult[]> {
  const json = await exportAllData()
  const filename = backupFilename()
  const connected = connectedOAuthProviders()
  const results: BackupResult[] = []

  if (connected.length === 0) {
    try {
      if (interactive) {
        const how = await shareBackup(json, filename)
        results.push({ destination: how === 'shared' ? 'Files' : 'Download', ok: true })
      } else {
        downloadBackup(json, filename)
        results.push({ destination: 'Download', ok: true })
      }
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return results // user cancelled the share sheet
      results.push({ destination: 'Download', ok: false, detail: (e as Error).message })
    }
  } else {
    for (const id of connected) {
      try {
        await OAUTH[id].upload(await validToken(id), json, filename)
        results.push({ destination: providerLabel(id), ok: true })
      } catch (e) {
        results.push({ destination: providerLabel(id), ok: false, detail: (e as Error).message })
      }
    }
  }

  if (results.some((r) => r.ok)) markRun(new Date())
  return results
}

// --- Scheduling ----------------------------------------------------------------

let scheduleTimer: ReturnType<typeof setTimeout> | undefined

function nextRunDelayMs(now: Date): number {
  const [h, m] = getScheduleTime().split(':').map(Number)
  const next = new Date(now)
  next.setHours(h || 0, m || 0, 0, 0)
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1)
  return next.getTime() - now.getTime()
}

function ranToday(now: Date): boolean {
  const last = getLastRun()
  return (
    last != null &&
    last.getFullYear() === now.getFullYear() &&
    last.getMonth() === now.getMonth() &&
    last.getDate() === now.getDate()
  )
}

// Arrange the daily backup timer + run an overdue one immediately. Safe to call
// on every app open; it clears any prior timer first. Returns a cleanup fn.
export function initScheduledBackups(): () => void {
  if (scheduleTimer) clearTimeout(scheduleTimer)
  if (!backupScheduled.get()) return () => {}

  const now = new Date()
  const [h, m] = getScheduleTime().split(':').map(Number)
  const dueToday = new Date(now)
  dueToday.setHours(h || 0, m || 0, 0, 0)
  // Overdue: the scheduled time has already passed today and we haven't backed up.
  if (now.getTime() >= dueToday.getTime() && !ranToday(now)) {
    void runBackup(false)
  }

  const tick = () => {
    void runBackup(false)
    scheduleTimer = setTimeout(tick, 24 * 60 * 60 * 1000)
  }
  scheduleTimer = setTimeout(tick, nextRunDelayMs(now))
  return () => {
    if (scheduleTimer) clearTimeout(scheduleTimer)
  }
}

// Fire an after-session backup in the background (A89). No-op unless the toggle
// is on. Never throws — a failed background backup surfaces via runBackup's toast
// at the call site if the caller chooses to await/report it.
export async function backupAfterSessionIfEnabled(): Promise<BackupResult[] | null> {
  if (!backupAfterSession.get()) return null
  return runBackup(false)
}
