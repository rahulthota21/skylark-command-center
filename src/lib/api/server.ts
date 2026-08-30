import "server-only";

import type { HealthResponse } from "@/lib/api/types";
import { dashboardSnapshot } from "@/lib/analytics/metrics";
import { getMissingMondayVariables } from "@/lib/env";
import { loadLiveData } from "@/lib/data/load-data";
import { AppConfigurationError } from "@/lib/env";
import { MondayApiError } from "@/lib/monday/client";

export function setupRequiredResponse(): HealthResponse {
  const missing = getMissingMondayVariables();
  return {
    status: "setup_required",
    message: "Connect the two monday.com boards to begin live analysis.",
    setup: {
      requiredVariables: missing,
      instructions: [
        "Import the Deals and Work Orders spreadsheets as separate monday.com boards.",
        "Create a least-privilege monday API token with read access to those boards.",
        "Add MONDAY_API_TOKEN, MONDAY_SALES_BOARD_ID, and MONDAY_WORK_ORDERS_BOARD_ID as server-side environment variables.",
        "Refresh this page after deployment. No local spreadsheet fallback is used.",
      ],
    },
  };
}

export async function getHealth(force = false): Promise<HealthResponse> {
  try {
    const context = await loadLiveData({ force });
    return {
      status: "connected",
      syncedAt: context.syncedAt,
      cacheState: context.cacheState,
      boards: [
        { kind: "deals", name: context.dealsBoard.name, recordCount: context.deals.length },
        { kind: "workOrders", name: context.workOrdersBoard.name, recordCount: context.workOrders.length },
      ],
      quality: context.quality,
      snapshot: dashboardSnapshot(context),
    };
  } catch (error) {
    if (error instanceof AppConfigurationError) return setupRequiredResponse();
    const retryable = error instanceof MondayApiError && error.retryable;
    return {
      status: "unavailable",
      message: retryable
        ? "monday.com is temporarily unavailable. Please retry the live sync."
        : "The monday.com connection could not be completed. Check board access and configuration, then retry.",
    };
  }
}

export function safeApiError(error: unknown): { status: "setup_required" | "unavailable"; message: string } {
  if (error instanceof AppConfigurationError) {
    return {
      status: "setup_required",
      message: "Connect the monday.com boards before using the BI agent.",
    };
  }
  return {
    status: "unavailable",
    message: "Live board data is unavailable at the moment. Please retry after checking the connection.",
  };
}
