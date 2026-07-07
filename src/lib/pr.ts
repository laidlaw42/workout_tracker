// Pure PR-detection helpers (extracted from the session screens so the rules
// live in one place and can be unit-tested). The DB side — comparing against the
// stored best and persisting — is checkAndSavePR in src/db/helpers.ts; these
// functions only decide *what* a logged set contributes.

// Whether a logged set met its rep target. An untargeted set (no target reps,
// e.g. a freestyle/added exercise) always counts.
export function repsMet(
  targetReps: number | undefined,
  actualReps: number | undefined,
): boolean {
  return targetReps == null || (actualReps ?? 0) >= targetReps
}

// The weight a set contributes toward a weight PR, or undefined when it should
// not be checked. Bodyweight-loadable moves (pull-up, dip, …) compare their
// *added* load alone — bodyweight isn't tracked in v1, so a set with no added
// load can't set a weight PR; everything else compares the entered bar weight.
export function weightPrValue(
  loadable: boolean | undefined,
  input: { weightKg?: number; additionalWeightKg?: number },
): number | undefined {
  if (loadable) {
    return input.additionalWeightKg != null && input.additionalWeightKg > 0
      ? input.additionalWeightKg
      : undefined
  }
  return input.weightKg
}
