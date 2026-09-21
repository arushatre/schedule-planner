import type { FocusEvent, PointerEvent } from 'react'

import { useUiStore } from '@/store/ui'

/**
 * Spread onto a task's element so the `e` shortcut knows which task is targeted.
 * The target clears only when neither the pointer nor keyboard focus is on it.
 */
export function useTaskFocus(taskId: string) {
  const setFocusedTask = useUiStore((state) => state.setFocusedTask)
  return {
    onPointerEnter: () => setFocusedTask(taskId),
    onPointerLeave: (event: PointerEvent<HTMLElement>) => {
      if (!event.currentTarget.contains(document.activeElement)) setFocusedTask(null)
    },
    onFocus: () => setFocusedTask(taskId),
    onBlur: (event: FocusEvent<HTMLElement>) => {
      if (!event.currentTarget.matches(':hover')) setFocusedTask(null)
    },
  }
}
