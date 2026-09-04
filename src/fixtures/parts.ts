import type { Part, Criticality } from '@/types/domain'

/**
 * The part master.
 *
 * Two populations, and the split is deliberate.
 *
 * **Named parts are hand-authored.** Anything that appears on screen with its
 * own number — the element at station 3, the motor family the part-resolution
 * drawer compares, the sensor whose evidence is stale — is written out in full
 * below. These carry the values the the design notes fixes, and a reviewer can check them.
 *
 * **The bulk is generated.** §8.1 calls for a master of 1,200–1,500 SKUs
 * because a 250-line BOM inside a 400-SKU master forces 94–98% overlap between
 * configurations, which makes the variant-exposure chart a flat wall — the one
 * visual meant to prove the complexity proves nothing. You cannot hand-author
 * 1,300 parts honestly, so the filler is generated from a seeded hash: stable
 * across builds, plausible in shape, and never pretending to be more than it
 * is.
 *
 * ## Part numbering
 *
 * Seven digits, no letters, no separators, with the leading pair encoding the
 * category: `60…` is finished configured equipment, `10…` is elements,
 * consumables and service parts. That convention is lifted from real industrial
 * catalogues because it is what makes a part number scannable by someone who
 * handles them all day — and because a demo whose identifiers look invented
 * invites the audience to discount everything attached to them.
 *
 * The numbers themselves are synthetic. Anything with a `DEMO-` prefix is
 * additionally marked as such, for identities that exist only to demonstrate a
 * relationship.
 */

/* FNV-1a. Deterministic, so a rebuild produces byte-identical filler and a
 * `git diff` on the fixture means something changed rather than that it ran. */
