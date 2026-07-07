import { useLiveQuery } from '@/hooks/useDb'
import { getAllTemplates } from '@/db/helpers'
import { badgesForTemplate } from '@/lib/badges'
import { DisciplineBadge } from '@/components/DisciplineBadge'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { WorkoutTemplate } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (template: WorkoutTemplate) => void
}

export function TemplatePickerSheet({ open, onOpenChange, onSelect }: Props) {
  const templates = useLiveQuery(() => getAllTemplates(), []) ?? []

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] overflow-y-auto overscroll-contain"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader>
          <SheetTitle>Schedule a workout</SheetTitle>
          <SheetDescription>Pick a workout to add to this day.</SheetDescription>
        </SheetHeader>
        <div className="space-y-2 px-4 pb-6">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t)}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors active:bg-accent"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{t.name}</span>
                <span className="mt-1 flex flex-wrap gap-1">
                  {badgesForTemplate(t).map((b, i) => (
                    <DisciplineBadge key={i} badge={b} />
                  ))}
                </span>
              </span>
            </button>
          ))}
          {templates.length === 0 && (
            <p className="text-sm text-muted-foreground">No workouts yet — create one in Library.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
