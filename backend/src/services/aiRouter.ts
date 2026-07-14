/**
 * Multi-provider AI router with automatic fallback chain.
 * Groq → OpenAI → Claude → Gemini. Any provider whose API key is absent is skipped.
 * All providers return plain text; JSON fence stripping is applied automatically.
 */

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

function stripFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

async function callGroq(prompt: string, system?: string, maxTokens = 1200): Promise<string | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  try {
    const messages = system
      ? [{ role: "system", content: system }, { role: "user", content: prompt }]
      : [{ role: "user", content: prompt }];
    const res = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile", max_tokens: maxTokens, messages }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) { console.error("Groq error", res.status); return null; }
    const d = await res.json() as { choices: Array<{ message: { content: string } }> };
    return stripFences(d.choices[0]?.message?.content?.trim() ?? "");
  } catch (e) { console.error("Groq failed", e); return null; }
}

async function callOpenAI(prompt: string, system?: string, maxTokens = 1200): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const messages = system
      ? [{ role: "system", content: system }, { role: "user", content: prompt }]
      : [{ role: "user", content: prompt }];
    const res = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: "gpt-4o-mini", max_tokens: maxTokens, messages }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) { console.error("OpenAI error", res.status); return null; }
    const d = await res.json() as { choices: Array<{ message: { content: string } }> };
    return stripFences(d.choices[0]?.message?.content?.trim() ?? "");
  } catch (e) { console.error("OpenAI failed", e); return null; }
}

async function callClaude(prompt: string, system?: string, maxTokens = 1200): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const body: Record<string, unknown> = {
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    };
    if (system) body.system = system;
    const res = await fetch(ANTHROPIC_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) { console.error("Claude error", res.status); return null; }
    const d = await res.json() as { content: Array<{ text: string }> };
    return stripFences(d.content[0]?.text?.trim() ?? "");
  } catch (e) { console.error("Claude failed", e); return null; }
}

async function callGemini(prompt: string, _system?: string, maxTokens = 1200): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${key}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens },
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) { console.error("Gemini error", res.status); return null; }
    const d = await res.json() as { candidates: Array<{ content: { parts: Array<{ text: string }> } }> };
    return stripFences(d.candidates[0]?.content?.parts[0]?.text?.trim() ?? "");
  } catch (e) { console.error("Gemini failed", e); return null; }
}

/**
 * Call AI with automatic provider fallback. Returns null only if all providers fail or are unconfigured.
 */
export async function callAI(prompt: string, system?: string, maxTokens = 1200): Promise<string | null> {
  return (
    (await callGroq(prompt, system, maxTokens)) ??
    (await callOpenAI(prompt, system, maxTokens)) ??
    (await callClaude(prompt, system, maxTokens)) ??
    (await callGemini(prompt, system, maxTokens))
  );
}

// Keep the old callGroq export for backward compatibility with ai.ts
export { callGroq as callGroqDirect };
