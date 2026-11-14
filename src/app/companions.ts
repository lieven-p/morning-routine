/** The six companions a morning can be started with (EXPERIENCE.md, Companion). */
export const COMPANION_IDS = ['egel', 'muis', 'vos', 'konijn', 'uil', 'schildpad'] as const

export type CompanionId = (typeof COMPANION_IDS)[number]

/** Shown asleep on the calm screen when no companion was picked today. */
export const DEFAULT_COMPANION_ID: CompanionId = 'egel'

export function isCompanionId(value: unknown): value is CompanionId {
  return typeof value === 'string' && (COMPANION_IDS as readonly string[]).includes(value)
}
