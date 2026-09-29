import { describe, expect, it } from 'vitest'

import { parseQuickAdd } from './quickAdd'
import type { Category } from '@/types/model'

// 2026-09-21 is a Monday.
const today = '2026-09-21'
const categories: Category[] = [
  { id: 'school', name: 'School', colorKey: 'slate', archived: false, order: 0, createdAt: 0 },
  { id: 'work', name: 'Work', colorKey: 'clay', archived: false, order: 1, createdAt: 0 },
  { id: 'old', name: 'Old', colorKey: 'plum', archived: true, order: 2, createdAt: 0 },
  { id: 'side', name: 'Side Project', colorKey: 'teal', archived: false, order: 3, createdAt: 0 },
]
const parse = (input: string) => parseQuickAdd(input, { today, categories })

describe('parseQuickAdd', () => {
  it('parses the headline example', () => {
    expect(parse('Essay draft fri 5pm #english')).toMatchObject({
      title: 'Essay draft',
      dueDate: '2026-09-25',
      dueTime: '17:00',
      tags: ['english'],
      categoryId: null,
    })
  })

  it('leaves plain text alone', () => {
    expect(parse('Buy oat milk')).toEqual({
      title: 'Buy oat milk',
      dueDate: null,
      dueTime: null,
      tags: [],
      categoryId: null,
      priority: null,
      recurrence: null,
    })
  })

  it('collapses extra whitespace in the title', () => {
    expect(parse('  Essay    draft   fri ').title).toBe('Essay draft')
  })

  describe('dates', () => {
    it('handles today, tomorrow and shorthand', () => {
      expect(parse('Call mom today').dueDate).toBe('2026-09-21')
      expect(parse('Call mom tomorrow').dueDate).toBe('2026-09-22')
      expect(parse('Call mom tmrw').dueDate).toBe('2026-09-22')
    })

    it('resolves weekdays on-or-after today, and "next" strictly after', () => {
      expect(parse('Gym mon').dueDate).toBe('2026-09-21')
      expect(parse('Gym next mon').dueDate).toBe('2026-09-28')
      expect(parse('Gym wednesday').dueDate).toBe('2026-09-23')
      expect(parse('Gym on thurs').dueDate).toBe('2026-09-24')
      expect(parse('Gym this sat').dueDate).toBe('2026-09-26')
    })

    it('handles relative offsets', () => {
      expect(parse('Follow up in 3 days').dueDate).toBe('2026-09-24')
      expect(parse('Follow up in 2 weeks').dueDate).toBe('2026-10-05')
      expect(parse('Renew in 1 month').dueDate).toBe('2026-10-21')
      expect(parse('Plan next week').dueDate).toBe('2026-09-28')
      expect(parse('Plan next month').dueDate).toBe('2026-10-21')
    })

    it('handles month names, numeric dates and ISO dates', () => {
      expect(parse('Pay rent oct 5').dueDate).toBe('2026-10-05')
      expect(parse('Pay rent October 5th').dueDate).toBe('2026-10-05')
      expect(parse('Pay rent 5 oct').dueDate).toBe('2026-10-05')
      expect(parse('Trip 10/12').dueDate).toBe('2026-10-12')
      expect(parse('Trip 10/12/27').dueDate).toBe('2027-10-12')
      expect(parse('Launch 2026-12-01').dueDate).toBe('2026-12-01')
      expect(parse('Launch dec 1, 2027').dueDate).toBe('2027-12-01')
    })

    it('rolls month/day dates that already passed to next year', () => {
      expect(parse('Birthday sep 5').dueDate).toBe('2027-09-05')
      expect(parse('Birthday sep 21').dueDate).toBe('2026-09-21')
    })

    it('rejects impossible dates instead of guessing', () => {
      expect(parse('Report feb 30').dueDate).toBeNull()
      expect(parse('Report feb 30').title).toBe('Report feb 30')
    })

    it('does not mistake plain numbers for dates', () => {
      expect(parse('Read chapter 5')).toMatchObject({ title: 'Read chapter 5', dueDate: null, dueTime: null })
      expect(parse('Do 20 pushups')).toMatchObject({ title: 'Do 20 pushups', dueDate: null })
    })
  })

  describe('times', () => {
    it('parses 12-hour times with optional minutes and "at"', () => {
      expect(parse('Call at 5pm').dueTime).toBe('17:00')
      expect(parse('Call 5:30 pm').dueTime).toBe('17:30')
      expect(parse('Call at 9am').dueTime).toBe('09:00')
      expect(parse('Call 9:05AM').dueTime).toBe('09:05')
    })

    it('handles the midnight/noon boundaries', () => {
      expect(parse('Task 12am').dueTime).toBe('00:00')
      expect(parse('Task 12pm').dueTime).toBe('12:00')
      expect(parse('Lunch noon').dueTime).toBe('12:00')
    })

    it('parses 24-hour times and rejects invalid ones', () => {
      expect(parse('Standup 14:30').dueTime).toBe('14:30')
      expect(parse('Standup 7:05').dueTime).toBe('07:05')
      expect(parse('Task 13pm').dueTime).toBeNull()
      expect(parse('Task 25:00').dueTime).toBeNull()
    })
  })

  describe('tags, categories and priority', () => {
    it('turns #name into a category when one matches, otherwise a tag', () => {
      expect(parse('Essay #school')).toMatchObject({ title: 'Essay', categoryId: 'school', tags: [] })
      expect(parse('Essay #SCHOOL #english')).toMatchObject({ categoryId: 'school', tags: ['english'] })
      expect(parse('Ship it #side-project')).toMatchObject({ categoryId: 'side', tags: [] })
    })

    it('ignores archived categories and dedupes tags', () => {
      expect(parse('Task #old')).toMatchObject({ categoryId: null, tags: ['old'] })
      expect(parse('Task #a #a #b').tags).toEqual(['a', 'b'])
    })

    it('reads !priority', () => {
      expect(parse('Task !urgent').priority).toBe('urgent')
      expect(parse('Task !high').priority).toBe('high')
      expect(parse('Task !med').priority).toBe('medium')
      expect(parse('Task !low').priority).toBe('low')
      expect(parse('Wow!').priority).toBeNull()
    })
  })

  describe('recurrence', () => {
    it('handles daily / weekly / monthly words', () => {
      expect(parse('Water plants daily')).toMatchObject({ recurrence: { kind: 'daily' }, dueDate: '2026-09-21' })
      expect(parse('Review every week').recurrence?.kind).toBe('weekly')
      expect(parse('Pay rent every month').recurrence?.kind).toBe('monthly')
      expect(parse('Pay rent monthly').recurrence?.kind).toBe('monthly')
    })

    it('anchors "every <weekday>" on the next matching day', () => {
      expect(parse('Team sync every fri')).toMatchObject({
        title: 'Team sync',
        recurrence: { kind: 'weekly' },
        dueDate: '2026-09-25',
      })
    })

    it('handles custom weekday patterns in several spellings', () => {
      expect(parse('Gym every mon wed fri 7am')).toMatchObject({
        title: 'Gym',
        recurrence: { kind: 'weekdays', weekdays: [1, 3, 5] },
        dueDate: '2026-09-21',
        dueTime: '07:00',
      })
      expect(parse('Gym every tue/thu').recurrence).toMatchObject({ kind: 'weekdays', weekdays: [2, 4] })
      expect(parse('Gym every mon, wed and fri').recurrence).toMatchObject({ weekdays: [1, 3, 5] })
    })

    it('handles "every weekday"', () => {
      expect(parse('Standup every weekday 9:30am')).toMatchObject({
        recurrence: { kind: 'weekdays', weekdays: [1, 2, 3, 4, 5] },
        dueDate: '2026-09-21',
        dueTime: '09:30',
      })
    })

    it('starts a weekday pattern on the first matching day when today is not one', () => {
      // Saturday: next Mon/Wed/Fri after "today" is Monday.
      const saturday = parseQuickAdd('Gym every mon wed', { today: '2026-09-26', categories })
      expect(saturday.dueDate).toBe('2026-09-28')
    })
  })

  it('strips dangling connector words left behind', () => {
    expect(parse('Essay draft due fri').title).toBe('Essay draft')
    expect(parse('Submit by friday 5pm').title).toBe('Submit')
    expect(parse('Meeting at 3pm on friday').title).toBe('Meeting')
  })

  it('keeps text as the title when it was only instructions', () => {
    expect(parse('tomorrow 5pm')).toMatchObject({ title: 'tomorrow 5pm', dueDate: null, dueTime: null })
  })
})
