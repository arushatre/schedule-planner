import { Dialog } from '@/components/ui/Dialog'
import { SHORTCUTS } from '@/lib/shortcuts'
import { useUiStore } from '@/store/ui'

export function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex min-w-[1.75rem] items-center justify-center rounded-sm border border-line-strong bg-raised px-1.5 py-0.5 font-sans text-sm text-fg shadow-card">
      {children}
    </kbd>
  )
}

export function ShortcutsDialog() {
  const open = useUiStore((state) => state.dialog === 'shortcuts')
  const openDialog = useUiStore((state) => state.openDialog)

  return (
    <Dialog open={open} onClose={() => openDialog(null)} title="Keyboard shortcuts">
      <dl className="grid gap-3">
        {SHORTCUTS.map((shortcut) => (
          <div key={shortcut.keys} className="flex items-center justify-between gap-4">
            <dt className="text-base text-fg-muted">{shortcut.label}</dt>
            <dd>
              <Kbd>{shortcut.keys}</Kbd>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-sm text-fg-subtle">Shortcuts pause while you’re typing in a field.</p>
    </Dialog>
  )
}
