// Pure transforms for a session's working queue (the exercise list and the
// hangboard-hang list). Both StrengthSessionScreen and ClimbingSessionScreen run
// the same add-set / edit / skip / remove / reorder mutations over their queues;
// these keep that logic in one unit-testable place. They are generic over the
// item type and its uid accessor, so the exact same functions drive the exercise
// queue (uid = `uid`) and the hang queue (uid = `id`). The screens apply the
// result with setWork/setHangWork and keep their own side effects (markModified,
// cancelling timers) around the call.

// Replace one item (matched by uid) with the result of `fn`; others unchanged.
export function updateById<T>(items: T[], getUid: (t: T) => string, id: string, fn: (t: T) => T): T[] {
  return items.map((t) => (getUid(t) === id ? fn(t) : t))
}

// Shallow-merge a patch into one item (matched by uid).
export function patchById<T>(
  items: T[],
  getUid: (t: T) => string,
  id: string,
  patch: Partial<T>,
): T[] {
  return updateById(items, getUid, id, (t) => ({ ...t, ...patch }))
}

// Drop one item (matched by uid).
export function removeById<T>(items: T[], getUid: (t: T) => string, id: string): T[] {
  return items.filter((t) => getUid(t) !== id)
}

// Reorder the not-yet-complete items to match `activeUids`, keeping completed /
// skipped items pinned (in their existing order) at the front — the invariant the
// SortableList relies on (done items aren't draggable).
export function reorderKeepingComplete<T>(
  items: T[],
  getUid: (t: T) => string,
  isComplete: (t: T) => boolean,
  activeUids: string[],
): T[] {
  const completed = items.filter(isComplete)
  const byUid = new Map(items.map((t) => [getUid(t), t]))
  const reordered = activeUids.map((u) => byUid.get(u)).filter((t): t is T => t != null)
  return [...completed, ...reordered]
}
