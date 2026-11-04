import { format, startOfWeek } from 'date-fns'
import { useMemo, useState } from 'react'
import { Pressable, View } from 'react-native'

import { WEEK_OPTIONS, daysBetween, fromDateStr, shiftDate, toDateStr } from '@/lib/dates'
import type { PaletteKey } from '@/lib/palette'
import { expandOccurrences } from '@/lib/recurrence'
import { categoryFor } from '@/lib/tasks'
import type { Category, Task } from '@/types/model'
import { useTheme } from '../theme'
import { Text } from '../ui'

const MAX_DOTS = 3
const weekOf = (date: string) => toDateStr(startOfWeek(fromDateStr(date), WEEK_OPTIONS))

interface Props {
  today: string
  selected: string
  tasks: Task[]
  categories: Category[]
  onSelect: (date: string) => void
}

function Arrow({ label, glyph, onPress }: { label: string; glyph: string; onPress: () => void }) {
  const theme = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({ width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius(8), backgroundColor: pressed ? theme.sunken : 'transparent' })}
    >
      <Text size="md" tone="muted">{glyph}</Text>
    </Pressable>
  )
}

/** Mon–Sun strip with open-task dots; tapping a day selects it. */
export function WeekStrip({ today, selected, tasks, categories, onSelect }: Props) {
  const theme = useTheme()
  const [start, setStart] = useState(() => weekOf(selected))
  const end = shiftDate(start, 6)
  const days = daysBetween(start, end)

  const dots = useMemo(() => {
    const byDate = new Map<string, { keys: PaletteKey[]; open: number }>()
    for (const occ of expandOccurrences(tasks, start, end)) {
      if (occ.done || !occ.date) continue
      const entry = byDate.get(occ.date) ?? { keys: [], open: 0 }
      entry.open += 1
      if (entry.keys.length < MAX_DOTS) entry.keys.push(categoryFor(occ.task.categoryId, categories).colorKey)
      byDate.set(occ.date, entry)
    }
    return byDate
  }, [tasks, categories, start, end])

  const away = start !== weekOf(today) || selected !== today

  return (
    <View style={{ marginTop: 24, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text size="sm" tone="muted" weight="500" style={{ flex: 1 }}>
          {format(fromDateStr(shiftDate(start, 3)), 'MMMM yyyy')}
        </Text>
        {away && (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setStart(weekOf(today))
              onSelect(today)
            }}
            hitSlop={8}
            style={({ pressed }) => ({ paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.radius(8), backgroundColor: pressed ? theme.sunken : 'transparent' })}
          >
            <Text size="sm" tone="accent" weight="500">This week</Text>
          </Pressable>
        )}
        <Arrow label="Previous week" glyph="‹" onPress={() => setStart(shiftDate(start, -7))} />
        <Arrow label="Next week" glyph="›" onPress={() => setStart(shiftDate(start, 7))} />
      </View>

      {/* Mustard band: "the days ahead". */}
      <View
        style={{
          flexDirection: 'row',
          gap: 4,
          padding: 4,
          backgroundColor: theme.mustardWash,
          borderWidth: 1,
          borderColor: theme.edge('mustard', 0.4),
          borderRadius: theme.radius(14),
        }}
      >
        {days.map((day) => {
          const date = fromDateStr(day)
          const on = day === selected
          const info = dots.get(day)
          return (
            <Pressable
              key={day}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${format(date, 'EEEE, MMMM d')}${day === today ? ', today' : ''}, ${info?.open ?? 0} open`}
              onPress={() => onSelect(day)}
              style={{ flex: 1, alignItems: 'center', gap: 4 }}
            >
              <View
                style={{
                  alignSelf: 'stretch',
                  alignItems: 'center',
                  paddingVertical: 8,
                  borderRadius: theme.radius(12),
                  borderWidth: 1,
                  borderColor: on ? theme.accent : day === today ? theme.lineStrong : 'transparent',
                  backgroundColor: on ? theme.accent : 'transparent',
                }}
              >
                <Text size="xs" tone={on ? 'accentFg' : 'subtle'}>{format(date, 'EEEEE')}</Text>
                <Text size="md" weight={on || day === today ? '600' : '400'} tone={on ? 'accentFg' : day === today ? 'accent' : 'fg'}>
                  {format(date, 'd')}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 4, height: 4 }}>
                {info?.keys.map((key, index) => (
                  <View key={index} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: theme.category(key) }} />
                ))}
              </View>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}
