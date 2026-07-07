import { IntervalsEditor } from '@/components/IntervalsEditor'
import { SegmentedControl } from '@/components/SegmentedControl'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { CardioActivityType, IntervalBlock } from '@/types'

const ACTIVITIES: { value: CardioActivityType; label: string }[] = [
  { value: 'run', label: 'Run' },
  { value: 'ride', label: 'Ride' },
  { value: 'row', label: 'Row' },
  { value: 'other', label: 'Other' },
]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  activity: CardioActivityType
  onActivityChange: (activity: CardioActivityType) => void
  intervals: IntervalBlock[]
  onIntervalsChange: (intervals: IntervalBlock[]) => void
}

export function CardioEditSheet({
  open,
  onOpenChange,
  activity,
  onActivityChange,
  intervals,
  onIntervalsChange,
}: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] overflow-y-auto overscroll-contain"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader>
          <SheetTitle>Edit workout</SheetTitle>
          <SheetDescription>Change the activity or adjust your intervals.</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-6">
          <div className="space-y-2">
            <Label>Activity</Label>
            <SegmentedControl options={ACTIVITIES} value={activity} onChange={onActivityChange} />
          </div>

          <div className="space-y-2">
            <Label>Intervals</Label>
            {intervals.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No intervals — add a round to run a structured session.
              </p>
            )}
            <IntervalsEditor value={intervals} onChange={onIntervalsChange} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
