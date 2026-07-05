import { useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { useTagColours } from '@/hooks/useTagColours'

interface Props {
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
}

// Free-text tag entry: type + Enter/comma to add, backspace to remove the last,
// × to remove a specific one. Tags are lowercased and deduplicated.
export function TagInput({ value, onChange, placeholder = 'Add a tag…' }: Props) {
  const [input, setInput] = useState('')
  const tagColour = useTagColours()

  function add(raw: string) {
    const v = raw.trim().toLowerCase()
    if (v && !value.includes(v)) onChange([...value, v])
    setInput('')
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add(input)
    } else if (e.key === 'Backspace' && input === '' && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent p-2">
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs text-foreground"
        >
          <span className="size-2 rounded-full" style={{ backgroundColor: tagColour(tag) }} />
          {tag}
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            onClick={() => onChange(value.filter((t) => t !== tag))}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => add(input)}
        placeholder={value.length === 0 ? placeholder : ''}
        className="min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  )
}
