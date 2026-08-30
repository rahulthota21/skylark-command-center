import {
  isValid,
  parse,
  parseISO,
} from "date-fns";

import { safeJsonParse } from "@/lib/utils";
import { mappingFor } from "@/lib/data/semantic-mapping";
import type {
  BoardMapping,
  DataWarning,
  DealStageCategory,
  MoneyValue,
  MondayBoard,
  MondayColumnValue,
  NormalizedDeal,
  NormalizedWorkOrder,
  SourceRef,
  WorkOrderStatusCategory,
} from "@/lib/data/types";

function cleanText(value: string | null | undefined): string | undefined {
  const cleaned = value?.replace(/\s+/g, " ").trim();
  return cleaned || undefined;
}

export function canonicalText(value: string | undefined): string | undefined {
  const cleaned = cleanText(value);
  if (!cleaned) return undefined;
  return cleaned
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/&/g, " and ")
    .replace(/[.,/#!$%^*;:{}=\-_`~()]/g, " ")
    .replace(/\b(private limited|pvt ltd|pvt|limited|ltd|llc|incorporated|inc|corp|corporation|co)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim() || undefined;
}

function rawValue(columnValue: MondayColumnValue | undefined): string | undefined {
  if (!columnValue) return undefined;
  const text = cleanText(columnValue.text);
  if (text) return text;

  const parsed = safeJsonParse<unknown>(columnValue.value);
  if (typeof parsed === "string") return cleanText(parsed);
  if (typeof parsed === "number") return String(parsed);
  return cleanText(columnValue.value);
}

function valueForField(
  item: MondayBoard["items"][number],
  mapping: BoardMapping,
  field: Parameters<typeof mappingFor>[1],
): string | undefined {
  const fieldMapping = mappingFor(mapping, field);
  if (!fieldMapping || fieldMapping.columnTitle === "Not mapped") return undefined;
  if (field === "itemName" || fieldMapping.columnTitle === "Item name") return cleanText(item.name);
  return rawValue(item.columnValues.find((value) => value.id === fieldMapping.columnId));
}

function sourceFor(
  board: MondayBoard,
  item: MondayBoard["items"][number],
  boardKind: SourceRef["board"],
): SourceRef {
  return {
    board: boardKind,
    boardName: board.name,
    itemId: item.id,
    itemName: item.name,
    url: item.url || undefined,
    updatedAt: item.updatedAt || undefined,
  };
}

export function parseMoney(
  value: string | undefined,
  options: { currencyHint?: string } = {},
): { value?: MoneyValue; warning?: DataWarning } {
  const raw = cleanText(value);
  if (!raw) {
    return {
      warning: {
        code: "MISSING_VALUE",
        severity: "info",
        field: "amount",
        message: "Amount is not available for this record.",
      },
    };
  }

  const normalized = raw
    .replace(/\u00a0/g, " ")
    .replace(/,/g, "")
    .replace(/\(([^)]+)\)/, "-$1")
    .trim();

  let currency: string | undefined;
  let currencyInferred = false;
  if (/₹|\bINR\b|\brupees?\b/i.test(normalized)) currency = "INR";
  else if (/\$|\bUSD\b|\bdollars?\b/i.test(normalized)) currency = "USD";
  else if (/€|\bEUR\b/i.test(normalized)) currency = "EUR";
  else if (/£|\bGBP\b/i.test(normalized)) currency = "GBP";
  else {
    currency = options.currencyHint;
    currencyInferred = Boolean(currency);
  }

  const numberMatch = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!numberMatch) {
    return {
      warning: {
        code: "INVALID_MONEY",
        severity: "warning",
        field: "amount",
        message: `Could not parse amount “${raw}”.`,
      },
    };
  }

  let amount = Number(numberMatch[0]);
  const suffix = normalized
    .slice((numberMatch.index || 0) + numberMatch[0].length)
    .trim()
    .toLocaleLowerCase("en-US");

  if (/^(k|thousand)\b/.test(suffix)) amount *= 1_000;
  else if (/^(m|mn|million)\b/.test(suffix)) amount *= 1_000_000;
  else if (/^(b|bn|billion)\b/.test(suffix)) amount *= 1_000_000_000;
  else if (/^(cr|crore|crores)\b/.test(suffix)) amount *= 10_000_000;
  else if (/^(l|lac|lakh|lakhs)\b/.test(suffix)) amount *= 100_000;

  if (!Number.isFinite(amount)) {
    return {
      warning: {
        code: "INVALID_MONEY",
        severity: "warning",
        field: "amount",
        message: `Could not safely normalize amount “${raw}”.`,
      },
    };
  }

  return {
    value: { amount, currency, currencyInferred, raw },
    warning: !currency
      ? {
          code: "MISSING_CURRENCY",
          severity: "info",
          field: "amount",
          message: `Amount “${raw}” has no explicit currency; it is kept separate from labelled currencies.`,
        }
      : currencyInferred
        ? {
            code: "CURRENCY_ASSUMPTION",
            severity: "info",
            field: "amount",
            message: `Currency is inferred as ${currency} from documented board context rather than the individual cell.`,
          }
        : undefined,
  };
}

