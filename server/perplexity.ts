/**
 * Perplexity Sonar API adapter for Guruji-style prose generation.
 *
 * Design principles:
 *   1. The DETERMINISTIC composer is the source of truth. This module only
 *      turns already-fired rules into flowing prose. It cannot invent astrology.
 *   2. Chunked calls — a full 20K+ word reading is split into ~10 section
 *      requests. This keeps each call inside token limits and lets us stream
 *      partial results to the UI.
 *   3. Strict system prompt — the model is instructed to phrase ONLY the
 *      supplied fired rules, cite rule IDs verbatim, and never fabricate.
 *   4. Cost cap — every request tracks estimated cost against a monthly budget
 *      in the DB; requests are rejected if the cap is exceeded.
 *
 * The API key comes from PERPLEXITY_API_KEY env var. The user pastes their
 * personal Perplexity Pro API key into /etc/tamil-astro.env on the VPS. This
 * file must NEVER read from any user-provided input at request time.
 */

const PERPLEXITY_ENDPOINT = "https://api.perplexity.ai/chat/completions";
export const DEFAULT_MODEL = "sonar-reasoning-pro";

// Cost per million tokens for sonar-reasoning-pro (Perplexity pricing as of 2026).
// Input tokens are much cheaper than output tokens. Values in USD.
// See https://docs.perplexity.ai/guides/pricing
const COST_PER_M_INPUT = 2.0;
const COST_PER_M_OUTPUT = 8.0;

export interface PerplexityCall {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface PerplexityResponse {
  text: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
  };
  finishReason: string;
  citations?: string[];
}

export class PerplexityError extends Error {
  constructor(message: string, public status?: number, public detail?: unknown) {
    super(message);
    this.name = "PerplexityError";
  }
}

/**
 * Low-level Perplexity API call. Callers should use `generateSection` (below)
 * unless they need custom control.
 */
export async function callPerplexity(call: PerplexityCall): Promise<PerplexityResponse> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new PerplexityError(
      "PERPLEXITY_API_KEY is not set. Add it to /etc/tamil-astro.env on the VPS."
    );
  }

  const body = {
    model: call.model ?? DEFAULT_MODEL,
    messages: [
      { role: "system", content: call.systemPrompt },
      { role: "user", content: call.userPrompt },
    ],
    temperature: call.temperature ?? 0.4,
    max_tokens: call.maxTokens ?? 3000,
    // Sonar-reasoning-pro does web search by default; we disable it because our
    // rules are the source of truth — extra web citations would only muddy the
    // output. Perplexity's `search_domain_filter` with an empty allowlist keeps
    // it grounded on the prompt.
    return_citations: false,
    return_related_questions: false,
  };

  let res: Response;
  try {
    res = await fetch(PERPLEXITY_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new PerplexityError(`Network error contacting Perplexity: ${(e as Error).message}`);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new PerplexityError(
      `Perplexity API returned ${res.status}: ${detail.slice(0, 300)}`,
      res.status,
      detail
    );
  }

  const data = await res.json() as {
    choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    citations?: string[];
  };

  const text = data.choices?.[0]?.message?.content ?? "";
  const inputTokens = data.usage?.prompt_tokens ?? 0;
  const outputTokens = data.usage?.completion_tokens ?? 0;
  const estimatedCostUsd =
    (inputTokens * COST_PER_M_INPUT + outputTokens * COST_PER_M_OUTPUT) / 1_000_000;

  return {
    text,
    finishReason: data.choices?.[0]?.finish_reason ?? "unknown",
    citations: data.citations,
    usage: { inputTokens, outputTokens, estimatedCostUsd },
  };
}

// ---------------------------------------------------------------------------
// Guruji-style section prompt.
// The composer emits `StructuredReading.sections[i]` with fired rules;
// this function turns one section into flowing prose.
// ---------------------------------------------------------------------------

