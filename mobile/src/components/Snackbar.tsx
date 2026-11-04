import * as Haptics from 'expo-haptics'
import { useEffect, useState } from 'react'
import { AccessibilityInfo, Pressable, View } from 'react-native'
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated'

import { isRecurring } from '@/lib/recurrence'
import type { Occurrence } from '@/types/model'
import { getState, saveTask, setDone } from '../store'
import { useTheme } from '../theme'
import { Text } from '../ui'

const UNDO_MS = 5000

interface SnackbarProps {
  message: string | null
  onUndo: () => void
  /** Distance from the bottom of the positioned parent. */
  bottom?: number
}

/** A small bottom bar with an Undo action. Renders nothing without a message. */
export function Snackbar({ message, onUndo, bottom = 16 }: SnackbarProps) {
  const theme = useTheme()
  if (!message) return null
  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      exiting={FadeOutDown.duration(150)}
      accessibilityLiveRegion="polite"
      style={{ position: 'absolute', left: 16, right: 16, bottom }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingLeft: 16,
          backgroundColor: theme.raised,
          borderColor: theme.lineStrong,
          borderWidth: 1,
          borderRadius: theme.radius(12),
        }}
      >
        <Text size="sm" numberOfLines={1} style={{ flex: 1 }}>
          {message}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Undo"
          onPress={onUndo}
          hitSlop={8}
          style={({ pressed }) => ({ paddingVertical: 12, paddingHorizontal: 16, opacity: pressed ? 0.6 : 1 })}
        >
          <Text size="sm" tone="accent" weight="600">Undo</Text>
        </Pressable>
      </View>
    </Animated.View>
  )
}

interface Entry {
  id: number
  message: string
  undo: () => void
}

/** Holds one undoable action at a time; `snackbar` must be rendered inside a positioned container. */
export function useUndo(bottom?: number) {
  const [entry, setEntry] = useState<Entry | null>(null)

  useEffect(() => {
    if (!entry) return
    const timer = setTimeout(() => setEntry(null), UNDO_MS)
    return () => clearTimeout(timer)
  }, [entry])

  const offer = (message: string, undo: () => void) => {
    setEntry({ id: Date.now(), message, undo })
    // accessibilityLiveRegion is Android-only; VoiceOver needs an explicit announcement.
    AccessibilityInfo.announceForAccessibility(`${message}. Undo available.`)
  }
  const snackbar = (
    <Snackbar
      key={entry?.id}
      message={entry?.message ?? null}
      bottom={bottom}
      onUndo={() => {
        entry?.undo()
        setEntry(null)
      }}
    />
  )
  return { offer, snackbar }
}

/** Toggle an occurrence, with a light haptic and an Undo offer when completing. */
export function useToggleDone() {
  const { offer, snackbar } = useUndo()
  const toggle = (occ: Occurrence) => {
    setDone(occ, !occ.done)
    if (occ.done) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch((error: unknown) => console.warn('Haptics unavailable', error))
    const { status, completedAt } = occ.task
    offer(`Completed “${occ.task.title}”`, () => {
      // Re-read the task so undo keeps edits (or synced changes) made in the meantime.
      const task = getState().tasks.find((t) => t.id === occ.task.id)
      if (!task) return
      if (isRecurring(task) && occ.originalDate) setDone({ ...occ, task }, false)
      // Back to what it was, e.g. "in progress", rather than always "to do".
      else saveTask({ ...task, status, completedAt })
    })
  }
  return { toggle, snackbar }
}
