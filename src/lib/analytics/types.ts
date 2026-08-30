import type { CalendarRange } from "@/lib/date";
import type { ChartDatum, EvidenceGroup, MetricCard } from "@/lib/api/types";
import type { SourceRef } from "@/lib/data/types";

export type IntentKind =
  | "pipeline_overview"
  | "sector_comparison"
  | "execution_health"
  | "cash_collection"
  | "risk_review"
  | "account_view"
  | "leadership_update"
  | "unsupported";

export interface QueryIntent {
  intent: IntentKind;
  sector?: string;
  account?: string;
  stage?: string;
  dateRange?: CalendarRange;
  dateRangeKind?:
    | "current_calendar_quarter"
    | "previous_calendar_quarter"
    | "latest_available_quarter"
    | "explicit"
    | "none";
  asksForComparison: boolean;
  needsClarification: boolean;
  clarificationQuestion?: string;
  assumptions: string[];
}

export interface AnalysisResult {
  kind: IntentKind;
  headline: string;
  metrics: MetricCard[];
  insights: string[];
  risks: string[];
  actions: string[];
  assumptions: string[];
  caveats: string[];
  evidence: EvidenceGroup[];
  chart?: {
    title: string;
    subtitle: string;
    data: ChartDatum[];
    unitLabel: string;
  };
  followUps: string[];
  records: SourceRef[];
}

export interface AmountAggregate {
  /** Value is omitted when more than one currency group would make a single sum misleading. */
  total?: number;
  currency?: string;
  groups: Array<{ currencyLabel: string; total: number; count: number }>;
  count: number;
  excludedCount: number;
}
