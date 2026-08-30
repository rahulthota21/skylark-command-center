import { describe, expect, it } from "vitest";

import { linkWorkOrdersToDeals, similarity } from "@/lib/data/entity-resolution";
import type { NormalizedDeal, NormalizedWorkOrder } from "@/lib/data/types";

function deal(accountName: string, accountKey: string, id = "deal-1"): NormalizedDeal {
  return {
    source: { board: "deals", boardName: "Deals", itemId: id, itemName: accountName },
    raw: {}, displayName: accountName, accountName, accountKey,
    stageCategory: "active", warnings: [],
  };
}

function workOrder(accountName: string, accountKey: string, id = "wo-1"): NormalizedWorkOrder {
  return {
    source: { board: "workOrders", boardName: "Work Orders", itemId: id, itemName: accountName },
    raw: {}, displayName: accountName, accountName, accountKey,
    statusCategory: "on_track", warnings: [],
  };
}

describe("conservative entity resolution", () => {
  it("creates an exact link only for the same canonical account", () => {
    const [link] = linkWorkOrdersToDeals(
      [workOrder("Acme Energy Pvt Ltd", "acme energy")],
      [deal("ACME Energy", "acme energy")],
    );
    expect(link).toMatchObject({ confidence: "exact", dealId: "deal-1" });
  });

  it("does not force weak fuzzy matches", () => {
    const [link] = linkWorkOrdersToDeals(
      [workOrder("Sky Power", "sky power")],
      [deal("Sun Power", "sun power")],
    );
    expect(link.confidence).toBe("unmatched");
  });

  it("exposes similarity as a bounded score", () => {
    expect(similarity("acme energy", "acme energy")).toBe(1);
    expect(similarity("acme", "other")).toBeGreaterThanOrEqual(0);
  });
});
