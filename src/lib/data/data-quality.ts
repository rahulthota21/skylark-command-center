import { mappingFor } from "@/lib/data/semantic-mapping";
import type {
  BoardMapping,
  BoardReadiness,
  DataContext,
  DataQualityReport,
  DataWarning,
  EntityLink,
  NormalizedDeal,
  NormalizedWorkOrder,
} from "@/lib/data/types";

function percentage(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Math.round((numerator / denominator) * 100);
}

function readinessForDeals(
  mapping: BoardMapping,
  deals: NormalizedDeal[],
): BoardReadiness {
  const required = ["stage"];
  const missingFields = required.filter((field) => {
    const mapped = mappingFor(mapping, field as "stage");
    return !mapped || mapped.confidence === "missing";
  });

  return {
    board: "deals",
    boardName: mapping.boardName,
    recordCount: deals.length,
    mappedFields: mapping.fields,
    missingFields,
    parseCoverage: [
      {
        label: "Amounts parsed",
        parsed: deals.filter((deal) => Boolean(deal.amount)).length,
        totalRelevant: deals.length,
        percent: percentage(deals.filter((deal) => Boolean(deal.amount)).length, deals.length),
      },
      {
        label: "Probabilities parsed",
        parsed: deals.filter((deal) => deal.probability !== undefined).length,
        totalRelevant: deals.length,
        percent: percentage(deals.filter((deal) => deal.probability !== undefined).length, deals.length),
      },
      {
        label: "Close dates parsed",
        parsed: deals.filter((deal) => Boolean(deal.expectedCloseDate)).length,
        totalRelevant: deals.length,
        percent: percentage(deals.filter((deal) => Boolean(deal.expectedCloseDate)).length, deals.length),
      },
    ],
  };
}

function readinessForWorkOrders(
  mapping: BoardMapping,
  workOrders: NormalizedWorkOrder[],
): BoardReadiness {
  const required = ["status"];
  const missingFields = required.filter((field) => {
    const mapped = mappingFor(mapping, field as "status");
    return !mapped || mapped.confidence === "missing";
  });

  return {
    board: "workOrders",
    boardName: mapping.boardName,
    recordCount: workOrders.length,
    mappedFields: mapping.fields,
    missingFields,
    parseCoverage: [
      {
        label: "Contract value parsed",
        parsed: workOrders.filter((item) => Boolean(item.amount)).length,
        totalRelevant: workOrders.length,
        percent: percentage(workOrders.filter((item) => Boolean(item.amount)).length, workOrders.length),
      },
      {
        label: "Billed value parsed",
        parsed: workOrders.filter((item) => Boolean(item.billedValue)).length,
        totalRelevant: workOrders.length,
        percent: percentage(workOrders.filter((item) => Boolean(item.billedValue)).length, workOrders.length),
      },
      {
        label: "Receivable parsed",
        parsed: workOrders.filter((item) => Boolean(item.receivableAmount)).length,
        totalRelevant: workOrders.length,
        percent: percentage(workOrders.filter((item) => Boolean(item.receivableAmount)).length, workOrders.length),
      },
      {
        label: "Due dates parsed",
        parsed: workOrders.filter((item) => Boolean(item.dueDate)).length,
        totalRelevant: workOrders.length,
        percent: percentage(workOrders.filter((item) => Boolean(item.dueDate)).length, workOrders.length),
      },
    ],
  };
}

function aggregateWarnings(
  records: Array<{ warnings: DataWarning[] }>,
  mappingWarnings: DataWarning[],
): DataWarning[] {
  const counts = new Map<string, { warning: DataWarning; count: number }>();
  for (const warning of [...records.flatMap((record) => record.warnings), ...mappingWarnings]) {
    const key = `${warning.code}:${warning.field || ""}:${warning.message}`;
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { warning, count: 1 });
  }

  return [...counts.values()]
    .map(({ warning, count }) => ({
      ...warning,
      message: count > 1 ? `${warning.message} (${count} records)` : warning.message,
    }))
    .sort((a, b) => {
      const rank = { critical: 0, warning: 1, info: 2 };
      return rank[a.severity] - rank[b.severity];
    });
}

