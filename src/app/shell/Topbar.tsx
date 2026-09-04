import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bell, Check, Compass, LogOut, Menu, Search, User } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { ALL_ROLES } from '../permissions'
import { PRODUCT } from '../product'
import { useAuth } from '../auth'
import { useTour } from '../tour/TourProvider'
import { homeFor, navFor } from '../nav'
import { NavList } from './Sidebar'
import { LangToggle } from './LangToggle'
import { api } from '@/services'
import { formatDateTime } from '@/fixtures/calendar'
import { kindKey, roleNameKey, rolePurposeKey, useLang } from '@/i18n'
import { STAKEHOLDER_KINDS, type Role } from '@/types/domain'
import { cn } from '@/lib/utils'

/** The carriers the presenter can act for: the two in the walk, one without a system. */
const ACTING_CARRIERS = ['CAR-A', 'CAR-D', 'CAR-E', 'CAR-B', 'CAR-H']

export function Topbar() {
  const { session, signOut, setRole, setStakeholderKind, setCarrier } = useAuth()
  const { start: startTour } = useTour()
  const { t, lang } = useLang()
  const navigate = useNavigate()
  const { data } = useQuery({ queryKey: ['summary'], queryFn: () => api.orders.summary() })
  const carriers = useQuery({ queryKey: ['carriers'], queryFn: () => api.carrier.carriers() })
  const scope = session?.role === 'Carrier' ? session.carrierId : session?.role === 'Customer' ? session.customerId : ''
  const unread = useQuery({
    queryKey: ['unread', session?.role, scope],
    queryFn: () => api.notifications.unreadCount(session!.role, scope),
    enabled: !!session,
  })
  const [q, setQ] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        input.current?.focus()
        input.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!session) return null

  const searchTarget = session.role === 'CVC User' || session.role === 'Administrator' ? '/worklist' : '/history'

  function chooseRole(role: Role) {
    setRole(role)
    navigate(homeFor(role, session!.stakeholderKind))
  }

  return (
    <header className="border-border bg-surface flex h-14 shrink-0 items-center gap-3 border-b px-3 md:px-4">
      {/* Phone and tablet: the rail lives in a drawer. */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t('chrome.menu')}>
            <Menu className="size-5" aria-hidden />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="bg-rail text-rail-foreground w-72 p-0 sm:max-w-72">
          <SheetTitle className="sr-only">{t('chrome.menu')}</SheetTitle>
          <div className="border-rail-border text-rail-active flex h-14 items-center border-b px-4 text-sm font-semibold">
            {t('app.short')}
          </div>
          <NavList groups={navFor(session.role)} onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
        <span className="text-foreground hidden text-sm font-medium md:inline">{session.tenantName}</span>
        <span className="border-accent/30 bg-muted text-accent-text hidden rounded-xs border px-2 py-0.5 text-2xs font-medium lg:inline">
          {PRODUCT.chip}
        </span>
        <span className="text-muted-foreground hidden text-2xs 2xl:inline">{t('app.dataNotice')}</span>
      </div>

      <form
        className="mx-auto hidden w-full max-w-md md:block"
        onSubmit={(e) => {
          e.preventDefault()
          navigate(q.trim() ? `${searchTarget}?q=${encodeURIComponent(q.trim())}` : searchTarget)
        }}
      >
        <label htmlFor="global-search" className="sr-only">{t('chrome.searchHint')}</label>
        <div className="border-border bg-background focus-within:border-accent/50 focus-within:ring-ring/30 flex h-8 items-center gap-2 rounded-md border px-2.5 transition-colors duration-150 focus-within:ring-[3px]">
          <Search className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
          <input
            id="global-search"
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('chrome.search')}
            className="text-foreground placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-xs outline-none"
          />
          <kbd className="border-border text-muted-foreground hidden shrink-0 rounded-xs border px-1 py-0.5 font-mono text-2xs sm:inline">⌘K</kbd>
        </div>
      </form>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <span className="text-muted-foreground hidden text-2xs tabular xl:inline">
          {t('chrome.dataAsOf')} {data ? formatDateTime(data.dataAsOf, lang) : '—'}
        </span>

        <LangToggle />

        <Button asChild variant="ghost" size="icon" className="relative" aria-label={t('chrome.notifications')}>
          <Link to="/notifications" data-bell>
            <Bell className="size-4" aria-hidden />
            {unread.data ? (
              <span className="bg-sev-critical text-primary-foreground absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-2xs font-medium tabular">
                {unread.data}
              </span>
            ) : null}
          </Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="shrink-0 gap-2" data-role-menu>
              <User className="size-4" aria-hidden />
              <span className="hidden text-sm 2xl:inline">{session.name}</span>
              <span className="border-border text-muted-foreground rounded-xs border px-1.5 py-0.5 text-2xs font-medium whitespace-nowrap">
                {t(roleNameKey(session.role))}
                {session.role === 'Other Stakeholder' ? ` · ${t(kindKey(session.stakeholderKind))}` : ''}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="font-normal">
              <div className="text-sm font-medium">{session.name}</div>
              <div className="text-muted-foreground text-xs">{session.email}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-muted-foreground text-2xs font-normal">{t('chrome.actingAs')}</DropdownMenuLabel>
            {ALL_ROLES.map((r) => (
              <DropdownMenuItem key={r} onSelect={() => chooseRole(r)} data-role-option={r} className="gap-2">
                <Check className={cn('size-3.5', r !== session.role && 'opacity-0')} aria-hidden />
                <span className="flex min-w-0 flex-col">
                  <span className="text-xs">{t(roleNameKey(r))}</span>
                  <span className="text-muted-foreground text-2xs">{t(rolePurposeKey(r))}</span>
                </span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-muted-foreground text-2xs font-normal">
              {t(roleNameKey('Other Stakeholder'))}
            </DropdownMenuLabel>
            {STAKEHOLDER_KINDS.map((k) => (
              <DropdownMenuItem
                key={k}
                data-kind-option={k}
                onSelect={() => {
                  setStakeholderKind(k)
                  navigate(homeFor('Other Stakeholder', k))
                }}
                className="gap-2"
              >
                <Check
                  className={cn('size-3.5', !(session.role === 'Other Stakeholder' && session.stakeholderKind === k) && 'opacity-0')}
                  aria-hidden
                />
                <span className="text-xs">{t(kindKey(k))}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-muted-foreground text-2xs font-normal">
              {t('chrome.actingFor')} · {t(roleNameKey('Carrier'))}
            </DropdownMenuLabel>
            {(carriers.data ?? []).filter((c) => ACTING_CARRIERS.includes(c.id)).map((c) => (
              <DropdownMenuItem
                key={c.id}
                data-carrier-option={c.id}
                onSelect={() => {
                  setCarrier(c.id, !c.hasTms)
                  navigate('/carrier/inbox')
                }}
                className="gap-2"
              >
                <Check className={cn('size-3.5', !(session.role === 'Carrier' && session.carrierId === c.id) && 'opacity-0')} aria-hidden />
                <span className="flex min-w-0 flex-col">
                  <span className="text-xs">{c.name}</span>
                  <span className="text-muted-foreground text-2xs">{c.hasTms ? t('assign.tms') : t('chrome.portalMode')}</span>
                </span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => startTour()}>
              <Compass className="size-4" aria-hidden />
              {t('chrome.tour')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                signOut()
                navigate('/login')
              }}
            >
              <LogOut className="size-4" aria-hidden />
              {t('chrome.signOut')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
