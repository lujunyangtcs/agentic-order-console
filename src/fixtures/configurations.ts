import type { Configuration, Site } from '@/types/domain'

/**
 * The ABC-600 Series configuration matrix.
 *
 * The data is synthetic; the **shape** is not.
 *
 * Configure-to-order industrial equipment really is sold this way. A single
 * published model carries a dozen orderable voltage/frequency combinations,
 * each with its own finished part number, and the pattern repeats across the
 * whole catalogue — it is printed on the manufacturer's own spec sheets, not
 * inferred from anywhere. Twelve configurations of one model, before element,
 * balancer or stretch options, each drawing 200–300 components from a shared
 * pool.
 *
 * That combinatorial explosion is the reason this product exists, and it is why
 * this table is the spine of the fixture rather than a lookup in it.
 *
 * Two rows earn their place beyond arithmetic:
 *
 * The `415 V / 50 Hz high speed` row has **no part number**. Published matrices
 * routinely carry combinations that are specifiable but not orderable, and that
 * row gives the demo an edge case worth having: a configuration selector that
 * has to refuse.
 *
 * The three rows with live orders (460/60, 380/50, 575/60) are the ones §12.3
 * shows against component `ABC-1001`, which is consumed by eleven of the twelve.
 */

export const PRODUCT_FAMILY = 'ABC-600 Series'

export const CONFIGURATIONS: Configuration[] = [
  { finishedPart: 'ABC-6107', productFamily: PRODUCT_FAMILY, label: '460 V / 3φ / 60 Hz',              voltage: 460, phase: 3, frequency: 60, highSpeed: false, orderable: true },
  { finishedPart: 'ABC-6104', productFamily: PRODUCT_FAMILY, label: '380 V / 3φ / 50 Hz',              voltage: 380, phase: 3, frequency: 50, highSpeed: false, orderable: true },
  { finishedPart: 'ABC-6108', productFamily: PRODUCT_FAMILY, label: '575 V / 3φ / 60 Hz',              voltage: 575, phase: 3, frequency: 60, highSpeed: false, orderable: true },
  { finishedPart: 'ABC-6103', productFamily: PRODUCT_FAMILY, label: '230 V / 3φ / 60 Hz',              voltage: 230, phase: 3, frequency: 60, highSpeed: false, orderable: true },
  { finishedPart: 'ABC-6102', productFamily: PRODUCT_FAMILY, label: '220 V / 3φ / 50 Hz',              voltage: 220, phase: 3, frequency: 50, highSpeed: false, orderable: true },
  { finishedPart: 'ABC-6109', productFamily: PRODUCT_FAMILY, label: '208 V / 3φ / 60 Hz',              voltage: 208, phase: 3, frequency: 60, highSpeed: false, orderable: true },
  { finishedPart: 'ABC-6105', productFamily: PRODUCT_FAMILY, label: '380 V / 3φ / 60 Hz',              voltage: 380, phase: 3, frequency: 60, highSpeed: false, orderable: true },
  { finishedPart: 'ABC-6106', productFamily: PRODUCT_FAMILY, label: '415 V / 3φ / 50 Hz',              voltage: 415, phase: 3, frequency: 50, highSpeed: false, orderable: true },
  { finishedPart: 'ABC-6101', productFamily: PRODUCT_FAMILY, label: '115 V / 3φ / 50 Hz',              voltage: 115, phase: 3, frequency: 50, highSpeed: false, orderable: true },
  { finishedPart: 'ABC-6100', productFamily: PRODUCT_FAMILY, label: '42 V / 3φ / 50 Hz',               voltage: 42,  phase: 3, frequency: 50, highSpeed: false, orderable: true },
  { finishedPart: 'ABC-6207', productFamily: PRODUCT_FAMILY, label: '42 V / 3φ / 50 Hz high speed',    voltage: 42,  phase: 3, frequency: 50, highSpeed: true,  orderable: true },
  { finishedPart: null,      productFamily: PRODUCT_FAMILY, label: '415 V / 3φ / 50 Hz high speed',   voltage: 415, phase: 3, frequency: 50, highSpeed: true,  orderable: false },
]

/** The hero configuration — the one SO-ABC-10482 is placed against. */
export const HERO_CONFIGURATION = 'ABC-6107'

/**
 * Voltage groups.
 *
 * A voltage-dependent component does not need twelve identities, it needs one
 * per group: the motor that runs on 380 V also runs on 415 V. Three groups
 * covers the published range, which is why §8.1 counts nine voltage-dependent
 * positions rather than nine times twelve parts.
 */
export type VoltageGroup = 'low' | 'standard' | 'high'

export function voltageGroup(v: number): VoltageGroup {
  if (v <= 120) return 'low'
  if (v <= 460) return 'standard'
  return 'high'
}

/**
 * Sites.
 *
 * One plant, one service depot, one distribution point — the common shape for a
 * manufacturer of this size, and the minimum that makes two features renderable:
 * §11.6 offers a transfer as an alternative, and §15.2 compares warehouses.
 * Neither works against a single site.
 *
 * Plant C carries EUR so the currency grouping rule in §13.2 has something to
 * group. A rule that never fires is a rule nobody believes.
 */
export const SITES: Site[] = [
  { id: 'plant-a', name: 'Plant A', kind: 'plant',        currency: 'USD', warehouses: ['MAIN', 'WIP', 'QA'] },
  { id: 'plant-b',      name: 'Plant B',      kind: 'service',      currency: 'USD', warehouses: ['MAIN'] },
  { id: 'plant-c',  name: 'Plant C',  kind: 'distribution', currency: 'EUR', warehouses: ['MAIN'] },
]

export const PRIMARY_SITE = 'plant-a'
