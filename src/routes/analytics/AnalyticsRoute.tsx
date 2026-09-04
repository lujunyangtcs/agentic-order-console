import { useMemo } from 'react'
import { NavLink, useLocation, useNavigate, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, Cell, LineChart, Line, ScatterChart, Scatter, ZAxis, ReferenceLine,
} from 'recharts'
import { X } from 'lucide-react'
import { api } from '@/services'
import type {
  AnalyticsFilters, KpiValue, DrillRow,
  InventoryHealthReport, SafetyStockReport, ProcurementReport, VariantReport,
} from '@/services'
import { DataTable, type ColumnDef } from '@/components/table/DataTable'
import { cn } from '@/lib/utils'

/**
 * Four reports over one dataset.
 *
 * Two rules make this an analytics *product* rather than four charts.
 *
 * **The slicers live in the URL.** FR-023 requires report state to survive a
 * drill-through and a Back, and the only way to get that for free is to keep it
 * where the browser already keeps history. Clicking a visual cross-filters the
 * others through the same mechanism.
 *
 * **The numbers come from the operational records.** Nothing here is a second
 * dataset. A management view whose totals disagree with the queue underneath is
 * worse than no management view.
 */

const REPORTS = [
  { path: 'inventory-health', label: 'Inventory Health' },
  { path: 'safety-stock', label: 'Safety Stock' },
  { path: 'procurement', label: 'Procurement' },
  { path: 'variant-exposure', label: 'Variant Exposure' },
] as const

type AnyReport = InventoryHealthReport | SafetyStockReport | ProcurementReport | VariantReport

const STATUS_COLOUR: Record<string, string> = {
  Healthy: 'var(--verdict-pass)',
  Excess: 'var(--verdict-ambiguous)',
  Watch: 'var(--sev-high)',
  'Action required': 'var(--sev-critical)',
  Blocked: 'var(--muted-foreground)',
}

