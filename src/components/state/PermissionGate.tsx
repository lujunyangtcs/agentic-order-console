import type { ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { useAuth } from '@/app/auth'
import { can, roleFor, type Capability } from '@/app/permissions'
import { roleNameKey, useT } from '@/i18n'
import { cn } from '@/lib/utils'

/**
 * A control the current role may not use — shown, refused, and explained.
 *
 * Three parts, and the third is the one everyone drops: leave the record
 * readable, name the role required, and do not silently hide the decision
 * gate. A control that vanishes teaches people the action does not exist; a
 * control that is present, refused and explained teaches them who to ask.
 */
export function PermissionGate({
  capability, children, reason, className,
}: {
  capability: Capability
  children: ReactNode
  reason?: string
  className?: string
}) {
  const { session } = useAuth()
  const t = useT()
  const role = session?.role ?? 'Customer'
  if (can(role, capability)) return <>{children}</>

  const required = roleFor(capability)

  return (
    <div
      data-permission-denied={capability}
      className={cn(
        'border-structural-border bg-muted/40 flex flex-col gap-1.5 rounded-lg border border-dashed px-3 py-2.5',
        className,
      )}
    >
      <p className="text-foreground flex items-center gap-1.5 text-xs font-medium">
        <Lock className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
        {t('role.requires', { role: t(roleNameKey(required)) })}
      </p>
      {reason && <p className="text-muted-foreground text-2xs leading-relaxed">{reason}</p>}
      <div className="pointer-events-none mt-0.5 opacity-45 grayscale" inert>
        {children}
      </div>
    </div>
  )
}
