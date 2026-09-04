import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RotateCcw } from 'lucide-react'
import { api } from '@/services'
import type { ScorecardRow, ScorecardWeights } from '@/services'
import { PageHeader } from '@/components/shell/PageHeader'
import { DataTable, type ColumnDef } from '@/components/table/DataTable'
import { LoadingRows } from '@/components/state/States'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/app/auth'
import { SYSTEMS } from '@/app/product'
import { useT, type I18nKey } from '@/i18n'
import { cn } from '@/lib/utils'

const DEFAULT: ScorecardWeights = { onTime: 50, acceptance: 20, incidents: 20, rejections: 10 }
const KEYS = Object.keys(DEFAULT) as (keyof ScorecardWeights)[]

/**
 * Every carrier on the same four measures, ranked by a score whose weights
 * the desk can change and see re-rank the table at once. A carrier who
 * opens this page sees the same table with their own row marked.
 */
export function ScorecardRoute() {
  const t = useT()
  const { session } = useAuth()
  const [weights, setWeights] = useState<ScorecardWeights>(DEFAULT)
  const rows = useQuery({ queryKey: ['scorecard', weights], queryFn: () => api.carrier.scorecard(weights) })
  const data = rows.data ?? []
  const total = KEYS.reduce((n, k) => n + weights[k], 0)
  const mine = session?.role === 'Carrier' ? session.carrierId : null
  /* Carriers see the ranking and their own row; the weights belong to the desk. */
  const canWeight = session?.role !== 'Carrier'
  const max = useMemo(() => ({ acceptance: Math.max(1, ...data.map((r) => r.acceptanceMinutes)), incidents: Math.max(0.01, ...data.map((r) => r.incidentRate)), rejections: Math.max(1, ...data.map((r) => r.rejections)) }), [data])

  const columns = useMemo<ColumnDef<ScorecardRow>[]>(() => [
    { key: 'rank', header: '#', width: '56px', pinned: 'left', numeric: true, sortValue: (r) => r.rank, render: (r) => <span className="tabular text-xs font-semibold">{r.rank}</span> },
    { key: 'carrier', header: t('col.carrier'), width: '210px', pinned: 'left', sortValue: (r) => r.carrierName, render: (r) => (
      <span className="flex items-center gap-2 text-xs font-medium">
        {r.carrierName}
        {r.carrierId === mine && <span className="bg-accent text-accent-foreground rounded-xs px-1.5 py-0.5 text-2xs">{t('scorecard.you')}</span>}
        {!r.hasTms && <span className="text-muted-foreground text-2xs">{t('dispatch.portalOnly')}</span>}
      </span>
    ) },
    { key: 'loads', header: t('scorecard.loads'), width: '90px', numeric: true, sortValue: (r) => r.loads, render: (r) => <span className="tabular text-xs">{r.loads}</span> },
    { key: 'onTime', header: t('scorecard.onTime'), width: '190px', numeric: true, sortValue: (r) => r.onTimePct, render: (r) => <Meter value={r.onTimePct} label={`${Math.round(r.onTimePct * 100)}%`} tone={r.onTimePct >= 0.92 ? 'good' : r.onTimePct >= 0.85 ? 'mid' : 'bad'} /> },
    { key: 'acceptance', header: t('scorecard.acceptance'), width: '190px', numeric: true, sortValue: (r) => r.acceptanceMinutes, render: (r) => <Meter value={1 - r.acceptanceMinutes / max.acceptance} label={t('scorecard.minutes', { n: r.acceptanceMinutes })} tone={r.acceptanceMinutes <= 20 ? 'good' : r.acceptanceMinutes <= 45 ? 'mid' : 'bad'} /> },
    { key: 'incidents', header: t('scorecard.incidents'), width: '190px', numeric: true, sortValue: (r) => r.incidentRate, render: (r) => <Meter value={1 - r.incidentRate / max.incidents} label={`${(r.incidentRate * 100).toFixed(1)}%`} tone={r.incidentRate <= 0.03 ? 'good' : r.incidentRate <= 0.08 ? 'mid' : 'bad'} /> },
    { key: 'rejections', header: t('scorecard.rejections'), width: '150px', numeric: true, sortValue: (r) => r.rejections, render: (r) => <Meter value={1 - r.rejections / max.rejections} label={String(r.rejections)} tone={r.rejections === 0 ? 'good' : r.rejections <= 2 ? 'mid' : 'bad'} /> },
    { key: 'score', header: t('scorecard.score'), width: '100px', pinned: 'right', numeric: true, sortValue: (r) => r.score, render: (r) => <span className="tabular text-sm font-semibold" data-score={r.carrierId}>{Math.round(r.score)}</span> },
  ], [t, mine, max])

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-5 md:px-6 md:py-6">
      <PageHeader
        title={t('page.scorecard.title')}
        description={canWeight ? t('page.scorecard.desc') : t('page.scorecard.descCarrier')}
        stats={[
          { label: t('scorecard.carriers'), value: data.length },
          { label: t('scorecard.leader'), value: data[0]?.carrierName ?? '—' },
          { label: t('scorecard.source'), value: `${SYSTEMS.erp} · ${SYSTEMS.carrierTms}` },
        ]}
      />

      {canWeight ? (
      <section className="border-structural-border bg-surface rounded-lg border px-5 py-4" data-card="weights">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{t('scorecard.weights')}</h2>
          <div className="flex items-center gap-3">
            <span className={cn('tabular text-xs', total === 100 ? 'text-muted-foreground' : 'text-sev-high-on-bg font-medium')} data-weights-total>{t('scorecard.total', { n: total })}</span>
            <Button size="sm" variant="ghost" onClick={() => setWeights(DEFAULT)} data-weights-reset><RotateCcw className="size-3.5" aria-hidden />{t('scorecard.reset')}</Button>
          </div>
        </div>
        <div className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
          {KEYS.map((k) => (
            <label key={k} className="grid gap-1 text-xs">
              <span className="flex justify-between"><span>{t(`scorecard.weight.${k}` as I18nKey)}</span><span className="tabular font-medium">{weights[k]}</span></span>
              <input type="range" min={0} max={100} step={5} value={weights[k]} onChange={(e) => setWeights({ ...weights, [k]: Number(e.target.value) })} className="accent-accent" data-weight={k} aria-label={t(`scorecard.weight.${k}` as I18nKey)} />
            </label>
          ))}
        </div>
      </section>
      ) : (
        <p className="text-muted-foreground text-xs" data-weights-fixed>{t('scorecard.weightsFixed')}</p>
      )}

      {rows.isLoading ? <LoadingRows rows={6} /> : (
        <DataTable name="scorecard" rows={data} columns={columns} rowKey={(r) => r.carrierId} maxHeight={480} empty={t('common.empty')} />
      )}
    </div>
  )
}

function Meter({ value, label, tone }: { value: number; label: string; tone: 'good' | 'mid' | 'bad' }) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  return (
    <span className="flex items-center gap-2">
      <span className="bg-muted relative h-1.5 w-24 overflow-hidden rounded-full" aria-hidden>
        <span className={cn('absolute inset-y-0 left-0 rounded-full', tone === 'good' ? 'bg-verdict-pass' : tone === 'mid' ? 'bg-sev-medium' : 'bg-sev-critical')} style={{ width: `${pct}%` }} />
      </span>
      <span className="tabular text-xs">{label}</span>
    </span>
  )
}
