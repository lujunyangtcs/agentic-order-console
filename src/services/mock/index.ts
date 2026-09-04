import type { Api } from '../contracts'
import { respond, notImplemented } from './latency'
import { whenReady } from './store'
import { nowIso } from '@/fixtures/calendar'

/**
 * Phase-1 stub. Every surface exists so the shell compiles and renders; the
 * domain implementation (fixtures + derive) replaces this file in Phase 2.
 */
const todo = (name: string) => () => notImplemented(name)

export const mockApi: Api = {
  orders: {
    worklist: async () => { await whenReady(); return respond([]) },
    summary: async () => {
      await whenReady()
      return respond({
        newRequests: 0, pendingCarrier: 0, inTransit: 0, needsAttention: 0,
        deliveredToday: 0, onTimePct: 0, dataAsOf: nowIso(),
      })
    },
    detail: todo('orders.detail'),
    history: async () => respond([]),
    lock: async () => respond(null),
    setPriority: todo('orders.setPriority'),
    raiseRequest: todo('orders.raiseRequest'),
    createInErp: todo('orders.createInErp'),
    exceptions: async () => respond([]),
  },
  carrier: {
    recommend: todo('carrier.recommend'),
    request: todo('carrier.request'),
    remind: todo('carrier.remind'),
    expedite: todo('carrier.expedite'),
    requests: async () => respond([]),
    requestsSummary: async () => respond({ open: 0, overdue: 0, rejected: 0, medianResponseMinutes: 0 }),
    inbox: async () => respond([]),
    loads: async () => respond([]),
    respond: todo('carrier.respond'),
    scorecard: async () => respond([]),
    carriers: async () => respond([]),
  },
  tracking: {
    timeline: async () => respond([]),
    advance: todo('tracking.advance'),
    positions: async () => respond([]),
    eta: async () => respond(null),
    yard: async () => respond([]),
    dispatchBoard: async () => respond([]),
  },
  pod: {
    get: async () => respond(null),
    sign: todo('pod.sign'),
    upload: todo('pod.upload'),
    annotate: todo('pod.annotate'),
    fileDeviation: todo('pod.fileDeviation'),
    deviations: async () => respond([]),
  },
  notifications: {
    list: async () => respond([]),
    unreadCount: async () => respond(0),
    markRead: async () => respond(undefined),
    markAllRead: async () => respond(undefined),
    rules: async () => respond([]),
    saveRule: todo('notifications.saveRule'),
    deleteRule: todo('notifications.deleteRule'),
    channels: async () => respond(['email', 'portal', 'sms']),
  },
  reports: {
    build: todo('reports.build'),
    saved: async () => respond([]),
    save: todo('reports.save'),
    benchmark: todo('reports.benchmark'),
    workload: async () => respond([]),
    eventLog: async () => respond([]),
    audit: async () => respond([]),
    live: todo('reports.live'),
  },
  admin: {
    users: async () => respond([]),
    createUser: todo('admin.createUser'),
    setRole: todo('admin.setRole'),
    tickets: async () => respond([]),
    security: async () => respond({ ssoProvider: 'entra', mfaRequired: true, sessionMinutes: 480, defaultLanguage: 'en' }),
    setSecurity: todo('admin.setSecurity'),
    architecture: async () => respond([]),
  },
  activity: {
    recent: async () => respond([]),
  },
  integrations: {
    connectors: async () => respond([]),
  },
}
