import { create } from 'zustand'

import { EMPTY_FILTERS } from '@/lib/filters'
import type { Filters, GroupKey, SortKey } from '@/lib/filters'
import { todayStr } from '@/lib/dates'

export type View = 'today' | 'list' | 'calendar' | 'kit'
export type CalendarMode = 'month' | 'week' | 'day' | 'agenda'
export type Dialog = 'categories' | 'backup' | null

export type EditorState =
  | { mode: 'new'; dueDate: string | null }
  | { mode: 'edit'; taskId: string }
  | null

export interface Toast {
  id: number
  message: string
  actionLabel?: string
  onAction?: () => void
}

const TOAST_MS = 6000
let toastId = 0

interface UiState {
  view: View
  setView: (view: View) => void

  calendarMode: CalendarMode
  calendarCursor: string
  setCalendarMode: (mode: CalendarMode) => void
  setCalendarCursor: (date: string) => void

  filters: Filters
  sort: SortKey
  group: GroupKey
  setFilters: (patch: Partial<Filters>) => void
  clearFilters: () => void
  setSort: (sort: SortKey) => void
  setGroup: (group: GroupKey) => void

  editor: EditorState
  openEditor: (state: Exclude<EditorState, null>) => void
  closeEditor: () => void

  daySheet: string | null
  openDaySheet: (date: string | null) => void

  dialog: Dialog
  openDialog: (dialog: Dialog) => void

  toasts: Toast[]
  pushToast: (toast: Omit<Toast, 'id'>) => void
  dismissToast: (id: number) => void
}

export const useUiStore = create<UiState>()((set, get) => ({
  view: 'today',
  setView: (view) => set({ view }),

  calendarMode: 'month',
  calendarCursor: todayStr(),
  setCalendarMode: (calendarMode) => set({ calendarMode }),
  setCalendarCursor: (calendarCursor) => set({ calendarCursor }),

  filters: EMPTY_FILTERS,
  sort: 'due',
  group: 'date',
  setFilters: (patch) => set((state) => ({ filters: { ...state.filters, ...patch } })),
  clearFilters: () => set({ filters: EMPTY_FILTERS }),
  setSort: (sort) => set({ sort }),
  setGroup: (group) => set({ group }),

  editor: null,
  openEditor: (editor) => set({ editor }),
  closeEditor: () => set({ editor: null }),

  daySheet: null,
  openDaySheet: (daySheet) => set({ daySheet }),

  dialog: null,
  openDialog: (dialog) => set({ dialog }),

  toasts: [],
  pushToast: (toast) => {
    toastId += 1
    const id = toastId
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }))
    setTimeout(() => get().dismissToast(id), TOAST_MS)
  },
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}))
