import { GRIP_TYPES } from '@/lib/climbing'
import { SegmentedControl } from '@/components/SegmentedControl'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { HangConfig, HangType } from '@/types'

// Sensible default protocol for a brand-new hang (repeater-style: 5 × 7s, 3 min
// rest, half-crimp on a 20 mm edge). Shared by the hang editor and the
// create-exercise forms so new hangs start identical everywhere.
export const DEFAULT_HANG: HangConfig = {
  gripType: 'Half crimp',
  hangType: 'sub_max',
  edgeDepthMm: 20,
  durationSeconds: 7,
  weightKg: 0,
  sets: 5,
  restSeconds: 180,
}

const OTHER = '__other__'
const KNOWN = GRIP_TYPES as readonly string[]
const int = (s: string) => (s.trim() === '' ? 0 : Number(s.replace(/[^0-9]/g, '')))

const HANG_TYPES: { value: HangType; label: string }[] = [
  { value: 'sub_max', label: 'Sub-max' },
  { value: 'max_hang', label: 'Max hang' },
  { value: 'abrahang', label: 'Abrahang' },
]

interface Props {
  value: HangConfig
  onChange: (patch: Partial<HangConfig>) => void
}

// The tunable fields of a hangboard protocol: grip, hang type, sets/duration/rest,
// edge/weight, and (for Abrahang) reps + intra-rest. Operates on a HangConfig so
// it can drive both a template's HangboardSet rows and an exercise's default
// config. No autofocus — the surrounding sheets suppress it (F12).
export function HangConfigFields({ value: h, onChange: patch }: Props) {
  const known = KNOWN.includes(h.gripType)
  return (
    <div className="space-y-2">
      <Select
        value={known ? h.gripType : OTHER}
        onValueChange={(v) => patch({ gripType: v === OTHER ? '' : v })}
      >
        <SelectTrigger className="h-9 w-full">
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

      {!known && (
        <Input
          className="h-9"
          placeholder="Custom grip"
          value={h.gripType}
          onChange={(e) => patch({ gripType: e.target.value })}
        />
      )}

      <SegmentedControl
        options={HANG_TYPES}
        value={h.hangType ?? 'sub_max'}
        onChange={(v) => patch({ hangType: v })}
      />

      <div className="grid grid-cols-3 gap-2">
        <Field label="Sets" value={h.sets} onChange={(v) => patch({ sets: v })} />
        <Field
          label="Hang (s)"
          value={h.durationSeconds}
          onChange={(v) => patch({ durationSeconds: v })}
        />
        <Field
          label="Rest (s)"
          value={h.restSeconds}
          onChange={(v) => patch({ restSeconds: v })}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field
          label="Edge (mm)"
          value={h.edgeDepthMm}
          onChange={(v) => patch({ edgeDepthMm: v })}
        />
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Weight ± (kg)</span>
          <Input
            inputMode="numeric"
            className="h-9"
            value={h.weightKg}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9-]/g, '')
              patch({ weightKg: raw === '' || raw === '-' ? 0 : Number(raw) })
            }}
          />
        </label>
      </div>

      {(h.hangType ?? 'sub_max') === 'abrahang' && (
        <div className="grid grid-cols-2 gap-2">
          <Field
            label="Reps"
            value={h.abrahangReps ?? 6}
            onChange={(v) => patch({ abrahangReps: v })}
          />
          <Field
            label="Intra-rest (s)"
            value={h.intraRestSeconds ?? 3}
            onChange={(v) => patch({ intraRestSeconds: v })}
          />
        </div>
      )}
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
