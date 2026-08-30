import type {
  BoardReadiness,
  DataQualityReport,
  SourceRef,
} from "@/lib/data/types";

export type AppConnectionStatus =
  | "connected"
  | "setup_required"
  | "unavailable";

export interface MetricCard {
  id: string;
  label: string;
  value: string;
  detail?: string;
  tone?: "neutral" | "positive" | "attention" | "muted";
}

export interface ChartDatum {
  name: string;
  value: number;
  formattedValue?: string;
  color?: string;
}

export interface EvidenceGroup {
  title: string;
  description?: string;
  records: SourceRef[];
}

export interface DashboardSnapshot {
  metrics: MetricCard[];
  chart: {
    title: string;
    subtitle: string;
    data: ChartDatum[];
    unitLabel: string;
  } | null;
}

export interface HealthResponse {
  status: AppConnectionStatus;
  message?: string;
  syncedAt?: string;
  cacheState?: "fresh" | "cached" | "stale";
  boards?: Array<{ kind: "deals" | "workOrders"; name: string; recordCount: number }>;
  quality?: DataQualityReport;
  snapshot?: DashboardSnapshot;
  setup?: {
    requiredVariables: string[];
    instructions: string[];
  };
}

export interface Clarification {
  question: string;
  options: Array<{ label: string; prompt: string }>;
}

export interface AnalysisAnswer {
  status: "answer" | "clarification" | "unsupported";
  question: string;
  headline: string;
  executiveSummary: string;
  metrics: MetricCard[];
  insights: string[];
  risks: string[];
  actions: string[];
  assumptions: string[];
  caveats: string[];
  evidence: EvidenceGroup[];
  chart?: DashboardSnapshot["chart"];
  followUps: string[];
  clarification?: Clarification;
  engineNote?: string;
  syncedAt: string;
  cacheState: "fresh" | "cached" | "stale";
}

export interface AskResponse {
  status: AppConnectionStatus;
  answer?: AnalysisAnswer;
  message?: string;
}

export interface LeadershipUpdate {
  title: string;
  generatedAt: string;
  headline: string;
  markdown: string;
  sections: Array<{
    title: string;
    bullets: string[];
  }>;
  assumptions: string[];
  caveats: string[];
  evidence: EvidenceGroup[];
  syncedAt: string;
}

export interface LeadershipResponse {
  status: AppConnectionStatus;
  update?: LeadershipUpdate;
  message?: string;
}

export type ReadinessItem = BoardReadiness;
