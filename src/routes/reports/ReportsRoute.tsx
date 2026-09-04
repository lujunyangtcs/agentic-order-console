import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BookmarkPlus, ChartColumn, ChartLine, ChartNoAxesColumn, Table2, X } from 'lucide-react'
import { api } from '@/services'
import type { ReportSpec, WorklistRow } from '@/services'
import { PageHeader } from '@/components/shell/PageHeader'
import { DataTable, type ColumnDef } from '@/components/table/DataTable'
import { StatusChip } from '@/components/status/StatusChip'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { TIP, AXIS, GRID } from '@/components/charts/chart'
import { ORDER_STATUSES, statusIndex, type OrderStatus } from '@/types/domain'
import { formatDate, formatDateTime, formatTime } from '@/fixtures/calendar'
import { productKey, statusKey, useLang, type I18nKey } from '@/i18n'
import { cn } from '@/lib/utils'

type Dimension = ReportSpec['dimension']
type Measure = ReportSpec['measure']
type Chart = ReportSpec['chart']

const DIMENSIONS: Dimension[] = ['carrier', 'terminal', 'customer', 'status', 'product', 'week']
const MEASURES: Measure[] = ['orders', 'on_time_pct', 'cycle_hours', 'tonnes', 'deviations']
const CHARTS: { key: Chart; icon: typeof ChartColumn }[] = [
  { key: 'bar', icon: ChartColumn }, { key: 'line', icon: ChartLine }, { key: 'stacked', icon: ChartNoAxesColumn }, { key: 'table', icon: Table2 },
]

interface Filters { carrier: string | null; status: OrderStatus | null; terminal: string | null }

/**
 * The reports page the way the donor's analysis page reads: four standard
 * analyses tiled two by two, each a click away from the orders behind it,
 * then a builder for the question nobody thought to tile.
 */
