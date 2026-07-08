import { describe, it, expect } from 'vitest'
import { hangExerciseId, hangGripExercise } from './hangboard'

describe('hangExerciseId', () => {
  it('slugs a grip to a stable id', () => {
    expect(hangExerciseId('Half crimp')).toBe('ex_hang_half_crimp')
    expect(hangExerciseId('Three-finger drag')).toBe('ex_hang_three_finger_drag')
    expect(hangExerciseId('Front three')).toBe('ex_hang_front_three')
  })
  it('is stable across casing / spacing / punctuation', () => {
    expect(hangExerciseId('  HALF   CRIMP  ')).toBe('ex_hang_half_crimp')
    expect(hangExerciseId('Half-crimp')).toBe('ex_hang_half_crimp')
  })
  it('always produces an id, even for unsluggable input', () => {
    expect(hangExerciseId('!!!')).toBe('ex_hang_grip')
    expect(hangExerciseId('')).toBe('ex_hang_grip')
  })
})

describe('hangGripExercise', () => {
  it('builds a bodyweight-loaded, edged, intra-rest-capable duration exercise', () => {
    expect(hangGripExercise('Open hand', 123)).toEqual({
      id: 'ex_hang_open_hand',
      name: 'Open hand',
      category: 'hangboard',
      muscleGroups: ['forearms'],
      trackingType: 'duration',
      tags: [],
      hasWeight: true,
      weightLabel: 'load',
      isBodyweight: true,
      supportsNegativeLoad: true,
      hasIntraRest: true,
      hasEdgeDepth: true,
      createdAt: 123,
    })
  })
})
