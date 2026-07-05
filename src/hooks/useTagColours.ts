import { useMemo } from 'react'
import { useLiveQuery } from '@/hooks/useDb'
import { getAllTags } from '@/db/helpers'
import { TAG_FALLBACK_COLOUR } from '@/lib/tagColors'

// Returns a lookup from tag name to its palette colour (A35), reactive to tag
// metadata changes. Unknown tags fall back to a neutral tint.
export function useTagColours(): (name: string) => string {
  const tags = useLiveQuery(() => getAllTags(), [])
  return useMemo(() => {
    const map = new Map((tags ?? []).map((t) => [t.name, t.colour]))
    return (name: string) => map.get(name) ?? TAG_FALLBACK_COLOUR
  }, [tags])
}
