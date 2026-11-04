import { useState } from 'react'
import { Pressable, TextInput, View } from 'react-native'

import type { Subtask } from '@/types/model'
import { useTheme } from '../theme'
import { Text } from '../ui'

interface Props {
  subtasks: Subtask[]
  onChange: (subtasks: Subtask[]) => void
}

/** Editable checklist: toggle, rename inline, remove, and add at the bottom. */
export function SubtaskList({ subtasks, onChange }: Props) {
  const theme = useTheme()
  const [draft, setDraft] = useState('')
  const update = (id: string, patch: Partial<Subtask>) => onChange(subtasks.map((s) => (s.id === id ? { ...s, ...patch } : s)))

  const add = () => {
    const title = draft.trim()
    if (!title) return
    onChange([...subtasks, { id: crypto.randomUUID(), title, done: false }])
    setDraft('')
  }

  const input = { flex: 1, color: theme.fg, fontSize: 16 * theme.textScale, paddingVertical: 12 }

  return (
    <View style={{ backgroundColor: theme.raised, borderColor: theme.line, borderWidth: 1, borderRadius: theme.radius(12), overflow: 'hidden' }}>
      {subtasks.map((subtask) => (
        <View key={subtask.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 12, borderBottomWidth: 1, borderColor: theme.line }}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: subtask.done }}
            accessibilityLabel={`Mark ${subtask.title || 'subtask'} ${subtask.done ? 'not done' : 'done'}`}
            onPress={() => update(subtask.id, { done: !subtask.done })}
            hitSlop={8}
            style={{
              width: 20,
              height: 20,
              borderRadius: theme.radius(6),
              borderWidth: 2,
              borderColor: subtask.done ? theme.accent : theme.lineStrong,
              backgroundColor: subtask.done ? theme.accent : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {subtask.done && <Text size="xs" tone="accentFg" weight="600" style={{ lineHeight: 14 }}>✓</Text>}
          </Pressable>
          <TextInput
            value={subtask.title}
            onChangeText={(title) => update(subtask.id, { title })}
            accessibilityLabel="Subtask title"
            placeholder="Subtask"
            placeholderTextColor={theme.subtle}
            style={[input, subtask.done && { color: theme.subtle, textDecorationLine: 'line-through' }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${subtask.title || 'subtask'}`}
            onPress={() => onChange(subtasks.filter((s) => s.id !== subtask.id))}
            hitSlop={8}
            style={({ pressed }) => ({ paddingHorizontal: 16, paddingVertical: 12, opacity: pressed ? 0.5 : 1 })}
          >
            <Text tone="subtle">×</Text>
          </Pressable>
        </View>
      ))}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 }}>
        <Text tone="subtle" style={{ width: 20, textAlign: 'center' }}>+</Text>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={add}
          onBlur={add}
          submitBehavior="submit"
          returnKeyType="done"
          accessibilityLabel="Add a subtask"
          placeholder="Add a subtask"
          placeholderTextColor={theme.subtle}
          style={input}
        />
      </View>
    </View>
  )
}
