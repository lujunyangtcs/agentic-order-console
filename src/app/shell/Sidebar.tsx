import { NavLink } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { api } from '@/services'
import { useAuth } from '../auth'
import { navFor, type NavGroup, type NavItem } from '../nav'
import { useT } from '@/i18n'
import { BrandMark } from '@/components/brand/BrandMark'
import { TENANT } from '../product'

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-')

/**
 * One query drives every badge, so the rail can never disagree with the page
 * the reviewer lands on. Counts are read from the summary, never recomputed.
 */
function useBadges(role: string, scope: string) {
  const summary = useQuery({ queryKey: ['summary'], queryFn: () => api.orders.summary() })
  const unread = useQuery({
    queryKey: ['unread', role, scope],
    queryFn: () => api.notifications.unreadCount(role as never, scope),
  })
  const inbox = useQuery({
    queryKey: ['inbox', scope],
    queryFn: () => api.carrier.inbox(scope),
    enabled: role === 'Carrier',
  })
  return (item: NavItem): number | undefined => {
    switch (item.badge) {
      case 'newRequests': return summary.data?.newRequests || undefined
      case 'pendingCarrier': return summary.data?.pendingCarrier || undefined
      case 'needsAttention': return summary.data?.needsAttention || undefined
      case 'unread': return unread.data || undefined
      case 'inboxWaiting': return inbox.data?.filter((r) => r.state === 'sent').length || undefined
      default: return undefined
    }
  }
}

/** The grouped list itself, shared by the desktop rail and the phone drawer. */
export function NavList({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const t = useT()
  const { session } = useAuth()
  const scope = session?.role === 'Carrier' ? session.carrierId : session?.role === 'Customer' ? session.customerId : ''
  const badgeFor = useBadges(session?.role ?? '', scope)

  return (
    <div className="flex-1 overflow-y-auto px-2 py-3">
      {groups.map((group) => (
        <div key={group.titleKey} className="mb-4 last:mb-0">
          <div id={`nav-${slug(group.titleKey)}`} className="text-rail-muted px-2.5 pb-1.5 eyebrow">
            {t(group.titleKey)}
          </div>
          <ul aria-labelledby={`nav-${slug(group.titleKey)}`} className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const { to, labelKey, icon: Icon } = item
              const badge = badgeFor(item)
              return (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={to === '/reports'}
                    onClick={onNavigate}
                    data-tour={`nav-${to.replace(/^\//, '').replace(/\//g, '-')}`}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex items-center gap-2.5 rounded-md py-2 pr-2 pl-2.5 text-sm',
                        'transition-colors duration-150 ease-out',
                        'focus-visible:ring-rail-accent focus-visible:ring-2 focus-visible:outline-none',
                        isActive
                          ? 'bg-rail-selected text-rail font-medium shadow-sm'
                          : 'text-rail-foreground hover:bg-rail-hover hover:text-rail',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span aria-hidden className="bg-rail-accent absolute top-1.5 bottom-1.5 -left-2 w-0.5 rounded-r-xs" />
                        )}
                        <Icon className="size-4 shrink-0" aria-hidden />
                        <span className="truncate">{t(labelKey)}</span>
                        {badge ? (
                          <span className="tabular bg-sev-high text-rail ml-auto rounded-full px-1.5 py-0.5 text-2xs font-medium">
                            {badge}
                          </span>
                        ) : null}
                      </>
                    )}
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

export function Sidebar({ className }: { className?: string }) {
  const { session } = useAuth()
  const t = useT()
  if (!session) return null

  return (
    <nav
      aria-label="Main"
      className={cn('bg-rail border-rail-border w-60 shrink-0 flex-col border-r', className)}
    >
      <div className="border-rail-border flex h-14 items-center gap-2.5 border-b px-4">
        <BrandMark className="text-rail-active size-7" />
        <span className="text-rail-active truncate text-sm font-semibold tracking-tight">{t('app.short')}</span>
      </div>

      <NavList groups={navFor(session.role)} />

      <div className="border-rail-border border-t px-3 py-3">
        <div className="text-rail-muted eyebrow">{session.tenantName}</div>
        <div className="text-rail-foreground mt-0.5 text-xs leading-snug">{t('app.name')}</div>
        <div className="text-rail-muted mt-1.5 text-2xs leading-snug">{TENANT.dataNotice}</div>
      </div>
    </nav>
  )
}
