import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { CANVAS_HEIGHT, CANVAS_WIDTH } from './trail.ts'

const MIN_HIT_PX = 48

const viewportScale = (): number => Math.min(window.innerWidth / CANVAS_WIDTH, window.innerHeight / CANVAS_HEIGHT)

/** The 1024 × 640 reference canvas, scaled uniformly to the viewport and letterboxed with meadow (DESIGN.md, Layout). */
export function ScaledCanvas({ children }: { children?: ReactNode }) {
  const [scale, setScale] = useState(viewportScale)

  useEffect(() => {
    const update = () => setScale(viewportScale())
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const style = {
    transform: `translate(-50%, -50%) scale(${scale})`,
    // Smallest touch target in canvas px that is still 48 CSS px on screen.
    '--hit-min': `${Math.ceil(MIN_HIT_PX / scale)}px`,
  } as CSSProperties

  return (
    <div className="kids-viewport">
      <div className="kids-canvas" style={style}>
        {children}
      </div>
    </div>
  )
}
