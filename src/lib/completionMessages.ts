// Congratulatory phrases (sincere → gently sarcastic) shown as the summary heading.
export const COMPLETION_PHRASES: string[] = [
  'Good work, scrub',
  'Nice work!',
  'Crushed it 💪',
  'Another one in the bank',
  'You showed up — that’s the hard part',
  'Gains incoming',
  'Well, that happened',
  'Not bad for a mortal',
  'Suns out, guns out',
  'Certified moment of effort',
  'The iron respects you now',
  'Look at you, doing the thing',
  'Peak human behaviour',
  'Your future self says thanks',
  'That’s a wrap, champ',
  'Sweat: successfully produced',
  'Objectively, some reps were done',
  'Beast mode: temporarily enabled',
  'Good session, big dog',
]

// Motivational quotes shown in italics below the heading.
export const MOTIVATIONAL_QUOTES: string[] = [
  'The body achieves what the mind believes.',
  'Discipline is choosing between what you want now and what you want most.',
  'Strength does not come from the physical capacity. It comes from an indomitable will.',
  'The only bad workout is the one that didn’t happen.',
  'Success starts with self-discipline.',
  'You don’t have to be extreme, just consistent.',
  'Little by little, a little becomes a lot.',
  'Take care of your body. It’s the only place you have to live.',
  'The pain you feel today will be the strength you feel tomorrow.',
  'Motivation gets you started; habit keeps you going.',
  'Fall in love with the process and the results will come.',
  'Progress, not perfection.',
  'A one-hour workout is 4% of your day.',
  'Sweat is just fat crying.',
  'Don’t count the days, make the days count.',
  'What seems impossible today will one day be your warm-up.',
  'The hardest lift of all is lifting yourself off the couch.',
  'Be stronger than your excuses.',
  'Wake up with determination, go to bed with satisfaction.',
  'Your only limit is you.',
  'Slow progress is still progress.',
  'Nobody ever regretted a workout they finished.',
  'Train insane or remain the same.',
  'It never gets easier, you just get stronger.',
]

function pick(pool: string[]): string {
  return pool[Math.floor(Math.random() * pool.length)]
}

export function randomPhrase(): string {
  return pick(COMPLETION_PHRASES)
}

export function randomQuote(): string {
  return pick(MOTIVATIONAL_QUOTES)
}
