import "server-only";

import { getLlmEnvironment } from "@/lib/env";

function stripJsonFences(content: string): string {
  return content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

/**
 * Minimal OpenAI-compatible adapter. It is intentionally server-only and used
 * only after deterministic calculation. Any provider failure returns null and
 * callers fall back to the deterministic analyst rather than fabricating text.
 */
export async function requestJson<T>(input: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<T | null> {
  const environment = getLlmEnvironment();
  if (!environment) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18_000);
  try {
    const response = await fetch(`${environment.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${environment.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: environment.model,
        temperature: 0.15,
        max_tokens: input.maxTokens ?? 700,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
      }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const content = body.choices?.[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(stripJsonFences(content)) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