export function parseProbability(value: string | undefined): {
  value?: number;
  kind?: "numeric" | "qualitative";
  warning?: DataWarning;
} {
  const raw = cleanText(value);
  if (!raw) {
    return {
      warning: {
        code: "MISSING_VALUE",
        severity: "info",
        field: "probability",
        message: "Probability is not available for this deal.",
      },
    };
  }

  const normalized = canonicalText(raw);
  // The supplied tracker uses High / Medium / Low rather than percentages.
  // The mapping is explicit and exposed in every weighted-pipeline answer.
  const qualitative: Record<string, number> = { high: 0.75, medium: 0.5, low: 0.25 };
  if (normalized && qualitative[normalized] !== undefined) {
    return {
      value: qualitative[normalized],
      kind: "qualitative",
      warning: {
        code: "QUALITATIVE_PROBABILITY",
        severity: "info",
        field: "probability",
        message: `Qualitative probability “${raw}” is normalized using the documented High/Medium/Low mapping.`,
      },
    };
  }

  const numeric = raw.replace(/,/g, "").trim();
  const match = numeric.match(/^-?\d+(?:\.\d+)?/);
  if (!match) {
    return {
      warning: {
        code: "INVALID_PROBABILITY",
        severity: "warning",
        field: "probability",
        message: `Could not parse probability “${raw}”.`,
      },
    };
  }

  let probability = Number(match[0]);
  if (/%/.test(numeric) || probability > 1) probability /= 100;

  if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
    return {
      warning: {
        code: "INVALID_PROBABILITY",
        severity: "warning",
        field: "probability",
        message: `Probability “${raw}” is outside the valid 0–100% range.`,
      },
    };
  }

  return { value: probability, kind: "numeric" };
}

function isoFromDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Returns only unambiguous dates. Numeric day/month strings whose two parts can
 * both be days are intentionally reported as ambiguous rather than guessed.
 */
export function parseDate(value: string | undefined, mondayValue?: string | null): {
  value?: string;
  warning?: DataWarning;
} {
  const structured = safeJsonParse<{ date?: string }>(mondayValue);
  const structuredDate = typeof structured?.date === "string" ? structured.date : undefined;
  const raw = cleanText(structuredDate || value);
  if (!raw) {
    return {
      warning: {
        code: "MISSING_VALUE",
        severity: "info",
        field: "date",
        message: "Date is not available for this record.",
      },
    };
  }

  const iso = parseISO(raw);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw) && isValid(iso)) return { value: isoFromDate(iso) };

  const dateTime = new Date(raw);
  if (/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(raw) && isValid(dateTime)) {
    return { value: isoFromDate(dateTime) };
  }

  const numeric = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (numeric) {
    const first = Number(numeric[1]);
    const second = Number(numeric[2]);
    const year = numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3];

    if (first <= 12 && second <= 12) {
      return {
        warning: {
          code: "AMBIGUOUS_DATE",
          severity: "warning",
          field: "date",
          message: `Date “${raw}” is ambiguous (day/month order is unclear), so it was not used in date-based calculations.`,
        },
      };
    }

    const formatString = first > 12 ? "dd/MM/yyyy" : "MM/dd/yyyy";
    const parsed = parse(`${numeric[1]}/${numeric[2]}/${year}`, formatString, new Date());
    if (isValid(parsed)) return { value: isoFromDate(parsed) };
  }

  return {
    warning: {
      code: "INVALID_DATE",
      severity: "warning",
      field: "date",
      message: `Could not parse date “${raw}”.`,
    },
  };
}