function mappingWarnings(mapping: BoardMapping): DataWarning[] {
  const businessCritical = new Set(
    mapping.kind === "deals"
      ? ["linkedDealName", "sector", "stage", "dealStatus", "amount", "probability", "closeDate"]
      : ["linkedDealName", "sector", "status", "amount", "billedValue", "receivableAmount", "dueDate"],
  );
  return mapping.fields
    .filter((field) => businessCritical.has(field.field) && (field.confidence === "missing" || field.confidence === "low"))
    .map((field) => ({
      code: "UNCERTAIN_MAPPING" as const,
      severity: field.confidence === "missing" ? ("warning" as const) : ("info" as const),
      field: field.field,
      message:
        field.confidence === "missing"
          ? `${mapping.boardName}: ${field.field} could not be mapped from the board schema.`
          : `${mapping.boardName}: ${field.field} mapping is low confidence (${field.columnTitle}).`,
    }));
}

function dateCoverage(deals: NormalizedDeal[], workOrders: NormalizedWorkOrder[]) {
  const dates = [
    ...deals.map((deal) => deal.expectedCloseDate),
    ...workOrders.map((workOrder) => workOrder.dueDate),
  ].filter((date): date is string => Boolean(date));

  return {
    earliest: dates.sort()[0],
    latest: dates.sort().at(-1),
  };
}

export function buildDataQualityReport(input: {
  deals: NormalizedDeal[];
  workOrders: NormalizedWorkOrder[];
  dealMapping: BoardMapping;
  workOrderMapping: BoardMapping;
  links: EntityLink[];
}): DataQualityReport {
  const dealReadiness = readinessForDeals(input.dealMapping, input.deals);
  const workOrderReadiness = readinessForWorkOrders(input.workOrderMapping, input.workOrders);
  const groupedLinks = input.links.filter((link) => link.confidence === "grouped").length;
  const probableLinks = input.links.filter((link) => link.confidence === "probable").length;
  const linkageWarnings: DataWarning[] = [
    ...(groupedLinks
      ? [{
          code: "PROBABLE_ENTITY_MATCH" as const,
          severity: "warning" as const,
          field: "crossBoardLink",
          message: `${groupedLinks} work-order link${groupedLinks === 1 ? " uses" : "s use"} a shared masked Deal Name that maps to multiple sales rows; cross-board results are group-level.`,
        }]
      : []),
    ...(probableLinks
      ? [{
          code: "PROBABLE_ENTITY_MATCH" as const,
          severity: "warning" as const,
          field: "crossBoardLink",
          message: `${probableLinks} work-order link${probableLinks === 1 ? " is" : "s are"} based on fuzzy name matching and require review.`,
        }]
      : []),
  ];
  const warnings = aggregateWarnings(
    [...input.deals, ...input.workOrders],
    [...mappingWarnings(input.dealMapping), ...mappingWarnings(input.workOrderMapping), ...linkageWarnings],
  );
  const linkage = {
    exact: input.links.filter((link) => link.confidence === "exact").length,
    grouped: input.links.filter((link) => link.confidence === "grouped").length,
    probable: input.links.filter((link) => link.confidence === "probable").length,
    unmatched: input.links.filter((link) => link.confidence === "unmatched").length,
  };

  const hardFailures = dealReadiness.missingFields.length + workOrderReadiness.missingFields.length;
  const warningCount = warnings.filter((warning) => warning.severity === "warning").length;
  const overallLabel =
    hardFailures > 0
      ? "limited"
      : warningCount > 5 || linkage.probable > 0 || linkage.grouped > 0
        ? "usable_with_caveats"
        : "strong";

  const observedSectors = [...new Set([...input.deals, ...input.workOrders].map((record) => record.sector).filter(Boolean))].sort() as string[];
  const observedStages = [...new Set(input.deals.map((deal) => deal.stage).filter(Boolean))].sort() as string[];
  const observedStatuses = [...new Set(input.workOrders.map((item) => item.status).filter(Boolean))].sort() as string[];

  const summary =
    overallLabel === "strong"
      ? "Core fields are mapped and most records are usable for analysis."
      : overallLabel === "usable_with_caveats"
        ? "The data is usable, with caveats shown alongside affected analyses."
        : "Important fields could not be reliably mapped; conclusions are intentionally limited.";

  return {
    overallLabel,
    summary,
    boardReadiness: [dealReadiness, workOrderReadiness],
    warnings,
    dateCoverage: dateCoverage(input.deals, input.workOrders),
    linkage,
    observedSectors,
    observedStages,
    observedStatuses,
  };
}

export function withQuality(
  context: Omit<DataContext, "quality">,
): DataContext {
  return {
    ...context,
    quality: buildDataQualityReport({
      deals: context.deals,
      workOrders: context.workOrders,
      dealMapping: context.dealMapping,
      workOrderMapping: context.workOrderMapping,
      links: context.links,
    }),
  };
}
