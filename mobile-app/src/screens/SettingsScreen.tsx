import * as DocumentPicker from 'expo-document-picker'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { format } from 'date-fns'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Alert, Linking, ScrollView, Switch, TextInput, View } from 'react-native'

import { ACCENTS, FONTS, PRESETS, TEXT_SIZES } from '@/lib/appearance'
import type { AccentKey, FontKey, Personal, TextSizeKey } from '@/lib/appearance'
import { defaultCategoryId } from '@/lib/tasks'
import { PRIORITIES, PRIORITY_LABEL } from '@/types/model'
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

const SECTIONS: { key: 'showNextUp' | 'showSchedule' | 'showUpcoming'; label: string }[] = [
  { key: 'showNextUp', label: 'Next up card' },
  { key: 'showSchedule', label: 'Hour-by-hour schedule' },
  { key: 'showUpcoming', label: 'Next 7 days' },
]

/** One row of chips; the chosen key is highlighted. */
function Choice<K extends string>({ label, options, value, onChange }: { label: string; options: Record<K, { label: string }>; value: K; onChange: (key: K) => void }) {
  return (
    <View style={{ gap: 8 }}>
      <Text size="sm" tone="muted">{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(Object.keys(options) as K[]).map((key) => (
          <Chip key={key} label={options[key].label} on={value === key} onPress={() => onChange(key)} />
        ))}
      </View>
    </View>
  )
}

export function SettingsScreen() {
  const theme = useTheme()
  const { prefs, tasks, categories, user, sync } = useStore()
  const [name, setName] = useState(prefs.personal.name)
  const setPersonal = (patch: Partial<Personal>) => setPrefs({ personal: { ...prefs.personal, ...patch } })
  const setLook = (patch: { displayFont?: FontKey; bodyFont?: FontKey; textSize?: TextSizeKey }) => setPrefs({ appearance: { ...prefs.appearance, ...patch } })
  const activeCategories = categories.filter((category) => !category.archived)
  const chosenCategory = defaultCategoryId(categories, prefs.personal.defaultCategoryId)

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

      <Section title="Typography">
        <Choice label="Heading font" options={FONTS} value={prefs.appearance.displayFont} onChange={(displayFont) => setLook({ displayFont })} />
        <Choice label="Body font" options={FONTS} value={prefs.appearance.bodyFont} onChange={(bodyFont) => setLook({ bodyFont })} />
        <Choice label="Text size" options={TEXT_SIZES} value={prefs.appearance.textSize} onChange={(textSize) => setLook({ textSize })} />
      </Section>

      <Section title="Dashboard">
        <Text size="sm" tone="muted">Your name, for the greeting</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          onEndEditing={() => setPersonal({ name: name.trim() })}
          maxLength={40}
          returnKeyType="done"
          placeholder="Add your name"
          placeholderTextColor={theme.subtle}
          accessibilityLabel="Your name, for the greeting"
          style={{
            color: theme.fg,
            fontSize: 16 * theme.textScale,
            fontFamily: theme.bodyFont,
            backgroundColor: theme.raised,
            borderColor: theme.line,
            borderWidth: 1,
            borderRadius: theme.radius(12),
            paddingHorizontal: 16,
            paddingVertical: 12,
          }}
        />
        <Card>
          {SECTIONS.map(({ key, label }) => (
            <Row key={key} label={label}>
              <Switch value={prefs.personal[key]} onValueChange={(on) => setPersonal({ [key]: on })} trackColor={{ true: theme.accent }} />
            </Row>
          ))}
        </Card>
      </Section>

      <Section title="New tasks">
        <Text size="sm" tone="muted">Where a task starts when you don’t say otherwise.</Text>
        <Text size="sm" tone="muted">Default priority</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {PRIORITIES.map((priority) => (
            <Chip key={priority} label={PRIORITY_LABEL[priority]} on={prefs.personal.defaultPriority === priority} onPress={() => setPersonal({ defaultPriority: priority })} />
          ))}
        </View>
        <Text size="sm" tone="muted">Default category</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {activeCategories.map((category) => (
            <Chip
              key={category.id}
              label={category.name}
              dot={theme.category(category.colorKey)}
              on={chosenCategory === category.id}
              onPress={() => setPersonal({ defaultCategoryId: category.id })}
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
