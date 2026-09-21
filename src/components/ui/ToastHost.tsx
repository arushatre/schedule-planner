import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'

import { useUiStore } from '@/store/ui'
import { Icon } from './Icon'

export function ToastHost() {
  const toasts = useUiStore((state) => state.toasts)
  const dismiss = useUiStore((state) => state.dismissToast)

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6"
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="pointer-events-auto flex max-w-md items-center gap-3 rounded-md border border-fg/80 bg-fg py-2 pl-4 pr-2 text-base text-accent-fg shadow-pop"
          >
            <span className="min-w-0 flex-1 truncate">{toast.message}</span>
            {toast.onAction && toast.actionLabel && (
              <button
                type="button"
                onClick={() => {
                  toast.onAction?.()
                  dismiss(toast.id)
                }}
                className="rounded-sm border border-accent-fg/30 px-2.5 py-1 text-sm font-medium transition-colors hover:bg-accent-fg/15"
              >
                {toast.actionLabel}
              </button>
            )}
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismiss(toast.id)}
              className="rounded-sm p-1 text-accent-fg/70 transition-colors hover:bg-accent-fg/15 hover:text-accent-fg"
            >
              <Icon icon={X} size={16} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
