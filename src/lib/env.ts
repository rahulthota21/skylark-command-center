import "server-only";

export interface MondayEnvironment {
  token: string;
  salesBoardId: string;
  workOrdersBoardId: string;
}

export interface LlmEnvironment {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export class AppConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppConfigurationError";
  }
}

function value(name: string): string | undefined {
  const result = process.env[name]?.trim();
  return result || undefined;
}

export function getMissingMondayVariables(): string[] {
  const required = [
    "MONDAY_API_TOKEN",
    "MONDAY_SALES_BOARD_ID",
    "MONDAY_WORK_ORDERS_BOARD_ID",
  ];
  return required.filter((name) => !value(name));
}

export function hasMondayConfiguration(): boolean {
  return getMissingMondayVariables().length === 0;
}

export function getMondayEnvironment(): MondayEnvironment {
  const missing = getMissingMondayVariables();
  if (missing.length > 0) {
    throw new AppConfigurationError(
      `Missing required monday.com configuration: ${missing.join(", ")}`,
    );
  }

  return {
    token: value("MONDAY_API_TOKEN")!,
    salesBoardId: value("MONDAY_SALES_BOARD_ID")!,
    workOrdersBoardId: value("MONDAY_WORK_ORDERS_BOARD_ID")!,
  };
}

export function getLlmEnvironment(): LlmEnvironment | null {
  const apiKey = value("LLM_API_KEY");
  if (!apiKey) return null;

  return {
    apiKey,
    baseUrl: (value("LLM_BASE_URL") || "https://api.openai.com/v1").replace(/\/$/, ""),
    model: value("LLM_MODEL") || "gpt-4o-mini",
  };
}
