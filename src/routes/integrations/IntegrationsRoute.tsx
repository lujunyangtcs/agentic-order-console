import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, CircleDashed, Plug, ShieldCheck } from 'lucide-react'
import { api } from '@/services'
import type { Connector } from '@/services'
import { PageHeader } from '@/components/shell/PageHeader'
import { formatDateTime } from '@/fixtures/calendar'
import { cn } from '@/lib/utils'

/**
 * Where the data comes from, and where it does not.
 *
 * This is the last screen of the walk, and its job is governance rather than
 * capability. Two of the four connectors are not connected and say so plainly.
 *
 * That is not modesty. A page where everything is green invites no questions,
 * and the first client conversation exists to ask exactly the questions these
 * two gaps raise: where is the manufacturing structure actually maintained, and
 * how far apart are the system and the shelf. Claiming a live feed we do not
 * have would also contradict the spec twice over — it lists both as subject to
 * discovery, and puts count evidence outside the scope entirely.
 *
 * Connection state and freshness are shown as separate facts, in separate
 * positions, because a connector can be perfectly reachable and still be
 * serving something stale.
 */

const FRESHNESS_LABEL: Record<string, string> = {
  fresh: 'Fresh',
  delayed: 'Delayed',
  partial: 'Partial',
  mapping_issue: 'Mapping issue',
}

export function IntegrationsRoute() {
  const connectors = useQuery({ queryKey: ['connectors'], queryFn: () => api.integrations.connectors() })
  const list = connectors.data ?? []
  const live = list.filter((c) => c.connected)

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-6 py-6">
      <PageHeader
        title="Data & Integrations"
        description="What each connector reads, what it may write, and how current it is."
        stats={[
          { label: 'Connected', value: `${live.length} of ${list.length}` },
          { label: 'Write-back', value: live.filter((c) => c.writeBack).length ? 'Requisitions only' : 'None' },
          { label: 'Open mapping issues', value: String(list.reduce((n, c) => n + c.mappingIssues, 0)) },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {list.map((c) => <ConnectorCard key={c.id} connector={c} />)}
      </div>

      <section data-card="flow" className="border-structural-border bg-surface rounded-lg border p-5">
        <h2 className="text-sm font-semibold">How it fits together</h2>
        <pre className="text-muted-foreground mt-3 overflow-x-auto font-mono text-2xs leading-relaxed">
{`  System of record  ──────────┐
  Procurement mailbox ────────┼──▶  Inventory Intelligence  ──▶  Recommendations
  Engineering structures ─ ─ ─┤          (read only)   ──▶  Approvals
  Warehouse counts ─ ─ ─ ─ ─ ─┘                        ──▶  Draft requisitions, written back

  ─── connected        ─ ─ ─ not connected`}
        </pre>
        <p className="text-muted-foreground border-border mt-4 border-t pt-3 text-xs leading-relaxed">
          Everything is read-only except one path: an approved draft requisition
          written back to the system of record. No supplier is contacted, no
          policy is changed without a person, and nothing is written that a human
          has not seen first.
        </p>
      </section>
    </div>
  )
}

function ConnectorCard({ connector: c }: { connector: Connector }) {
  return (
    <section
      data-card={`connector-${c.id}`}
      className={cn(
        'flex flex-col rounded-xs border',
        c.connected ? 'border-structural-border bg-surface' : 'border-structural-border border-dashed bg-surface',
      )}
    >
      <header className="border-border flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-5 py-3.5">
        <Plug className={cn('size-4 shrink-0', c.connected ? 'text-verdict-pass' : 'text-muted-foreground')} aria-hidden />
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{c.name}</h2>

        {/* Two facts, two chips, two positions. */}
        <span className={cn('rounded-xs px-2 py-0.5 text-2xs font-medium',
          c.connected ? 'bg-verdict-pass-bg text-verdict-pass' : 'bg-muted text-muted-foreground')}>
          {c.connected ? 'Connected' : 'Not connected'}
        </span>
        {c.freshness && (
          <span className="border-border text-muted-foreground rounded-xs border px-2 py-0.5 text-2xs">
            {FRESHNESS_LABEL[c.freshness]}
          </span>
        )}
      </header>

      <div className="flex flex-col gap-3 px-5 py-4 text-xs">
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

        <dl className="divide-border divide-y">
          {[
            [c.recordsLabel ?? 'Records', c.records === null ? '—' : c.records.toLocaleString()],
            ['Last sync', c.lastSync ? formatDateTime(c.lastSync) : '—'],
            ['Write-back', c.writeBack ?? 'none'],
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

        {!c.connected && (
          <p className="text-muted-foreground flex items-center gap-1.5 text-2xs">
            <CircleDashed className="size-3" aria-hidden />
            A discovery question, not a build task.
          </p>
        )}
      </div>
    </section>
  )
}