export function ReportsRoute() {
  const { t, lang } = useLang()
  const [filters, setFilters] = useState<Filters>({ carrier: null, status: null, terminal: null })

  const onTime = useQuery({ queryKey: ['report', 'carrier', 'on_time_pct'], queryFn: () => api.reports.build({ dimension: 'carrier', measure: 'on_time_pct', chart: 'bar' }) })
  const byStatus = useQuery({ queryKey: ['report', 'status', 'orders'], queryFn: () => api.reports.build({ dimension: 'status', measure: 'orders', chart: 'bar' }) })
  const tonnes = useQuery({ queryKey: ['report', 'week', 'tonnes'], queryFn: () => api.reports.build({ dimension: 'week', measure: 'tonnes', chart: 'line' }) })
  const cycle = useQuery({ queryKey: ['report', 'terminal', 'cycle_hours'], queryFn: () => api.reports.build({ dimension: 'terminal', measure: 'cycle_hours', chart: 'bar' }) })
  const worklist = useQuery({ queryKey: ['worklist', 'all'], queryFn: () => api.orders.worklist() })

  const rows = useMemo(() => (worklist.data ?? []).filter((r) => !r.isRequest)
    .filter((r) => !filters.carrier || r.carrierName === filters.carrier)
    .filter((r) => !filters.status || r.status === filters.status)
    .filter((r) => !filters.terminal || r.terminalName === filters.terminal), [worklist.data, filters])
  const active = Object.values(filters).some(Boolean)
  const toggle = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters((f) => ({ ...f, [k]: f[k] === v ? null : v }))

  const columns = useMemo<ColumnDef<WorklistRow>[]>(() => [
    { key: 'order', header: t('col.order'), width: '120px', pinned: 'left', sortValue: (r) => r.erpRef, render: (r) => <Link to={`/orders/${r.id}`} className="text-accent-text font-mono text-xs font-medium hover:underline">{r.erpRef}</Link> },
    { key: 'customer', header: t('col.customer'), width: '190px', sortValue: (r) => r.customerName, render: (r) => <span className="text-xs">{r.customerName}</span> },
    { key: 'carrier', header: t('col.carrier'), width: '180px', sortValue: (r) => r.carrierName ?? '', render: (r) => <span className="text-xs">{r.carrierName ?? '—'}</span> },
    { key: 'terminal', header: t('col.terminal'), width: '160px', sortValue: (r) => r.terminalName, render: (r) => <span className="text-muted-foreground text-xs">{r.terminalName}</span> },
    { key: 'status', header: t('col.status'), width: '160px', sortValue: (r) => statusIndex(r.status), render: (r) => <StatusChip status={r.status} rejected={r.rejected} /> },
    { key: 'product', header: t('col.product'), width: '170px', render: (r) => <span className="text-xs">{r.tonnes} t {t(productKey(r.product))}</span> },
    { key: 'window', header: t('col.window'), width: '170px', numeric: true, sortValue: (r) => r.windowStart, render: (r) => <span className="tabular text-xs">{formatDate(r.windowStart, lang)} {formatTime(r.windowStart)}–{formatTime(r.windowEnd)}</span> },
  ], [t, lang])

  const statusLabel = (s: string) => (ORDER_STATUSES.includes(s as OrderStatus) ? t(statusKey(s as OrderStatus)) : s)
  const tonnesTotal = (tonnes.data?.points ?? []).reduce((n, p) => n + p.value, 0)

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-5 md:px-6 md:py-6">
      <PageHeader
        title={t('page.reports.title')}
        description={t('page.reports.desc')}
        stats={[
          { label: t('reports.stat.onTime'), value: onTime.data ? `${Math.round(onTime.data.total)}%` : '—', tone: (onTime.data?.total ?? 0) >= 90 ? 'good' : 'attention' },
          { label: t('reports.stat.open'), value: (worklist.data ?? []).filter((r) => !r.isRequest && r.status !== 'delivery_completed').length },
          { label: t('reports.stat.tonnes'), value: `${Math.round(tonnesTotal).toLocaleString()} t` },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
        <Panel title={t('reports.tile.onTime')} note={t('reports.tile.onTimeNote')} keyName="on-time">
          {onTime.data ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={onTime.data.points} margin={{ top: 6, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid {...GRID} vertical={false} />
                <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: 'var(--border)' }} interval={0} angle={-22} height={54} textAnchor="end" />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
                <Tooltip {...TIP} formatter={(v: number) => [`${Math.round(v)}%`, t('reports.measure.on_time_pct')]} />
                <Bar dataKey="value" radius={[2, 2, 0, 0]} cursor="pointer" isAnimationActive={false} onClick={(e: { label?: string }) => e.label && toggle('carrier', e.label)}>
                  {onTime.data.points.map((p) => <Cell key={p.label} fill={p.value >= 90 ? 'var(--accent)' : 'var(--sev-high)'} opacity={filters.carrier && filters.carrier !== p.label ? 0.3 : 1} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <Skeleton />}
        </Panel>

        <Panel title={t('reports.tile.status')} note={t('reports.tile.statusNote')} keyName="status">
          {byStatus.data ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byStatus.data.points.map((p) => ({ ...p, name: statusLabel(p.label) }))} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
                <CartesianGrid {...GRID} horizontal={false} />
                <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={AXIS} tickLine={false} axisLine={false} width={104} />
                <Tooltip {...TIP} formatter={(v: number) => [v, t('reports.measure.orders')]} />
                <Bar dataKey="value" radius={[0, 2, 2, 0]} cursor="pointer" isAnimationActive={false} onClick={(e: { label?: string }) => e.label && toggle('status', e.label as OrderStatus)}>
                  {byStatus.data.points.map((p) => <Cell key={p.label} fill="var(--accent)" opacity={filters.status && filters.status !== p.label ? 0.3 : 1} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <Skeleton />}
        </Panel>

        <Panel title={t('reports.tile.tonnes')} note={t('reports.tile.tonnesNote')} keyName="tonnes">
          {tonnes.data ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={tonnes.data.points} margin={{ top: 6, right: 8, bottom: 0, left: -10 }}>
                <defs><linearGradient id="tonnesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} /><stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} /></linearGradient></defs>
                <CartesianGrid {...GRID} vertical={false} />
                <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: 'var(--border)' }} interval={1} />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
                <Tooltip {...TIP} formatter={(v: number) => [`${Math.round(v).toLocaleString()} t`, t('reports.measure.tonnes')]} />
                <Area dataKey="value" stroke="var(--accent)" strokeWidth={2} fill="url(#tonnesFill)" dot={{ r: 2.5, fill: 'var(--accent)' }} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <Skeleton />}
        </Panel>

        <Panel title={t('reports.tile.cycle')} note={t('reports.tile.cycleNote')} keyName="cycle">
          {cycle.data ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cycle.data.points} margin={{ top: 6, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid {...GRID} vertical={false} />
                <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: 'var(--border)' }} interval={0} />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v} h`} />
                <Tooltip {...TIP} formatter={(v: number) => [`${v.toFixed(1)} h`, t('reports.measure.cycle_hours')]} />
                <Bar dataKey="value" radius={[2, 2, 0, 0]} cursor="pointer" isAnimationActive={false} onClick={(e: { label?: string }) => e.label && toggle('terminal', e.label)}>
                  {cycle.data.points.map((p) => <Cell key={p.label} fill="var(--rail, var(--primary))" opacity={filters.terminal && filters.terminal !== p.label ? 0.3 : 1} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <Skeleton />}
        </Panel>
      </div>

      <section className="flex flex-col gap-3" data-card="drill">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold">{t('reports.drill')} · {rows.length}</h2>
          {filters.carrier && <Chip label={`${t('col.carrier')}: ${filters.carrier}`} onClear={() => toggle('carrier', filters.carrier)} />}
          {filters.status && <Chip label={`${t('col.status')}: ${statusLabel(filters.status)}`} onClear={() => toggle('status', filters.status)} />}
          {filters.terminal && <Chip label={`${t('col.terminal')}: ${filters.terminal}`} onClear={() => toggle('terminal', filters.terminal)} />}
          {active && <Button size="sm" variant="ghost" onClick={() => setFilters({ carrier: null, status: null, terminal: null })} data-report-clear>{t('reports.clear')}</Button>}
          {!active && <span className="text-muted-foreground text-xs">{t('reports.drillHint')}</span>}
        </div>
        <DataTable name="report-drill" rows={rows} columns={columns} rowKey={(r) => r.id} maxHeight={300} empty={t('common.empty')} />
      </section>

      <Builder />
    </div>
  )
}

function Panel({ title, note, keyName, children }: { title: string; note: string; keyName: string; children: React.ReactNode }) {
  return (
    <section data-card={`panel-${keyName}`} className="border-structural-border bg-surface flex h-full flex-col rounded-lg border">
      <header className="border-border border-b px-5 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-muted-foreground mt-0.5 text-2xs">{note}</p>
      </header>
      <div className="h-60 px-3 py-3">{children}</div>
    </section>
  )
}

function Skeleton() {
  return <div className="bg-muted h-full animate-pulse rounded-md" />
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="bg-muted inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium" data-report-filter>
      {label}
      <button onClick={onClear} className="hover:text-foreground text-muted-foreground" aria-label={`Clear ${label}`}><X className="size-3" aria-hidden /></button>
    </span>
  )
}

/** The builder from the first version, kept as the page's second half. */
function Builder() {
  const { t, lang } = useLang()
  const qc = useQueryClient()
  const [dimension, setDimension] = useState<Dimension>('customer')
  const [measure, setMeasure] = useState<Measure>('orders')
  const [chart, setChart] = useState<Chart>('bar')
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const result = useQuery({ queryKey: ['report', dimension, measure, chart], queryFn: () => api.reports.build({ dimension, measure, chart }) })
  const saved = useQuery({ queryKey: ['reports', 'saved'], queryFn: () => api.reports.saved() })
  const save = useMutation({
    mutationFn: () => api.reports.save({ name: name.trim(), dimension, measure, chart }),
    onSuccess: () => { toast.success(t('reports.saved', { name: name.trim() })); setSaving(false); setName(''); qc.invalidateQueries({ queryKey: ['reports', 'saved'] }) },
  })
  const r = result.data
  const fmt = (v: number) => (r?.unit === '%' ? `${Math.round(v)}%` : r?.unit === 'h' ? `${v.toFixed(1)} h` : r?.unit === 't' ? `${Math.round(v).toLocaleString()} t` : Math.round(v).toLocaleString())
  const chipClass = (on: boolean) => cn('rounded-md border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors', on ? 'border-accent bg-accent text-accent-foreground' : 'border-border bg-surface hover:bg-hover-tint')

  return (
    <section className="border-structural-border bg-surface rounded-lg border" data-card="builder">
      <header className="border-border flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3.5">
        <div><h2 className="text-sm font-semibold">{t('reports.builder')}</h2><p className="text-muted-foreground mt-0.5 text-2xs">{t('reports.builderNote')}</p></div>
        <Button size="sm" onClick={() => setSaving(true)} data-report-save-open data-variant="primary"><BookmarkPlus className="size-3.5" aria-hidden />{t('reports.save')}</Button>
      </header>
      <div className="grid gap-4 p-5 xl:grid-cols-[1fr_280px]">
        <div className="flex flex-col gap-3">
          {([['dimension', DIMENSIONS, dimension, setDimension], ['measure', MEASURES, measure, setMeasure]] as const).map(([zone, options, current, set]) => (
            <div key={zone} className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={t(`reports.zone.${zone}`)}>
              <span className="text-muted-foreground w-20 shrink-0 text-2xs font-medium tracking-wide uppercase">{t(`reports.zone.${zone}`)}</span>
              {options.map((o) => <button key={o} role="radio" aria-checked={current === o} data-report-chip={`${zone}:${o}`} onClick={() => (set as (v: string) => void)(o)} className={chipClass(current === o)}>{t(`reports.${zone}.${o}` as I18nKey)}</button>)}
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={t('reports.zone.chart')}>
            <span className="text-muted-foreground w-20 shrink-0 text-2xs font-medium tracking-wide uppercase">{t('reports.zone.chart')}</span>
            {CHARTS.map(({ key, icon: Icon }) => <button key={key} role="radio" aria-checked={chart === key} data-report-chip={`chart:${key}`} onClick={() => setChart(key)} className={cn(chipClass(chart === key), 'inline-flex items-center gap-1.5')}><Icon className="size-3.5" aria-hidden />{t(`reports.chart.${key}` as I18nKey)}</button>)}
          </div>
          <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold" data-report-title>{t(`reports.measure.${measure}` as I18nKey)} · {t(`reports.dimension.${dimension}` as I18nKey)}</h3>
            {r && <span className="text-muted-foreground text-xs">{t('reports.total')}: <span className="text-foreground tabular font-medium" data-report-total>{fmt(r.total)}</span></span>}
          </div>
          <div className="h-[260px]" data-report-chart={chart}>
            {!r ? <Skeleton /> : chart === 'table' ? (
              <div className="border-border h-full overflow-auto rounded-md border">
                <table className="w-full text-xs"><thead className="bg-muted sticky top-0"><tr><th className="px-3 py-2 text-left font-medium">{t(`reports.dimension.${dimension}` as I18nKey)}</th><th className="px-3 py-2 text-right font-medium">{t(`reports.measure.${measure}` as I18nKey)}</th><th className="px-3 py-2 text-right font-medium">{t('reports.orders')}</th></tr></thead>
                  <tbody>{r.points.map((p) => <tr key={p.label} className="border-border border-t"><td className="px-3 py-1.5">{p.label}</td><td className="tabular px-3 py-1.5 text-right font-medium">{fmt(p.value)}</td><td className="tabular text-muted-foreground px-3 py-1.5 text-right">{p.secondary ?? ''}</td></tr>)}</tbody></table>
              </div>
            ) : chart === 'line' ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={r.points} margin={{ top: 8, right: 12, bottom: 0, left: -6 }}>
                  <CartesianGrid {...GRID} vertical={false} />
                  <XAxis dataKey="label" tick={AXIS} tickLine={false} interval={0} angle={r.points.length > 8 ? -20 : 0} height={r.points.length > 8 ? 48 : 30} textAnchor={r.points.length > 8 ? 'end' : 'middle'} />
                  <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v: number) => (r.unit === '%' ? `${Math.round(v)}%` : String(v))} />
                  <Tooltip {...TIP} formatter={(v: number) => fmt(v)} />
                  <Area dataKey="value" stroke="var(--accent)" strokeWidth={2} fill="var(--accent)" fillOpacity={0.12} dot={{ r: 2.5 }} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={r.points} margin={{ top: 8, right: 12, bottom: 0, left: -6 }}>
                  <CartesianGrid {...GRID} vertical={false} />
                  <XAxis dataKey="label" tick={AXIS} tickLine={false} interval={0} angle={r.points.length > 8 ? -20 : 0} height={r.points.length > 8 ? 48 : 30} textAnchor={r.points.length > 8 ? 'end' : 'middle'} />
                  <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v: number) => (r.unit === '%' ? `${Math.round(v)}%` : String(v))} />
                  <Tooltip {...TIP} formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="value" fill="var(--accent)" stackId={chart === 'stacked' ? 'a' : undefined} radius={[2, 2, 0, 0]} isAnimationActive={false} />
                  {chart === 'stacked' && <Bar dataKey="secondary" fill="var(--muted-foreground)" stackId="a" radius={[2, 2, 0, 0]} isAnimationActive={false} />}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        <aside className="border-border rounded-md border p-4">
          <h3 className="text-xs font-semibold">{t('reports.savedTitle')}</h3>
          {(saved.data ?? []).length === 0 ? <p className="text-muted-foreground mt-2 text-xs">{t('reports.savedEmpty')}</p> : (
            <ul className="divide-border mt-2 divide-y">
              {(saved.data ?? []).map((s) => (
                <li key={s.id}><button onClick={() => { setDimension(s.dimension); setMeasure(s.measure); setChart(s.chart) }} data-saved-report={s.id} className="hover:bg-hover-tint flex w-full flex-col items-start gap-0.5 rounded-sm px-1 py-2 text-left"><span className="text-xs font-medium">{s.name}</span><span className="text-muted-foreground text-2xs">{t(`reports.measure.${s.measure}` as I18nKey)} · {t(`reports.dimension.${s.dimension}` as I18nKey)} · {formatDateTime(s.createdAt, lang)}</span></button></li>
              ))}
            </ul>
          )}
        </aside>
      </div>
      <Dialog open={saving} onOpenChange={setSaving}>
        <DialogContent className="sm:max-w-sm" data-dialog="save-report">
          <DialogHeader><DialogTitle>{t('reports.save')}</DialogTitle><DialogDescription>{t('reports.saveDesc')}</DialogDescription></DialogHeader>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t('reports.namePlaceholder')} className="border-border bg-background h-9 w-full rounded-md border px-2 text-sm" data-report-name />
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setSaving(false)}>{t('common.cancel')}</Button><Button disabled={!name.trim() || save.isPending} onClick={() => save.mutate()} data-report-save data-variant="primary">{t('common.save')}</Button></div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
