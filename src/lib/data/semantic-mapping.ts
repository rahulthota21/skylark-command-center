import type {
  BoardKind,
  BoardMapping,
  FieldMapping,
  MondayBoard,
  MondayColumn,
  SemanticField,
} from "@/lib/data/types";

interface FieldSpec {
  aliases: string[];
  preferredTypes?: string[];
  required?: boolean;
  fallbackToItemName?: boolean;
}

const DEAL_SPECS: Partial<Record<SemanticField, FieldSpec>> = {
  itemName: { aliases: [], required: true },
  // The supplied tracker uses the Item Name for the masked Deal Name. Client
  // Code is still retained separately because it is not a safe cross-board key.
  linkedDealName: { aliases: ["deal name", "deal name masked"], fallbackToItemName: true },
  account: {
    aliases: ["account", "customer", "client", "company", "organisation", "organization"],
    preferredTypes: ["text", "dropdown", "status"],
    fallbackToItemName: true,
  },
  clientCode: {
    aliases: ["client code", "customer code", "client id", "account code"],
    preferredTypes: ["text", "dropdown", "numbers", "numeric"],
  },
  sector: {
    aliases: ["sector service", "sector", "industry", "vertical", "market segment", "segment"],
    preferredTypes: ["dropdown", "status", "text"],
  },
  stage: {
    aliases: ["deal stage", "sales stage", "pipeline stage", "stage"],
    preferredTypes: ["status", "dropdown", "text"],
    required: true,
  },
  dealStatus: {
    aliases: ["deal status", "lifecycle status", "opportunity status"],
    preferredTypes: ["status", "dropdown", "text"],
    required: true,
  },
  amount: {
    aliases: ["masked deal value", "deal value", "deal amount", "opportunity value", "contract value", "amount", "value"],
    preferredTypes: ["numbers", "numeric", "text", "formula"],
  },
  probability: {
    aliases: ["closure probability", "probability", "likelihood", "win probability", "chance", "confidence"],
    preferredTypes: ["numbers", "numeric", "text"],
  },
  closeDate: {
    aliases: ["tentative close date", "expected close date", "forecast close", "close date", "expected closure", "closing date"],
    preferredTypes: ["date", "timeline", "text"],
  },
  createdDate: {
    aliases: ["created date", "deal created date", "creation date"],
    preferredTypes: ["date", "timeline", "text"],
  },
  owner: {
    aliases: ["owner code", "owner", "sales owner", "account owner", "deal owner", "responsible"],
    preferredTypes: ["people", "text", "dropdown"],
  },
  identifier: {
    aliases: ["deal id", "opportunity id", "crm id"],
    preferredTypes: ["text", "numbers", "numeric"],
  },
};

const WORK_ORDER_SPECS: Partial<Record<SemanticField, FieldSpec>> = {
  itemName: { aliases: [], required: true },
  // In the supplied tracker, Serial # is the preferred Item Name and this
  // separate masked Deal Name is used only for transparent group-level joins.
  linkedDealName: {
    aliases: ["deal name masked", "deal name", "linked deal"],
    preferredTypes: ["text", "dropdown"],
  },
  account: {
    aliases: ["customer name code", "account", "customer", "client", "company", "organisation", "organization"],
    preferredTypes: ["text", "dropdown", "status"],
    fallbackToItemName: true,
  },
  clientCode: {
    aliases: ["customer name code", "customer code", "client code", "account code"],
    preferredTypes: ["text", "dropdown", "numbers", "numeric"],
  },
  sector: {
    aliases: ["sector", "industry", "vertical", "market segment", "segment"],
    preferredTypes: ["dropdown", "status", "text"],
  },
  status: {
    aliases: ["execution status", "project status", "work order status", "delivery status", "status"],
    preferredTypes: ["status", "dropdown", "text"],
    required: true,
  },
  amount: {
    aliases: ["amount in rupees incl of gst masked", "contract value", "project value", "work order value", "amount in rupees", "amount", "value"],
    preferredTypes: ["numbers", "numeric", "text", "formula"],
  },
  billedValue: {
    aliases: ["billed value in rupees incl of gst masked", "billed value", "invoiced value"],
    preferredTypes: ["numbers", "numeric", "text", "formula"],
  },
  collectedAmount: {
    aliases: ["collected amount in rupees incl of gst masked", "collected amount", "collection amount"],
    preferredTypes: ["numbers", "numeric", "text", "formula"],
  },
  unbilledAmount: {
    aliases: ["amount to be billed in rs incl of gst masked", "amount to be billed", "unbilled amount"],
    preferredTypes: ["numbers", "numeric", "text", "formula"],
  },
  receivableAmount: {
    aliases: ["amount receivable masked", "amount receivable", "receivable", "accounts receivable"],
    preferredTypes: ["numbers", "numeric", "text", "formula"],
  },
  invoiceStatus: {
    aliases: ["invoice status", "invoicing status"],
    preferredTypes: ["status", "dropdown", "text"],
  },
  billingStatus: {
    aliases: ["billing status", "billing state"],
    preferredTypes: ["status", "dropdown", "text"],
  },
  dueDate: {
    aliases: ["probable end date", "due date", "planned end", "end date", "delivery date", "completion date", "deadline"],
    preferredTypes: ["date", "timeline", "text"],
  },
  startDate: {
    aliases: ["probable start date", "start date", "project start", "kickoff", "planned start"],
    preferredTypes: ["date", "timeline", "text"],
  },
  deliveryDate: {
    aliases: ["data delivery date", "actual delivery date", "delivery date"],
    preferredTypes: ["date", "timeline", "text"],
  },
  progress: {
    aliases: ["progress", "completion percentage", "% complete", "percent complete", "completion"],
    preferredTypes: ["numbers", "numeric", "text", "battery"],
  },
  owner: {
    aliases: ["bd kam personnel code", "project manager", "owner", "delivery owner", "responsible", "manager"],
    preferredTypes: ["people", "text", "dropdown"],
  },
  identifier: {
    aliases: ["serial", "serial number", "work order id", "project id", "wo id", "order id"],
    preferredTypes: ["text", "numbers", "numeric"],
    fallbackToItemName: true,
  },
};

