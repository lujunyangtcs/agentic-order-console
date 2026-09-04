import type { BomLine } from '@/types/domain'
import { CONFIGURATIONS, voltageGroup } from './configurations'
import { PARTS, STATIONS, stationPart } from './parts'
import { d, FOREVER } from './calendar'

/**
 * Product structure, revision-versioned.
 *
 * ## Why the shared/specific split is shaped this way
 *
 * §8.1 asks for ~250 lines per configuration, ~180 shared across all twelve and
 * ~70 configuration-specific. Taken literally — seventy parts unique to each
 * voltage variant — that is not a machine anyone builds. A 460 V saw and a
 * 415 V saw differ in the motor, the drive, the transformer, the contactor, the
 * fuses, the board, the harness, the heater and the cord set. They do not
 * differ in seventy castings.
 *
 * So the "specific" population is scoped to the **voltage group**, not the
 * configuration: parts that vary with 42–115 V versus 208–460 V versus 575 V.
 * Configurations inside a group share them; configurations across groups do
 * not. That is both physically true and better for the demo, because it gives
 * component exposure an actual distribution — some parts at 12 of 12, some at 5
 * of 12, some at 2 — instead of the flat wall a uniform split produces. The one
 * chart meant to prove variant complexity has to have shape in it.
 *
 * ## Revisions
 *
 * Every line carries `validFrom`/`validTo`. Two revisions exist on the motor
 * position so "the effective structure for this order's date" is a question
 * with an answer rather than an assumption, and so the superseded relationship
 * in §7.4 has a date to point at.
 */

/* Filler parts, partitioned once so the split is stable across configurations. */
const FILLER = PARTS.filter((p) => p.partNumber.startsWith('DEMO-') && !p.voltageDependent && !/-(STD|R1|R2|ALT|D2)$/.test(p.partNumber) && p.partNumber !== 'ABC-SEN-220')

/** Consumed by every configuration. The population that makes exposure high. */
const SHARED = FILLER.slice(0, 180)

/**
 * Scoped to a voltage group; three disjoint slices.
 *
 * Sized so the hero configuration lands on exactly 250 analysed lines:
 * 17 drawn stations + 180 shared + 49 group + 4 unique. §8.6 fixes that total
 * and the coverage split beneath it, so the arithmetic has to close here rather
 * than be rounded to later.
 */
const GROUP_SPECIFIC: Record<'low' | 'standard' | 'high', typeof FILLER> = {
  low: FILLER.slice(180, 229),
  standard: FILLER.slice(229, 278),
  high: FILLER.slice(278, 327),
}

/** A handful genuinely unique to one configuration — labels, plates, manuals. */
function uniqueFor(index: number) {
  return FILLER.slice(327 + index * 4, 327 + index * 4 + 4)
}

/** Effective from before the demo window, so nothing looks newly introduced. */
const EFFECTIVE_FROM = d(-420)

/** The motor revision changed part-way through the window. */
const MOTOR_R1_UNTIL = d(-165)

function linesFor(configIndex: number): BomLine[] {
  const config = CONFIGURATIONS[configIndex]
  const id = config.finishedPart ?? `NA-${configIndex}`
  const group = voltageGroup(config.voltage)
  const out: BomLine[] = []

  const add = (partNumber: string, quantityPer: number, revision = 'C', validFrom = EFFECTIVE_FROM, validTo = FOREVER) =>
    out.push({ configurationId: id, partNumber, quantityPer, revision, validFrom, validTo })

  /* The seventeen drawn positions. */
  for (const s of STATIONS) {
    const part = stationPart(s, group)
    if (s.key === 'motor' && group === 'standard') {
      /* The superseded predecessor, and the revision that replaced it. Both are
       * real lines on the same position — which is what makes the part-
       * resolution drawer's "superseded" case checkable rather than asserted. */
      add('ABC-MTR-460-60-R1', 1, 'B', EFFECTIVE_FROM, MOTOR_R1_UNTIL)
      add('ABC-MTR-460-60-R2', 1, 'C', MOTOR_R1_UNTIL, FOREVER)
    } else {
      add(part, s.key === 'wheel-bearing' ? 2 : 1)
    }
  }

  for (const p of SHARED) add(p.partNumber, 1)
  for (const p of GROUP_SPECIFIC[group]) add(p.partNumber, 1)
  for (const p of uniqueFor(configIndex)) add(p.partNumber, 1)

  return out
}

export const BOM_LINES: BomLine[] = CONFIGURATIONS.flatMap((_, i) => linesFor(i))

/** Lines effective on a given date — the "effective structure" question. */
export function effectiveBom(configurationId: string, on: string): BomLine[] {
  return BOM_LINES.filter(
    (l) => l.configurationId === configurationId && l.validFrom <= on && l.validTo > on,
  )
}

/**
 * How many configurations consume a part, and which.
 *
 * This is the answer no single product structure gives, and §11.8 puts it at
 * the centre of the Assembly Exposure view. Only orderable configurations count
 * — a configuration nobody can buy generates no demand.
 */
export function configurationsConsuming(partNumber: string, on: string): string[] {
  const orderable = new Set(
    CONFIGURATIONS.filter((c) => c.orderable && c.finishedPart).map((c) => c.finishedPart as string),
  )
  const seen = new Set<string>()
  for (const l of BOM_LINES) {
    if (l.partNumber !== partNumber) continue
    if (!orderable.has(l.configurationId)) continue
    if (l.validFrom <= on && l.validTo > on) seen.add(l.configurationId)
  }
  return [...seen]
}
