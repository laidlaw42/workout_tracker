import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ChevronRight, Trash2 } from 'lucide-react'
import { useLiveQuery } from '@/hooks/useDb'
import { deleteTag, getAllTags, renameTag, setTagColour, setTagDefault } from '@/db/helpers'
import { TAG_PALETTE } from '@/lib/tagColors'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { TagMeta } from '@/types'

// Settings tag management (A35): recolour / rename / delete tags, and choose
// which are pre-applied to new exercises and templates.
export function TagManager() {
  const tags = useLiveQuery(() => getAllTags(), [])
  const [editing, setEditing] = useState<TagMeta | null>(null)

  return (
    <>
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Tags</h2>
        {tags === undefined ? null : tags.length === 0 ? (
          <p className="px-1 text-xs text-muted-foreground">
            Tags you add to exercises and workouts appear here. Tap one to recolour, rename, or
            delete it.
          </p>
        ) : (
          <div className="space-y-2">
            {tags.map((t) => (
              <button
                key={t.name}
                type="button"
                onClick={() => setEditing(t)}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 text-left transition-colors active:bg-accent"
              >
                <span
                  className="size-4 shrink-0 rounded-full border border-border/60"
                  style={{ backgroundColor: t.colour }}
                />
                <span className="min-w-0 flex-1 truncate text-sm">{t.name}</span>
                {t.isDefault && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    default
                  </span>
                )}
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            ))}
          </div>
        )}
      </section>

      {tags && tags.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Default tags</h2>
          <p className="px-1 text-xs text-muted-foreground">
            Pre-applied when you create a new exercise or workout. Tap to toggle.
          </p>
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <button
                key={t.name}
                type="button"
                aria-pressed={t.isDefault ?? false}
                onClick={() => void setTagDefault(t.name, !t.isDefault)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors',
                  t.isDefault
                    ? 'bg-accent text-foreground ring-primary'
                    : 'text-muted-foreground ring-border',
                )}
              >
                <span className="size-2.5 rounded-full" style={{ backgroundColor: t.colour }} />
                {t.name}
              </button>
            ))}
          </div>
        </section>
      )}

      <TagEditSheet tag={editing} onClose={() => setEditing(null)} />
    </>
  )
}

function TagEditSheet({ tag, onClose }: { tag: TagMeta | null; onClose: () => void }) {
  const [name, setName] = useState('')
  const [colour, setColour] = useState(TAG_PALETTE[0])
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!tag) return
    setName(tag.name)
    setColour(tag.colour)
  }, [tag])

  async function save() {
    if (!tag) return
    const trimmed = name.trim().toLowerCase()
    const finalName = trimmed && trimmed !== tag.name ? trimmed : tag.name
    try {
      if (trimmed && trimmed !== tag.name) await renameTag(tag.name, trimmed)
      if (colour !== tag.colour) await setTagColour(finalName, colour)
      onClose()
    } catch {
      toast.error('Could not save tag')
    }
  }

  async function remove() {
    if (!tag) return
    try {
      await deleteTag(tag.name)
      setConfirmDelete(false)
      onClose()
    } catch {
      toast.error('Could not delete tag')
    }
  }

  return (
    <Sheet open={tag !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="flex max-h-[90dvh] flex-col gap-0 p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="border-b border-border">
          <SheetTitle>Edit tag</SheetTitle>
          <SheetDescription className="sr-only">Tag name and colour</SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
          <div className="space-y-1.5">
            <Label htmlFor="tag-name">Name</Label>
            <Input id="tag-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Colour</Label>
            <div className="grid grid-cols-6 gap-2">
              {TAG_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Colour ${c}`}
                  aria-pressed={colour === c}
                  onClick={() => setColour(c)}
                  className={cn(
                    'flex h-9 items-center justify-center rounded-lg ring-2 ring-inset transition-transform active:scale-95',
                    colour === c ? 'ring-foreground' : 'ring-transparent',
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full justify-start text-destructive"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="size-4" /> Delete tag
          </Button>
        </div>
        <div className="border-t border-border p-4">
          <Button className="w-full" onClick={save} disabled={!name.trim()}>
            Save
          </Button>
        </div>
      </SheetContent>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{tag?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the tag from every exercise and template that uses it. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={remove}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  )
}
