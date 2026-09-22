import type { Occurrence } from '@/types/model'

/** A reminder older than this when we notice it is skipped, not fired late. */
export const MAX_LATE_MINUTES = 120

export function reminderKey(occ: Occurrence): string {
  return `${occ.key}@${occ.task.reminderTime ?? ''}`
}

const minutesOf = (time: string): number => {
  const [hours = '0', minutes = '0'] = time.split(':')
  return Number(hours) * 60 + Number(minutes)
}

/**
 * Occurrences dated `today` whose reminder time has passed (within the grace
 * window), that aren't done and haven't already fired.
 */
export function dueReminders(occurrences: Occurrence[], now: Date, today: string, fired: Set<string>): Occurrence[] {
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  return occurrences.filter((occ) => {
    const time = occ.task.reminderTime
    if (!time || occ.done || occ.date !== today) return false
    if (fired.has(reminderKey(occ))) return false
    const late = nowMinutes - minutesOf(time)
    return late >= 0 && late <= MAX_LATE_MINUTES
  })
}
