import { useQuery } from '@tanstack/react-query'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CheckCircle2, Plug, ShieldCheck } from 'lucide-react'
import { api } from '@/services'
import type { Connector } from '@/services'
import { PageHeader } from '@/components/shell/PageHeader'
import { EmptyState } from '@/components/state/States'
import { formatDateTime } from '@/fixtures/calendar'
import { useLang } from '@/i18n'
import { cn } from '@/lib/utils'

const FRESHNESS_LABEL: Record<string, string> = {
  fresh: 'Fresh',
  delayed: 'Delayed',
  partial: 'Partial',
  mapping_issue: 'Mapping issue',
}

/**
 * Where the data comes from, and where it goes.
 *
 * Connection state and freshness are shown as separate facts, in separate
 * positions, because a connector can be perfectly reachable and still be
 * serving something stale.
 */
export function IntegrationsRoute() {
  const { t } = useLang()
  const connectors = useQuery({ queryKey: ['connectors'], queryFn: () => api.integrations.connectors() })
  const list = connectors.data ?? []
  const live = list.filter((c) => c.connected)

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-5 md:px-6 md:py-6">
      <PageHeader
        title={t('page.integrations.title')}
        description={t('page.integrations.desc')}
        stats={[
          { label: t('chrome.connected'), value: `${live.length} / ${list.length}` },
          { label: 'Mapping issues', value: String(list.reduce((n, c) => n + c.mappingIssues, 0)) },
        ]}
      />
      {list.length === 0 ? (
        <EmptyState title={t('common.empty')} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
          {list.map((c) => <ConnectorCard key={c.id} connector={c} />)}
        </div>
      )}
    </div>
  )
}

const DIRECTION = { in: ArrowDownLeft, out: ArrowUpRight, both: ArrowLeftRight } as const

export function ConnectorCard({ connector: c }: { connector: Connector }) {
  const { lang } = useLang()
  const Dir = DIRECTION[c.direction]
  return (
    <section
      data-card={`connector-${c.id}`}
      className={cn(
        'flex h-full flex-col rounded-lg border',
        c.connected ? 'border-structural-border bg-surface' : 'border-structural-border border-dashed bg-surface',
      )}
    >
      <header className="border-border flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-5 py-3.5">
        <Plug className={cn('size-4 shrink-0', c.connected ? 'text-verdict-pass' : 'text-muted-foreground')} aria-hidden />
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{c.name}</h2>
        <span className={cn('rounded-xs px-2 py-0.5 text-2xs font-medium',
          c.connected ? 'bg-verdict-pass-bg text-verdict-pass' : 'bg-muted text-muted-foreground')}>
          {c.connected ? 'Connected' : 'Not connected'}
        </span>
        {c.freshness && (
          <span className="border-border text-muted-foreground rounded-xs border px-2 py-0.5 text-2xs">
            {FRESHNESS_LABEL[c.freshness]}
          </span>
        )}
        <Dir className="text-muted-foreground size-3.5" aria-hidden />
      </header>

      <div className="flex flex-1 flex-col gap-3 px-5 py-4 text-xs">
        {c.note && (
          <p className={cn('rounded-xs px-3 py-2 leading-relaxed',
            c.connected ? 'bg-sev-high-bg text-sev-high-on-bg' : 'bg-muted text-muted-foreground')}>
            {c.note}
          </p>
        )}
        {c.evidence && (
          <p className="text-verdict-pass flex gap-2 leading-relaxed">
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {c.evidence}
          </p>
        )}
        <div>
          <p className="text-muted-foreground eyebrow mb-1.5">Objects</p>
          <ul className="flex flex-wrap gap-1.5">
            {c.objects.map((o) => (
              <li key={o} className={cn('border-border rounded-xs border px-1.5 py-0.5 text-2xs',
                c.connected ? '' : 'text-muted-foreground border-dashed')}>
                {o}
              </li>
            ))}
          </ul>
        </div>
        <dl className="divide-border mt-auto divide-y">
          {[
            [c.recordsLabel ?? 'Records', c.records === null ? '—' : c.records.toLocaleString()],
            ['Last message', c.lastSync ? formatDateTime(c.lastSync, lang) : '—'],
            ['Writes', c.writeBack ?? 'none'],
            ['Open mapping issues', String(c.mappingIssues)],
          ].map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-3 py-1.5">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="tabular text-right">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="text-muted-foreground flex gap-2 leading-relaxed">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {c.permissions}
        </p>
      </div>
    </section>
  )
}
