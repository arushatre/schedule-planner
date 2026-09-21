import { create } from 'zustand'

export type View = 'today' | 'list' | 'calendar' | 'kit'

interface UiState {
  view: View
  setView: (view: View) => void
}

export const useUiStore = create<UiState>()((set) => ({
  view: 'today',
  setView: (view) => set({ view }),
}))
