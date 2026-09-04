import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Check, CircleAlert, Layers } from 'lucide-react'
import { api } from '@/services'
import { PermissionGate } from '@/components/state/PermissionGate'
import type { MaterialLine, CandidateRow } from '@/services'
import { DataTable, type ColumnDef } from '@/components/table/DataTable'
import { ReadinessAxes } from '@/components/orders/ReadinessAxes'
import { CoverageGap } from '@/components/orders/CoverageGap'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/fixtures/calendar'
import { cn } from '@/lib/utils'

/**
 * What a configured order does to the stockroom.
 *
 * The page is built around a distinction that the first draft of the spec
 * collapsed and that everything downstream depends on: what is short *now* and
 * what falls below policy *after this order ships* are different problems with
 * different owners and different clocks. The readiness axes state it, the
 * material table carries both, the post-build panel decomposes the second, and
 * the handoff shows where the two clocks diverge.
 */

const COVERAGE_LABEL: Record<MaterialLine['coverage'], string> = {
  covered: 'Covered',
  below_safety_after_build: 'Below policy after build',
  short: 'Short',
}

const COVERAGE_TONE: Record<MaterialLine['coverage'], string> = {
  covered: 'text-muted-foreground',
  below_safety_after_build: 'text-sev-high-on-bg',
  short: 'text-sev-critical-on-bg',
}

