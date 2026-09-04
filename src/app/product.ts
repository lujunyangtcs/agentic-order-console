/**
 * Product and tenant identity, in one place.
 *
 * Two things live here that used to be spread across the shell, and both are
 * deliberate.
 *
 * `PRODUCT` is ABC's identity — the thing being sold. `TENANT` is the
 * customer's. The visual system keeps them apart on purpose (§10.2): the
 * product accent is ABC teal, the tenant accent is Tenant blue, and the
 * top bar shows the tenant first because that is whose data the planner is
 * looking at.
 *
 * `CONNECTOR_PROFILE` exists because §6.1 models the system of record as
 * an abstraction, not a vendor. No component may hardcode an ERP name into a
 * layout, a label or a state machine (FR-038) — every vendor-specific string
 * is read from here. the tenant's actual ERP is an assumption rated Low in the design notes
 * §1.1, so a build that requires a code change to rename it has failed the
 * requirement.
 */

export const PRODUCT = {
  name: 'Inventory Intelligence',
  vendor: 'ABC',
  /** Shown in the tenant chip beside the customer name. */
  chip: 'Inventory Intelligence',
} as const

/**
 * The tenant is synthetic, and that is a product decision rather than a privacy
 * one.
 *
 * This demo is meant to be shown to more than one prospect. A build branded to
 * a named customer has to be re-skinned for the next conversation, and until it
 * is, the room is being asked to imagine themselves as somebody else. ABC
 * is a plausible mid-size industrial manufacturer and is nobody — which means
 * the same build walks into every meeting.
 *
 * The *domain* is real and stays: configure-to-order industrial equipment, a
 * dozen voltage variants per model, two to three hundred components each drawn
 * from a shared pool. That is the problem the product solves, and it belongs to
 * no single manufacturer.
 */
export const TENANT = {
  name: 'ABC Manufacturing',
  site: 'Plant A',
  /** §10.2 requires this disclosure in the tenant area of every page. */
  dataNotice: 'Synthetic demo data',
} as const

export type ConnectorProfile = {
  /** Display name wherever the system of record is named in prose or a button. */
  displayName: string
  /** Shorthand for dense surfaces (connector cards, audit rows). */
  shortName: string
  /**
   * Whether the vendor is confirmed. False renders the
   * `Example connector — confirm at discovery` marker (§1.1 A-01).
   */
  confirmed: boolean
  /** How the ERP's own reference numbers look, for the write-back result. */
  referenceFormat: string
  /** Entity names, so screens can say "requisition" or whatever the ERP calls it. */
  labels: {
    requisition: string
    purchaseOrder: string
    item: string
    warehouse: string
  }
}

export const CONNECTOR_PROFILE: ConnectorProfile = {
  displayName: 'ABC ERP',
  shortName: 'ABC ERP',
  confirmed: false,
  referenceFormat: 'PR-######',
  labels: {
    requisition: 'requisition',
    purchaseOrder: 'purchase order',
    item: 'item',
    warehouse: 'warehouse',
  },
}

/** The demo's fixed "today". Every fixture date is an offset from this. */
export const DEMO_TODAY = '2026-08-26'