export function AnalyticsRoute() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const which = REPORTS.find((r) => pathname.endsWith(r.path)) ?? REPORTS[0]

  const filters: AnalyticsFilters = useMemo(() => ({
    site: params.get('site'),
    criticality: params.get('criticality'),
    supplier: params.get('supplier'),
    status: params.get('status'),
    configuration: params.get('configuration'),
  }), [params])

  const options = useQuery({ queryKey: ['analytics-options'], queryFn: () => api.analytics.options() })
  /* One query for four report shapes. Annotated because the four return types
   * are structurally different and inference collapses to the first. */
  const report = useQuery<AnyReport>({
    queryKey: ['report', which.path, filters],
    queryFn: (): Promise<AnyReport> => {
      if (which.path === 'safety-stock') return api.analytics.safetyStock(filters)
      if (which.path === 'procurement') return api.analytics.procurement(filters)
      if (which.path === 'variant-exposure') return api.analytics.variantExposure(filters)
      return api.analytics.inventoryHealth(filters)
    },
  })

  function setFilter(key: keyof AnalyticsFilters, v: string | null) {
    const next = new URLSearchParams(params)
    if (v === null || next.get(key) === v) next.delete(key)
    else next.set(key, v)
    setParams(next)
  }

  const active = Object.entries(filters).filter(([, v]) => v) as [string, string][]
  const r = report.data

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-6 py-6">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="font-display text-xl font-semibold">{r?.title ?? which.label}</h1>
          <span className="text-muted-foreground text-xs">Data as of today</span>
        </div>

        <nav aria-label="Reports" className="border-border flex flex-wrap gap-1 border-b">
          {REPORTS.map((rep) => (
            <NavLink
              key={rep.path}
              to={{ pathname: `/analytics/${rep.path}`, search: params.toString() }}
              className={({ isActive }) => cn(
                'focus-visible:ring-ring -mb-px border-b-2 px-3 py-2 text-xs font-medium',
                'focus-visible:ring-2 focus-visible:outline-none',
                isActive
                  ? 'border-accent text-foreground'
                  : 'text-muted-foreground hover:text-foreground border-transparent',
              )}
            >
              {rep.label}
            </NavLink>
          ))}
        </nav>
      </header>

      {/* Slicers. The report tabs carry the search string, so switching report
          keeps the selection — a slicer that resets on every tab is a slicer
          nobody uses twice. */}
      <div className="flex flex-wrap items-center gap-2">
        <Slicer label="Site" value={filters.site} options={options.data?.sites ?? []} onChange={(v) => setFilter('site', v)} />
        <Slicer label="Criticality" value={filters.criticality} options={options.data?.criticalities ?? []} onChange={(v) => setFilter('criticality', v)} />
        <Slicer label="Supplier" value={filters.supplier} options={options.data?.suppliers ?? []} onChange={(v) => setFilter('supplier', v)} />

        {active.length > 0 && (
          <>
            <span className="text-muted-foreground ml-2 text-2xs">Filtered by</span>
            {active.map(([k, v]) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k as keyof AnalyticsFilters, null)}
                className="border-tenant-accent/30 bg-tenant-accent-tint text-tenant-accent-text focus-visible:ring-ring flex items-center gap-1 rounded-xs border px-2 py-0.5 text-2xs font-medium focus-visible:ring-2 focus-visible:outline-none"
              >
                {v}
                <X className="size-3" aria-hidden />
              </button>
            ))}
            <button
              type="button"
              onClick={() => setParams(new URLSearchParams())}
              className="text-accent-text hover:text-accent focus-visible:ring-ring rounded-xs text-2xs font-medium focus-visible:ring-2 focus-visible:outline-none"
            >
              Reset
            </button>
          </>
        )}
      </div>

      {r && (
        <>
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
            {r.kpis.map((k) => <Kpi key={k.key} kpi={k} />)}
          </div>

          {/* One readable sentence per report. §15.6 asks for it, and it is also
              what a reader takes away when the charts are behind them. */}
          <p data-card="summary" className="ai-surface rounded-xs px-5 py-3.5 text-sm leading-relaxed">
            {r.summary}
          </p>

          {which.path === 'inventory-health' && <InventoryHealthVisuals r={r as InventoryHealthReport} onSelect={setFilter} active={filters} />}
          {which.path === 'safety-stock' && <SafetyStockVisuals r={r as SafetyStockReport} />}
          {which.path === 'procurement' && <ProcurementVisuals r={r as ProcurementReport} onSelect={setFilter} active={filters} />}
          {which.path === 'variant-exposure' && <VariantVisuals r={r as VariantReport} onSelect={setFilter} active={filters} />}

          <DrillTable columns={r.detail.columns} rows={r.detail.rows} onOpen={(href) => navigate(href)} />
        </>
      )}
    </div>
  )
}

/* ── Chrome ──────────────────────────────────────────────────────────────── */

function Slicer({
  label, value, options, onChange,
}: { label: string; value: string | null; options: string[]; onChange: (v: string | null) => void }) {
  const id = `slicer-${label.toLowerCase()}`
  return (
    <span className="flex items-center gap-1.5">
      <label htmlFor={id} className="text-muted-foreground text-2xs">{label}</label>
      <select
        id={id}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="border-structural-border bg-surface focus-visible:ring-ring h-7 rounded-md border px-2 text-xs focus-visible:ring-2 focus-visible:outline-none"
      >
        <option value="">All</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </span>
  )
}

function Kpi({ kpi }: { kpi: KpiValue }) {
  return (
    <article data-card={`kpi-${kpi.key}`} className="border-structural-border bg-surface flex flex-col gap-1 rounded-lg border p-4">
      <p className="text-muted-foreground eyebrow">{kpi.label}</p>
      <p className={cn('font-display tabular text-xl font-semibold',
        kpi.tone === 'warning' && 'text-sev-high-on-bg',
        kpi.tone === 'good' && 'text-verdict-pass')}>
        {kpi.value}
      </p>
      {/* The denominator. A rate without one cannot be checked. */}
      <p className="text-muted-foreground text-2xs leading-snug">{kpi.footnote}</p>
    </article>
  )
}

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section data-card={`panel-${title.toLowerCase().replace(/\W+/g, '-')}`} className="border-structural-border bg-surface flex flex-col rounded-lg border">
      <header className="border-border border-b px-5 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {note && <p className="text-muted-foreground mt-0.5 text-2xs">{note}</p>}
      </header>
      <div className="h-56 px-3 py-3">{children}</div>
    </section>
  )
}

