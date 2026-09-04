import type { Carrier, Customer, ShipTo, Terminal, Truck } from '@/types/domain'
import { haversineKm } from './geo'

/**
 * The physical network: terminals, customer sites, carriers and trucks.
 *
 * Terminal names are real Canadian cement sites, used as places on a map.
 * Customers and carriers are fictional. Every coordinate sits inside Canada;
 * the build gate checks.
 */

export const TERMINALS: Terminal[] = [
  { id: 'TERM-BATH', name: 'Bath terminal', city: 'Bath', province: 'ON', region: 'ECAN', latLng: [44.186, -76.782] },
  { id: 'TERM-STCON', name: 'Saint-Constant terminal', city: 'Saint-Constant', province: 'QC', region: 'ECAN', latLng: [45.371, -73.566] },
  { id: 'TERM-MISS', name: 'Mississauga terminal', city: 'Mississauga', province: 'ON', region: 'ECAN', latLng: [43.589, -79.644] },
  { id: 'TERM-EXSHAW', name: 'Exshaw terminal', city: 'Exshaw', province: 'AB', region: 'WCAN', latLng: [51.061, -115.157] },
  { id: 'TERM-RICH', name: 'Richmond terminal', city: 'Richmond', province: 'BC', region: 'WCAN', latLng: [49.166, -123.134] },
]

export const CUSTOMERS: Customer[] = [
  { id: 'CUST-01', name: 'Northgate Ready-Mix', language: 'en', contact: 'J. Okafor' },
  { id: 'CUST-02', name: 'Capital Precast', language: 'en', contact: 'S. Lavoie' },
  { id: 'CUST-03', name: 'Béton Laval', language: 'fr', contact: 'M. Gagnon' },
  { id: 'CUST-04', name: 'Montréal Concrete Works', language: 'fr', contact: 'C. Bouchard' },
  { id: 'CUST-05', name: 'Hamilton Aggregates', language: 'en', contact: 'R. Patel' },
  { id: 'CUST-06', name: 'Lakeshore Concrete', language: 'en', contact: 'T. Nguyen' },
  { id: 'CUST-07', name: 'Foothills Ready-Mix', language: 'en', contact: 'K. Brandt' },
  { id: 'CUST-08', name: 'Bow Valley Builders', language: 'en', contact: 'L. Fraser' },
  { id: 'CUST-09', name: 'Pacific Precast', language: 'en', contact: 'A. Chen' },
  { id: 'CUST-10', name: 'Fraser Ready-Mix', language: 'en', contact: 'D. Singh' },
]

export const SHIP_TOS: ShipTo[] = [
  { id: 'ST-01', customerId: 'CUST-01', name: 'Northgate Kingston plant', city: 'Kingston', province: 'ON', region: 'ECAN', latLng: [44.231, -76.486], unloadMinutes: 45 },
  { id: 'ST-11', customerId: 'CUST-01', name: 'Northgate Belleville yard', city: 'Belleville', province: 'ON', region: 'ECAN', latLng: [44.163, -77.383], unloadMinutes: 40 },
  { id: 'ST-02', customerId: 'CUST-02', name: 'Capital Precast Ottawa', city: 'Ottawa', province: 'ON', region: 'ECAN', latLng: [45.421, -75.697], unloadMinutes: 40 },
  { id: 'ST-03', customerId: 'CUST-03', name: 'Béton Laval usine', city: 'Laval', province: 'QC', region: 'ECAN', latLng: [45.606, -73.712], unloadMinutes: 40 },
  { id: 'ST-04', customerId: 'CUST-04', name: 'Montréal Concrete east yard', city: 'Montréal', province: 'QC', region: 'ECAN', latLng: [45.508, -73.561], unloadMinutes: 50 },
  { id: 'ST-05', customerId: 'CUST-05', name: 'Hamilton Aggregates dock', city: 'Hamilton', province: 'ON', region: 'ECAN', latLng: [43.256, -79.871], unloadMinutes: 45 },
  { id: 'ST-06', customerId: 'CUST-06', name: 'Lakeshore Toronto silo', city: 'Toronto', province: 'ON', region: 'ECAN', latLng: [43.653, -79.383], unloadMinutes: 55 },
  { id: 'ST-07', customerId: 'CUST-07', name: 'Foothills Calgary plant', city: 'Calgary', province: 'AB', region: 'WCAN', latLng: [51.045, -114.058], unloadMinutes: 40 },
  { id: 'ST-08', customerId: 'CUST-08', name: 'Bow Valley Canmore site', city: 'Canmore', province: 'AB', region: 'WCAN', latLng: [51.089, -115.359], unloadMinutes: 35 },
  { id: 'ST-09', customerId: 'CUST-09', name: 'Pacific Precast Vancouver', city: 'Vancouver', province: 'BC', region: 'WCAN', latLng: [49.283, -123.121], unloadMinutes: 50 },
  { id: 'ST-10', customerId: 'CUST-10', name: 'Fraser Surrey batch plant', city: 'Surrey', province: 'BC', region: 'WCAN', latLng: [49.104, -122.801], unloadMinutes: 45 },
]

