import { friendlyDate } from '@/lib/dates'
import { useTasksStore } from '@/store/tasks'
import type { Undo } from '@/store/tasks'
import { useUiStore } from '@/store/ui'
import { STATUS_LABEL } from '@/types/model'
import type { Occurrence, Status } from '@/types/model'

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

/** Task mutations that report failures and offer Undo via toasts. */
export function useTaskActions() {
  const store = useTasksStore
  const pushToast = useUiStore.getState().pushToast

  const guard = async (work: () => Promise<void>) => {
    try {
      await work()
    } catch (error) {
      console.error(error)
      pushToast({ message: 'Something went wrong saving that change.' })
    }
  }

  const undoable = (undos: Undo[]) => async () => {
    // Reverse order so several edits to one task unwind correctly.
    for (const undo of [...undos].reverse()) await undo()
  }

  const setDone = (occ: Occurrence, done: boolean) =>
    guard(async () => {
      const undo = await store.getState().setOccurrenceDone(occ, done)
      pushToast({
        message: done ? `Completed “${occ.task.title}”` : `Marked “${occ.task.title}” as not done`,
        actionLabel: 'Undo',
        onAction: () => void undo(),
      })
    })

  const setStatus = (occ: Occurrence, status: Status) =>
    guard(async () => {
      const undo = await store.getState().setOccurrenceStatus(occ, status)
      pushToast({
        message: `Moved “${occ.task.title}” to ${STATUS_LABEL[status]}`,
        actionLabel: 'Undo',
        onAction: () => void undo(),
      })
    })

  const completeMany = (occs: Occurrence[]) =>
    guard(async () => {
      const undos: Undo[] = []
      for (const occ of occs.filter((candidate) => !candidate.done)) {
        undos.push(await store.getState().setOccurrenceDone(occ, true))
      }
      pushToast({
        message: `Completed ${plural(undos.length, 'task')}`,
        actionLabel: 'Undo',
        onAction: () => void undoable(undos)(),
      })
    })

  const move = (occ: Occurrence, date: string) =>
    guard(async () => {
      const undo = await store.getState().moveOccurrence(occ, date)
      pushToast({
        message: `Moved “${occ.task.title}” to ${friendlyDate(date)}`,
        actionLabel: 'Undo',
        onAction: () => void undo(),
      })
    })

  const moveMany = (occs: Occurrence[], date: string) =>
    guard(async () => {
      const undos: Undo[] = []
      for (const occ of occs) undos.push(await store.getState().moveOccurrence(occ, date))
      pushToast({
        message: `Moved ${plural(occs.length, 'task')} to ${friendlyDate(date)}`,
        actionLabel: 'Undo',
        onAction: () => void undoable(undos)(),
      })
    })

  const remove = (taskIds: string[]) =>
    guard(async () => {
      const ids = [...new Set(taskIds)]
      const undo = await store.getState().deleteTasks(ids)
      pushToast({
        message: `Deleted ${plural(ids.length, 'task')}`,
        actionLabel: 'Undo',
        onAction: () => void undo(),
      })
    })

  return { guard, setDone, setStatus, completeMany, move, moveMany, remove }
}
