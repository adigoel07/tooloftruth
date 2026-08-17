import type { CostBreakdown, ToolCallRecord, TokenUsage } from "./types.js";

const PROVIDER_PRICES: Record<string, { input: number; output: number; perCall?: number }> = {
  openai: { input: 0.0025, output: 0.010 },
  anthropic: { input: 0.003, output: 0.015 },
  gemini: { input: 0.00125, output: 0.005 },
  github: { input: 0, output: 0, perCall: 0 },
  notion: { input: 0, output: 0, perCall: 0 },
  firecrawl: { input: 0, output: 0, perCall: 0.01 },
  serp: { input: 0, output: 0, perCall: 0.005 },
  unknown: { input: 0, output: 0 },
};

export function calculateCost(
  tokens: TokenUsage,
  provider: string
): number {
  const prices = PROVIDER_PRICES[provider] || PROVIDER_PRICES.unknown;
  if (prices.perCall !== undefined) return prices.perCall;
  return (tokens.input * prices.input + tokens.output * prices.output) / 1000;
}

export function calculateEfficiency(
  costUsd: number,
  resultQuality: number
): number {
  if (costUsd === 0) return 100;
  const score = Math.round((resultQuality / Math.max(costUsd, 0.001)) * 10);
  return Math.min(100, Math.max(0, score));
}

export function buildCostBreakdown(
  calls: ToolCallRecord[]
): CostBreakdown {
  const byTool: CostBreakdown["byTool"] = {};
  let totalTokens: TokenUsage = { input: 0, output: 0 };
  let totalCost = 0;

  for (const call of calls) {
    if (!byTool[call.tool]) {
      byTool[call.tool] = {
        calls: 0,
        tokens: { input: 0, output: 0 },
        costUsd: 0,
        avgEfficiency: 0,
      };
    }

    const t = byTool[call.tool];
    t.calls++;
    t.tokens.input += call.tokens.input;
    t.tokens.output += call.tokens.output;
    t.costUsd += call.costUsd;
    totalTokens.input += call.tokens.input;
    totalTokens.output += call.tokens.output;
    totalCost += call.costUsd;
  }

  for (const tool of Object.keys(byTool)) {
    const t = byTool[tool];
    t.avgEfficiency = calculateEfficiency(
      t.costUsd,
      t.calls * 80
    );
  }

  const efficiency = calculateEfficiency(totalCost, calls.length * 80);

  const recommendations: string[] = [];
  const expensiveTool = Object.entries(byTool).sort(
    ([, a], [, b]) => b.costUsd - a.costUsd
  )[0];
  if (expensiveTool && expensiveTool[1].costUsd > totalCost * 0.5) {
    recommendations.push(
      `${expensiveTool[0]} accounts for ${Math.round((expensiveTool[1].costUsd / totalCost) * 100)}% of total cost. Consider alternatives.`
    );
  }

  return {
    totalCostUsd: totalCost,
    totalTokens,
    byTool,
    efficiency,
    recommendations,
  };
}

export function formatCostReport(breakdown: CostBreakdown): string {
  const lines = [
    "═══ Cost Report ═══",
    "",
    `Total Cost:    $${breakdown.totalCostUsd.toFixed(4)}`,
    `Total Tokens:  ${breakdown.totalTokens.input + breakdown.totalTokens.output} (${breakdown.totalTokens.input} in / ${breakdown.totalTokens.output} out)`,
    `Efficiency:    ${breakdown.efficiency}/100`,
    "",
    "By Tool:",
  ];

  for (const [tool, data] of Object.entries(breakdown.byTool)) {
    lines.push(
      `  ${tool.padEnd(16)} ${String(data.calls).padStart(3)} calls   $${data.costUsd.toFixed(4).padEnd(8)} ${data.avgEfficiency}/100 efficiency`
    );
  }

  if (breakdown.recommendations.length > 0) {
    lines.push("", "Recommendations:");
    for (const rec of breakdown.recommendations) {
      lines.push(`  ⚠ ${rec}`);
    }
  }

  return lines.join("\n");
}
