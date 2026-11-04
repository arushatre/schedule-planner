import * as DocumentPicker from 'expo-document-picker'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { format } from 'date-fns'
import { Alert, Linking, ScrollView, Switch, View } from 'react-native'
import type { ReactNode } from 'react'

import { ACCENTS, PRESETS } from '@/lib/appearance'
import type { AccentKey } from '@/lib/appearance'
import { parseBackup } from '@/lib/backup'
import { ensurePermission, sendTest } from '../notifications'
import { exportData, replaceAll, setPrefs, useStore } from '../store'
import type { Mode } from '../store'
import { rgb, useTheme } from '../theme'
import { Button, Card, Chip, Section, Text } from '../ui'

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  const theme = useTheme()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderColor: theme.line }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text>{label}</Text>
        {hint && <Text size="xs" tone="subtle">{hint}</Text>}
      </View>
      {children}
    </View>
  )
}

const MODES: { mode: Mode; label: string }[] = [
  { mode: 'system', label: 'System' },
  { mode: 'light', label: 'Light' },
  { mode: 'dark', label: 'Dark' },
]

export function SettingsScreen() {
  const theme = useTheme()
  const { prefs, tasks } = useStore()

  const toggleNotifications = async (on: boolean) => {
    if (on && !(await ensurePermission())) {
      Alert.alert('Notifications are off', 'Allow notifications for Daybook in the Settings app to get alerts.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => void Linking.openSettings() },
      ])
      return
    }
    setPrefs({ notifications: on })
  }

  const exportBackup = async () => {
    const file = new File(Paths.cache, `daybook-backup-${format(new Date(), 'yyyy-MM-dd')}.json`)
    if (file.exists) file.delete()
    file.create()
    file.writeSync(exportData())
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json' })
  }

  const importBackup = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'public.json', '*/*'], copyToCacheDirectory: true })
    const asset = result.canceled ? null : result.assets[0]
    if (!asset) return
    try {
      const data = parseBackup(await new File(asset.uri).text())
      Alert.alert(
        'Replace everything on this phone?',
        `The backup has ${data.tasks.length} tasks. Your ${tasks.length} current tasks will be replaced.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Replace', style: 'destructive', onPress: () => replaceAll(data) },
        ],
      )
    } catch (error) {
      Alert.alert('Couldn’t import that file', error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
      <Section title="Alerts">
        <Card>
          <Row label="Notifications" hint="Task alerts fire even when Daybook is closed.">
            <Switch value={prefs.notifications} onValueChange={(on) => void toggleNotifications(on)} trackColor={{ true: theme.accent }} />
          </Row>
          <Row label="Morning briefing" hint="7:00 AM summary of today, overdue and next.">
            <Switch value={prefs.briefing} disabled={!prefs.notifications} onValueChange={(briefing) => setPrefs({ briefing })} trackColor={{ true: theme.accent }} />
          </Row>
          <View style={{ padding: 16 }}>
            <Button label="Send a test notification" onPress={() => void ensurePermission().then(async (ok) => { if (ok) await sendTest() })} />
          </View>
        </Card>
      </Section>

      <Section title="Appearance">
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {MODES.map(({ mode, label }) => (
            <Chip key={mode} label={label} on={prefs.mode === mode} onPress={() => setPrefs({ mode })} />
          ))}
        </View>
        <View style={{ gap: 8 }}>
          {PRESETS.map((preset) => {
            const on = (Object.keys(preset.value) as (keyof typeof preset.value)[]).every((key) => preset.value[key] === prefs.appearance[key])
            return (
              <Chip
                key={preset.label}
                label={preset.label}
                dot={rgb(ACCENTS[preset.value.accent][theme.mode].join(' '))}
                on={on}
                onPress={() => setPrefs({ appearance: preset.value })}
              />
            )
          })}
        </View>
        <Text size="sm" tone="muted">Accent</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(Object.keys(ACCENTS) as AccentKey[]).map((accent) => (
            <Chip
              key={accent}
              label={ACCENTS[accent].label}
              dot={rgb(ACCENTS[accent][theme.mode].join(' '))}
              on={prefs.appearance.accent === accent}
              onPress={() => setPrefs({ appearance: { ...prefs.appearance, accent } })}
            />
          ))}
        </View>
      </Section>

      <Section title="Your data">
        <Text size="sm" tone="muted">
          Tasks live on this phone. To move them between your laptop and phone, export a backup on one (here, or
          Settings → Download backup on the web app) and import it on the other, for example over AirDrop.
        </Text>
        <View style={{ gap: 10 }}>
          <Button label="Export backup" variant="primary" onPress={() => void exportBackup()} />
          <Button label="Import backup" onPress={() => void importBackup()} />
        </View>
      </Section>
    </ScrollView>
  )
}
