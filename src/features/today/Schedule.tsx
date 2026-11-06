import { format } from 'date-fns'
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, FocusEvent, MouseEvent } from 'react'
import { createPortal } from 'react-dom'

import { cx } from '@/lib/cx'
import { formatTime, friendlyDate, todayStr } from '@/lib/dates'
import type { PaletteKey } from '@/lib/palette'
import { blocksOn, laneBox, layoutLanes, taskInfo } from '@/lib/schedule'
import { UNCATEGORIZED, categoryFor } from '@/lib/tasks'
import { useTasksStore } from '@/store/tasks'
import { useUiStore } from '@/store/ui'
import type { Occurrence } from '@/types/model'

const HOUR_PX = 48
/** About nine hours are visible; the rest of the day scrolls. */
const VIEW_PX = 432
/** Tasks only have a due time, so they're drawn as a short block starting there. */
const TASK_MINUTES = 45

const minutesOf = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5))
const hourLabel = (hour: number) => format(new Date(2000, 0, 1, hour), 'h a')

const tint = (colorKey: PaletteKey): CSSProperties => ({
  background: `color-mix(in srgb, rgb(var(--cat-${colorKey})) var(--tint), rgb(var(--raised)))`,
  boxShadow: `inset 3px 0 0 rgb(var(--cat-${colorKey}))`,
})

interface Item {
  key: string
  title: string
  detail: string
  /** Extra lines for the hover card. */
  info: string[]
  start: number
  end: number
  done: boolean
  style?: CSSProperties
  isClass: boolean
  taskId?: string
}

const CARD_WIDTH = 272
const INFO_ID = 'schedule-item-info'

/** The hover card: fixed to the viewport (via a portal) so the schedule's scroll box can't clip it. */
function InfoCard({ item, rect }: { item: Item; rect: DOMRect }) {
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - CARD_WIDTH - 8))
  const fitsBelow = rect.bottom + 180 < window.innerHeight
  const style: CSSProperties = fitsBelow ? { left, top: rect.bottom + 6 } : { left, bottom: window.innerHeight - rect.top + 6 }
  return createPortal(
    <div
      id={INFO_ID}
      role="tooltip"
      className="pointer-events-none fixed z-50 rounded-lg border border-line bg-raised px-4 py-3 shadow-pop"
      style={{ ...style, width: CARD_WIDTH }}
    >
      <p className={cx('text-sm font-semibold text-fg', item.done && 'line-through')}>{item.title}</p>
      <p className="tabular mt-0.5 text-xs text-fg-muted">{item.isClass ? item.detail : `Due ${item.detail}${item.done ? ' · Done' : ''}`}</p>
      {item.info.map((line) => (
        <p key={line} className="mt-1.5 text-xs text-fg-muted">
          {line}
        </p>
      ))}
    </div>,
    document.body,
  )
}

