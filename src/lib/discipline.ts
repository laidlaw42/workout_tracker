import type { DisciplineType } from '@/types'

export const DISCIPLINE_LABEL: Record<DisciplineType, string> = {
  strength: 'Strength',
  cardio: 'Cardio',
  climbing: 'Climbing',
  mixed: 'Mixed',
}

// Solid dot colour per discipline (static classes so Tailwind keeps them).
export const DISCIPLINE_DOT: Record<DisciplineType, string> = {
  strength: 'bg-sky-500',
  cardio: 'bg-orange-500',
  climbing: 'bg-emerald-500',
  mixed: 'bg-violet-500',
}

// Soft badge background + text per discipline.
export const DISCIPLINE_BADGE: Record<DisciplineType, string> = {
  strength: 'bg-sky-500/15 text-sky-600 dark:text-sky-300',
  cardio: 'bg-orange-500/15 text-orange-600 dark:text-orange-300',
  climbing: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
  mixed: 'bg-violet-500/15 text-violet-600 dark:text-violet-300',
}
