import { Car, Companion, TrailPaths } from './Scenery.tsx'

/** Outside a session: the path with the companion asleep, nothing to tap. */
export function CalmScreen({ companionId }: { companionId: string }) {
  return (
    <div className="kids-calm">
      <svg className="kids-paths" viewBox="0 0 1024 640">
        <TrailPaths />
      </svg>
      <Companion companionId={companionId} fraction={0} asleep />
      <Car />
    </div>
  )
}
