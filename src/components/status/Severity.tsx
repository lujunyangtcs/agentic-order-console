import { AlertOctagon, AlertTriangle, Info, CircleAlert } from 'lucide-react'
import type { Severity } from '@/types/domain'
import { cn } from '@/lib/utils'

/**
 * Severity, rendered so it survives a black-and-white printout.
 *
 * §10.6 and §19.1 both say the same thing from different angles: colour is
 * never the only signal. Every severity here carries a distinct glyph and a
 * word, and the colour is the third channel rather than the first. That is not
 * only an accessibility rule — a printed bill of lading or an audit pack that gets
 * printed loses the colour and keeps the meaning.
 */

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  info: 'Info',
}

const GLYPH: Record<Severity, typeof AlertOctagon> = {
  critical: AlertOctagon,
  high: AlertTriangle,
  medium: CircleAlert,
  info: Info,
}

const TONE: Record<Severity, string> = {
  critical: 'text-sev-critical',
  high: 'text-sev-high',
  medium: 'text-sev-medium',
  info: 'text-sev-info',
}

const TINT: Record<Severity, string> = {
  critical: 'bg-sev-critical-bg text-sev-critical-on-bg',
  high: 'bg-sev-high-bg text-sev-high-on-bg',
  medium: 'bg-sev-medium-bg text-sev-medium-on-bg',
  info: 'bg-sev-info-bg text-sev-info-on-bg',
}

export function SeverityIcon({ severity, className }: { severity: Severity; className?: string }) {
  const Glyph = GLYPH[severity]
  return (
    <Glyph className={cn('size-3.5 shrink-0', TONE[severity], className)} aria-hidden />
  )
}

export function SeverityChip({ severity, count }: { severity: Severity; count?: number }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-xs px-1.5 py-0.5 text-2xs font-medium',
        TINT[severity],
      )}
    >
      <SeverityIcon severity={severity} className="size-3" />
      {SEVERITY_LABEL[severity]}
      {count !== undefined && <span className="tabular">{count}</span>}
    </span>
  )
}
