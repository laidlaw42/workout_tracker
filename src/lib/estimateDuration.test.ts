import { describe, it, expect } from 'vitest'
import {
  estimateTemplate,
  formatEstimateRange,
  formatRowEstimate,
} from './estimateDuration'
import type { HangboardSet, TemplateCategory, TemplateExercise, WorkoutTemplate } from '@/types'

function tpl(over: Partial<WorkoutTemplate> & { categories?: TemplateCategory[] }): WorkoutTemplate {
  return {
    id: 't',
    name: 'T',
    categories: ['strength'],
    tags: [],
    exercises: [],
    createdAt: 0,
    ...over,
  }
}
const ex = (o: Partial<TemplateExercise>): TemplateExercise => ({
  exerciseId: 'e',
  exerciseName: 'Ex',
  order: 0,
  defaultSets: 3,
  defaultRestSeconds: 90,
  ...o,
})
const hang = (o: Partial<HangboardSet>): HangboardSet => ({
  id: 'h',
  gripType: 'Half crimp',
  hangType: 'sub_max',
  edgeDepthMm: 20,
  durationSeconds: 10,
  weightKg: 0,
  sets: 5,
  restSeconds: 180,
  order: 0,
  ...o,
})

describe('estimateTemplate', () => {
  it('reps rows use 4s/rep + rest + pre-count per set', () => {
    const est = estimateTemplate(tpl({ exercises: [ex({ defaultReps: 10 })] }), 5)
    expect(est.totalSeconds).toBe(3 * (40 + 90 + 5)) // 405
    expect(est.rows).toEqual([{ name: 'Ex', seconds: 405 }])
    expect(est.hasVaries).toBe(false)
  })
  it('duration rows use the hold time', () => {
    const est = estimateTemplate(tpl({ exercises: [ex({ defaultDuration: 30 })] }), 5)
    expect(est.totalSeconds).toBe(3 * (30 + 90 + 5)) // 375
  })
  it('distance rows are unestimable ("varies")', () => {
    const est = estimateTemplate(tpl({ exercises: [ex({ defaultDistanceKm: 5, defaultSets: 1 })] }), 5)
    expect(est.totalSeconds).toBe(0)
    expect(est.hasVaries).toBe(true)
    expect(est.rows[0].seconds).toBeNull()
  })
  it('a plain hangboard set is sets × (hang + rest + pre-count)', () => {
    const est = estimateTemplate(tpl({ categories: ['climbing'], hangboardSets: [hang({})] }), 5)
    expect(est.totalSeconds).toBe(5 * (10 + 180 + 5)) // 975
  })
  it('an Abrahang set is reps × (work + intra-rest) of work', () => {
    const est = estimateTemplate(
      tpl({
        categories: ['climbing'],
        hangboardSets: [hang({ hangType: 'abrahang', durationSeconds: 7, abrahangReps: 6, intraRestSeconds: 3, sets: 3 })],
      }),
      5,
    )
    expect(est.totalSeconds).toBe(3 * (6 * (7 + 3) + 180 + 5)) // 735
  })
  it('a cardio component adds its target duration directly', () => {
    const est = estimateTemplate(tpl({ categories: ['cardio'], targetDurationSeconds: 1800 }), 5)
    expect(est.totalSeconds).toBe(1800)
    expect(est.rows).toEqual([{ name: 'Cardio', seconds: 1800 }])
  })
})

describe('formatEstimateRange', () => {
  it('rounds to a ±5-minute window on 5s', () => {
    expect(formatEstimateRange(3000)).toBe('45–55 min') // 50 min
    expect(formatEstimateRange(2900)).toBe('45–55 min') // 48.3 → 50
    expect(formatEstimateRange(300)).toBe('5–10 min')
  })
  it('shows "< 5 min" for tiny totals', () => {
    expect(formatEstimateRange(120)).toBe('< 5 min')
    expect(formatEstimateRange(0)).toBe('< 5 min')
  })
})

describe('formatRowEstimate', () => {
  it('rounds to whole minutes', () => {
    expect(formatRowEstimate(720)).toBe('~12 min')
    expect(formatRowEstimate(20)).toBe('<1 min')
  })
  it('is "varies" for an unestimable row', () => {
    expect(formatRowEstimate(null)).toBe('varies')
  })
})
