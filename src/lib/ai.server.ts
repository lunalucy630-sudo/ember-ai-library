/**
 * Provider-agnostic AI call layer.
 *
 * Every AI feature (analysis, chat, auto-organize) goes through `callAI`.
 * It picks the user's preferred model, and on failure (rate limit, outage,
 * missing key, unsupported input) falls through to the next configured
 * provider. Only when every candidate fails does it throw.
 */
import {
  AI_MODELS,
  DEFAULT_MODEL_ID,
  FALLBACK_ORDER,
  findModel,
  type AiModelOption,
} from "./ai-models";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string | Array<Record<string, unknown>>;
}

export interface CallAiOptions {
  messages: AiMessage[];
  /** Preferred model id from the user's settings. */
  modelId?: string | null;
  /** Ask the provider for a JSON object response. */
  jsonMode?: boolean;
  maxTokens?: number;
}

export interface CallAiResult {
  content: string;
  modelId: string;
  modelLabel: string;
  /** True when the preferred model failed and a fallback answered. */
  usedFallback: boolean;
}

function hasMediaParts(messages: AiMessage[]): boolean {
  return messages.some(
    (m) =>
      Array.isArray(m.content) &&
      m.content.some((p) => typeof p.type === "string" && p.type !== "text"),
  );
}

function providerAvailable(model: AiModelOption): boolean {
  if (model.provider === "anthropic") return Boolean(process.env.ANTHROPIC_API_KEY);
  return Boolean(process.env.LOVABLE_API_KEY);
}

function candidates(modelId: string | null | undefined, needsMedia: boolean): AiModelOption[] {
  const ordered: AiModelOption[] = [];
  const push = (m?: AiModelOption) => {
    if (m && !ordered.some((o) => o.id === m.id)) ordered.push(m);
  };
  push(findModel(modelId));
  for (const id of FALLBACK_ORDER) push(findModel(id));
  push(findModel(DEFAULT_MODEL_ID));
  for (const m of AI_MODELS) push(m);
  return ordered.filter((m) => providerAvailable(m) && (!needsMedia || m.multimodal));
}

function textOf(content: AiMessage["content"]): string {
  if (typeof content === "string") return content;
  return content
    .filter((p) => p.type === "text")
    .map((p) => String(p.text ?? ""))
    .join("\n\n");
}

async function callGateway(
  model: AiModelOption,
  opts: CallAiOptions,
): Promise<string> {
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: model.model,
      messages: opts.messages,
      ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    if (res.status === 429) throw new Error(`${model.label}: rate limited`);
    if (res.status === 402) throw new Error(`${model.label}: AI credits exhausted`);
    throw new Error(`${model.label}: gateway ${res.status} ${detail}`);
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content ?? "";
  if (!content.trim()) throw new Error(`${model.label}: empty response`);
  return content;
}

async function callAnthropic(model: AiModelOption, opts: CallAiOptions): Promise<string> {
  const system = opts.messages
    .filter((m) => m.role === "system")
    .map((m) => textOf(m.content))
    .join("\n\n");
  const messages = opts.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: textOf(m.content) }))
    .filter((m) => m.content.trim().length > 0);

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: model.model,
      max_tokens: opts.maxTokens ?? 8000,
      ...(system ? { system: opts.jsonMode ? `${system}\n\nRespond with valid JSON only.` : system } : {}),
      messages,
    }),
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    if (res.status === 429) throw new Error(`${model.label}: rate limited`);
    throw new Error(`${model.label}: Anthropic ${res.status} ${detail}`);
  }
  const json = (await res.json()) as { content?: Array<{ type?: string; text?: string }> };
  const content = (json.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("");
  if (!content.trim()) throw new Error(`${model.label}: empty response`);
  return content;
}

export async function callAI(opts: CallAiOptions): Promise<CallAiResult> {
  const needsMedia = hasMediaParts(opts.messages);
  const list = candidates(opts.modelId, needsMedia);
  if (list.length === 0) {
    throw new Error(
      "No AI provider is configured. Add LOVABLE_API_KEY (built in) or ANTHROPIC_API_KEY.",
    );
  }

  const errors: string[] = [];
  for (const [i, model] of list.entries()) {
    try {
      const content =
        model.provider === "anthropic"
          ? await callAnthropic(model, opts)
          : await callGateway(model, opts);
      return {
        content,
        modelId: model.id,
        modelLabel: model.label,
        usedFallback: i > 0,
      };
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  throw new Error(`All AI providers failed. ${errors.join(" | ")}`);
}