/** A day's timed tasks and classes on an hour grid; today also gets a line at the current time. */
export function Schedule({ date, occs }: { date: string; occs: Occurrence[] }) {
  const categories = useTasksStore((state) => state.categories)
  const classBlocks = useTasksStore((state) => state.classBlocks)
  const openEditor = useUiStore((state) => state.openEditor)
  const [now, setNow] = useState(() => new Date())
  const scroller = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState<{ key: string; rect: DOMRect } | null>(null)

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const items: Item[] = [
    ...blocksOn(classBlocks, date).map((block) => ({
      key: block.id,
      title: block.title,
      detail: `${formatTime(block.startTime)} – ${formatTime(block.endTime)}${block.location ? ` · ${block.location}` : ''}`,
      info: ['Class'],
      start: minutesOf(block.startTime),
      end: minutesOf(block.endTime),
      done: false,
      isClass: true,
    })),
    ...occs.flatMap((occ) => {
      if (!occ.task.dueTime) return []
      const category = categoryFor(occ.task.categoryId, categories)
      const start = minutesOf(occ.task.dueTime)
      return [
        {
          key: occ.key,
          title: occ.task.title,
          detail: formatTime(occ.task.dueTime),
          info: taskInfo(occ.task, category.name),
          start,
          end: start + TASK_MINUTES,
          done: occ.done,
          style: category === UNCATEGORIZED ? undefined : tint(category.colorKey),
          isClass: false,
          taskId: occ.task.id,
        },
      ]
    }),
  ]

  const lanes = layoutLanes(items)
  const hoveredItem = hovered && items.find((item) => item.key === hovered.key)
  const show = (key: string) => (event: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>) =>
    setHovered({ key, rect: event.currentTarget.getBoundingClientRect() })
  const hide = () => setHovered(null)

  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const hours = Array.from({ length: 24 }, (_, index) => index)
  const top = (minutes: number) => (minutes / 60) * HOUR_PX
  const today = todayStr()
  const showNow = date === today
  // Today opens centered on the current time; other days on their first item (or 9 AM).
  const focus = showNow ? nowMinutes : Math.min(9 * 60, ...items.map((item) => item.start))

  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = Math.max(0, top(focus) - el.clientHeight / 2)
    // Re-center when the day changes, not on every minute tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  return (
    <section aria-label="Schedule">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-fg-muted">
        {date === today ? 'Today’s schedule' : `Schedule · ${friendlyDate(date, today)}`}
      </h2>
      <div ref={scroller} onScroll={hide} className="overflow-y-auto rounded-lg border border-line bg-raised pb-4 pl-16 pr-4 pt-4 shadow-card" style={{ maxHeight: VIEW_PX }}>
        <div className="relative">
          {hours.map((hour) => (
            <div key={hour} className="relative border-t border-line" style={{ height: HOUR_PX }}>
              <span className="tabular absolute -left-14 -top-2.5 w-11 text-right text-xs text-fg-subtle">{hourLabel(hour)}</span>
            </div>
          ))}
          {/* Overlapping items share the width in lanes, each overlapping its neighbor by half. */}
          {items.map((item, index) => {
            const lane = lanes[index] ?? { lane: 0, lanes: 1 }
            const box = laneBox(lane)
            const className = cx(
              'absolute overflow-hidden rounded-md border px-3 py-1 text-left text-xs',
              item.isClass ? 'border-dashed border-line-strong bg-raised' : item.style ? 'border-transparent' : 'border-line bg-raised',
              // A thin gap in the card color keeps overlapping items apart.
              lane.lanes > 1 && 'outline outline-1 outline-raised',
              item.done && 'opacity-60',
            )
            const style: CSSProperties = {
              ...item.style,
              top: top(item.start),
              height: Math.max(26, top(item.end) - top(item.start) - 2),
              // 6px in from the left, 4px from the right, as before lanes.
              left: `calc(6px + (100% - 10px) * ${box.left})`,
              width: `calc((100% - 10px) * ${box.width})`,
              zIndex: 1 + lane.lane,
            }
            const hover = {
              onMouseEnter: show(item.key),
              onMouseLeave: hide,
              'aria-describedby': hovered?.key === item.key ? INFO_ID : undefined,
            }
            const body = (
              <>
                <span className="flex items-baseline gap-2">
                  <span className={cx('truncate text-sm font-semibold text-fg', item.done && 'line-through')}>{item.title}</span>
                  <span className="tabular shrink-0 text-fg-muted">{item.detail}</span>
                </span>
              </>
            )
            const { taskId } = item
            return taskId ? (
              <button
                key={item.key}
                type="button"
                onClick={() => openEditor({ mode: 'edit', taskId })}
                onFocus={show(item.key)}
                onBlur={hide}
                {...hover}
                className={cx(className, 'transition-colors hover:border-line-strong')}
                style={style}
              >
                {body}
              </button>
            ) : (
              <div key={item.key} {...hover} className={className} style={style}>
                {body}
              </div>
            )
          })}
          {showNow && (
            <div className="absolute -left-2 right-0 z-20 pointer-events-none border-t-[1.5px] border-highlight" style={{ top: top(nowMinutes) }}>
              <span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-highlight" />
              <span className="tabular absolute -top-5 right-0 bg-raised px-1 text-xs font-semibold text-fg-muted">
                Now · {format(now, 'h:mm a')}
              </span>
            </div>
          )}
        </div>
      </div>
      {hovered && hoveredItem && <InfoCard item={hoveredItem} rect={hovered.rect} />}
    </section>
  )
}
