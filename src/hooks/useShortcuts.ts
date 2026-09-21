import { useEffect } from 'react'

import { isTypingTarget, matchShortcut } from '@/lib/shortcuts'
import { useTasksStore } from '@/store/tasks'
import { useUiStore } from '@/store/ui'

/** Global keyboard shortcuts. Mount once, after the app is ready. */
export function useShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const { ready, error } = useTasksStore.getState()
      if (!ready || error) return
      const ui = useUiStore.getState()
      const modalOpen = ui.editor !== null || ui.dialog !== null || ui.daySheet !== null

      if (event.key === 'Escape') {
        // Dialogs handle Esc themselves when focus is inside them; this catches focus on <body>.
        if (ui.editor) ui.closeEditor()
        else if (ui.dialog) ui.openDialog(null)
        else if (ui.daySheet) ui.openDaySheet(null)
        return
      }

      const action = matchShortcut(event, { typing: isTypingTarget(event.target), modalOpen })
      if (!action) return
      event.preventDefault()

      switch (action) {
        case 'new':
          ui.openNewTask()
          break
        case 'search':
          ui.requestSearchFocus()
          break
        case 'help':
          ui.openDialog('shortcuts')
          break
        case 'edit': {
          const id = ui.focusedTaskId
          if (id && useTasksStore.getState().tasks.some((task) => task.id === id)) {
            ui.openEditor({ mode: 'edit', taskId: id })
          } else {
            ui.pushToast({ message: 'Point at or focus a task, then press E to edit it.' })
          }
          break
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
