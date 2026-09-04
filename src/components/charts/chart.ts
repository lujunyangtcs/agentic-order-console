/**
 * Shared recharts idioms, lifted from the donor's analytics page so every
 * chart in the console reads the same: tooltips on the surface colour with
 * the structural border, small muted axis type, and no entrance animation
 * (a chart that draws itself on every re-render reads as an ambient loop).
 */
export const TIP = {
  contentStyle: {
    background: 'var(--surface)',
    border: '1px solid var(--structural-border)',
    borderRadius: 2,
    fontSize: 12,
  },
} as const

export const AXIS = { fontSize: 10, fill: 'var(--muted-foreground)' } as const

export const GRID = { stroke: 'var(--border)', strokeDasharray: '2 4' } as const
