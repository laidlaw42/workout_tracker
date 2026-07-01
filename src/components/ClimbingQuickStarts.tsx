import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Building2, Mountain } from 'lucide-react'
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

type Kind = 'gym' | 'crag'

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
    try {
      const id = await createSession({
        type: 'climbing',
        templateName: prompt === 'gym' ? 'Gym climbing' : 'Crag climbing',
        startedAt: Date.now(),
        modifiedFromTemplate: false,
        gym: prompt === 'gym' ? trimmed : undefined,
        crag: prompt === 'crag' ? trimmed : undefined,
      })
      setPrompt(null)
      navigate(`/session/climbing/${id}`)
    } catch {
      toast.error('Could not start session')
    }
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <QuickCard icon={Building2} label="Gym climbing" onClick={() => open('gym')} />
      <QuickCard icon={Mountain} label="Crag climbing" onClick={() => open('crag')} />

      <Dialog open={prompt !== null} onOpenChange={(o) => !o && setPrompt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{prompt === 'gym' ? 'Gym climbing' : 'Crag climbing'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="place-name">{prompt === 'gym' ? 'Gym name' : 'Crag name'}</Label>
            <Input
              id="place-name"
              value={name}
              autoFocus
              placeholder="optional"
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
