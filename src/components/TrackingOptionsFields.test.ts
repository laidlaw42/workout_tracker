import { describe, it, expect } from 'vitest'
import {
  DEFAULT_TRACKING_CONFIG,
  draftToConfig,
  type TrackingConfigDraft,
} from './TrackingOptionsFields'

const draft = (patch: Partial<TrackingConfigDraft>): TrackingConfigDraft => ({
  ...DEFAULT_TRACKING_CONFIG,
  ...patch,
})

describe('draftToConfig', () => {
  it('a plain weighted move: no bodyweight %, no negative load', () => {
    expect(draftToConfig('reps', draft({ hasWeight: true, weightLabel: 'weight' }))).toEqual({
      hasWeight: true,
      weightLabel: 'weight',
      isBodyweight: false,
      supportsNegativeLoad: false,
      hasIntraRest: false,
      hasEdgeDepth: false,
    })
  })

  it('a bodyweight added-load move allows assisted (negative) load', () => {
    expect(
      draftToConfig('reps', draft({ hasWeight: true, weightLabel: 'added_load', isBodyweight: true })),
    ).toMatchObject({ weightLabel: 'added_load', isBodyweight: true, supportsNegativeLoad: true })
  })

  it('added load without the bodyweight toggle does not imply negative load', () => {
    expect(
      draftToConfig('reps', draft({ hasWeight: true, weightLabel: 'added_load', isBodyweight: false })),
    ).toMatchObject({ isBodyweight: false, supportsNegativeLoad: false })
  })

  it("'load' takes the explicit negative-load toggle and is not bodyweight", () => {
    expect(
      draftToConfig('reps', draft({ hasWeight: true, weightLabel: 'load', supportsNegativeLoad: true })),
    ).toMatchObject({ weightLabel: 'load', isBodyweight: false, supportsNegativeLoad: true })
  })

  it('disabling weight clears the label and load flags', () => {
    expect(
      draftToConfig('reps', draft({ hasWeight: false, weightLabel: 'added_load', isBodyweight: true })),
    ).toMatchObject({
      hasWeight: false,
      weightLabel: 'weight',
      isBodyweight: false,
      supportsNegativeLoad: false,
    })
  })

  it('intra-rest only survives for duration tracking; edge depth always passes through', () => {
    expect(draftToConfig('reps', draft({ hasIntraRest: true, hasEdgeDepth: true }))).toMatchObject({
      hasIntraRest: false,
      hasEdgeDepth: true,
    })
    expect(draftToConfig('duration', draft({ hasIntraRest: true }))).toMatchObject({
      hasIntraRest: true,
    })
  })
})
