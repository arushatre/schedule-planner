import DateTimePicker from '@react-native-community/datetimepicker'
import { format } from 'date-fns'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Alert, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { formatTime, fromDateStr, toDateStr } from '@/lib/dates'
import { ALERT_OFFSETS, alertLabel } from '@/lib/reminders'
import { defaultCategoryId, makeTask, subtaskProgress } from '@/lib/tasks'
import { PRIORITIES, PRIORITY_LABEL } from '@/types/model'
import type { RecurrenceKind, Task } from '@/types/model'
import { useUndo } from '../components/Snackbar'
import { SubtaskList } from '../components/SubtaskList'
import { deleteTask, saveTask, useStore } from '../store'
import { useTheme } from '../theme'
import { Button, Chip, Text } from '../ui'

const REPEATS: { kind: RecurrenceKind; label: string }[] = [
  { kind: 'none', label: 'Once' },
  { kind: 'daily', label: 'Daily' },
  { kind: 'weekly', label: 'Weekly' },
  { kind: 'monthly', label: 'Monthly' },
]

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text size="sm" tone="muted">{label}</Text>
      {children}
    </View>
  )
}

/** iOS shows the compact inline picker; Android opens its dialog on tap. */
function WhenPicker({ mode, value, label, onChange }: { mode: 'date' | 'time'; value: Date; label: string; onChange: (date: Date) => void }) {
  const [open, setOpen] = useState(false)
  if (Platform.OS === 'ios') {
    return <DateTimePicker value={value} mode={mode} display="compact" onValueChange={(_, date) => onChange(date)} />
  }
  return (
    <>
      <Chip label={label} on onPress={() => setOpen(true)} />
      {open && (
        <DateTimePicker
          value={value}
          mode={mode}
          onValueChange={(_, date) => {
            setOpen(false)
            onChange(date)
          }}
          onDismiss={() => setOpen(false)}
        />
      )}
    </>
  )
}

interface Props {
  /** null = closed; 'new' = blank task due on `today`; otherwise a task id. */
  target: string | null
  today: string
  onClose: () => void
}

