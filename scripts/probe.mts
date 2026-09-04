/** Scratch probe — prints what the fixture actually derives. Not part of the build. */
import { PARTS } from '../src/fixtures/parts'
import { CONFIGURATIONS } from '../src/fixtures/configurations'
import { BOM_LINES, effectiveBom, configurationsConsuming } from '../src/fixtures/bom'
import { INVENTORY } from '../src/fixtures/inventory'
import { SALES_ORDERS, openOrders, HERO_ORDER } from '../src/fixtures/orders'
import { TODAY, d } from '../src/fixtures/calendar'
import {
  readinessOf, buildRequisitionSet, requisitionValue, ordersProtectedBy,
  exposureOf, statusOf, projectedZeroDate, projectedZeroAfterOrder, coverageDays, available,
} from '../src/fixtures/derive'

const n = (x: number) => String(x).padStart(6)

console.log('\n══ dataset shape (§8.1) ══')
console.log(`  parts                ${n(PARTS.length)}   (target 1,200–1,500)`)
console.log(`  configurations       ${n(CONFIGURATIONS.length)}   (12, one unorderable)`)
console.log(`  BOM lines total      ${n(BOM_LINES.length)}`)
console.log(`  BOM lines / hero cfg ${n(effectiveBom('ABC-6107', TODAY).length)}   (target ≈250)`)
console.log(`  inventory positions  ${n(INVENTORY.length)}`)
console.log(`  sales orders         ${n(SALES_ORDERS.length)}   (target 24–30)`)
console.log(`  open orders          ${n(openOrders().length)}`)

console.log('\n══ hero position ABC-1001 @ plant-a/MAIN (§8.3) ══')
console.log(`  available            ${n(available('ABC-1001', 'plant-a'))}   (expect 12)`)
console.log(`  projected zero (now)  ${projectedZeroDate('ABC-1001', 'plant-a')}`)
console.log(`  projected zero (post) ${projectedZeroAfterOrder('ABC-1001', 'plant-a', 4)}   (expect ${d(13)})`)
console.log(`  coverage days        ${n(coverageDays('ABC-1001', 'plant-a') ?? -1)}   (expect 47)`)
console.log(`  status                ${statusOf('ABC-1001', 'plant-a')}`)

console.log('\n══ component exposure (§11.8, FR-037) ══')
const ex = exposureOf('ABC-1001')
console.log(`  consumed by          ${n(ex.configurationCount)} of 12   (expect 11)`)
console.log(`  configs with orders  ${n(ex.configurationsWithOrders)}   (expect 3)`)
/* Not 6. Six is the number of *open customer orders* (asserted in the gate);
 * forward demand is the count of hero-part units those orders will consume,
 * which is a different quantity with a different unit. An earlier note here
 * conflated the two and made a correct model look like a drift. */
console.log(`  forward demand       ${n(ex.forwardDemand)}   (units, not order count)`)
console.log(`  configurationsConsuming len ${configurationsConsuming('ABC-1001', TODAY).length}`)

console.log('\n══ readiness, two axes (§11.4) ══')
const r = readinessOf(HERO_ORDER)
console.log(`  analysed lines       ${n(r.analysedLines)}`)
console.log(`  covered              ${n(r.covered)}`)
console.log(`  below safety         ${n(r.belowSafetyAfterBuild)}`)
console.log(`  short                ${n(r.short)}`)
console.log(`  axis-1 sum           ${n(r.covered + r.belowSafetyAfterBuild + r.short)}  ← must equal analysed`)
console.log(`  part-resolution      ${n(r.partResolutionReview)}   (overlay)`)
console.log(`  blocked              ${n(r.blocked)}   (overlay)`)

console.log('\n══ requisition set (§13) ══')
const set = buildRequisitionSet(HERO_ORDER)
console.log(`  requisitions         ${n(set.requisitions.length)}`)
console.log(`  lines                ${n(set.lines.length)}`)
console.log(`  protect_order        ${n(set.lines.filter(l => l.reason === 'protect_order').length)}`)
console.log(`  restore_safety       ${n(set.lines.filter(l => l.reason === 'restore_safety').length)}`)
console.log(`  value                $${requisitionValue(set.lines).toLocaleString()}`)
console.log(`  orders protected     ${n(ordersProtectedBy(set.lines).length)}`)
for (const req of set.requisitions) {
  const ls = set.lines.filter(l => l.requisitionId === req.id)
  console.log(`    ${req.id}  ${req.supplierId.padEnd(15)} ${String(ls.length).padStart(2)} lines  ` +
              `$${requisitionValue(ls).toLocaleString().padStart(9)}  protects ${ordersProtectedBy(ls).length}`)
}

console.log('\n══ status distribution (§7.3 — all five must be populated) ══')
const dist: Record<string, number> = {}
for (const p of INVENTORY) {
  const s = statusOf(p.partNumber, p.site, p.warehouse)
  dist[s] = (dist[s] ?? 0) + 1
}
for (const [k, v] of Object.entries(dist).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(18)} ${n(v)}`)
}

console.log('\n══ criticality distribution (§7.1 — all four) ══')
const crit: Record<string, number> = {}
for (const p of PARTS) crit[p.criticality] = (crit[p.criticality] ?? 0) + 1
for (const [k, v] of Object.entries(crit).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(22)} ${n(v)}`)
}
console.log('')
