/**
 * Model access, provider-agnostic.
 *
 * Two shapes are supported: Anthropic's native messages API, and any
 * OpenAI-compatible /chat/completions endpoint — which covers Google AI Studio,
 * Groq, OpenRouter, and a local Ollama. Swap providers with env vars alone;
 * nothing else in the app knows or cares which one is answering.
 *
 * Quality note: the prompts lean hard on a long list of prohibitions, and
 * holding that line is exactly what smaller models are worst at. Free providers
 * are fine for proving the plumbing. Judge the writing on a strong one.
 */
import "server-only";
import { tryParse } from "./json";

type Role = "map" | "author";

const PROVIDER = (process.env.MODEL_PROVIDER ?? "anthropic").toLowerCase();

/**
 * Headroom, not a target. A reasoning model spends hidden thinking tokens out of
 * this same budget without reporting them in `completion_tokens`, so a cap sized
 * to the visible reply gets consumed before the model writes anything: at 2000
 * the cartographer came back `finish_reason: "length"` having emitted 78 tokens,
 * which surfaces as "reply hit the token cap mid-object". The replies
 * themselves run 75-530 tokens.
 */
const MAX_TOKENS = 8000;

const MODELS: Record<Role, string> = {
  map: process.env.MODEL_MAP ?? "claude-sonnet-5",
  author: process.env.MODEL_AUTHOR ?? "claude-opus-5",
};

const TAIL =
  "\n\nRespond with the JSON object only. Your first character must be { and your " +
  "last must be }. No preamble, no explanation, no questions, no markdown fences.";

const STERN =
  "\n\nYour last reply was not JSON and was discarded. Do not explain, do not ask. " +
  "Emit the object and nothing else.";

type Reply = { text: string; truncated: boolean };

async function callAnthropic(model: string, system: string, user: string, signal?: AbortSignal): Promise<Reply> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal,
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model, max_tokens: MAX_TOKENS, system, messages: [{ role: "user", content: user }] }),
  });

  if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const data = await res.json();
  return {
    text: (data.content ?? [])
      .filter((c: { type: string }) => c.type === "text")
      .map((c: { text: string }) => c.text)
      .join(""),
    truncated: data.stop_reason === "max_tokens",
  };
}

async function callOpenAICompatible(model: string, system: string, user: string, signal?: AbortSignal): Promise<Reply> {
  const base = process.env.OPENAI_BASE_URL;
  if (!base) throw new Error("OPENAI_BASE_URL is not set");
  // a local Ollama needs no key; hosted providers do
  const key = process.env.OPENAI_API_KEY ?? "not-needed";

  const res = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    signal,
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) throw new Error(`model ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const data = await res.json();
  const choice = data.choices?.[0];
  return {
    text: choice?.message?.content ?? "",
    truncated: choice?.finish_reason === "length",
  };
}

function send(model: string, system: string, user: string, signal?: AbortSignal): Promise<Reply> {
  return PROVIDER === "anthropic"
    ? callAnthropic(model, system, user, signal)
    : callOpenAICompatible(model, system, user, signal);
}

export async function callJSON<T>(role: Role, system: string, user: string, signal?: AbortSignal): Promise<T> {
  const model = MODELS[role];

  let { text, truncated } = await send(model, system, user + TAIL, signal);
  let parsed = tryParse<T>(text);
  if (parsed) return parsed;

  ({ text, truncated } = await send(model, system, user + TAIL + STERN, signal));
  parsed = tryParse<T>(text);
  if (parsed) return parsed;

  throw new Error(
    truncated ? "reply hit the token cap mid-object" : `model answered in prose: ${text.slice(0, 200)}`,
  );
}
