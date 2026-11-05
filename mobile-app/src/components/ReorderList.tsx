import * as Haptics from 'expo-haptics'
import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Animated, View } from 'react-native'
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler'

import { dropIndex } from '@/lib/tasks'
import { useTheme } from '../theme'

interface HandleProps {
  label: string
  onStart: () => void
  onUpdate: (dy: number) => void
  onEnd: () => void
  onStep: (step: -1 | 1) => void
}

/** Three short lines at the row's right edge: hold, then drag. VoiceOver gets Move up / Move down. */
function Handle(props: HandleProps) {
  const theme = useTheme()
  // The gesture may keep its first callbacks, so they read the latest props through a ref.
  const latest = useRef(props)
  latest.current = props
  const pan = usePanGesture({
    activateAfterLongPress: 150,
    runOnJS: true,
    onActivate: () => latest.current.onStart(),
    onUpdate: (event) => latest.current.onUpdate(event.translationY),
    onDeactivate: () => latest.current.onEnd(),
  })
  return (
    <GestureDetector gesture={pan}>
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={`Reorder ${props.label}`}
        accessibilityHint="Hold and drag to move it."
        accessibilityActions={[
          { name: 'moveUp', label: 'Move up' },
          { name: 'moveDown', label: 'Move down' },
        ]}
        onAccessibilityAction={(event) => props.onStep(event.nativeEvent.actionName === 'moveUp' ? -1 : 1)}
        style={{ alignSelf: 'stretch', justifyContent: 'center', gap: 4, paddingHorizontal: 16 }}
      >
        {[0, 1, 2].map((line) => (
          <View key={line} style={{ width: 16, height: 2, borderRadius: 1, backgroundColor: theme.subtle }} />
        ))}
      </View>
    </GestureDetector>
  )
}

interface Props<T> {
  items: T[]
  keyOf: (item: T) => string
  labelOf: (item: T) => string
  renderItem: (item: T, index: number, handle: ReactNode) => ReactNode
  /** Called once on drop with the old and new index. */
  onMove: (from: number, to: number) => void
  /** Lets the screen stop scrolling while a row is held. */
  onDragging?: (dragging: boolean) => void
}

/**
 * A list whose rows reorder by dragging their handle; the dragged row stays inside the list.
 * shortcut: no auto-scroll while dragging, so a row can only travel within what's on screen; add it if lists get long.
 */
export function ReorderList<T>({ items, keyOf, labelOf, renderItem, onMove, onDragging }: Props<T>) {
  const heights = useRef(new Map<string, number>())
  const dragY = useRef(new Animated.Value(0)).current
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null)
  const target = useRef<{ from: number; to: number } | null>(null)

  const height = (index: number) => {
    const item = items[index]
    return item === undefined ? 0 : (heights.current.get(keyOf(item)) ?? 0)
  }

  const start = (from: number) => {
    target.current = { from, to: from }
    setDrag(target.current)
    onDragging?.(true)
    void Haptics.selectionAsync().catch(() => undefined)
  }

  const update = (from: number, dy: number) => {
    const { offset, to } = dropIndex(items.map((_, index) => height(index)), from, dy)
    dragY.setValue(offset)
    if (to !== target.current?.to) {
      target.current = { from, to }
      setDrag(target.current)
    }
  }

  const end = () => {
    const done = target.current
    target.current = null
    if (done && done.to !== done.from) onMove(done.from, done.to)
    dragY.setValue(0)
    setDrag(null)
    onDragging?.(false)
  }

  // Rows between the old and new spot slide over by the dragged row's height.
  const shiftOf = (index: number) => {
    if (!drag || index === drag.from) return 0
    if (drag.from < drag.to && index > drag.from && index <= drag.to) return -height(drag.from)
    if (drag.to < drag.from && index >= drag.to && index < drag.from) return height(drag.from)
    return 0
  }

  return (
    <View>
      {items.map((item, index) => {
        const key = keyOf(item)
        const dragged = drag?.from === index
        const handle = (
          <Handle
            label={labelOf(item)}
            onStart={() => start(index)}
            onUpdate={(dy) => update(index, dy)}
            onEnd={end}
            onStep={(step) => {
              const to = index + step
              if (to >= 0 && to < items.length) onMove(index, to)
            }}
          />
        )
        return (
          <Animated.View
            key={key}
            onLayout={(event) => {
              heights.current.set(key, event.nativeEvent.layout.height)
            }}
            style={{
              transform: [{ translateY: dragged ? dragY : shiftOf(index) }],
              zIndex: dragged ? 1 : 0,
              opacity: dragged ? 0.92 : 1,
            }}
          >
            {renderItem(item, index, handle)}
          </Animated.View>
        )
      })}
    </View>
  )
}