function normaliseTitle(value: string): string {
  return value
    .toLocaleLowerCase("en-US")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function wordOverlapScore(left: string, right: string): number {
  const a = new Set(normaliseTitle(left).split(" ").filter(Boolean));
  const b = new Set(normaliseTitle(right).split(" ").filter(Boolean));
  if (a.size === 0 || b.size === 0) return 0;
  const overlap = [...a].filter((word) => b.has(word)).length;
  return overlap / Math.max(a.size, b.size);
}

function candidateScore(column: MondayColumn, spec: FieldSpec): { score: number; reason: string } {
  const title = normaliseTitle(column.title);
  let best = 0;
  let exact = false;

  for (const alias of spec.aliases) {
    const normalisedAlias = normaliseTitle(alias);
    if (title === normalisedAlias) {
      best = Math.max(best, 100);
      exact = true;
      continue;
    }
    if (title.includes(normalisedAlias) || normalisedAlias.includes(title)) {
      best = Math.max(best, 83);
      continue;
    }
    best = Math.max(best, Math.round(wordOverlapScore(title, normalisedAlias) * 65));
  }

  const type = column.type.toLowerCase();
  const hasPreferredType = spec.preferredTypes?.some((preferred) => type.includes(preferred));
  if (hasPreferredType) best += 8;
  if (best > 100) best = 100;

  const reason = exact
    ? `Exact title match${hasPreferredType ? " and compatible column type" : ""}`
    : hasPreferredType
      ? "Title similarity with compatible column type"
      : "Title similarity";

  return { score: best, reason };
}

function confidenceFor(score: number): FieldMapping["confidence"] {
  if (score >= 90) return "high";
  if (score >= 70) return "medium";
  if (score >= 48) return "low";
  return "missing";
}

function mappingsFor(
  board: MondayBoard,
  kind: BoardKind,
  specs: Partial<Record<SemanticField, FieldSpec>>,
): FieldMapping[] {
  return (Object.keys(specs) as SemanticField[]).map((field) => {
    if (field === "itemName") {
      return {
        field,
        columnTitle: "Item name",
        confidence: "high",
        score: 100,
        reason: "monday.com item name",
      };
    }

    const spec = specs[field]!;
    const candidates = board.columns
      .map((column) => ({ column, ...candidateScore(column, spec) }))
      .sort((a, b) => b.score - a.score);
    const best = candidates[0];

    if (!best || best.score < 48) {
      if (spec.fallbackToItemName) {
        return {
          field,
          columnTitle: "Item name",
          confidence: "low",
          score: 45,
          reason:
            field === "linkedDealName"
              ? "No separate masked-deal link column was found; the monday item name is used as the documented join key."
              : "No dedicated account/customer column found; item name is used only as a cautious matching fallback",
        };
      }
      return {
        field,
        columnTitle: "Not mapped",
        confidence: "missing",
        score: 0,
        reason: spec.required
          ? "Required field could not be inferred from board column names"
          : "No reliable matching column was found",
      };
    }

    return {
      field,
      columnId: best.column.id,
      columnTitle: best.column.title,
      confidence: confidenceFor(best.score),
      score: best.score,
      reason: best.reason,
    };
  });
}

export function inferBoardMapping(board: MondayBoard, kind: BoardKind): BoardMapping {
  const specs = kind === "deals" ? DEAL_SPECS : WORK_ORDER_SPECS;
  return {
    kind,
    boardId: board.id,
    boardName: board.name,
    fields: mappingsFor(board, kind, specs),
  };
}

export function mappingFor(
  mapping: BoardMapping,
  field: SemanticField,
): FieldMapping | undefined {
  return mapping.fields.find((entry) => entry.field === field);
}

export function mappedColumnIds(mapping: BoardMapping): Set<string> {
  return new Set(
    mapping.fields
      .map((field) => field.columnId)
      .filter((columnId): columnId is string => Boolean(columnId)),
  );
}