const TIP = {
  contentStyle: {
    background: 'var(--surface)', border: '1px solid var(--structural-border)',
    borderRadius: 2, fontSize: 12,
  },
} as const

const AXIS = { fontSize: 10, fill: 'var(--muted-foreground)' } as const

/* ── Report A ────────────────────────────────────────────────────────────── */

function InventoryHealthVisuals({ r, onSelect, active }: {
  r: InventoryHealthReport
  onSelect: (k: keyof AnalyticsFilters, v: string | null) => void
  active: AnalyticsFilters
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Status by family" note="All five statuses. Click a segment to cross-filter.">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={r.statusByFamily} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} />
            <Tooltip {...TIP} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            {r.statusSeries.map((sName) => (
              <Bar
                key={sName} dataKey={sName} stackId="s"
                fill={STATUS_COLOUR[sName]}
                opacity={active.status && active.status !== sName ? 0.3 : 1}
                onClick={() => onSelect('status', sName)}
                cursor="pointer" isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Value over 90 days" note="Total and usable, in thousands.">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={r.valueOverTime} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: 'var(--border)' }} interval={3} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} />
            <Tooltip {...TIP} formatter={(v: number, n: string) => [`$${v}k`, n === 'a' ? 'Total' : 'Usable']} />
            <Line dataKey="a" stroke="var(--foreground)" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line dataKey="b" stroke="var(--accent)" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Largest gaps to target" note="Value of the shortfall on positions breaching policy.">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={r.topExposure} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 96 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" horizontal={false} />
            <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="label" tick={{ ...AXIS, fontSize: 9 }} tickLine={false} axisLine={false} width={94} />
            <Tooltip {...TIP} formatter={(v: number) => [`$${v.toLocaleString()}`, 'Shortfall value']} />
            <Bar dataKey="value" fill="var(--sev-critical)" isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      {/* The fourth question.
          Composition, money over time and money by part are all "how much".
          This is "how soon" — and the ramp does the arguing: the leftmost band
          is stock that runs out inside a week, and its height is the size of
          the problem the other three panels cannot show. */}
      <Panel
        title="Cover to zero"
        /* "Cover remaining" invited the wrong comparison. The KPI above counts
           139 positions breaching *policy* within a week; this counts positions
           reaching *zero*. A part can cross its safety floor in three days and
           still not run out for forty, so the two numbers differ by design —
           and on one screen they read as a contradiction unless the panel says
           which line it is measuring to. */
        note={
          'Positions by days until stock reaches zero at the observed draw — not until policy is breached.' +
          (r.coverExcluded > 0
            ? ` ${r.coverExcluded.toLocaleString()} positions with no draw are excluded.`
            : '')
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={r.coverRunway} margin={{ top: 4, right: 8, bottom: 14, left: -18 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: 'var(--border)' }}
              label={{ value: 'days of cover', position: 'insideBottom', offset: -2, ...AXIS }}
            />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip {...TIP} formatter={(v: number) => [`${v.toLocaleString()} positions`, 'Cover']} />
            <Bar dataKey="value" isAnimationActive={false}>
              {r.coverRunway.map((b) => (
                <Cell key={b.key} fill={COVER_COLOUR[b.key] ?? 'var(--verdict-pass)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  )
}

/* Severity ramp across the bands, so the shape is readable before the axis is.
 * The first two bands are the ones that cost builds. */
const COVER_COLOUR: Record<string, string> = {
  '0-7': 'var(--sev-critical)',
  '8-14': 'var(--sev-high)',
  '15-30': 'var(--sev-medium)',
  '31-60': 'var(--verdict-pass)',
  '60+': 'var(--verdict-ambiguous)',
}

/* ── Report B ────────────────────────────────────────────────────────────── */

function SafetyStockVisuals({ r }: { r: SafetyStockReport }) {
  const navigate = useNavigate()
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Target on file against recommended" note="Above the line means the target is too low. Size is inventory value.">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 4, right: 12, bottom: 4, left: -18 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" />
            <XAxis type="number" dataKey="x" name="On file" tick={AXIS} tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
            <YAxis type="number" dataKey="y" name="Recommended" tick={AXIS} tickLine={false} axisLine={false} />
            <ZAxis type="number" dataKey="z" range={[12, 130]} />
            <Tooltip {...TIP} cursor={{ strokeDasharray: '3 3' }}
              formatter={(v: number, n: string) => [v, n]} />
            {/* Parity. Everything above it is under-targeted. */}
            <ReferenceLine
              segment={[{ x: 0, y: 0 }, { x: 60, y: 60 }]}
              stroke="var(--muted-foreground)" strokeDasharray="4 4"
            />
            {/* §20's analytics beat drills from this chart to a SKU, and until
                this was the one visual on the four reports with nothing
                wired to it — the scatter a viewer is most likely to click,
                because each point is a part they can name. */}
            <Scatter
              data={r.currentVsRecommended}
              fill="var(--accent)"
              fillOpacity={0.5}
              isAnimationActive={false}
              /* `cursor` on <Scatter> does not reach the rendered symbols the
                 way it does on <Bar>, so the class carries it instead — a
                 clickable point that shows an arrow cursor is a click nobody
                 discovers. */
              className="[&_.recharts-symbols]:cursor-pointer"
              onClick={(e: { href?: string }) => e.href && navigate(e.href)}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Why targets are moving" note="Counted from the recommendation drivers.">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={r.driftReasons} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 110 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" horizontal={false} />
            <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="label" tick={{ ...AXIS, fontSize: 9 }} tickLine={false} axisLine={false} width={108} />
            <Tooltip {...TIP} />
            <Bar dataKey="value" fill="var(--tenant-accent)" isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  )
}

/* ── Report C ────────────────────────────────────────────────────────────── */

function ProcurementVisuals({ r, onSelect, active }: {
  r: ProcurementReport
  onSelect: (k: keyof AnalyticsFilters, v: string | null) => void
  active: AnalyticsFilters
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Panel title="Proposed spend by supplier" note="Click a bar to cross-filter.">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={r.spendBySupplier} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="label" tick={{ ...AXIS, fontSize: 8 }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} interval={0} angle={-20} textAnchor="end" height={44} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} />
            <Tooltip {...TIP} formatter={(v: number) => [`$${v.toLocaleString()}`, 'Proposed']} />
            <Bar dataKey="value" cursor="pointer" onClick={(e: { label?: string }) => onSelect('supplier', e.label ?? null)} isAnimationActive={false}>
              {r.spendBySupplier.map((x) => (
                <Cell key={x.key} fill="var(--accent)" opacity={active.supplier && active.supplier !== x.label ? 0.3 : 1} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Lead-time variance" note="Mean days between promised and actual, trailing 90 days.">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={r.leadTimeVariance} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 96 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" horizontal={false} />
            <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="label" tick={{ ...AXIS, fontSize: 9 }} tickLine={false} axisLine={false} width={94} />
            <Tooltip {...TIP} formatter={(v: number) => [`${v > 0 ? '+' : ''}${v} days`, 'Variance']} />
            <ReferenceLine x={0} stroke="var(--border)" />
            <Bar dataKey="value" isAnimationActive={false}>
              {r.leadTimeVariance.map((x) => (
                <Cell key={x.key} fill={x.value > 0 ? 'var(--sev-high)' : 'var(--verdict-pass)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Requisition funnel" note="Only the stages that exist. No decorative volume.">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={r.requisitionFunnel} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 120 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" horizontal={false} />
            <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey="label" tick={{ ...AXIS, fontSize: 9 }} tickLine={false} axisLine={false} width={118} />
            <Tooltip {...TIP} />
            <Bar dataKey="value" fill="var(--tenant-accent)" isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  )
}

/* ── Report D ────────────────────────────────────────────────────────────── */

function VariantVisuals({ r, onSelect, active }: {
  r: VariantReport
  onSelect: (k: keyof AnalyticsFilters, v: string | null) => void
  active: AnalyticsFilters
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {/* The chart that either proves variant complexity or exposes that the
            dataset has none. At 95% overlap every bar sits at twelve and it
            says nothing; shape here is the shared/specific split doing its job. */}
        <Panel title="Components by configuration count" note="How many parts appear in how many configurations.">
          <ResponsiveContainer width="100%" height="100%">
            {/* bottom margin leaves room for the axis label; at 0 it was clipped
                by the panel edge. */}
            <BarChart data={r.exposureHistogram} margin={{ top: 4, right: 8, bottom: 14, left: -12 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: 'var(--border)' }}
                label={{ value: 'configurations', position: 'insideBottom', offset: -2, ...AXIS }} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false}
                label={{ value: 'components', angle: -90, position: 'insideLeft', ...AXIS }} />
              <Tooltip {...TIP} formatter={(v: number, _n, p) => [`${v} components`, `in ${p.payload.label} configurations`]} />
              <Bar dataKey="value" fill="var(--tenant-accent)" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Forward demand on shared parts" note="The six largest, summed across configurations with live orders.">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={r.sharedDemand} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 118 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" horizontal={false} />
              <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
              {/* interval={0} — recharts drops ticks it thinks will not fit, and
                  an unlabelled bar on this chart is a bar that says nothing. */}
              <YAxis type="category" dataKey="label" interval={0} tick={{ ...AXIS, fontSize: 9 }} tickLine={false} axisLine={false} width={116} />
              <Tooltip {...TIP} />
              <Bar dataKey="value" fill="var(--accent)" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* All twelve, filter or not. Completeness is this table's whole job. */}
      <section data-card="config-matrix" className="border-structural-border bg-surface rounded-lg border">
        <header className="border-border border-b px-5 py-3">
          <h2 className="text-sm font-semibold">Configuration matrix</h2>
          <p className="text-muted-foreground mt-0.5 text-2xs">
            Every published configuration, including the one that cannot be ordered.
          </p>
        </header>
        <div data-x-scroll="config-matrix" className="overflow-x-auto overscroll-x-contain">
          <table className="w-full text-sm" style={{ minWidth: 560 }}>
            <thead>
              <tr className="border-border text-muted-foreground border-b text-2xs uppercase">
                <th scope="col" className="px-5 py-2 text-left font-medium">Configuration</th>
                <th scope="col" className="px-3 py-2 text-left font-medium">Finished part</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Components</th>
                <th scope="col" className="px-5 py-2 text-right font-medium">Live orders</th>
              </tr>
            </thead>
            <tbody>
              {r.configurationMatrix.map((c) => (
                <tr
                  key={c.configuration}
                  onClick={() => c.finishedPart && onSelect('configuration', c.configuration)}
                  className={cn(
                    'border-border border-b last:border-b-0',
                    c.finishedPart && 'hover:bg-hover-tint cursor-pointer',
                    active.configuration === c.configuration && 'bg-tenant-accent-tint',
                    !c.finishedPart && 'text-muted-foreground',
                  )}
                >
                  <td className="px-5 py-1.5">{c.configuration}</td>
                  <td className="px-3 py-1.5 font-mono text-xs">
                    {c.finishedPart ?? <span className="italic">not orderable</span>}
                  </td>
                  <td className="tabular px-3 py-1.5 text-right">{c.components || '—'}</td>
                  <td className="tabular px-5 py-1.5 text-right font-medium">{c.liveOrders || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

/* ── Drill-through ───────────────────────────────────────────────────────── */

function DrillTable({
  columns, rows, onOpen,
}: { columns: string[]; rows: DrillRow[]; onOpen: (href: string) => void }) {
  const cols: ColumnDef<DrillRow>[] = useMemo(() => [
    {
      key: 'primary', header: columns[0], width: '240px', pinned: 'left',
      sortValue: (r) => r.primary,
      render: (r) => (
        <span className="flex flex-col">
          <span className="font-mono text-xs font-medium">{r.primary}</span>
          <span className="text-muted-foreground truncate text-2xs">{r.secondary}</span>
        </span>
      ),
    },
    ...columns.slice(1).map((h, i) => ({
      key: `v${i}`, header: h, width: '150px',
      numeric: typeof rows[0]?.values[i] === 'number',
      sortValue: (r: DrillRow) => r.values[i] as string | number,
      render: (r: DrillRow) => <span className="text-xs">{r.values[i]}</span>,
    })),
  ], [columns, rows])

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Detail</h2>
        <span className="text-muted-foreground text-xs">
          {rows.length} rows · click through to the record
        </span>
      </div>
      <DataTable
        name="drill"
        rows={rows}
        columns={cols}
        rowKey={(r) => r.key}
        maxHeight={420}
        empty="Nothing in this selection."
        onRowClick={(r) => onOpen(r.href)}
      />
    </section>
  )
}