/** Which terminal serves which site. One lane per site keeps the map legible. */
export const LANES: Record<string, string> = {
  'ST-01': 'TERM-BATH',
  'ST-11': 'TERM-BATH',
  'ST-02': 'TERM-BATH',
  'ST-03': 'TERM-STCON',
  'ST-04': 'TERM-STCON',
  'ST-05': 'TERM-MISS',
  'ST-06': 'TERM-MISS',
  'ST-07': 'TERM-EXSHAW',
  'ST-08': 'TERM-EXSHAW',
  'ST-09': 'TERM-RICH',
  'ST-10': 'TERM-RICH',
}

/** Rate factor and terminals per carrier; the rate table is derived below. */
const CARRIER_BASE: Omit<Carrier, 'rates'>[] = [
  { id: 'CAR-A', name: 'Frontenac Haulage', yard: [44.26, -76.55], province: 'ON', regions: ['ECAN'], terminals: ['TERM-BATH', 'TERM-MISS'], trucks: 14, hasTms: true },
  { id: 'CAR-B', name: 'Lakeshore Bulk Transport', yard: [43.70, -79.50], province: 'ON', regions: ['ECAN'], terminals: ['TERM-MISS', 'TERM-BATH'], trucks: 18, hasTms: true },
  { id: 'CAR-C', name: 'Transport Rive-Sud', yard: [45.53, -73.47], province: 'QC', regions: ['ECAN'], terminals: ['TERM-STCON'], trucks: 12, hasTms: true },
  { id: 'CAR-D', name: 'Capital Carriers', yard: [45.38, -75.72], province: 'ON', regions: ['ECAN'], terminals: ['TERM-BATH', 'TERM-STCON'], trucks: 9, hasTms: true },
  { id: 'CAR-E', name: 'Northbound Freight', yard: [44.17, -77.36], province: 'ON', regions: ['ECAN'], terminals: ['TERM-BATH'], trucks: 6, hasTms: false },
  { id: 'CAR-F', name: 'Laurentides Vrac', yard: [45.61, -73.75], province: 'QC', regions: ['ECAN'], terminals: ['TERM-STCON'], trucks: 7, hasTms: false },
  { id: 'CAR-G', name: 'Golden Horseshoe Haul', yard: [43.27, -79.90], province: 'ON', regions: ['ECAN'], terminals: ['TERM-MISS'], trucks: 10, hasTms: true },
  { id: 'CAR-H', name: 'Foothills Bulk', yard: [51.06, -114.10], province: 'AB', regions: ['WCAN'], terminals: ['TERM-EXSHAW'], trucks: 16, hasTms: true },
  { id: 'CAR-I', name: 'Bow Valley Trucking', yard: [51.09, -115.35], province: 'AB', regions: ['WCAN'], terminals: ['TERM-EXSHAW'], trucks: 5, hasTms: false },
  { id: 'CAR-J', name: 'Pacific Bulk Lines', yard: [49.25, -123.08], province: 'BC', regions: ['WCAN'], terminals: ['TERM-RICH'], trucks: 15, hasTms: true },
  { id: 'CAR-K', name: 'Fraser Valley Haulers', yard: [49.12, -122.85], province: 'BC', regions: ['WCAN'], terminals: ['TERM-RICH'], trucks: 8, hasTms: true },
  { id: 'CAR-L', name: 'Westgate Owner-Operators', yard: [49.17, -123.10], province: 'BC', regions: ['WCAN'], terminals: ['TERM-RICH'], trucks: 4, hasTms: false },
]

/** How the carrier prices against the lane average. Below 1 is cheaper. */
const RATE_FACTOR: Record<string, number> = {
  'CAR-A': 0.96, 'CAR-B': 1.00, 'CAR-C': 0.98, 'CAR-D': 0.93, 'CAR-E': 1.06, 'CAR-F': 1.04,
  'CAR-G': 1.02, 'CAR-H': 0.97, 'CAR-I': 1.08, 'CAR-J': 0.99, 'CAR-K': 1.03, 'CAR-L': 1.10,
}

