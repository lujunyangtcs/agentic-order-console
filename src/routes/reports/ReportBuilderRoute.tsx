import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BookmarkPlus, ChartColumn, ChartLine, ChartNoAxesColumn, Table2 } from 'lucide-react'
import { api } from '@/services'
import type { ReportSpec } from '@/services'
import { PageHeader } from '@/components/shell/PageHeader'
import { Panel } from '@/components/dashboard/Panel'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { TIP, AXIS, GRID } from '@/components/charts/chart'
import { formatDateTime } from '@/fixtures/calendar'
import { useLang, type I18nKey } from '@/i18n'
import { cn } from '@/lib/utils'

type Dimension = ReportSpec['dimension']
type Measure = ReportSpec['measure']
type Chart = ReportSpec['chart']

const DIMENSIONS: Dimension[] = ['carrier', 'terminal', 'customer', 'status', 'product', 'week']
const MEASURES: Measure[] = ['orders', 'on_time_pct', 'cycle_hours', 'tonnes', 'deviations']
const CHARTS: { key: Chart; icon: typeof ChartColumn }[] = [
  { key: 'bar', icon: ChartColumn }, { key: 'line', icon: ChartLine }, { key: 'stacked', icon: ChartNoAxesColumn }, { key: 'table', icon: Table2 },
]

/**
 * Three rows of chips — what to group by, what to count, how to draw it —
 * and the report is built from the same order events every other page
 * reads. Saving names it and keeps it in the list on the right.
 */
