import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { AlertOctagon, Boxes, PackageCheck, ShieldAlert, Wallet } from 'lucide-react'
import { api } from '@/services'
import type { ActionQueueRow } from '@/services'
import { TodayBand } from '@/components/dashboard/TodayBand'
import { KpiTile } from '@/components/dashboard/KpiTile'
import { Panel } from '@/components/dashboard/Panel'
import { Bars } from '@/components/dashboard/Bars'
import { AnalysisPanel } from '@/components/dashboard/AnalysisPanel'
import { DataTable, type ColumnDef } from '@/components/table/DataTable'
import { LoadingRows } from '@/components/state/States'
import { formatDate } from '@/fixtures/calendar'
import { cn } from '@/lib/utils'

/**
 * The five-second read, and the queue underneath it.
 *
 * Every figure on this page comes from one query. The nav badge, the hero
 * count, the metric tiles, the reason bars and the queue rows are all reading
 * the same records, which is the only way they can be guaranteed not to
 * disagree — and disagreeing in front of a client is worse than being wrong,
 * because the audience does the finding.
 */

const PRIORITY_TONE: Record<ActionQueueRow['priority'], string> = {
  P1: 'bg-sev-critical-bg text-sev-critical-on-bg',
  P2: 'bg-sev-high-bg text-sev-high-on-bg',
  P3: 'bg-muted text-muted-foreground',
}

const columns: ColumnDef<ActionQueueRow>[] = [
  {
    key: 'priority', header: 'Priority', width: '96px', pinned: 'left',
    sortValue: (r) => r.priority,
    render: (r) => (
      <span className={cn('rounded-xs px-1.5 py-0.5 text-2xs font-medium', PRIORITY_TONE[r.priority])}>
        {r.priority}
      </span>
    ),
  },
  {
    key: 'subject', header: 'Order / part', width: '180px', pinned: 'left',
    sortValue: (r) => r.subject,
    render: (r) => <span className="font-mono text-xs font-medium">{r.subject}</span>,
  },
  {
    key: 'trigger', header: 'Trigger', width: '210px',
    sortValue: (r) => r.trigger,
    render: (r) => <span className="text-muted-foreground text-xs">{r.trigger}</span>,
  },
  {
    key: 'issue', header: 'Issue', width: '300px',
    render: (r) => <span className="text-xs">{r.issue}</span>,
  },
  {
    key: 'site', header: 'Site', width: '110px',
    sortValue: (r) => r.site,
    render: (r) => <span className="text-muted-foreground text-xs">{r.site}</span>,
  },
  {
    key: 'needDate', header: 'Need by', width: '130px', numeric: true,
    sortValue: (r) => r.needDate ?? '9999',
    render: (r) => (
      <span className="text-xs">{r.needDate ? formatDate(r.needDate) : '—'}</span>
    ),
  },
  {
    key: 'impact', header: 'Impact', width: '160px', align: 'right',
    render: (r) => <span className="text-xs font-medium">{r.impact}</span>,
  },
  {
    key: 'owner', header: 'Owner', width: '170px',
    sortValue: (r) => r.owner,
    render: (r) => <span className="text-muted-foreground text-xs">{r.owner}</span>,
  },
  {
    key: 'action', header: 'Recommended action', width: '190px', pinned: 'right',
    render: (r) => (
      <span className="text-accent-text text-xs font-medium">{r.recommendedAction}</span>
    ),
  },
]

