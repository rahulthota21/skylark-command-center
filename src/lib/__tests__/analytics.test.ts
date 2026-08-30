import { describe, expect, it } from "vitest";

import { analyze, aggregateAmounts } from "@/lib/analytics/metrics";
import type { QueryIntent } from "@/lib/analytics/types";
import type { DataContext, NormalizedDeal, NormalizedWorkOrder } from "@/lib/data/types";

const source = (board: "deals" | "workOrders", id: string, itemName: string) => ({ board, boardName: board === "deals" ? "Deals" : "Work Orders", itemId: id, itemName });

const deal = (overrides: Partial<NormalizedDeal>): NormalizedDeal => ({
  source: source("deals", "d-1", "Deal"), raw: {}, displayName: "Deal", accountName: "Acme", accountKey: "acme", sector: "Energy", sectorKey: "energy", stage: "Proposal", stageCategory: "active", warnings: [], ...overrides,
});
const workOrder = (overrides: Partial<NormalizedWorkOrder>): NormalizedWorkOrder => ({
  source: source("workOrders", "w-1", "Work order"), raw: {}, displayName: "Work order", accountName: "Acme", accountKey: "acme", sector: "Energy", sectorKey: "energy", status: "On Track", statusCategory: "on_track", warnings: [], ...overrides,
});

function context(): DataContext {
  const deals = [
    deal({ source: source("deals", "active", "Energy proposal"), amount: { amount: 100000, currency: "INR", raw: "₹100,000" }, probability: 0.5, expectedCloseDate: "2026-09-15" }),
    deal({ source: source("deals", "missing-prob", "Incomplete deal"), amount: { amount: 200000, currency: "INR", raw: "₹200,000" }, probability: undefined, expectedCloseDate: "2026-09-20" }),
    deal({ source: source("deals", "won", "Closed deal"), amount: { amount: 900000, currency: "INR", raw: "₹900,000" }, probability: 1, stage: "Won", stageCategory: "won", expectedCloseDate: "2026-09-21" }),
  ];
  const workOrders = [
    workOrder({ source: source("workOrders", "late", "Late project"), displayName: "Late project", status: "On Track", dueDate: "2020-01-01", amount: { amount: 50000, currency: "INR", raw: "₹50,000" } }),
    workOrder({ source: source("workOrders", "complete", "Delivered project"), displayName: "Delivered project", status: "Complete", statusCategory: "complete", dueDate: "2020-01-01" }),
  ];
  return {
    dealsBoard: { id: "1", name: "Deals", columns: [], items: [] },
    workOrdersBoard: { id: "2", name: "Work Orders", columns: [], items: [] },
    deals,
    workOrders,
    dealMapping: { kind: "deals", boardId: "1", boardName: "Deals", fields: [] },
    workOrderMapping: { kind: "workOrders", boardId: "2", boardName: "Work Orders", fields: [] },
    links: [{ workOrderId: "late", dealId: "active", accountKey: "acme", confidence: "exact", score: 1, reason: "exact" }],
    quality: { overallLabel: "strong", summary: "ready", boardReadiness: [], warnings: [], dateCoverage: { earliest: "2020-01-01", latest: "2026-09-21" }, linkage: { exact: 1, grouped: 0, probable: 0, unmatched: 1 }, observedSectors: ["Energy"], observedStages: ["Proposal", "Won"], observedStatuses: ["On Track", "Complete"] },
    syncedAt: "2026-08-30T00:00:00.000Z", cacheState: "fresh",
  };
}

const pipelineIntent: QueryIntent = { intent: "pipeline_overview", asksForComparison: false, needsClarification: false, assumptions: [] };

describe("deterministic analytics", () => {
  it("does not combine mixed currency groups into a misleading total", () => {
    const aggregate = aggregateAmounts([
      { amount: { amount: 100, currency: "INR", raw: "₹100" } },
      { amount: { amount: 100, currency: "USD", raw: "$100" } },
    ]);
    expect(aggregate.total).toBeUndefined();
    expect(aggregate.groups).toHaveLength(2);
  });

  it("excludes won deals from active pipeline and excludes missing probability from weighted pipeline", () => {
    const result = analyze(context(), pipelineIntent);
    expect(result.metrics.find((item) => item.id === "active-pipeline")?.value).toContain("₹3.0L");
    expect(result.metrics.find((item) => item.id === "weighted-pipeline")?.value).toContain("₹50.0K");
    expect(result.caveats.join(" ")).toContain("lack a valid probability");
  });

  it("flags past-due non-complete work orders but not completed work", () => {
    const result = analyze(context(), { ...pipelineIntent, intent: "execution_health" });
    expect(result.metrics.find((item) => item.id === "requires-attention")?.value).toBe("1");
    expect(result.risks.join(" ")).toContain("Late project");
    expect(result.risks.join(" ")).not.toContain("Delivered project");
  });
});
