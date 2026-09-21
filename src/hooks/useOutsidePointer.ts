import { useEffect } from 'react'
import type { RefObject } from 'react'

/** Calls `onOutside` when a pointer goes down outside `ref` while `active`. */
export function useOutsidePointer(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  onOutside: () => void,
): void {
  useEffect(() => {
    if (!active) return
    const handler = (event: PointerEvent) => {
      if (ref.current && event.target instanceof Node && !ref.current.contains(event.target)) onOutside()
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [ref, active, onOutside])
}
