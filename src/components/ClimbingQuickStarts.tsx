import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { createSession } from '@/db/helpers'
import { VENUE_BADGES } from '@/lib/badges'
import {
  getDefaultLocation,
  getSavedLocations,
  rememberLocation,
  setDefaultLocation,
  type DefaultLocationType,
  type LocationType,
} from '@/lib/prefs'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { WorkoutSession } from '@/types'

type Kind = 'gym' | 'crag' | 'board'

const LABELS: Record<Kind, { title: string; field: string; placeholder: string }> = {
  gym: { title: 'Gym climbing', field: 'Gym name', placeholder: 'optional' },
  crag: { title: 'Crag climbing', field: 'Crag name', placeholder: 'optional' },
  board: { title: 'Board climbing', field: 'Board name (optional)', placeholder: 'e.g. garage wall' },
}

// The Kind now matches the stored climbingVenue discriminator 1:1 (F30).
const LOC_TYPE: Record<Kind, LocationType> = { gym: 'gym', crag: 'crag', board: 'board' }

// Gym and board support a saved default (A51); crag never prompts for one.
function defaultableType(kind: Kind): DefaultLocationType | null {
  return kind === 'gym' ? 'gym' : kind === 'board' ? 'board' : null
}

export function ClimbingQuickStarts() {
  const navigate = useNavigate()
  const [prompt, setPrompt] = useState<Kind | null>(null)
  const [name, setName] = useState('')
  // After starting a session with a brand-new gym/board name, offer to save it as
  // the default (A51). Holds the created session so navigation waits for the answer.
  const [pendingDefault, setPendingDefault] = useState<{
    type: DefaultLocationType
    name: string
    sessionId: string
  } | null>(null)

  function open(kind: Kind) {
    const dt = defaultableType(kind)
    const def = dt ? getDefaultLocation(dt) : ''
    // A default is set — skip the prompt and start straight away (A51).
    if (def) {
      void begin(kind, def, false)
      return
    }
    setName('')
    setPrompt(kind)
  }

  const saved = prompt ? getSavedLocations(LOC_TYPE[prompt]) : []

  // Create the session; optionally offer to save a new name as default; navigate.
  async function begin(kind: Kind, rawName: string, offerDefault: boolean) {
    const trimmed = rawName.trim() || undefined
    const venue: Partial<WorkoutSession> =
      kind === 'gym'
        ? { climbingVenue: 'gym', gym: trimmed }
        : kind === 'crag'
          ? { climbingVenue: 'crag', crag: trimmed }
          : { climbingVenue: 'board', board: trimmed ?? '' } // board defined so the flavour stays detectable
    const dt = defaultableType(kind)
    // "New" = not already remembered for this venue — checked before we save it.
    const isNewName =
      !!trimmed &&
      !getSavedLocations(LOC_TYPE[kind]).some((s) => s.toLowerCase() === trimmed.toLowerCase())
    try {
      const id = await createSession({
        type: 'climbing',
        templateName: kind === 'board' ? (trimmed ?? 'Board') : LABELS[kind].title,
        startedAt: Date.now(),
        modifiedFromTemplate: false,
        ...venue,
      })
      rememberLocation(LOC_TYPE[kind], rawName) // MRU; no-ops on empty
      setPrompt(null)
      // First-use default prompt (A51): a brand-new gym/board name with no default yet.
      if (offerDefault && dt && trimmed && isNewName && !getDefaultLocation(dt)) {
        setPendingDefault({ type: dt, name: trimmed, sessionId: id })
        return // navigation waits until the default prompt is answered
      }
      navigate(`/session/climbing/${id}`)
    } catch {
      toast.error('Could not start session')
    }
  }

  function resolveDefault(save: boolean) {
    if (!pendingDefault) return
    if (save) setDefaultLocation(pendingDefault.type, pendingDefault.name)
    const id = pendingDefault.sessionId
    setPendingDefault(null)
    navigate(`/session/climbing/${id}`)
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      <QuickCard venue="gym" onClick={() => open('gym')} />
      <QuickCard venue="crag" onClick={() => open('crag')} />
      <QuickCard venue="board" onClick={() => open('board')} />

      <Dialog open={prompt !== null} onOpenChange={(o) => !o && setPrompt(null)}>
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{prompt ? LABELS[prompt].title : ''}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {saved.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {saved.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setName(s)}
                    className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-foreground transition-colors active:bg-accent"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            <Label htmlFor="place-name">{prompt ? LABELS[prompt].field : ''}</Label>
            <Input
              id="place-name"
              value={name}
              placeholder={prompt ? LABELS[prompt].placeholder : ''}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrompt(null)}>
              Cancel
            </Button>
            <Button onClick={() => prompt && void begin(prompt, name, true)}>Start session</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={pendingDefault !== null} onOpenChange={(o) => !o && resolveDefault(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Set {pendingDefault?.name} as your default {pendingDefault?.type}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Future {pendingDefault?.type} sessions will start here without asking. You can change
              this anytime in Settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not now</AlertDialogCancel>
            <AlertDialogAction onClick={() => resolveDefault(true)}>Set as default</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// Per-venue card tint — kept as static strings so Tailwind doesn't purge them.
const CARD_TONE: Record<Kind, string> = {
  gym: 'bg-blue-500/10 text-blue-300',
  crag: 'bg-amber-500/10 text-amber-300',
  board: 'bg-green-500/10 text-green-300',
}

function QuickCard({ venue, onClick }: { venue: Kind; onClick: () => void }) {
  const { Icon, label } = VENUE_BADGES[venue]
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border border-border p-3 text-sm font-medium transition-transform active:scale-95',
        CARD_TONE[venue],
      )}
    >
      <Icon className="size-6" aria-hidden />
      {label}
    </button>
  )
}
