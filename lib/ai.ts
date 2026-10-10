type AISettings = {
  AI_API_KEY?: string;
  AI_BASE_URL?: string;
  AI_ALLOWED_ORIGIN?: string;
  AI_MODEL?: string;
  AI_CHAT_OPTIONS_JSON?: string;
  AI_RESEARCH_OPTIONS_JSON?: string;
  AI_CITATIONS_PATH?: string;
};

/** Only send credentials to the independently configured, trusted HTTPS origin. */
export function aiEndpoint(settings: AISettings): string {
  const base = new URL(settings.AI_BASE_URL || "");
  const allowed = new URL(settings.AI_ALLOWED_ORIGIN || "");
  if (base.protocol !== "https:" || allowed.protocol !== "https:" ||
      base.origin !== allowed.origin || base.username || base.password ||
      allowed.username || allowed.password || base.search || base.hash ||
      allowed.pathname !== "/" || allowed.search || allowed.hash)
    throw new Error("Invalid AI endpoint configuration.");
  base.pathname = base.pathname.replace(/\/+$/, "") + "/chat/completions";
  return base.href;
}

export function aiReady(settings: AISettings): boolean {
  if (!settings.AI_API_KEY?.trim() || !settings.AI_MODEL?.trim()) return false;
  try { aiEndpoint(settings); return true; } catch { return false; }
}

function requestOptions(value: string | undefined): Record<string, unknown> {
  const options: unknown = JSON.parse(value || "{}");
  if (!options || typeof options !== "object" || Array.isArray(options))
    throw new Error("AI request options must be a JSON object.");
  return options as Record<string, unknown>;
}

export type ChatContent = string | Array<
  | { type: "text"; text: string }
  | { type: "file"; file: { filename: string; file_data: string } }
>;
export type ChatMessage = { role: "user" | "assistant"; content: ChatContent };

export function aiRequest(settings: AISettings, instructions: string, messages: ChatMessage[], research: boolean) {
  if (research && !settings.AI_RESEARCH_OPTIONS_JSON?.trim())
    throw new Error("AI research options are not configured.");
  return {
    ...requestOptions(settings.AI_CHAT_OPTIONS_JSON),
    ...(research ? requestOptions(settings.AI_RESEARCH_OPTIONS_JSON) : {}),
    // Runtime options cannot replace the conversation or enable provider storage.
    model: settings.AI_MODEL,
    messages: [{ role: "system", content: instructions }, ...messages],
    store: false,
    max_tokens: 2400,
  };
}

export function aiAnswer(output: unknown, citationsPath?: string) {
  const data = output as {
    choices?: Array<{ message?: { content?: unknown; annotations?: unknown[] } }>;
  } | null;
  const message = data?.choices?.[0]?.message;
  const text = typeof message?.content === "string" ? message.content.slice(0, 18000) : "";
  const sources = new Map<string, { title: string; url: string }>();
  let extraCitations: unknown = output;
  for (const key of (citationsPath || "").split(".")) {
    extraCitations = key && extraCitations && typeof extraCitations === "object" &&
      Object.hasOwn(extraCitations, key) ? (extraCitations as Record<string, unknown>)[key] : undefined;
  }
  const citations = [
    ...(Array.isArray(extraCitations) ? extraCitations : []),
    ...(Array.isArray(message?.annotations) ? message.annotations : []),
  ];
  for (const item of citations) {
    if (!item || typeof item !== "object") continue;
    const entry = item as { url?: unknown; title?: unknown; url_citation?: { url?: unknown; title?: unknown } };
    const citation = entry.url_citation || entry;
    if (typeof citation.url !== "string") continue;
    try {
      const url = new URL(citation.url);
      if (url.protocol !== "https:" && url.protocol !== "http:") continue;
      sources.set(url.href, { url: url.href, title: String(citation.title || url.href).slice(0, 500) });
    } catch { /* Ignore malformed provider citations. */ }
    if (sources.size >= 30) break;
  }
  return { text, sources: [...sources.values()] };
}

export function aiError(status: number) {
  if (status === 402 || status === 429)
    return "The AI service has reached a usage limit or is temporarily busy. Please try again later. Your prompt has not been counted.";
  return "The AI connection needs attention. Please retry later. Your prompt has not been counted.";
}
