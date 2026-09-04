import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * An identifier lifted out of the prose.
 *
 * Email addresses, lot numbers, material codes and file names are data, not
 * sentences. Setting them as running text is what turns a panel into a wall;
 * a bordered chip with its own tint and a glyph gives the eye somewhere to
 * stop and makes the value obviously quotable.
 */
export function DataChip({
  icon: Icon, label, value, tone = 'default', className,
}: {
  icon?: LucideIcon
  /** Optional caption above the value, for when the value alone is ambiguous. */
  label?: string
  value: string
  tone?: 'default' | 'accent'
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-sm border px-2 py-1',
        tone === 'accent'
          ? 'border-ai-border bg-ai-from/60'
          : 'border-border bg-muted/60',
        className,
      )}
    >
      {Icon && <Icon className="text-muted-foreground size-3.5 shrink-0" aria-hidden />}
      {label && <span className="text-muted-foreground shrink-0 text-2xs">{label}</span>}
      <span className="text-foreground truncate font-mono text-xs">{value}</span>
    </span>
  )
}
