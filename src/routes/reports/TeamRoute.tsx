import { useQuery } from '@tanstack/react-query'
import { api } from '@/services'
import type { WorkloadCell } from '@/services'
import { PageHeader } from '@/components/shell/PageHeader'
import { useT, type I18nKey } from '@/i18n'
import { cn } from '@/lib/utils'

const BUCKETS: WorkloadCell['bucket'][] = ['requests', 'assigning', 'pending', 'moving', 'delivering', 'exceptions']

/**
 * Who is carrying what: one row per service-desk owner, one column per
 * stage of an order's life. The darker the cell, the more orders sit
 * there — a dark column under one name is a coverage gap in plain sight.
 */
export function TeamRoute() {
  const t = useT()
  const cells = useQuery({ queryKey: ['workload'], queryFn: () => api.reports.workload() })
  const data = cells.data ?? []
  const people = [...new Map(data.map((c) => [c.cvrId, c.cvrName])).entries()]
  const max = Math.max(1, ...data.map((c) => c.count))
  const at = (cvrId: string, bucket: WorkloadCell['bucket']) => data.find((c) => c.cvrId === cvrId && c.bucket === bucket)?.count ?? 0
  const rowTotal = (cvrId: string) => BUCKETS.reduce((n, b) => n + at(cvrId, b), 0)
  const colTotal = (b: WorkloadCell['bucket']) => people.reduce((n, [id]) => n + at(id, b), 0)
  const grand = people.reduce((n, [id]) => n + rowTotal(id), 0)
  const heaviest = people.map(([id, name]) => ({ name, n: rowTotal(id) })).sort((a, b) => b.n - a.n)[0]
  const lightest = people.map(([id, name]) => ({ name, n: rowTotal(id) })).sort((a, b) => a.n - b.n)[0]

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-5 md:px-6 md:py-6">
      <PageHeader
        title={t('page.team.title')}
        description={t('page.team.desc')}
        stats={[
          { label: t('team.people'), value: people.length },
          { label: t('team.orders'), value: grand },
          { label: t('team.heaviest'), value: heaviest ? `${heaviest.name} · ${heaviest.n}` : '—', tone: 'attention' },
          { label: t('team.lightest'), value: lightest ? `${lightest.name} · ${lightest.n}` : '—', tone: 'good' },
        ]}
      />

      <section className="border-structural-border bg-surface overflow-x-auto rounded-lg border [contain:inline-size]" data-card="heatmap">
        <table className="w-full min-w-[720px] text-xs">
          <thead>
            <tr className="border-border border-b">
              <th className="px-4 py-3 text-left font-medium">{t('team.owner')}</th>
              {BUCKETS.map((b) => <th key={b} className="px-3 py-3 text-center font-medium">{t(`team.bucket.${b}` as I18nKey)}</th>)}
              <th className="px-4 py-3 text-right font-medium">{t('team.total')}</th>
            </tr>
          </thead>
          <tbody>
            {people.map(([id, name]) => (
              <tr key={id} className="border-border border-b last:border-0" data-team-row={id}>
                <td className="px-4 py-2 font-medium whitespace-nowrap">{name}</td>
                {BUCKETS.map((b) => {
                  const n = at(id, b)
                  const k = n / max
                  return (
                    <td key={b} className="px-3 py-2 text-center">
                      <span
                        data-heat={n}
                        className={cn('tabular inline-flex h-9 w-full min-w-14 items-center justify-center rounded-md font-medium', k > 0.6 ? 'text-accent-foreground' : n > 0 ? 'text-foreground' : 'text-muted-foreground')}
                        style={{ background: n === 0 ? 'var(--muted)' : `color-mix(in oklab, var(--accent) ${Math.round(15 + k * 85)}%, var(--surface))` }}
                        title={`${name} · ${t(`team.bucket.${b}` as I18nKey)} · ${n}`}
                      >
                        {n || '·'}
                      </span>
                    </td>
                  )
                })}
                <td className="tabular px-4 py-2 text-right font-semibold">{rowTotal(id)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-muted/60 border-border border-t">
              <td className="px-4 py-2 font-medium">{t('team.total')}</td>
              {BUCKETS.map((b) => <td key={b} className="tabular px-3 py-2 text-center font-medium">{colTotal(b)}</td>)}
              <td className="tabular px-4 py-2 text-right font-semibold">{grand}</td>
            </tr>
          </tfoot>
        </table>
      </section>
      <p className="text-muted-foreground text-xs">{t('team.legend')}</p>
    </div>
  )
}