export function stageCategory(value: string | undefined): {
  value: DealStageCategory;
  warning?: DataWarning;
} {
  const key = canonicalText(value);
  if (!key) {
    return {
      value: "unknown",
      warning: {
        code: "UNKNOWN_STAGE",
        severity: "warning",
        field: "stage",
        message: "Deal stage is missing or cannot be categorized.",
      },
    };
  }
  if (/\b(closed won|project won|won|contracted|converted|signed|successful|work order received|invoice sent|project completed)\b/.test(key)) return { value: "won" };
  if (/\b(closed lost|project lost|lost|dead|dropped|rejected|disqualified|cancelled|canceled|not relevant)\b/.test(key)) return { value: "lost" };
  if (/\b(lead|prospect|qualified|discovery|proposal|quote|negotiation|active|pipeline|evaluation|open|feasibility|demo|poc|on hold)\b/.test(key)) {
    return { value: "active" };
  }
  return {
    value: "unknown",
    warning: {
      code: "UNKNOWN_STAGE",
      severity: "warning",
      field: "stage",
      message: `Deal stage “${value}” is not mapped to active, won, or lost.`,
    },
  };
}

export function workOrderStatusCategory(value: string | undefined): {
  value: WorkOrderStatusCategory;
  warning?: DataWarning;
} {
  const key = canonicalText(value);
  if (!key) {
    return {
      value: "unknown",
      warning: {
        code: "UNKNOWN_STATUS",
        severity: "warning",
        field: "status",
        message: "Work-order status is missing or cannot be categorized.",
      },
    };
  }
  if (/\b(delayed|overdue|at risk|blocked|hold|on hold|issue|escalated|stalled|pause|struck|pending)\b/.test(key)) return { value: "at_risk" };
  if (/\b(partial|ongoing|executed until current month|on track|in progress|active|planned|not started|started|open)\b/.test(key)) return { value: "on_track" };
  if (/\b(complete|completed|done|delivered|closed|finished)\b/.test(key)) return { value: "complete" };
  return {
    value: "unknown",
    warning: {
      code: "UNKNOWN_STATUS",
      severity: "warning",
      field: "status",
      message: `Work-order status “${value}” is not mapped to on track, at risk, or complete.`,
    },
  };
}

export function normalizeSector(value: string | undefined): {
  value?: string;
  key?: string;
  warning?: DataWarning;
} {
  const display = cleanText(value);
  const key = canonicalText(display);
  if (!display || !key) {
    return {
      warning: {
        code: "UNKNOWN_SECTOR",
        severity: "info",
        field: "sector",
        message: "Sector is not available for this record.",
      },
    };
  }

  const simpleLabels: Record<string, string> = {
    energy: "Energy",
    // The supplied data uses operational labels rather than an umbrella
    // Energy sector. Keeping the source subtype visible makes the roll-up
    // useful without pretending that Renewables and Powerline are identical.
    renewables: "Energy / Renewables",
    powerline: "Energy / Powerline",
    manufacturing: "Manufacturing",
    agriculture: "Agriculture",
    infrastructure: "Infrastructure",
    construction: "Construction",
    logistics: "Logistics",
    telecom: "Telecom",
    mining: "Mining",
    railways: "Railways",
    others: "Other / Unclassified",
    tender: "Tender / Unclassified",
    government: "Government",
    defence: "Defence",
    defense: "Defence",
  };

  return {
    value: simpleLabels[key] || display,
    key,
  };
}

function addWarning(warnings: DataWarning[], warning?: DataWarning): void {
  if (warning) warnings.push(warning);
}

function rawRecord(item: MondayBoard["items"][number], board: MondayBoard): Record<string, string | null> {
  return Object.fromEntries(
    board.columns.map((column) => {
      const value = item.columnValues.find((itemValue) => itemValue.id === column.id);
      return [column.title, value?.text ?? value?.value ?? null];
    }),
  );
}

