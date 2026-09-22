import { create } from 'zustand'

import { EMPTY_FILTERS } from '@/lib/filters'
import type { Filters, GroupKey, SortKey } from '@/lib/filters'
import { todayStr } from '@/lib/dates'
import { readStored, writeStored } from '@/lib/persist'
import { THEME_KEY, isThemePreference } from '@/lib/theme'
import type { ThemePreference } from '@/lib/theme'

export type View = 'today' | 'list' | 'calendar' | 'insights' | 'kit'
export type ListMode = 'list' | 'board'
export type CalendarMode = 'month' | 'week' | 'day' | 'agenda'
export type Dialog = 'categories' | 'schedule' | 'settings' | 'shortcuts' | null

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
  remindersEnabled: boolean
  setRemindersEnabled: (enabled: boolean) => void

  theme: ThemePreference
  setTheme: (theme: ThemePreference) => void

  view: View
  setView: (view: View) => void

  calendarMode: CalendarMode
  calendarCursor: string
  setCalendarMode: (mode: CalendarMode) => void
  setCalendarCursor: (date: string) => void
  showClasses: boolean
  setShowClasses: (show: boolean) => void

  listMode: ListMode
  setListMode: (mode: ListMode) => void
  filters: Filters
  sort: SortKey
  group: GroupKey
  setFilters: (patch: Partial<Filters>) => void
  clearFilters: () => void
  setSort: (sort: SortKey) => void
  setGroup: (group: GroupKey) => void

  /** Task under the pointer or focus, so `e` knows what to edit. */
  focusedTaskId: string | null
  setFocusedTask: (id: string | null) => void
  /** One-shot request for the list view to focus its search box; consumed on use. */
  searchFocusRequested: boolean
  requestSearchFocus: () => void
  consumeSearchFocus: () => void

  editor: EditorState
  openNewTask: () => void
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

const storedTheme = readStored(THEME_KEY)

export const useUiStore = create<UiState>()((set, get) => ({
  remindersEnabled: readStored('daybook:reminders') === 'true',
  setRemindersEnabled: (remindersEnabled) => {
    writeStored('daybook:reminders', String(remindersEnabled))
    set({ remindersEnabled })
  },

  theme: isThemePreference(storedTheme) ? storedTheme : 'system',
  setTheme: (theme) => {
    writeStored(THEME_KEY, theme)
    set({ theme })
  },

  view: 'today',
  setView: (view) => set({ view }),

  calendarMode: 'month',
  calendarCursor: todayStr(),
  setCalendarMode: (calendarMode) => set({ calendarMode }),
  setCalendarCursor: (calendarCursor) => set({ calendarCursor }),
  showClasses: readStored('daybook:showClasses') !== 'false',
  setShowClasses: (showClasses) => {
    writeStored('daybook:showClasses', String(showClasses))
    set({ showClasses })
  },

  listMode: readStored('daybook:listMode') === 'board' ? 'board' : 'list',
  setListMode: (listMode) => {
    writeStored('daybook:listMode', listMode)
    set({ listMode })
  },
  filters: EMPTY_FILTERS,
  sort: 'due',
  group: 'date',
  setFilters: (patch) => set((state) => ({ filters: { ...state.filters, ...patch } })),
  clearFilters: () => set({ filters: EMPTY_FILTERS }),
  setSort: (sort) => set({ sort }),
  setGroup: (group) => set({ group }),

  focusedTaskId: null,
  setFocusedTask: (focusedTaskId) => set({ focusedTaskId }),
  searchFocusRequested: false,
  requestSearchFocus: () => set({ view: 'list', searchFocusRequested: true }),
  consumeSearchFocus: () => set({ searchFocusRequested: false }),

  editor: null,
  // New tasks start on a sensible date for where you are: Today, or the day you're looking at.
  openNewTask: () => {
    const { view, calendarMode, calendarCursor } = get()
    const dueDate =
      view === 'today' ? todayStr() : view === 'calendar' && calendarMode === 'day' ? calendarCursor : null
    set({ editor: { mode: 'new', dueDate } })
  },
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
