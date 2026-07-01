import { NavLink } from 'react-router-dom'
import { BarChart3, CalendarDays, Clock, House, List } from 'lucide-react'
import { cn } from '@/lib/utils'

const tabs = [
  { to: '/home', label: 'Home', icon: House },
  { to: '/planner', label: 'Planner', icon: CalendarDays },
  { to: '/library', label: 'Library', icon: List },
  { to: '/history', label: 'History', icon: Clock },
  { to: '/progress', label: 'Progress', icon: BarChart3 },
] as const

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="flex items-stretch justify-around">
        {tabs.map(({ to, label, icon: Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex min-h-14 flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground transition-colors',
                  isActive && 'text-primary',
                )
              }
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
