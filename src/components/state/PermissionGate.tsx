import type { ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { useAuth } from '@/app/auth'
import { can, roleFor, type Capability } from '@/app/permissions'
import { cn } from '@/lib/utils'

/**
 * A control the current role may not use — shown, refused, and explained.
 *
 * §18's permission-denied clause has three parts and this component exists
 * because the third is the one everyone drops: leave the record readable, name
 * the role required, and **do not silently hide the decision gate**.
 *
 * So the refused state is not an absence and not a greyed-out button with a
 * tooltip nobody hovers. It is the gate itself, rendered in place, saying which
 * role holds the key. A planner who reaches a substitute needing engineering
 * sign-off should leave the screen knowing to go and ask engineering — that is
 * the whole content of the interaction, and hiding the control deletes it.
 *
 * `reason` is for the business fact behind the refusal when there is one worth
 * stating. The role is named either way.
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
  const role = session?.role ?? 'Viewer'
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
        Requires {required}
      </p>
      <p className="text-muted-foreground text-2xs leading-relaxed">
        {reason ? `${reason} ` : ''}
        You are signed in as {role}. The record stays readable; only this action is held.
      </p>
      {/* The control itself, inert and visibly so. Present, because the gate is
          the abc-erpmation. `inert` keeps it out of the tab order without the
          ambiguity of a disabled button that might just be loading. */}
      <div className="pointer-events-none mt-0.5 opacity-45 grayscale" inert>
        {children}
      </div>
    </div>
  )
}
