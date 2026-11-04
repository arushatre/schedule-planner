import { useMemo, useState } from 'react'
import { SectionList, TextInput, View } from 'react-native'

import { friendlyDate } from '@/lib/dates'
import { compareByDue, listOccurrences } from '@/lib/recurrence'
import type { Occurrence } from '@/types/model'
import { useToggleDone } from '../components/Snackbar'
import { useRefreshControl } from '../components/useRefreshControl'
import { useStore } from '../store'
import { useTheme } from '../theme'
import { Chip, TaskRow, Text } from '../ui'

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
    return [...groups].map(([title, data]) => ({ title, data }))
  }, [tasks, today, query, showDone])

  return (
    <View style={{ flex: 1 }}>
      <SectionList
        sections={sections}
        refreshControl={refreshControl}
        keyExtractor={(occ) => occ.key}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, paddingBottom: 96 }}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
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
        }
        renderSectionHeader={({ section }) => (
          <Text size="md" display tone={section.title === 'Overdue' ? 'overdue' : 'fg'} accessibilityRole="header" style={{ marginTop: 24, marginBottom: 8 }}>
            {section.title}
          </Text>
        )}
        renderItem={({ item, index, section }) => (
          <View
            style={{
              backgroundColor: theme.raised,
              borderColor: theme.line,
              borderLeftWidth: 1,
              borderRightWidth: 1,
              borderTopWidth: index === 0 ? 1 : 0,
              borderBottomWidth: index === section.data.length - 1 ? 1 : 0,
              borderTopLeftRadius: index === 0 ? theme.radius(14) : 0,
              borderTopRightRadius: index === 0 ? theme.radius(14) : 0,
              borderBottomLeftRadius: index === section.data.length - 1 ? theme.radius(14) : 0,
              borderBottomRightRadius: index === section.data.length - 1 ? theme.radius(14) : 0,
              overflow: 'hidden',
            }}
          >
            <TaskRow
              occ={item}
              categories={categories}
              today={today}
              last={index === section.data.length - 1}
              onToggle={() => toggle(item)}
              onOpen={() => onOpen(item.task.id)}
            />
          </View>
        )}
        ListEmptyComponent={
          <View style={{ padding: 32, alignItems: 'center', gap: 8 }}>
            <Text display size="md">{query ? 'No matches' : showDone ? 'Nothing finished yet' : 'All clear'}</Text>
            <Text size="sm" tone="muted">{query ? 'Try a different word.' : 'Tasks you add show up here.'}</Text>
          </View>
        }
      />
      {snackbar}
    </View>
  )
}
