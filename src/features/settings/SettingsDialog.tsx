import { CalendarArrowDown, Download, Upload } from 'lucide-react'
import { format } from 'date-fns'
import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'

import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Dialog } from '@/components/ui/Dialog'
import { Segmented } from '@/components/ui/fields'
import { useTaskActions } from '@/hooks/useTaskActions'
import { downloadFile, parseBackup, serializeBackup } from '@/lib/backup'
import type { BackupData } from '@/lib/backup'
import { buildIcs } from '@/lib/ics'
import { notificationSupport, requestNotificationPermission } from '@/lib/notifications'
import type { NotificationSupport } from '@/lib/notifications'
import { THEME_LABEL } from '@/lib/theme'
import type { ThemePreference } from '@/lib/theme'
import { useTasksStore } from '@/store/tasks'
import { useUiStore } from '@/store/ui'

const PERMISSION_COPY: Record<NotificationSupport, string> = {
  unsupported: 'This browser can’t show system notifications, so reminders will appear inside Daybook while it’s open.',
  granted: 'System notifications are allowed for this site.',
  default: 'Turn this on and your browser will ask permission to show notifications.',
  denied:
    'Notifications are blocked for this site, so reminders will appear inside Daybook instead. To use system notifications, allow them in your browser’s site settings.',
}

function RemindersSection() {
  const enabled = useUiStore((state) => state.remindersEnabled)
  const setEnabled = useUiStore((state) => state.setRemindersEnabled)
  const [support, setSupport] = useState<NotificationSupport>(notificationSupport)

  const toggle = async (next: boolean) => {
    // Ask only in response to the user turning reminders on.
    if (next && support === 'default') setSupport(await requestNotificationPermission())
    setEnabled(next)
  }

  return (
    <section className="grid gap-2 border-t border-line pt-5">
      <h3 className="text-base font-medium">Reminders</h3>
      <Checkbox
        checked={enabled}
        onChange={(next) => void toggle(next)}
        label="Remind me at each task’s reminder time"
      />
      <p className="text-sm text-fg-muted">{PERMISSION_COPY[support]}</p>
      <p className="text-sm text-fg-subtle">
        Reminders fire while Daybook is open in a tab or installed as an app. Your data never leaves this
        device, so nothing can wake it up while it’s closed.
      </p>
    </section>
  )
}

export function SettingsDialog() {
  const open = useUiStore((state) => state.dialog === 'settings')
  const theme = useUiStore((state) => state.theme)
  const setTheme = useUiStore((state) => state.setTheme)
  const openDialog = useUiStore((state) => state.openDialog)
  const pushToast = useUiStore((state) => state.pushToast)
  const tasks = useTasksStore((state) => state.tasks)
  const categories = useTasksStore((state) => state.categories)
  const classBlocks = useTasksStore((state) => state.classBlocks)
  const importAll = useTasksStore((state) => state.importAll)
  const { guard } = useTaskActions()

  const fileInput = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<BackupData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const stamp = format(new Date(), 'yyyy-MM-dd')

  const close = () => {
    setPending(null)
    setError(null)
    openDialog(null)
  }

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      setPending(parseBackup(await file.text()))
      setError(null)
    } catch (caught) {
      setPending(null)
      setError(caught instanceof Error ? caught.message : 'Could not read that file.')
    }
  }

  const confirmImport = () => {
    if (!pending) return
    void guard(async () => {
      await importAll(pending)
      pushToast({ message: `Imported ${pending.tasks.length} tasks` })
      close()
    })
  }

  return (
    <Dialog open={open} onClose={close} title="Settings">
      <div className="grid gap-5">
        <section className="grid gap-2">
          <h3 className="text-base font-medium">Appearance</h3>
          <p className="text-sm text-fg-muted">
            “System” follows your device and switches automatically between light and dark.
          </p>
          <Segmented
            ariaLabel="Theme"
            value={theme}
            onChange={setTheme}
            options={(Object.keys(THEME_LABEL) as ThemePreference[]).map((value) => ({
              value,
              label: THEME_LABEL[value],
            }))}
            className="w-full sm:w-72"
          />
        </section>

        <RemindersSection />

        <section className="grid gap-2 border-t border-line pt-5">
          <h3 className="text-base font-medium">Export</h3>
          <p className="text-sm text-fg-muted">
            Everything lives in this browser. Download a backup to keep it safe or move it to another
            device.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              icon={Download}
              onClick={() =>
                downloadFile(
                  `daybook-backup-${stamp}.json`,
                  'application/json',
                  serializeBackup({ tasks, categories, classBlocks }),
                )
              }
            >
              Download backup (.json)
            </Button>
            <Button
              icon={CalendarArrowDown}
              onClick={() =>
                downloadFile(`daybook-${stamp}.ics`, 'text/calendar', buildIcs(tasks, categories, new Date(), classBlocks))
              }
            >
              Export calendar (.ics)
            </Button>
          </div>
          <p className="text-sm text-fg-subtle">
            The .ics file opens in Google Calendar and Apple Calendar. Tasks without a date are left out.
          </p>
        </section>

        <section className="grid gap-2 border-t border-line pt-5">
          <h3 className="text-base font-medium">Import</h3>
          <p className="text-sm text-fg-muted">Restore from a backup file. This replaces your current data.</p>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            aria-label="Backup file"
            className="sr-only"
            onChange={(event) => void onFile(event)}
          />
          <div>
            <Button icon={Upload} onClick={() => fileInput.current?.click()}>
              Choose backup file…
            </Button>
          </div>
          {error && (
            <p role="alert" className="text-sm text-overdue">
              {error}
            </p>
          )}
          {pending && (
            <div className="grid gap-3 rounded-md border border-line-strong bg-panel p-3">
              <p className="text-sm">
                Replace your <strong>{tasks.length}</strong> tasks and <strong>{categories.length}</strong>{' '}
                categories with <strong>{pending.tasks.length}</strong> tasks and{' '}
                <strong>{pending.categories.length}</strong> categories from the file? This can’t be undone.
              </p>
              <div className="flex gap-2">
                <Button variant="primary" onClick={confirmImport}>
                  Replace my data
                </Button>
                <Button onClick={() => setPending(null)}>Cancel</Button>
              </div>
            </div>
          )}
        </section>
      </div>
    </Dialog>
  )
}
