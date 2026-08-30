import { z } from "zod";

export const intentKindSchema = z.enum([
  "pipeline_overview",
  "sector_comparison",
  "execution_health",
  "cash_collection",
  "risk_review",
  "account_view",
  "leadership_update",
  "unsupported",
]);

export const plannerOutputSchema = z.object({
  intent: intentKindSchema,
  sector: z.string().trim().max(100).optional(),
  account: z.string().trim().max(160).optional(),
  stage: z.string().trim().max(100).optional(),
  dateRangeKind: z
    .enum([
      "current_calendar_quarter",
      "previous_calendar_quarter",
      "latest_available_quarter",
      "explicit",
      "none",
    ])
    .default("none"),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  asksForComparison: z.boolean().default(false),
  needsClarification: z.boolean().default(false),
  clarificationQuestion: z.string().trim().max(280).optional(),
  assumptions: z.array(z.string().trim().max(220)).max(5).default([]),
});

export type PlannerOutput = z.infer<typeof plannerOutputSchema>;

export const narrativeOutputSchema = z.object({
  headline: z.string().trim().max(220),
  executiveSummary: z.string().trim().max(700),
  insights: z.array(z.string().trim().max(300)).max(5),
  risks: z.array(z.string().trim().max(300)).max(5),
  actions: z.array(z.string().trim().max(300)).max(5),
  followUps: z.array(z.string().trim().max(180)).max(4),
});

export type NarrativeOutput = z.infer<typeof narrativeOutputSchema>;
