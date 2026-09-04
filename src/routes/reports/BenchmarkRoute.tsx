import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Table2, TrendingDown, TrendingUp } from 'lucide-react'
import { api } from '@/services'
import { PageHeader } from '@/components/shell/PageHeader'
import { KpiTile } from '@/components/dashboard/KpiTile'
import { Button } from '@/components/ui/button'
import { TIP, AXIS, GRID } from '@/components/charts/chart'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'

/**
 * Weekly on-time rate against the benchmark, with the next weeks as a
 * shaded band rather than a single line: the band is what the forecast
 * actually knows. The table under it is the same numbers, for the reader
 * who wants to check one.
 */
export function BenchmarkRoute() {
  const t = useT()
  const [table, setTable] = useState(false)
  const series = useQuery({ queryKey: ['benchmark'], queryFn: () => api.reports.benchmark() })
  const s = series.data
  const data = (s?.points ?? []).map((p) => ({ ...p, band: p.forecastLow !== null && p.forecastHigh !== null ? [p.forecastLow, p.forecastHigh] : null }))
  const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`)
  const up = (s?.trend ?? 0) >= 0

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-5 md:px-6 md:py-6">
      <PageHeader
        title={t('page.benchmark.title')}
        description={t('page.benchmark.desc')}
        action={<Button variant="outline" onClick={() => setTable((v) => !v)} data-benchmark-table><Table2 className="size-4" aria-hidden />{table ? t('benchmark.hideTable') : t('benchmark.showTable')}</Button>}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiTile label={t('benchmark.current')} value={s?.current ?? 0} unit="%" footnote={t('benchmark.currentFoot')} icon={up ? TrendingUp : TrendingDown} tone={(s?.current ?? 0) >= (s?.benchmark ?? 1) ? 'good' : 'warning'} />
        <KpiTile label={t('benchmark.target')} value={s?.benchmark ?? 0} unit="%" footnote={t('benchmark.targetFoot')} icon={TrendingUp} tone="neutral" />
        <KpiTile label={t('benchmark.trend')} value={Math.abs(s?.trend ?? 0)} unit="%" footnote={up ? t('benchmark.trendUp') : t('benchmark.trendDown')} icon={up ? TrendingUp : TrendingDown} tone={up ? 'good' : 'warning'} />
      </div>

      <section className="border-structural-border bg-surface rounded-lg border px-5 py-4" data-card="benchmark-chart">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{t('benchmark.chartTitle')}</h2>
          <ul className="text-muted-foreground flex flex-wrap items-center gap-4 text-2xs">
            <li className="flex items-center gap-1.5"><span className="bg-accent h-0.5 w-4" aria-hidden />{t('benchmark.legend.actual')}</li>
            <li className="flex items-center gap-1.5"><span className="border-sev-high h-0 w-4 border-t border-dashed" aria-hidden />{t('benchmark.legend.benchmark')}</li>
            <li className="flex items-center gap-1.5"><span className="bg-accent/20 h-3 w-4 rounded-xs" aria-hidden />{t('benchmark.legend.band')}</li>
          </ul>
        </div>
        <div className="mt-3 h-[340px]">
          {!s ? <div className="bg-muted h-full animate-pulse rounded-md" /> : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid {...GRID} vertical={false} />
                <XAxis dataKey="week" tick={AXIS} interval={1} />
                <YAxis tick={AXIS} width={44} domain={[0.7, 1]} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} />
                <Tooltip {...TIP} formatter={(v: number | number[], name: string) => [Array.isArray(v) ? `${pct(v[0])} – ${pct(v[1])}` : pct(v), t(`benchmark.legend.${name}` as 'benchmark.legend.actual')]} />
                <Area dataKey="band" name="band" fill="var(--accent)" fillOpacity={0.15} stroke="none" isAnimationActive={false} connectNulls={false} />
                <ReferenceLine y={s.benchmark} stroke="var(--sev-high)" strokeDasharray="5 4" />
                <Line dataKey="onTimePct" name="actual" stroke="var(--accent)" strokeWidth={2} dot={{ r: 2.5 }} isAnimationActive={false} connectNulls={false} />
                <Line dataKey="forecast" name="forecast" stroke="var(--accent)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} connectNulls={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {table && s && (
        <section className="border-structural-border bg-surface overflow-x-auto rounded-lg border" data-card="benchmark-table">
          <table className="w-full text-xs">
            <thead className="bg-muted"><tr>
              <th className="px-3 py-2 text-left font-medium">{t('benchmark.week')}</th>
              <th className="px-3 py-2 text-right font-medium">{t('benchmark.legend.actual')}</th>
              <th className="px-3 py-2 text-right font-medium">{t('benchmark.legend.benchmark')}</th>
              <th className="px-3 py-2 text-right font-medium">{t('benchmark.legend.forecast')}</th>
              <th className="px-3 py-2 text-right font-medium">{t('benchmark.legend.band')}</th>
            </tr></thead>
            <tbody>
              {s.points.map((p) => (
                <tr key={p.week} className="border-border border-t">
                  <td className="px-3 py-1.5">{p.week}</td>
                  <td className={cn('tabular px-3 py-1.5 text-right font-medium', p.onTimePct < p.benchmark && 'text-sev-high-on-bg')}>{pct(p.onTimePct)}</td>
                  <td className="tabular text-muted-foreground px-3 py-1.5 text-right">{pct(p.benchmark)}</td>
                  <td className="tabular px-3 py-1.5 text-right">{pct(p.forecast)}</td>
                  <td className="tabular text-muted-foreground px-3 py-1.5 text-right">{p.forecastLow === null ? '—' : `${pct(p.forecastLow)} – ${pct(p.forecastHigh)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}
