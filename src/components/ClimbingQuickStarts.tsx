import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { createSession } from '@/db/helpers'
import { VENUE_BADGES } from '@/lib/badges'
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
import type { WorkoutSession } from '@/types'

type Kind = 'gym' | 'crag' | 'home'

const LABELS: Record<Kind, { title: string; field: string; placeholder: string }> = {
  gym: { title: 'Gym climbing', field: 'Gym name', placeholder: 'optional' },
  crag: { title: 'Crag climbing', field: 'Crag name', placeholder: 'optional' },
  home: { title: 'Home board', field: 'Board name (optional)', placeholder: 'e.g. garage wall' },
}

export function ClimbingQuickStarts() {
  const navigate = useNavigate()
  const [prompt, setPrompt] = useState<Kind | null>(null)
  const [name, setName] = useState('')

  function open(kind: Kind) {
    setName('')
    setPrompt(kind)
  }

  async function start() {
    if (!prompt) return
    const trimmed = name.trim() || undefined
    const venue: Partial<WorkoutSession> =
      prompt === 'gym'
        ? { climbingVenue: 'gym', gym: trimmed }
        : prompt === 'crag'
          ? { climbingVenue: 'crag', crag: trimmed }
          : { climbingVenue: 'home', board: trimmed ?? '' } // board defined so the flavour stays detectable
    try {
      const id = await createSession({
        type: 'climbing',
        templateName: prompt === 'home' ? (trimmed ?? 'Home board') : LABELS[prompt].title,
        startedAt: Date.now(),
        modifiedFromTemplate: false,
        ...venue,
      })
      setPrompt(null)
      navigate(`/session/climbing/${id}`)
    } catch {
      toast.error('Could not start session')
    }
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      <QuickCard venue="gym" onClick={() => open('gym')} />
      <QuickCard venue="crag" onClick={() => open('crag')} />
      <QuickCard venue="home" onClick={() => open('home')} />

      <Dialog open={prompt !== null} onOpenChange={(o) => !o && setPrompt(null)}>
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{prompt ? LABELS[prompt].title : ''}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
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
            <Button onClick={start}>Start session</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Per-venue card tint — kept as static strings so Tailwind doesn't purge them.
const CARD_TONE: Record<Kind, string> = {
  gym: 'bg-blue-500/10 text-blue-300',
  crag: 'bg-amber-500/10 text-amber-300',
  home: 'bg-green-500/10 text-green-300',
}

function QuickCard({ venue, onClick }: { venue: Kind; onClick: () => void }) {
  const badge = VENUE_BADGES[venue]
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border border-border p-3 text-sm font-medium transition-transform active:scale-95',
        CARD_TONE[venue],
      )}
    >
      <span className="text-2xl" aria-hidden>
        {badge.emoji}
      </span>
      {badge.label}
    </button>
  )
}
