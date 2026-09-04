import { useState } from 'react'
import { useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services'
import type { StationExposure } from '@/services'
import { ExplodedAssemblyView } from '@/components/assembly/ExplodedAssemblyView'
import type { ExplodedAssemblySheet } from '@/fixtures/assembly/buildSheet'
import { PageHeader } from '@/components/shell/PageHeader'
import { SourceCaveat } from '@/components/state/SourceCaveat'
import { formatDate } from '@/fixtures/calendar'
import { cn } from '@/lib/utils'

/**
 * Assembly Exposure.
 *
 * This is the screen the product is for. Everything else in the demo is a
 * planning surface that other products also have; this is the one that answers
 * the sentence the customer's own introduction used — two to three hundred parts,
 * a dozen variants, a nightmare.
 *
 * The sheet shows what is wrong with *this* build. The rail beside it shows the
 * thing no product structure shows: how many configurations draw this component,
 * how many of them have live orders, and what that sums to. A planner can read
 * the first from an ERP. The second is why they are talking to us.
 */

const HERO_STATION = 'ABC-1001'

export function AssemblyRoute() {
  const { configurationId = 'ABC-6107' } = useParams()
  const [selected, setSelected] = useState<string>(HERO_STATION)

  const sheet = useQuery({
    queryKey: ['assembly-sheet', configurationId],
    queryFn: () => api.assembly.sheet(configurationId) as Promise<ExplodedAssemblySheet>,
  })
  const summary = useQuery({
    queryKey: ['assembly-summary', configurationId],
    queryFn: () => api.assembly.summary(configurationId),
  })
  const exposure = useQuery({
    queryKey: ['assembly-exposure', configurationId, selected],
    queryFn: () => api.assembly.exposure(configurationId, selected),
    enabled: !!selected,
  })

  const s = summary.data

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-6 py-6">
      <PageHeader
        title="Assembly Exposure"
        description="Every component position, its state on this build, and what else draws on it."
        stats={[
          { label: 'Stations', value: s ? String(s.stations) : '—' },
          { label: 'Short', value: s ? String(s.shortage) : '—', tone: s?.shortage ? 'attention' : undefined },
          { label: 'Substitute proposed', value: s ? String(s.substitute) : '—' },
          /* The sheet's four states cannot show this one, so the header does.
             A count that exists but has nowhere to appear is a count that gets
             quietly dropped. */
          { label: 'Below policy after build', value: s ? String(s.belowSafetyAfterBuild) : '—' },
          { label: 'Blocked', value: s ? String(s.blocked) : '—' },
        ]}
      />

      {/* The exposure argument on this page rests on the structure being right.
          Saying where the structure came from is not a disclaimer — it is the
          first question an engineering reviewer will ask. */}
      <SourceCaveat
        connectorId="bom"
        consequence="Structures and revisions here are demo fixtures, not engineering-confirmed — substitution and effectivity evidence would come from that source."
      />

      {sheet.data ? (
        <ExplodedAssemblyView
          sheet={sheet.data}
          selectedPartId={selected}
          onSelectPart={(st) => setSelected(st.partId)}
        />
      ) : (
        <div className="border-structural-border bg-surface h-80 animate-pulse rounded-lg border" />
      )}

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <ExposureRail data={exposure.data ?? null} />
        <StationList
          sheet={sheet.data ?? null}
          selected={selected}
          onSelect={setSelected}
        />
      </div>
    </div>
  )
}

/* ── The rail ────────────────────────────────────────────────────────────── */

