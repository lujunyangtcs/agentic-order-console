import type { Api } from './contracts'
import { mockApi } from './mock'

/** Swap point. When a real backend exists this becomes a runtime choice;
 *  no component changes. */
export const api: Api = mockApi

export type { Api } from './contracts'
export type {
  ActivityItem, CommandCenterSummary, Observation, AnalysisSentence, ActionQueueRow, ReasonCount,
  ExposureRow, StationExposure,
  OrderRow, TrailStep, MaterialLine, OrderImpact, CandidateRow,
  PostBuildRow, PostBuildPanel, RequisitionProposal,
  RequisitionLineRow, RequisitionGroup, RequisitionSet, ValidationCheck,
  WriteBackStage, WriteBackResult, WriteBackFailure, ApprovalEmail, AuditEntry,
  InventoryRow, DriverTerm, ProjectionPoint, ProjectionEvent,
  EmailEvidence, Alternative, SkuDetail,
  AnalyticsFilters, KpiValue, Categorical, Stacked, Scatter, Series, DrillRow, Report,
  InventoryHealthReport, SafetyStockReport, ProcurementReport, VariantReport,
  Connector,
} from './contracts'
