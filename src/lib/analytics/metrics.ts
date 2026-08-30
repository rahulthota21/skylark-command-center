import type { ChartDatum, DashboardSnapshot, EvidenceGroup, MetricCard } from "@/lib/api/types";
import { dateInRange, formatDate, indiaToday } from "@/lib/date";
import { canonicalText } from "@/lib/data/normalization";
import type {
  DataContext,
  MoneyValue,
  NormalizedDeal,
  NormalizedWorkOrder,
  SourceRef,
} from "@/lib/data/types";
import { formatPercent, titleCase } from "@/lib/utils";
import type { AmountAggregate, AnalysisResult, QueryIntent } from "@/lib/analytics/types";

interface AmountCarrier {
  amount?: MoneyValue;
}

const COLORS = ["#6ee7b7", "#60a5fa", "#a78bfa", "#fbbf24", "#fb7185", "#2dd4bf"];

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

export function formatAmount(value: number, currency?: string): string {
  if (!Number.isFinite(value)) return "Not available";
  if (currency) {
    try {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency,
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(value);
    } catch {
      return `${currency} ${new Intl.NumberFormat("en-IN", {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(value)}`;
    }
  }
  return `${new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)} (currency unspecified)`;
}

export function aggregateAmounts<T extends AmountCarrier>(records: T[]): AmountAggregate {
  const groups = new Map<string, { total: number; count: number; currency?: string }>();
  let excludedCount = 0;

  for (const record of records) {
    if (!record.amount || !Number.isFinite(record.amount.amount)) {
      excludedCount += 1;
      continue;
    }
    const key = record.amount.currency || "__UNSPECIFIED__";
    const existing = groups.get(key) || { total: 0, count: 0, currency: record.amount.currency };
    existing.total += record.amount.amount;
    existing.count += 1;
    groups.set(key, existing);
  }

  const visibleGroups = [...groups.entries()]
    .map(([key, group]) => ({
      currencyLabel: key === "__UNSPECIFIED__" ? "Currency unspecified" : key,
      total: group.total,
      count: group.count,
    }))
    .sort((a, b) => b.total - a.total);

  const oneGroup = visibleGroups.length === 1 ? visibleGroups[0] : undefined;
  return {
    total: oneGroup?.total,
    currency: oneGroup?.currencyLabel === "Currency unspecified" ? undefined : oneGroup?.currencyLabel,
    groups: visibleGroups,
    count: records.length - excludedCount,
    excludedCount,
  };
}

export function displayAggregate(aggregate: AmountAggregate): string {
  if (aggregate.groups.length === 0) return "Not available";
  if (aggregate.groups.length === 1) return formatAmount(aggregate.groups[0].total, aggregate.currency);
  return aggregate.groups
    .map((group) => formatAmount(group.total, group.currencyLabel === "Currency unspecified" ? undefined : group.currencyLabel))
    .join(" · ");
}

function hasMixedCurrency(aggregate: AmountAggregate): boolean {
  return aggregate.groups.length > 1;
}

function matchesTerm(value: string | undefined, term: string | undefined): boolean {
  if (!term) return true;
  const target = canonicalText(term);
  const candidate = canonicalText(value);
  if (!target || !candidate) return false;
  return candidate === target || candidate.includes(target) || target.includes(candidate);
}

function filterDeals(deals: NormalizedDeal[], intent: QueryIntent): NormalizedDeal[] {
  return deals.filter((deal) => {
    if (deal.isHeaderArtifact) return false;
    if (!matchesTerm(deal.sector, intent.sector)) return false;
    if (!matchesTerm(deal.accountName, intent.account)) return false;
    if (intent.stage && !matchesTerm(deal.stage, intent.stage)) return false;
    if (!dateInRange(deal.expectedCloseDate, intent.dateRange)) return false;
    return true;
  });
}

function filterWorkOrders(workOrders: NormalizedWorkOrder[], intent: QueryIntent): NormalizedWorkOrder[] {
  return workOrders.filter((workOrder) => {
    if (workOrder.isHeaderArtifact) return false;
    if (!matchesTerm(workOrder.sector, intent.sector)) return false;
    if (!matchesTerm(workOrder.accountName, intent.account)) return false;
    if (intent.stage && !matchesTerm(workOrder.status, intent.stage)) return false;
    if (intent.dateRange && !dateInRange(workOrder.dueDate, intent.dateRange)) return false;
    return true;
  });
}

function metric(
  id: string,
  label: string,
  value: string,
  detail?: string,
  tone?: MetricCard["tone"],
): MetricCard {
  return { id, label, value, detail, tone };
}

function evidence(title: string, description: string, records: SourceRef[], limit = 12): EvidenceGroup {
  return {
    title,
    description,
    records: records.slice(0, limit),
  };
}

