import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, Compass, LogOut, Search, User } from 'lucide-react'
import { useNavigate } from 'react-router'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ALL_ROLES, ROLE_PURPOSE } from '../permissions'
import { Button } from '@/components/ui/button'
import { PRODUCT, TENANT, CONNECTOR_PROFILE } from '../product'
import { useAuth } from '../auth'
import { useTour } from '../tour/TourProvider'
import { api } from '@/services'
import { formatDateTime } from '@/fixtures/calendar'

export function Topbar() {
  const { session, signOut, setRole } = useAuth()
  const { start: startTour } = useTour()
  const navigate = useNavigate()
  /* Same query key as the rail and the Command Center. Three surfaces, one
   * fetch, and no way for the timestamp here to disagree with the figures
   * underneath it. */
  const { data } = useQuery({ queryKey: ['command-center'], queryFn: () => api.dashboard.summary() })
  const [q, setQ] = useState('')
  const input = useRef<HTMLInputElement>(null)

  /* The shortcut hint is only honest if the shortcut works. */
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

  return (
    <header className="border-border bg-surface flex h-14 shrink-0 items-center gap-4 border-b px-4">
      <div className="flex shrink-0 items-center gap-2">
        {/* Tenant first, product second. The planner is looking at their own
            data; whose software renders it is the smaller fact. */}
        <span className="text-foreground text-sm font-medium">{session.tenantName}</span>
        <span className="border-tenant-accent/30 bg-tenant-accent-tint text-tenant-accent-text hidden rounded-xs border px-2 py-0.5 text-2xs font-medium lg:inline">
          {PRODUCT.chip}
        </span>
        {/* §10.2 — the disclosure sits in the tenant area of every page, and it
            is restrained on purpose. A banner would read as a disclaimer; this
            reads as a fact about the account. */}
        <span className="text-muted-foreground hidden text-2xs xl:inline">{TENANT.dataNotice}</span>
      </div>

      <form
        className="mx-auto w-full max-w-md"
        onSubmit={(e) => {
          e.preventDefault()
          navigate(q.trim() ? `/inventory?q=${encodeURIComponent(q.trim())}` : '/inventory')
        }}
      >
        <label htmlFor="global-search" className="sr-only">
          Search parts, orders and suppliers
        </label>
        <div className="border-border bg-background focus-within:border-accent/50 focus-within:ring-ring/30 flex h-8 items-center gap-2 rounded-md border px-2.5 transition-colors duration-150 focus-within:ring-[3px]">
          <Search className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
          <input
            id="global-search"
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search parts, orders, suppliers"
            className="text-foreground placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-xs outline-none"
          />
          <kbd className="border-border text-muted-foreground hidden shrink-0 rounded-xs border px-1 py-0.5 font-mono text-2xs sm:inline">
            ⌘K
          </kbd>
        </div>
      </form>

      {/* Source health and freshness, before the user menu.
          §6.3 requires a data-as-of stamp on every data-dependent page, and
          §16.3 keeps connection state and freshness as separate facts — a
          connector can be reachable and still be serving something stale.
          The ERP name is read from the connector profile, never hardcoded
          (FR-038): which system it is remains an open assumption. */}
      <div className="hidden shrink-0 items-center gap-3 md:flex">
        <span
          className="flex items-center gap-1.5 text-2xs"
          title={`${CONNECTOR_PROFILE.displayName}${CONNECTOR_PROFILE.confirmed ? '' : ' — example connector, confirm at discovery'}`}
        >
          <span className="bg-verdict-pass size-1.5 rounded-full" aria-hidden />
          <span className="text-muted-foreground">
            {CONNECTOR_PROFILE.shortName}
            {CONNECTOR_PROFILE.confirmed ? '' : ' (example)'}
          </span>
        </span>
        <span className="text-muted-foreground text-2xs tabular">
          Data as of {data ? formatDateTime(data.dataAsOf) : '—'}
        </span>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="shrink-0 gap-2">
            <User className="size-4" aria-hidden />
            {/* The name goes before the role does.
             *
             * At the 1280 functional minimum the header wanted 1101px in a
             * 1040px track and clipped the user menu off the right edge —
             * invisible to the page-overflow assertion, because the header
             * clips its own content and the body never scrolls.
             *
             * Of the two things this button shows, the role is the load-bearing
             * one: every permission refusal names it and the walk switches it.
             * The name is decorative here and still in the menu below. */}
            <span className="hidden text-sm 2xl:inline">{session.name}</span>
            {/* The acting role is on the bar, not buried in the menu. Every
                refusal names a role, and a user who cannot see which one they
                are has to open a menu to understand the refusal. */}
            <span className="border-border text-muted-foreground rounded-xs border px-1.5 py-0.5 text-2xs font-medium">
              {session.role}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="text-sm font-medium">{session.name}</div>
            <div className="text-muted-foreground text-xs">{session.email}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {/* §5.1's role list, switchable. The walk needs it (§20 step 5 signs
              off a substitute as Engineering Approver), and a permission model
              that cannot be crossed cannot be demonstrated. */}
          <DropdownMenuLabel className="text-muted-foreground text-2xs font-normal">
            Acting as
          </DropdownMenuLabel>
          {ALL_ROLES.map((r) => (
            <DropdownMenuItem
              key={r}
              onSelect={() => setRole(r)}
              data-role-option={r}
              className="gap-2"
            >
              <Check className={r === session.role ? 'size-3.5' : 'size-3.5 opacity-0'} aria-hidden />
              <span className="flex min-w-0 flex-col">
                <span className="text-xs">{r}</span>
                <span className="text-muted-foreground text-2xs">{ROLE_PURPOSE[r]}</span>
              </span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          {/* Always available, so declining the invitation is not permanent. */}
          <DropdownMenuItem onSelect={() => startTour()}>
            <Compass className="size-4" aria-hidden />
            Show me round
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              signOut()
              navigate('/login')
            }}
          >
            <LogOut className="size-4" aria-hidden />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
