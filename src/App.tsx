import { Navigate, Route, Routes } from 'react-router-dom'
import { BottomNav } from '@/components/BottomNav'
import HomeScreen from '@/screens/HomeScreen'
import LibraryScreen from '@/screens/LibraryScreen'
import HistoryScreen from '@/screens/HistoryScreen'
import ProgressScreen from '@/screens/ProgressScreen'
import SettingsScreen from '@/screens/SettingsScreen'

export default function App() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background text-foreground">
      <main className="flex-1 overscroll-y-contain pb-20">
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<HomeScreen />} />
          <Route path="/library" element={<LibraryScreen />} />
          <Route path="/history" element={<HistoryScreen />} />
          <Route path="/progress" element={<ProgressScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  )
}
