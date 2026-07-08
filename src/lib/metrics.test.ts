import { describe, it, expect } from 'vitest'
import { deriveMetricsFromConfig, exerciseMetrics, metricsToConfig, sortMetrics } from './metrics'
import type { Exercise } from '@/types'

const ex = (patch: Partial<Exercise>): Exercise =>
  ({ id: 'e', name: 'x', category: 'strength', muscleGroups: [], tags: [], createdAt: 0, ...patch }) as Exercise

describe('sortMetrics', () => {
  it('orders metrics into the canonical Parameters order', () => {
    expect(sortMetrics(['load', 'reps', 'sets'])).toEqual(['sets', 'reps', 'load'])
  })
})

describe('metricsToConfig', () => {
  it('reps + weight → a plain weighted strength row', () => {
    expect(metricsToConfig(['sets', 'reps', 'rest', 'weight'])).toEqual({
      trackingType: 'reps',
      hasWeight: true,
      weightLabel: 'weight',
      isBodyweight: false,
      supportsNegativeLoad: false,
      hasEdgeDepth: false,
    })
  })
  it('load is bodyweight-relative and signed', () => {
    expect(metricsToConfig(['sets', 'reps', 'load'])).toMatchObject({
      hasWeight: true,
      weightLabel: 'load',
      isBodyweight: true,
      supportsNegativeLoad: true,
    })
  })
  it('duration → a hold; distance wins the tracking type', () => {
    expect(metricsToConfig(['sets', 'duration', 'rest']).trackingType).toBe('duration')
    expect(metricsToConfig(['distance', 'duration']).trackingType).toBe('distance')
  })
  it('edge enables the edge-depth input', () => {
    expect(metricsToConfig(['sets', 'duration', 'edge', 'load']).hasEdgeDepth).toBe(true)
  })
})

describe('deriveMetricsFromConfig (legacy fallback)', () => {
  it('a barbell lift → sets/reps/rest/weight', () => {
    expect(deriveMetricsFromConfig({ trackingType: 'reps', hasWeight: true, weightLabel: 'weight' })).toEqual([
      'sets',
      'reps',
      'rest',
      'weight',
    ])
  })
  it('a bodyweight/loadable move → load, not weight', () => {
    expect(
      deriveMetricsFromConfig({ trackingType: 'reps', hasWeight: true, weightLabel: 'added_load', isBodyweight: true }),
    ).toEqual(['sets', 'reps', 'rest', 'load'])
  })
  it('a cardio distance move → distance + duration, no sets/rest', () => {
    expect(deriveMetricsFromConfig({ trackingType: 'distance' })).toEqual(['duration', 'distance'])
  })
  it('a hangboard hold → sets/duration/rest/edge/load', () => {
    expect(
      deriveMetricsFromConfig({ trackingType: 'duration', hasWeight: true, weightLabel: 'load', isBodyweight: true, hasEdgeDepth: true }),
    ).toEqual(['sets', 'duration', 'rest', 'edge', 'load'])
  })
})

describe('exerciseMetrics', () => {
  it('prefers stored metrics', () => {
    expect(exerciseMetrics(ex({ metrics: ['sets', 'reps'] }))).toEqual(['sets', 'reps'])
  })
  it('falls back to deriving from the legacy config', () => {
    expect(exerciseMetrics(ex({ trackingType: 'reps', hasWeight: true, weightLabel: 'weight' }))).toEqual([
      'sets',
      'reps',
      'rest',
      'weight',
    ])
  })
})