function ExposureRail({ data }: { data: StationExposure | null }) {
  if (!data) {
    return (
      <section className="border-structural-border bg-surface rounded-lg border p-5">
        <p className="text-muted-foreground text-sm">Select a station to see what draws on it.</p>
      </section>
    )
  }

  const withOrders = data.rows.filter((r) => r.liveOrders > 0)

  return (
    <section data-card="exposure-rail" className="border-structural-border bg-surface flex flex-col rounded-lg border">
      <header className="border-border border-b px-5 py-4">
        <p className="text-muted-foreground eyebrow">Station {data.station}</p>
        <h2 className="mt-1 flex flex-wrap items-baseline gap-2">
          <span className="font-mono text-base font-semibold">{data.partId}</span>
          <span className="text-muted-foreground text-sm">{data.label}</span>
        </h2>
        <p className="text-muted-foreground mt-1.5 text-xs capitalize">
          {data.criticality} · {data.status} · {data.location}
        </p>
      </header>

      {/* The headline. One sentence, three numbers, and the third is the one
          that does not exist anywhere else. */}
      <div className="border-border bg-tenant-accent-tint border-b px-5 py-4">
        <p className="text-sm leading-relaxed">
          Consumed by{' '}
          <b className="tabular">{data.configurationCount} of {data.rows.length + data.notUsedBy.length}</b>{' '}
          configurations.{' '}
          <b className="tabular">{data.configurationsWithOrders}</b> of them
          {' '}{data.configurationsWithOrders === 1 ? 'holds' : 'hold'}{' '}
          <b className="tabular">
            {data.liveOrders} live {data.liveOrders === 1 ? 'order' : 'orders'}
          </b>, for{' '}
          <b className="tabular">{data.forwardDemand} units</b> of forward demand.
        </p>
        <p className="text-tenant-accent-text mt-1.5 text-xs">
          A figure no single product structure shows.
        </p>
      </div>

      {/* Completeness is the job here, so the matrix is never truncated. */}
      <div data-x-scroll="exposure-matrix" className="overflow-x-auto overscroll-x-contain">
        <table className="w-full text-sm" style={{ minWidth: 460 }}>
          <thead>
            <tr className="border-border text-muted-foreground border-b text-2xs uppercase">
              <th scope="col" className="px-5 py-2 text-left font-medium">Configuration</th>
              <th scope="col" className="px-3 py-2 text-left font-medium">Part</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Live orders</th>
              <th scope="col" className="px-5 py-2 text-right font-medium">Demand</th>
            </tr>
          </thead>
          <tbody>
            {[...withOrders, ...data.rows.filter((r) => r.liveOrders === 0)].map((r) => (
              <tr key={r.configurationId} className={cn('border-border border-b', r.liveOrders > 0 && 'bg-tenant-accent-tint/40')}>
                <td className="px-5 py-1.5">{r.label}</td>
                <td className="text-muted-foreground px-3 py-1.5 font-mono text-xs">{r.finishedPart ?? '—'}</td>
                <td className="tabular px-3 py-1.5 text-right">{r.liveOrders || '—'}</td>
                <td className="tabular px-5 py-1.5 text-right font-medium">{r.demand || '—'}</td>
              </tr>
            ))}
            {data.notUsedBy.map((r) => (
              <tr key={r.configurationId} className="border-border text-muted-foreground border-b">
                <td className="px-5 py-1.5">{r.label}</td>
                <td className="px-3 py-1.5 text-xs italic">
                  {r.orderable ? 'does not use this part' : 'not orderable'}
                </td>
                <td className="px-3 py-1.5 text-right">—</td>
                <td className="px-5 py-1.5 text-right">—</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* The position this order leaves behind, which is a different question
          from what it consumes. */}
      <dl className="divide-border grid grid-cols-2 divide-x">
        <div className="divide-border divide-y">
          <Row label="Required by this order" value={data.required} />
          <Row label="Available now" value={data.available} />
        </div>
        <div className="divide-border divide-y">
          <Row label="Position after this build" value={data.positionAfterBuild} />
          <Row
            label="Projected zero"
            value={data.projectedZero ? formatDate(data.projectedZero) : 'no residual draw'}
          />
        </div>
      </dl>
    </section>
  )
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-5 py-2.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="tabular text-sm font-semibold">{value}</dd>
    </div>
  )
}

/* ── The fallback list ───────────────────────────────────────────────────── */

const STATE_LABEL: Record<string, string> = {
  normal: 'Covered',
  shortage: 'Shortage',
  substitute: 'Proposed substitute',
  blocked: 'Blocked',
}

/* The `-on-bg` variants, not the ramp colours.
 *
 * The severity ramp is tuned for glyphs and fills — amber at #d97706 measures
 * 3.19:1 as 11px text, which fails AA. The darkened siblings exist for exactly
 * this and clear 4.5 on white. The sheet's own strokes keep the ramp, because
 * a 1.5px line is a graphic rather than text. */
const STATE_TONE: Record<string, string> = {
  normal: 'text-muted-foreground',
  shortage: 'text-sev-critical-on-bg',
  substitute: 'text-sev-high-on-bg',
  blocked: 'text-foreground',
}

/**
 * The same identities and states as the sheet, as a list.
 *
 * Not a courtesy. §11.8 requires a fallback that carries identical identity and
 * status, and it is also the fastest way for anyone to check that the drawing
 * is telling the truth.
 */
function StationList({
  sheet, selected, onSelect,
}: {
  sheet: ExplodedAssemblySheet | null
  selected: string
  onSelect: (partId: string) => void
}) {
  return (
    <section data-card="station-list" className="border-structural-border bg-surface flex flex-col rounded-lg border">
      <header className="border-border border-b px-5 py-4">
        <h2 className="text-sm font-semibold">Stations</h2>
        <p className="text-muted-foreground mt-0.5 text-xs">
          The same identities and states as the sheet.
        </p>
      </header>
      <ul className="divide-border flex-1 divide-y overflow-y-auto" style={{ maxHeight: 520 }}>
        {(sheet?.stations ?? []).map((st) => (
          <li key={st.partId}>
            <button
              type="button"
              onClick={() => onSelect(st.partId)}
              aria-current={st.partId === selected}
              className={cn(
                'hover:bg-hover-tint focus-visible:ring-ring flex w-full items-center gap-3 px-5 py-2 text-left',
                'focus-visible:ring-2 focus-visible:outline-none',
                st.partId === selected && 'bg-tenant-accent-tint',
              )}
            >
              <span className="text-muted-foreground tabular w-5 shrink-0 text-xs">{st.station}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{st.label}</span>
                <span className="text-muted-foreground block truncate font-mono text-2xs">{st.partId}</span>
              </span>
              <span className={cn('shrink-0 text-2xs font-medium', STATE_TONE[st.status])}>
                {STATE_LABEL[st.status]}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
