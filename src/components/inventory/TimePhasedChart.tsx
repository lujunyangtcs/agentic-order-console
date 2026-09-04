import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceArea, ReferenceLine,
} from 'recharts'
import type { ProjectionPoint, ProjectionEvent } from '@/services'
import { formatDate } from '@/fixtures/calendar'
import { cn } from '@/lib/utils'

/**
 * The position over time, with everything that moves it.
 *
 * Six things have to be on one picture and stay legible: what happened, what is
 * projected, the target in force, the recommended range, the events that draw
 * the position down or push it up, and the day it reaches zero.
 *
 * History and forecast are separate series rather than one line with a style
 * change, because §15.6 requires the distinction to survive a black-and-white
 * printout — a dashed forecast does, a lighter shade does not.
 *
 * The horizon is sixty days for a specific reason: it has to exceed the longest
 * confirmed lead time plus a fortnight, or the chart cannot show the receipt of
 * the requisition the demo just raised, which is what it is being opened to
 * show.
 */

export interface TimePhasedChartProps {
  points: ProjectionPoint[]
  events: ProjectionEvent[]
  currentSafety: number | null
  rangeLow: number
  rangeHigh: number
  horizonDays: number
}

const EVENT_STYLE = {
  demand: { colour: 'var(--sev-high)', dash: '4 3' },
  receipt: { colour: 'var(--accent)', dash: '4 3' },
  breach: { colour: 'var(--sev-critical)', dash: undefined },
} as const

