import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { deleteBoard, getSavedLocations, rememberLocation } from '@/lib/prefs'
import { DefaultLocationRow } from '@/components/settings/DefaultLocationRow'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// Settings section for saved climbing boards (A51): add/remove and the
// default-board row. Boards carry no per-board config (unlike gyms).
export function BoardManager() {
  const [boards, setBoards] = useState(() => getSavedLocations('board'))
  const [newBoard, setNewBoard] = useState('')

  function handleAddBoard() {
    const n = newBoard.trim()
    if (!n) return
    rememberLocation('board', n)
    setBoards(getSavedLocations('board'))
    setNewBoard('')
  }
  function handleDeleteBoard(name: string) {
    setBoards(deleteBoard(name))
  }

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium text-muted-foreground">Boards</h2>
      <div className="flex gap-2">
        <Input
          value={newBoard}
          placeholder="Add a board"
          onChange={(e) => setNewBoard(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAddBoard()
          }}
        />
        <Button onClick={handleAddBoard} disabled={!newBoard.trim()}>
          Add board
        </Button>
      </div>
      {boards.length > 0 ? (
        <div className="space-y-2">
          {boards.map((b) => (
            <div
              key={b}
              className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2"
            >
              <span className="min-w-0 truncate text-sm">{b}</span>
              <button
                type="button"
                aria-label={`Delete board ${b}`}
                onClick={() => handleDeleteBoard(b)}
                className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground active:bg-accent"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="px-1 text-xs text-muted-foreground">
          Boards you train on are saved here for quick selection. Removing one won’t affect
          logged sessions.
        </p>
      )}
      {/* A51 — a saved default skips the name prompt on session start. */}
      <div className="pt-2">
        <DefaultLocationRow type="board" label="Default board" />
      </div>
    </section>
  )
}
