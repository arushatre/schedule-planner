import { describe, expect, it } from 'vitest'

import type { ClassBlock } from '@/types/model'
import { toGoogleEvents } from './googleCalendar'
import { makeTask } from './tasks'

const TZ = 'America/New_York'
const ID = '0f8e2b1c-3d4a-4b5c-8d6e-7f8091a2b3c4'

describe('toGoogleEvents', () => {
  it('maps an untimed task to an all-day event with a base32hex-safe id', () => {
    const task = { ...makeTask({ title: 'Essay', categoryId: '' }), id: ID, dueDate: '2026-11-06' }
    const [event] = toGoogleEvents([task], [], TZ)
    expect(event).toMatchObject({ summary: 'Essay', start: { date: '2026-11-06' }, end: { date: '2026-11-07' } })
    expect(event?.id).toMatch(/^[0-9a-v]{5,1024}$/)
  })

  it('gives timed repeats a time zone, a UTC UNTIL, and a matching EXDATE for moved occurrences', () => {
    const task = {
      ...makeTask({ title: 'Gym', categoryId: '' }),
      id: ID,
      dueDate: '2026-11-02',
      dueTime: '09:00',
      recurrence: { kind: 'weekly' as const, weekdays: [], until: '2026-12-31' },
      exceptions: { '2026-11-09': '2026-11-10' },
    }
    const [series, moved] = toGoogleEvents([task], [], TZ)
    expect(series?.start).toEqual({ dateTime: '2026-11-02T09:00:00', timeZone: TZ })
    expect(series?.recurrence?.[0]).toMatch(/^RRULE:FREQ=WEEKLY;UNTIL=\d{8}T\d{6}Z$/)
    expect(series?.recurrence?.[1]).toBe(`EXDATE;TZID=${TZ}:20261109T090000`)
    expect(moved).toMatchObject({ start: { dateTime: '2026-11-10T09:00:00', timeZone: TZ } })
    expect(moved?.id).toMatch(/^[0-9a-v]+$/)
  })

  it('skips undated tasks and starts class blocks on their first matching weekday', () => {
    const block: ClassBlock = {
      id: ID,
      title: 'Math',
      location: 'Room 4',
      weekdays: [1, 3, 5],
      startTime: '09:00',
      endTime: '09:50',
      colorKey: 'slate',
      createdAt: 0,
    }
    const undated = makeTask({ title: 'Someday', categoryId: '' })
    // 2026-11-04 is a Wednesday.
    const events = toGoogleEvents([undated], [block], TZ, new Date(2026, 10, 4, 12))
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      summary: 'Math',
      location: 'Room 4',
      start: { dateTime: '2026-11-04T09:00:00', timeZone: TZ },
      end: { dateTime: '2026-11-04T09:50:00', timeZone: TZ },
      recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR'],
    })
  })
})
