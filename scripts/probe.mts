/**
 * Prints what the fixtures derive, so a seed can be eyeballed before it is
 * trusted. Not part of the build.
 */
import { emptyState } from '../src/services/mock/store'
import { openRows, summaryOf, statusOf, eventsOf, requestRows, historyRows, orderById } from '../src/fixtures/derive'
import { recommendFor } from '../src/fixtures/recommend'
import { scorecardRows, benchmarkSeries, workloadCells } from '../src/fixtures/analytics'
import { seedNotifications } from '../src/fixtures/notify'
import { HERO_T1, HERO_T3, LOCKED_ORDER } from '../src/fixtures/orders'
import { ORDER_STATUSES } from '../src/types/domain'

const state = emptyState()
const rows = openRows(state)

console.log('\n── open book by status ──')
for (const s of ORDER_STATUSES) console.log(`${s.padEnd(22)} ${rows.filter((r) => r.status === s).length}`)
console.log('total open rows', rows.length)

console.log('\n── summary ──')
console.log(summaryOf(state))

for (const id of [HERO_T1, HERO_T3, LOCKED_ORDER]) {
  const o = orderById(state, id)!
  console.log(`\n── ${id} ──`, statusOf(o, state), 'window', o.window.start.slice(11, 16), '→', o.window.end.slice(11, 16))
  for (const e of eventsOf(o, state)) console.log('  ', e.at.slice(0, 16), e.status.padEnd(22), e.actor, e.note ?? '')
}

console.log('\n── suggestions for', HERO_T1, '──')
for (const r of recommendFor(orderById(state, HERO_T1)!, state)) console.log(`  #${r.rank} ${r.carrierName.padEnd(26)} ${r.score}  ${r.rationale}`)

console.log('\n── requests (open/overdue/rejected) ──')
const rq = requestRows(state)
console.log(rq.filter((r) => r.state === 'sent').length, rq.filter((r) => r.overdue).length, rq.filter((r) => r.state === 'rejected').length)

console.log('\n── scorecard ──')
for (const r of scorecardRows(state)) console.log(`  ${String(r.rank).padStart(2)} ${r.carrierName.padEnd(26)} loads ${String(r.loads).padStart(3)}  on-time ${Math.round(r.onTimePct * 100)}%  accept ${r.acceptanceMinutes}m  incidents ${(r.incidentRate * 100).toFixed(1)}%  rejections ${r.rejections}  score ${r.score}`)

console.log('\n── benchmark ──')
const b = benchmarkSeries(state)
for (const p of b.points) console.log(`  ${p.week} ${Math.round(p.onTimePct * 100)}%${p.forecast !== null ? ' (forecast)' : ''}`)

console.log('\n── workload ──')
const cells = workloadCells(state)
for (const name of [...new Set(cells.map((c) => c.cvrName))]) console.log(`  ${name.padEnd(18)}`, cells.filter((c) => c.cvrName === name).map((c) => `${c.bucket}:${c.count}`).join(' '))

console.log('\n── seed notifications ──', seedNotifications().length)
console.log('history rows', historyRows(state).length)
