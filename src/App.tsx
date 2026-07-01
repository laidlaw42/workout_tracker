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
import HistoryScreen from '@/screens/HistoryScreen'
import ProgressScreen from '@/screens/ProgressScreen'
import SettingsScreen from '@/screens/SettingsScreen'

// Immersive flows (active sessions, template detail/edit) hide the bottom nav.
function useHideNav() {
  const { pathname } = useLocation()
  return /^\/session\//.test(pathname) || /^\/library\/[^/]+/.test(pathname)
}

export default function App() {
  const hideNav = useHideNav()

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background text-foreground">
      <main className={hideNav ? 'flex-1' : 'flex-1 overscroll-y-contain pb-20'}>
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<HomeScreen />} />
          <Route path="/library" element={<LibraryScreen />} />
          <Route path="/library/:id" element={<TemplateDetailScreen />} />
          <Route path="/library/:id/edit" element={<TemplateEditScreen />} />
          <Route path="/session/strength/:id" element={<StrengthSessionScreen />} />
          <Route path="/session/cardio/:id" element={<CardioSessionScreen />} />
          <Route path="/session/climbing/:id" element={<ClimbingSessionScreen />} />
          <Route path="/history" element={<HistoryScreen />} />
          <Route path="/progress" element={<ProgressScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </main>
      {!hideNav && <BottomNav />}
      <Toaster position="top-center" richColors />
    </div>
  )
}