export function CommandCenterRoute() {
  const navigate = useNavigate()
  const summary = useQuery({ queryKey: ['command-center'], queryFn: () => api.dashboard.summary() })
  const queue = useQuery({ queryKey: ['action-queue'], queryFn: () => api.dashboard.actionQueue() })
  const reasons = useQuery({ queryKey: ['reasons'], queryFn: () => api.dashboard.reasons() })

  const s = summary.data

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-6 py-6">
      {s ? (
        <TodayBand
          title="Command Center"
          subtitle="What needs a decision today, and what it costs to leave it."
          waiting={s.skusRequiringAction}
          /* The band supplies "needs/need a decision" itself; this is the noun. */
          unit={s.skusRequiringAction === 1 ? 'part' : 'parts'}
          severities={[
            { severity: 'critical', count: queue.data?.filter((r) => r.priority === 'P1').length ?? 0 },
            { severity: 'high', count: queue.data?.filter((r) => r.priority === 'P2').length ?? 0 },
          ]}
          sentence={s.firstAction?.sentence ?? null}
          primaryTo={s.firstAction?.href ?? null}
          secondaryTo="/inventory"
          metrics={[
            { label: 'Draft requisition value', value: `$${s.draftRequisitionValue.toLocaleString()}` },
            { label: 'Awaiting approval', value: s.approvalsWaiting },
            { label: 'Orders at risk', value: s.ordersAtRisk, tone: s.ordersAtRisk > 0 ? 'attention' : 'default' },
          ]}
        />
      ) : (
        <div className="border-structural-border bg-surface h-52 animate-pulse rounded-lg border" />
      )}

      {/* Six figures, three across. Every one names what it was counted from —
          a percentage with no denominator is unfalsifiable. */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {s && (
          <>
            <KpiTile
              label="Parts requiring action" value={s.skusRequiringAction} icon={AlertOctagon}
              tone={s.skusRequiringAction > 0 ? 'warning' : 'good'}
              footnote={`of ${(s.skusRequiringAction + s.blockedByData).toLocaleString()} flagged at Plant A`}
            />
            <KpiTile
              label="Orders at risk" value={s.ordersAtRisk} icon={PackageCheck}
              tone={s.ordersAtRisk > 0 ? 'warning' : 'good'}
              footnote="configured orders with a short component"
            />
            <KpiTile
              label="Draft requisition value" value={s.draftRequisitionValue} unit="$" icon={Wallet}
              tone="neutral" footnote={`${s.approvalsWaiting} requisitions awaiting approval`}
            />
            <KpiTile
              label="Approvals waiting" value={s.approvalsWaiting} icon={ShieldAlert}
              tone={s.approvalsWaiting > 0 ? 'warning' : 'good'}
              footnote="supplier-scoped requisitions ready for review"
            />
            <KpiTile
              label="Excess exposure" value={s.excessExposure} unit="$" icon={Boxes}
              tone="neutral" footnote="value held above the recommended ceiling"
            />
            <KpiTile
              label="Blocked by evidence" value={s.blockedByData} icon={AlertOctagon}
              tone={s.blockedByData > 0 ? 'warning' : 'good'}
              footnote="recommendations withheld pending confirmation"
            />
          </>
        )}
      </div>

      {/* Full width, because the cards need it.
          Four 296px cards in a half-column scroll immediately, and a rail that
          is always scrolled is a rail whose last card nobody finds. Across the
          page they sit open at 1440 and scroll only at the narrow end.

          AnalysisPanel brings its own card. Wrapping it in another gives the
          panel two titles — fast-demo Layout law 3, and the duplicate shows up
          in the heading outline before it shows up on screen. */}
      <AnalysisPanel observations={s?.observations ?? []} analysis={s?.writtenAnalysis ?? []} />

      {/* Why the queue is the size it is. */}
      <Panel
        title="Why they are open"
        action={{ label: 'All inventory', to: '/inventory' }}
      >
        <Bars
          rows={(reasons.data ?? []).map((r) => ({
            key: r.key, label: r.label, count: r.count, to: r.href,
          }))}
          emptyCopy="Nothing is open."
        />
      </Panel>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-lg font-semibold">Priority action queue</h2>
          <span className="text-muted-foreground text-xs">
            {queue.data?.length ?? 0} items · highest priority first
          </span>
        </div>
        {queue.isLoading ? (
          <LoadingRows rows={5} />
        ) : (
          <DataTable
            name="action-queue"
            rows={queue.data ?? []}
            columns={columns}
            rowKey={(r) => r.id}
            empty="No decisions waiting."
            /* The row is the control. DataTable makes it focusable and binds
               Enter and Space, so this is reachable without a pointer — which
               is why there is no separate link duplicating it. */
            onRowClick={(r) => navigate(r.recommendedHref)}
          />
        )}
      </section>
    </div>
  )
}
