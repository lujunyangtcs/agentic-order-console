/**
 * Product identity and the systems it sits on top of, in one place.
 *
 * The console is deliberately vendor-neutral: it carries a product name and
 * nothing else. The tenant is a synthetic cement business so the same build
 * can walk into more than one room.
 *
 * `SYSTEMS` names the systems of record. Every screen that mentions the ERP,
 * the order-entry tool or the billing platform reads the name from here —
 * a build that needs a code change to rename them has failed.
 */

export const PRODUCT = {
  name: 'Agentic Order Management Console',
  short: 'Order Console',
  chip: 'Order Console',
} as const

export const TENANT = {
  name: 'Cement Operations Canada',
  dataNotice: 'Synthetic demo data',
} as const

export const SYSTEMS = {
  /** Order creation, bill-of-lading printing at the scale, carrier payment. */
  erp: 'SAP',
  /** The order-entry front end the service desk types into. */
  orders: 'ORA',
  /** Customer invoicing and payment. */
  billing: 'DirectA',
  /** Carrier transport management systems, reached over EDI/API. */
  carrierTms: 'Carrier TMS',
  /** The terminal's weigh scale prints the bill of lading. */
  scale: 'Weigh scale',
  /** Third-party arrival-time provider the ETA can be enriched from. */
  eta: 'ETA provider',
  /** IT service database where the application and its users are registered. */
  itsm: 'ServiceNow',
} as const

export type ConnectorProfile = {
  displayName: string
  shortName: string
  confirmed: boolean
  referenceFormat: string
}

/** The ERP as the build-gate sees it: its display name must not be repeated
 *  in components — read it from here or from `SYSTEMS`. */
export const CONNECTOR_PROFILE: ConnectorProfile = {
  displayName: SYSTEMS.erp,
  shortName: SYSTEMS.erp,
  confirmed: true,
  referenceFormat: '45########',
}

/** The demo's fixed "today". Every fixture date is an offset from this. */
export const DEMO_TODAY = '2026-09-04'
