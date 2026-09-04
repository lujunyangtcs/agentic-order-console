import { NavLink, Outlet, useLocation } from 'react-router'
import { useAuth } from '../auth'
import { mobileTabsFor } from '../nav'
import { BrandMark } from '@/components/brand/BrandMark'
import { LangToggle } from './LangToggle'
import { roleNameKey, useT } from '@/i18n'
import { cn } from '@/lib/utils'

/**
 * The phone chrome: the same routes, rendered at 390px inside the preview
 * frame. A compact top strip and a four-tab bar; no rail, no ticker, no
 * developer panel. Everything between them is the exact component the
 * desktop renders — that is the whole point of the preview.
 */
export function MobileShell() {
  const { session } = useAuth()
  const { pathname } = useLocation()
  const t = useT()
  if (!session) return null
  const tabs = mobileTabsFor(session.role)

  return (
    <div className="bg-background flex min-h-full flex-col">
      <header className="border-border bg-surface sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <BrandMark className="text-primary size-6" />
        <span className="text-foreground truncate text-sm font-semibold">{t('app.short')}</span>
        <span className="border-border text-muted-foreground ml-auto truncate rounded-xs border px-1.5 py-0.5 text-2xs">
          {t(roleNameKey(session.role))}
        </span>
        <LangToggle compact />
      </header>

      <main className="relative flex-1 pb-16">
        <div key={pathname} className="page-enter">
          <Outlet />
        </div>
      </main>

      <nav
        aria-label="Main"
        className="border-border bg-surface fixed inset-x-0 bottom-0 z-20 flex h-14 items-stretch border-t"
      >
        {tabs.map(({ to, labelKey, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/reports'}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center justify-center gap-0.5 text-2xs',
                isActive ? 'text-accent-text font-medium' : 'text-muted-foreground',
              )
            }
          >
            <Icon className="size-4" aria-hidden />
            <span className="truncate px-1">{t(labelKey)}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
