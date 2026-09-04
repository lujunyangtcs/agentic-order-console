import { ORDER_STATUSES, type Order, type OrderStatus, type StatusEvent } from '@/types/domain'
import type {
  BenchmarkSeries, LiveAnalytics, ReportResult, ReportSpec, ScorecardRow, ScorecardWeights, WorkloadCell,
} from '@/services/contracts'
import type { MockState } from '@/services/mock/store'
import { CARRIERS, CARRIER_BY_ID, CUSTOMER_BY_ID, TERMINAL_BY_ID } from './network'
import { CVRS } from './people'
import {
  allOrders, allRequests, allDeviations, carrierIdOf, eventsOf, lastEventOf, needsAttention, onTimeOf,
  openRows, statusOf, summaryOf, allRequests as requestsAll,
} from './derive'
import { TODAY, nowIso } from './calendar'

/** The service desk's default weights. Editable on the scorecard page. */
export const DEFAULT_WEIGHTS: ScorecardWeights = { onTime: 50, acceptance: 20, incidents: 20, rejections: 10 }

function median(xs: number[]): number {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

export function scorecardRows(state: MockState, weights: Partial<ScorecardWeights> = {}): ScorecardRow[] {
  const w = { ...DEFAULT_WEIGHTS, ...weights }
  const total = w.onTime + w.acceptance + w.incidents + w.rejections || 1
  const orders = allOrders(state)
  const requests = allRequests(state)
  const deviations = allDeviations(state)
  const rows = CARRIERS.map((c) => {
    const delivered = orders.filter((o) => carrierIdOf(o, state) === c.id && statusOf(o, state) === 'delivery_completed')
    const onTime = delivered.filter((o) => onTimeOf(o, state)).length
    const onTimePct = delivered.length ? onTime / delivered.length : 0
    const accepted = requests.filter((r) => r.carrierId === c.id && r.state === 'accepted' && r.respondedAt)
    const acceptanceMinutes = Math.round(median(accepted.map((r) => (Date.parse(r.respondedAt!) - Date.parse(r.sentAt)) / 60_000)))
    const deliveredIds = new Set(delivered.map((o) => o.id))
    const incidents = deviations.filter((dv) => deliveredIds.has(dv.orderId)).length
    const incidentRate = delivered.length ? incidents / delivered.length : 0
    const rejections = requests.filter((r) => r.carrierId === c.id && r.state === 'rejected').length
    const score = Math.round(
      (w.onTime * onTimePct +
        w.acceptance * (1 - Math.min(1, acceptanceMinutes / 60)) +
        w.incidents * (1 - Math.min(1, incidentRate * 5)) +
        w.rejections * (1 - Math.min(1, rejections / 8))) * (100 / total),
    )
    return { carrierId: c.id, carrierName: c.name, hasTms: c.hasTms, loads: delivered.length, onTimePct, acceptanceMinutes, incidentRate, rejections, score, rank: 0 }
  })
  return rows.sort((a, b) => b.score - a.score || b.loads - a.loads).map((r, i) => ({ ...r, rank: i + 1 }))
}

function isoWeekStart(iso: string): string {
  const dt = new Date(iso)
  const day = (dt.getUTCDay() + 6) % 7
  dt.setUTCDate(dt.getUTCDate() - day)
  return dt.toISOString().slice(0, 10)
}

export const BENCHMARK = 0.92

export function benchmarkSeries(state: MockState): BenchmarkSeries {
  const delivered = allOrders(state).filter((o) => statusOf(o, state) === 'delivery_completed')
  const byWeek = new Map<string, { n: number; onTime: number }>()
  for (const o of delivered) {
    const wk = isoWeekStart(lastEventOf(o, state).at)
    const cell = byWeek.get(wk) ?? { n: 0, onTime: 0 }
    cell.n += 1
    if (onTimeOf(o, state)) cell.onTime += 1
    byWeek.set(wk, cell)
  }
  const weeks = [...byWeek.keys()].sort().slice(-12)
  const points = weeks.map((week) => {
    const c = byWeek.get(week)!
    return { week, onTimePct: c.n ? c.onTime / c.n : 0, benchmark: BENCHMARK, forecast: null as number | null, forecastLow: null as number | null, forecastHigh: null as number | null }
  })
  /* Straight-line trend over the last eight weeks, projected three ahead. */
  const tail = points.slice(-8)
  const n = tail.length
  const xs = tail.map((_, i) => i)
  const ys = tail.map((p) => p.onTimePct)
  const mx = xs.reduce((a, b) => a + b, 0) / (n || 1)
  const my = ys.reduce((a, b) => a + b, 0) / (n || 1)
  const slope = n > 1 ? xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / xs.reduce((s, x) => s + (x - mx) ** 2, 0) : 0
  const last = points.at(-1)
  const lastWeek = last ? new Date(last.week) : new Date(TODAY)
  for (let k = 1; k <= 3; k += 1) {
    const dt = new Date(lastWeek)
    dt.setUTCDate(dt.getUTCDate() + 7 * k)
    const f = Math.max(0.6, Math.min(1, my + slope * (n - 1 + k)))
    points.push({ week: dt.toISOString().slice(0, 10), onTimePct: f, benchmark: BENCHMARK, forecast: f, forecastLow: Math.max(0, f - 0.03 * k), forecastHigh: Math.min(1, f + 0.03 * k) })
  }
  const current = last?.onTimePct ?? 0
  const prior = points[Math.max(0, points.length - 8)]?.onTimePct ?? current
  return { points, benchmark: BENCHMARK, current, trend: current - prior }
}

const BUCKET_OF: Record<OrderStatus, WorkloadCell['bucket']> = {
  order_created: 'requests',
  pending_carrier: 'assigning',
  order_scheduled: 'pending',
  transit_to_terminal: 'pending',
  starting_load: 'pending',
  load_completed: 'pending',
  in_transit: 'moving',
  on_site: 'delivering',
  unloading: 'delivering',
  unload_completed: 'delivering',
  delivery_completed: 'delivering',
}

export function workloadCells(state: MockState): WorkloadCell[] {
  const rows = openRows(state)
  const cells: WorkloadCell[] = []
  for (const cvr of CVRS) {
    const mine = rows.filter((r) => r.cvrId === cvr.id)
    const counts: Record<WorkloadCell['bucket'], number> = { requests: 0, assigning: 0, pending: 0, moving: 0, delivering: 0, exceptions: 0 }
    for (const r of mine) {
      counts[BUCKET_OF[r.status]] += 1
      if (needsAttention(r, state)) counts.exceptions += 1
    }
    for (const bucket of Object.keys(counts) as WorkloadCell['bucket'][]) {
      cells.push({ cvrId: cvr.id, cvrName: cvr.name, bucket, count: counts[bucket] })
    }
  }
  return cells
}

function cycleHours(o: Order, state: MockState): number | null {
  const ev = eventsOf(o, state)
  const created = ev[0]
  const delivered = ev.find((e) => e.status === 'delivery_completed')
  if (!delivered) return null
  return (Date.parse(delivered.at) - Date.parse(created.at)) / 3_600_000
}

export function buildReport(state: MockState, spec: Omit<ReportSpec, 'id' | 'createdAt' | 'name'> & { name?: string; id?: string; createdAt?: string }): ReportResult {
  const orders = spec.dimension === 'status' ? allOrders(state).filter((o) => openRows(state).some((r) => r.id === o.id)) : allOrders(state)
  const deviations = allDeviations(state)
  const groups = new Map<string, Order[]>()
  const keyOf = (o: Order): string => {
    switch (spec.dimension) {
      case 'carrier': { const c = carrierIdOf(o, state); return c ? CARRIER_BY_ID[c].name : 'Unassigned' }
      case 'terminal': return TERMINAL_BY_ID[o.terminalId].name
      case 'customer': return CUSTOMER_BY_ID[o.customerId].name
      case 'status': return statusOf(o, state)
      case 'product': return o.product
      case 'week': return isoWeekStart(lastEventOf(o, state).at)
    }
  }
  for (const o of orders) {
    const k = keyOf(o)
    groups.set(k, [...(groups.get(k) ?? []), o])
  }
  const unit: ReportResult['unit'] = spec.measure === 'on_time_pct' ? '%' : spec.measure === 'cycle_hours' ? 'h' : spec.measure === 'tonnes' ? 't' : ''
  let points = [...groups.entries()].map(([label, os]) => {
    let value = 0
    switch (spec.measure) {
      case 'orders': value = os.length; break
      case 'tonnes': value = os.reduce((s, o) => s + o.tonnes, 0); break
      case 'deviations': value = deviations.filter((dv) => os.some((o) => o.id === dv.orderId)).length; break
      case 'on_time_pct': {
        const done = os.filter((o) => statusOf(o, state) === 'delivery_completed')
        value = done.length ? Math.round((done.filter((o) => onTimeOf(o, state)).length / done.length) * 100) : 0
        break
      }
      case 'cycle_hours': {
        const hs = os.map((o) => cycleHours(o, state)).filter((h): h is number => h !== null)
        value = hs.length ? Math.round((hs.reduce((a, b) => a + b, 0) / hs.length) * 10) / 10 : 0
        break
      }
    }
    return { label, value, secondary: os.length }
  })
  if (spec.dimension === 'status') {
    points = points.sort((a, b) => ORDER_STATUSES.indexOf(a.label as OrderStatus) - ORDER_STATUSES.indexOf(b.label as OrderStatus))
  } else if (spec.dimension === 'week') {
    points = points.sort((a, b) => a.label.localeCompare(b.label)).slice(-12)
  } else {
    points = points.sort((a, b) => b.value - a.value)
  }
  const total = spec.measure === 'on_time_pct' || spec.measure === 'cycle_hours'
    ? Math.round((points.reduce((s, p) => s + p.value * (p.secondary ?? 1), 0) / Math.max(1, points.reduce((s, p) => s + (p.secondary ?? 1), 0))) * 10) / 10
    : points.reduce((s, p) => s + p.value, 0)
  const full: ReportSpec = { id: spec.id ?? 'RPT-preview', name: spec.name ?? '', createdAt: spec.createdAt ?? nowIso(), dimension: spec.dimension, measure: spec.measure, chart: spec.chart }
  return { spec: full, points, unit, total }
}

export function eventLog(state: MockState, filter: { orderId?: string; limit?: number } = {}): (StatusEvent & { erpRef: string; customerName: string })[] {
  const out: (StatusEvent & { erpRef: string; customerName: string })[] = []
  for (const o of allOrders(state)) {
    if (filter.orderId && o.id !== filter.orderId) continue
    for (const e of eventsOf(o, state)) out.push({ ...e, erpRef: o.erpRef, customerName: CUSTOMER_BY_ID[o.customerId].name })
  }
  out.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
  return filter.limit ? out.slice(0, filter.limit) : out
}

export function liveAnalytics(state: MockState): LiveAnalytics {
  const today = eventLog(state).filter((e) => e.at.slice(0, 10) === TODAY)
  const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }))
  for (const e of today) byHour[new Date(e.at).getUTCHours()].count += 1
  const rows = openRows(state)
  const answered = requestsAll(state).filter((r) => r.respondedAt).map((r) => (Date.parse(r.respondedAt!) - Date.parse(r.sentAt)) / 60_000)
  return {
    eventsToday: today.length,
    medianAcceptanceMinutes: Math.round(median(answered)),
    onTimePct: summaryOf(state).onTimePct,
    byStatus: ORDER_STATUSES.map((status) => ({ status, count: rows.filter((r) => r.status === status).length })),
    byHour,
  }
}
