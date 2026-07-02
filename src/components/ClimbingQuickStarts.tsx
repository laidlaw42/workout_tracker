import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Building2, Home, Mountain } from 'lucide-react'
import { createSession } from '@/db/helpers'
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
        ? { gym: trimmed }
        : prompt === 'crag'
          ? { crag: trimmed }
          : { board: trimmed ?? '' } // always defined for Home, so the board flavour is detectable
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
      <QuickCard icon={Building2} label="Gym" onClick={() => open('gym')} />
      <QuickCard icon={Mountain} label="Crag" onClick={() => open('crag')} />
      <QuickCard icon={Home} label="Home" onClick={() => open('home')} />

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

function QuickCard({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Mountain
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border border-border bg-green-500/10 p-3 text-sm font-medium text-green-300 transition-transform active:scale-95"
    >
      <Icon className="size-6" aria-hidden />
      {label}
    </button>
  )
}
