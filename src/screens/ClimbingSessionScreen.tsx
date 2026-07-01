import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Mountain, Plus } from 'lucide-react'
import { useLiveQuery } from '@/hooks/useDb'
import { useElapsedTimer } from '@/hooks/useElapsedTimer'
import { endSession, getRoutesForSession, getSessionById, updateSession } from '@/db/helpers'
import { SessionHeader } from '@/components/SessionHeader'
import { RouteCard } from '@/components/RouteCard'
import { LogRouteSheet } from '@/components/LogRouteSheet'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ClimbingRoute } from '@/types'

export default function ClimbingSessionScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()

  const session = useLiveQuery(() => getSessionById(id).then((s) => s ?? null), [id])
  const routes = useLiveQuery(() => getRoutesForSession(id), [id]) ?? []

  const [gym, setGym] = useState('')
  const [crag, setCrag] = useState('')
  const [inited, setInited] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<ClimbingRoute | null>(null)

  const elapsed = useElapsedTimer(session?.startedAt ?? Date.now())

  useEffect(() => {
    if (session && !inited) {
      setGym(session.gym ?? '')
      setCrag(session.crag ?? '')
      setInited(true)
    }
  }, [session, inited])

  // Guard a stale/hand-typed URL pointing at a non-climbing session.
  useEffect(() => {
    if (session && session.type !== 'climbing') navigate('/home', { replace: true })
  }, [session, navigate])

  function openNew() {
    setEditing(null)
    setSheetOpen(true)
  }

  function openEdit(route: ClimbingRoute) {
    setEditing(route)
    setSheetOpen(true)
  }

  async function finish() {
    try {
      await endSession(id)
      navigate(`/session/${id}/summary`)
    } catch {
      toast.error('Could not finish session')
    }
  }

  if (session === null) {
    return (
      <div className="p-4">
        <p className="text-muted-foreground">Session not found.</p>
        <Button className="mt-3" onClick={() => navigate('/home')}>
          Go home
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-dvh pb-24">
      <SessionHeader title="Climbing session" elapsedSeconds={elapsed} onFinish={finish} />

      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="gym">Gym</Label>
            <Input
              id="gym"
              value={gym}
              onChange={(e) => setGym(e.target.value)}
              onBlur={() => void updateSession(id, { gym: gym.trim() || undefined })}
              placeholder="optional"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="crag">Crag</Label>
            <Input
              id="crag"
              value={crag}
              onChange={(e) => setCrag(e.target.value)}
              onBlur={() => void updateSession(id, { crag: crag.trim() || undefined })}
              placeholder="optional"
            />
          </div>
        </div>

        <Button size="lg" className="w-full" onClick={openNew}>
          <Plus className="size-5" /> Log a route
        </Button>

        {routes.length === 0 ? (
          <EmptyState
            icon={Mountain}
            title="No routes yet"
            subtitle="Log your first climb of the session."
          />
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {routes.length} route{routes.length === 1 ? '' : 's'} this session
            </p>
            {routes.map((r) => (
              <RouteCard key={r.id} route={r} onClick={() => openEdit(r)} />
            ))}
          </div>
        )}
      </div>

      <LogRouteSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        sessionId={id}
        editing={editing}
        onSaved={() => setEditing(null)}
      />
    </div>
  )
}
