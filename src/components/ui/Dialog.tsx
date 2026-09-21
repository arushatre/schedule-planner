import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'

import { cx } from '@/lib/cx'
import { Icon } from './Icon'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  size?: 'md' | 'lg'
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function DialogShell({ onClose, title, children, footer, size = 'md' }: Omit<DialogProps, 'open'>) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const panel = panelRef.current
    const target = panel?.querySelector<HTMLElement>('[data-autofocus]') ?? panel
    target?.focus()
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
      previous?.focus()
    }
  }, [])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key !== 'Tab' || !panelRef.current) return
    const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
    const first = items[0]
    const last = items[items.length - 1]
    if (!first || !last) return
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center md:items-center md:p-4">
      <motion.div
        className="absolute inset-0 bg-scrim/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className={cx(
          'relative flex max-h-[92vh] w-full flex-col rounded-t-lg border border-line-strong bg-raised shadow-pop focus:outline-none md:rounded-lg',
          size === 'lg' ? 'md:max-w-2xl' : 'md:max-w-lg',
        )}
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 id={titleId} className="font-display text-lg">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-md border border-transparent p-1.5 text-fg-muted transition-colors hover:bg-sunken hover:text-fg"
          >
            <Icon icon={X} />
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>}
      </motion.div>
    </div>
  )
}

export function Dialog({ open, ...rest }: DialogProps) {
  return <AnimatePresence>{open && <DialogShell key="dialog" {...rest} />}</AnimatePresence>
}
