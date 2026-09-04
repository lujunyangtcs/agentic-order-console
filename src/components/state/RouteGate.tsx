import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/app/auth'
import { homeFor } from '@/app/nav'
import { roleNameKey, useT } from '@/i18n'
import type { Role } from '@/types/domain'
import { EmptyState } from './States'
import { Button } from '@/components/ui/button'

/**
 * Pages belong to roles. A role that opens somebody else's page sees an
 * empty state that names the owner — never a 404, never a redirect that
 * hides the fact that the page exists. Administrator sees everything.
 */
export function RouteGate({ owners, children }: { owners: Role[]; children: ReactNode }) {
  const { session } = useAuth()
  const t = useT()
  if (!session) return null
  if (session.role === 'Administrator' || owners.includes(session.role)) return <>{children}</>

  const owner = owners[0]
  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <EmptyState
        title={t(roleNameKey(owner))}
        description={t('common.emptyRole', { role: t(roleNameKey(owner)) })}
        action={
          <Button asChild variant="outline" size="sm">
            <Link to={homeFor(session.role, session.stakeholderKind)}>{t('chrome.back')}</Link>
          </Button>
        }
      />
    </div>
  )
}
