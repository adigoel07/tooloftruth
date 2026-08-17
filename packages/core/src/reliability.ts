import type { ToolCallRecord } from "./types.js";

export interface ToolReliability {
  tool: string;
  server: string;
  totalCalls: number;
  successRate: number;
  avgDurationMs: number;
  avgCostUsd: number;
  fabricationRate: number;
  totalCostUsd: number;
  lastCall: string;
  grade: "A" | "B" | "C" | "D" | "F";
}

export function calculateReliability(
  calls: ToolCallRecord[]
): ToolReliability[] {
  const byTool = new Map<string, ToolCallRecord[]>();

  for (const call of calls) {
    const key = `${call.server}__${call.tool}`;
    if (!byTool.has(key)) byTool.set(key, []);
    byTool.get(key)!.push(call);
  }

  const results: ToolReliability[] = [];

  for (const [key, toolCalls] of byTool) {
    const [server, tool] = key.split("__");
    const total = toolCalls.length;
    const successes = toolCalls.filter(
      (c) => !c.isError && c.verification.verdict !== "FABRICATION"
    ).length;
    const fabrications = toolCalls.filter(
      (c) => c.verification.verdict === "FABRICATION"
    ).length;

    const successRate = total > 0 ? successes / total : 0;
    const fabricationRate = total > 0 ? fabrications / total : 0;
    const avgDuration =
      total > 0
        ? toolCalls.reduce((s, c) => s + c.durationMs, 0) / total
        : 0;
    const avgCost =
      total > 0
        ? toolCalls.reduce((s, c) => s + c.costUsd, 0) / total
        : 0;
    const totalCost = toolCalls.reduce((s, c) => s + c.costUsd, 0);
    const lastCall = toolCalls.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )[0].timestamp;

    const grade = calculateGrade(successRate, fabricationRate, avgDuration);

    results.push({
      tool,
      server,
      totalCalls: total,
      successRate: Math.round(successRate * 100),
      avgDurationMs: Math.round(avgDuration),
      avgCostUsd: Math.round(avgCost * 10000) / 10000,
      fabricationRate: Math.round(fabricationRate * 100),
      totalCostUsd: Math.round(totalCost * 10000) / 10000,
      lastCall,
      grade,
    });
  }

  return results.sort((a, b) => b.totalCalls - a.totalCalls);
}

function calculateGrade(
  successRate: number,
  fabricationRate: number,
  avgDuration: number
): ToolReliability["grade"] {
  // F: high fabrication rate or very low success
  if (fabricationRate > 0.3 || successRate < 0.5) return "F";

  // D: moderate issues
  if (fabricationRate > 0.1 || successRate < 0.8) return "D";

  // C: some issues
  if (fabricationRate > 0.05 || successRate < 0.9) return "C";

  // B: good but not perfect
  if (successRate < 0.98 || fabricationRate > 0) return "B";

  // A: excellent
  return "A";
}

export function formatReliability(reliabilities: ToolReliability[]): string {
  if (reliabilities.length === 0) return "No tool data yet.";

  const lines = [
    "═══ Tool Reliability Report ═══",
    "",
    "Tool                Grade  Calls  Success  Fabric  Avg Time  Total Cost",
    "─────────────────────────────────────────────────────────────────────",
  ];

  for (const r of reliabilities) {
    const name = `${r.server}/${r.tool}`.padEnd(20);
    const grade = `[${r.grade}]`.padEnd(5);
    const calls = String(r.totalCalls).padStart(5);
    const success = `${r.successRate}%`.padStart(7);
    const fabric = `${r.fabricationRate}%`.padStart(6);
    const time = `${r.avgDurationMs}ms`.padStart(9);
    const cost = `$${r.totalCostUsd.toFixed(4)}`.padStart(10);

    lines.push(`${name} ${grade} ${calls}  ${success}  ${fabric}  ${time}  ${cost}`);
  }

  return lines.join("\n");
}