function rawMondayValue(
  item: MondayBoard["items"][number],
  mapping: BoardMapping,
  field: Parameters<typeof mappingFor>[1],
): string | null | undefined {
  const fieldMapping = mappingFor(mapping, field);
  if (!fieldMapping?.columnId) return undefined;
  return item.columnValues.find((column) => column.id === fieldMapping.columnId)?.value;
}

function currencyHintFor(mapping: BoardMapping, field: Parameters<typeof mappingFor>[1]): string | undefined {
  const title = mappingFor(mapping, field)?.columnTitle || "";
  return /\b(rupees?|inr)\b/i.test(title) ? "INR" : undefined;
}

function parseMappedMoney(
  item: MondayBoard["items"][number],
  mapping: BoardMapping,
  field: Parameters<typeof mappingFor>[1],
  fallbackCurrency?: string,
) {
  return parseMoney(valueForField(item, mapping, field), {
    currencyHint: currencyHintFor(mapping, field) || fallbackCurrency,
  });
}

function isEmbeddedHeaderValue(value: string | undefined): boolean {
  const key = canonicalText(value);
  return Boolean(key && /^(deal status|deal stage|close date a|closure probability|tentative close date|sector service|execution status|probable end date|probable start date)$/.test(key));
}

function addMaterialMoneyWarning(warnings: DataWarning[], warning?: DataWarning): void {
  if (!warning || warning.code === "MISSING_VALUE") return;
  addWarning(warnings, warning);
}

export function normalizeDeals(board: MondayBoard, mapping: BoardMapping): NormalizedDeal[] {
  return board.items.map((item) => {
    const warnings: DataWarning[] = [];
    // Masked Deal value does not show a per-cell currency. The companion work-
    // order tracker explicitly uses Rupees, so this assignment-level INR
    // assumption is deliberate, visible in answers, and easy to revise.
    const amount = parseMappedMoney(item, mapping, "amount", "INR");
    const probability = parseProbability(valueForField(item, mapping, "probability"));
    const closeDate = parseDate(
      valueForField(item, mapping, "closeDate"),
      rawMondayValue(item, mapping, "closeDate"),
    );
    const createdDate = parseDate(
      valueForField(item, mapping, "createdDate"),
      rawMondayValue(item, mapping, "createdDate"),
    );
    const detailedStage = valueForField(item, mapping, "stage");
    const dealStatus = valueForField(item, mapping, "dealStatus");
    const detailedStageCategory = stageCategory(detailedStage);
    const dealStatusCategory = stageCategory(dealStatus);
    // A dedicated Deal Status is the lifecycle truth when it can be classified;
    // detailed Deal Stage remains available for stage-mix analysis.
    const lifecycle = dealStatusCategory.value !== "unknown" ? dealStatusCategory : detailedStageCategory;
    const sector = normalizeSector(valueForField(item, mapping, "sector"));
    const displayName = valueForField(item, mapping, "itemName") || "Untitled deal";
    const linkName = valueForField(item, mapping, "linkedDealName") || displayName;
    const accountName = valueForField(item, mapping, "account") || displayName;
    const headerArtifact = isEmbeddedHeaderValue(detailedStage) || isEmbeddedHeaderValue(dealStatus);

    addMaterialMoneyWarning(warnings, amount.warning);
    addWarning(warnings, probability.warning);
    addWarning(warnings, closeDate.warning);
    addWarning(warnings, createdDate.warning);
    if (lifecycle.value === "unknown") addWarning(warnings, lifecycle.warning);
    addWarning(warnings, sector.warning);
    if (headerArtifact) {
      addWarning(warnings, {
        code: "EMBEDDED_HEADER_ARTIFACT",
        severity: "warning",
        field: "stage",
        message: "A repeated spreadsheet-header value was detected inside a deal record and is excluded from business analysis.",
      });
    }

    return {
      source: sourceFor(board, item, "deals"),
      raw: rawRecord(item, board),
      displayName,
      linkName,
      linkKey: canonicalText(linkName),
      accountName,
      accountKey: canonicalText(accountName),
      clientCode: valueForField(item, mapping, "clientCode"),
      sector: sector.value,
      sectorKey: sector.key,
      stage: detailedStage,
      dealStatus,
      stageCategory: lifecycle.value,
      amount: amount.value,
      probability: probability.value,
      probabilityKind: probability.kind,
      expectedCloseDate: closeDate.value,
      createdDate: createdDate.value,
      owner: valueForField(item, mapping, "owner"),
      isHeaderArtifact: headerArtifact,
      warnings,
    };
  });
}

