import { Trophy } from 'lucide-react'

interface Props {
  label: string
}

export function PRBadge({ label }: Props) {
  return (
    <div className="flex animate-in items-center gap-2 rounded-lg bg-amber-400/15 px-3 py-2 text-amber-300 ring-1 ring-amber-400/30 zoom-in-95 duration-300">
      <Trophy className="size-4 shrink-0" aria-hidden />
      <span className="text-sm font-medium">{label}</span>
    </div>
  )
}
