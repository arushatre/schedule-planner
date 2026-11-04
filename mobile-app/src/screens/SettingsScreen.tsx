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
import { exportData, replaceAll, setPrefs, signOut, syncNow, useStore } from '../store'
import type { Mode } from '../store'
import type { SyncStatus } from '../sync'
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

const changes = (n: number) => (n === 1 ? '1 change' : `${n} changes`)

function syncLine({ state, pending, lastError, lastPulledAt }: SyncStatus): string {
  if (state === 'syncing') return 'Syncing…'
  if (state === 'offline') return pending > 0 ? `Offline. ${changes(pending)} will sync when you’re back online.` : 'Offline. Showing what’s saved on this phone.'
  if (state === 'error') return `Couldn’t sync${lastError ? `: ${lastError}` : ''}. Retrying automatically.`
  if (pending > 0) return `${changes(pending)} waiting to sync.`
  return lastPulledAt ? `Up to date · synced at ${format(lastPulledAt, 'h:mm a')}` : 'Up to date.'
}

const MODES: { mode: Mode; label: string }[] = [
  { mode: 'system', label: 'System' },
  { mode: 'light', label: 'Light' },
  { mode: 'dark', label: 'Dark' },
]

export function SettingsScreen() {
  const theme = useTheme()
  const { prefs, tasks, user, sync } = useStore()

  const confirmSignOut = () => {
    const pending = sync.pending > 0 ? `\n\n${changes(sync.pending)} haven’t synced yet. They stay on this phone and upload the next time you sign in here.` : ''
    Alert.alert('Sign out of Daybook?', `Alerts on this phone stop until you sign in again.${pending}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ])
  }

  const toggleNotifications = async (on: boolean) => {
    const ok = on ? await ensurePermission().catch((error: unknown) => { console.warn('Notification permission failed', error); return false }) : true
    if (!ok) {
      Alert.alert('Notifications are off', 'Allow notifications for Daybook in the Settings app to get alerts.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => void Linking.openSettings() },
      ])
      return
    }
    setPrefs({ notifications: on })
  }

  const exportBackup = async () => {
    try {
      const file = new File(Paths.cache, `daybook-backup-${format(new Date(), 'yyyy-MM-dd')}.json`)
      if (file.exists) file.delete()
      file.create()
      file.writeSync(exportData())
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json' })
    } catch (error) {
      Alert.alert('Couldn’t export a backup', error instanceof Error ? error.message : String(error))
    }
  }

  const importBackup = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'public.json', '*/*'], copyToCacheDirectory: true })
      const asset = result.canceled ? null : result.assets[0]
      if (!asset) return
      const data = parseBackup(await new File(asset.uri).text())
      // Replacing deletes what this phone knows about, so it must have seen the whole account first.
      if (sync.lastPulledAt === null) {
        Alert.alert('Connect to the internet first', 'Daybook needs to sync with your account once before it can replace it.')
        return
      }
      Alert.alert(
        'Replace everything in your account?',
        `The backup has ${data.tasks.length} tasks. Your ${tasks.length} current tasks, categories and classes will be replaced on every device signed in to ${user?.email || 'this account'}. This can’t be undone, so export a backup first if you might want them back.`,
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
      <Section title="Account">
        <Card>
          <Row label={user?.email || 'Signed in'} hint={syncLine(sync)}>
            {null}
          </Row>
          <View style={{ padding: 16, gap: 10 }}>
            <Button label="Sync now" onPress={() => void syncNow()} />
            <Button label="Sign out" variant="danger" onPress={confirmSignOut} />
          </View>
        </Card>
      </Section>

      <Section title="Alerts">
        <Card>
          <Row label="Notifications" hint="Task alerts fire even when Daybook is closed.">
            <Switch value={prefs.notifications} onValueChange={(on) => void toggleNotifications(on)} trackColor={{ true: theme.accent }} />
          </Row>
          <Row label="Morning briefing" hint="7:00 AM summary of today, overdue and next.">
            <Switch value={prefs.briefing} disabled={!prefs.notifications} onValueChange={(briefing) => setPrefs({ briefing })} trackColor={{ true: theme.accent }} />
          </Row>
          <View style={{ padding: 16 }}>
            <Button label="Send a test notification" onPress={() => void ensurePermission().then(async (ok) => { if (ok) await sendTest() }).catch((error: unknown) => Alert.alert('Couldn’t send a test', String(error)))} />
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

      <Section title="Backups">
        <Text size="sm" tone="muted">
          Optional. Your tasks already sync to your account. A backup file is a copy you keep yourself; importing one
          replaces everything in your account, on every device.
        </Text>
        <View style={{ gap: 10 }}>
          <Button label="Export backup" onPress={() => void exportBackup()} />
          <Button label="Import backup" onPress={() => void importBackup()} />
        </View>
      </Section>
    </ScrollView>
  )
}
