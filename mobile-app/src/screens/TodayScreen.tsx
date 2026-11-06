import { format } from 'date-fns'
import { useMemo, useState } from 'react'
import { Pressable, ScrollView, TextInput, View } from 'react-native'
import Storage from 'expo-sqlite/kv-store'

import { formatTime, friendlyDate, fromDateStr, greetingFor, shiftDate } from '@/lib/dates'
import { compareByDue, compareByOrder, expandOccurrences, isOverdue, listOccurrences } from '@/lib/recurrence'
import { parseQuickAdd } from '@/lib/quickAdd'
import { computeStats } from '@/lib/stats'
import { categoryFor, defaultCategoryId, makeTask, orderAfterMove } from '@/lib/tasks'
import type { Occurrence } from '@/types/model'
import { FocusList, updateTask } from '../components/FocusList'
import { ReorderList } from '../components/ReorderList'
import { useToggleDone } from '../components/Snackbar'
import { StreakBadge } from '../components/StreakSheet'
import { TodaySchedule } from '../components/TodaySchedule'
import { useRefreshControl } from '../components/useRefreshControl'
import { WeekStrip } from '../components/WeekStrip'
import { reorderTasks, saveTask, useStore } from '../store'
import { useTheme } from '../theme'
import { Card, Section, TaskRow, Text } from '../ui'

interface Props {
  today: string
  onOpen: (taskId: string) => void
  /** Shows pull-to-refresh when given. */
  onRefresh?: () => Promise<void>
}

const byDue = (list: Occurrence[]) => [...list].sort(compareByDue)
const byOrder = (list: Occurrence[]) => [...list].sort(compareByOrder)
const OVERDUE_OPEN_KEY = 'daybook:overdue-open'