export function TaskEditor({ target, today, onClose }: Props) {
  const theme = useTheme()
  const { tasks, categories, prefs } = useStore()
  const existing = tasks.find((task) => task.id === target) ?? null
  const [form, setForm] = useState<Task | null>(null)
  // Hosted here so it outlives the sheet; sits just above the tab bar.
  const { offer, snackbar } = useUndo(useSafeAreaInsets().bottom + 72)

  // Fresh form each time the sheet opens for a different target.
  const [openFor, setOpenFor] = useState<string | null>(null)
  if (target !== openFor) {
    setOpenFor(target)
    setForm(target === null ? null : (existing ?? makeTask({
            title: '',
            categoryId: defaultCategoryId(categories, prefs.personal.defaultCategoryId),
            priority: prefs.personal.defaultPriority,
            dueDate: today,
          })))
  }
  if (!form) return snackbar

  const patch = (next: Partial<Task>) => setForm({ ...form, ...next })
  const time = form.dueTime ? fromDateStr(form.dueDate ?? today) : new Date()
  if (form.dueTime) time.setHours(Number(form.dueTime.slice(0, 2)), Number(form.dueTime.slice(3)))

  const save = () => {
    if (!form.title.trim()) return Alert.alert('Add a title first.')
    saveTask({
      ...form,
      title: form.title.trim(),
      alerts: form.dueDate ? form.alerts : [],
      subtasks: form.subtasks.filter((subtask) => subtask.title.trim()).map((subtask) => ({ ...subtask, title: subtask.title.trim() })),
    })
    onClose()
  }

  // Undoable rather than confirmed: restores the task as it was before this edit.
  const remove = () => {
    if (!existing) return
    deleteTask(existing.id)
    offer(`Deleted “${existing.title}”`, () => saveTask(existing))
    onClose()
  }
  const progress = subtaskProgress(form)

  const input = {
    color: theme.fg,
    fontSize: 16 * theme.textScale,
    backgroundColor: theme.raised,
    borderColor: theme.line,
    borderWidth: 1,
    borderRadius: theme.radius(12),
    paddingHorizontal: 14,
    paddingVertical: 12,
  }

  return (
    <>
      {snackbar}
      <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <View style={{ flex: 1, backgroundColor: theme.canvas }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: theme.line }}>
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={10}>
              <Text tone="muted">Cancel</Text>
            </Pressable>
            <Text size="md" display>{existing ? 'Edit task' : 'New task'}</Text>
            <Pressable accessibilityRole="button" onPress={save} hitSlop={10}>
              <Text tone="accent" weight="600">Save</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 24, paddingBottom: 64 }} keyboardShouldPersistTaps="handled">
            <TextInput value={form.title} onChangeText={(title) => patch({ title })} placeholder="What needs doing?" accessibilityLabel="Title" placeholderTextColor={theme.subtle} autoFocus={!existing} style={[input, { fontSize: 18 * theme.textScale }]} />
            <TextInput value={form.notes} onChangeText={(notes) => patch({ notes })} placeholder="Notes" placeholderTextColor={theme.subtle} accessibilityLabel="Notes" multiline scrollEnabled={false} style={[input, { minHeight: 96, lineHeight: 22 * theme.textScale, textAlignVertical: 'top' }]} />

            <Field label={progress.total > 0 ? `Subtasks  ${progress.done}/${progress.total}` : 'Subtasks'}>
              <SubtaskList subtasks={form.subtasks} onChange={(subtasks) => patch({ subtasks })} />
            </Field>

            <Field label="When">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                {form.dueDate ? (
                  <WhenPicker mode="date" value={fromDateStr(form.dueDate)} label={format(fromDateStr(form.dueDate), 'EEE, MMM d')} onChange={(date) => patch({ dueDate: toDateStr(date) })} />
                ) : (
                  <Chip label="Add a date" on={false} onPress={() => patch({ dueDate: today })} />
                )}
                {form.dueDate && form.dueTime && (
                  <WhenPicker mode="time" value={time} label={formatTime(form.dueTime)} onChange={(date) => patch({ dueTime: format(date, 'HH:mm') })} />
                )}
                {form.dueDate && !form.dueTime && <Chip label="Add a time" on={false} onPress={() => patch({ dueTime: '17:00' })} />}
                {form.dueTime && <Chip label="No time" on={false} onPress={() => patch({ dueTime: null })} />}
                {form.dueDate && <Chip label="No date" on={false} onPress={() => patch({ dueDate: null, dueTime: null })} />}
              </View>
            </Field>

            {form.dueDate && (
              <Field label="Alerts">
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {ALERT_OFFSETS.map((minutes) => {
                    const on = form.alerts.includes(minutes)
                    return (
                      <Chip
                        key={minutes}
                        label={alertLabel(minutes)}
                        on={on}
                        onPress={() => patch({ alerts: on ? form.alerts.filter((m) => m !== minutes) : [...form.alerts, minutes].sort((a, b) => a - b) })}
                      />
                    )
                  })}
                </View>
                {!form.dueTime && form.alerts.length > 0 && <Text size="xs" tone="subtle">No time set, so alerts count from 9:00 AM.</Text>}
              </Field>
            )}

            <Field label="Category">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {categories.filter((c) => !c.archived).map((category) => (
                  <Chip key={category.id} label={category.name} dot={theme.category(category.colorKey)} on={form.categoryId === category.id} onPress={() => patch({ categoryId: category.id })} />
                ))}
              </View>
            </Field>

            <Field label="Priority">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {PRIORITIES.map((priority) => (
                  <Chip key={priority} label={PRIORITY_LABEL[priority]} on={form.priority === priority} onPress={() => patch({ priority })} />
                ))}
              </View>
            </Field>

            {form.dueDate && (
              <Field label="Repeat">
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {REPEATS.map(({ kind, label }) => (
                    <Chip key={kind} label={label} on={form.recurrence.kind === kind} onPress={() => patch({ recurrence: { ...form.recurrence, kind } })} />
                  ))}
                </View>
              </Field>
            )}

            {existing && <Button label="Delete task" variant="danger" onPress={remove} />}
          </ScrollView>
        </View>
      </Modal>
    </>
  )
}
