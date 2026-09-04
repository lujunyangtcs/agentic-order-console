import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Layers, Maximize2, Printer } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ExplodedAssemblySheet, SheetStation, PartStatus } from '@/fixtures/assembly/buildSheet'

/**
 * An exploded assembly sheet.
 *
 * Built from a general exploded-view pattern and specialised in five
 * places. Each correction is noted where it lands, because a fork that quietly
 * diverges is worse than no fork.
 *
 * The shape is the skill's and is kept: toolbar outside the SVG, a contained
 * scroll viewport, one focusable group per station, and a footer carrying
 * source, revision and fidelity. Print keeps that footer; the fidelity label is
 * the last thing that should fall off a page.
 */

/** Status is colour **plus** a dash pattern plus a word. §11.8 requires the
 *  sheet to survive grayscale and a printer, and colour is the third channel
 *  rather than the first.
 *
 *  Correction 1 — these were raw hex in the original. They read from tokens
 *  now, so the sheet follows the theme instead of sitting outside it. */
const STATUS_STYLE: Record<PartStatus, { stroke: string; dash?: string }> = {
  normal: { stroke: 'var(--sheet-line)' },
  shortage: { stroke: 'var(--sheet-shortage)' },
  substitute: { stroke: 'var(--sheet-substitute)', dash: '9 5' },
  blocked: { stroke: 'var(--sheet-blocked)', dash: '2 4' },
}

const FIDELITY_LABEL: Record<ExplodedAssemblySheet['fidelity'], string> = {
  authoritative: 'Controlled source',
  hybrid: 'CAD-derived visualization',
  illustrative: 'Concept geometry — not for manufacturing',
}

export interface ExplodedAssemblyViewProps {
  sheet: ExplodedAssemblySheet
  selectedPartId?: string
  onSelectPart?: (station: SheetStation) => void
  /**
   * Correction 2 — the original's `onFullSheet` *replaced* the built-in
   * fit-to-width toggle rather than augmenting it, so passing a handler froze
   * the button label and left `aria-pressed` permanently false. It reports the
   * new state and the toggle still happens.
   */
  onFullSheet?: (fitToWidth: boolean) => void
  onPrint?: () => void
  className?: string
}

