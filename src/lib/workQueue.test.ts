import { describe, it, expect } from 'vitest'
import { patchById, removeById, reorderKeepingComplete, updateById } from './workQueue'

interface Item {
  uid: string
  sets: number
  skipped?: boolean
}
const uid = (i: Item) => i.uid
const items: Item[] = [
  { uid: 'a', sets: 3 },
  { uid: 'b', sets: 2 },
  { uid: 'c', sets: 1 },
]

describe('updateById', () => {
  it('transforms only the matching item', () => {
    const out = updateById(items, uid, 'b', (i) => ({ ...i, sets: i.sets + 1 }))
    expect(out.map((i) => i.sets)).toEqual([3, 3, 1])
    expect(out).not.toBe(items) // new array
  })
  it('is a no-op when the id is absent', () => {
    expect(updateById(items, uid, 'z', (i) => ({ ...i, sets: 0 }))).toEqual(items)
  })
})

describe('patchById', () => {
  it('shallow-merges the patch', () => {
    expect(patchById(items, uid, 'c', { skipped: true }).find((i) => i.uid === 'c')).toEqual({
      uid: 'c',
      sets: 1,
      skipped: true,
    })
  })
})

describe('removeById', () => {
  it('drops the matching item', () => {
    expect(removeById(items, uid, 'b').map(uid)).toEqual(['a', 'c'])
  })
})

describe('reorderKeepingComplete', () => {
  const isComplete = (i: Item) => !!i.skipped
  it('keeps complete items pinned in front and applies the active order', () => {
    const list: Item[] = [
      { uid: 'done', sets: 1, skipped: true },
      { uid: 'x', sets: 1 },
      { uid: 'y', sets: 1 },
      { uid: 'z', sets: 1 },
    ]
    const out = reorderKeepingComplete(list, uid, isComplete, ['z', 'x', 'y'])
    expect(out.map(uid)).toEqual(['done', 'z', 'x', 'y'])
  })
  it('ignores uids that no longer exist', () => {
    const list: Item[] = [
      { uid: 'x', sets: 1 },
      { uid: 'y', sets: 1 },
    ]
    expect(reorderKeepingComplete(list, uid, isComplete, ['y', 'gone', 'x']).map(uid)).toEqual([
      'y',
      'x',
    ])
  })
})
