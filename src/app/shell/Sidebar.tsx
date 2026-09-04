import { NavLink } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard, ClipboardList, Boxes, ShoppingCart,
  BarChart3, Plug, History,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/services'
import { PRODUCT } from '../product'
import { BrandMark } from '@/components/brand/BrandMark'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  badge?: number
  /** Rendered in amber rather than neutral when the number means "you are the
   *  blocker", not merely "there are things here". */
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-')

interface NavGroup {
  title: string
  items: NavItem[]
}

export function Sidebar() {
  /* One query drives every badge, so the rail can never disagree with the page
   * the reviewer lands on. §8.6 makes these counts fixture invariants —
   * they are read, never recomputed here. */
  const { data } = useQuery({
    queryKey: ['command-center'],
    queryFn: () => api.dashboard.summary(),
  })

  /* Grouped by the question each section answers: how are we doing · what needs
   * a decision · what does the wider picture say · what is the system working
   * from and what did we decide.
   *
   * Every label is at most three words, spelled out, with no connector symbols
   * and nothing that truncates — fast-demo Layout law 1. That is why the nav
   * item reads `Integrations` while the page heading reads `Data & Integrations`
   * (§9.1). The heading has room for the ampersand; a 15-character rail
   * does not. */
  const groups: NavGroup[] = [
    {
      title: 'Overview',
      items: [{ to: '/command-center', label: 'Command Center', icon: LayoutDashboard }],
    },
    {
      title: 'Decisions',
      items: [
        { to: '/orders', label: 'Order Impact', icon: ClipboardList, badge: data?.ordersAtRisk },
        { to: '/inventory', label: 'Inventory Intelligence', icon: Boxes, badge: data?.skusRequiringAction },
        { to: '/replenishment', label: 'Replenishment', icon: ShoppingCart, badge: data?.approvalsWaiting },
      ],
    },
    {
      title: 'Analysis',
      items: [{ to: '/analytics', label: 'Analytics', icon: BarChart3 }],
    },
    {
      title: 'System',
      items: [
        { to: '/integrations', label: 'Integrations', icon: Plug },
        { to: '/audit', label: 'Audit Log', icon: History },
      ],
    },
  ]

  return (
    <nav
      aria-label="Main"
      className="bg-rail border-rail-border flex w-60 shrink-0 flex-col border-r"
    >
      <div className="border-rail-border flex h-14 items-center gap-2.5 border-b px-4">
        <BrandMark className="size-7" />
        <span className="text-rail-active text-base font-semibold tracking-tight">ABC</span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        {groups.map((group) => (
          <div key={group.title} className="mb-4 last:mb-0">
            {/* A div, not a heading: the rail sits before the page's own h1 in
                the DOM, so headings here would put an h2 above it. The list
                still gets the name via aria-labelledby. */}
            <div
              id={`nav-${slug(group.title)}`}
              className="text-rail-muted px-2.5 pb-1.5 eyebrow"
            >
              {group.title}
            </div>
            <ul aria-labelledby={`nav-${slug(group.title)}`} className="flex flex-col gap-0.5">
              {group.items.map(({ to, label, icon: Icon, badge }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    data-tour={`nav-${to.replace(/^\//, '')}`}
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
                          <span
                            aria-hidden
                            className="bg-rail-accent absolute top-1.5 bottom-1.5 -left-2 w-0.5 rounded-r-xs"
                          />
                        )}
                        <Icon className="size-4 shrink-0" aria-hidden />
                        <span className="truncate">{label}</span>
                        {badge ? (
                          <span
                            /* One pair, every state. Dark on amber, not white
                               on amber: white gives 3.2:1 at 11px, which fails;
                               this measures 5.35:1 and — because the amber is
                               opaque — it measures that on the dark rail, on
                               the light active chip and on hover alike. The
                               grey variant this replaces inherited its colours
                               from whatever was behind it, and when the rail
                               went from navy to near-black it turned into dark
                               text on a dark chip: a count nobody could read. */
                            className={cn(
                              'tabular bg-sev-high text-rail ml-auto rounded-full px-1.5 py-0.5 text-2xs font-medium',
                            )}
                          >
                            {badge}
                          </span>
                        ) : null}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-rail-border border-t px-3 py-3">
        <div className="text-rail-muted eyebrow">Product family in scope</div>
        <div className="text-rail-foreground mt-0.5 text-xs leading-snug">
          ABC-600 Series · 12 configurations
        </div>
        <div className="text-rail-muted mt-1.5 text-2xs leading-snug">{PRODUCT.chip}</div>
      </div>
    </nav>
  )
}
