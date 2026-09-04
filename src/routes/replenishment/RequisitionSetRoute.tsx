import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Check, Mail, Send, ShieldCheck } from 'lucide-react'
import { api } from '@/services'
import type { WriteBackResult, WriteBackFailure } from '@/services'
import { PageHeader } from '@/components/shell/PageHeader'
import { Button } from '@/components/ui/button'
import { CONNECTOR_PROFILE } from '@/app/product'
import { formatDate } from '@/fixtures/calendar'
import { plural } from '@/lib/format'
import { PermissionGate } from '@/components/state/PermissionGate'
import { ErrorState } from '@/components/state/States'

/**
 * Reviewing the set, and writing it back.
 *
 * Three things this screen has to get right, and the first draft of the spec
 * got each of them wrong.
 *
 * **The set is three requisitions, not one.** §13.2 groups by supplier, so a
 * single record spanning three vendors would contradict the rule on the screen
 * that states it.
 *
 * **There is no ERP reference on this page.** The internal draft id is what the
 * route and the header show. References come back from the system of record on
 * write-back and not a moment earlier — displaying one beforehand is the detail
 * that tells an integration-minded reviewer the connection is theatre.
 *
 * **A warning is not a block.** §13.3 disables the primary control on blocking
 * failures. The timing entry records a real finding and does not block, because
 * a requisition that lands after the order it accompanies is still the right
 * requisition.
 */

const STAGE_COPY: Record<string, string> = {
  validating: 'Validating',
  creating: `Creating drafts in ${CONNECTOR_PROFILE.shortName}`,
  created: 'Drafts created',
  email_prepared: 'Approval email prepared',
  email_sent: 'Approval request sent',
}

