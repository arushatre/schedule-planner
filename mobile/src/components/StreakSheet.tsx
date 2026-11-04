import { format, startOfWeek } from 'date-fns'
import { useMemo, useRef, useState } from 'react'
import { Animated, Modal, Pressable, ScrollView, View } from 'react-native'

import { activeDays, activityByDay, currentRun, streakRuns, streakTier } from '@/lib/activity'
import type { StreakRun } from '@/lib/activity'
import { WEEK_OPTIONS, friendlyDate, fromDateStr, shiftDate, toDateStr } from '@/lib/dates'
import { useStore } from '../store'
import { useTheme } from '../theme'
import { Text } from '../ui'

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`
const day = (date: string) => format(fromDateStr(date), 'EEE, MMM d')
const span = (run: StreakRun) => (run.days === 1 ? day(run.start) : `${day(run.start)} – ${day(run.end)}`)
/** Spark offsets (pt) for the tiny press fireworks: two small bursts above the badge. */
const SPARKS = [[-10, -14], [0, -18], [10, -14], [-14, -4], [14, -4], [-8, -10], [8, -10], [0, -8]] as const

/** 🔥 streak for Today's stats line: ember from day one, livelier as it grows. Tap for the history. */
export function StreakBadge({ today }: { today: string }) {
  const theme = useTheme()
  const { tasks, activity } = useStore()
  const [open, setOpen] = useState(false)
  const burst = useRef(new Animated.Value(0)).current
  const runs = useMemo(() => streakRuns(activeDays(activity, tasks)), [activity, tasks])
  const current = currentRun(runs, today)?.days ?? 0
  const tier = streakTier(current)

  // Phones have no hover, so the >5-day fireworks play when you press the streak.
  const fireworks = () => {
    if (tier < 3) return
    burst.setValue(0)
    Animated.timing(burst, { toValue: 1, duration: 800, useNativeDriver: true }).start()
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${current > 0 ? `${current}-day streak` : 'No streak yet'}. Show streak history.`}
        onPressIn={fireworks}
        onPress={() => setOpen(true)}
        hitSlop={8}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: pressed ? 0.8 : 1 })}
      >
        <Text size="sm" style={tier === 0 ? { opacity: 0.5 } : undefined}>🔥</Text>
        <Text size="sm" weight={tier >= 3 ? '600' : '400'} style={{ color: tier === 0 ? theme.muted : theme.ember(tier === 1 ? 0.75 : 1) }}>
          {current > 0 ? `${current}-day streak` : 'Start a streak'}
        </Text>
        {tier === 4 && (
          <Text size="xs" weight="600" style={{ color: theme.ember(), letterSpacing: 0.6 }}>ON FIRE</Text>
        )}
        {tier >= 3 && (
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
            {SPARKS.map(([dx, dy], index) => (
              <Animated.View
                key={index}
                style={{
                  position: 'absolute',
                  top: 2,
                  left: index % 2 ? '78%' : '18%',
                  width: 2.5,
                  height: 2.5,
                  borderRadius: 2,
                  backgroundColor: index % 2 ? '#E8A33C' : theme.ember(),
                  opacity: burst.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 1, 0.8, 0] }),
                  transform: [
                    { translateX: burst.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0, dx, dx] }) },
                    { translateY: burst.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0, dy, dy + 3] }) },
                  ],
                }}
              />
            ))}
          </View>
        )}
      </Pressable>
      <StreakSheet open={open} onClose={() => setOpen(false)} runs={runs} today={today} />
    </>
  )
}

function StreakSheet({ open, onClose, runs, today }: { open: boolean; onClose: () => void; runs: StreakRun[]; today: string }) {
  const theme = useTheme()
  const { tasks, activity } = useStore()
  const byDay = useMemo(() => activityByDay(activity), [activity])
  const days = useMemo(() => activeDays(activity, tasks), [activity, tasks])
  const current = currentRun(runs, today)
  const longest = runs.reduce((max, run) => Math.max(max, run.days), 0)
  const gridStart = shiftDate(toDateStr(startOfWeek(fromDateStr(today), WEEK_OPTIONS)), -28)
  const weeks = Array.from({ length: 5 }, (_, week) => Array.from({ length: 7 }, (_, index) => shiftDate(gridStart, week * 7 + index)))
  const recent = [...days].sort().reverse().slice(0, 14)

  const card = { borderWidth: 1, borderColor: theme.line, borderRadius: theme.radius(10), padding: 12, backgroundColor: theme.raised }

  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.canvas }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: theme.line }}>
          <Text size="md" display>Streak history</Text>
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={10}>
            <Text tone="accent" weight="600">Done</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 24, paddingBottom: 48 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[
              ['Current', current ? plural(current.days, 'day') : '—'],
              ['Longest', longest ? plural(longest, 'day') : '—'],
              ['Active days', String(days.size)],
            ].map(([label, value]) => (
              <View key={label} style={[card, { flex: 1 }]}>
                <Text size="xs" tone="muted">{label}</Text>
                <Text size="md" display>{value}</Text>
              </View>
            ))}
          </View>

          <View style={{ gap: 6 }}>
            <Text size="sm" tone="muted" weight="600">Last 5 weeks</Text>
            {weeks.map((week) => (
              <View key={week[0]} style={{ flexDirection: 'row', gap: 4 }}>
                {week.map((date) => (
                  <View
                    key={date}
                    accessibilityLabel={`${day(date)}: ${days.has(date) ? 'active' : 'no activity'}`}
                    style={{
                      width: 32,
                      height: 20,
                      borderRadius: 3,
                      backgroundColor: days.has(date) ? theme.ember(0.7) : theme.sunken,
                      opacity: date > today ? 0.4 : 1,
                      borderWidth: date === today ? 1 : 0,
                      borderColor: theme.muted,
                    }}
                  />
                ))}
              </View>
            ))}
          </View>

          <View style={{ gap: 8 }}>
            <Text size="sm" tone="muted" weight="600">Streaks</Text>
            {runs.length === 0 && <Text tone="muted">No streaks yet. Add or finish a task to start one.</Text>}
            {[...runs].reverse().slice(0, 12).map((run) => (
              <View key={run.start} style={[card, { flexDirection: 'row', justifyContent: 'space-between', gap: 12 }]}>
                <View style={{ flex: 1 }}>
                  <Text>{run === current ? 'Current streak' : `Ended ${day(run.end)}`}</Text>
                  <Text size="xs" tone="muted">
                    {run.gapBefore === null ? 'Started' : `Restarted after ${plural(run.gapBefore, 'day')} off`} · {span(run)}
                  </Text>
                </View>
                <Text weight="600">{plural(run.days, 'day')}</Text>
              </View>
            ))}
          </View>

          <View style={{ gap: 6 }}>
            <Text size="sm" tone="muted" weight="600">When you used Daybook</Text>
            {recent.map((date) => {
              const times = byDay.get(date) ?? []
              const label =
                times.length === 0
                  ? 'Finished tasks'
                  : times.length > 4
                    ? `${format(times[0]!, 'h:mm a')} – ${format(times[times.length - 1]!, 'h:mm a')} · ${times.length}×`
                    : times.map((at) => format(at, 'h:mm a')).join(', ')
              return (
                <View key={date} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                  <Text size="sm" weight="500">{friendlyDate(date, today)}</Text>
                  <Text size="sm" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>{label}</Text>
                </View>
              )
            })}
          </View>
        </ScrollView>
      </View>
    </Modal>
  )
}
