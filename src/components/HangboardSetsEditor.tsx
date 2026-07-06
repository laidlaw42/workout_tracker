import { Plus, Trash2 } from 'lucide-react'
import { generateId } from '@/lib/id'
import { DEFAULT_HANG, HangConfigFields } from '@/components/HangConfigFields'
import { Button } from '@/components/ui/button'
import type { HangboardSet } from '@/types'

interface Props {
  value: HangboardSet[]
  onChange: (value: HangboardSet[]) => void
}

export function HangboardSetsEditor({ value, onChange }: Props) {
  const patch = (i: number, p: Partial<HangboardSet>) =>
    onChange(value.map((h, idx) => (idx === i ? { ...h, ...p } : h)))

  const add = () =>
    onChange([...value, { id: generateId(), ...DEFAULT_HANG, order: value.length }])

  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i))

  return (
    <div className="space-y-3">
      {value.map((h, i) => (
        <div key={h.id} className="space-y-2 rounded-xl border border-border bg-card p-3">
          <div className="flex justify-end">
            <button
              type="button"
              aria-label="Remove hang"
              onClick={() => remove(i)}
              className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground active:bg-accent"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
          <HangConfigFields value={h} onChange={(p) => patch(i, p)} />
        </div>
      ))}

      <Button variant="outline" className="w-full" onClick={add}>
        <Plus className="size-4" /> Add hang
      </Button>
    </div>
  )
}
