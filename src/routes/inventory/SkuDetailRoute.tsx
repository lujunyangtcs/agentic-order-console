import { Link, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Layers, Mail, PackageCheck } from 'lucide-react'
import { api } from '@/services'
import type { SkuDetail, Alternative } from '@/services'
import { DriverWaterfall } from '@/components/inventory/DriverWaterfall'
import { TimePhasedChart } from '@/components/inventory/TimePhasedChart'
import { formatDate, formatDateTime } from '@/fixtures/calendar'
import { cn } from '@/lib/utils'

/**
 * One SKU, and why the recommendation is what it is.
 *
 * Flow 2 opens here after flow 1 has already put this part on a requisition, so
 * the page has to say so. §13.2 requires open requisitions to be netted, and a
 * screen that recommended buying something already bought would be breaking the
 * rule its own engine obeys.
 */

export function SkuDetailRoute() {
  const { site = 'plant-a', warehouse = 'main', sku = 'ABC-1001' } = useParams()
  const detail = useQuery({
    queryKey: ['sku', site, warehouse, sku],
    queryFn: () => api.inventory.detail(site, warehouse, sku.toUpperCase()),
  })

  const d = detail.data
  if (!d) {
    return <div className="mx-auto max-w-[1600px] px-6 py-6"><div className="bg-surface h-64 animate-pulse rounded-lg" /></div>
  }

  return (
    <div className="mx-auto grid max-w-[1600px] gap-5 px-6 py-6 xl:grid-cols-[1fr_360px]">
      <div className="flex min-w-0 flex-col gap-5">
        <header className="flex flex-col gap-1.5">
          <p className="text-muted-foreground eyebrow">Inventory intelligence</p>
          <h1 className="font-display flex flex-wrap items-baseline gap-3 text-xl font-semibold">
            <span className="font-mono">{d.partNumber}</span>
            <span className="text-muted-foreground text-base font-normal">{d.description}</span>
          </h1>
          <p className="text-muted-foreground text-sm">
            {d.criticality} · {d.site} / {d.warehouse}
          </p>
        </header>

        {/* Already on a requisition, said before anything else is recommended. */}
        {d.onRequisition && (
          <div className="border-verdict-pass/40 bg-verdict-pass-bg flex flex-wrap items-center gap-3 rounded-xs border px-4 py-3 text-xs">
            <PackageCheck className="text-verdict-pass size-4 shrink-0" aria-hidden />
            <span>
              Already on <Link to={`/requisitions/${d.onRequisition.setId.toLowerCase()}`} className="font-mono font-medium underline">{d.onRequisition.setId}</Link>
              {' '}— {d.onRequisition.quantity} units arriving {formatDate(d.onRequisition.arrives)}.
              Netted from any further recommendation.
            </span>
          </div>
        )}

        <PolicyComparison detail={d} />

        <DriverWaterfall
          drivers={d.drivers}
          total={d.driversTotal}
          currentSafety={d.currentSafety}
        />

        <TimePhasedChart
          points={d.projection}
          events={d.events}
          currentSafety={d.currentSafety}
          rangeLow={d.rangeLow}
          rangeHigh={d.rangeHigh}
          horizonDays={d.horizonDays}
        />

        <AlternativesPanel alternatives={d.alternatives} />
      </div>

      <aside className="flex flex-col gap-4 xl:sticky xl:top-6 xl:self-start">
        {d.exposure && <ExposureStrip detail={d} />}
        {d.evidence && <EvidencePanel evidence={d.evidence} />}
      </aside>
    </div>
  )
}

/* ── Policy ──────────────────────────────────────────────────────────────── */

