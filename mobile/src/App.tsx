import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import { AppState, Pressable, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'

import { todayStr } from '@/lib/dates'
import { reschedule } from './notifications'
import { ListScreen } from './screens/ListScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { TaskEditor } from './screens/TaskEditor'
import { TodayScreen } from './screens/TodayScreen'
import { load, useStore } from './store'
import { useTheme } from './theme'
import { Text } from './ui'

type Tab = 'today' | 'all' | 'settings'
const TABS: { tab: Tab; label: string }[] = [
  { tab: 'today', label: 'Today' },
  { tab: 'all', label: 'All tasks' },
  { tab: 'settings', label: 'Settings' },
]

load()

function Shell() {
  const theme = useTheme()
  const { tasks, prefs } = useStore()
  const [tab, setTab] = useState<Tab>('today')
  const [editing, setEditing] = useState<string | null>(null)
  const [today, setToday] = useState(todayStr)

  // Coming back to the app may cross midnight, and is a good moment to refresh the queue.
  const [active, setActive] = useState(0)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return
      setToday(todayStr())
      setActive((n) => n + 1)
    })
    return () => sub.remove()
  }, [])

  useEffect(() => {
    void reschedule(tasks, prefs.notifications, prefs.briefing)
  }, [tasks, prefs.notifications, prefs.briefing, active])

  const title = TABS.find((item) => item.tab === tab)?.label ?? ''

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.canvas }} edges={['top', 'left', 'right']}>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8 }}>
        <Text size="xl" display>{title}</Text>
        {tab !== 'settings' && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="New task"
            onPress={() => setEditing('new')}
            style={({ pressed }) => ({
              backgroundColor: theme.accent,
              borderRadius: theme.radius(10),
              paddingHorizontal: 16,
              paddingVertical: 10,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text tone="accentFg" weight="600">+ New</Text>
          </Pressable>
        )}
      </View>

      <View style={{ flex: 1 }}>
        {tab === 'today' && <TodayScreen today={today} onOpen={setEditing} />}
        {tab === 'all' && <ListScreen today={today} onOpen={setEditing} />}
        {tab === 'settings' && <SettingsScreen />}
      </View>

      <SafeAreaView edges={['bottom']} style={{ backgroundColor: theme.panel, borderTopWidth: 1, borderColor: theme.line }}>
        <View style={{ flexDirection: 'row', padding: 8, gap: 6 }}>
          {TABS.map((item) => (
            <Pressable
              key={item.tab}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === item.tab }}
              onPress={() => setTab(item.tab)}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: 12,
                borderRadius: theme.radius(10),
                backgroundColor: tab === item.tab ? theme.sunken : 'transparent',
              }}
            >
              <Text size="sm" weight={tab === item.tab ? '600' : '400'} tone={tab === item.tab ? 'fg' : 'muted'}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>

      <TaskEditor target={editing} today={today} onClose={() => setEditing(null)} />
    </SafeAreaView>
  )
}

export function App() {
  return (
    <SafeAreaProvider>
      <Shell />
    </SafeAreaProvider>
  )
}
