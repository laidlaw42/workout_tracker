import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { createSession } from '@/db/helpers'
import { VENUE_BADGES } from '@/lib/badges'
import { getDefaultLocation } from '@/lib/prefs'
import { cn } from '@/lib/utils'
import type { WorkoutSession } from '@/types'

type Kind = 'gym' | 'crag' | 'board'

// Fallback title shown in History/Recents when no location name is chosen (A78).
const SESSION_LABEL: Record<Kind, string> = {
  gym: 'Gym session',
  crag: 'Crag session',
  board: 'Board session',
}

// A78 — tapping a venue starts a climbing session immediately (no name prompt);
// the location is chosen inside the session screen. A saved default gym/board
// (A51) is pre-selected on start; crag has no default.
export function ClimbingQuickStarts() {
  const navigate = useNavigate()

  async function start(kind: Kind) {
    const venue: Partial<WorkoutSession> =
      kind === 'gym'
        ? { climbingVenue: 'gym', gym: getDefaultLocation('gym') || undefined }
        : kind === 'crag'
          ? { climbingVenue: 'crag' }
          : { climbingVenue: 'board', board: getDefaultLocation('board') || '' } // board defined so the flavour stays detectable
    try {
      const id = await createSession({
        type: 'climbing',
        templateName: SESSION_LABEL[kind],
        startedAt: Date.now(),
        modifiedFromTemplate: false,
        ...venue,
      })
      navigate(`/session/climbing/${id}`)
    } catch {
      toast.error('Could not start session')
    }
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      <QuickCard venue="gym" onClick={() => start('gym')} />
      <QuickCard venue="crag" onClick={() => start('crag')} />
      <QuickCard venue="board" onClick={() => start('board')} />
    </div>
  )
}

// Per-venue card tint — kept as static strings so Tailwind doesn't purge them.
// Theme-adaptive venue tints (F49): darker text in light themes, lighter text +
// stronger fill in dark themes. Full static strings so Tailwind keeps them.
const CARD_TONE: Record<Kind, string> = {
  gym: 'bg-pink-500/15 text-pink-700 dark:bg-pink-500/25 dark:text-pink-300',
  crag: 'bg-amber-500/15 text-amber-700 dark:bg-amber-500/25 dark:text-amber-300',
  board: 'bg-purple-500/15 text-purple-700 dark:bg-purple-500/25 dark:text-purple-300',
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
