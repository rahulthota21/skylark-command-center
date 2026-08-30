import "server-only";

import { hasMondayConfiguration } from "@/lib/env";
import { linkWorkOrdersToDeals } from "@/lib/data/entity-resolution";
import { withQuality } from "@/lib/data/data-quality";
import { normalizeDeals, normalizeWorkOrders } from "@/lib/data/normalization";
import { inferBoardMapping } from "@/lib/data/semantic-mapping";
import type { DataContext } from "@/lib/data/types";
import { fetchBoard } from "@/lib/monday/client";
import { getMondayEnvironment } from "@/lib/env";

const CACHE_TTL_MS = 60_000;

let cache: { context: DataContext; expiresAt: number } | null = null;

export function mondayIsConfigured(): boolean {
  return hasMondayConfiguration();
}

export async function loadLiveData(options: { force?: boolean } = {}): Promise<DataContext> {
  const now = Date.now();
  if (!options.force && cache && cache.expiresAt > now) {
    return { ...cache.context, cacheState: "cached" };
  }

  const environment = getMondayEnvironment();

  try {
    const [dealsBoard, workOrdersBoard] = await Promise.all([
      fetchBoard(environment.salesBoardId),
      fetchBoard(environment.workOrdersBoardId),
    ]);

    const dealMapping = inferBoardMapping(dealsBoard, "deals");
    const workOrderMapping = inferBoardMapping(workOrdersBoard, "workOrders");
    const deals = normalizeDeals(dealsBoard, dealMapping);
    const workOrders = normalizeWorkOrders(workOrdersBoard, workOrderMapping);
    const links = linkWorkOrdersToDeals(workOrders, deals);
    const context = withQuality({
      dealsBoard,
      workOrdersBoard,
      deals,
      workOrders,
      dealMapping,
      workOrderMapping,
      links,
      syncedAt: new Date().toISOString(),
      cacheState: "fresh",
    });

    cache = { context, expiresAt: now + CACHE_TTL_MS };
    return context;
  } catch (error) {
    // A stale response is only ever a prior live Monday read. It is explicitly
    // labelled so a caller never mistakes it for a current refresh.
    if (cache) {
      return {
        ...cache.context,
        cacheState: "stale",
        quality: {
          ...cache.context.quality,
          warnings: [
            {
              code: "MISSING_VALUE",
              severity: "warning",
              message:
                "monday.com could not be refreshed. Showing the last successful live sync; retry before making a decision.",
            },
            ...cache.context.quality.warnings,
          ],
        },
      };
    }
    throw error;
  }
}

export function clearLiveDataCache(): void {
  cache = null;
}
