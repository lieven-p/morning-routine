import type { Child, Routine, Task } from '../domain/types.ts'
import type { Repository } from './ports.ts'

const TUESDAY = 2

/**
 * Stand-in family for the first story that shows data; story 9 replaces it with the first-run flow and must let a
 * parent clear it. Zoon and Dochter are the stand-in names from EXPERIENCE.md, not the family's names.
 */
export function buildSampleFamily(newId: () => string = () => crypto.randomUUID()): { children: Child[]; routine: Routine } {
  // The repository lists children by id, so the first child (upper lane) gets the lower id until children carry an order.
  const [zoonId, dochterId] = [newId(), newId()].sort()
  const zoon: Child = { id: zoonId, name: 'Zoon', avatar: { kind: 'illustration', key: 'avatar-zoon' } }
  const dochter: Child = { id: dochterId, name: 'Dochter', avatar: { kind: 'illustration', key: 'avatar-dochter' } }

  const task = (name: string, key: string, owner: Task['owner'], extra: Partial<Task> = {}): Task => ({
    id: newId(),
    name,
    owner,
    locked: false,
    picture: { kind: 'illustration', key },
    ...extra,
  })
  const own = (child: Child) => ({ kind: 'child', childId: child.id }) as const

  const routine: Routine = {
    id: newId(),
    name: 'Normaal',
    start: '07:15',
    departure: '08:05',
    soundOn: true,
    tasks: [
      task('Plassen', 'plassen', own(zoon)),
      task('Aankleden', 'aankleden', own(zoon)),
      task('Ontbijten', 'ontbijten', own(zoon)),
      task('Tanden poetsen', 'tanden', own(zoon), { guideMinutes: 2 }),
      task('Ontbijten', 'ontbijten', own(dochter)),
      task('Tanden poetsen', 'tanden', own(dochter), { guideMinutes: 2 }),
      task('Turnzak', 'turnzak', own(zoon), { weekdays: [TUESDAY] }),
      task('Schoenen aan', 'schoenen', { kind: 'departure' }, { locked: true, guideMinutes: 2 }),
      task('Jas aan', 'jas', { kind: 'departure' }, { locked: true, guideMinutes: 3 }),
    ],
  }
  return { children: [zoon, dochter], routine }
}

/**
 * Writes the stand-in family when there are no children and no routines, and makes its routine the default.
 * Returns whether anything was written; with any child or routine present it changes nothing, so repeating it is a no-op.
 */
export async function seedSampleFamily(repository: Repository, newId?: () => string): Promise<boolean> {
  const [children, routines] = await Promise.all([repository.listChildren(), repository.listRoutines()])
  if (children.length > 0 || routines.length > 0) return false
  const family = buildSampleFamily(newId)
  for (const child of family.children) await repository.putChild(child)
  await repository.putRoutine(family.routine)
  await repository.setDefaultRoutineId(family.routine.id)
  return true
}
