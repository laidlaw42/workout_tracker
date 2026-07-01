import { db } from './db'
import { generateId } from '@/lib/id'
import type { Exercise, IntervalBlock, TemplateExercise, WorkoutTemplate } from '@/types'

type ExerciseSeed = Omit<Exercise, 'id' | 'createdAt'>

const EXERCISES: ExerciseSeed[] = [
  // Strength
  { name: 'Squat', muscleGroups: ['quads', 'glutes'], trackingType: 'reps' },
  { name: 'Romanian deadlift', muscleGroups: ['hamstrings', 'glutes'], trackingType: 'reps' },
  { name: 'Leg press', muscleGroups: ['quads', 'glutes'], trackingType: 'reps' },
  { name: 'Leg curl', muscleGroups: ['hamstrings'], trackingType: 'reps' },
  { name: 'Hip thrust', muscleGroups: ['glutes'], trackingType: 'reps' },
  { name: 'Bench press', muscleGroups: ['chest', 'triceps'], trackingType: 'reps' },
  { name: 'Incline dumbbell press', muscleGroups: ['chest', 'shoulders'], trackingType: 'reps' },
  { name: 'Cable fly', muscleGroups: ['chest'], trackingType: 'reps' },
  { name: 'Overhead press', muscleGroups: ['shoulders', 'triceps'], trackingType: 'reps' },
  { name: 'Lateral raise', muscleGroups: ['shoulders'], trackingType: 'reps' },
  { name: 'Pull-up', muscleGroups: ['back', 'biceps'], trackingType: 'reps' },
  { name: 'Lat pulldown', muscleGroups: ['back', 'biceps'], trackingType: 'reps' },
  { name: 'Seated row', muscleGroups: ['back', 'biceps'], trackingType: 'reps' },
  { name: 'Face pull', muscleGroups: ['shoulders', 'back'], trackingType: 'reps' },
  { name: 'Bicep curl', muscleGroups: ['biceps'], trackingType: 'reps' },
  { name: 'Tricep pushdown', muscleGroups: ['triceps'], trackingType: 'reps' },
  { name: 'Plank', muscleGroups: ['core'], trackingType: 'duration' },
  // Cardio
  { name: 'Run', muscleGroups: [], trackingType: 'distance' },
  { name: 'Ride', muscleGroups: [], trackingType: 'distance' },
  { name: 'Row', muscleGroups: [], trackingType: 'distance' },
]

// [exerciseName, sets, reps, restSeconds]
type Row = [string, number, number, number]

const STRENGTH_TEMPLATES: { name: string; tags: string[]; rows: Row[] }[] = [
  {
    name: 'Push A',
    tags: ['push'],
    rows: [
      ['Bench press', 4, 8, 120],
      ['Overhead press', 3, 10, 120],
      ['Incline dumbbell press', 3, 12, 90],
      ['Lateral raise', 3, 15, 60],
      ['Tricep pushdown', 3, 15, 60],
    ],
  },
  {
    name: 'Pull A',
    tags: ['pull'],
    rows: [
      ['Pull-up', 4, 6, 120],
      ['Seated row', 4, 10, 90],
      ['Lat pulldown', 3, 12, 90],
      ['Face pull', 3, 15, 60],
      ['Bicep curl', 3, 12, 60],
    ],
  },
  {
    name: 'Legs A',
    tags: ['legs'],
    rows: [
      ['Squat', 4, 6, 150],
      ['Romanian deadlift', 3, 10, 120],
      ['Leg press', 3, 12, 120],
      ['Leg curl', 3, 12, 90],
      ['Hip thrust', 3, 10, 90],
    ],
  },
]

const INTERVAL_RIDE: IntervalBlock[] = [
  { repeat: 1, steps: [{ label: 'Warmup', durationSeconds: 300 }] },
  {
    repeat: 8,
    steps: [
      { label: 'Hard', durationSeconds: 120 },
      { label: 'Easy', durationSeconds: 60 },
    ],
  },
  { repeat: 1, steps: [{ label: 'Cooldown', durationSeconds: 300 }] },
]

function buildTemplates(
  idByName: Map<string, string>,
  now: number,
): WorkoutTemplate[] {
  const strength = STRENGTH_TEMPLATES.map<WorkoutTemplate>((t) => ({
    id: generateId(),
    name: t.name,
    type: 'strength',
    tags: t.tags,
    createdAt: now,
    exercises: t.rows.map<TemplateExercise>(([name, sets, reps, rest], order) => ({
      exerciseId: idByName.get(name)!,
      exerciseName: name,
      order,
      defaultSets: sets,
      defaultReps: reps,
      defaultRestSeconds: rest,
    })),
  }))

  const cardio: WorkoutTemplate[] = [
    {
      id: generateId(),
      name: 'Easy run',
      type: 'cardio',
      tags: ['easy'],
      createdAt: now,
      exercises: [],
      cardioActivity: 'run',
      targetDurationSeconds: 1800,
    },
    {
      id: generateId(),
      name: 'Interval ride',
      type: 'cardio',
      tags: ['intervals'],
      createdAt: now,
      exercises: [],
      cardioActivity: 'ride',
      intervals: INTERVAL_RIDE,
    },
  ]

  return [...strength, ...cardio]
}

// First run is detected from IndexedDB (not a localStorage flag), so an import
// never re-triggers seeding and a partial storage clear self-heals.
export async function seedIfNeeded(): Promise<void> {
  await db.transaction('rw', db.exercises, db.templates, async () => {
    const needExercises = (await db.exercises.count()) === 0
    const needTemplates = (await db.templates.count()) === 0
    if (!needExercises && !needTemplates) return

    const now = Date.now()
    const idByName = new Map<string, string>()

    if (needExercises) {
      const records = EXERCISES.map<Exercise>((e) => {
        const id = generateId()
        idByName.set(e.name, id)
        return { ...e, id, createdAt: now }
      })
      await db.exercises.bulkPut(records)
    } else {
      const existing = await db.exercises.toArray()
      for (const e of existing) idByName.set(e.name, e.id)
    }

    if (needTemplates) {
      await db.templates.bulkPut(buildTemplates(idByName, now))
    }
  })
}
