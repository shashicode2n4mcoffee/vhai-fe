/**
 * DeepSeek API client — OpenAI-compatible chat completions for aptitude, coding, report.
 * Uses DeepSeek-V3.2 (deepseek-chat).
 */

import { getDeepSeekConfig } from "./deepseek-key";

const DEEPSEEK_API_BASE = "https://api.deepseek.com";

/** API only accepts these model IDs; anything else causes "Model Not Exist". */
const VALID_MODELS = ["deepseek-chat", "deepseek-reasoner"] as const;
/** DeepSeek API max_tokens valid range is [1, 8192]. */
const MAX_TOKENS_LIMIT = 8192;

function normalizeModel(value: string): string {
  const lower = value.trim().toLowerCase();
  if (VALID_MODELS.includes(lower as (typeof VALID_MODELS)[number])) return lower;
  if (lower.includes("reasoner")) return "deepseek-reasoner";
  return "deepseek-chat";
}

export interface DeepSeekCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  signal?: AbortSignal;
}

/**
 * Call DeepSeek chat completions and return the assistant message content.
 * When jsonMode is true, response_format is set to json_object.
 */
export async function callDeepSeek(
  prompt: string,
  options: DeepSeekCompletionOptions = {},
): Promise<string> {
  const config = await getDeepSeekConfig();
  const { temperature = 0.7, maxTokens = 8192, jsonMode = false, signal } = options;
  const model = normalizeModel(config.model);
  const cappedTokens = Math.min(MAX_TOKENS_LIMIT, Math.max(1, maxTokens));

  const body: Record<string, unknown> = {
    model,
    messages: [{ role: "user", content: prompt }],
    temperature,
    max_tokens: cappedTokens,
  };
  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(`${DEEPSEEK_API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DeepSeek API error (${res.status}): ${text.slice(0, 500)}`);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data?.choices?.[0]?.message?.content;
  if (content == null) {
    throw new Error("DeepSeek returned no content");
  }
  return content;
}

/**
 * Call DeepSeek and parse response as JSON. Uses json_object response format.
 */
export async function callDeepSeekJson<T = unknown>(
  prompt: string,
  options: Omit<DeepSeekCompletionOptions, "jsonMode"> & { signal?: AbortSignal } = {},
): Promise<T> {
  const text = await callDeepSeek(prompt, { ...options, jsonMode: true });
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("DeepSeek response was not valid JSON");
  }
}
