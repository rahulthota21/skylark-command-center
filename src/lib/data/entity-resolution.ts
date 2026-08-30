import type {
  EntityLink,
  NormalizedDeal,
  NormalizedWorkOrder,
} from "@/lib/data/types";

function levenshtein(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const before = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
      diagonal = before;
    }
  }
  return previous[right.length];
}

export function similarity(left: string, right: string): number {
  if (left === right) return 1;
  const longest = Math.max(left.length, right.length);
  if (!longest) return 0;
  return 1 - levenshtein(left, right) / longest;
}

/**
 * The supplied trackers share a masked Deal Name but not a common unique
 * customer code. Therefore joins use that shared label first. A label that
 * maps to multiple sales rows is recorded as a group-level relationship, not
 * deceptively presented as a one-to-one match.
 */
export function linkWorkOrdersToDeals(
  workOrders: NormalizedWorkOrder[],
  deals: NormalizedDeal[],
): EntityLink[] {
  const byLinkKey = new Map<string, NormalizedDeal[]>();
  const byAccountKey = new Map<string, NormalizedDeal[]>();

  for (const deal of deals.filter((deal) => !deal.isHeaderArtifact)) {
    if (deal.linkKey) byLinkKey.set(deal.linkKey, [...(byLinkKey.get(deal.linkKey) || []), deal]);
    if (deal.accountKey) byAccountKey.set(deal.accountKey, [...(byAccountKey.get(deal.accountKey) || []), deal]);
  }

  return workOrders.map((workOrder): EntityLink => {
    if (workOrder.isHeaderArtifact) {
      return {
        workOrderId: workOrder.source.itemId,
        confidence: "unmatched",
        reason: "Work-order row appears to contain an embedded header artifact.",
      };
    }

    const linkKey = workOrder.linkKey;
    const linkedDeals = linkKey ? byLinkKey.get(linkKey) || [] : [];
    if (linkedDeals.length === 1) {
      return {
        workOrderId: workOrder.source.itemId,
        dealId: linkedDeals[0].source.itemId,
        dealIds: [linkedDeals[0].source.itemId],
        accountKey: linkKey,
        confidence: "exact",
        score: 1,
        reason: "Exact shared masked Deal Name match.",
      };
    }
    if (linkedDeals.length > 1) {
      return {
        workOrderId: workOrder.source.itemId,
        dealId: linkedDeals[0].source.itemId,
        dealIds: linkedDeals.map((deal) => deal.source.itemId),
        accountKey: linkKey,
        confidence: "grouped",
        score: 1,
        reason: `Exact shared masked Deal Name match to ${linkedDeals.length} sales rows; this is a group-level relationship, not a one-to-one join.`,
      };
    }

    const accountKey = workOrder.accountKey;
    const exactAccounts = accountKey ? byAccountKey.get(accountKey) || [] : [];
    if (exactAccounts.length === 1) {
      return {
        workOrderId: workOrder.source.itemId,
        dealId: exactAccounts[0].source.itemId,
        dealIds: [exactAccounts[0].source.itemId],
        accountKey,
        confidence: "exact",
        score: 1,
        reason: "Exact canonical customer/account-code match.",
      };
    }
    if (exactAccounts.length > 1) {
      return {
        workOrderId: workOrder.source.itemId,
        dealId: exactAccounts[0].source.itemId,
        dealIds: exactAccounts.map((deal) => deal.source.itemId),
        accountKey,
        confidence: "grouped",
        score: 1,
        reason: `Exact account key matches ${exactAccounts.length} sales rows; relationship is group-level.`,
      };
    }

    const candidates = deals
      .filter((deal) => deal.linkKey && linkKey && deal.linkKey.length >= 4 && linkKey.length >= 4)
      .map((deal) => ({ deal, score: similarity(linkKey!, deal.linkKey!) }))
      .sort((a, b) => b.score - a.score);
    const best = candidates[0];
    const second = candidates[1];

    // Fuzzy matching is intentionally conservative. It is a review signal,
    // never silently used as a certain cross-board relationship.
    if (best && best.score >= 0.92 && (!second || best.score - second.score >= 0.05)) {
      return {
        workOrderId: workOrder.source.itemId,
        dealId: best.deal.source.itemId,
        dealIds: [best.deal.source.itemId],
        accountKey: linkKey,
        confidence: "probable",
        score: best.score,
        reason: `Probable masked Deal Name match (${Math.round(best.score * 100)}% similarity); review before using for a decision.`,
      };
    }

    return {
      workOrderId: workOrder.source.itemId,
      accountKey: linkKey || accountKey,
      confidence: "unmatched",
      reason: linkKey
        ? "No exact or sufficiently unambiguous masked Deal Name match was found."
        : "Work order has no masked Deal Name available for cross-board matching.",
    };
  });
}
