import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'

import { cx } from '@/lib/cx'
import { PALETTE } from '@/lib/palette'
import type { PaletteKey } from '@/lib/palette'
import { matchesQuery } from '@/lib/search'
import { Icon } from './Icon'

export interface SelectOption<T extends string = string> {
  value: T
  label: string
  /** Optional category color dot. */
  color?: PaletteKey
}

interface SelectProps<T extends string> {
  options: SelectOption<T>[]
  value: T | null
  onChange: (value: T) => void
  ariaLabel: string
  placeholder?: string
  className?: string
}

// Custom listbox (button + popover) so the native <select> chrome never shows.
export function Select<T extends string = string>({
  options,
  value,
  onChange,
  ariaLabel,
  placeholder,
  className,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  // Typed while the list is open; narrows it to options with a word starting with it ("11" → 11:00 AM…).
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  const selected = options.find((option) => option.value === value)
  const shown = query ? options.filter((option) => matchesQuery(option.label, query)) : options

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const openList = () => {
    const index = options.findIndex((option) => option.value === value)
    setActive(index >= 0 ? index : 0)
    setQuery('')
    setOpen(true)
  }

  const commit = (index: number) => {
    const option = shown[index]
    if (option) onChange(option.value)
    setOpen(false)
  }

  const type = (next: string) => {
    setQuery(next)
    setActive(0)
    setOpen(true)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const typing = event.key.length === 1 && event.key !== ' ' && !event.metaKey && !event.ctrlKey && !event.altKey
    if (typing) {
      event.preventDefault()
      type((open ? query : '') + event.key)
      return
    }
    if (open && event.key === 'Backspace') {
      event.preventDefault()
      type(query.slice(0, -1))
      return
    }
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault()
        openList()
      }
      return
    }
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setActive((index) => Math.min(index + 1, shown.length - 1))
        break
      case 'ArrowUp':
        event.preventDefault()
        setActive((index) => Math.max(index - 1, 0))
        break
      case 'Home':
        event.preventDefault()
        setActive(0)
        break
      case 'End':
        event.preventDefault()
        setActive(shown.length - 1)
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        commit(active)
        break
      case 'Escape':
        event.preventDefault()
        event.stopPropagation()
        if (query) type('')
        else setOpen(false)
        break
      case 'Tab':
        setOpen(false)
        break
    }
  }

  return (
    <div ref={rootRef} className={cx('relative', className)}>
      <button
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={cx(
          'flex h-10 w-full items-center justify-between gap-2 rounded-md border bg-raised px-3 text-base shadow-inset',
          'transition-colors hover:border-fg-subtle',
          open ? 'border-accent' : 'border-line-strong',
        )}
      >
        <span className={cx('flex items-center gap-2 truncate', !selected && 'text-fg-subtle')}>
          {selected?.color && (
            <span className={cx('h-2.5 w-2.5 rounded-full', PALETTE[selected.color].solid)} />
          )}
          {selected?.label ?? placeholder ?? 'Select…'}
        </span>
        <Icon icon={ChevronDown} size={16} className="shrink-0 text-fg-subtle" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-line-strong bg-raised p-1 shadow-pop"
          >
            {query && (
              <li role="presentation" className="px-2 pb-1 pt-0.5 text-xs text-fg-subtle">
                {shown.length > 0 ? `Matching “${query}”` : `Nothing matches “${query}”`}
              </li>
            )}
            {shown.map((option, index) => (
              <li
                key={option.value}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={option.value === value}
                onPointerEnter={() => setActive(index)}
                onClick={() => commit(index)}
                className={cx(
                  'flex cursor-pointer items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-base',
                  index === active ? 'bg-accent-soft' : 'bg-transparent',
                )}
              >
                <span className="flex items-center gap-2">
                  {option.color && (
                    <span className={cx('h-2.5 w-2.5 rounded-full', PALETTE[option.color].solid)} />
                  )}
                  {option.label}
                </span>
                {option.value === value && <Icon icon={Check} size={16} className="text-accent" />}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}