import { useEffect, useRef, useState } from 'react'
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

// A78/A85 — pick a gym/board/crag for the active session from a scrollable row of
// saved names, or type a new one. The "New <venue> name" input is open by default
// when no name is set yet (gym/board without a default, and every crag), so the
// user is prompted to name it without tapping first. No autofocus (F12) — the
// input is visible but focus needs an explicit tap.
export function SessionLocationPills({ venue, value, onChange }: Props) {
  const [saved, setSaved] = useState<string[]>(() => getSavedLocations(venue))
  const [adding, setAdding] = useState(() => value.trim() === '')
  const [draft, setDraft] = useState('')
  // A user who explicitly opened the input keeps it open across value updates.
  const userOpenedRef = useRef(false)

  const selected = value.trim()
  const draftName = draft.trim()
  const canDefault = venue === 'gym' || venue === 'board'
  const label = venue === 'board' ? 'board' : venue
  const newLabel = `New ${label} name`
  const inSaved = (n: string) => saved.some((s) => s.toLowerCase() === n.toLowerCase())

  // When a name lands (a saved pick or a pre-applied default), collapse the input
  // — unless the user opened it themselves.
  useEffect(() => {
    if (value.trim() !== '' && !userOpenedRef.current) setAdding(false)
  }, [value])

  function pickSaved(name: string) {
    userOpenedRef.current = false
    setAdding(false)
    // Tapping the selected pill again clears it (the name is optional).
    onChange(selected.toLowerCase() === name.toLowerCase() ? '' : name)
  }
  function openNew() {
    userOpenedRef.current = true
    setAdding(true)
    onChange('') // deselect any saved pick
  }
  function commit(remember: boolean, asDefault: boolean) {
    const n = draftName
    if (!n) return
    if (remember) {
      rememberLocation(venue, n)
      setSaved(getSavedLocations(venue))
    }
    if (asDefault && canDefault) setDefaultLocation(venue, n)
    userOpenedRef.current = false
    onChange(n)
    setAdding(false)
    setDraft('')
  }

  // Crag with no saved names shows only the input — the "New crag name" pill is
  // redundant there and the input must never be hidden (A85).
  const showNewPill = saved.length > 0 || venue !== 'crag'
  const showSelectedExtra = !adding && selected !== '' && !inSaved(selected)
  const showRow = saved.length > 0 || showNewPill || showSelectedExtra

  return (
    <div className="space-y-2">
      {showRow && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {saved.map((s) => {
            const on = !adding && selected.toLowerCase() === s.toLowerCase()
            return (
              <button
                key={s}
                type="button"
                onClick={() => pickSaved(s)}
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

          {/* A non-saved current name (a "just once" pick or a free-text default)
              stays selectable so it can be cleared. */}
          {showSelectedExtra && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="flex shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-1 text-sm font-medium text-primary-foreground ring-1 ring-inset ring-primary"
            >
              <Check className="size-3.5" />
              {selected}
            </button>
          )}

          {showNewPill && (
            <button
              type="button"
              onClick={openNew}
              className={cn(
                'flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset transition-colors',
                adding
                  ? 'bg-primary text-primary-foreground ring-primary'
                  : 'bg-muted text-muted-foreground ring-transparent active:bg-accent',
              )}
            >
              <Plus className="size-3.5" /> {newLabel}
            </button>
          )}
        </div>
      )}

      {adding && (
        <div className="space-y-2">
          <Input
            value={draft}
            placeholder={newLabel}
            onChange={(e) => setDraft(e.target.value)}
          />
          {draftName !== '' &&
            (canDefault ? (
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
