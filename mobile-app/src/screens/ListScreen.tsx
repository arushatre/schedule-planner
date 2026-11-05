import { useMemo, useState } from 'react'
import { ScrollView, TextInput, View } from 'react-native'

import { friendlyDate } from '@/lib/dates'
import { compareByDue, compareByOrder, listOccurrences } from '@/lib/recurrence'
import { orderAfterMove } from '@/lib/tasks'
import type { Occurrence } from '@/types/model'
import { ReorderList } from '../components/ReorderList'
import { useToggleDone } from '../components/Snackbar'
import { useRefreshControl } from '../components/useRefreshControl'
import { reorderTasks, useStore } from '../store'
import { useTheme } from '../theme'
import { Card, Chip, TaskRow, Text } from '../ui'

interface Props {
  today: string
  onOpen: (taskId: string) => void
  /** Shows pull-to-refresh when given. */
  onRefresh?: () => Promise<void>
}

export function ListScreen({ today, onOpen, onRefresh }: Props) {
  const theme = useTheme()
  const { toggle, snackbar } = useToggleDone()
  const refreshControl = useRefreshControl(onRefresh)
  const { tasks, categories } = useStore()
  const [query, setQuery] = useState('')
  const [showDone, setShowDone] = useState(false)
  const [dragging, setDragging] = useState(false)

  const sections = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const matches = (occ: Occurrence) =>
      !needle || [occ.task.title, occ.task.notes, ...occ.task.tags].some((text) => text.toLowerCase().includes(needle))
    const groups = new Map<string, Occurrence[]>()
    for (const occ of listOccurrences(tasks, today).sort(compareByDue)) {
      if (occ.done !== showDone || !matches(occ)) continue
      const label = occ.date ? (occ.date < today ? 'Overdue' : friendlyDate(occ.date, today)) : 'No date'
      groups.set(label, [...(groups.get(label) ?? []), occ])
    }
    // Sections stay in date order; tasks inside each follow "My order".
    return [...groups].map(([title, data]) => ({ title, data: data.sort(compareByOrder) }))
  }, [tasks, today, query, showDone])

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        scrollEnabled={!dragging}
        refreshControl={refreshControl}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, paddingBottom: 96 }}
      >
        <View style={{ gap: 16, marginBottom: 8 }}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search tasks, notes, tags"
            placeholderTextColor={theme.subtle}
            clearButtonMode="while-editing"
            style={{
              color: theme.fg,
              fontSize: 16 * theme.textScale,
              backgroundColor: theme.raised,
              borderColor: theme.line,
              borderWidth: 1,
              borderRadius: theme.radius(12),
              paddingHorizontal: 16,
              paddingVertical: 12,
            }}
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Chip label="To do" on={!showDone} onPress={() => setShowDone(false)} />
            <Chip label="Done" on={showDone} onPress={() => setShowDone(true)} />
          </View>
        </View>
        {sections.map((section) => (
          <View key={section.title}>
            <Text size="md" display tone={section.title === 'Overdue' ? 'overdue' : 'fg'} accessibilityRole="header" style={{ marginTop: 24, marginBottom: 8 }}>
              {section.title}
            </Text>
            <Card>
              <ReorderList
                items={section.data}
                keyOf={(occ) => occ.key}
                labelOf={(occ) => occ.task.title}
                onDragging={setDragging}
                onMove={(from, to) => reorderTasks(orderAfterMove(section.data, from, to))}
                renderItem={(occ, index, handle) => (
                  <TaskRow
                    occ={occ}
                    categories={categories}
                    today={today}
                    last={index === section.data.length - 1}
                    onToggle={() => toggle(occ)}
                    onOpen={() => onOpen(occ.task.id)}
                    handle={handle}
                  />
                )}
              />
            </Card>
          </View>
        ))}
        {sections.length === 0 && (
          <View style={{ padding: 32, alignItems: 'center', gap: 8 }}>
            <Text display size="md">{query ? 'No matches' : showDone ? 'Nothing finished yet' : 'All clear'}</Text>
            <Text size="sm" tone="muted">{query ? 'Try a different word.' : 'Tasks you add show up here.'}</Text>
          </View>
        )}
      </ScrollView>
      {snackbar}
    </View>
  )
}
