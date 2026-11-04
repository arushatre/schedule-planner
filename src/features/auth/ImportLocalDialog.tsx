import { HardDriveUpload } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Icon } from '@/components/ui/Icon'
import { useLegacyImport } from '@/sync/legacy'
import { LOCAL_USER_ID } from '@/sync/SyncProvider'
import { useTasksStore } from '@/store/tasks'
import { useUiStore } from '@/store/ui'

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`

/** One-time offer to move tasks saved in this browser (before accounts) into the current profile. */
export function ImportLocalDialog() {
  const offer = useLegacyImport((state) => state.offer)
  const answer = useTasksStore((state) => state.answerLocalImport)
  const pushToast = useUiStore((state) => state.pushToast)
  const [pending, setPending] = useState(false)

  const respond = async (accept: boolean) => {
    if (!offer) return
    setPending(true)
    try {
      await answer(LOCAL_USER_ID, accept ? offer : null)
      if (accept) pushToast({ message: `Imported ${plural(offer.tasks.length, 'task')} into Daybook` })
    } finally {
      setPending(false)
    }
  }

  const counts = offer
    ? [
        plural(offer.tasks.length, 'task'),
        offer.categories.length > 0 ? plural(offer.categories.length, 'category', 'categories') : null,
        offer.classBlocks.length > 0 ? plural(offer.classBlocks.length, 'class block') : null,
      ].filter((part): part is string => part !== null)
    : []

  return (
    <Dialog
      open={offer !== null}
      onClose={() => void respond(false)}
      title="Bring your tasks along?"
      footer={
        <>
          <Button onClick={() => void respond(false)} disabled={pending}>
            Not now
          </Button>
          <Button variant="primary" onClick={() => void respond(true)} disabled={pending} data-autofocus>
            {pending ? 'Importing…' : `Import ${plural(offer?.tasks.length ?? 0, 'task')}`}
          </Button>
        </>
      }
    >
      <div className="flex gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-accent/20 bg-accent-soft text-accent">
          <Icon icon={HardDriveUpload} size={20} />
        </span>
        <div className="grid gap-2 text-base">
          <p>
            This browser has <strong>{counts.join(', ')}</strong> saved by an older version of Daybook.
          </p>
          <p className="text-fg-muted">
            Importing adds them to your current tasks. Categories with the same name are merged. If you choose Not now, the local copy stays untouched and you won’t be asked
            again.
          </p>
        </div>
      </div>
    </Dialog>
  )
}
