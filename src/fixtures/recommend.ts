import type { Order } from '@/types/domain'
import type { Recommendation } from '@/services/contracts'
import type { MockState } from '@/services/mock/store'
import { haversineKm } from './geo'
import { CARRIERS, TERMINAL_BY_ID, SHIP_TO_BY_ID, carriersServing } from './network'
import { allOrders, carrierIdOf, onTimeOf, requestsOf, statusOf } from './derive'

/**
 * Which carriers to suggest, and why.
 *
 * Five transparent factors, each 0–1, weighted to 100. The weights are the
 * service desk's, not a model's, and every factor is rendered as a sentence
 * the desk can check. Carriers that already rejected this order are excluded.
 */
export const WEIGHTS = { lane: 30, onTime: 25, rate: 20, capacity: 15, distance: 10 } as const

const ACTIVE = ['order_scheduled', 'transit_to_terminal', 'starting_load', 'load_completed', 'in_transit', 'on_site', 'unloading']

export function recommendFor(order: Order, state: MockState): Recommendation[] {
  const rejected = new Set(requestsOf(order.id, state).filter((r) => r.state === 'rejected').map((r) => r.carrierId))
  const terminal = TERMINAL_BY_ID[order.terminalId]
  const shipTo = SHIP_TO_BY_ID[order.shipToId]
  const laneKey = `${order.terminalId}>${order.shipToId}`
  const serving = carriersServing(order.terminalId).filter((c) => !rejected.has(c.id))
  const laneRates = serving.map((c) => c.rates[laneKey]).filter((r): r is number => typeof r === 'number')
  const bestRate = laneRates.length ? Math.min(...laneRates) : 1
  const orders = allOrders(state)

  const scored = serving.map((c) => {
    const delivered = orders.filter((o) => carrierIdOf(o, state) === c.id && statusOf(o, state) === 'delivery_completed')
    const onTimeCount = delivered.filter((o) => onTimeOf(o, state)).length
    const onTimePct = delivered.length ? onTimeCount / delivered.length : 0.85
    const active = orders.filter((o) => carrierIdOf(o, state) === c.id && ACTIVE.includes(statusOf(o, state))).length
    const freeTrucks = Math.max(0, c.trucks - active)
    const rate = c.rates[laneKey] ?? bestRate * 1.1
    const km = Math.round(haversineKm(c.yard, terminal.latLng) * 1.18)
    const lane = c.terminals.includes(order.terminalId) && c.regions.includes(shipTo.region) ? 1 : 0.5
    const factors = [
      { key: 'lane', weight: WEIGHTS.lane, value: lane, text: lane === 1 ? `Serves ${terminal.city} → ${shipTo.city} under contract` : `Serves the terminal, not this region` },
      { key: 'onTime', weight: WEIGHTS.onTime, value: onTimePct, text: `${Math.round(onTimePct * 100)}% on time over ${delivered.length} loads` },
      { key: 'rate', weight: WEIGHTS.rate, value: Math.min(1, bestRate / rate), text: `$${rate.toFixed(2)}/t on contract${rate === bestRate ? ' · lowest on the lane' : ''}` },
      { key: 'capacity', weight: WEIGHTS.capacity, value: Math.min(1, freeTrucks / 3), text: `${freeTrucks} truck${freeTrucks === 1 ? '' : 's'} free today` },
      { key: 'distance', weight: WEIGHTS.distance, value: Math.max(0, 1 - km / 400), text: `Yard ${km} km from the terminal` },
    ]
    const score = Math.round(factors.reduce((s, f) => s + f.weight * f.value, 0))
    return { c, score, factors, onTimePct, freeTrucks, rate }
  })

  return scored
    .sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name))
    .slice(0, 3)
    .map((s, i) => ({
      carrierId: s.c.id,
      carrierName: s.c.name,
      hasTms: s.c.hasTms,
      score: s.score,
      rank: (i + 1) as 1 | 2 | 3,
      factors: s.factors,
      rationale: s.factors.map((f) => f.text).join(' · '),
      onTimePct: s.onTimePct,
      freeTrucks: s.freeTrucks,
      ratePerTonne: s.rate,
    }))
}

export const CARRIER_COUNT = CARRIERS.length
