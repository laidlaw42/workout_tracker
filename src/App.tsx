import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { BottomNav } from '@/components/BottomNav'
import { Toaster } from '@/components/ui/sonner'
import HomeScreen from '@/screens/HomeScreen'
import LibraryScreen from '@/screens/LibraryScreen'
import TemplateDetailScreen from '@/screens/TemplateDetailScreen'
import TemplateEditScreen from '@/screens/TemplateEditScreen'
import StrengthSessionScreen from '@/screens/StrengthSessionScreen'
import CardioSessionScreen from '@/screens/CardioSessionScreen'
import ClimbingSessionScreen from '@/screens/ClimbingSessionScreen'
import SessionSummaryScreen from '@/screens/SessionSummaryScreen'
import SessionDetailScreen from '@/screens/SessionDetailScreen'
import HistoryScreen from '@/screens/HistoryScreen'
import PlannerScreen from '@/screens/PlannerScreen'
import SettingsScreen from '@/screens/SettingsScreen'

// Charts (recharts) are heavy — split them out of the initial bundle.
const ProgressScreen = lazy(() => import('@/screens/ProgressScreen'))

// Immersive flows (active sessions, template detail/edit, settings) hide the nav.
function useHideNav() {
  const { pathname } = useLocation()
  return (
    /^\/session\//.test(pathname) ||
    /^\/library\/[^/]+/.test(pathname) ||
    pathname === '/settings'
  )
}

export default function App() {
  const hideNav = useHideNav()

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background text-foreground">
      <main className={hideNav ? 'flex-1' : 'flex-1 overscroll-y-contain pb-20'}>
        <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading…</div>}>
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<HomeScreen />} />
          <Route path="/planner" element={<PlannerScreen />} />
          <Route path="/library" element={<LibraryScreen />} />
          <Route path="/library/:id" element={<TemplateDetailScreen />} />
          <Route path="/library/:id/edit" element={<TemplateEditScreen />} />
          <Route path="/session/strength/:id" element={<StrengthSessionScreen />} />
          {/* A66 — a mixed-discipline session is built and rendered by the same
              screen as strength, dispatching each exercise to its row variant. */}
          <Route path="/session/mixed/:id" element={<StrengthSessionScreen />} />
          <Route path="/session/cardio/:id" element={<CardioSessionScreen />} />
          <Route path="/session/climbing/:id" element={<ClimbingSessionScreen />} />
          <Route path="/session/:id/summary" element={<SessionSummaryScreen />} />
          <Route path="/history" element={<HistoryScreen />} />
          <Route path="/history/:id" element={<SessionDetailScreen />} />
          <Route path="/progress" element={<ProgressScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
        </Suspense>
      </main>
      {!hideNav && <BottomNav />}
      <Toaster position="top-center" richColors />
    </div>
  )
}
