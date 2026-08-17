import type { ToolCallRecord, FabricationSignal } from "./types.js";

// ─── Similarity: word overlap ratio ───────────────────────────

function wordOverlap(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const wordsB = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }
  return intersection / Math.max(wordsA.size, wordsB.size);
}

// ─── Deep fabrication signals ─────────────────────────────────

export function detectDeepFabrication(
  record: ToolCallRecord,
  toolDescription?: string
): FabricationSignal[] {
  const signals: FabricationSignal[] = [];

  // 1. No execution trace
  // A recorded call WITH a result proves execution even if durationMs rounds
  // to 0 (sub-millisecond local stdio tools). Only flag when there is truly
  // no result and no duration — the signature of a fabricated claim.
  const hasResult = record.result !== null && record.result !== undefined;
  const noTrace = record.durationMs === 0 && !hasResult;
  signals.push({
    name: "no_execution_trace",
    weight: 0.35,
    triggered: noTrace,
    detail: noTrace
      ? "No execution trace found — agent may have fabricated"
      : `Execution trace present (${record.durationMs}ms)`,
  });

  // 2. Output matches documentation too closely
  if (toolDescription) {
    const outputText = typeof record.result === "string"
      ? record.result
      : JSON.stringify(record.result);
    const overlap = wordOverlap(outputText, toolDescription);
    signals.push({
      name: "output_matches_docs",
      weight: 0.25,
      triggered: overlap > 0.7,
      detail: `Doc similarity: ${Math.round(overlap * 100)}% — ${overlap > 0.7 ? "suspiciously high" : "normal"}`,
    });
  } else {
    signals.push({
      name: "output_matches_docs",
      weight: 0.25,
      triggered: false,
      detail: "No tool description available for comparison",
    });
  }

  // 3. No network activity (no HTTP calls during tool execution)
  // In proxy mode, we check if the downstream server made network requests.
  // Local stdio MCP tools legitimately return in <50ms — only flag when there
  // is NO result AND suspiciously fast (a real call returns *something*).
  const timingImplausible = record.durationMs > 0 && record.durationMs < 30 && !hasResult;
  signals.push({
    name: "no_network_activity",
    weight: 0.15,
    triggered: timingImplausible,
    detail: timingImplausible
      ? "No result returned in suspiciously short time"
      : "Network activity likely (result returned)",
  });

  // 4. Timing too fast for real API
  // A returned result at <30ms is NOT fabrication for local stdio tools —
  // it provably executed. Timing heuristics only apply to *claimed* remote
  // calls; a call that returned a result was executed, so it's not fabricated.
  const timingTooFast = record.durationMs > 0 && record.durationMs < 30 && !hasResult;
  signals.push({
    name: "timing_too_fast",
    weight: 0.10,
    triggered: timingTooFast,
    detail: timingTooFast
      ? `Response in ${record.durationMs}ms with no result — implausible for real call`
      : "Timing within normal range",
  });

  // 5. No file system changes (tool should create files but didn't)
  signals.push({
    name: "no_file_changes",
    weight: 0.05,
    triggered: false,
    detail: "File system check not available in proxy mode",
  });

  // 6. Placeholder patterns in output
  const outputText = typeof record.result === "string"
    ? record.result
    : JSON.stringify(record.result);
  const placeholderPatterns = [
    "example.com",
    "lorem ipsum",
    "placeholder",
    "todo",
    "dummy",
    "sample data",
    "test data",
    "foo@bar",
    "john.doe",
  ];
  const foundPlaceholders = placeholderPatterns.filter((p) =>
    outputText.toLowerCase().includes(p)
  );
  signals.push({
    name: "placeholder_patterns",
    weight: 0.05,
    triggered: foundPlaceholders.length > 0,
    detail:
      foundPlaceholders.length > 0
        ? `Contains placeholders: ${foundPlaceholders.join(", ")}`
        : "No placeholder patterns detected",
  });

  // 7. Internal contradiction check
  signals.push({
    name: "internal_contradiction",
    weight: 0.05,
    triggered: detectContradictions(outputText),
    detail: detectContradictions(outputText)
      ? "Output contains internal contradictions"
      : "No contradictions detected",
  });

  return signals;
}