export function ReportBuilderRoute() {
  const { t, lang } = useLang()
  const qc = useQueryClient()
  const [dimension, setDimension] = useState<Dimension>('carrier')
  const [measure, setMeasure] = useState<Measure>('on_time_pct')
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

  function load(spec: ReportSpec) {
    setDimension(spec.dimension)
    setMeasure(spec.measure)
    setChart(spec.chart)
  }

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-5 md:px-6 md:py-6">
      <PageHeader
        title={t('page.reports.title')}
        description={t('page.reports.desc')}
        action={<Button onClick={() => setSaving(true)} data-report-save-open data-variant="primary"><BookmarkPlus className="size-4" aria-hidden />{t('reports.save')}</Button>}
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_320px] xl:items-stretch">
        <section className="border-structural-border bg-surface flex h-full flex-col rounded-lg border">
          <div className="border-border flex flex-col gap-3 border-b px-5 py-4">
            {([
              ['dimension', DIMENSIONS, dimension, setDimension],
              ['measure', MEASURES, measure, setMeasure],
            ] as const).map(([zone, options, current, set]) => (
              <div key={zone} className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={t(`reports.zone.${zone}`)}>
                <span className="text-muted-foreground w-24 shrink-0 text-2xs font-medium tracking-wide uppercase">{t(`reports.zone.${zone}`)}</span>
                {options.map((o) => (
                  <button key={o} role="radio" aria-checked={current === o} data-report-chip={`${zone}:${o}`} onClick={() => (set as (v: string) => void)(o)} className={chipClass(current === o)}>
                    {t(`reports.${zone}.${o}` as I18nKey)}
                  </button>
                ))}
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={t('reports.zone.chart')}>
              <span className="text-muted-foreground w-24 shrink-0 text-2xs font-medium tracking-wide uppercase">{t('reports.zone.chart')}</span>
              {CHARTS.map(({ key, icon: Icon }) => (
                <button key={key} role="radio" aria-checked={chart === key} data-report-chip={`chart:${key}`} onClick={() => setChart(key)} className={cn(chipClass(chart === key), 'inline-flex items-center gap-1.5')}>
                  <Icon className="size-3.5" aria-hidden />{t(`reports.chart.${key}` as I18nKey)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-1 flex-col px-5 py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold" data-report-title>{t(`reports.measure.${measure}` as I18nKey)} · {t(`reports.dimension.${dimension}` as I18nKey)}</h2>
              {r && <span className="text-muted-foreground text-xs">{t('reports.total')}: <span className="text-foreground tabular font-medium" data-report-total>{fmt(r.total)}</span></span>}
            </div>
            <div className="mt-3 h-[320px]" data-report-chart={chart}>
              {!r ? (
                <div className="bg-muted h-full animate-pulse rounded-md" />
              ) : chart === 'table' ? (
                <div className="border-border h-full overflow-auto rounded-md border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted sticky top-0"><tr><th className="px-3 py-2 text-left font-medium">{t(`reports.dimension.${dimension}` as I18nKey)}</th><th className="px-3 py-2 text-right font-medium">{t(`reports.measure.${measure}` as I18nKey)}</th>{r.points.some((p) => p.secondary !== undefined) && <th className="px-3 py-2 text-right font-medium">{t('reports.orders')}</th>}</tr></thead>
                    <tbody>
                      {r.points.map((p) => (
                        <tr key={p.label} className="border-border border-t"><td className="px-3 py-1.5">{p.label}</td><td className="tabular px-3 py-1.5 text-right font-medium">{fmt(p.value)}</td>{p.secondary !== undefined && <td className="tabular text-muted-foreground px-3 py-1.5 text-right">{p.secondary}</td>}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : chart === 'line' ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={r.points} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                    <CartesianGrid {...GRID} vertical={false} />
                    <XAxis dataKey="label" tick={AXIS} interval={0} angle={r.points.length > 8 ? -20 : 0} height={r.points.length > 8 ? 48 : 30} />
                    <YAxis tick={AXIS} width={44} tickFormatter={(v: number) => (r.unit === '%' ? `${Math.round(v)}%` : String(v))} />
                    <Tooltip {...TIP} formatter={(v: number) => fmt(v)} />
                    <Line dataKey="value" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={r.points} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                    <CartesianGrid {...GRID} vertical={false} />
                    <XAxis dataKey="label" tick={AXIS} interval={0} angle={r.points.length > 8 ? -20 : 0} height={r.points.length > 8 ? 48 : 30} />
                    <YAxis tick={AXIS} width={44} tickFormatter={(v: number) => (r.unit === '%' ? `${Math.round(v)}%` : String(v))} />
                    <Tooltip {...TIP} formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="value" fill="var(--accent)" stackId={chart === 'stacked' ? 'a' : undefined} radius={[2, 2, 0, 0]} isAnimationActive={false} />
                    {chart === 'stacked' && r.points.some((p) => p.secondary !== undefined) && <Bar dataKey="secondary" fill="var(--navy-300, var(--muted-foreground))" stackId="a" radius={[2, 2, 0, 0]} isAnimationActive={false} />}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </section>

        <Panel title={t('reports.savedTitle')} className="h-full">
          {(saved.data ?? []).length === 0 ? (
            <p className="text-muted-foreground text-xs">{t('reports.savedEmpty')}</p>
          ) : (
            <ul className="divide-border divide-y">
              {(saved.data ?? []).map((s) => (
                <li key={s.id}>
                  <button onClick={() => load(s)} data-saved-report={s.id} className="hover:bg-hover-tint flex w-full flex-col items-start gap-0.5 rounded-sm px-1 py-2 text-left">
                    <span className="text-xs font-medium">{s.name}</span>
                    <span className="text-muted-foreground text-2xs">{t(`reports.measure.${s.measure}` as I18nKey)} · {t(`reports.dimension.${s.dimension}` as I18nKey)} · {formatDateTime(s.createdAt, lang)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Dialog open={saving} onOpenChange={setSaving}>
        <DialogContent className="sm:max-w-sm" data-dialog="save-report">
          <DialogHeader>
            <DialogTitle>{t('reports.save')}</DialogTitle>
            <DialogDescription>{t('reports.saveDesc')}</DialogDescription>
          </DialogHeader>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t('reports.namePlaceholder')} className="border-border bg-background h-9 w-full rounded-md border px-2 text-sm" data-report-name />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSaving(false)}>{t('common.cancel')}</Button>
            <Button disabled={!name.trim() || save.isPending} onClick={() => save.mutate()} data-report-save data-variant="primary">{t('common.save')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
