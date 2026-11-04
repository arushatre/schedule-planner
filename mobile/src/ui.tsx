import { Pressable, Text as RNText, View } from 'react-native'
import type { TextProps } from 'react-native'
import type { ReactNode } from 'react'

import { formatTime, friendlyDate } from '@/lib/dates'
import { isOverdue } from '@/lib/recurrence'
import { categoryFor } from '@/lib/tasks'
import type { Category, Occurrence } from '@/types/model'
import { useTheme } from './theme'

// The web type scale (13/15/16/18/22/32px), so both apps read the same.
const SIZES = { xs: 13, sm: 15, base: 16, md: 18, lg: 22, xl: 32, hero: 56 }

interface Props extends TextProps {
  size?: keyof typeof SIZES
  tone?: 'fg' | 'muted' | 'subtle' | 'accent' | 'overdue' | 'accentFg'
  display?: boolean
  weight?: '400' | '500' | '600'
}

export function Text({ size = 'base', tone = 'fg', display, weight, style, ...rest }: Props) {
  const theme = useTheme()
  const color = { fg: theme.fg, muted: theme.muted, subtle: theme.subtle, accent: theme.accent, overdue: theme.overdue, accentFg: theme.accentFg }[tone]
  const fontSize = SIZES[size] * theme.textScale
  return (
    <RNText
      {...rest}
      style={[{ color, fontSize, lineHeight: fontSize * 1.35, fontWeight: weight, fontFamily: display ? theme.serif : undefined }, style]}
    />
  )
}

export function Button({ label, onPress, variant = 'secondary' }: { label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger' }) {
  const theme = useTheme()
  const bg = { primary: theme.accent, secondary: theme.raised, danger: theme.overdueSoft }[variant]
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: bg,
        borderColor: variant === 'secondary' ? theme.line : 'transparent',
        borderWidth: 1,
        borderRadius: theme.radius(10),
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: 'center',
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text weight="500" tone={variant === 'primary' ? 'accentFg' : variant === 'danger' ? 'overdue' : 'fg'}>
        {label}
      </Text>
    </Pressable>
  )
}

/** Multi- or single-select pill. */
export function Chip({ label, on, onPress, dot }: { label: string; on: boolean; onPress: () => void; dot?: string }) {
  const theme = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: on ? theme.accent : theme.line,
        backgroundColor: on ? theme.accentSoft : theme.raised,
      }}
    >
      {dot && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} />}
      <Text size="sm" tone={on ? 'fg' : 'muted'}>
        {label}
      </Text>
    </Pressable>
  )
}

export function Section({ title, count, tone, children }: { title: string; count?: number; tone?: 'overdue'; children: ReactNode }) {
  return (
    <View style={{ gap: 10, marginTop: 28 }}>
      <Text size="lg" display tone={tone === 'overdue' ? 'overdue' : 'fg'}>
        {title}
        {count !== undefined && <Text size="sm" tone="subtle">{`  ${count}`}</Text>}
      </Text>
      {children}
    </View>
  )
}

export function Card({ children }: { children: ReactNode }) {
  const theme = useTheme()
  return (
    <View style={{ backgroundColor: theme.raised, borderColor: theme.line, borderWidth: 1, borderRadius: theme.radius(14), overflow: 'hidden' }}>
      {children}
    </View>
  )
}

interface RowProps {
  occ: Occurrence
  categories: Category[]
  today: string
  showDate?: boolean
  last?: boolean
  onToggle: () => void
  onOpen: () => void
}

export function TaskRow({ occ, categories, today, showDate, last, onToggle, onOpen }: RowProps) {
  const theme = useTheme()
  const { task } = occ
  const color = theme.category(categoryFor(task.categoryId, categories).colorKey)
  const overdue = isOverdue(occ, today)
  const meta = [
    showDate && occ.date ? friendlyDate(occ.date, today) : null,
    task.dueTime ? formatTime(task.dueTime) : null,
    task.alerts.length > 0 || task.reminderTime ? 'Alert set' : null,
  ].filter(Boolean)

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: last ? 0 : 1, borderColor: theme.line }}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: occ.done }}
        accessibilityLabel={`Mark ${task.title} ${occ.done ? 'not done' : 'done'}`}
        onPress={onToggle}
        hitSlop={8}
        style={{ padding: 16 }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: occ.done ? theme.accent : overdue ? theme.overdue : theme.lineStrong,
            backgroundColor: occ.done ? theme.accent : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {occ.done && <Text size="xs" tone="accentFg" weight="600">✓</Text>}
        </View>
      </Pressable>
      <Pressable onPress={onOpen} style={{ flex: 1, paddingVertical: 14, paddingRight: 16, gap: 2 }}>
        <Text
          numberOfLines={2}
          tone={occ.done ? 'subtle' : 'fg'}
          style={occ.done ? { textDecorationLine: 'line-through' } : undefined}
        >
          {task.title}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
          <Text size="xs" tone={overdue ? 'overdue' : 'subtle'}>
            {[overdue ? 'Overdue' : null, ...meta].filter(Boolean).join('  ·  ') || categoryFor(task.categoryId, categories).name}
          </Text>
        </View>
      </Pressable>
      {overdue && <View style={{ width: 3, alignSelf: 'stretch', backgroundColor: theme.overdue }} />}
    </View>
  )
}
