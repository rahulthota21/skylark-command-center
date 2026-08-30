import "server-only";

import type { AnalysisAnswer, Clarification, LeadershipUpdate } from "@/lib/api/types";
import { narrate } from "@/lib/ai/narrative";
import { planQuestion } from "@/lib/ai/planner";
import { analyze } from "@/lib/analytics/metrics";
import type { QueryIntent } from "@/lib/analytics/types";
import type { DataContext } from "@/lib/data/types";

function quickClarification(question: string, context: DataContext, intent: QueryIntent): AnalysisAnswer {
  const latest = context.quality.dateCoverage.latest;
  const options: Clarification["options"] = latest
    ? [
        {
          label: "Use the latest quarter in the data",
          prompt: question
            .replace(/\b(this|current)\s+quarter\b/i, "the latest quarter represented in the data")
            .replace(/\bthis quarter\b/i, "the latest quarter represented in the data"),
        },
        {
          label: "Use the current calendar quarter anyway",
          prompt: question,
        },
      ]
    : [
        {
          label: "Use all available records",
          prompt: question.replace(/\b(this|current)\s+quarter\b/i, "across all available dates"),
        },
      ];

  return {
    status: "clarification",
    question,
    headline: "A quick clarification will make this forecast reliable.",
    executiveSummary:
      intent.clarificationQuestion ||
      "The requested time period is ambiguous relative to the available board data.",
    metrics: [],
    insights: [
      "No business metric was calculated yet, so the agent does not accidentally present a historical data set as a current forecast.",
    ],
    risks: [],
    actions: ["Choose a period below or rephrase the question with a specific date range."],
    assumptions: intent.assumptions,
    caveats: [
      `Available board date coverage: ${context.quality.dateCoverage.earliest || "unknown"} to ${context.quality.dateCoverage.latest || "unknown"}.`,
    ],
    evidence: [],
    followUps: options.map((option) => option.prompt),
    clarification: {
      question:
        intent.clarificationQuestion ||
        "Would you like to use the latest quarter represented in the data?",
      options,
    },
    syncedAt: context.syncedAt,
    cacheState: context.cacheState,
  };
}

export async function answerQuestion(
  question: string,
  context: DataContext,
): Promise<AnalysisAnswer> {
  const planned = await planQuestion(question, context);
  if (planned.intent.needsClarification) {
    return quickClarification(question, context, planned.intent);
  }

  const analysis = analyze(context, planned.intent);
  const narrative = await narrate(analysis);
  return {
    status: analysis.kind === "unsupported" ? "unsupported" : "answer",
    question,
    headline: narrative.headline,
    executiveSummary: narrative.executiveSummary,
    metrics: analysis.metrics,
    insights: narrative.insights,
    risks: narrative.risks,
    actions: narrative.actions,
    assumptions: analysis.assumptions,
    caveats: analysis.caveats,
    evidence: analysis.evidence.filter((group) => group.records.length > 0),
    chart: analysis.chart,
    followUps: narrative.followUps.length ? narrative.followUps : analysis.followUps,
    engineNote:
      planned.usedLlm || narrative.usedLlm
        ? undefined
        : "Deterministic analysis is shown. Configure LLM_API_KEY to enable structured AI intent interpretation and executive narrative refinement.",
    syncedAt: context.syncedAt,
    cacheState: context.cacheState,
  };
}

function indiaDateTime(now = new Date()): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(now);
}

function markdownSection(title: string, bullets: string[]): string {
  return `## ${title}\n${bullets.map((bullet) => `- ${bullet}`).join("\n")}`;
}

export async function createLeadershipUpdate(context: DataContext): Promise<LeadershipUpdate> {
  const baseIntent: QueryIntent = {
    intent: "pipeline_overview",
    asksForComparison: false,
    needsClarification: false,
    assumptions: ["Leadership update is a live point-in-time snapshot of the connected boards."],
  };
  const pipeline = analyze(context, baseIntent);
  const execution = analyze(context, { ...baseIntent, intent: "execution_health" });
  const cash = analyze(context, { ...baseIntent, intent: "cash_collection" });
  const risks = analyze(context, { ...baseIntent, intent: "risk_review" });
  const generatedAt = indiaDateTime();

  const sections = [
    {
      title: "Pipeline",
      bullets: [
        pipeline.headline,
        ...pipeline.metrics.slice(1, 3).map((entry) => `${entry.label}: ${entry.value}${entry.detail ? ` — ${entry.detail}` : ""}`),
      ],
    },
    {
      title: "Execution",
      bullets: [
        execution.headline,
        ...execution.metrics.slice(0, 3).map((entry) => `${entry.label}: ${entry.value}${entry.detail ? ` — ${entry.detail}` : ""}`),
      ],
    },
    {
      title: "Billing & collections",
      bullets: [
        cash.headline,
        ...cash.metrics.slice(1, 4).map((entry) => `${entry.label}: ${entry.value}${entry.detail ? ` — ${entry.detail}` : ""}`),
      ],
    },
    {
      title: "Top risks",
      bullets: risks.risks.slice(0, 4),
    },
    {
      title: "Decisions & support requested",
      bullets: risks.actions.slice(0, 3),
    },
    {
      title: "Data confidence",
      bullets: [
        context.quality.summary,
        `Cross-board linking: ${context.quality.linkage.exact} exact, ${context.quality.linkage.probable} probable, and ${context.quality.linkage.unmatched} unmatched work-order records.`,
        ...[...pipeline.caveats, ...execution.caveats, ...cash.caveats].slice(0, 3),
      ],
    },
  ];

  const headline = `${pipeline.headline} ${execution.headline}`;
  const markdown = [
    `# Leadership Update`,
    `*Generated ${generatedAt} from live monday.com boards*`,
    "",
    `**Headline:** ${headline}`,
    "",
    ...sections.map((section) => markdownSection(section.title, section.bullets)),
    "",
    "## Assumptions",
    ...[...pipeline.assumptions, ...execution.assumptions, ...cash.assumptions]
      .slice(0, 5)
      .map((assumption) => `- ${assumption}`),
  ].join("\n");

  return {
    title: `Leadership Update — ${generatedAt}`,
    generatedAt,
    headline,
    markdown,
    sections,
    assumptions: [...new Set([...pipeline.assumptions, ...execution.assumptions])].slice(0, 6),
    caveats: [...new Set([...pipeline.caveats, ...execution.caveats])].slice(0, 6),
    evidence: [...pipeline.evidence, ...execution.evidence, ...risks.evidence]
      .filter((group) => group.records.length > 0)
      .slice(0, 4),
    syncedAt: context.syncedAt,
  };
}
