import { useId } from 'react'

/**
 * Eight weeks of counts, drawn small.
 *
 * No axes, no labels, no tooltip: this is a shape, not a chart. If a number
 * matters enough to read precisely it belongs in the figure above it, and if
 * the shape matters enough to interrogate it belongs on the Insights page.
 */
export function Sparkline({
  values,
  tone = 'neutral',
  className,
}: {
  values: number[]
  tone?: 'neutral' | 'warning'
  className?: string
}) {
  const id = useId()
  if (values.length < 2) return null

  const W = 96
  const H = 26
  const max = Math.max(...values, 1)
  const step = W / (values.length - 1)
  const y = (v: number) => H - 2 - (v / max) * (H - 5)
  const line = values.map((v, i) => `${i * step},${y(v)}`).join(' ')
  const stroke = tone === 'warning' ? 'var(--sev-high)' : 'var(--accent)'

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      role="img"
      aria-label={`Trend over the last ${values.length} weeks, ending at ${values.at(-1)}`}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.16" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${H} ${line} ${W},${H}`} fill={`url(#${id})`} />
      <polyline points={line} fill="none" stroke={stroke} strokeWidth="1.5"
        strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={W} cy={y(values.at(-1) as number)} r="2" fill={stroke} />
    </svg>
  )
}
