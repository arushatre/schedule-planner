import { CalendarArrowDown, Download, Upload } from 'lucide-react'
import { format } from 'date-fns'
import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'

import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { useTaskActions } from '@/hooks/useTaskActions'
import { downloadFile, parseBackup, serializeBackup } from '@/lib/backup'
import type { BackupData } from '@/lib/backup'
import { buildIcs } from '@/lib/ics'
import { useTasksStore } from '@/store/tasks'
import { useUiStore } from '@/store/ui'

export function BackupDialog() {
  const open = useUiStore((state) => state.dialog === 'backup')
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
    <Dialog open={open} onClose={close} title="Backup & export">
      <div className="grid gap-5">
        <section className="grid gap-2">
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
