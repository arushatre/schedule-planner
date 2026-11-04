import { format } from 'date-fns'
import { useMemo, useState } from 'react'
import { ScrollView, TextInput, View } from 'react-native'

import { fromDateStr, shiftDate } from '@/lib/dates'
import { compareByDue, expandOccurrences, isOverdue, listOccurrences } from '@/lib/recurrence'
import { parseQuickAdd } from '@/lib/quickAdd'
import { makeTask } from '@/lib/tasks'
import type { Occurrence } from '@/types/model'
import { saveTask, setDone, useStore } from '../store'
import { useTheme } from '../theme'
import { Card, Section, TaskRow, Text } from '../ui'

interface Props {
  today: string
  onOpen: (taskId: string) => void
}

const byDue = (list: Occurrence[]) => [...list].sort(compareByDue)

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export function TodayScreen({ today, onOpen }: Props) {
  const theme = useTheme()
  const { tasks, categories } = useStore()
  const [draft, setDraft] = useState('')

  const { overdue, todays, upcoming } = useMemo(() => {
    const all = listOccurrences(tasks, today)
    return {
      overdue: byDue(all.filter((occ) => isOverdue(occ, today))),
      todays: byDue(expandOccurrences(tasks, today, today)),
      upcoming: byDue(all.filter((occ) => occ.date !== null && occ.date > today && occ.date <= shiftDate(today, 7) && !occ.done)),
    }
  }, [tasks, today])

  const left = todays.filter((occ) => !occ.done).length
  const done = todays.length - left
  const hello = greeting(new Date().getHours())

  const quickAdd = () => {
    const text = draft.trim()
    if (!text) return
    const parsed = parseQuickAdd(text, { today, categories })
    saveTask(
      makeTask({
        title: parsed.title || text,
        categoryId: parsed.categoryId ?? categories[0]?.id ?? '',
        dueDate: parsed.dueDate ?? today,
        dueTime: parsed.dueTime,
        tags: parsed.tags,
        priority: parsed.priority ?? 'medium',
        ...(parsed.recurrence && { recurrence: parsed.recurrence }),
      }),
    )
    setDraft('')
  }

  const list = (occs: Occurrence[], showDate = false) => (
    <Card>
      {occs.map((occ, index) => (
        <TaskRow
          key={occ.key}
          occ={occ}
          categories={categories}
          today={today}
          showDate={showDate}
          last={index === occs.length - 1}
          onToggle={() => setDone(occ, !occ.done)}
          onOpen={() => onOpen(occ.task.id)}
        />
      ))}
    </Card>
  )

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 14, marginTop: 8 }}>
        <Text size="hero" display tone="accent" style={{ lineHeight: 60 }}>
          {format(fromDateStr(today), 'd')}
        </Text>
        <View style={{ paddingBottom: 6, flex: 1 }}>
          <Text tone="muted">{format(fromDateStr(today), 'EEEE, MMMM')}</Text>
          <Text size="md" display>
            {todays.length === 0 ? `${hello}. Nothing planned.` : `${hello}. ${left} left today.`}
          </Text>
        </View>
      </View>

      {todays.length > 0 && (
        <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.sunken, marginTop: 18, overflow: 'hidden' }}>
          <View style={{ width: `${(done / todays.length) * 100}%`, height: '100%', backgroundColor: theme.accent }} />
        </View>
      )}

      <TextInput
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={quickAdd}
        returnKeyType="done"
        placeholder={'Add a task, try "Essay fri 5pm #school"'}
        placeholderTextColor={theme.subtle}
        style={{
          marginTop: 24,
          color: theme.fg,
          fontSize: 16 * theme.textScale,
          backgroundColor: theme.raised,
          borderColor: theme.line,
          borderWidth: 1,
          borderRadius: theme.radius(12),
          paddingHorizontal: 16,
          paddingVertical: 14,
        }}
      />

      {overdue.length > 0 && (
        <Section title="Overdue" count={overdue.length} tone="overdue">
          {list(overdue, true)}
        </Section>
      )}

      <Section title="Today" count={todays.length}>
        {todays.length > 0 ? (
          list(todays)
        ) : (
          <Card>
            <View style={{ padding: 28, alignItems: 'center', gap: 6 }}>
              <Text display size="md">Nothing due today</Text>
              <Text size="sm" tone="muted" style={{ textAlign: 'center' }}>
                Type above to add one, or enjoy the space.
              </Text>
            </View>
          </Card>
        )}
      </Section>

      {upcoming.length > 0 && (
        <Section title="Next 7 days" count={upcoming.length}>
          {list(upcoming, true)}
        </Section>
      )}
    </ScrollView>
  )
}