function detectContradictions(text: string): boolean {
  // Simple contradiction heuristics
  const lower = text.toLowerCase();

  // Contradictory date patterns
  const futureDate = /\b(20[3-9]\d|2[1-9]\d{2})\b/.test(lower);
  const lastThirtyDays = /last\s+(30|thirty)\s+days?/i.test(lower);
  if (futureDate && lastThirtyDays) return true;

  // Contradictory yes/no
  const yesNo = /\b(yes|no|true|false)\b.*\b(yes|no|true|false)\b/i;
  const hasNegation = /\b(not|never|no|didn't|wasn't|can't|won't)\b/i.test(lower);
  if (yesNo && hasNegation) {
    // Check for explicit contradictions like "yes... no" or "true... false"
    const matches = lower.match(/\b(yes|no|true|false)\b/g);
    if (matches && matches.length >= 2) {
      const hasYes = matches.includes("yes") || matches.includes("true");
      const hasNo = matches.includes("no") || matches.includes("false");
      if (hasYes && hasNo) return true;
    }
  }

  return false;
}

// ─── Outcome verification ─────────────────────────────────────

export interface OutcomeResult {
  aligned: boolean;
  confidence: number;
  issues: string[];
}

export function verifyOutcome(
  userPrompt: string,
  toolResult: unknown,
  toolDescription?: string
): OutcomeResult {
  const issues: string[] = [];

  const resultText = typeof toolResult === "string"
    ? toolResult
    : JSON.stringify(toolResult);

  // 1. Check if result is empty or error-like
  if (!resultText || resultText.length < 10) {
    issues.push("Tool returned empty or very short result");
  }

  // 2. Check if result mentions the same entities as the prompt
  const promptEntities = extractEntities(userPrompt);
  const resultEntities = extractEntities(resultText);
  const missingEntities = promptEntities.filter(
    (e) => !resultEntities.some((r) => r.toLowerCase() === e.toLowerCase())
  );
  if (missingEntities.length > 0 && promptEntities.length > 0) {
    issues.push(`Missing entities from prompt: ${missingEntities.join(", ")}`);
  }

  // 3. Check for error indicators in result
  const errorPatterns = [
    /\berror\b/i,
    /\bfailed\b/i,
    /\bnot found\b/i,
    /\bpermission denied\b/i,
    /\btimeout\b/i,
    /\b404\b/,
    /\b500\b/,
  ];
  const foundErrors = errorPatterns.filter((p) => p.test(resultText));
  if (foundErrors.length > 0) {
    issues.push("Result contains error indicators");
  }

  // 4. Check if result is suspiciously generic
  const genericPatterns = [
    /i (can|will|should|need to) (help|assist|provide)/i,
    /here (is|are) (the|some|a) (results?|data|information)/i,
    /based on (your|the) (request|query|question)/i,
  ];
  const foundGeneric = genericPatterns.filter((p) => p.test(resultText));
  if (foundGeneric.length > 0) {
    issues.push("Result appears to be generic AI text, not tool output");
  }

  // 5. Check if tool description was provided and result matches expected type
  if (toolDescription) {
    const descOverlap = wordOverlap(resultText, toolDescription);
    if (descOverlap > 0.8) {
      issues.push("Result is too similar to tool description (may be fabricated from docs)");
    }
  }

  return {
    aligned: issues.length === 0,
    confidence: Math.max(0, 1 - issues.length * 0.2),
    issues,
  };
}

function extractEntities(text: string): string[] {
  const entities: string[] = [];
  const STOP_WORDS = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "can", "shall", "must", "need", "get",
    "got", "gets", "fetch", "find", "show", "list", "check", "verify",
    "this", "that", "these", "those", "it", "its", "my", "your", "his",
    "her", "our", "their", "what", "which", "who", "whom", "where",
    "when", "how", "why", "if", "then", "else", "for", "and", "but",
    "or", "nor", "not", "no", "so", "yet", "just", "also", "too",
    "very", "really", "quite", "rather", "somewhat", "about", "above",
    "after", "before", "between", "into", "through", "during", "with",
    "from", "to", "in", "on", "at", "by", "of", "as", "like", "than",
  ]);

  // Capitalized words (potential names/places)
  const caps = text.match(/\b[A-Z][a-z]{2,}\b/g) || [];
  entities.push(...caps.filter((w) => !STOP_WORDS.has(w.toLowerCase())));

  // URLs
  const urls = text.match(/https?:\/\/[^\s]+/g) || [];
  entities.push(...urls);

  // Numbers that look like specific values
  const nums = text.match(/\b\d+(?:\.\d+)?\b/g) || [];
  entities.push(...nums.slice(0, 5));

  return [...new Set(entities)];
}