export function normalizeWorkOrders(
  board: MondayBoard,
  mapping: BoardMapping,
): NormalizedWorkOrder[] {
  return board.items.map((item) => {
    const warnings: DataWarning[] = [];
    // Financial headers in the supplied Work Orders tracker are denominated in
    // Rupees. Some companion headers (for example Amount Receivable) omit the
    // word Rupees, so the board-level INR context is documented and applied.
    const amount = parseMappedMoney(item, mapping, "amount", "INR");
    const billedValue = parseMappedMoney(item, mapping, "billedValue", "INR");
    const collectedAmount = parseMappedMoney(item, mapping, "collectedAmount", "INR");
    const unbilledAmount = parseMappedMoney(item, mapping, "unbilledAmount", "INR");
    const receivableAmount = parseMappedMoney(item, mapping, "receivableAmount", "INR");
    const dueDate = parseDate(
      valueForField(item, mapping, "dueDate"),
      rawMondayValue(item, mapping, "dueDate"),
    );
    const startDate = parseDate(
      valueForField(item, mapping, "startDate"),
      rawMondayValue(item, mapping, "startDate"),
    );
    const deliveryDate = parseDate(
      valueForField(item, mapping, "deliveryDate"),
      rawMondayValue(item, mapping, "deliveryDate"),
    );
    const progress = parseProbability(valueForField(item, mapping, "progress"));
    const rawStatus = valueForField(item, mapping, "status");
    const status = workOrderStatusCategory(rawStatus);
    const sector = normalizeSector(valueForField(item, mapping, "sector"));
    const displayName = valueForField(item, mapping, "itemName") || "Untitled work order";
    const linkName = valueForField(item, mapping, "linkedDealName");
    const accountName = valueForField(item, mapping, "account") || displayName;
    const headerArtifact = isEmbeddedHeaderValue(rawStatus);

    addMaterialMoneyWarning(warnings, amount.warning);
    addMaterialMoneyWarning(warnings, billedValue.warning);
    addMaterialMoneyWarning(warnings, collectedAmount.warning);
    addMaterialMoneyWarning(warnings, unbilledAmount.warning);
    addMaterialMoneyWarning(warnings, receivableAmount.warning);
    addWarning(warnings, dueDate.warning);
    addWarning(warnings, startDate.warning);
    addWarning(warnings, deliveryDate.warning);
    if (progress.warning && progress.warning.code !== "MISSING_VALUE") addWarning(warnings, progress.warning);
    addWarning(warnings, status.warning);
    addWarning(warnings, sector.warning);
    if (headerArtifact) {
      addWarning(warnings, {
        code: "EMBEDDED_HEADER_ARTIFACT",
        severity: "warning",
        field: "status",
        message: "A repeated spreadsheet-header value was detected inside a work-order record and is excluded from business analysis.",
      });
    }

    return {
      source: sourceFor(board, item, "workOrders"),
      raw: rawRecord(item, board),
      displayName,
      linkName,
      linkKey: canonicalText(linkName),
      accountName,
      accountKey: canonicalText(accountName),
      clientCode: valueForField(item, mapping, "clientCode"),
      identifier: valueForField(item, mapping, "identifier"),
      sector: sector.value,
      sectorKey: sector.key,
      status: rawStatus,
      statusCategory: status.value,
      amount: amount.value,
      billedValue: billedValue.value,
      collectedAmount: collectedAmount.value,
      unbilledAmount: unbilledAmount.value,
      receivableAmount: receivableAmount.value,
      invoiceStatus: valueForField(item, mapping, "invoiceStatus"),
      billingStatus: valueForField(item, mapping, "billingStatus"),
      dueDate: dueDate.value,
      startDate: startDate.value,
      deliveryDate: deliveryDate.value,
      progress: progress.value,
      owner: valueForField(item, mapping, "owner"),
      isHeaderArtifact: headerArtifact,
      warnings,
    };
  });
}
