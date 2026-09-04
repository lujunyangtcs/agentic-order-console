import type { BBox } from '@/lib/assembly/geometry'
import { BLUEPRINTS } from './blueprints'
import { STATIONS, stationPart } from '../parts'
import { CONFIGURATIONS, voltageGroup } from '../configurations'
import { explodeOrder, exposureOf, type ComponentLine } from '../derive'
import { HERO_ORDER } from '../orders'

/**
 * Turn a configuration into an exploded sheet.
 *
 * ## Two things shape this
 *
 * **A station is not a BOM line.** The structure has 250 lines; the sheet has
 * seventeen stations. A station is a component position a planner reasons
 * about, and its state is a roll-up of what sits beneath it. Every mapping
 * below is a roll-up rule, not a projection.
 *
 * **The sheet stays geometry.** The fidelity rules are explicit that business
 * status is a separate data overlay and does not change geometry authority, so
 * exposure figures, live-order counts and stock positions do not go into the
 * sheet — they come back beside it, keyed by part. Putting them in the sheet
 * would make it the wrong shape for the validator's intent and would couple a
 * drawing to an order book.
 *
 * One additive field is the exception: each station carries a `bbox`. The
 * validator ignores unknown keys, and both the selection halo and the
 * off-sheet edge markers need bounds that a hand-written path cannot supply.
 */

export type PartStatus = 'normal' | 'shortage' | 'substitute' | 'blocked'

export interface SheetStation {
  station: number
  partId: string
  label: string
  x: number
  y: number
  status: PartStatus
  statusLabel?: string
  shapes: unknown[]
  /** Additive, validator-safe. Bounds for the halo and the edge markers. */
  bbox: BBox
}

export interface ExplodedAssemblySheet {
  sheetId: string
  revision: string
  title: string
  fidelity: 'authoritative' | 'hybrid' | 'illustrative'
  manufacturingUse: boolean
  source: { kind: string; label: string; uri?: string; documentId?: string }
  width: number
  height: number
  centerlineY: number
  stations: SheetStation[]
}

/** What the exposure rail reads. Keyed by part, never merged into the sheet. */
export interface StationFacts {
  partId: string
  label: string
  coverage: ComponentLine['coverage'] | null
  qualifiers: ComponentLine['qualifiers']
  required: number
  available: number
  positionAfterBuild: number
  activeTarget: number | null
  configurationCount: number
  configurationsWithOrders: number
  liveOrders: number
  forwardDemand: number
}

const PITCH = 190
const MARGIN = 120
const HEIGHT = 320
const CENTERLINE = 190

/**
 * Roll a component line up to a station state.
 *
 * Precedence is deliberate and runs from least trustworthy to most concrete:
 *
 * `blocked` first, because a position we cannot trust should not be shown as
 * merely short — the honest statement is that we do not know.
 *
 * `shortage` next: a hard fact about today.
 *
 * `substitute` next: a proposal awaiting a human, which is a different kind of
 * problem from a missing part.
 *
 * `normal` otherwise — **including `below_safety_after_build`**. The skill's
 * contract fixes four states and a fifth would fail validation, and in any case
 * a part that covers this build is not wrong for this build. It is wrong
 * afterwards, which is what the exposure rail and the post-build panel are for.
 * The sheet header carries the count so it is never silently dropped.
 */
function statusFor(line: ComponentLine | undefined): { status: PartStatus; label?: string } {
  if (!line) return { status: 'normal' }
  if (line.qualifiers.includes('blocked')) return { status: 'blocked', label: 'Blocked' }
  if (line.coverage === 'short') return { status: 'shortage', label: 'Shortage' }
  if (line.qualifiers.includes('part_resolution_review')) {
    return { status: 'substitute', label: 'Proposed substitute' }
  }
  return { status: 'normal' }
}

function blueprintFor(key: string, group: 'low' | 'standard' | 'high', highSpeed: boolean): string {
  if (key === 'cordset') return group === 'low' ? 'cordset-eu' : group === 'high' ? 'cordset-hi' : 'cordset-na'
  if (key === 'drive-unit' && highSpeed) return 'gearbox-hs'
  return STATIONS.find((s) => s.key === key)?.blueprint ?? 'plate'
}

export function buildAssemblySheet(configurationId: string, orderId: string = HERO_ORDER): {
  sheet: ExplodedAssemblySheet
  facts: Record<string, StationFacts>
  belowSafetyCount: number
} {
  /* Case-insensitive, and the canonical id is taken from the record rather
   * than echoed back from the caller. The identifier arrives through the
   * address bar in lower case; comparing it directly left every configuration
   * unmatched, which fell through to the `?? 'Assembly'` defaults and printed a
   * sheet header with a dangling separator and no product family. */
  const config = CONFIGURATIONS.find(
    (c) => c.finishedPart?.toLowerCase() === configurationId.toLowerCase(),
  )
  const group = voltageGroup(config?.voltage ?? 460)
  const lines = explodeOrder(orderId)
  const byPart = new Map(lines.map((l) => [l.partNumber, l]))

  const stations: SheetStation[] = STATIONS.map((s, i) => {
    const partId = stationPart(s, group)
    const key = blueprintFor(s.key, group, config?.highSpeed ?? false)
    const bp = BLUEPRINTS[key] ?? BLUEPRINTS['control-board']
    const { status, label } = statusFor(byPart.get(partId))
    return {
      station: s.station,
      partId,
      label: s.label,
      x: MARGIN + i * PITCH,
      y: CENTERLINE,
      status,
      statusLabel: label,
      shapes: bp.shapes,
      bbox: bp.bbox,
    }
  })

  const facts: Record<string, StationFacts> = {}
  for (const st of stations) {
    const line = byPart.get(st.partId)
    const ex = exposureOf(st.partId)
    facts[st.partId] = {
      partId: st.partId,
      label: st.label,
      coverage: line?.coverage ?? null,
      qualifiers: line?.qualifiers ?? [],
      required: line?.required ?? 0,
      available: line?.available ?? 0,
      positionAfterBuild: line?.positionAfterBuild ?? 0,
      activeTarget: line?.activeTarget ?? null,
      configurationCount: ex.configurationCount,
      configurationsWithOrders: ex.configurationsWithOrders,
      liveOrders: ex.liveOrders,
      forwardDemand: ex.forwardDemand,
    }
  }

  const width = MARGIN * 2 + (stations.length - 1) * PITCH

  return {
    sheet: {
      sheetId: config?.finishedPart ?? configurationId,
      revision: 'D',
      title: `${config?.productFamily ?? 'Assembly'} · ${config?.label ?? ''}`,
      /* Illustrative, always, and not a parameter anyone can get wrong.
       * There is no controlled CAD behind this and there is not going to be;
       * the fidelity rules require the label and require manufacturingUse to
       * be false, and hardcoding both is how that stays true. */
      fidelity: 'illustrative',
      manufacturingUse: false,
      source: {
        kind: 'illustration',
        label: 'Concept geometry for demonstration — not for manufacturing',
      },
      width,
      height: HEIGHT,
      centerlineY: CENTERLINE,
      stations,
    },
    facts,
    belowSafetyCount: lines.filter((l) => l.coverage === 'below_safety_after_build').length,
  }
}
