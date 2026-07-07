import { useState } from 'react'
import { Check, Minus, Pencil, Plus } from 'lucide-react'
import { getWeightStep } from '@/lib/prefs'
import { weightLabel } from '@/lib/climbing'
import { Button } from '@/components/ui/button'
import { NumberStepper } from '@/components/NumberStepper'
import { SetCountdown } from '@/components/SetCountdown'
import type { HangboardSet, LoggedHang } from '@/types'

// Fields editable inline mid-session (A31) — applied to remaining unlogged hangs.
export type HangEdit = Partial<Pick<HangboardSet, 'durationSeconds' | 'weightKg' | 'restSeconds'>>

interface Props {
  hangSet: HangboardSet
  /** Actual logged hangs for this set — rendered as history (edits never touch them). */
  loggedHangs: LoggedHang[]
  isCurrent: boolean
  skipped: boolean
  onAddSet: () => void
  /** Remove the current incomplete hang (last one → confirms hang removal). */
  onRemoveSet?: () => void
  /** Edit target duration, weight, rest for the remaining hangs (A31). */
  onEdit?: (updates: HangEdit) => void
  /** Start the hang countdown (session logs it + starts rest at zero). */
  onStartCountdown?: () => void
  countdown?: { remaining: number; duration: number; precount?: boolean; label?: string } | null
}

// Body of a hang card. The shell (border, drag handle, long-press Skip/Remove)
// is provided by SortableList.
export function HangCard({
  hangSet,
  loggedHangs,
  isCurrent,
  skipped,
  onAddSet,
  onRemoveSet,
  onEdit,
  onStartCountdown,
  countdown,
}: Props) {
  const [editing, setEditing] = useState(false)
  const completedCount = loggedHangs.length
  const complete = completedCount >= hangSet.sets
  const currentHang = completedCount + 1
  const canEdit = onEdit != null && !skipped && !complete

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{hangSet.gripType}</p>
          <p className="text-xs text-muted-foreground">
            {hangSet.edgeDepthMm}mm · {hangSet.durationSeconds}s · {weightLabel(hangSet.weightKg)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-base text-muted-foreground">
            {skipped ? (
              'Skipped'
            ) : complete ? (
              'Done'
            ) : (
              <>
                Hang <span className="font-bold text-foreground">{currentHang}</span> of{' '}
                {hangSet.sets}
              </>
            )}
          </span>
          {canEdit && (
            <button
              type="button"
              aria-label="Edit hang"
              aria-pressed={editing}
              onClick={() => setEditing((e) => !e)}
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors active:bg-accent aria-pressed:bg-accent aria-pressed:text-foreground"
            >
              <Pencil className="size-4" />
            </button>
          )}
        </div>
      </div>

      {editing && canEdit && <HangEditPanel hangSet={hangSet} onEdit={onEdit!} />}

      {!skipped && (
        <div className="space-y-2">
          {loggedHangs.map((h) => (
            <div
              key={h.id}
              className="flex items-center gap-3 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-300"
            >
              <Check className="size-4 shrink-0" />
              <span className="text-base text-muted-foreground">
                Hang <span className="font-bold text-foreground">{h.setNumber}</span>
              </span>
              <span className="font-medium text-foreground">
                {h.actualDurationSeconds ?? h.targetDurationSeconds}s · {weightLabel(h.weightKg)}
              </span>
            </div>
          ))}

          {isCurrent &&
            !complete &&
            (countdown ? (
              <SetCountdown
                remaining={countdown.remaining}
                duration={countdown.duration}
                label={countdown.precount ? 'Get ready' : (countdown.label ?? 'Hang')}
                phase={
                  countdown.precount
                    ? 'precount'
                    : countdown.label === 'Rest' // Abrahang intra-set rest
                      ? 'rest'
                      : 'hold'
                }
              />
            ) : (
              <div className="flex items-center gap-2">
                <Button className="flex-1" onClick={onStartCountdown}>
                  {hangSet.hangType === 'abrahang'
                    ? `Start Abrahang (${hangSet.abrahangReps ?? 6}×${hangSet.durationSeconds}s)`
                    : `Start hang ${currentHang} (${hangSet.durationSeconds}s)`}
                </Button>
                {onRemoveSet && (
                  <button
                    type="button"
                    aria-label="Remove hang"
                    onClick={onRemoveSet}
                    className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors active:bg-accent"
                  >
                    <Minus className="size-4" />
                  </button>
                )}
              </div>
            ))}

          <button
            type="button"
            onClick={onAddSet}
            className="flex items-center gap-1 rounded-md px-1 py-1 text-xs font-medium text-muted-foreground transition-colors active:bg-accent"
          >
            <Plus className="size-3.5" /> Add hang
          </button>
        </div>
      )}
    </div>
  )
}

// Inline editor for the remaining hangs' targets (A31). Assisted hangs carry a
// negative weight, so the weight stepper allows values below zero.
function HangEditPanel({ hangSet, onEdit }: { hangSet: HangboardSet; onEdit: (u: HangEdit) => void }) {
  const [duration, setDuration] = useState(String(hangSet.durationSeconds))
  const [weight, setWeight] = useState(String(hangSet.weightKg))
  const [rest, setRest] = useState(String(hangSet.restSeconds))

  const toNum = (v: string) => {
    const n = Number(v)
    return v.trim() === '' || v.trim() === '-' || Number.isNaN(n) ? 0 : n
  }

  return (
    <div className="space-y-2 rounded-lg border border-primary/40 bg-background p-3">
      <EditField label="Duration (s)">
        <NumberStepper
          value={duration}
          ariaLabel="hang duration"
          min={1}
          onChange={(v) => {
            setDuration(v)
            onEdit({ durationSeconds: toNum(v) })
          }}
        />
      </EditField>
      <EditField label="Weight (kg)">
        <NumberStepper
          value={weight}
          ariaLabel="hang weight"
          step={getWeightStep()}
          inputMode="decimal"
          onChange={(v) => {
            setWeight(v)
            onEdit({ weightKg: toNum(v) })
          }}
        />
      </EditField>
      <EditField label="Rest (s)">
        <NumberStepper
          value={rest}
          ariaLabel="hang rest"
          step={5}
          min={0}
          onChange={(v) => {
            setRest(v)
            onEdit({ restSeconds: toNum(v) })
          }}
        />
      </EditField>
    </div>
  )
}

function EditField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-sm text-muted-foreground">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  )
}
