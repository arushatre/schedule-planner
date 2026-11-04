// User-tunable appearance: every surface/text/accent token is generated from a
// background tone + accent, so the whole UI re-skins from a few choices.

export type Rgb = [number, number, number]

export interface Tone {
  label: string
  hue: number
  sat: number
}

export interface Accent {
  label: string
  light: Rgb
  dark: Rgb
}

export interface FontChoice {
  label: string
  stack: string
}

export const TONES = {
  cloud: { label: 'Cloud', hue: 214, sat: 5 },
  porcelain: { label: 'Porcelain', hue: 215, sat: 22 },
  harbor: { label: 'Harbor', hue: 205, sat: 32 },
  mist: { label: 'Sage mist', hue: 158, sat: 14 },
  lilac: { label: 'Lilac', hue: 258, sat: 18 },
  graphite: { label: 'Graphite', hue: 220, sat: 6 },
} satisfies Record<string, Tone>

export const ACCENTS = {
  // Serene Nature: #1D3557 navy in light mode; #A8D8B9 sage in dark, where navy would vanish.
  navy: { label: 'Navy & sage', light: [29, 53, 87], dark: [168, 216, 185] },
  cobalt: { label: 'Cobalt', light: [37, 74, 168], dark: [138, 168, 236] },
  jade: { label: 'Jade', light: [22, 112, 92], dark: [108, 196, 166] },
  peacock: { label: 'Peacock', light: [16, 104, 122], dark: [98, 190, 204] },
  indigo: { label: 'Indigo', light: [67, 56, 160], dark: [165, 156, 240] },
  amethyst: { label: 'Amethyst', light: [108, 58, 140], dark: [196, 160, 224] },
  brass: { label: 'Brass', light: [140, 104, 28], dark: [216, 180, 110] },
  ink: { label: 'Navy ink', light: [30, 45, 80], dark: [180, 196, 228] },
} satisfies Record<string, Accent>

export const FONTS = {
  fraunces: { label: 'Fraunces', stack: '"Fraunces Variable", ui-serif, Georgia, serif' },
  instrument: { label: 'Instrument Sans', stack: '"Instrument Sans Variable", ui-sans-serif, system-ui, sans-serif' },
  newYork: { label: 'Classic serif', stack: 'ui-serif, "New York", Georgia, serif' },
  rounded: { label: 'Rounded', stack: 'ui-rounded, "SF Pro Rounded", system-ui, sans-serif' },
  system: { label: 'System', stack: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
} satisfies Record<string, FontChoice>

export const RADII = { sharp: { label: 'Sharp', scale: 0.4 }, soft: { label: 'Soft', scale: 1 }, round: { label: 'Round', scale: 1.6 } }
export const TEXT_SIZES = { compact: { label: 'Compact', pct: 93.75 }, regular: { label: 'Regular', pct: 100 }, large: { label: 'Large', pct: 109.375 } }

export type ToneKey = keyof typeof TONES
export type AccentKey = keyof typeof ACCENTS
export type FontKey = keyof typeof FONTS
export type RadiusKey = keyof typeof RADII
export type TextSizeKey = keyof typeof TEXT_SIZES

export interface Appearance {
  tone: ToneKey
  accent: AccentKey
  displayFont: FontKey
  bodyFont: FontKey
  radius: RadiusKey
  textSize: TextSizeKey
}

export const DEFAULT_APPEARANCE: Appearance = {
  tone: 'cloud',
  accent: 'navy',
  displayFont: 'fraunces',
  bodyFont: 'instrument',
  radius: 'soft',
  textSize: 'regular',
}

export const PRESETS: { label: string; value: Appearance }[] = [
  { label: 'Serene Nature', value: DEFAULT_APPEARANCE },
  { label: 'Cobalt & Porcelain', value: { ...DEFAULT_APPEARANCE, tone: 'porcelain', accent: 'cobalt' } },
  { label: 'Jade Atelier', value: { ...DEFAULT_APPEARANCE, tone: 'mist', accent: 'jade' } },
  { label: 'Midnight Brass', value: { ...DEFAULT_APPEARANCE, tone: 'harbor', accent: 'brass', displayFont: 'newYork' } },
  { label: 'Amethyst Study', value: { ...DEFAULT_APPEARANCE, tone: 'lilac', accent: 'amethyst', displayFont: 'rounded', bodyFont: 'rounded', radius: 'round' } },
  { label: 'Peacock Harbor', value: { ...DEFAULT_APPEARANCE, tone: 'harbor', accent: 'peacock' } },
  { label: 'Navy Editorial', value: { ...DEFAULT_APPEARANCE, tone: 'graphite', accent: 'ink', displayFont: 'newYork', bodyFont: 'system', radius: 'sharp' } },
]

function hsl(h: number, s: number, l: number): Rgb {
  const sat = s / 100
  const light = l / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = sat * Math.min(light, 1 - light)
  const f = (n: number) => light - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255)) as Rgb
}

const mix = (a: Rgb, b: Rgb, t: number): Rgb => a.map((v, i) => Math.round(v + (b[i]! - v) * t)) as Rgb
const css = (rgb: Rgb) => rgb.join(' ')

