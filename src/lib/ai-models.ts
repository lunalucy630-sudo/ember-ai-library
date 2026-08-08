/** Client-safe catalog of the AI models Ember can talk to. */
export type AiProviderId = "gemini" | "openai" | "anthropic";

export interface AiModelOption {
  id: string;
  provider: AiProviderId;
  /** Provider-native model id (gateway ids keep their vendor prefix). */
  model: string;
  label: string;
  /** Can accept images/video/audio/file parts. */
  multimodal: boolean;
}

export const AI_MODELS: AiModelOption[] = [
  { id: "gemini-flash", provider: "gemini", model: "google/gemini-3.6-flash", label: "Gemini 3.6 Flash", multimodal: true },
  { id: "gemini-pro", provider: "gemini", model: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", multimodal: true },
  { id: "gpt-mini", provider: "openai", model: "openai/gpt-5.4-mini", label: "GPT-5.4 mini", multimodal: true },
  { id: "gpt", provider: "openai", model: "openai/gpt-5.4", label: "GPT-5.4", multimodal: true },
  { id: "claude-sonnet", provider: "anthropic", model: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", multimodal: false },
  { id: "claude-haiku", provider: "anthropic", model: "claude-haiku-4-5", label: "Claude Haiku 4.5", multimodal: false },
];

export const DEFAULT_MODEL_ID = "gemini-flash";

/** Order tried when the preferred model is unavailable or fails. */
export const FALLBACK_ORDER = ["gemini-flash", "gpt-mini", "claude-sonnet"];

export function findModel(id?: string | null): AiModelOption | undefined {
  return AI_MODELS.find((m) => m.id === id);
}

const STORAGE_KEY = "ember:aiModel";

export function getPreferredModelId(): string {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && findModel(v)) return v;
  } catch {
    /* ignore */
  }
  return DEFAULT_MODEL_ID;
}

export function setPreferredModelId(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}
