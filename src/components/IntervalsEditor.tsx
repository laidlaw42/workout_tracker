import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { IntervalBlock } from '@/types'

interface Props {
  value: IntervalBlock[]
  onChange: (value: IntervalBlock[]) => void
}

const digits = (s: string) => s.replace(/[^0-9]/g, '')

// Edits IntervalBlock[] (round-groups of steps). Step duration is entered as
// minutes + seconds and stored as total seconds.
export function IntervalsEditor({ value, onChange }: Props) {
  const setBlock = (bi: number, patch: Partial<IntervalBlock>) =>
    onChange(value.map((b, i) => (i === bi ? { ...b, ...patch } : b)))

  const setStepDuration = (bi: number, si: number, seconds: number) =>
    setBlock(bi, {
      steps: value[bi].steps.map((s, i) => (i === si ? { ...s, durationSeconds: seconds } : s)),
    })

  const setStepLabel = (bi: number, si: number, label: string) =>
    setBlock(bi, {
      steps: value[bi].steps.map((s, i) => (i === si ? { ...s, label } : s)),
    })

  const addStep = (bi: number) =>
    setBlock(bi, { steps: [...value[bi].steps, { label: 'Work', durationSeconds: 60 }] })

  const removeStep = (bi: number, si: number) =>
    setBlock(bi, { steps: value[bi].steps.filter((_, i) => i !== si) })

  const addBlock = () =>
    onChange([...value, { repeat: 1, steps: [{ label: 'Work', durationSeconds: 60 }] }])

  const removeBlock = (bi: number) => onChange(value.filter((_, i) => i !== bi))

  return (
    <div className="space-y-3">
      {value.map((block, bi) => (
        <div key={bi} className="space-y-3 rounded-xl border border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Repeat</span>
            <Input
              inputMode="numeric"
              className="h-8 w-16 text-center"
              value={block.repeat}
              onChange={(e) => setBlock(bi, { repeat: Math.max(1, Number(digits(e.target.value) || '1')) })}
            />
            <span className="text-sm text-muted-foreground">×</span>
            <button
              type="button"
              aria-label="Remove round"
              onClick={() => removeBlock(bi)}
              className="ml-auto flex size-8 items-center justify-center rounded-md text-muted-foreground active:bg-accent"
            >
              <Trash2 className="size-4" />
            </button>
          </div>

          {block.steps.map((step, si) => {
            const mins = Math.floor(step.durationSeconds / 60)
            const secs = step.durationSeconds % 60
            return (
              <div key={si} className="flex items-end gap-2">
                <label className="flex flex-1 flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Label</span>
                  <Input
                    className="h-9"
                    value={step.label}
                    onChange={(e) => setStepLabel(bi, si, e.target.value)}
                  />
                </label>
                <label className="flex w-14 flex-col gap-1">
                  <span className="text-xs text-muted-foreground">min</span>
                  <Input
                    inputMode="numeric"
                    className="h-9 text-center"
                    value={mins}
                    onChange={(e) =>
                      setStepDuration(bi, si, Number(digits(e.target.value) || '0') * 60 + secs)
                    }
                  />
                </label>
                <label className="flex w-14 flex-col gap-1">
                  <span className="text-xs text-muted-foreground">sec</span>
                  <Input
                    inputMode="numeric"
                    className="h-9 text-center"
                    value={secs}
                    onChange={(e) =>
                      setStepDuration(bi, si, mins * 60 + Math.min(59, Number(digits(e.target.value) || '0')))
                    }
                  />
                </label>
                <button
                  type="button"
                  aria-label="Remove step"
                  onClick={() => removeStep(bi, si)}
                  className="flex size-9 items-center justify-center rounded-md text-muted-foreground active:bg-accent"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            )
          })}

          <Button variant="ghost" size="sm" onClick={() => addStep(bi)}>
            <Plus className="size-4" /> Add step
          </Button>
        </div>
      ))}

      <Button variant="outline" className="w-full" onClick={addBlock}>
        <Plus className="size-4" /> Add round
      </Button>
    </div>
  )
}
