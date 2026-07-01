import { Plus, Trash2 } from 'lucide-react'
import { generateId } from '@/lib/id'
import { GRIP_TYPES } from '@/lib/climbing'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { HangboardSet } from '@/types'

interface Props {
  value: HangboardSet[]
  onChange: (value: HangboardSet[]) => void
}

const OTHER = '__other__'
const KNOWN = GRIP_TYPES as readonly string[]
const int = (s: string) => (s.trim() === '' ? 0 : Number(s.replace(/[^0-9]/g, '')))

export function HangboardSetsEditor({ value, onChange }: Props) {
  const patch = (i: number, p: Partial<HangboardSet>) =>
    onChange(value.map((h, idx) => (idx === i ? { ...h, ...p } : h)))

  const add = () =>
    onChange([
      ...value,
      {
        id: generateId(),
        gripType: 'Half crimp',
        edgeDepthMm: 20,
        durationSeconds: 7,
        weightKg: 0,
        sets: 5,
        // Repeater-protocol default (3 min); see hangboard rest notes in seed.ts.
        restSeconds: 180,
        order: value.length,
      },
    ])

  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i))

  return (
    <div className="space-y-3">
      {value.map((h, i) => {
        const known = KNOWN.includes(h.gripType)
        return (
          <div key={h.id} className="space-y-2 rounded-xl border border-border bg-card p-3">
            <div className="flex items-center gap-2">
              <Select
                value={known ? h.gripType : OTHER}
                onValueChange={(v) => patch(i, { gripType: v === OTHER ? '' : v })}
              >
                <SelectTrigger className="h-9 flex-1">
                  <SelectValue placeholder="Grip type" />
                </SelectTrigger>
                <SelectContent>
                  {GRIP_TYPES.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                  <SelectItem value={OTHER}>Other…</SelectItem>
                </SelectContent>
              </Select>
              <button
                type="button"
                aria-label="Remove hang"
                onClick={() => remove(i)}
                className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground active:bg-accent"
              >
                <Trash2 className="size-4" />
              </button>
            </div>

            {!known && (
              <Input
                className="h-9"
                placeholder="Custom grip"
                value={h.gripType}
                onChange={(e) => patch(i, { gripType: e.target.value })}
              />
            )}

            <div className="grid grid-cols-3 gap-2">
              <Field label="Sets" value={h.sets} onChange={(v) => patch(i, { sets: v })} />
              <Field
                label="Hang (s)"
                value={h.durationSeconds}
                onChange={(v) => patch(i, { durationSeconds: v })}
              />
              <Field
                label="Rest (s)"
                value={h.restSeconds}
                onChange={(v) => patch(i, { restSeconds: v })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field
                label="Edge (mm)"
                value={h.edgeDepthMm}
                onChange={(v) => patch(i, { edgeDepthMm: v })}
              />
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Weight ± (kg)</span>
                <Input
                  inputMode="numeric"
                  className="h-9"
                  value={h.weightKg}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9-]/g, '')
                    patch(i, { weightKg: raw === '' || raw === '-' ? 0 : Number(raw) })
                  }}
                />
              </label>
            </div>
          </div>
        )
      })}

      <Button variant="outline" className="w-full" onClick={add}>
        <Plus className="size-4" /> Add hang
      </Button>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Input
        inputMode="numeric"
        className="h-9"
        value={value}
        onChange={(e) => onChange(int(e.target.value))}
      />
    </label>
  )
}
