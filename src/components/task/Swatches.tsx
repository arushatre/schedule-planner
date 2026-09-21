import { cx } from '@/lib/cx'
import { PALETTE, PALETTE_KEYS } from '@/lib/palette'
import type { PaletteKey } from '@/lib/palette'

export function Swatches({ value, onChange }: { value: PaletteKey; onChange: (key: PaletteKey) => void }) {
  return (
    <div role="radiogroup" aria-label="Color" className="flex flex-wrap gap-2">
      {PALETTE_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={key === value}
          aria-label={PALETTE[key].label}
          title={PALETTE[key].label}
          onClick={() => onChange(key)}
          className={cx(
            'h-7 w-7 rounded-full border-2 transition-colors',
            PALETTE[key].solid,
            key === value ? 'border-fg' : 'border-transparent hover:border-fg-subtle',
          )}
        />
      ))}
    </div>
  )
}
