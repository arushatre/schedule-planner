import { useRef } from 'react'
import type { KeyboardEvent } from 'react'

import { cx } from '@/lib/cx'

export type Method = 'magic' | 'password'

const METHODS: { value: Method; label: string }[] = [
  { value: 'magic', label: 'Magic link' },
  { value: 'password', label: 'Password' },
]

/** Tabs with a sliding active pill; arrow keys move between them (WAI-ARIA tabs pattern). */
export function MethodTabs({ value, onChange, panelId }: { value: Method; onChange: (method: Method) => void; panelId: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + METHODS.length) % METHODS.length
    const method = METHODS[next]
    if (!method) return
    onChange(method.value)
    refs.current[next]?.focus()
  }
  const activeIndex = METHODS.findIndex((method) => method.value === value)
  return (
    <div role="tablist" aria-label="Sign-in method" className="relative flex rounded-md border border-line bg-sunken p-0.5">
      {/* Slides with a transform relative to the track, so it stays put when the card resizes. */}
      <span
        aria-hidden="true"
        className="absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-sm border border-line-strong bg-raised shadow-card transition-transform duration-base ease-out"
        style={{ transform: `translateX(${activeIndex * 100}%)` }}
      />
      {METHODS.map((method, index) => {
        const active = method.value === value
        return (
          <button
            key={method.value}
            ref={(node) => {
              refs.current[index] = node
            }}
            type="button"
            role="tab"
            id={`${panelId}-tab-${method.value}`}
            aria-selected={active}
            aria-controls={panelId}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(method.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cx(
              'relative flex-1 rounded-sm px-3 py-1.5 text-sm transition-colors',
              active ? 'font-medium text-fg' : 'text-fg-muted hover:text-fg',
            )}
          >
            {method.label}
          </button>
        )
      })}
    </div>
  )
}