export function RequisitionSetRoute() {
  const { requisitionId = 'req-demo-0007' } = useParams()
  const id = requisitionId.toUpperCase()
  const qc = useQueryClient()
  const [result, setResult] = useState<WriteBackResult | null>(null)

  /* §13.6's transport failures are presenter-controlled, not random.
   * `?simulate=erp-timeout` and `?simulate=email-failure`. Documented in
   * docs/demo-script.md; absent, the write-back succeeds. */
  const [params] = useSearchParams()
  const simulate = (params.get('simulate') as WriteBackFailure | null) ?? undefined

  const set = useQuery({ queryKey: ['req-set', id], queryFn: () => api.replenishment.set(id) })
  const email = useQuery({ queryKey: ['req-email', id], queryFn: () => api.replenishment.email(id) })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['req-set'] })
    qc.invalidateQueries({ queryKey: ['audit'] })
    qc.invalidateQueries({ queryKey: ['command-center'] })
  }

  const write = useMutation({
    mutationFn: () => api.replenishment.writeBack(id, simulate),
    onSuccess: (r) => { setResult(r); refresh() },
  })

  /* Parking and rejecting are decisions too, and both are recorded. A control
   * that changes nothing and logs nothing teaches a reviewer that the other
   * controls might not either. */
  const park = useMutation({
    mutationFn: (status: 'saved' | 'rejected') => api.replenishment.setStatus(id, status),
    onSuccess: refresh,
  })

  /* The email only. The requisitions above it were accepted and are not
   * touched — that separation is the whole content of FR-021. */
  const retry = useMutation({
    mutationFn: () => api.replenishment.retryEmail(id),
    onSuccess: (r) => { setResult(r); refresh() },
  })

  const s = set.data
  if (!s) return <div className="mx-auto max-w-[1400px] px-6 py-6"><div className="bg-surface h-64 animate-pulse rounded-lg" /></div>

  /* A timed-out write-back issued nothing, so the set is not written and the
   * control must stay live. Reading `!!result` alone would have marked a
   * failure as a success — the exact confusion §13.6 exists to prevent. */
  const succeeded = !!result && result.references.length > 0
  const written = s.status === 'written' || succeeded
  const failed = !!result && result.references.length === 0
  const blocking = s.checks.filter((c) => c.state === 'block')

  return (
    <div className="mx-auto grid max-w-[1600px] gap-5 px-6 py-6 xl:grid-cols-[1fr_360px]">
      <div className="flex min-w-0 flex-col gap-5">
        <PageHeader
          title="Draft requisition set"
          description={`${s.setId} · ${s.site} · ${s.totalLines} lines across ${s.groups.length} suppliers`}
          stats={[
            { label: 'Value', value: `$${s.totalSpend.toLocaleString()}` },
            { label: 'Customer orders protected', value: String(s.customerOrdersProtected) },
            { label: 'Builds protected', value: String(s.buildsProtected) },
            { label: 'Status', value: written ? 'Written back' : 'Ready for review' },
          ]}
        />

        {/* One review screen, three records. */}
        <section data-card="set-records" className="border-structural-border bg-surface rounded-lg border">
          <header className="border-border border-b px-5 py-3.5">
            <h2 className="text-sm font-semibold">Requisitions in this set</h2>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Grouped by supplier, site and currency. Reviewed as one; written back as three.
            </p>
          </header>
          <ul className="divide-border divide-y">
            {s.groups.map((g) => (
              <li key={g.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-5 py-3">
                <span className="font-mono text-xs font-medium">{g.id}</span>
                <span className="text-sm">{g.supplierName}</span>
                <span className="text-muted-foreground tabular ml-auto text-xs">
                  {plural(g.lines.length, 'line')}
                </span>
                <span className="tabular w-24 text-right text-xs font-medium">
                  ${g.spend.toLocaleString()}
                </span>
                <span className="text-muted-foreground w-16 text-right text-2xs">{g.currency}</span>
                <span className="w-32 text-right font-mono text-2xs">
                  {g.externalReference
                    ? <span className="text-verdict-pass">{g.externalReference}</span>
                    : <span className="text-muted-foreground">not yet written</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section data-card="checks" className="border-structural-border bg-surface rounded-lg border">
          <header className="border-border border-b px-5 py-3.5">
            <h2 className="text-sm font-semibold">Validation</h2>
          </header>
          <ul className="divide-border divide-y">
            {s.checks.map((c) => (
              <li key={c.label} className="flex gap-3 px-5 py-2.5">
                {c.state === 'pass' && <Check className="text-verdict-pass mt-0.5 size-3.5 shrink-0" aria-hidden />}
                {c.state === 'warn' && <AlertTriangle className="text-sev-high-on-bg mt-0.5 size-3.5 shrink-0" aria-hidden />}
                {c.state === 'block' && <AlertTriangle className="text-sev-critical mt-0.5 size-3.5 shrink-0" aria-hidden />}
                <span className="min-w-0">
                  <span className="block text-xs font-medium">{c.label}</span>
                  <span className="text-muted-foreground block text-2xs leading-relaxed">{c.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {failed && result && (
          <ErrorState
            title={`${CONNECTOR_PROFILE.shortName} did not respond in time`}
            detail={`No requisition was created and nothing was sent. Your draft is untouched. Correlation ID ${result.correlationId} — quote it to ${CONNECTOR_PROFILE.shortName} support.`}
            onRetry={() => write.mutate()}
          />
        )}
        {succeeded && result && (
          <WriteBackResultPanel
            result={result}
            onRetryEmail={() => retry.mutate()}
            retrying={retry.isPending}
          />
        )}
      </div>

      <aside className="flex flex-col gap-4 xl:sticky xl:top-6 xl:self-start">
        <section data-card="impact" className="border-structural-border bg-surface rounded-lg border p-5">
          <h2 className="text-sm font-semibold">Operational impact</h2>
          <dl className="divide-border mt-3 divide-y text-xs">
            {[
              ['Customer orders protected', String(s.customerOrdersProtected)],
              ['Builds protected', String(s.buildsProtected)],
              ['Safety breaches addressed', `${s.groups.reduce((n, g) => n + g.lines.filter((l) => l.reason === 'restore_safety').length, 0)} of 9`],
              ['Estimated spend', `$${s.totalSpend.toLocaleString()}`],
            ].map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-3 py-2">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="tabular font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
          {/* No counterfactuals. §13.3 forbids "stockouts avoided" without a
              stated baseline, and there is no baseline here worth defending. */}
          <p className="text-muted-foreground border-border mt-3 border-t pt-3 text-2xs leading-relaxed">
            Counted from the lines in this set. No comparison against a
            no-action baseline is claimed.
          </p>
        </section>

        {email.data && (
          <section data-card="email" className="border-structural-border bg-surface rounded-lg border">
            <header className="border-border flex items-center gap-2 border-b px-5 py-3">
              <Mail className="text-muted-foreground size-3.5" aria-hidden />
              <h2 className="text-sm font-semibold">Approval request</h2>
            </header>
            <div className="flex flex-col gap-2 px-5 py-4 text-xs">
              <p className="text-muted-foreground">To: {email.data.to}</p>
              <p className="font-medium leading-snug">{email.data.subject}</p>
              <dl className="border-border mt-1 border-t pt-2">
                {[
                  ['Lines', `${email.data.lines} across ${email.data.suppliers} suppliers`],
                  ['Spend', `$${email.data.spend.toLocaleString()}`],
                  ['Earliest need-by', formatDate(email.data.earliestNeedBy)],
                  ['Orders protected', String(email.data.customerOrdersProtected)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 py-0.5">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="tabular">{v}</dd>
                  </div>
                ))}
              </dl>
              {/* The escalation, surfaced rather than buried. An approval that
                  reads as uniformly green teaches the approver to stop reading. */}
              {email.data.attention && (
                <p className="bg-sev-high-bg text-sev-high-on-bg mt-1 rounded-xs px-3 py-2 leading-relaxed">
                  <b className="block">Needs your attention</b>
                  {email.data.attention}
                </p>
              )}
            </div>
          </section>
        )}

        <section data-card="write-back" className="ai-surface rounded-lg p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-accent-text size-4" aria-hidden />
            <h2 className="text-sm font-semibold">All changes require human approval</h2>
          </div>
          <p className="text-ai-muted mt-1.5 text-xs leading-relaxed">
            {written
              ? `Written back to ${CONNECTOR_PROFILE.shortName}. The approval request has been sent.`
              : `Creates draft requisitions in ${CONNECTOR_PROFILE.shortName} and sends the approval request. No supplier is contacted.`}
          </p>
          {blocking.length > 0 && (
            <p className="text-sev-critical-on-bg mt-2 text-2xs">
              {blocking.length} blocking failure must be resolved first.
            </p>
          )}
          <div className="mt-4 flex flex-col gap-2">
            {/* §5.1 puts draft creation on the Planner alone. Switch to Viewer
                or Engineering Approver and the control stays on screen, refused
                and attributed — §18 forbids hiding a decision gate, and a
                control that vanishes teaches the wrong lesson. */}
            <PermissionGate
              capability="requisition.create"
              reason="Creating draft requisitions is a planning action."
            >
              <Button
                size="sm"
                className="w-full"
                data-variant="primary"
                disabled={!s.canWriteBack || written || write.isPending}
                onClick={() => write.mutate()}
              >
                <Send className="size-3.5" aria-hidden />
                {write.isPending
                  ? STAGE_COPY.creating
                  : written
                    ? 'Written back'
                    : `Create drafts in ${CONNECTOR_PROFILE.shortName}`}
              </Button>
            </PermissionGate>
            <div className="flex gap-2">
              <Button
                size="xs" variant="outline" className="flex-1"
                disabled={written || park.isPending}
                onClick={() => park.mutate('saved')}
              >
                {park.isPending && park.variables === 'saved' ? 'Saving' : 'Save draft'}
              </Button>
              <Button
                size="xs" variant="outline" className="flex-1"
                disabled={written || park.isPending}
                onClick={() => park.mutate('rejected')}
              >
                {park.isPending && park.variables === 'rejected' ? 'Rejecting' : 'Reject'}
              </Button>
            </div>
            {park.isSuccess && !written && (
              <p className="text-muted-foreground text-2xs leading-relaxed">
                {park.variables === 'rejected'
                  ? 'Rejected and recorded. No supplier was contacted.'
                  : 'Saved as a draft and recorded. Nothing was written back.'}
              </p>
            )}
          </div>
        </section>
      </aside>
    </div>
  )
}

function WriteBackResultPanel({ result, onRetryEmail, retrying }: {
  result: WriteBackResult
  onRetryEmail: () => void
  retrying: boolean
}) {
  return (
    <section data-card="write-back-result" className="border-verdict-pass/40 bg-verdict-pass-bg rounded-lg border p-5">
      <div className="flex items-center gap-2">
        <Check className="text-verdict-pass size-4" aria-hidden />
        <h2 className="text-sm font-semibold">Draft requisitions created in {CONNECTOR_PROFILE.shortName}</h2>
      </div>

      {/* The references appear here for the first time, which is the point:
          they are assigned by the system of record, not by us. */}
      <ul className="divide-border/60 mt-3 divide-y">
        {result.references.map((r) => (
          <li key={r.requisitionId} className="flex flex-wrap items-baseline gap-x-4 py-1.5 text-xs">
            <span className="font-mono">{r.requisitionId}</span>
            <span className="text-muted-foreground">→</span>
            <span className="text-verdict-pass font-mono font-semibold">{r.externalReference}</span>
            <span className="text-muted-foreground tabular ml-auto">{r.lines} {r.lines === 1 ? 'line' : 'lines'}</span>
            <span className="tabular w-24 text-right font-medium">${r.spend.toLocaleString()}</span>
          </li>
        ))}
      </ul>

      {result.emailSent ? (
        <p className="text-muted-foreground mt-3 text-2xs leading-relaxed">
          Approval request sent to Procurement Approver (demo).
        </p>
      ) : (
        /* FR-021 and §13.6: the requisitions stand. The email is a separate
           operation with a separate retry, and nothing above this line is rolled
           back — which is why this sits inside the success panel rather than
           replacing it. */
        <div
          data-card="email-retry"
          className="border-sev-high/40 bg-sev-high-bg mt-3 rounded-xs border px-3 py-2.5"
        >
          <p className="text-sev-high-on-bg flex items-center gap-1.5 text-xs font-medium">
            <Mail className="size-3.5 shrink-0" aria-hidden />
            Approval email not sent
          </p>
          <p className="text-muted-foreground mt-1 text-2xs leading-relaxed">
            The {result.references.length} requisitions above were accepted and remain in
            place. Only the notification failed. Correlation ID{' '}
            <span className="font-mono">{result.correlationId}</span>.
          </p>
          <Button
            size="xs" variant="outline" className="mt-2.5"
            disabled={retrying}
            onClick={onRetryEmail}
          >
            {retrying ? 'Sending' : 'Retry approval email'}
          </Button>
        </div>
      )}

      <div className="mt-3 flex gap-3 text-xs">
        <Link to="/audit" className="text-accent-text hover:text-accent font-medium">View audit record</Link>
        <Link to="/replenishment" className="text-accent-text hover:text-accent font-medium">Return to replenishment</Link>
      </div>
    </section>
  )
}