// Serene Nature's vermilion means one thing everywhere: overdue.
const VERMILION: Rgb = [237, 85, 59]

const channel = (v: number) => {
  const c = v / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}
const luminance = ([r, g, b]: Rgb) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)

/** WCAG contrast ratio between two colors (1–21). */
export function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

/** The hue, darkened (light mode) or lightened (dark) just enough to read at 4.5:1 on `surface`. */
function inkOn(hue: Rgb, surface: Rgb, light: boolean): Rgb {
  const toward: Rgb = light ? [0, 0, 0] : [255, 255, 255]
  for (let step = 0; step <= 20; step++) {
    const candidate = mix(hue, toward, step / 20)
    if (contrast(candidate, surface) >= 4.5) return candidate
  }
  return toward
}

/** All generated CSS variables for one mode. */
export function tokensFor(look: Appearance, mode: 'light' | 'dark'): Record<string, string> {
  const { hue, sat } = TONES[look.tone]
  const accent = ACCENTS[look.accent][mode]
  const n = (s: number, l: number) => hsl(hue, s, l)
  const light = mode === 'light'
  const canvas = light ? n(sat, 96) : n(sat + 6, 9)
  const raised = light ? n(sat, 99.5) : n(sat + 6, 16)
  // The frame (web sidebar, phone header) is the preset's accent as a deep, solid surface in both modes.
  const frame = light ? ACCENTS[look.accent].light : mix(ACCENTS[look.accent].light, [0, 0, 0], 0.3)
  return {
    overdue: css(inkOn(VERMILION, raised, light)),
    'overdue-soft': css(mix(raised, VERMILION, light ? 0.09 : 0.12)),
    frame: css(frame),
    'frame-fg': css([241, 241, 241]),
    canvas: css(canvas),
    'canvas-top': css(light ? n(sat, 98.5) : n(sat + 8, 13)),
    'canvas-bottom': css(light ? n(sat, 92) : n(sat + 6, 6)),
    panel: css(light ? n(sat, 94) : n(sat + 6, 12)),
    raised: css(raised),
    sunken: css(light ? n(sat, 90.5) : n(sat + 6, 7)),
    line: css(light ? n(sat, 86) : n(sat + 4, 22)),
    'line-strong': css(light ? n(sat, 72) : n(sat + 4, 33)),
    fg: css(light ? n(sat + 20, 13) : n(sat, 94)),
    'fg-muted': css(light ? n(sat, 36) : n(sat, 74)),
    'fg-subtle': css(light ? n(sat, 50) : n(sat, 56)),
    accent: css(accent),
    'accent-hover': css(light ? mix(accent, [0, 0, 0], 0.18) : mix(accent, [255, 255, 255], 0.18)),
    'accent-soft': css(mix(canvas, accent, light ? 0.12 : 0.2)),
    'accent-fg': css(light ? [255, 255, 255] : n(sat + 10, 9)),
    scrim: css(light ? n(sat + 20, 13) : [0, 0, 0]),
    shadow: css(light ? n(sat + 20, 15) : [0, 0, 0]),
  }
}

/** A stylesheet that defines every token for light and dark. */
export function appearanceCss(look: Appearance): string {
  const block = (mode: 'light' | 'dark') =>
    Object.entries(tokensFor(look, mode))
      .map(([key, value]) => `--${key}: ${value};`)
      .join(' ')
  const shared = `--font-display: ${FONTS[look.displayFont].stack}; --font-sans: ${FONTS[look.bodyFont].stack}; --radius-scale: ${RADII[look.radius].scale};`
  return `:root { ${shared} ${block('light')} font-size: ${TEXT_SIZES[look.textSize].pct}%; } :root[data-theme='dark'] { ${block('dark')} }`
}

/** Parses a stored value, falling back field-by-field to defaults. */
export function parseAppearance(raw: string | null): Appearance {
  let parsed: Record<string, unknown> = {}
  try {
    const value: unknown = JSON.parse(raw ?? '{}')
    if (typeof value === 'object' && value !== null) parsed = value as Record<string, unknown>
  } catch {
    // Corrupt value: use defaults.
  }
  const pick = <K extends string>(key: keyof Appearance, options: Record<K, unknown>, fallback: K): K =>
    typeof parsed[key] === 'string' && parsed[key] in options ? (parsed[key] as K) : fallback
  return {
    tone: pick('tone', TONES, DEFAULT_APPEARANCE.tone),
    accent: pick('accent', ACCENTS, DEFAULT_APPEARANCE.accent),
    displayFont: pick('displayFont', FONTS, DEFAULT_APPEARANCE.displayFont),
    bodyFont: pick('bodyFont', FONTS, DEFAULT_APPEARANCE.bodyFont),
    radius: pick('radius', RADII, DEFAULT_APPEARANCE.radius),
    textSize: pick('textSize', TEXT_SIZES, DEFAULT_APPEARANCE.textSize),
  }
}

export function applyAppearance(look: Appearance, doc: Document = document): void {
  let style = doc.getElementById('daybook-appearance')
  if (!style) {
    style = doc.createElement('style')
    style.id = 'daybook-appearance'
    doc.head.appendChild(style)
  }
  style.textContent = appearanceCss(look)
}
