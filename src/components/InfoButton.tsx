import { useState } from 'react'
import { Info } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// A small ⓘ button that opens a dialog with an item's name + description (and any
// extra details). Used on the library workout / exercise cards, beside the Play
// button, so you can read what something is without opening it.
export function InfoButton({
  title,
  description,
  details,
  className,
}: {
  title: string
  description?: string
  details?: React.ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        aria-label={`About ${title}`}
        onClick={() => setOpen(true)}
        className={
          className ??
          'flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors active:bg-accent'
        }
      >
        <Info className="size-4" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className="whitespace-pre-line">
              {description?.trim() ? description : 'No description yet.'}
            </DialogDescription>
          </DialogHeader>
          {details}
        </DialogContent>
      </Dialog>
    </>
  )
}