function baseCaveats(context: DataContext): string[] {
  return context.quality.warnings
    .filter((warning) => warning.severity !== "info")
    .slice(0, 5)
    .map((warning) => warning.message);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function categoryChart(
  records: Array<{ key?: string; amount?: MoneyValue }>,
  unknownLabel: string,
): { data: ChartDatum[]; unitLabel: string; caveat?: string } {
  const amountAggregate = aggregateAmounts(records);
  const useAmounts = amountAggregate.groups.length === 1 && amountAggregate.count > 0;
  const values = new Map<string, number>();

  for (const record of records) {
    const key = record.key || unknownLabel;
    const value = useAmounts ? record.amount?.amount : 1;
    if (value === undefined) continue;
    values.set(key, (values.get(key) || 0) + value);
  }

  return {
    data: [...values.entries()]
      .map(([name, value], index) => ({
        name,
        value,
        formattedValue: useAmounts ? formatAmount(value, amountAggregate.currency) : formatNumber(value),
        color: COLORS[index % COLORS.length],
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7),
    unitLabel: useAmounts ? amountAggregate.currency || "amount" : "records",
    caveat: useAmounts
      ? undefined
      : amountAggregate.groups.length > 1
        ? "Amounts use mixed or unspecified currencies, so this chart shows record count instead."
        : undefined,
  };
}

function dateRangeDescription(intent: QueryIntent): string | undefined {
  return intent.dateRange ? `${intent.dateRange.label} (${formatDate(intent.dateRange.start)}–${formatDate(intent.dateRange.end)})` : undefined;
}

function concentrationInsight(activeDeals: NormalizedDeal[]): string | undefined {
  const aggregate = aggregateAmounts(activeDeals);
  if (aggregate.groups.length !== 1 || !aggregate.total || aggregate.total <= 0) return undefined;

  const byAccount = new Map<string, number>();
  for (const deal of activeDeals) {
    if (!deal.accountName || !deal.amount?.amount) continue;
    byAccount.set(deal.accountName, (byAccount.get(deal.accountName) || 0) + deal.amount.amount);
  }
  const ranked = [...byAccount.entries()].sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  if (!top) return undefined;
  const share = top[1] / aggregate.total;
  if (share >= 0.45) {
    return `${top[0]} represents ${formatPercent(share)} of the measurable active pipeline, creating account-concentration exposure.`;
  }
  return undefined;
}

function topDealAttention(activeDeals: NormalizedDeal[]): NormalizedDeal[] {
  return activeDeals
    .filter(
      (deal) =>
        deal.amount &&
        (deal.probability === undefined || !deal.expectedCloseDate || deal.stageCategory === "unknown"),
    )
    .sort((a, b) => (b.amount?.amount || 0) - (a.amount?.amount || 0))
    .slice(0, 6);
}

function pipelineAnalysis(context: DataContext, intent: QueryIntent): AnalysisResult {
  // Keep a pre-date-filter population so missing close dates are disclosed
  // rather than disappearing silently from a quarter-specific result.
  const comparableDeals = filterDeals(context.deals, { ...intent, dateRange: undefined });
  const selectedDeals = filterDeals(context.deals, intent);
  const activeDeals = selectedDeals.filter((deal) => deal.stageCategory === "active");
  const activeComparableDeals = comparableDeals.filter((deal) => deal.stageCategory === "active");
  const unknownStageDeals = selectedDeals.filter((deal) => deal.stageCategory === "unknown");
  const amount = aggregateAmounts(activeDeals);
  const weighted = aggregateAmounts(
    activeDeals
      .filter((deal) => deal.amount && deal.probability !== undefined)
      .map((deal) => ({
        amount: {
          amount: deal.amount!.amount * deal.probability!,
          currency: deal.amount!.currency,
          raw: deal.amount!.raw,
        },
      })),
  );
  const missingProbability = activeDeals.filter((deal) => deal.probability === undefined).length;
  const qualitativeProbabilityCount = activeDeals.filter((deal) => deal.probabilityKind === "qualitative").length;
  const inferredCurrencyCount = activeDeals.filter((deal) => deal.amount?.currencyInferred).length;
  const missingCloseDate = activeComparableDeals.filter((deal) => !deal.expectedCloseDate).length;
  const attention = topDealAttention(activeDeals);
  const stageVisualization = categoryChart(
    activeDeals.map((deal) => ({ key: deal.stage || "Unmapped stage", amount: deal.amount })),
    "Unmapped stage",
  );
  const caveats = baseCaveats(context);

  if (hasMixedCurrency(amount)) {
    caveats.unshift("Active pipeline is grouped by currency because no exchange-rate assumption is configured.");
  }
  if (amount.excludedCount > 0) {
    caveats.push(`${amount.excludedCount} active deal${amount.excludedCount === 1 ? "" : "s"} lack a parseable amount and are excluded from amount totals.`);
  }
  if (missingProbability > 0) {
    caveats.push(`${missingProbability} active deal${missingProbability === 1 ? "" : "s"} lack a valid probability and are excluded from weighted pipeline.`);
  }
  if (qualitativeProbabilityCount > 0) {
    caveats.push(`${qualitativeProbabilityCount} active deal${qualitativeProbabilityCount === 1 ? " uses" : "s use"} qualitative High/Medium/Low probability mapping; weighted values are directional.`);
  }
  if (inferredCurrencyCount > 0) {
    caveats.push(`${inferredCurrencyCount} active deal${inferredCurrencyCount === 1 ? " uses" : "s use"} INR inferred from the supplied tracker’s board-level monetary context; confirm this before external reporting.`);
  }
  if (intent.dateRange && missingCloseDate > 0) {
    caveats.push(`${missingCloseDate} active deal${missingCloseDate === 1 ? "" : "s"} lack a usable close date and cannot be included in a date-filtered view.`);
  }
  if (unknownStageDeals.length > 0) {
    caveats.push(`${unknownStageDeals.length} selected deal${unknownStageDeals.length === 1 ? "" : "s"} have an unmapped stage and are not counted as active pipeline.`);
  }
  if (stageVisualization.caveat) caveats.push(stageVisualization.caveat);

  const scope = uniqueStrings([
    intent.sector ? `${intent.sector} sector` : "all sectors",
    dateRangeDescription(intent) || "all available close dates",
  ]).join(" · ");
  const headline =
    activeDeals.length === 0
      ? `No active pipeline records match ${scope}.`
      : `${displayAggregate(amount)} of measurable active pipeline across ${formatNumber(activeDeals.length)} deal${activeDeals.length === 1 ? "" : "s"}.`;

  const insights: string[] = [];
  if (activeDeals.length > 0) {
    insights.push(`The view covers ${scope}; terminal Won and Lost deals are excluded from pipeline.`);
    if (weighted.groups.length > 0) {
      insights.push(`Weighted pipeline is ${displayAggregate(weighted)}, calculated only where both amount and probability are usable.`);
    }
    const concentration = concentrationInsight(activeDeals);
    if (concentration) insights.push(concentration);
  }

  const risks = attention.length
    ? attention.map((deal) => {
        const gaps = [
          deal.probability === undefined ? "missing probability" : undefined,
          !deal.expectedCloseDate ? "missing close date" : undefined,
          deal.stageCategory === "unknown" ? "unmapped stage" : undefined,
        ].filter(Boolean).join(", ");
        return `${deal.displayName}${deal.accountName && deal.accountName !== deal.displayName ? ` (${deal.accountName})` : ""}: ${gaps}.`;
      })
    : ["No high-value active deals with obvious forecast-field gaps were identified in this filtered view."];

  const actions: string[] = [];
  if (missingProbability > 0) actions.push(`Confirm probability for ${missingProbability} active deal${missingProbability === 1 ? "" : "s"} before using weighted forecast.`);
  if (missingCloseDate > 0) actions.push(`Complete expected close dates for ${missingCloseDate} active deal${missingCloseDate === 1 ? "" : "s"} to improve period forecasting.`);
  if (attention.length > 0) actions.push("Review the highlighted deals first; they combine commercial value with incomplete forecast information.");
  if (!actions.length) actions.push("Use the sector and stage breakdown to validate owners’ near-term close plans.");

  return {
    kind: "pipeline_overview",
    headline,
    metrics: [
      metric("active-pipeline", "Active pipeline", displayAggregate(amount), `${formatNumber(activeDeals.length)} active deals`, activeDeals.length ? "positive" : "muted"),
      metric("weighted-pipeline", "Weighted pipeline", displayAggregate(weighted), missingProbability ? `${formatNumber(missingProbability)} excluded for missing probability` : "Amount × probability", "neutral"),
      metric("deals-in-scope", "Deals in scope", formatNumber(selectedDeals.length), `${formatNumber(activeDeals.length)} active · ${formatNumber(unknownStageDeals.length)} unmapped`, "neutral"),
      metric("forecast-coverage", "Forecast date coverage", activeComparableDeals.length ? formatPercent((activeComparableDeals.length - missingCloseDate) / activeComparableDeals.length) : "—", missingCloseDate ? `${formatNumber(missingCloseDate)} active deals lack usable close dates` : "All active deals have usable close dates", missingCloseDate ? "attention" : "positive"),
    ],
    insights,
    risks,
    actions,
    assumptions: uniqueStrings([
      "Pipeline means deals mapped to an active, non-terminal sales stage.",
      ...(inferredCurrencyCount > 0 ? ["Masked Deal value is interpreted as INR because the companion Work Orders tracker explicitly denominates monetary fields in Rupees; confirm before external reporting."] : []),
      "Weighted pipeline is amount multiplied by reported probability; missing probabilities are not assumed.",
      ...(qualitativeProbabilityCount > 0 ? ["Qualitative Closure Probability is mapped as High = 75%, Medium = 50%, Low = 25%; this is directional rather than a CRM-calibrated forecast."] : []),
      intent.dateRange ? `Date filter uses Expected Close Date: ${dateRangeDescription(intent)}.` : "No close-date filter was applied.",
      ...(canonicalText(intent.sector) === "energy" ? ["For the supplied source taxonomy, the Energy roll-up includes the visible source sub-sectors Energy / Renewables and Energy / Powerline."] : []),
      intent.sector ? `Sector matching is conservative against the normalized label “${intent.sector}”.` : "No sector filter was applied.",
      ...intent.assumptions,
    ]),
    caveats: uniqueStrings(caveats),
    evidence: [
      evidence("Active deal evidence", `${activeDeals.length} active records contributed to this view.`, activeDeals.map((deal) => deal.source)),
      ...(attention.length ? [evidence("Forecast records needing review", "High-value active deals with incomplete forecasting fields.", attention.map((deal) => deal.source), 6)] : []),
    ],
    chart: {
      title: "Pipeline by stage",
      subtitle: stageVisualization.caveat || "Active deals in the selected view",
      data: stageVisualization.data,
      unitLabel: stageVisualization.unitLabel,
    },
    followUps: [
      "Which high-value deals are missing a probability?",
      "Compare this pipeline with the previous quarter.",
      "Which accounts have active deals and delayed execution?",
    ],
    records: activeDeals.map((deal) => deal.source),
  };
}

function executionAnalysis(context: DataContext, intent: QueryIntent): AnalysisResult {
  const selected = filterWorkOrders(context.workOrders, intent);
  const today = indiaToday();
  const overdue = selected.filter(
    (workOrder) =>
      Boolean(workOrder.dueDate) &&
      workOrder.dueDate! < today &&
      workOrder.statusCategory !== "complete" &&
      workOrder.statusCategory !== "unknown",
  );
  const explicitRisk = selected.filter((workOrder) => workOrder.statusCategory === "at_risk");
  const riskIds = new Set([...overdue, ...explicitRisk].map((workOrder) => workOrder.source.itemId));
  const atRisk = selected.filter((workOrder) => riskIds.has(workOrder.source.itemId));
  const complete = selected.filter((workOrder) => workOrder.statusCategory === "complete");
  const unknown = selected.filter((workOrder) => workOrder.statusCategory === "unknown");
  const affectedValue = aggregateAmounts(atRisk);
  const statusVisualization = categoryChart(
    selected.map((workOrder) => ({ key: workOrder.status || "Unmapped status", amount: workOrder.amount })),
    "Unmapped status",
  );
  const caveats = baseCaveats(context);
  const missingDue = selected.filter((workOrder) => !workOrder.dueDate).length;
  if (hasMixedCurrency(affectedValue)) caveats.unshift("Potentially affected project value is grouped by currency because no exchange-rate assumption is configured.");
  if (missingDue > 0) caveats.push(`${missingDue} work order${missingDue === 1 ? "" : "s"} lack a usable due date and cannot be assessed for overdue status.`);
  if (unknown.length > 0) caveats.push(`${unknown.length} work order${unknown.length === 1 ? "" : "s"} have an unmapped status; they are not labelled on-track, at-risk, or complete.`);
  if (statusVisualization.caveat) caveats.push(statusVisualization.caveat);

  const scope = uniqueStrings([
    intent.sector ? `${intent.sector} sector` : "all sectors",
    dateRangeDescription(intent) || "all due dates",
  ]).join(" · ");
  const headline =
    atRisk.length > 0
      ? `${formatNumber(atRisk.length)} work order${atRisk.length === 1 ? " requires" : "s require"} attention; ${displayAggregate(affectedValue)} of measurable project value is associated with them.`
      : `No work orders are currently categorized as at risk in ${scope}.`;

  const risks = atRisk.length
    ? atRisk.slice(0, 6).map((workOrder) => {
        const reasons = [
          workOrder.statusCategory === "at_risk" ? `status: ${workOrder.status || "at risk"}` : undefined,
          workOrder.dueDate && workOrder.dueDate < today ? `past due since ${formatDate(workOrder.dueDate)}` : undefined,
        ].filter(Boolean).join("; ");
        return `${workOrder.displayName}: ${reasons}.`;
      })
    : ["No explicit at-risk or safely identifiable overdue incomplete work orders were found."];

  const actions = atRisk.length
    ? [
        "Confirm recovery plans, owners, and customer impact for the flagged work orders.",
        "Review linked active deals before committing additional delivery dates or forecasted revenue.",
      ]
    : ["Validate that work-order status labels and due dates are consistently maintained before relying on the absence of risk."];

  return {
    kind: "execution_health",
    headline,
    metrics: [
      metric("work-orders", "Work orders in scope", formatNumber(selected.length), `${formatNumber(complete.length)} complete`, "neutral"),
      metric("requires-attention", "Requires attention", formatNumber(atRisk.length), `${formatNumber(overdue.length)} overdue incomplete · ${formatNumber(explicitRisk.length)} marked at risk`, atRisk.length ? "attention" : "positive"),
      metric("affected-value", "Value linked to attention", displayAggregate(affectedValue), affectedValue.excludedCount ? `${formatNumber(affectedValue.excludedCount)} records lack parseable amount` : "Work-order value, not recognized revenue", atRisk.length ? "attention" : "neutral"),
      metric("due-date-coverage", "Due-date coverage", selected.length ? formatPercent((selected.length - missingDue) / selected.length) : "—", missingDue ? `${formatNumber(missingDue)} work orders lack a usable due date` : "All scoped work orders have usable due dates", missingDue ? "attention" : "positive"),
    ],
    insights: [
      `The execution view covers ${scope}.`,
      `${formatNumber(complete.length)} of ${formatNumber(selected.length)} scoped work orders are mapped to complete.`,
      context.quality.linkage.exact + context.quality.linkage.grouped + context.quality.linkage.probable > 0
        ? `${formatNumber(context.quality.linkage.exact)} exact, ${formatNumber(context.quality.linkage.grouped)} group-level, and ${formatNumber(context.quality.linkage.probable)} probable cross-board link${context.quality.linkage.exact + context.quality.linkage.grouped + context.quality.linkage.probable === 1 ? " is" : "s are"} available for joined analysis.`
        : "No reliable cross-board links are currently available.",
    ],
    risks,
    actions,
    assumptions: uniqueStrings([
      "A work order is overdue only when it has a usable past due date and a status mapped to non-complete.",
      "Work-order value is not treated as recognized revenue.",
      intent.dateRange ? `Due-date filter uses ${dateRangeDescription(intent)}.` : "No due-date filter was applied.",
      ...intent.assumptions,
    ]),
    caveats: uniqueStrings(caveats),
    evidence: [
      evidence("Work-order evidence", `${selected.length} work-order records contributed to this view.`, selected.map((workOrder) => workOrder.source)),
      ...(atRisk.length ? [evidence("Work orders requiring attention", "At-risk status or safely identifiable overdue incomplete work orders.", atRisk.map((workOrder) => workOrder.source), 8)] : []),
    ],
    chart: {
      title: "Execution status mix",
      subtitle: statusVisualization.caveat || "Work orders in the selected view",
      data: statusVisualization.data,
      unitLabel: statusVisualization.unitLabel,
    },
    followUps: [
      "Which delayed work orders have the highest value?",
      "Which active deals are connected to delayed execution?",
      "Show work orders due this quarter.",
    ],
    records: selected.map((workOrder) => workOrder.source),
  };
}

function sectorAnalysis(context: DataContext, intent: QueryIntent): AnalysisResult {
  const selected = filterDeals(context.deals, { ...intent, sector: undefined });
  const active = selected.filter((deal) => deal.stageCategory === "active");
  const aggregate = aggregateAmounts(active);
  const bySector = new Map<string, NormalizedDeal[]>();
  for (const deal of active) {
    const key = deal.sector || "Unspecified sector";
    bySector.set(key, [...(bySector.get(key) || []), deal]);
  }
  const sectorRows = [...bySector.entries()]
    .map(([sector, deals]) => ({ sector, deals, aggregate: aggregateAmounts(deals) }))
    .sort((a, b) => {
      const left = a.aggregate.total ?? -1;
      const right = b.aggregate.total ?? -1;
      return right - left || b.deals.length - a.deals.length;
    });
  const visualization = categoryChart(active.map((deal) => ({ key: deal.sector || "Unspecified sector", amount: deal.amount })), "Unspecified sector");
  const caveats = baseCaveats(context);
  if (hasMixedCurrency(aggregate)) caveats.unshift("Sector value comparisons are shown by currency group; no exchange rate was assumed.");
  if (visualization.caveat) caveats.push(visualization.caveat);

  const leading = sectorRows[0];
  const headline = leading
    ? `${leading.sector} leads the measurable active pipeline with ${displayAggregate(leading.aggregate)} across ${formatNumber(leading.deals.length)} deal${leading.deals.length === 1 ? "" : "s"}.`
    : "No active deal records are available for sector comparison.";
  const insights = sectorRows.slice(0, 4).map((row) => `${row.sector}: ${displayAggregate(row.aggregate)} across ${row.deals.length} active deal${row.deals.length === 1 ? "" : "s"}.`);

  const unclassified = active.filter((deal) => !deal.sector).length;
  const risks = unclassified
    ? [`${unclassified} active deal${unclassified === 1 ? "" : "s"} lack a sector, so sector totals may be incomplete.`]
    : ["All active deals in this view have a sector label."];

  return {
    kind: "sector_comparison",
    headline,
    metrics: [
      metric("sectors", "Sectors represented", formatNumber(bySector.size), `${formatNumber(active.length)} active deals`, "neutral"),
      metric("active-pipeline", "Active pipeline", displayAggregate(aggregate), "All sectors; terminal stages excluded", "positive"),
      metric("leading-sector", "Leading sector", leading?.sector || "Not available", leading ? `${formatNumber(leading.deals.length)} active deals` : undefined, "neutral"),
      metric("sector-coverage", "Sector coverage", active.length ? formatPercent((active.length - unclassified) / active.length) : "—", unclassified ? `${formatNumber(unclassified)} active deals are unclassified` : "All active deals are classified", unclassified ? "attention" : "positive"),
    ],
    insights,
    risks,
    actions: [
      "Compare the leading sector’s stage mix and close-date coverage before using it as a forecast signal.",
      "Assign sector labels to unclassified active deals to make portfolio allocation decisions more reliable.",
    ],
    assumptions: uniqueStrings([
      "Sector comparison includes deals mapped to active, non-terminal stages.",
      intent.dateRange ? `Date filter uses Expected Close Date: ${dateRangeDescription(intent)}.` : "No close-date filter was applied.",
      ...intent.assumptions,
    ]),
    caveats: uniqueStrings(caveats),
    evidence: [evidence("Active deal evidence", `${active.length} active deal records contributed to sector comparison.`, active.map((deal) => deal.source))],
    chart: {
      title: "Active pipeline by sector",
      subtitle: visualization.caveat || "Measured from active deal records",
      data: visualization.data,
      unitLabel: visualization.unitLabel,
    },
    followUps: [
      "How does the energy sector compare with manufacturing?",
      "Which sector has the most near-term closes?",
      "Which sectors have delayed work orders?",
    ],
    records: active.map((deal) => deal.source),
  };
}

function cashCollectionAnalysis(context: DataContext, intent: QueryIntent): AnalysisResult {
  const workOrders = filterWorkOrders(context.workOrders, { ...intent, dateRange: undefined });
  const contracted = aggregateAmounts(workOrders.map((workOrder) => ({ amount: workOrder.amount })));
  const billed = aggregateAmounts(workOrders.map((workOrder) => ({ amount: workOrder.billedValue })));
  const collected = aggregateAmounts(workOrders.map((workOrder) => ({ amount: workOrder.collectedAmount })));
  const receivable = aggregateAmounts(workOrders.map((workOrder) => ({ amount: workOrder.receivableAmount })));
  const unbilled = aggregateAmounts(workOrders.map((workOrder) => ({ amount: workOrder.unbilledAmount })));
  const invoiceStuck = workOrders.filter((workOrder) => /stuck|not billed|partially billed/i.test(`${workOrder.invoiceStatus || ""} ${workOrder.billingStatus || ""}`));
  const positiveReceivables = workOrders
    .filter((workOrder) => (workOrder.receivableAmount?.amount || 0) > 0)
    .sort((a, b) => (b.receivableAmount?.amount || 0) - (a.receivableAmount?.amount || 0));
  const topReceivables = positiveReceivables.slice(0, 6);
  const receivableBySector = categoryChart(
    workOrders.map((workOrder) => ({ key: workOrder.sector || "Unspecified sector", amount: workOrder.receivableAmount })),
    "Unspecified sector",
  );
  const caveats = baseCaveats(context);
  const allFinancialGroups = [contracted, billed, collected, receivable, unbilled];
  if (allFinancialGroups.some(hasMixedCurrency)) {
    caveats.unshift("Financial values are grouped by currency because no exchange-rate assumption is configured.");
  }
  if (billed.excludedCount > 0) caveats.push(`${billed.excludedCount} work-order record${billed.excludedCount === 1 ? "" : "s"} have no usable billed value.`);
  if (collected.excludedCount > 0) caveats.push(`${collected.excludedCount} work-order record${collected.excludedCount === 1 ? "" : "s"} have no usable collection value.`);
  if (receivableBySector.caveat) caveats.push(receivableBySector.caveat);

  const billedRatio =
    contracted.total && contracted.total > 0 && billed.total !== undefined && contracted.currency === billed.currency
      ? billed.total / contracted.total
      : undefined;
  const collectionRatio =
    billed.total && billed.total > 0 && collected.total !== undefined && billed.currency === collected.currency
      ? collected.total / billed.total
      : undefined;
  const headline = receivable.groups.length
    ? `${displayAggregate(receivable)} is recorded as receivable across ${formatNumber(positiveReceivables.length)} work-order record${positiveReceivables.length === 1 ? "" : "s"} with a positive balance.`
    : "No usable receivable amount is available in the selected work-order records.";

  const risks = [
    ...topReceivables.map((workOrder) => `${workOrder.displayName}: ${formatAmount(workOrder.receivableAmount!.amount, workOrder.receivableAmount!.currency)} receivable${workOrder.invoiceStatus ? ` · invoice status: ${workOrder.invoiceStatus}` : ""}.`),
    ...invoiceStuck
      .filter((workOrder) => !topReceivables.some((candidate) => candidate.source.itemId === workOrder.source.itemId))
      .slice(0, 3)
      .map((workOrder) => `${workOrder.displayName}: billing/invoice status requires review (${workOrder.invoiceStatus || workOrder.billingStatus}).`),
  ];

  return {
    kind: "cash_collection",
    headline,
    metrics: [
      metric("contract-value", "Contract value", displayAggregate(contracted), "Mapped work-order amount; tax basis follows the source column", "neutral"),
      metric("billed-value", "Billed value", displayAggregate(billed), billedRatio !== undefined ? `${formatPercent(billedRatio)} of mapped contract value` : "Billed and contract values are not safely comparable", "neutral"),
      metric("collected-value", "Collected amount", displayAggregate(collected), collectionRatio !== undefined ? `${formatPercent(collectionRatio)} of mapped billed value` : "Collection and billed values are not safely comparable", "positive"),
      metric("receivable", "Amount receivable", displayAggregate(receivable), unbilled.groups.length ? `Unbilled amount: ${displayAggregate(unbilled)}` : "Source-defined receivable amount", topReceivables.length ? "attention" : "neutral"),
    ],
    insights: [
      billedRatio !== undefined ? `${formatPercent(billedRatio)} of mapped contract value is billed.` : "Billed-to-contract coverage cannot be calculated safely from the currently mapped values.",
      collectionRatio !== undefined ? `${formatPercent(collectionRatio)} of mapped billed value is collected.` : "Collection-to-billed coverage cannot be calculated safely from the currently mapped values.",
      invoiceStuck.length ? `${formatNumber(invoiceStuck.length)} work-order record${invoiceStuck.length === 1 ? " is" : "s are"} marked Not billed, Partially Billed, or Stuck.` : "No work order is currently labelled Not billed, Partially Billed, or Stuck in the mapped invoice/billing fields.",
    ],
    risks: risks.length ? risks : ["No positive receivable balance or billing status requiring attention was found in the selected records."],
    actions: [
      topReceivables.length ? "Assign collection owner, promised payment date, and next action to the highest receivable work orders." : "Validate receivable and collection fields before treating a zero balance as cash collected.",
      invoiceStuck.length ? "Resolve records with Stuck, Not billed, or Partially Billed statuses before the next leadership review." : "Review unbilled value and invoice-status coverage for potential billing leakage.",
      "Use the source tax basis consistently; do not compare inclusive and exclusive-of-GST fields in the same total.",
    ],
    assumptions: uniqueStrings([
      "Cash metrics use the supplied Work Orders financial columns on their mapped tax basis; they are not treated as audited revenue.",
      "Amount Receivable is reported as supplied and is not inferred from contract minus collections.",
      intent.sector ? `Sector matching is conservative against the normalized label “${intent.sector}”.` : "No sector filter was applied.",
      ...intent.assumptions,
    ]),
    caveats: uniqueStrings(caveats),
    evidence: [
      evidence("Work-order financial evidence", `${workOrders.length} work-order records contributed to financial totals.`, workOrders.map((workOrder) => workOrder.source)),
      ...(topReceivables.length ? [evidence("Largest positive receivable balances", "Source records with a positive Amount Receivable.", topReceivables.map((workOrder) => workOrder.source), 6)] : []),
    ],
    chart: {
      title: "Receivable exposure by sector",
      subtitle: receivableBySector.caveat || "Positive and zero/available receivable amounts from work orders",
      data: receivableBySector.data,
      unitLabel: receivableBySector.unitLabel,
    },
    followUps: [
      "Which work orders have the highest receivables?",
      "Which invoices are stuck or only partially billed?",
      "Which delivery risks also have receivable exposure?",
    ],
    records: workOrders.map((workOrder) => workOrder.source),
  };
}

function riskAnalysis(context: DataContext, intent: QueryIntent): AnalysisResult {
  const deals = filterDeals(context.deals, intent).filter((deal) => deal.stageCategory === "active");
  const workOrders = filterWorkOrders(context.workOrders, intent);
  const today = indiaToday();
  const riskyDeals = topDealAttention(deals);
  const riskyWorkOrders = workOrders.filter(
    (workOrder) =>
      workOrder.statusCategory === "at_risk" ||
      (Boolean(workOrder.dueDate) && workOrder.dueDate! < today && workOrder.statusCategory === "on_track"),
  );
  const affectedAmount = aggregateAmounts([...riskyDeals, ...riskyWorkOrders]);
  const linkedDelayedAccounts = riskyWorkOrders
    .map((workOrder) => context.links.find((link) => link.workOrderId === workOrder.source.itemId))
    .filter((link) => link?.confidence === "exact" || link?.confidence === "grouped" || link?.confidence === "probable").length;
  const caveats = baseCaveats(context);
  if (hasMixedCurrency(affectedAmount)) caveats.unshift("Potentially affected value is shown by currency group; currencies were not converted.");

  const risks = [
    ...riskyDeals.map((deal) => `${deal.displayName}: active deal with incomplete forecast information.`),
    ...riskyWorkOrders.map((workOrder) => `${workOrder.displayName}: ${workOrder.statusCategory === "at_risk" ? "marked at risk" : "past due while still mapped on track"}.`),
  ].slice(0, 8);

  return {
    kind: "risk_review",
    headline:
      riskyDeals.length + riskyWorkOrders.length > 0
        ? `${formatNumber(riskyDeals.length + riskyWorkOrders.length)} record${riskyDeals.length + riskyWorkOrders.length === 1 ? " needs" : "s need"} executive attention across forecast quality and execution health.`
        : "No obvious records requiring executive attention were identified from the configured rules.",
    metrics: [
      metric("forecast-gaps", "Forecast gaps", formatNumber(riskyDeals.length), "High-value active deals missing key forecast fields", riskyDeals.length ? "attention" : "positive"),
      metric("delivery-risks", "Delivery risks", formatNumber(riskyWorkOrders.length), "At-risk or overdue non-complete work orders", riskyWorkOrders.length ? "attention" : "positive"),
      metric("linked-accounts", "Joined risk signals", formatNumber(linkedDelayedAccounts), "Risky work orders with a conservative deal link", linkedDelayedAccounts ? "attention" : "neutral"),
      metric("affected-value", "Value associated with attention", displayAggregate(affectedAmount), "Not recognized revenue", "attention"),
    ],
    insights: [
      `${formatNumber(riskyDeals.length)} active deal${riskyDeals.length === 1 ? "" : "s"} require forecast-data completion.`,
      `${formatNumber(riskyWorkOrders.length)} work order${riskyWorkOrders.length === 1 ? "" : "s"} are currently flagged by status or due-date rules.`,
      linkedDelayedAccounts
        ? `${formatNumber(linkedDelayedAccounts)} flagged work-order signal${linkedDelayedAccounts === 1 ? " has" : "s have"} a conservative cross-board account link; review commercial and delivery plans together.`
        : "No delivery-risk records could be linked to a deal with enough confidence for joined conclusions.",
    ],
    risks: risks.length ? risks : ["No high-value forecast gaps or safely classified delivery risks were found."],
    actions: [
      "Assign an owner and recovery action to each delivery-risk work order.",
      "Complete probability and expected close date before escalating a pipeline deal into leadership forecast.",
      "Review probable account matches manually before making account-level decisions.",
    ],
    assumptions: uniqueStrings([
      "Risk rules flag incomplete forecast fields and at-risk/overdue execution; they are prioritization signals, not a guarantee of loss.",
      ...intent.assumptions,
    ]),
    caveats: uniqueStrings(caveats),
    evidence: [
      evidence("Deals requiring forecast review", "Active deals with a high-value forecast-field gap.", riskyDeals.map((deal) => deal.source), 8),
      evidence("Execution records requiring review", "At-risk or overdue work orders.", riskyWorkOrders.map((workOrder) => workOrder.source), 8),
    ],
    followUps: [
      "Show the affected accounts in more detail.",
      "Which risks are due this month?",
      "Prepare a leadership update for these risks.",
    ],
    records: [...riskyDeals.map((deal) => deal.source), ...riskyWorkOrders.map((workOrder) => workOrder.source)],
  };
}

function accountAnalysis(context: DataContext, intent: QueryIntent): AnalysisResult {
  const deals = filterDeals(context.deals, { ...intent, dateRange: undefined });
  const workOrders = filterWorkOrders(context.workOrders, { ...intent, dateRange: undefined });
  const active = deals.filter((deal) => deal.stageCategory === "active");
  const pipeline = aggregateAmounts(active);
  const linkedWorkOrders = workOrders.filter((workOrder) => {
    const link = context.links.find((candidate) => candidate.workOrderId === workOrder.source.itemId);
    return link?.confidence === "exact" || link?.confidence === "grouped" || link?.confidence === "probable";
  });
  const today = indiaToday();
  const delayed = linkedWorkOrders.filter(
    (workOrder) =>
      workOrder.statusCategory === "at_risk" ||
      (workOrder.dueDate && workOrder.dueDate < today && workOrder.statusCategory === "on_track"),
  );
  const accountLabel = intent.account || "selected account";

  return {
    kind: "account_view",
    headline:
      deals.length || workOrders.length
        ? `${accountLabel}: ${displayAggregate(pipeline)} of measurable active pipeline and ${formatNumber(workOrders.length)} matching work order${workOrders.length === 1 ? "" : "s"}.`
        : `No deal or work-order records reliably match “${accountLabel}”.`,
    metrics: [
      metric("active-pipeline", "Active pipeline", displayAggregate(pipeline), `${formatNumber(active.length)} active deals`, "positive"),
      metric("matching-work-orders", "Matching work orders", formatNumber(workOrders.length), `${formatNumber(linkedWorkOrders.length)} conservatively linked`, "neutral"),
      metric("delivery-attention", "Delivery attention", formatNumber(delayed.length), "At-risk or overdue linked work orders", delayed.length ? "attention" : "positive"),
      metric("all-deals", "All matching deals", formatNumber(deals.length), "Includes terminal and unknown-stage deals", "neutral"),
    ],
    insights: [
      active.length ? `${formatNumber(active.length)} active deal${active.length === 1 ? " is" : "s are"} associated with the selected account.` : "No active deal is associated with the selected account.",
      delayed.length ? `${formatNumber(delayed.length)} linked work order${delayed.length === 1 ? " is" : "s are"} flagged by delivery risk rules.` : "No linked work order is currently flagged by delivery risk rules.",
    ],
    risks: delayed.length
      ? delayed.map((workOrder) => `${workOrder.displayName}: ${workOrder.status || "requires delivery review"}.`)
      : ["No joined delivery risk is visible for the records matched to this account."],
    actions: [
      "Validate account-name matching before relying on joined results.",
      "Review active deal commitments alongside open execution status.",
    ],
    assumptions: uniqueStrings([
      `Account matching uses conservative normalized-name matching for “${accountLabel}”.`,
      "Probable entity links are shown as evidence, not treated as certain.",
      ...intent.assumptions,
    ]),
    caveats: uniqueStrings(baseCaveats(context)),
    evidence: [
      evidence("Matching deals", `${deals.length} deal records matched the account term.`, deals.map((deal) => deal.source)),
      evidence("Matching work orders", `${workOrders.length} work-order records matched the account term.`, workOrders.map((workOrder) => workOrder.source)),
    ],
    followUps: [
      "Which deal should we prioritize for this account?",
      "Are any projects for this account delayed?",
      "Generate a leadership update for this account.",
    ],
    records: [...deals.map((deal) => deal.source), ...workOrders.map((workOrder) => workOrder.source)],
  };
}

function unsupportedAnalysis(context: DataContext, intent: QueryIntent): AnalysisResult {
  return {
    kind: "unsupported",
    headline: "I can answer pipeline, sector, execution, risk, account, and leadership-update questions from the connected boards.",
    metrics: [],
    insights: [
      "The agent does not invent metrics outside the available Deals and Work Orders data.",
      `Connected data currently contains ${formatNumber(context.deals.length)} deal records and ${formatNumber(context.workOrders.length)} work-order records.`,
    ],
    risks: [],
    actions: ["Try one of the suggested questions below."],
    assumptions: intent.assumptions,
    caveats: baseCaveats(context),
    evidence: [],
    followUps: [
      "How is our pipeline looking this quarter?",
      "Compare sector performance.",
      "Which work orders are delayed?",
      "Prepare a leadership update.",
    ],
    records: [],
  };
}

export function analyze(context: DataContext, intent: QueryIntent): AnalysisResult {
  switch (intent.intent) {
    case "pipeline_overview":
      return pipelineAnalysis(context, intent);
    case "sector_comparison":
      return sectorAnalysis(context, intent);
    case "execution_health":
      return executionAnalysis(context, intent);
    case "cash_collection":
      return cashCollectionAnalysis(context, intent);
    case "risk_review":
      return riskAnalysis(context, intent);
    case "account_view":
      return accountAnalysis(context, intent);
    case "leadership_update":
      return riskAnalysis(context, intent);
    default:
      return unsupportedAnalysis(context, intent);
  }
}

export function dashboardSnapshot(context: DataContext): DashboardSnapshot {
  const intent: QueryIntent = {
    intent: "pipeline_overview",
    asksForComparison: false,
    needsClarification: false,
    assumptions: [],
  };
  const result = pipelineAnalysis(context, intent);
  return {
    metrics: result.metrics,
    chart: result.chart || null,
  };
}

export function qualityLabel(label: DataContext["quality"]["overallLabel"]): string {
  if (label === "strong") return "Strong data readiness";
  if (label === "usable_with_caveats") return "Usable with caveats";
  return "Limited data readiness";
}

export function readableIntent(intent: QueryIntent): string {
  return titleCase(intent.intent);
}
