import { format } from 'date-fns'
import { useMemo, useState } from 'react'
import { ScrollView, TextInput, View } from 'react-native'

import { friendlyDate, fromDateStr, shiftDate } from '@/lib/dates'
import { compareByDue, expandOccurrences, isOverdue, listOccurrences } from '@/lib/recurrence'
import { parseQuickAdd } from '@/lib/quickAdd'
import { makeTask } from '@/lib/tasks'
import type { Occurrence } from '@/types/model'
import { useToggleDone } from '../components/Snackbar'
import { useRefreshControl } from '../components/useRefreshControl'
import { WeekStrip } from '../components/WeekStrip'
import { saveTask, useStore } from '../store'
import { useTheme } from '../theme'
import { Card, Section, TaskRow, Text } from '../ui'

interface Props {
  today: string
  onOpen: (taskId: string) => void
  /** Shows pull-to-refresh when given. */
  onRefresh?: () => Promise<void>
}

const byDue = (list: Occurrence[]) => [...list].sort(compareByDue)

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export function TodayScreen({ today, onOpen, onRefresh }: Props) {
  const theme = useTheme()
  const { tasks, categories } = useStore()
  const [draft, setDraft] = useState('')
  const [selected, setSelected] = useState(today)
  const { toggle, snackbar } = useToggleDone()
  const refreshControl = useRefreshControl(onRefresh)

  // Crossing midnight moves the selection to the new today.
  const [shownToday, setShownToday] = useState(today)
  if (shownToday !== today) {
    setShownToday(today)
    setSelected(today)
  }
  const isToday = selected === today

  const { overdue, todays, upcoming } = useMemo(() => {
    const all = listOccurrences(tasks, today)
    return {
      overdue: byDue(all.filter((occ) => isOverdue(occ, today))),
      todays: byDue(expandOccurrences(tasks, selected, selected)),
      upcoming: byDue(all.filter((occ) => occ.date !== null && occ.date > today && occ.date <= shiftDate(today, 7) && !occ.done)),
    }
  }, [tasks, today, selected])

  const left = todays.filter((occ) => !occ.done).length
  const done = todays.length - left
  const hello = greeting(new Date().getHours())
  const headline = isToday
    ? todays.length === 0
      ? `${hello}. Nothing planned.`
      : `${hello}. ${left} left today.`
    : todays.length === 0
      ? 'Nothing planned.'
      : `${left} of ${todays.length} left.`
  const dayTitle = isToday ? 'Today' : friendlyDate(selected, today)

  const quickAdd = () => {
    const text = draft.trim()
    if (!text) return
    const parsed = parseQuickAdd(text, { today, categories })
    saveTask(
      makeTask({
        title: parsed.title || text,
        categoryId: parsed.categoryId ?? categories[0]?.id ?? '',
        dueDate: parsed.dueDate ?? selected,
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
          onToggle={() => toggle(occ)}
          onOpen={() => onOpen(occ.task.id)}
        />
      ))}
    </Card>
  )

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 96 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={refreshControl}
      >
        {/* The day's card: date, greeting and progress together, like the web hero. */}
        <View
          style={{
            marginTop: 8,
            padding: 18,
            gap: 14,
            backgroundColor: theme.raised,
            borderWidth: 1,
            borderColor: theme.line,
            borderRadius: theme.radius(16),
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 16 }}>
            <Text size="hero" display tone="accent" style={{ lineHeight: 60 }}>
              {format(fromDateStr(selected), 'd')}
            </Text>
            <View style={{ paddingBottom: 8, flex: 1 }}>
              <Text tone="muted">{format(fromDateStr(selected), 'EEEE, MMMM')}</Text>
              <Text size="md" display>
                {headline}
              </Text>
            </View>
          </View>

          {todays.length > 0 && (
            <View
              style={{
                height: 6,
                borderRadius: 3,
                backgroundColor: theme.sunken,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: `${(done / todays.length) * 100}%`,
                  height: '100%',
                  backgroundColor: theme.accent,
                }}
              />
            </View>
          )}
        </View>

        <WeekStrip key={today} today={today} selected={selected} tasks={tasks} categories={categories} onSelect={setSelected} />

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

        {isToday && overdue.length > 0 && (
          <Section title="Overdue" count={overdue.length} tone="overdue">
            {list(overdue, true)}
          </Section>
        )}

        <Section title={dayTitle} count={todays.length}>
          {todays.length > 0 ? (
            list(todays)
          ) : (
            <Card>
              <View style={{ padding: 32, alignItems: 'center', gap: 8 }}>
                <Text display size="md">
                  {isToday ? 'Nothing due today' : 'Nothing due'}
                </Text>
                <Text size="sm" tone="muted" style={{ textAlign: 'center' }}>
                  Type above to add one, or enjoy the space.
                </Text>
              </View>
            </Card>
          )}
        </Section>

        {isToday && upcoming.length > 0 && (
          <Section title="Next 7 days" count={upcoming.length}>
            {list(upcoming, true)}
          </Section>
        )}
      </ScrollView>
      {snackbar}
    </View>
  )
}