export function ExplodedAssemblyView({
  sheet, selectedPartId, onSelectPart, onFullSheet, onPrint, className,
}: ExplodedAssemblyViewProps) {
  const viewport = useRef<HTMLDivElement>(null)
  const [fitToWidth, setFitToWidth] = useState(false)
  const [located, setLocated] = useState(selectedPartId ?? '')
  const [edges, setEdges] = useState<{ left: SheetStation[]; right: SheetStation[] }>({ left: [], right: [] })

  /* Correction 3 — the original seeded its own selection from the prop once and
   * never re-synced, so a parent that cleared the selection left the component
   * still showing one. Controlled when the prop is present, uncontrolled when
   * it is not, and the two never drift. */
  const activeId = selectedPartId ?? located
  useEffect(() => {
    if (selectedPartId !== undefined) setLocated(selectedPartId)
  }, [selectedPartId])

  const active = useMemo(
    () => sheet.stations.find((s) => s.partId === activeId) ?? null,
    [activeId, sheet.stations],
  )

  function select(station: SheetStation) {
    setLocated(station.partId)
    onSelectPart?.(station)
  }

  /* Bring the selected station into the contained viewport — never the page. */
  useEffect(() => {
    if (!active || fitToWidth || !viewport.current) return
    const vp = viewport.current
    const x = (active.x / sheet.width) * vp.scrollWidth
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      || document.documentElement.getAttribute('data-motion') === 'reduce'
    vp.scrollTo({ left: Math.max(0, x - vp.clientWidth / 2), behavior: reduce ? 'auto' : 'smooth' })
  }, [active, fitToWidth, sheet.width])

  /**
   * Correction 4 — off-sheet indication, which the original had none of.
   *
   * §11.8 is blunt about why it matters: a shortage the user cannot see is a
   * shortage the demo failed to surface. Any station carrying a non-normal
   * state that has scrolled out of view is reported on the edge it went out on.
   */
  useEffect(() => {
    const vp = viewport.current
    if (!vp) return
    const measure = () => {
      if (fitToWidth) { setEdges({ left: [], right: [] }); return }
      const scale = vp.scrollWidth / sheet.width
      const from = vp.scrollLeft / scale
      const to = (vp.scrollLeft + vp.clientWidth) / scale
      const flagged = sheet.stations.filter((s) => s.status !== 'normal')
      setEdges({
        left: flagged.filter((s) => s.x + s.bbox.maxX < from),
        right: flagged.filter((s) => s.x + s.bbox.minX > to),
      })
    }
    measure()
    vp.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      vp.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  }, [sheet, fitToWidth])

  function toggleFullSheet() {
    const next = !fitToWidth
    setFitToWidth(next)
    onFullSheet?.(next)
  }

  const locatorId = `${sheet.sheetId}-locator`

  return (
    <section
      data-print-sheet
      className={cn('border-structural-border bg-sheet-surround overflow-hidden rounded-lg border', className)}
    >
      <header
        data-print-hide
        className="border-border bg-surface flex flex-wrap items-center gap-3 border-b px-4 py-2.5"
      >
        <Layers className="text-tenant-accent size-4 shrink-0" aria-hidden />
        <div className="mr-auto min-w-0">
          <h3 data-sheet-title className="truncate text-sm font-semibold">
            {sheet.sheetId} rev {sheet.revision} · {sheet.title}
          </h3>
          <p data-fidelity className="text-muted-foreground truncate text-2xs">
            {FIDELITY_LABEL[sheet.fidelity]}
          </p>
        </div>

        {/* Correction 5 — the original used a dark filled native select that
            sat outside the app's own controls. Same element, house styling:
            a native select is genuinely the most accessible thing here and
            swapping it for a custom listbox would be a downgrade. */}
        <label htmlFor={locatorId} className="sr-only">Locate a component</label>
        <select
          id={locatorId}
          value={activeId}
          onChange={(e) => {
            const s = sheet.stations.find((st) => st.partId === e.target.value)
            if (s) select(s)
          }}
          className="border-border bg-surface focus-visible:ring-ring h-8 min-w-52 rounded-md border px-2 text-xs focus-visible:ring-2 focus-visible:outline-none"
        >
          <option value="">Locate component</option>
          {sheet.stations.map((s) => (
            <option key={s.partId} value={s.partId}>
              {s.station}. {s.label} · {s.partId}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={toggleFullSheet}
          aria-pressed={fitToWidth}
          className="border-border hover:bg-hover-tint focus-visible:ring-ring flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs focus-visible:ring-2 focus-visible:outline-none"
        >
          <Maximize2 className="size-3.5" aria-hidden />
          {fitToWidth ? 'Actual size' : 'Full sheet'}
        </button>

        {/* What the viewport is hiding — in the toolbar, not floating over the
            drawing.
            
            These began as badges pinned to the scroll viewport's edges, and
            that cannot be made to work: content scrolls *beneath* a floating
            element, so whatever position it takes, some station passes under it
            at some offset. Centred it covered the dashed substitute; at the top
            it clipped a station number; reserving gutters either side cost 208
            pixels of drawing at 1440 and still could not fit the label.
            
            The admission is the point, not the anchoring. Here it is legible at
            every scroll position, costs no drawing width, and the chevron keeps
            the direction. */}
        {(['left', 'right'] as const).map((side) =>
          edges[side].length ? (
            <button
              key={side}
              type="button"
              onClick={() => select(edges[side][0])}
              title={`${edges[side].length} flagged ${edges[side].length === 1 ? 'station is' : 'stations are'} off sheet to the ${side}`}
              className="border-border hover:bg-hover-tint focus-visible:ring-ring flex h-8 items-center gap-1.5 rounded-xs border px-2.5 text-2xs font-medium focus-visible:ring-2 focus-visible:outline-none"
            >
              {side === 'left' && <ChevronLeft className="size-3.5 shrink-0" aria-hidden />}
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{ background: STATUS_STYLE[edges[side][0].status].stroke }}
                aria-hidden
              />
              {edges[side].length} off sheet
              {side === 'right' && <ChevronRight className="size-3.5 shrink-0" aria-hidden />}
            </button>
          ) : null,
        )}

        <button
          type="button"
          onClick={() => (onPrint ? onPrint() : window.print())}
          aria-label="Print sheet"
          className="border-border hover:bg-hover-tint focus-visible:ring-ring flex size-8 items-center justify-center rounded-xs border focus-visible:ring-2 focus-visible:outline-none"
        >
          <Printer className="size-3.5" aria-hidden />
        </button>
      </header>

      <div className="relative">
        <div
          ref={viewport}
          data-x-scroll="assembly-sheet"
          className="bg-sheet-surface max-w-full overflow-x-auto overscroll-x-contain"
        >
          <svg
            data-print-drawing
            role="img"
            viewBox={`0 0 ${sheet.width} ${sheet.height}`}
            preserveAspectRatio="xMidYMid meet"
            style={{
              width: fitToWidth ? '100%' : sheet.width,
              minWidth: fitToWidth ? 0 : sheet.width,
              height: fitToWidth ? 'auto' : sheet.height,
              /* The print stylesheet forces `width: 100%; height: auto`, and on
               * an inline SVG that resolves to a height of zero — the drawing
               * printed as an empty band. A viewBox is not an intrinsic ratio;
               * this is. */
              aspectRatio: `${sheet.width} / ${sheet.height}`,
            }}
            className="block"
          >
            <title>{`${sheet.sheetId} — ${sheet.title}`}</title>
            <desc>
              {`Exploded assembly, ${sheet.stations.length} numbered stations along a horizontal centreline. ` +
               `${FIDELITY_LABEL[sheet.fidelity]}.`}
            </desc>

            <rect x={0} y={0} width={sheet.width} height={sheet.height} fill="var(--sheet-surface)" />

            {/* The optical axis. Dash-dot, the way a drawing does it. */}
            <line
              x1={16} y1={sheet.centerlineY} x2={sheet.width - 16} y2={sheet.centerlineY}
              stroke="var(--sheet-centerline)" strokeWidth={1}
              strokeDasharray="18 5 3 5" vectorEffect="non-scaling-stroke"
            />

            {sheet.stations.map((st) => {
              const style = STATUS_STYLE[st.status]
              const selected = st.partId === activeId
              /* Correction 6 — the halo was a fixed rx=70 ry=82 that covered
                 about half of a wide station and swallowed a narrow one. It is
                 derived from the station's own bounds now. */
              const w = st.bbox.maxX - st.bbox.minX
              const h = st.bbox.maxY - st.bbox.minY
              const cx = (st.bbox.minX + st.bbox.maxX) / 2
              const cy = (st.bbox.minY + st.bbox.maxY) / 2
              return (
                <g
                  key={st.partId}
                  role="button"
                  tabIndex={0}
                  aria-label={
                    `${st.station}. ${st.label}, ${st.partId}` +
                    (st.statusLabel ? `, ${st.statusLabel}` : '')
                  }
                  onClick={() => select(st)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(st) }
                  }}
                  className="cursor-pointer outline-none focus-visible:[filter:drop-shadow(0_0_3px_var(--ring))]"
                >
                  {selected && (
                    <ellipse
                      cx={st.x + cx} cy={st.y + cy}
                      rx={w / 2 + 22} ry={h / 2 + 20}
                      fill="var(--sheet-selected)"
                    />
                  )}

                  <line
                    x1={st.x} y1={44} x2={st.x} y2={st.y + st.bbox.minY - 8}
                    stroke="var(--sheet-centerline)" strokeWidth={1} vectorEffect="non-scaling-stroke"
                  />
                  <circle cx={st.x} cy={30} r={15} fill="var(--sheet-surface)" stroke="var(--sheet-line)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
                  <text x={st.x} y={35} textAnchor="middle" className="fill-foreground" style={{ fontSize: 15, fontWeight: 600 }}>
                    {st.station}
                  </text>

                  <g
                    transform={`translate(${st.x} ${st.y})`}
                    stroke={style.stroke}
                    strokeWidth={selected ? 2.2 : 1.5}
                    strokeDasharray={style.dash}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  >
                    {(st.shapes as Shape[]).map((s, i) => renderShape(s, i))}
                  </g>

                  {st.statusLabel && (
                    <text
                      x={st.x} y={sheet.height - 22} textAnchor="middle"
                      fill={style.stroke} style={{ fontSize: 12, fontWeight: 600 }}
                    >
                      {st.statusLabel}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        </div>

      </div>

      <footer className="border-border text-muted-foreground flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-2xs">
        <span>{sheet.source.label}</span>
        <span>{sheet.manufacturingUse ? 'Controlled manufacturing source' : 'Not for manufacturing use'}</span>
      </footer>
    </section>
  )
}

type Shape =
  | { kind: 'path'; d: string; fill?: string }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; fill?: string }
  | { kind: 'rect'; x: number; y: number; width: number; height: number; rx?: number; fill?: string }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number }

/* Line weight stays 1.5px whatever the sheet is scaled to — a drawing whose
 * strokes thicken when you zoom stops reading as a drawing. */
const V = { vectorEffect: 'non-scaling-stroke' } as const

function renderShape(s: Shape, i: number) {
  switch (s.kind) {
    case 'ellipse':
      return <ellipse key={i} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} fill={s.fill ?? 'none'} {...V} />
    case 'rect':
      return <rect key={i} x={s.x} y={s.y} width={s.width} height={s.height} rx={s.rx} fill={s.fill ?? 'none'} {...V} />
    case 'line':
      return <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} {...V} />
    case 'path':
      return <path key={i} d={s.d} fill={s.fill ?? 'none'} {...V} />
  }
}
