export const VENICE_BASE_URL = "https://api.venice.ai/api/v1";
export const VENICE_MODEL = "gemma-4-uncensored";

export type ChatContent = string | Array<
  | { type: "text"; text: string }
  | { type: "file"; file: { filename: string; file_data: string } }
>;
export type ChatMessage = { role: "user" | "assistant"; content: ChatContent };

export function veniceRequest(model: string, instructions: string, messages: ChatMessage[], research: boolean) {
  return {
    model,
    messages: [{ role: "system", content: instructions }, ...messages],
    store: false,
    max_tokens: 2400,
    venice_parameters: {
      include_venice_system_prompt: false,
      enable_web_search: research ? "on" : "off",
      enable_web_citations: research,
      enable_x_search: false,
    },
  };
}

export function veniceAnswer(output: unknown) {
  const data = output as {
    choices?: Array<{ message?: { content?: unknown; annotations?: unknown[] } }>;
    venice_parameters?: { web_search_citations?: unknown[] };
  } | null;
  const message = data?.choices?.[0]?.message;
  const text = typeof message?.content === "string" ? message.content.slice(0, 18000) : "";
  const sources = new Map<string, { title: string; url: string }>();
  const citations = [
    ...(Array.isArray(data?.venice_parameters?.web_search_citations) ? data.venice_parameters.web_search_citations : []),
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

export function veniceError(status: number) {
  if (status === 402 || status === 429)
    return "The AI service has reached a usage limit or is temporarily busy. Please try again later. Your prompt has not been counted.";
  return "The AI connection needs attention. Please retry later. Your prompt has not been counted.";
}
