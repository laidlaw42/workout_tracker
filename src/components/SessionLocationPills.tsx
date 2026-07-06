import { useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { getSavedLocations, rememberLocation, setDefaultLocation } from '@/lib/prefs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface Props {
  venue: 'gym' | 'crag' | 'board'
  /** Current session location name ('' if none chosen). */
  value: string
  /** Persist the chosen location name ('' clears it). */
  onChange: (name: string) => void
}

// A78 — pick a gym/board/crag for the active session from a scrollable row of
// saved names, or add a new one inline (gym/board can also set it as default).
// Selection is optional; tapping the selected pill clears it.
export function SessionLocationPills({ venue, value, onChange }: Props) {
  const [saved, setSaved] = useState<string[]>(() => getSavedLocations(venue))
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')

  const selected = value.trim()
  const draftName = draft.trim()
  const canDefault = venue === 'gym' || venue === 'board'
  const label = venue === 'board' ? 'board' : venue
  const inSaved = (n: string) => saved.some((s) => s.toLowerCase() === n.toLowerCase())

  function pick(name: string) {
    // Tapping the already-selected pill clears it (the name is optional).
    onChange(selected.toLowerCase() === name.toLowerCase() ? '' : name)
  }

  function closeAdd() {
    setAdding(false)
    setDraft('')
  }

  function commit(remember: boolean, asDefault: boolean) {
    const n = draftName
    if (!n) return
    if (remember) {
      rememberLocation(venue, n)
      setSaved(getSavedLocations(venue))
    }
    if (asDefault && canDefault) setDefaultLocation(venue, n)
    onChange(n)
    closeAdd()
  }

  return (
    <div className="space-y-2">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {saved.map((s) => {
          const on = selected.toLowerCase() === s.toLowerCase()
          return (
            <button
              key={s}
              type="button"
              onClick={() => pick(s)}
              className={cn(
                'flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset transition-colors',
                on
                  ? 'bg-primary text-primary-foreground ring-primary'
                  : 'bg-muted text-muted-foreground ring-transparent active:bg-accent',
              )}
            >
              {on && <Check className="size-3.5" />}
              {s}
            </button>
          )
        })}

        {/* A "just this once" name that isn't in the saved list still reads as selected. */}
        {selected && !inSaved(selected) && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-1 text-sm font-medium text-primary-foreground ring-1 ring-inset ring-primary">
            <Check className="size-3.5" />
            {selected}
          </span>
        )}

        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className={cn(
            'flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset transition-colors',
            adding
              ? 'bg-accent text-foreground ring-border'
              : 'bg-muted text-muted-foreground ring-transparent active:bg-accent',
          )}
        >
          <Plus className="size-3.5" /> Other
        </button>
      </div>

      {adding && (
        <div className="space-y-2 rounded-xl border border-border bg-card p-3">
          <Input
            value={draft}
            placeholder={`New ${label} name`}
            onChange={(e) => setDraft(e.target.value)}
          />
          {draftName !== '' &&
            (inSaved(draftName) ? (
              <Button className="w-full" onClick={() => commit(false, false)}>
                Select “{draftName}”
              </Button>
            ) : canDefault ? (
              <div className="grid gap-2">
                <Button className="w-full" onClick={() => commit(true, true)}>
                  Add &amp; set as default
                </Button>
                <Button variant="outline" className="w-full" onClick={() => commit(true, false)}>
                  Add without setting default
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => commit(false, false)}>
                  Just this once
                </Button>
              </div>
            ) : (
              <div className="grid gap-2">
                <Button className="w-full" onClick={() => commit(true, false)}>
                  Add to list
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => commit(false, false)}>
                  Just this once
                </Button>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