export function OrderImpactRoute() {
  const { orderId = 'so-demo-10482' } = useParams()
  const navigate = useNavigate()
  const id = orderId.toUpperCase()

  const [filter, setFilter] = useState<string | null>(null)
  const [drawerPart, setDrawerPart] = useState<string | null>(null)

  const impact = useQuery({ queryKey: ['order-impact', id], queryFn: () => api.orders.impact(id) })
  const post = useQuery({ queryKey: ['post-build', id], queryFn: () => api.orders.postBuild(id) })
  const proposal = useQuery({ queryKey: ['proposal', id], queryFn: () => api.orders.proposal(id) })

  const data = impact.data
  const lines = useMemo(() => {
    if (!data) return []
    if (!filter) return data.lines
    if (filter === 'covered') return data.lines.filter((l) => l.coverage === 'covered')
    if (filter === 'below') return data.lines.filter((l) => l.coverage === 'below_safety_after_build')
    if (filter === 'short') return data.lines.filter((l) => l.coverage === 'short')
    return data.lines.filter((l) => l.qualifiers.includes(filter as MaterialLine['qualifiers'][number]))
  }, [data, filter])

  const columns: ColumnDef<MaterialLine>[] = useMemo(() => [
    {
      key: 'part', header: 'Component', width: '260px', pinned: 'left',
      sortValue: (r) => r.partNumber,
      render: (r) => (
        <span className="flex flex-col">
          <span className="font-mono text-xs font-medium">{r.partNumber}</span>
          <span className="text-muted-foreground truncate text-2xs">{r.description}</span>
        </span>
      ),
    },
    { key: 'req', header: 'Required', width: '100px', numeric: true, sortValue: (r) => r.required, render: (r) => <span className="text-xs">{r.required}</span> },
    { key: 'avail', header: 'Available', width: '100px', numeric: true, sortValue: (r) => r.available, render: (r) => <span className="text-xs">{r.available}</span> },
    { key: 'supply', header: 'Open supply', width: '120px', numeric: true, sortValue: (r) => r.openSupply, render: (r) => <span className="text-xs">{r.openSupply || '—'}</span> },
    {
      key: 'after', header: 'After build', width: '110px', numeric: true,
      sortValue: (r) => r.positionAfterBuild,
      render: (r) => (
        <span className={cn('text-xs font-medium', r.positionAfterBuild < 0 && 'text-sev-critical-on-bg')}>
          {r.positionAfterBuild}
        </span>
      ),
    },
    { key: 'target', header: 'Active target', width: '120px', numeric: true, sortValue: (r) => r.activeTarget ?? -1, render: (r) => <span className="text-xs">{r.activeTarget ?? 'not set'}</span> },
    { key: 'need', header: 'Need by', width: '130px', numeric: true, sortValue: (r) => r.needDate, render: (r) => <span className="text-xs">{formatDate(r.needDate)}</span> },
    {
      key: 'rel', header: 'Relationship', width: '150px',
      render: (r) =>
        r.qualifiers.includes('part_resolution_review') ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setDrawerPart(r.partNumber) }}
            data-open-drawer={r.partNumber}
            className="text-accent-text hover:text-accent focus-visible:ring-ring rounded-md text-xs font-medium focus-visible:ring-2 focus-visible:outline-none"
          >
            {r.relationship} →
          </button>
        ) : (
          <span className="text-muted-foreground text-xs">{r.relationship}</span>
        ),
    },
    {
      key: 'state', header: 'State', width: '190px', pinned: 'right',
      sortValue: (r) => r.coverage,
      render: (r) => (
        <span className="flex flex-col items-end gap-0.5">
          <span className={cn('text-2xs font-medium', COVERAGE_TONE[r.coverage])}>
            {COVERAGE_LABEL[r.coverage]}
          </span>
          {r.qualifiers.length > 0 && (
            <span className="text-muted-foreground text-2xs">
              {r.qualifiers.map((q) => (q === 'blocked' ? 'Blocked' : 'Part resolution')).join(' · ')}
            </span>
          )}
        </span>
      ),
    },
  ], [])

  if (!data) {
    return <div className="mx-auto max-w-[1600px] px-6 py-6"><div className="bg-surface h-64 animate-pulse rounded-lg" /></div>
  }

  const o = data.order

  return (
    <div className="mx-auto grid max-w-[1600px] gap-5 px-6 py-6 xl:grid-cols-[1fr_320px]">
      <div className="flex min-w-0 flex-col gap-5">
        <header className="flex flex-col gap-1">
          <p className="text-muted-foreground eyebrow">Order impact</p>
          <h1 className="font-display text-xl font-semibold">{o.id}</h1>
          <p className="text-muted-foreground text-sm">
            {o.configurationLabel} · quantity {o.quantity} · {o.customer}
          </p>
        </header>

        <ReadinessAxes
          analysedLines={data.analysedLines}
          coverage={data.coverage}
          qualifiers={data.qualifiers}
          active={filter}
          onSelect={(k) => setFilter((f) => (f === k ? null : k))}
        />

        <DataTable
          name="material-lines"
          rows={lines}
          columns={columns}
          rowKey={(r) => r.partNumber}
          maxHeight={520}
          empty="No lines in this selection."
        />

        {post.data && post.data.rows.length > 0 && (
          <section data-card="post-build" className="border-structural-border bg-surface rounded-lg border">
            <header className="border-border border-b px-5 py-3.5">
              <h2 className="text-sm font-semibold">Inventory after fulfilling this order</h2>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {post.data.belowPolicy} components fall below their active policy once this order ships.
              </p>
            </header>
            <ul className="divide-border divide-y">
              {post.data.rows.map((r) => (
                <li key={r.partNumber} className="flex items-center gap-4 px-5 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-xs font-medium">{r.partNumber}</span>
                    <span className="text-muted-foreground block truncate text-2xs">{r.detail}</span>
                  </span>
                  <span className="tabular text-muted-foreground shrink-0 text-xs">
                    {r.positionAfterBuild} / {r.activeTarget}
                  </span>
                  {/* An inert control, on purpose. §23 puts transfer execution
                      on the roadmap, so the row says what is available without
                      offering a button that would not work. */}
                  <span
                    className={cn(
                      'shrink-0 rounded-xs px-2 py-0.5 text-2xs font-medium',
                      r.resolution === 'requisition' && 'bg-accent/10 text-accent-text',
                      r.resolution === 'incoming' && 'bg-verdict-pass-bg text-verdict-pass',
                      r.resolution === 'transfer' && 'border-structural-border text-muted-foreground border border-dashed',
                      r.resolution === 'blocked' && 'bg-muted text-muted-foreground',
                    )}
                  >
                    {r.resolution === 'requisition' ? 'On the requisition'
                      : r.resolution === 'incoming' ? 'Covered by incoming'
                      : r.resolution === 'transfer' ? 'Transfer candidate · roadmap'
                      : 'Blocked'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {proposal.data?.coverageGap && (
          <CoverageGap
            {...proposal.data.coverageGap}
            onOpenAlternatives={() =>
              navigate(`/inventory/plant-a/main/${proposal.data!.coverageGap!.partNumber.toLowerCase()}`)
            }
          />
        )}
      </div>

      {/* Sticky order context and the handoff. */}
      <aside className="flex flex-col gap-4 xl:sticky xl:top-6 xl:self-start">
        <section data-card="order-context" className="border-structural-border bg-surface rounded-lg border p-5">
          <h2 className="text-sm font-semibold">Order</h2>
          <dl className="divide-border mt-3 divide-y text-sm">
            {[
              ['Configuration', o.configurationLabel],
              ['Finished part', o.configurationId],
              ['Quantity', String(o.quantity)],
              ['Site', o.site],
              ['Required ship', formatDate(o.requiredShipDate)],
              ['Readiness', `${Math.round(o.readinessPct * 100)}%`],
              ['Purchase value proposed', `$${data.purchaseValueProposed.toLocaleString()}`],
            ].map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-3 py-2">
                <dt className="text-muted-foreground text-xs">{k}</dt>
                <dd className="tabular text-right text-xs font-medium capitalize">{v}</dd>
              </div>
            ))}
          </dl>
          <Link
            to={`/assemblies/${o.configurationId}`}
            className="border-structural-border hover:bg-hover-tint focus-visible:ring-ring mt-4 flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium focus-visible:ring-2 focus-visible:outline-none"
          >
            <Layers className="size-3.5" aria-hidden />
            Open assembly exposure
          </Link>
        </section>

        <section data-card="trail" className="border-structural-border bg-surface rounded-lg border p-5">
          <h2 className="text-sm font-semibold">Analysis</h2>
          <ol className="mt-3 flex flex-col gap-2.5">
            {data.trail.map((t) => (
              <li key={t.label} className="flex gap-2.5">
                {t.state === 'attention'
                  ? <CircleAlert className="text-sev-high-on-bg mt-0.5 size-3.5 shrink-0" aria-hidden />
                  : <Check className="text-verdict-pass mt-0.5 size-3.5 shrink-0" aria-hidden />}
                <span className="min-w-0">
                  <span className="block text-xs font-medium">{t.label}</span>
                  <span className="text-muted-foreground block text-2xs">{t.detail}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        {proposal.data && (
          <section data-card="handoff" className="ai-surface rounded-lg p-5">
            <h2 className="text-sm font-semibold">Proposed replenishment</h2>
            <p className="text-ai-muted mt-1 text-xs">
              {proposal.data.lines} lines · {proposal.data.suppliers} suppliers ·{' '}
              ${proposal.data.value.toLocaleString()}
            </p>
            <dl className="border-ai-border mt-3 border-t pt-3 text-xs">
              <div className="flex justify-between py-1">
                <dt className="text-ai-muted">Protecting this order</dt>
                <dd className="tabular font-semibold">{proposal.data.protectOrder}</dd>
              </div>
              <div className="flex justify-between py-1">
                <dt className="text-ai-muted">Restoring safety</dt>
                <dd className="tabular font-semibold">{proposal.data.restoreSafety}</dd>
              </div>
              <div className="flex justify-between py-1">
                <dt className="text-ai-muted">Customer orders protected</dt>
                <dd className="tabular font-semibold">{proposal.data.customerOrdersProtected}</dd>
              </div>
            </dl>
            <Button asChild size="sm" className="mt-4 w-full" data-variant="primary">
              <Link to={`/requisitions/${proposal.data.setId.toLowerCase()}`}>
                Review draft requisition
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </Button>
          </section>
        )}
      </aside>

      <PartResolutionDrawer
        requiredPart={drawerPart}
        onClose={() => setDrawerPart(null)}
      />
    </div>
  )
}

/* ── Part resolution ─────────────────────────────────────────────────────── */

const RELATIONSHIP_TONE: Record<string, string> = {
  exact: 'bg-verdict-pass-bg text-verdict-pass',
  approved_substitute: 'bg-sev-high-bg text-sev-high-on-bg',
  superseded: 'bg-muted text-muted-foreground',
  potential_duplicate: 'bg-verdict-ambiguous-bg text-verdict-ambiguous',
  similar_only: 'bg-sev-critical-bg text-sev-critical-on-bg',
}

/**
 * Five identities, and two different reasons for "no button".
 *
 * The similar-description candidate gets no allocation control at all — not a
 * disabled one, none. A greyed-out button invites the question "how do I enable
 * this"; an absent one says the thing is not eligible, which is what §7.4
 * means. Nobody, in any role, can allocate a part whose only claim is that its
 * description reads alike.
 *
 * A candidate awaiting engineering sign-off is a different fact, and the drawer
 * separates the two. It is eligible; the current role simply may not do it. So
 * the control stays on screen inside a gate naming Engineering Approver,
 * because §18 forbids silently hiding a decision gate and the whole content of
 * that moment is *who to go and ask*. Switch role and the same control goes
 * live — which is §20 step 5, and the reason the role switcher exists.
 */
/**
 * Why each held candidate is held, in the planner's terms.
 *
 * The gate names the role; this names the fact. A superseded revision and an
 * unapproved substitute both need the same signature and need it for entirely
 * different reasons, and a single sentence covering both would have to be vague
 * enough to be useless — which is what the first version of this was.
 */
const HELD_REASON: Partial<Record<CandidateRow['relationship'], string>> = {
  superseded:
    'Stock exists, but the revision was superseded — releasing it for a new build is an engineering deviation.',
  approved_substitute:
    'Compatible for this configuration, but the substitution has not been signed off.',
}

function PartResolutionDrawer({
  requiredPart, onClose,
}: { requiredPart: string | null; onClose: () => void }) {
  const qc = useQueryClient()
  const candidates = useQuery({
    queryKey: ['candidates', requiredPart],
    queryFn: () => api.orders.candidates(requiredPart!),
    enabled: !!requiredPart,
  })

  /* Both decisions invalidate the audit as well as the drawer. A
   * part-resolution decision that leaves no trace is what §16.4 exists to
   * prevent, and the audit page is two beats further down the walk. */
  const onDone = (rows: CandidateRow[]) => {
    qc.setQueryData(['candidates', requiredPart], rows)
    qc.invalidateQueries({ queryKey: ['audit'] })
    qc.invalidateQueries({ queryKey: ['order-impact'] })
  }
  const allocate = useMutation({
    mutationFn: (candidate: string) => api.orders.allocate(requiredPart!, candidate),
    onSuccess: onDone,
  })
  const approve = useMutation({
    mutationFn: (candidate: string) => api.orders.approveSubstitute(requiredPart!, candidate),
    onSuccess: onDone,
  })

  /**
   * Return focus to the control that opened this, by identity rather than by
   * reference.
   *
   * Radix restores focus to whatever held it when the dialog opened, which is
   * correct until the trigger is inside something that re-renders — the table
   * rebuilds when the drawer state changes, the original node is replaced, and
   * the stale reference sends focus to the body. §19.1 requires the return, and
   * a keyboard user who loses their place in a 250-row table has lost the page.
   *
   * Looking the trigger up by the part it opened survives the remount.
   */
  /* Held in a ref because the state is already null by the time Radix asks.
   * `onOpenChange` clears `requiredPart` first, so reading the prop inside the
   * close handler finds nothing and the restore silently does not happen —
   * which looks exactly like the bug it was meant to fix. */
  const lastPart = useRef<string | null>(null)
  useEffect(() => {
    if (requiredPart) lastPart.current = requiredPart
  }, [requiredPart])

  const restoreFocus = (e: Event) => {
    const part = lastPart.current
    if (!part) return
    const trigger = document.querySelector<HTMLElement>(`[data-open-drawer="${part}"]`)
    if (trigger) {
      e.preventDefault()
      trigger.focus()
    }
  }

  return (
    <Sheet open={!!requiredPart} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        onCloseAutoFocus={restoreFocus}
        className="w-[500px] max-w-[92vw] overflow-y-auto sm:max-w-[500px]"
      >
        <SheetHeader>
          <SheetTitle>Part resolution</SheetTitle>
          <SheetDescription>
            Candidates against <span className="font-mono">{requiredPart}</span>. Only an exact
            match or a signed-off substitute can be allocated.
          </SheetDescription>
        </SheetHeader>

        <ul className="flex flex-col gap-3 px-4 pb-6">
          {(candidates.data ?? []).map((c: CandidateRow) => (
            <li
              key={c.partNumber}
              className={cn(
                'border-structural-border rounded-lg border p-3.5',
                c.relationship === 'similar_only' && 'opacity-80',
              )}
            >
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-xs font-medium">{c.partNumber}</span>
                <span className={cn('rounded-xs px-1.5 py-0.5 text-2xs font-medium', RELATIONSHIP_TONE[c.relationship])}>
                  {c.relationshipLabel}
                </span>
                <span className="text-muted-foreground ml-auto text-2xs">{c.voltage}</span>
              </div>
              <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">{c.reason}</p>

              <div className="text-muted-foreground mt-2.5 flex items-center gap-4 text-2xs">
                <span className="tabular">{c.available} available</span>
                {c.approvedAt && (
                  <span className="text-verdict-pass">
                    Signed off {formatDate(c.approvedAt)} by {c.approvedBy}
                  </span>
                )}
                {/* Only when there is no gate below to say it better. */}
                {c.requiresApprovalFrom && !c.approvedAt && c.allocatable && (
                  <span className="text-sev-high-on-bg">Needs {c.requiresApprovalFrom}</span>
                )}
              </div>

              {/* Eligible and permitted: a plain control. */}
              {c.allocatable && (
                c.allocated ? (
                  <p className="text-verdict-pass mt-3 flex items-center gap-1.5 text-xs font-medium">
                    <Check className="size-3.5 shrink-0" aria-hidden />
                    Allocated to this position
                  </p>
                ) : (
                  <Button
                    size="xs" variant="outline" className="mt-3"
                    disabled={allocate.isPending}
                    onClick={() => allocate.mutate(c.partNumber)}
                  >
                    {allocate.isPending ? 'Allocating' : 'Allocate this part'}
                  </Button>
                )
              )}

              {/* Eligible, but held pending a sign-off this role does not hold.
                  Shown, refused, and told which role releases it. */}
              {!c.allocatable && c.requiresApprovalFrom && !c.approvedAt && (
                <PermissionGate
                  capability="substitution.approve"
                  className="mt-3"
                  reason={HELD_REASON[c.relationship] ?? `${c.partNumber} needs sign-off before use.`}
                >
                  <Button
                    size="xs" variant="outline"
                    disabled={approve.isPending}
                    onClick={() => approve.mutate(c.partNumber)}
                  >
                    {approve.isPending
                      ? 'Signing off'
                      : c.relationship === 'superseded'
                        ? 'Release against deviation'
                        : 'Approve substitute and allocate'}
                  </Button>
                </PermissionGate>
              )}

              {/* Ineligible by nature — no gate, because there is no approver
                  to name. Absence is the correct answer here and only here. */}
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  )
}
