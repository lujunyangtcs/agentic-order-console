import type { Api } from './contracts'
import { mockApi } from './mock'

/** Swap point. When a real backend exists this becomes a runtime choice;
 *  no component changes. */
export const api: Api = mockApi

export type { Api } from './contracts'
export type {
  WorklistFilter, WorklistRow, WorklistSummary, OrderDocument, Eta, Lane, OrderDetail, OrderLock,
  HistoryFilter, HistoryRow, Recommendation, InboxRow, RequestRow, RequestsSummary, AuditEntry,
  ActivityItem, AdvanceResult, TruckPosition, YardRow, DispatchColumn, ScorecardRow, ScorecardWeights,
  ReportSpec, ReportPoint, ReportResult, BenchmarkPoint, BenchmarkSeries, WorkloadCell, LiveAnalytics,
  NewUser, ArchModule, Connector, Actor, DeviationDraft, CustomerOrderDraft, NotificationView,
  Observation, AnalysisSentence,
} from './contracts'
