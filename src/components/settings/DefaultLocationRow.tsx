import { useReducer, useState } from 'react'
import {
  clearDefaultLocation,
  getDefaultLocation,
  getSavedLocations,
  setDefaultLocation,
  type DefaultLocationType,
} from '@/lib/prefs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// One default-location row (A51): shows the saved default gym/board, with Change
// (set a new one) and Remove default (revert to always prompting).
export function DefaultLocationRow({
  type,
  label,
}: {
  type: DefaultLocationType
  label: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [, bump] = useReducer((n: number) => n + 1, 0)
  // Read on every render so a parent re-render (e.g. after a gym rename/delete
  // that touches the default) reflects the current value without going stale.
  const value = getDefaultLocation(type)
  const saved = getSavedLocations(type)

  function save() {
    setDefaultLocation(type, draft)
    setEditing(false)
    bump()
  }
  function remove() {
    clearDefaultLocation(type)
    setEditing(false)
    bump()
  }

  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          <p className="truncate text-xs text-muted-foreground">
            {value || 'Not set — you’ll be asked each time'}
          </p>
        </div>
        {!editing && (
          <div className="flex shrink-0 gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setDraft(value)
                setEditing(true)
              }}
            >
              {value ? 'Change' : 'Set default'}
            </Button>
            {value && (
              <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={remove}>
                Remove default
              </Button>
            )}
          </div>
        )}
      </div>
      {editing && (
        <div className="space-y-2">
          {saved.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {saved.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setDraft(s)}
                  className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-foreground transition-colors active:bg-accent"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <Input
            value={draft}
            placeholder={`Default ${type} name`}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={!draft.trim()}>
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
