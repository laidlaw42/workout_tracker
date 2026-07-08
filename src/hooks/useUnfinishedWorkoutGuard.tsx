import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useLiveQuery } from '@/hooks/useDb'
import { deleteSession, getUnfinishedSession } from '@/db/helpers'
import { clearActivePhase } from '@/lib/activePhase'
import { Button } from '@/components/ui/button'
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

// Guards every "start a workout" entry point against silently orphaning an
// already-running session (you can now leave a session running via the header's
// Close button, so one is often still active). If an unfinished session exists,
// starting another prompts Resume-or-Discard first; otherwise the start runs
// straight through.
//
// Usage:
//   const { guardStart, guardDialog } = useUnfinishedWorkoutGuard()
//   <Button onClick={() => guardStart(startNewWorkout)}>…</Button>
//   {guardDialog}
export function useUnfinishedWorkoutGuard() {
  const navigate = useNavigate()
  const unfinished = useLiveQuery(() => getUnfinishedSession().then((s) => s ?? null), [])
  // The start to run once the prompt is resolved (stored via the updater form so
  // React keeps the function itself rather than invoking it as an updater).
  const [pending, setPending] = useState<(() => void) | null>(null)

  function guardStart(start: () => void) {
    if (unfinished) setPending(() => start)
    else start()
  }

  function resumeUnfinished() {
    setPending(null)
    if (unfinished) navigate(`/session/${unfinished.type}/${unfinished.id}`)
  }

  async function discardAndStart() {
    const start = pending
    setPending(null)
    if (unfinished) {
      try {
        await deleteSession(unfinished.id)
        clearActivePhase(unfinished.id) // F48 — drop any persisted timed phase
      } catch {
        toast.error('Could not discard workout')
        return
      }
    }
    start?.()
  }

  const guardDialog = (
    <AlertDialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>You have an unfinished workout</AlertDialogTitle>
          <AlertDialogDescription>
            Resume {unfinished?.templateName ? `“${unfinished.templateName}”` : 'it'}, or discard it
            and start a new one?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={discardAndStart}>
            Discard &amp; start
          </AlertDialogAction>
          <Button onClick={resumeUnfinished}>Resume</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  return { guardStart, guardDialog }
}
