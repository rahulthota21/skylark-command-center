import "server-only";

import { getMondayEnvironment } from "@/lib/env";
import type {
  MondayBoard,
  MondayColumn,
  MondayColumnValue,
  MondayItem,
} from "@/lib/data/types";
import { BOARD_QUERY, NEXT_ITEMS_QUERY } from "@/lib/monday/queries";

const MONDAY_ENDPOINT = "https://api.monday.com/v2";
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;

export class MondayApiError extends Error {
  public readonly retryable: boolean;
  public readonly status?: number;

  constructor(message: string, options: { retryable?: boolean; status?: number } = {}) {
    super(message);
    this.name = "MondayApiError";
    this.retryable = options.retryable ?? false;
    this.status = options.status;
  }
}

interface GraphqlError {
  message?: string;
  extensions?: { code?: string; status_code?: number };
}

interface MondayItemResponse {
  id: string | number;
  name: string;
  url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  column_values?: Array<{
    id: string;
    text?: string | null;
    value?: string | null;
    type?: string | null;
  }>;
}

interface BoardResponse {
  id: string | number;
  name: string;
  columns?: Array<{ id: string; title: string; type: string }>;
  items_page?: { cursor?: string | null; items?: MondayItemResponse[] };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function normalizeItem(item: MondayItemResponse): MondayItem {
  return {
    id: String(item.id),
    name: item.name || "Untitled item",
    url: item.url ?? undefined,
    createdAt: item.created_at ?? undefined,
    updatedAt: item.updated_at ?? undefined,
    columnValues: (item.column_values || []).map(
      (columnValue): MondayColumnValue => ({
        id: columnValue.id,
        text: columnValue.text ?? null,
        value: columnValue.value ?? null,
        type: columnValue.type ?? null,
      }),
    ),
  };
}

async function request<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const { token } = getMondayEnvironment();
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(MONDAY_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
          "API-Version": "2026-01",
        },
        body: JSON.stringify({ query, variables }),
        cache: "no-store",
        signal: controller.signal,
      });

      const body = (await response.json().catch(() => null)) as
        | { data?: T; errors?: GraphqlError[] }
        | null;

      if (!response.ok) {
        const message = body?.errors?.[0]?.message || `monday.com returned HTTP ${response.status}.`;
        throw new MondayApiError(message, {
          status: response.status,
          retryable: isRetryableStatus(response.status),
        });
      }

      if (body?.errors?.length) {
        const first = body.errors[0];
        const status = first.extensions?.status_code;
        throw new MondayApiError(first.message || "monday.com returned a GraphQL error.", {
          status,
          retryable: status ? isRetryableStatus(status) : false,
        });
      }

      if (!body?.data) {
        throw new MondayApiError("monday.com returned an empty response.", { retryable: true });
      }

      return body.data;
    } catch (error) {
      lastError = error;
      const retryable =
        error instanceof MondayApiError
          ? error.retryable
          : error instanceof Error && error.name === "AbortError";

      if (!retryable || attempt === MAX_ATTEMPTS - 1) break;
      await sleep(350 * 2 ** attempt + Math.floor(Math.random() * 120));
    } finally {
      clearTimeout(timeout);
    }
  }

  if (lastError instanceof MondayApiError) throw lastError;
  if (lastError instanceof Error && lastError.name === "AbortError") {
    throw new MondayApiError("The monday.com request timed out. Please retry.", { retryable: true });
  }
  throw new MondayApiError("Unable to reach monday.com. Please retry shortly.", { retryable: true });
}

export async function fetchBoard(boardId: string): Promise<MondayBoard> {
  const first = await request<{ boards?: BoardResponse[] }>(BOARD_QUERY, {
    boardId: [boardId],
  });
  const board = first.boards?.[0];

  if (!board) {
    throw new MondayApiError(
      "The configured monday.com board could not be found or is not accessible to this token.",
    );
  }

  const columns: MondayColumn[] = (board.columns || []).map((column) => ({
    id: column.id,
    title: column.title,
    type: column.type,
  }));

  const items = (board.items_page?.items || []).map(normalizeItem);
  let cursor = board.items_page?.cursor ?? null;

  while (cursor) {
    const next = await request<{
      next_items_page?: { cursor?: string | null; items?: MondayItemResponse[] };
    }>(NEXT_ITEMS_QUERY, { cursor });
    const page = next.next_items_page;
    if (!page) break;
    items.push(...(page.items || []).map(normalizeItem));
    cursor = page.cursor ?? null;
  }

  return {
    id: String(board.id),
    name: board.name,
    columns,
    items,
  };
}
