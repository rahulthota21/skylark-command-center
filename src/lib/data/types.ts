export type BoardKind = "deals" | "workOrders";

export type ColumnType = string;

export interface MondayColumn {
  id: string;
  title: string;
  type: ColumnType;
  settings?: unknown;
}

export interface MondayColumnValue {
  id: string;
  text: string | null;
  value: string | null;
  type?: string | null;
}

export interface MondayItem {
  id: string;
  name: string;
  url?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  columnValues: MondayColumnValue[];
}

export interface MondayBoard {
  id: string;
  name: string;
  columns: MondayColumn[];
  items: MondayItem[];
}

export type Severity = "info" | "warning" | "critical";

export interface DataWarning {
  code:
    | "MISSING_VALUE"
    | "INVALID_DATE"
    | "AMBIGUOUS_DATE"
    | "INVALID_MONEY"
    | "MISSING_CURRENCY"
    | "CURRENCY_ASSUMPTION"
    | "INVALID_PROBABILITY"
    | "QUALITATIVE_PROBABILITY"
    | "EMBEDDED_HEADER_ARTIFACT"
    | "UNKNOWN_STAGE"
    | "UNKNOWN_STATUS"
    | "UNKNOWN_SECTOR"
    | "UNCERTAIN_MAPPING"
    | "UNMATCHED_ENTITY"
    | "PROBABLE_ENTITY_MATCH"
    | "MIXED_CURRENCY";
  severity: Severity;
  field?: string;
  message: string;
}

export interface SourceRef {
  board: BoardKind;
  boardName: string;
  itemId: string;
  itemName: string;
  url?: string;
  updatedAt?: string;
}

export interface MoneyValue {
  amount: number;
  /** ISO-like marker if detected. Undefined means the source did not state a currency. */
  currency?: string;
  /** True when the currency comes from documented column/board context, not the cell itself. */
  currencyInferred?: boolean;
  raw: string;
}

export type DealStageCategory = "active" | "won" | "lost" | "unknown";
export type WorkOrderStatusCategory =
  | "on_track"
  | "at_risk"
  | "complete"
  | "unknown";

export interface NormalizedDeal {
  source: SourceRef;
  raw: Record<string, string | null>;
  displayName: string;
  /** A masked deal label used for conservative cross-board group matching. */
  linkName?: string;
  linkKey?: string;
  accountName?: string;
  accountKey?: string;
  clientCode?: string;
  sector?: string;
  sectorKey?: string;
  stage?: string;
  dealStatus?: string;
  /** Lifecycle category, preferring a dedicated Deal Status field when available. */
  stageCategory: DealStageCategory;
  amount?: MoneyValue;
  probability?: number;
  probabilityKind?: "numeric" | "qualitative";
  expectedCloseDate?: string;
  createdDate?: string;
  owner?: string;
  isHeaderArtifact?: boolean;
  warnings: DataWarning[];
}

export interface NormalizedWorkOrder {
  source: SourceRef;
  raw: Record<string, string | null>;
  displayName: string;
  /** Source deal label; may be a group-level rather than one-to-one join key. */
  linkName?: string;
  linkKey?: string;
  accountName?: string;
  accountKey?: string;
  clientCode?: string;
  identifier?: string;
  sector?: string;
  sectorKey?: string;
  status?: string;
  statusCategory: WorkOrderStatusCategory;
  /** Contract / work-order value, using the mapped consistent tax basis. */
  amount?: MoneyValue;
  billedValue?: MoneyValue;
  collectedAmount?: MoneyValue;
  unbilledAmount?: MoneyValue;
  receivableAmount?: MoneyValue;
  invoiceStatus?: string;
  billingStatus?: string;
  dueDate?: string;
  startDate?: string;
  deliveryDate?: string;
  progress?: number;
  owner?: string;
  isHeaderArtifact?: boolean;
  warnings: DataWarning[];
}

export type SemanticField =
  | "itemName"
  | "account"
  | "clientCode"
  | "linkedDealName"
  | "sector"
  | "stage"
  | "dealStatus"
  | "amount"
  | "billedValue"
  | "collectedAmount"
  | "unbilledAmount"
  | "receivableAmount"
  | "probability"
  | "closeDate"
  | "createdDate"
  | "deliveryDate"
  | "invoiceStatus"
  | "billingStatus"
  | "owner"
  | "identifier"
  | "status"
  | "dueDate"
  | "startDate"
  | "progress";

export interface FieldMapping {
  field: SemanticField;
  columnId?: string;
  columnTitle: string;
  confidence: "high" | "medium" | "low" | "missing";
  score: number;
  reason: string;
}

export interface BoardMapping {
  kind: BoardKind;
  boardId: string;
  boardName: string;
  fields: FieldMapping[];
}

export type MatchConfidence = "exact" | "grouped" | "probable" | "unmatched";

export interface EntityLink {
  workOrderId: string;
  /** Kept for a simple primary evidence link; use dealIds for group-level joins. */
  dealId?: string;
  dealIds?: string[];
  accountKey?: string;
  confidence: MatchConfidence;
  score?: number;
  reason: string;
}

export interface DateCoverage {
  earliest?: string;
  latest?: string;
}

export interface BoardReadiness {
  board: BoardKind;
  boardName: string;
  recordCount: number;
  mappedFields: FieldMapping[];
  missingFields: string[];
  parseCoverage: Array<{
    label: string;
    parsed: number;
    totalRelevant: number;
    percent: number;
  }>;
}

export interface DataQualityReport {
  overallLabel: "strong" | "usable_with_caveats" | "limited";
  summary: string;
  boardReadiness: BoardReadiness[];
  warnings: DataWarning[];
  dateCoverage: DateCoverage;
  linkage: {
    exact: number;
    grouped: number;
    probable: number;
    unmatched: number;
  };
  observedSectors: string[];
  observedStages: string[];
  observedStatuses: string[];
}

export interface DataContext {
  dealsBoard: MondayBoard;
  workOrdersBoard: MondayBoard;
  deals: NormalizedDeal[];
  workOrders: NormalizedWorkOrder[];
  dealMapping: BoardMapping;
  workOrderMapping: BoardMapping;
  links: EntityLink[];
  quality: DataQualityReport;
  syncedAt: string;
  cacheState: "fresh" | "cached" | "stale";
}