/** Historical on-time reliability the generator aims for, per carrier. */
export const RELIABILITY: Record<string, number> = {
  'CAR-A': 0.96, 'CAR-B': 0.92, 'CAR-C': 0.90, 'CAR-D': 0.81, 'CAR-E': 0.88, 'CAR-F': 0.85,
  'CAR-G': 0.93, 'CAR-H': 0.94, 'CAR-I': 0.86, 'CAR-J': 0.95, 'CAR-K': 0.90, 'CAR-L': 0.83,
}

/** Median minutes a carrier takes to answer a request, per carrier. */
export const RESPONSE_MINUTES: Record<string, number> = {
  'CAR-A': 14, 'CAR-B': 22, 'CAR-C': 19, 'CAR-D': 51, 'CAR-E': 38, 'CAR-F': 44,
  'CAR-G': 25, 'CAR-H': 17, 'CAR-I': 47, 'CAR-J': 16, 'CAR-K': 29, 'CAR-L': 58,
}

const terminalById = Object.fromEntries(TERMINALS.map((t) => [t.id, t]))
const shipToById = Object.fromEntries(SHIP_TOS.map((s) => [s.id, s]))

function laneRate(terminalId: string, shipToId: string, factor: number): number {
  const km = haversineKm(terminalById[terminalId].latLng, shipToById[shipToId].latLng) * 1.18
  return Math.round((6.2 + km * 0.046) * factor * 100) / 100
}

export const CARRIERS: Carrier[] = CARRIER_BASE.map((c) => {
  const rates: Record<string, number> = {}
  for (const [shipToId, terminalId] of Object.entries(LANES)) {
    if (c.terminals.includes(terminalId)) rates[`${terminalId}>${shipToId}`] = laneRate(terminalId, shipToId, RATE_FACTOR[c.id])
  }
  return { ...c, rates }
})

const DRIVERS = [
  'M. Leblanc', 'A. Kowalski', 'S. Abara', 'J. Fortin', 'D. McKay', 'R. Iyer', 'P. Dufresne', 'T. Olsen',
  'K. Yamada', 'B. Roy', 'L. Gill', 'C. Martin', 'E. Nowak', 'G. Bélanger', 'H. Fraser', 'I. Sato',
  'N. Cormier', 'O. Bakshi', 'Q. Larsen', 'V. Moreau', 'W. Chan', 'Y. Bisson', 'Z. Hamdan', 'F. Girard',
  'A. Sinclair', 'B. Tessier', 'C. Walsh', 'D. Pelletier', 'E. Ruiz', 'F. Thibault', 'G. Nakamura', 'H. Boivin',
  'I. Campbell', 'J. Lalonde', 'K. Osei', 'L. Charbonneau',
]

const PLATE_PREFIX: Record<string, string> = { ON: 'ON', QC: 'QC', AB: 'AB', BC: 'BC' }

/** Two to four trucks per carrier, deterministic. */
export const TRUCKS: Truck[] = CARRIER_BASE.flatMap((c, ci) => {
  const n = 2 + (ci % 3)
  return Array.from({ length: n }, (_, i) => {
    const seq = 1000 + ci * 37 + i * 11
    return {
      id: `TRK-${c.id.slice(-1)}${i + 1}`,
      carrierId: c.id,
      plate: `${PLATE_PREFIX[c.province]} ${String(seq).slice(1)}${String.fromCharCode(65 + ((ci + i) % 26))}`,
      capacityT: i % 2 === 0 ? 38 : 34,
      driver: DRIVERS[(ci * 3 + i) % DRIVERS.length],
    }
  })
})

export const TERMINAL_BY_ID: Record<string, Terminal> = terminalById
export const SHIP_TO_BY_ID: Record<string, ShipTo> = shipToById
export const CUSTOMER_BY_ID: Record<string, Customer> = Object.fromEntries(CUSTOMERS.map((c) => [c.id, c]))
export const CARRIER_BY_ID: Record<string, Carrier> = Object.fromEntries(CARRIERS.map((c) => [c.id, c]))
export const TRUCK_BY_ID: Record<string, Truck> = Object.fromEntries(TRUCKS.map((t) => [t.id, t]))

export function trucksOf(carrierId: string): Truck[] {
  return TRUCKS.filter((t) => t.carrierId === carrierId)
}

export function carriersServing(terminalId: string): Carrier[] {
  return CARRIERS.filter((c) => c.terminals.includes(terminalId))
}
