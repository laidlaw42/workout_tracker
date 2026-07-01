import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'

interface Props {
  title: string
  onBack?: () => void
  right?: ReactNode
}

export function PageHeader({ title, onBack, right }: Props) {
  return (
    <header className="sticky top-0 z-40 flex min-h-14 items-center gap-2 border-b border-border bg-background/95 px-2 pt-[env(safe-area-inset-top)] backdrop-blur">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-accent"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
      )}
      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{title}</h1>
      {right}
    </header>
  )
}
