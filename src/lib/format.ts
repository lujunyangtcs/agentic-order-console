/** Relative time, tuned for an operational queue: precise while it is fresh,
 *  coarse once it is old. "3 days ago" is what a reviewer thinks in. */
export function relativeAge(iso: string, now = Date.now()): string {
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return '—'
  const mins = Math.round((now - then) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 14) return `${days} days ago`
  const weeks = Math.round(days / 7)
  if (weeks < 8) return `${weeks} weeks ago`
  return new Date(then).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** Sort-friendly bucket used by the age filter. */
export function ageBucket(iso: string, now = Date.now()): 'today' | 'week' | 'older' {
  const days = (now - Date.parse(iso)) / 86_400_000
  if (days < 1) return 'today'
  if (days < 7) return 'week'
  return 'older'
}

export function pct(n: number): string {
  return `${Math.round(n * 100)}%`
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}
