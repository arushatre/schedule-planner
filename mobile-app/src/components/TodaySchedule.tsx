import { format } from 'date-fns'
import { useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import type { ScrollViewInstance } from 'react-native'

import { formatTime } from '@/lib/dates'
import type { PaletteKey } from '@/lib/palette'
import { blocksOn } from '@/lib/schedule'
import { UNCATEGORIZED, categoryFor } from '@/lib/tasks'
import type { Category, ClassBlock, Occurrence } from '@/types/model'
import { useTheme } from '../theme'
import { Text } from '../ui'

const HOUR = 48
/** About eight hours are visible; the rest of the day scrolls inside the box. */
const VIEW_HEIGHT = 400
/** Tasks only have a due time, so they're drawn as a short block starting there. */
const TASK_MINUTES = 45
const minutesOf = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5))

interface Props {
  date: string
  today: string
  occs: Occurrence[]
  categories: Category[]
  classBlocks: ClassBlock[]
  onOpen: (taskId: string) => void
}

interface Item {
  key: string
  title: string
  detail: string
  start: number
  end: number
  done: boolean
  colorKey: PaletteKey | null
  taskId: string | null
}

/** The day's timed tasks and classes on an hour grid; today also gets a line at the current time. */
export function TodaySchedule({ date, today, occs, categories, classBlocks, onOpen }: Props) {
  const theme = useTheme()
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const items: Item[] = [
    ...blocksOn(classBlocks, date).map((block) => ({
      key: block.id,
      title: block.title,
      detail: `${formatTime(block.startTime)} – ${formatTime(block.endTime)}`,
      start: minutesOf(block.startTime),
      end: minutesOf(block.endTime),
      done: false,
      colorKey: null,
      taskId: null,
    })),
    ...occs.flatMap((occ) => {
      if (!occ.task.dueTime) return []
      const category = categoryFor(occ.task.categoryId, categories)
      const start = minutesOf(occ.task.dueTime)
      return [
        {
          key: occ.key,
          title: occ.task.title,
          detail: formatTime(occ.task.dueTime),
          start,
          end: start + TASK_MINUTES,
          done: occ.done,
          colorKey: category === UNCATEGORIZED ? null : category.colorKey,
          taskId: occ.task.id,
        },
      ]
    }),
  ]

  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const hours = Array.from({ length: 24 }, (_, index) => index)
  const top = (minutes: number) => (minutes / 60) * HOUR
  const showNow = date === today

  // Today opens centered on the current time; other days on their first item (or 9 AM), as on web.
  const scroller = useRef<ScrollViewInstance>(null)
  const focus = showNow ? nowMinutes : Math.min(9 * 60, ...items.map((item) => item.start))
  const center = () => scroller.current?.scrollTo({ y: Math.max(0, top(focus) - VIEW_HEIGHT / 2), animated: false })
  // Re-center when the day changes, not on every minute tick.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(center, [date, today])

  return (
    <ScrollView
      ref={scroller}
      nestedScrollEnabled
      onLayout={center}
      style={{ height: VIEW_HEIGHT, backgroundColor: theme.raised, borderColor: theme.line, borderWidth: 1, borderRadius: theme.radius(14) }}
      contentContainerStyle={{ paddingVertical: 14, paddingLeft: 60, paddingRight: 12 }}
    >
      <View>
        {hours.map((hour) => (
          <View key={hour} style={{ height: HOUR, borderTopWidth: 1, borderColor: theme.line }}>
            <Text size="xs" tone="subtle" style={{ position: 'absolute', left: -52, top: -9, width: 44, textAlign: 'right' }}>
              {format(new Date(2000, 0, 1, hour), 'h a')}
            </Text>
          </View>
        ))}
        {/* shortcut: overlapping items stack on top of each other; add side-by-side columns if days get busy. */}
        {items.map((item) => (
          <Pressable
            key={item.key}
            disabled={!item.taskId}
            accessibilityRole={item.taskId ? 'button' : undefined}
            accessibilityLabel={`${item.title}, ${item.detail}`}
            onPress={() => item.taskId && onOpen(item.taskId)}
            style={{
              position: 'absolute',
              left: 6,
              right: 2,
              top: top(item.start),
              height: Math.max(26, top(item.end) - top(item.start) - 2),
              borderRadius: theme.radius(8),
              borderWidth: 1,
              borderStyle: item.taskId ? 'solid' : 'dashed',
              borderColor: item.colorKey ? 'transparent' : item.taskId ? theme.line : theme.lineStrong,
              borderLeftWidth: item.colorKey ? 3 : 1,
              borderLeftColor: item.colorKey ? theme.category(item.colorKey) : undefined,
              backgroundColor: item.colorKey ? theme.category(item.colorKey, theme.tint) : theme.raised,
              paddingHorizontal: 10,
              justifyContent: 'center',
              opacity: item.done ? 0.6 : 1,
            }}
          >
            <Text size="xs" numberOfLines={1}>
              <Text size="xs" weight="600" style={item.done ? { textDecorationLine: 'line-through' } : undefined}>
                {item.title}
              </Text>
              <Text size="xs" tone="muted">{`  ${item.detail}`}</Text>
            </Text>
          </Pressable>
        ))}
        {showNow && (
          <View pointerEvents="none" style={{ position: 'absolute', left: -8, right: 0, top: top(nowMinutes), height: 1.5, backgroundColor: theme.highlight }}>
            <View style={{ position: 'absolute', left: -4, top: -3.5, width: 8, height: 8, borderRadius: 4, backgroundColor: theme.highlight }} />
          </View>
        )}
      </View>
    </ScrollView>
  )
}
