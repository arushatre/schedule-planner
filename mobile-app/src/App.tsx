import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import { ActivityIndicator, AppState, Pressable, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'

import { todayStr } from '@/lib/dates'
import { reschedule } from './notifications'
import { AuthScreen } from './screens/AuthScreen'
import { ListScreen } from './screens/ListScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { TaskEditor } from './screens/TaskEditor'
import { TodayScreen } from './screens/TodayScreen'
import { load, syncNow, useStore } from './store'
import { supabaseConfigError } from './supabase'
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
    <View style={{ flex: 1, backgroundColor: theme.canvas }}>
      {/* Quiet header: the phone's version of the web sidebar. */}
      <SafeAreaView edges={['top', 'left', 'right']} style={{ backgroundColor: theme.frame, borderBottomWidth: 1, borderColor: theme.line }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 14,
          }}
        >
          <Text size="xl" display style={{ color: theme.frameFg }}>
            {title}
          </Text>
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
              <Text weight="600" tone="accentFg">
                + New
              </Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>

      <View style={{ flex: 1 }}>
        {tab === 'today' && <TodayScreen today={today} onOpen={setEditing} onRefresh={syncNow} />}
        {tab === 'all' && <ListScreen today={today} onOpen={setEditing} onRefresh={syncNow} />}
        {tab === 'settings' && <SettingsScreen />}
      </View>

      <SafeAreaView
        edges={['bottom']}
        style={{
          backgroundColor: theme.panel,
          borderTopWidth: 1,
          borderColor: theme.line,
        }}
      >
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
    </View>
  )
}

/** Shown instead of the sign-in screen when the build has no Supabase settings. */
function ConfigError({ message }: { message: string }) {
  const theme = useTheme()
  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: theme.canvas,
        padding: 24,
        justifyContent: 'center',
        gap: 12,
      }}
    >
      <Text size="lg" display accessibilityRole="header">
        Daybook isn’t set up yet
      </Text>
      <Text tone="muted">{message}</Text>
      <Text size="sm" tone="subtle">
        See “Accounts and sync” in mobile-app/README.md.
      </Text>
    </SafeAreaView>
  )
}

function Splash() {
  const theme = useTheme()
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.canvas,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ActivityIndicator color={theme.muted} accessibilityLabel="Loading" />
    </View>
  )
}

function Screen() {
  const { auth } = useStore()
  if (supabaseConfigError) return <ConfigError message={supabaseConfigError} />
  if (auth === 'loading') return <Splash />
  return auth === 'signedIn' ? <Shell /> : <AuthScreen />
}

function Gate() {
  const theme = useTheme()
  const { auth } = useStore()
  return (
    <>
      <StatusBar style={auth === 'signedIn' || theme.mode === 'dark' ? 'light' : 'dark'} />
      <Screen />
    </>
  )
}

export function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Gate />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