export function TimePhasedChart({
  points, events, currentSafety, rangeLow, rangeHigh, horizonDays,
}: TimePhasedChartProps) {
  const [showTable, setShowTable] = useState(false)

  const data = useMemo(
    () => points.map((p) => ({ ...p, label: formatDate(p.date).slice(0, 6) })),
    [points],
  )

  /* A ReferenceArea on a categorical axis needs explicit x bounds — without
   * them recharts has no category to anchor to and renders nothing at all,
   * silently. The band is the only thing on this chart that shows the target is
   * an interval rather than a point, so losing it loses the argument. */
  const firstLabel = data[0]?.label
  const lastLabel = data[data.length - 1]?.label

  return (
    <section data-card="projection" className="border-structural-border bg-surface flex flex-col rounded-lg border">
      <header className="border-border flex flex-wrap items-baseline gap-x-3 border-b px-5 py-3.5">
        <h2 className="text-sm font-semibold">Projected position</h2>
        <span className="text-muted-foreground text-xs">
          30 days of history, {horizonDays} days forward
        </span>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="text-accent-text hover:text-accent focus-visible:ring-ring ml-auto rounded-md text-xs font-medium focus-visible:ring-2 focus-visible:outline-none"
          aria-expanded={showTable}
        >
          {showTable ? 'Hide the numbers' : 'Show the numbers'}
        </button>
      </header>

      <div className="h-64 px-3 pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />

            {/* The recommended range, as a band rather than two lines — the
                target is an interval and drawing it as one says so. */}
            <ReferenceArea
              x1={firstLabel} x2={lastLabel}
              y1={rangeLow} y2={rangeHigh}
              /* The band sits above the default domain when the ceiling is
                 higher than the highest projected point, so the axis has to
                 stretch to it rather than clip it. */
              ifOverflow="extendDomain"
              fill="var(--accent)" fillOpacity={0.1}
              stroke="var(--accent)" strokeOpacity={0.3} strokeDasharray="3 3"
            />

            {currentSafety !== null && (
              <ReferenceLine
                y={currentSafety}
                stroke="var(--muted-foreground)" strokeDasharray="4 4"
                label={{ value: `Target on file ${currentSafety}`, position: 'insideTopLeft',
                         fill: 'var(--muted-foreground)', fontSize: 10 }}
              />
            )}

            <ReferenceLine y={0} stroke="var(--border)" />

            {events.map((e) => (
              <ReferenceLine
                key={`${e.kind}-${e.date}`}
                x={formatDate(e.date).slice(0, 6)}
                stroke={EVENT_STYLE[e.kind].colour}
                strokeDasharray={EVENT_STYLE[e.kind].dash}
                strokeWidth={e.kind === 'breach' ? 1.5 : 1}
              />
            ))}

            <XAxis
              dataKey="label" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
              tickLine={false} axisLine={{ stroke: 'var(--border)' }} interval={13} minTickGap={24}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
              tickLine={false} axisLine={false} width={38}
              /* Snapped to fives. A custom domain switches recharts out of its
                 nice-number tick generation, and an axis reading -8.4 / 6.6 / 33
                 makes a reader do arithmetic to place a value on it. */
              domain={[
                (min: number) => Math.floor(Math.min(min, 0) / 5) * 5,
                (max: number) => Math.ceil(Math.max(max, rangeHigh + 2) / 5) * 5,
              ]}
              label={{ value: 'units', angle: -90, position: 'insideLeft',
                       fill: 'var(--muted-foreground)', fontSize: 10 }}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--surface)', border: '1px solid var(--structural-border)',
                borderRadius: 2, fontSize: 12,
              }}
              formatter={(v: number, n: string) => [v, n === 'actual' ? 'Actual' : 'Projected']}
            />

            <Line
              type="monotone" dataKey="actual" name="actual"
              stroke="var(--foreground)" strokeWidth={2} dot={false} connectNulls={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone" dataKey="forecast" name="forecast"
              stroke="var(--accent)" strokeWidth={2} strokeDasharray="5 4" dot={false}
              connectNulls={false} isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <ul className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-1 px-5 pt-3 pb-1 text-2xs">
        <Legend swatch="var(--foreground)">Actual</Legend>
        <Legend swatch="var(--accent)" dashed>Projected</Legend>
        <Legend swatch="var(--accent)" band>Recommended range {rangeLow}–{rangeHigh}</Legend>
        {events.map((e) => (
          <Legend key={`${e.kind}-${e.date}`} swatch={EVENT_STYLE[e.kind].colour} dashed={e.kind !== 'breach'}>
            {e.label} · {formatDate(e.date)}
          </Legend>
        ))}
      </ul>

      {/* §15.6 — every chart carries a readable alternative. Not a courtesy:
          it is also the fastest way for anyone to check the picture. */}
      {showTable && (
        <div data-x-scroll="projection-table" className="overflow-x-auto overscroll-x-contain px-5 pb-4">
          <table className="mt-2 w-full text-xs" style={{ minWidth: 380 }}>
            <caption className="sr-only">Projected position by date</caption>
            <thead>
              <tr className="border-border text-muted-foreground border-b text-2xs uppercase">
                <th scope="col" className="py-1.5 text-left font-medium">Date</th>
                <th scope="col" className="py-1.5 text-right font-medium">Position</th>
                <th scope="col" className="py-1.5 text-right font-medium">Event</th>
              </tr>
            </thead>
            <tbody>
              {data.filter((_, i) => i % 5 === 0 || events.some((e) => e.date === data[i].date)).map((p) => {
                const ev = events.find((e) => e.date === p.date)
                return (
                  <tr key={p.date} className={cn('border-border border-b last:border-b-0', ev && 'font-medium')}>
                    <td className="tabular py-1">{formatDate(p.date)}</td>
                    <td className="tabular py-1 text-right">{p.actual ?? p.forecast}</td>
                    <td className="text-muted-foreground py-1 text-right">{ev?.label ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function Legend({
  swatch, dashed, band, children,
}: { swatch: string; dashed?: boolean; band?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-1.5">
      <span
        className={cn('inline-block shrink-0', band ? 'h-2.5 w-4 rounded-xs' : 'h-0.5 w-4')}
        style={{
          background: band ? swatch : dashed ? 'none' : swatch,
          opacity: band ? 0.2 : 1,
          borderTop: dashed ? `2px dashed ${swatch}` : undefined,
          border: band ? `1px dashed ${swatch}` : undefined,
        }}
        aria-hidden
      />
      {children}
    </li>
  )
}