export function TodayScreen({ today, onOpen, onRefresh }: Props) {
  const theme = useTheme()
  const { tasks, categories, classBlocks, prefs } = useStore()
  const { personal } = prefs
  const [overdueOpen, setOverdueOpen] = useState(() => Storage.getItemSync(OVERDUE_OPEN_KEY) !== 'false')
  const [draft, setDraft] = useState('')
  const [dragging, setDragging] = useState(false)
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

  const { overdue, todays, dayOccs, upcoming, stats } = useMemo(() => {
    const all = listOccurrences(tasks, today)
    return {
      overdue: byDue(all.filter((occ) => isOverdue(occ, today))),
      todays: byDue(expandOccurrences(tasks, today, today)),
      // Day lists follow "My order"; Next up, Overdue and the schedule stay in time order.
      dayOccs: byOrder(expandOccurrences(tasks, selected, selected)),
      upcoming: all
        .filter((occ) => occ.date !== null && occ.date > today && occ.date <= shiftDate(today, 7) && !occ.done)
        .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || compareByOrder(a, b)),
      stats: computeStats(tasks, today),
    }
  }, [tasks, today, selected])

  const doneToday = todays.filter((occ) => occ.done).length
  const focused = byOrder(todays.filter((occ) => occ.task.focusDate === today))
  const nowTime = format(new Date(), 'HH:mm')
  const open = todays.filter((occ) => !occ.done)
  const next = open.find((occ) => occ.task.dueTime !== null && occ.task.dueTime >= nowTime) ?? open[0]
  const nextCategory = next ? categoryFor(next.task.categoryId, categories) : null
  const dayTitle = isToday ? 'Tasks' : friendlyDate(selected, today)
  const toggleOverdue = () => {
    Storage.setItemSync(OVERDUE_OPEN_KEY, String(!overdueOpen))
    setOverdueOpen(!overdueOpen)
  }

  const quickAdd = () => {
    const text = draft.trim()
    if (!text) return
    const parsed = parseQuickAdd(text, { today, categories })
    saveTask(
      makeTask({
        title: parsed.title || text,
        categoryId: parsed.categoryId ?? defaultCategoryId(categories, personal.defaultCategoryId),
        dueDate: parsed.dueDate ?? selected,
        dueTime: parsed.dueTime,
        tags: parsed.tags,
        priority: parsed.priority ?? personal.defaultPriority,
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

  // One reorderable run per date inside a single card; a row can't be dragged to another date.
  const sortable = (occs: Occurrence[], showDate = false, pinnable = false) => {
    const runs = new Map<string, Occurrence[]>()
    for (const occ of occs) runs.set(occ.date ?? '', [...(runs.get(occ.date ?? '') ?? []), occ])
    const lastKey = occs[occs.length - 1]?.key
    return (
      <Card>
        {[...runs].map(([date, run]) => (
          <ReorderList
            key={date}
            items={run}
            keyOf={(occ) => occ.key}
            labelOf={(occ) => occ.task.title}
            onDragging={setDragging}
            onMove={(from, to) => reorderTasks(orderAfterMove(run, from, to))}
            renderItem={(occ, _index, handle) => (
              <TaskRow
                occ={occ}
                categories={categories}
                today={today}
                showDate={showDate}
                last={occ.key === lastKey}
                onToggle={() => toggle(occ)}
                onOpen={() => onOpen(occ.task.id)}
                handle={handle}
                pinned={occ.task.focusDate === today}
                onPin={pinnable ? () => updateTask(occ.task.id, { focusDate: occ.task.focusDate === today ? null : today }) : undefined}
              />
            )}
          />
        ))}
      </Card>
    )
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        scrollEnabled={!dragging}
        contentContainerStyle={{ padding: 20, paddingBottom: 96 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={refreshControl}
      >
        <Text size="xs" tone="muted" style={{ marginTop: 4, letterSpacing: 0.6 }}>
          {format(fromDateStr(today), 'EEEE, MMMM d').toUpperCase()}
        </Text>
        <Text size="xl" display accessibilityRole="header" style={{ marginTop: 4 }}>
          {greetingFor(new Date().getHours(), personal.name)}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 16, rowGap: 6, marginTop: 6 }}>
          <Text size="sm" tone="muted">
            <Text size="sm" weight="600">{`${doneToday} of ${todays.length}`}</Text> done today
          </Text>
          <StreakBadge today={today} />
          <Text size="sm" tone="muted">
            <Text size="sm" weight="600">{stats.doneThisWeek}</Text> this week
          </Text>
        </View>

        <WeekStrip key={today} today={today} selected={selected} tasks={tasks} categories={categories} onSelect={setSelected} />

        {personal.showNextUp && isToday && next && nextCategory && (
          <View style={{ marginTop: 24, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: theme.raised, borderWidth: 1, borderColor: theme.line, borderRadius: theme.radius(14) }}>
            <Pressable accessibilityRole="button" onPress={() => onOpen(next.task.id)} style={{ flex: 1, gap: 2 }}>
              <Text size="xs" tone="muted">{`Next up${next.task.dueTime ? ` · ${formatTime(next.task.dueTime)}` : ''}`}</Text>
              <Text size="lg" display numberOfLines={1}>{next.task.title}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: theme.category(nextCategory.colorKey) }} />
                <Text size="xs" tone="muted">{nextCategory.name}</Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Mark ${next.task.title} done`}
              onPress={() => toggle(next)}
              style={({ pressed }) => ({ borderWidth: 1, borderColor: theme.lineStrong, borderRadius: theme.radius(8), paddingHorizontal: 12, paddingVertical: 8, opacity: pressed ? 0.7 : 1 })}
            >
              <Text size="sm" weight="500">✓ Done</Text>
            </Pressable>
          </View>
        )}

        {isToday && (
          <Section title="Focus for today" count={focused.length > 0 ? focused.length : undefined}>
            <FocusList occs={focused} categories={categories} onOpen={onOpen} />
          </Section>
        )}

        {/* Only shown when something is overdue; collapses, and the phone remembers that. */}
        {isToday && overdue.length > 0 && (
          <View style={{ marginTop: 32, gap: 8 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: overdueOpen }}
              accessibilityLabel={`Overdue, ${overdue.length}`}
              onPress={toggleOverdue}
              hitSlop={8}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              <Text size="sm" weight="600" style={{ letterSpacing: 0.6 }}>OVERDUE</Text>
              <Text size="sm" tone="subtle">{overdue.length}</Text>
              <Text tone="muted" style={{ marginLeft: 'auto', transform: [{ rotate: overdueOpen ? '90deg' : '0deg' }] }}>›</Text>
            </Pressable>
            {overdueOpen && list(overdue, true)}
          </View>
        )}

        {personal.showSchedule && (
          <Section title={isToday ? 'Today’s schedule' : `Schedule · ${friendlyDate(selected, today)}`}>
            <TodaySchedule date={selected} today={today} occs={dayOccs} categories={categories} classBlocks={classBlocks} onOpen={onOpen} />
          </Section>
        )}

        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={quickAdd}
          returnKeyType="done"
          placeholder={'Add a task, try "Essay fri 5pm #school"'}
          placeholderTextColor={theme.subtle}
          style={{
            marginTop: 32,
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

        <Section title={dayTitle} count={dayOccs.length}>
          {dayOccs.length > 0 ? (
            sortable(dayOccs, false, isToday)
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

        {personal.showUpcoming && isToday && upcoming.length > 0 && (
          <Section title="Next 7 days" count={upcoming.length}>
            {sortable(upcoming, true)}
          </Section>
        )}
      </ScrollView>
      {snackbar}
    </View>
  )
}
