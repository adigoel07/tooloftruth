export interface SatisfactionResult {
  satisfied: boolean | null; // null = unknown, true = satisfied, false = dissatisfied
  confidence: number;
  signals: string[];
}

const POSITIVE_PATTERNS = [
  /\b(thanks?|thank you|thx|ty)\b/i,
  /\b(good|great|perfect|excellent|nice|awesome|amazing|wonderful)\b/i,
  /\b(yes|yeah|yep|yup|ok|okay|sure|got it|understood)\b/i,
  /\b(that'?s (what|exactly|right|correct|what I (wanted|needed|asked)))\b/i,
  /\b(works?|worked|done|complete|finished)\b/i,
  /\b(save|bookmark|remember|keep)\b/i,
  /\b(helps?|helpful|useful|great job)\b/i,
];

const NEGATIVE_PATTERNS = [
  /\b(wrong|incorrect|inaccurate|not right|that'?s not)\b/i,
  /\b(not (what|how|the way)|doesn'?t (match|work|make sense))\b/i,
  /\b(failed|broken|error|bug|issue|problem)\b/i,
  /\b(try again|redo|restart|start over)\b/i,
  /\b(why|how come|but|however|although|actually)\b/i,
  /\b(not (good|great|helpful|useful|what I))\b/i,
  /\b(disappointing|useless|waste|terrible|awful|bad)\b/i,
  /\b(cancel|stop|never mind|forget it)\b/i,
];

const NEUTRAL_PATTERNS = [
  /\b(next|now|then|also|additionally|furthermore)\b/i,
  /\b(how|what|when|where|which|who)\b.*\?/i,
  /\b(can you|could you|would you|please)\b/i,
  /\b(and|or|but)\b/i,
];

export function inferSatisfaction(
  nextUserMessage: string | null
): SatisfactionResult {
  if (!nextUserMessage) {
    return { satisfied: null, confidence: 0, signals: ["No follow-up message"] };
  }

  const signals: string[] = [];
  let positiveCount = 0;
  let negativeCount = 0;
  let neutralCount = 0;

  for (const p of POSITIVE_PATTERNS) {
    if (p.test(nextUserMessage)) {
      positiveCount++;
      signals.push(`Positive: ${nextUserMessage.match(p)?.[0]}`);
    }
  }

  for (const p of NEGATIVE_PATTERNS) {
    if (p.test(nextUserMessage)) {
      negativeCount++;
      signals.push(`Negative: ${nextUserMessage.match(p)?.[0]}`);
    }
  }

  for (const p of NEUTRAL_PATTERNS) {
    if (p.test(nextUserMessage)) {
      neutralCount++;
    }
  }

  const total = positiveCount + negativeCount + neutralCount;

  if (total === 0) {
    return {
      satisfied: null,
      confidence: 0,
      signals: ["No recognizable satisfaction signals"],
    };
  }

  if (negativeCount > positiveCount) {
    return {
      satisfied: false,
      confidence: negativeCount / total,
      signals,
    };
  }

  if (positiveCount > negativeCount) {
    return {
      satisfied: true,
      confidence: positiveCount / total,
      signals,
    };
  }

  // Equal positive and negative — ambiguous
  return {
    satisfied: null,
    confidence: 0.3,
    signals: ["Ambiguous signals — equal positive and negative"],
  };
}

// ─── Satisfaction tracker for sessions ────────────────────────

export class SatisfactionTracker {
  private pendingResults: Map<
    string,
    { toolCallId: string; timestamp: string }
  > = new Map();
  private results: Map<string, SatisfactionResult> = new Map();

  trackToolResult(toolCallId: string): void {
    this.pendingResults.set(toolCallId, {
      toolCallId,
      timestamp: new Date().toISOString(),
    });
  }

  inferFromNextMessage(toolCallId: string, message: string): SatisfactionResult {
    const result = inferSatisfaction(message);
    this.results.set(toolCallId, result);
    this.pendingResults.delete(toolCallId);
    return result;
  }

  getResult(toolCallId: string): SatisfactionResult | undefined {
    return this.results.get(toolCallId);
  }

  getAllResults(): Map<string, SatisfactionResult> {
    return new Map(this.results);
  }
}