function hash(s: string): number {
  let h = 2166136261
  for (const ch of s) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function pick<T>(seed: string, xs: readonly T[]): T {
  return xs[hash(seed) % xs.length]
}

function between(seed: string, lo: number, hi: number): number {
  return lo + (hash(seed) % (hi - lo + 1))
}

/* ── Named parts ─────────────────────────────────────────────────────────── */

/** The hero. Every figure here is fixed by §8.3. */
export const HERO_PART = 'ABC-1001'

const NAMED: Part[] = [
   /* Elements. The 10… prefix marks consumables and service parts. */
  { partNumber: 'ABC-1001', description: 'Primary element, extended life, 2845 mm (112 in)',           criticality: 'production_critical', unitCost: 158.0,  uom: 'EA', primarySupplierId: 'sup-industrial', moq: 25, orderMultiple: 5, voltageDependent: false },
  { partNumber: 'ABC-1002', description: 'Primary element, standard, 2845 mm (112 in)',                criticality: 'consumable',          unitCost: 96.0,   uom: 'EA', primarySupplierId: 'sup-industrial', moq: 25, orderMultiple: 5, voltageDependent: false },
  { partNumber: 'ABC-1003', description: 'Primary element, standard, long, 3150 mm (124 in)',      criticality: 'consumable',          unitCost: 104.0,  uom: 'EA', primarySupplierId: 'sup-industrial', moq: 25, orderMultiple: 5, voltageDependent: false },
  { partNumber: 'ABC-1004', description: 'Stretched Primary element, extended life, 3150 mm (124 in)', criticality: 'operational_essential', unitCost: 171.0, uom: 'EA', primarySupplierId: 'sup-industrial', moq: 25, orderMultiple: 5, voltageDependent: false },

  /* The motor family the part-resolution drawer compares. Five identities on
   * one component position — this is where §7.4's relationships live, and the
   * reason the drawer is worth building. */
  { partNumber: 'ABC-MTR-460-60-R2',  description: 'Drive motor 3.0 hp, 460 V 3φ 60 Hz, rev 2',  criticality: 'production_critical', unitCost: 842.0, uom: 'EA', primarySupplierId: 'sup-drive',      moq: 2,  orderMultiple: 1, voltageDependent: true },
  { partNumber: 'ABC-MTR-460-60-R1',  description: 'Drive motor 3.0 hp, 460 V 3φ 60 Hz, rev 1',  criticality: 'production_critical', unitCost: 812.0, uom: 'EA', primarySupplierId: 'sup-drive',      moq: 2,  orderMultiple: 1, voltageDependent: true },
  { partNumber: 'ABC-MTR-460-60-ALT', description: 'Drive motor 3.0 hp, 460 V 3φ 60 Hz, alt',    criticality: 'production_critical', unitCost: 889.0, uom: 'EA', primarySupplierId: 'sup-drive',      moq: 2,  orderMultiple: 1, voltageDependent: true },
  { partNumber: 'ABC-MTR-380-50',     description: 'Drive motor 3.0 hp, 380 V 3φ 50 Hz',         criticality: 'production_critical', unitCost: 838.0, uom: 'EA', primarySupplierId: 'sup-drive',      moq: 2,  orderMultiple: 1, voltageDependent: true },
  { partNumber: 'ABC-MTR-460-60-D2',  description: 'Drive motor 3.0 hp, 460 V 60 Hz',            criticality: 'production_critical', unitCost: 842.0, uom: 'EA', primarySupplierId: 'sup-drive',      moq: 2,  orderMultiple: 1, voltageDependent: true },

  /* The blocked SKU. Its evidence is 104 days old, which is what gives the
   * freshness machinery something real to act on — everything else in the
   * dataset is two days old and planner-confirmed. */
  { partNumber: 'ABC-SEN-220',        description: 'Cycle position sensor, sealed',        criticality: 'operational_essential', unitCost: 264.0, uom: 'EA', primarySupplierId: 'sup-precision', moq: 5, orderMultiple: 1, voltageDependent: false },
]

/* ── Station parts ───────────────────────────────────────────────────────── */

/**
 * The seventeen component positions the exploded sheet draws (§11.8).
 *
 * Nine of them are voltage-dependent, which matches §8.1 exactly. A
 * voltage-dependent position resolves to a different part number per voltage
 * group, not per configuration — a 380 V motor and a 415 V motor are the same
 * part, and drawing them as different would be inventing a distinction the
 * source cannot support.
 */
export interface StationSpec {
  station: number
  key: string
  label: string
  blueprint: string
  voltageDependent: boolean
  criticality: Criticality
  unitCost: number
  supplierId: string
  /** When set, the position resolves to this exact part rather than a
   *  generated one — the hero element and the two demo cases. */
  fixedPart?: string
}

export const STATIONS: StationSpec[] = [
  { station: 1,  key: 'guide-upper',    label: 'Guide assembly, upper', blueprint: 'guide-yoke',      voltageDependent: false, criticality: 'standard',             unitCost: 214,  supplierId: 'sup-precision' },
  { station: 2,  key: 'wheel-upper',    label: 'Drive wheel and tyre, upper', blueprint: 'element-wheel',     voltageDependent: false, criticality: 'operational_essential', unitCost: 396, supplierId: 'sup-precision' },
  { station: 3,  key: 'element',          label: 'Primary element, extended life',        blueprint: 'element-band',      voltageDependent: false, criticality: 'production_critical',   unitCost: 158, supplierId: 'sup-industrial', fixedPart: 'ABC-1001' },
  { station: 4,  key: 'wheel-lower',    label: 'Drive wheel and tyre, lower', blueprint: 'element-wheel',     voltageDependent: false, criticality: 'operational_essential', unitCost: 396, supplierId: 'sup-precision' },
  { station: 5,  key: 'wheel-bearing',  label: 'Wheel bearing pair',          blueprint: 'wheel-bearing',   voltageDependent: false, criticality: 'production_critical',   unitCost: 178, supplierId: 'sup-precision' },
  { station: 6,  key: 'motor',          label: 'Drive motor',                 blueprint: 'drive-motor',     voltageDependent: true,  criticality: 'production_critical',   unitCost: 842, supplierId: 'sup-drive', fixedPart: 'ABC-MTR-460-60-R2' },
  { station: 7,  key: 'pulley-belt',    label: 'Motor pulley and drive belt', blueprint: 'pulley-belt',     voltageDependent: false, criticality: 'standard',             unitCost: 132,  supplierId: 'sup-drive' },
  { station: 8,  key: 'drive-unit',     label: 'Speed drive',                 blueprint: 'drive-unit',      voltageDependent: true,  criticality: 'production_critical',   unitCost: 1_240, supplierId: 'sup-drive' },
  { station: 9,  key: 'transformer',    label: 'Transformer',                 blueprint: 'transformer',     voltageDependent: true,  criticality: 'operational_essential', unitCost: 468, supplierId: 'sup-drive' },
  { station: 10, key: 'contactor',      label: 'Contactor',                   blueprint: 'contactor',       voltageDependent: true,  criticality: 'standard',             unitCost: 118,  supplierId: 'sup-drive' },
  { station: 11, key: 'fuse-set',       label: 'Fuse set',                    blueprint: 'fuse-set',        voltageDependent: true,  criticality: 'consumable',           unitCost: 34,   supplierId: 'sup-drive' },
  { station: 12, key: 'control-board',  label: 'Control board',               blueprint: 'control-board',   voltageDependent: true,  criticality: 'production_critical',   unitCost: 704, supplierId: 'sup-drive' },
  { station: 13, key: 'harness',        label: 'Wiring harness',              blueprint: 'harness',         voltageDependent: true,  criticality: 'standard',             unitCost: 156,  supplierId: 'sup-drive' },
  { station: 14, key: 'heater',         label: 'Process heater',            blueprint: 'heater',          voltageDependent: true,  criticality: 'operational_essential', unitCost: 288, supplierId: 'sup-precision' },
  { station: 15, key: 'cordset',        label: 'Cord set and plug',           blueprint: 'cordset',         voltageDependent: true,  criticality: 'standard',             unitCost: 62,   supplierId: 'sup-drive' },
  { station: 16, key: 'sensor',         label: 'Cycle position sensor',     blueprint: 'sensor-pod',      voltageDependent: false, criticality: 'operational_essential', unitCost: 264, supplierId: 'sup-precision', fixedPart: 'ABC-SEN-220' },
  { station: 17, key: 'spring',         label: 'Tension spring and balancer', blueprint: 'spring-balancer', voltageDependent: false, criticality: 'standard',             unitCost: 208,  supplierId: 'sup-precision' },
]

/* ── Filler generation ───────────────────────────────────────────────────── */

const GROUPS = ['BRG', 'FST', 'SEA', 'GSK', 'PLT', 'SHF', 'BSH', 'CLP', 'VLV', 'HSE'] as const
const NOUNS: Record<string, string> = {
  BRG: 'Bearing', FST: 'Fastener set', SEA: 'Seal', GSK: 'Gasket', PLT: 'Plate',
  SHF: 'Shaft', BSH: 'Bushing', CLP: 'Clamp ring', VLV: 'Valve', HSE: 'Hose',
}
const MATERIALS = ['stainless 304', 'stainless 316', 'sealed PTFE', 'hardened steel', 'anodised alloy'] as const
const SUPPLIERS = ['sup-precision', 'sup-industrial', 'sup-drive', 'sup-fasteners', 'sup-polymer', 'sup-eu'] as const

/**
 * Criticality distribution, per §7.1's requirement that all four values be
 * instantiated. A filter that only ever returns one populated value tells the
 * audience the field is decorative.
 */
function criticalityFor(seed: string): Criticality {
  const r = hash(seed) % 100
  if (r < 8) return 'production_critical'
  if (r < 30) return 'operational_essential'
  if (r < 85) return 'standard'
  return 'consumable'
}

function makeFiller(index: number): Part {
  const seed = `filler:${index}`
  const group = pick(`${seed}:g`, GROUPS)
  const size = between(`${seed}:s`, 4, 96)
  const material = pick(`${seed}:m`, MATERIALS)
  return {
    partNumber: `DEMO-${group}-${String(1000 + index).slice(-4)}`,
    description: `${NOUNS[group]}, ${size} mm, ${material}`,
    criticality: criticalityFor(`${seed}:c`),
    unitCost: between(`${seed}:p`, 8, 1_240),
    uom: 'EA',
    primarySupplierId: pick(`${seed}:v`, SUPPLIERS),
    moq: pick(`${seed}:q`, [1, 5, 10, 25, 50]),
    orderMultiple: pick(`${seed}:o`, [1, 1, 5, 10]),
    voltageDependent: false,
  }
}

/** §8.1 — 1,200–1,500. Sized so variant overlap is legible rather than total. */
const FILLER_COUNT = 1_260

/**
 * Voltage-dependent parts: nine positions × three voltage groups.
 * Station 6's standard-group part is the hand-authored motor, so it is skipped.
 */
function voltageParts(): Part[] {
  const out: Part[] = []
  for (const s of STATIONS.filter((x) => x.voltageDependent)) {
    for (const g of ['low', 'standard', 'high'] as const) {
      const partNumber = `DEMO-${s.key.toUpperCase().replace(/-/g, '')}-${g.toUpperCase()}`
      if (s.fixedPart && g === 'standard') continue
      out.push({
        partNumber,
        description: `${s.label}, ${g} voltage group`,
        criticality: s.criticality,
        unitCost: s.unitCost,
        uom: 'EA',
        primarySupplierId: s.supplierId,
        moq: 2,
        orderMultiple: 1,
        voltageDependent: true,
      })
    }
  }
  return out
}

/** Non-voltage station parts that are not hand-authored. */
function stationParts(): Part[] {
  return STATIONS.filter((s) => !s.voltageDependent && !s.fixedPart).map((s) => ({
    partNumber: `DEMO-${s.key.toUpperCase().replace(/-/g, '')}-STD`,
    description: s.label,
    criticality: s.criticality,
    unitCost: s.unitCost,
    uom: 'EA',
    primarySupplierId: s.supplierId,
    moq: 5,
    orderMultiple: 1,
    voltageDependent: false,
  }))
}

export const PARTS: Part[] = [
  ...NAMED,
  ...stationParts(),
  ...voltageParts(),
  ...Array.from({ length: FILLER_COUNT }, (_, i) => makeFiller(i)),
]

export const PART_BY_NUMBER = new Map(PARTS.map((p) => [p.partNumber, p]))

/** Resolve a station to its part number for a given voltage group. */
export function stationPart(s: StationSpec, group: 'low' | 'standard' | 'high'): string {
  if (s.fixedPart && (!s.voltageDependent || group === 'standard')) return s.fixedPart
  if (!s.voltageDependent) return `DEMO-${s.key.toUpperCase().replace(/-/g, '')}-STD`
  return `DEMO-${s.key.toUpperCase().replace(/-/g, '')}-${group.toUpperCase()}`
}
