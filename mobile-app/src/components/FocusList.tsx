import { useState } from 'react'
import { Pressable, TextInput, View } from 'react-native'

import { UNCATEGORIZED, categoryFor } from '@/lib/tasks'
import type { Category, Occurrence, Task } from '@/types/model'
import { getState, saveTask } from '../store'
import { useTheme } from '../theme'
import { Card, Text } from '../ui'

/** Saves a change on top of the latest copy of the task, so back-to-back edits don't undo each other. */
export function updateTask(id: string, change: Partial<Task>): void {
  const latest = getState().tasks.find((task) => task.id === id)
  if (latest) saveTask({ ...latest, ...change })
}

function FocusItem({ occ, n, categories, last, onOpen }: { occ: Occurrence; n: number; categories: Category[]; last: boolean; onOpen: () => void }) {
  const theme = useTheme()
  const [draft, setDraft] = useState<string | null>(null)
  const { task } = occ
  const category = categoryFor(task.categoryId, categories)

  const save = () => {
    if (draft === null) return
    const note = draft.trim()
    setDraft(null)
    if (note !== task.focusNote) updateTask(task.id, { focusNote: note })
  }

  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 4,
        borderBottomWidth: last ? 0 : 1,
        borderColor: theme.line,
        backgroundColor: category === UNCATEGORIZED ? undefined : theme.category(category.colorKey, theme.tint),
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable accessibilityRole="button" onPress={onOpen} style={{ flex: 1 }}>
          <Text numberOfLines={1} tone={occ.done ? 'subtle' : 'fg'} style={occ.done ? { textDecorationLine: 'line-through' } : undefined}>
            <Text tone="muted">{`${n}. `}</Text>
            {task.title}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${task.title} from focus`}
          onPress={() => updateTask(task.id, { focusDate: null })}
          hitSlop={8}
          style={({ pressed }) => ({ paddingHorizontal: 4, opacity: pressed ? 0.6 : 1 })}
        >
          <Text size="sm" tone="subtle">✕</Text>
        </Pressable>
      </View>
      {draft !== null ? (
        <TextInput
          autoFocus
          value={draft}
          onChangeText={setDraft}
          onBlur={save}
          onSubmitEditing={save}
          returnKeyType="done"
          maxLength={2000}
          placeholder="Add a note"
          placeholderTextColor={theme.subtle}
          accessibilityLabel={`Focus note for ${task.title}`}
          style={{
            color: theme.fg,
            fontSize: 14 * theme.textScale,
            borderColor: theme.lineStrong,
            borderWidth: 1,
            borderRadius: theme.radius(8),
            paddingHorizontal: 10,
            paddingVertical: 6,
            backgroundColor: theme.raised,
          }}
        />
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel={`Edit focus note for ${task.title}`} onPress={() => setDraft(task.focusNote)}>
          <Text size="sm" tone={task.focusNote ? 'muted' : 'subtle'}>{task.focusNote || 'Add a note'}</Text>
        </Pressable>
      )}
    </View>
  )
}

/** Today's pinned tasks, numbered in "My order"; tap a note to edit it. */
export function FocusList({ occs, categories, onOpen }: { occs: Occurrence[]; categories: Category[]; onOpen: (taskId: string) => void }) {
  if (occs.length === 0) {
    return (
      <Text size="sm" tone="muted">
        Tap ☆ on any of today’s tasks to keep it in focus here.
      </Text>
    )
  }
  return (
    <Card>
      {occs.map((occ, index) => (
        <FocusItem key={occ.key} occ={occ} n={index + 1} categories={categories} last={index === occs.length - 1} onOpen={() => onOpen(occ.task.id)} />
      ))}
    </Card>
  )
}
