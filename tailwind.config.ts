import type { Config } from 'tailwindcss'

// Colors resolve to CSS variables (space-separated RGB triplets) so alpha
// modifiers work (`bg-cat-clay/15`) and dark mode is a variable swap later.
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`

const spacingSteps = [
  0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44,
  48, 52, 56, 60, 64, 72, 80, 96,
]

const spacing: Record<string, string> = {
  0: '0px',
  px: '1px',
  ...Object.fromEntries(spacingSteps.map((step) => [String(step), `${step / 4}rem`])),
}

// Everything under `theme` (not `theme.extend`) replaces Tailwind's defaults,
// so stock utilities such as `bg-blue-500` do not exist in this project.
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      canvas: v('canvas'),
      panel: v('panel'),
      raised: v('raised'),
      sunken: v('sunken'),
      line: v('line'),
      'line-strong': v('line-strong'),
      fg: v('fg'),
      'fg-muted': v('fg-muted'),
      'fg-subtle': v('fg-subtle'),
      accent: {
        DEFAULT: v('accent'),
        hover: v('accent-hover'),
        soft: v('accent-soft'),
        fg: v('accent-fg'),
      },
      frame: { DEFAULT: v('frame'), fg: v('frame-fg') },
      highlight: v('highlight'),
      ember: v('ember'),
      overdue: {
        DEFAULT: v('overdue'),
        soft: v('overdue-soft'),
      },
      scrim: v('scrim'),
      cat: {
        clay: v('cat-clay'),
        moss: v('cat-moss'),
        slate: v('cat-slate'),
        plum: v('cat-plum'),
        ochre: v('cat-ochre'),
        teal: v('cat-teal'),
        rose: v('cat-rose'),
        graphite: v('cat-graphite'),
      },
    },
    spacing,
    fontSize: {
      // Floor is 13px: nothing in the app should need squinting at.
      xs: ['0.8125rem', { lineHeight: '1.125rem' }],
      sm: ['0.9375rem', { lineHeight: '1.375rem' }],
      base: ['1rem', { lineHeight: '1.5rem' }],
      md: ['1.125rem', { lineHeight: '1.625rem' }],
      lg: ['1.375rem', { lineHeight: '1.875rem' }],
      xl: ['2rem', { lineHeight: '2.375rem' }],
      '2xl': ['3.5rem', { lineHeight: '1' }],
    },
    fontFamily: {
      // Chosen in the Customize page (src/lib/appearance.ts).
      sans: ['var(--font-sans)'],
      display: ['var(--font-display)'],
    },
    borderRadius: {
      none: '0px',
      sm: 'calc(4px * var(--radius-scale, 1))',
      DEFAULT: 'calc(6px * var(--radius-scale, 1))',
      md: 'calc(8px * var(--radius-scale, 1))',
      lg: 'calc(12px * var(--radius-scale, 1))',
      full: '9999px',
    },
    borderColor: ({ theme }) => ({
      ...theme('colors'),
      DEFAULT: theme('colors.line'),
    }),
    boxShadow: {
      none: 'none',
      inset: 'inset 0 1px 2px rgb(var(--shadow) / 0.1)',
      card: '0 1px 2px rgb(var(--shadow) / 0.05), 0 2px 8px -2px rgb(var(--shadow) / 0.06)',
      lift:
        'inset 0 1px 0 var(--inset-highlight), 0 1px 2px rgb(var(--shadow) / 0.08), 0 6px 16px -6px rgb(var(--shadow) / 0.14)',
      pop: '0 2px 4px rgb(var(--shadow) / 0.06), 0 12px 32px -8px rgb(var(--shadow) / 0.24)',
    },
    extend: {
      transitionDuration: { DEFAULT: '150ms', fast: '150ms', base: '200ms', slow: '250ms' },
      transitionTimingFunction: { DEFAULT: 'cubic-bezier(0.2, 0, 0, 1)' },
    },
  },
  plugins: [],
}

export default config
