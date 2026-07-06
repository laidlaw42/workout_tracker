import { weightLabel } from '@/lib/climbing'
import type { LoggedHang } from '@/types'

// Read-only "Hangboard" list of logged hangs on a completed session's detail —
// shared by mixed (training) and climbing session views so their hang rows stay
// identical. Renders nothing when there are no hangs.
export function LoggedHangList({ hangs }: { hangs: LoggedHang[] }) {
  if (hangs.length === 0) return null
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-muted-foreground">Hangboard</p>
      {hangs.map((h) => (
        <div key={h.id} className="flex justify-between rounded-lg bg-card px-3 py-2 text-sm">
          <span className="truncate">{h.gripType}</span>
          <span className="text-muted-foreground">
            {h.edgeDepthMm}mm · {h.actualDurationSeconds ?? h.targetDurationSeconds}s ·{' '}
            {weightLabel(h.weightKg)}
          </span>
        </div>
      ))}
    </div>
  )
}