function PolicyComparison({ detail: d }: { detail: SkuDetail }) {
  return (
    <section data-card="policy" className="border-structural-border bg-surface rounded-lg border p-5">
      <h2 className="text-sm font-semibold">Safety policy</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-4">
        {[
          { k: 'Target on file', v: d.currentSafety === null ? 'not maintained' : String(d.currentSafety),
            note: d.currentSafety === null ? 'no parameter held' : 'in the system of record' },
          { k: 'Recommended', v: String(d.recommendedSafety), note: `range ${d.rangeLow}–${d.rangeHigh}` },
          { k: 'Coverage', v: d.coverageDays ? `${d.coverageDays} days` : '—',
            note: `at ${d.averageDailyUsage}/day` },
          /* A band, and the percentage beside it as supporting detail rather
             than as the headline — §7.2 forbids a bare percentage standing in
             for a confidence, because two other quantities on this page are
             also percentages and none of them mean the same thing. */
          { k: 'Confidence', v: d.confidence, note: `${Math.round(d.confidencePct * 100)}% of inputs current`, cap: true },
        ].map((x) => (
          <div key={x.k}>
            <p className="text-muted-foreground eyebrow">{x.k}</p>
            <p className={cn('font-display tabular mt-1 text-xl font-semibold', x.cap && 'capitalize')}>{x.v}</p>
            <p className="text-muted-foreground mt-0.5 text-2xs">{x.note}</p>
          </div>
        ))}
      </div>
      <dl className="border-border text-muted-foreground mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t pt-3 text-xs">
        {[['On hand', d.onHand], ['Allocated', d.allocated], ['Available', d.available]].map(([k, v]) => (
          <div key={String(k)} className="flex gap-1.5">
            <dt>{k}</dt>
            <dd className="tabular text-foreground font-medium">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/* ── Exposure ────────────────────────────────────────────────────────────── */

/**
 * Twelve ticks, not a second matrix.
 *
 * The complete matrix already exists on the Assembly Exposure view, and
 * building another one here would split the demo's strongest beat across two
 * screens. This is a glyph: one tick per configuration, filled when the part is
 * consumed, dotted when that configuration has live orders, hollow for the row
 * nobody can order. It says why the scalar in the table is 3 while the sentence
 * says 11.
 */
function ExposureStrip({ detail: d }: { detail: SkuDetail }) {
  const ex = d.exposure!
  const all = [...ex.rows, ...ex.notUsedBy]
  return (
    <section data-card="exposure-strip" className="border-structural-border bg-surface rounded-lg border p-5">
      <h2 className="text-sm font-semibold">Variant exposure</h2>
      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
        Consumed by <b className="text-foreground">{ex.configurationCount} of {all.length}</b> configurations.{' '}
        <b className="text-foreground">{ex.configurationsWithOrders}</b> of them hold{' '}
        <b className="text-foreground">
          {ex.liveOrders} live {ex.liveOrders === 1 ? 'order' : 'orders'}
        </b>, for <b className="text-foreground">{ex.forwardDemand} units</b> of forward demand.
      </p>

      <div className="mt-3 flex gap-1" role="img" aria-label={`${ex.configurationCount} of ${all.length} configurations consume this part`}>
        {all.map((r) => (
          <span
            key={r.configurationId}
            title={`${r.label}${r.quantityPer ? '' : r.orderable ? ' — does not use this part' : ' — not orderable'}${r.liveOrders ? ` · ${r.liveOrders} live orders` : ''}`}
            className={cn(
              'h-6 flex-1 rounded-xs',
              r.quantityPer === 0
                ? 'border-structural-border border border-dashed'
                : r.liveOrders > 0
                  ? 'bg-tenant-accent'
                  : 'bg-tenant-accent/25',
            )}
          />
        ))}
      </div>
      <p className="text-muted-foreground mt-2 text-2xs">
        Filled — consumed. Solid — live orders. Dashed — not used, or not orderable.
      </p>

      <Link
        to={`/assemblies/ABC-6107`}
        className="border-structural-border hover:bg-hover-tint focus-visible:ring-ring mt-4 flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium focus-visible:ring-2 focus-visible:outline-none"
      >
        <Layers className="size-3.5" aria-hidden />
        Open the full matrix
      </Link>
    </section>
  )
}

/* ── Evidence ────────────────────────────────────────────────────────────── */

function EvidencePanel({ evidence: e }: { evidence: NonNullable<SkuDetail['evidence']> }) {
  const delta = Math.round(((e.claimedLeadTimeDays - e.leadTimeOnFile) / e.leadTimeOnFile) * 100)
  return (
    <section data-card="evidence" className="border-structural-border bg-surface rounded-lg border">
      <header className="border-border flex items-center gap-2 border-b px-5 py-3">
        <Mail className="text-muted-foreground size-3.5" aria-hidden />
        <h2 className="text-sm font-semibold">Supplier evidence</h2>
      </header>
      <div className="flex flex-col gap-3 px-5 py-4 text-xs">
        <div className="flex items-baseline gap-3">
          <span className="text-muted-foreground">On file</span>
          <span className="tabular font-medium">{e.leadTimeOnFile} days</span>
          <span className="text-muted-foreground">→</span>
          <span className="text-muted-foreground">Confirmed</span>
          <span className="tabular font-semibold">{e.claimedLeadTimeDays} days</span>
          <span className={cn('ml-auto rounded-xs px-1.5 py-0.5 text-2xs font-medium',
            delta > 0 ? 'bg-sev-high-bg text-sev-high-on-bg' : 'bg-verdict-pass-bg text-verdict-pass')}>
            {delta > 0 ? '+' : ''}{delta}%
          </span>
        </div>

        <p className="text-muted-foreground">{e.supplier} · {formatDateTime(e.receivedAt)}</p>
        <p className="font-medium">{e.subject}</p>
        <blockquote className="border-structural-border text-muted-foreground border-l-2 pl-3 leading-relaxed italic">
          {e.excerpt}
        </blockquote>

        {/* Named separately, because two other percentages on this page are not
            this one. §7.2 is explicit that the three must never share a label. */}
        <dl className="border-border border-t pt-2">
          <div className="flex justify-between gap-3 py-0.5">
            <dt className="text-muted-foreground">Email extraction reliability</dt>
            <dd className="tabular font-medium">{Math.round(e.extractionReliability * 100)}%</dd>
          </div>
          <div className="flex justify-between gap-3 py-0.5">
            <dt className="text-muted-foreground">Confirmation</dt>
            <dd className={cn('font-medium', e.needsConfirmation && 'text-sev-high-on-bg')}>
              {e.confirmedBy ?? 'Needs confirmation'}
            </dd>
          </div>
        </dl>

        {e.needsConfirmation ? (
          <p className="bg-sev-high-bg text-sev-high-on-bg rounded-xs px-3 py-2 leading-relaxed">
            Below the reliability floor, or unconfirmed. This cannot support an
            approved requisition until a human confirms it.
          </p>
        ) : (
          <p className="text-verdict-pass flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5" aria-hidden />
            Confirmed by {e.confirmedBy}
          </p>
        )}
      </div>
    </section>
  )
}

/* ── Alternatives ────────────────────────────────────────────────────────── */

/**
 * Ranked, explained, and none of them executed.
 *
 * Two of the four are on the roadmap rather than in the product, and they say
 * so rather than offering a control that would fail. A demo that resolves a
 * problem with a mechanism it does not have has made a promise somebody will
 * try to collect on.
 */
function AlternativesPanel({ alternatives }: { alternatives: Alternative[] }) {
  return (
    <section data-card="alternatives" className="border-structural-border bg-surface rounded-lg border">
      <header className="border-border border-b px-5 py-3.5">
        <h2 className="text-sm font-semibold">Alternatives</h2>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Ranked by effect. Nothing here executes without an approver.
        </p>
      </header>
      <ol className="divide-border divide-y">
        {alternatives.map((a) => (
          <li key={a.rank} className="grid gap-2 px-5 py-3 sm:grid-cols-[1.6fr_1fr_0.8fr_1fr] sm:items-baseline">
            <div className="flex gap-2.5">
              <span className="text-muted-foreground tabular text-xs">{a.rank}</span>
              <span className="min-w-0">
                <span className="block text-xs font-medium">{a.label}</span>
                <span className="text-muted-foreground block text-2xs">{a.impact}</span>
                {a.note && (
                  <span className="text-muted-foreground mt-0.5 block text-2xs italic">{a.note}</span>
                )}
              </span>
            </div>
            <span className="text-muted-foreground text-2xs sm:text-right">{a.costDelta}</span>
            <span className="text-muted-foreground text-2xs sm:text-right">{a.time}</span>
            <span className="flex items-center gap-2 sm:justify-end">
              <span className="text-muted-foreground text-2xs">{a.requiredApprover}</span>
              {!a.actionable && (
                <span className="border-structural-border text-muted-foreground rounded-xs border border-dashed px-1.5 py-0.5 text-2xs">
                  roadmap
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