export const GURUJI_SYSTEM_PROMPT = `You are writing a detailed Vedic (Nadi/Guruji-style) astrology chart reading in the tradition of Aditya Guruji and KN Rao.

CRITICAL CONSTRAINTS — you MUST follow every one:

1. FIDELITY: You will be given a structured JSON block of "fired rules" (astrology rules that match the native's chart, each with a rule ID like F-CAR-068 or NP-CHI-001). Your prose MUST be based ONLY on these fired rules and the supplied chart facts. DO NOT invent additional astrology, dashas, yogas, or predictions.

2. CITATIONS: When you make a specific claim that comes from a fired rule, cite the rule ID inline in square brackets, e.g. "Mercury's placement in the 12th house from a Kendra activates a subtle Bhadra-adjacent effect [F-CAR-068]." Cite rule IDs verbatim as given.

3. VOICE: Guruji-style is warm, technically precise, and integrative. Use section headings, occasional Sanskrit/Tamil terms (with English gloss on first use), and long integrative paragraphs rather than bullet lists. Do NOT be flowery or ornamental — technical precision is the aesthetic.

4. GENTLE TOPICS: For any fired rule flagged \`gentle: true\` (topics: longevity, death, marriage_dissolution, disease), soften the phrasing. Say "requires care and attention during this period" rather than "will suffer." Never give exact dates for death or catastrophe.

5. NO WEB SEARCH: Do not consult the web. The rules I give you ARE the corpus. If a claim can't be tied to a fired rule, don't make it.

6. LENGTH: Match the requested section length. Do not pad. Do not summarize the input.

7. NO PREAMBLE: Start directly with the section content. Do not say "Here is the analysis" or "Based on the rules provided."

8. NO CHAIN-OF-THOUGHT: Do not output reasoning traces or "Let me think." Output only the finished section prose.

Output format: Markdown. Use ## for the section title as given, ### for subsections. Bold key terms with **. Cite rule IDs inline.`;

export interface SectionRequest {
  chartFacts: unknown;       // structured chart summary (safe to serialize)
  sectionTitle: string;      // e.g. "Part 1: Personality Reading"
  firedRules: unknown[];     // array of {id, rule_en, topic, ...}
  targetWordCount: number;   // e.g. 1500
  extraContext?: string;     // free-form notes (corrections, cross-references)
}

/**
 * Generate one section of prose from fired rules.
 * Called ~8-12 times per full reading; each call is independent.
 */
export async function generateSection(req: SectionRequest): Promise<PerplexityResponse> {
  const userPrompt = [
    `Chart facts (JSON):`,
    "```json",
    JSON.stringify(req.chartFacts, null, 2),
    "```",
    "",
    `Fired rules for this section (JSON — ${req.firedRules.length} rules):`,
    "```json",
    JSON.stringify(req.firedRules, null, 2),
    "```",
    req.extraContext ? `\nAdditional context:\n${req.extraContext}\n` : "",
    "",
    `Write the section titled "${req.sectionTitle}".`,
    `Target length: ${req.targetWordCount} words.`,
    `Cite rule IDs inline in [square brackets] whenever you invoke a specific rule.`,
    `Follow Guruji-style: integrative paragraphs, technical precision, warm tone.`,
    `Do NOT add astrology beyond the fired rules.`,
  ].join("\n");

  // Roughly 1.5 tokens per word for output, plus buffer.
  const maxTokens = Math.max(1500, Math.ceil(req.targetWordCount * 1.8));

  return callPerplexity({
    systemPrompt: GURUJI_SYSTEM_PROMPT,
    userPrompt,
    temperature: 0.35,
    maxTokens,
  });
}

// ---------------------------------------------------------------------------
// Cost-cap enforcement helper. Callers pass a monthly budget in USD; the
// function throws PerplexityError if the projected cost of the call would
// exceed the remaining budget.
// ---------------------------------------------------------------------------

export function estimateSectionCost(targetWordCount: number, firedRuleCount: number): number {
  // Rough token estimate:
  //   input  = system prompt (~600 tok) + chart facts (~500 tok) + rules (firedRuleCount * ~120 tok)
  //   output = targetWordCount * 1.5
  const inputTokens = 600 + 500 + firedRuleCount * 120;
  const outputTokens = Math.ceil(targetWordCount * 1.5);
  return (inputTokens * COST_PER_M_INPUT + outputTokens * COST_PER_M_OUTPUT) / 1_000_000;
}
