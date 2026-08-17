import type { ToolCallRecord, IndexData } from "./types.js";

export interface CostAlert {
  type: "daily_spike" | "single_call_expensive" | "budget_exceeded" | "unusual_pattern";
  severity: "info" | "warning" | "critical";
  message: string;
  tool?: string;
  current: number;
  threshold: number;
}

export interface BudgetConfig {
  dailyLimitUsd?: number;
  perCallLimitUsd?: number;
  weeklyLimitUsd?: number;
}

export function checkCostAlerts(
  calls: ToolCallRecord[],
  config: BudgetConfig,
  historicalDailyAvg?: number
): CostAlert[] {
  const alerts: CostAlert[] = [];
  const today = new Date().toISOString().slice(0, 10);

  // Today's calls
  const todayCalls = calls.filter((c) => c.timestamp.startsWith(today));
  const todayCost = todayCalls.reduce((s, c) => s + c.costUsd, 0);

  // 1. Daily spike detection
  if (historicalDailyAvg && historicalDailyAvg > 0) {
    const ratio = todayCost / historicalDailyAvg;
    if (ratio > 2) {
      alerts.push({
        type: "daily_spike",
        severity: ratio > 3 ? "critical" : "warning",
        message: `Today's cost ($${todayCost.toFixed(4)}) is ${ratio.toFixed(1)}x your daily average ($${historicalDailyAvg.toFixed(4)})`,
        current: todayCost,
        threshold: historicalDailyAvg,
      });
    }
  }

  // 2. Single call expensive
  if (config.perCallLimitUsd) {
    for (const call of todayCalls) {
      if (call.costUsd > config.perCallLimitUsd) {
        alerts.push({
          type: "single_call_expensive",
          severity: "warning",
          message: `${call.tool} call cost $${call.costUsd.toFixed(4)} (limit: $${config.perCallLimitUsd})`,
          tool: call.tool,
          current: call.costUsd,
          threshold: config.perCallLimitUsd,
        });
      }
    }
  }

  // 3. Daily budget exceeded
  if (config.dailyLimitUsd && todayCost > config.dailyLimitUsd) {
    alerts.push({
      type: "budget_exceeded",
      severity: "critical",
      message: `Daily budget exceeded: $${todayCost.toFixed(4)} / $${config.dailyLimitUsd}`,
      current: todayCost,
      threshold: config.dailyLimitUsd,
    });
  }

  // 4. Unusual pattern: same tool called many times
  const toolCounts: Record<string, number> = {};
  for (const call of todayCalls) {
    toolCounts[call.tool] = (toolCounts[call.tool] || 0) + 1;
  }
  for (const [tool, count] of Object.entries(toolCounts)) {
    if (count > 20) {
      alerts.push({
        type: "unusual_pattern",
        severity: "info",
        message: `${tool} called ${count} times today — unusually high usage`,
        tool,
        current: count,
        threshold: 20,
      });
    }
  }

  return alerts;
}

export function shouldBlockCall(
  callCost: number,
  config: BudgetConfig,
  todayCostSoFar: number
): { blocked: boolean; reason?: string } {
  if (config.perCallLimitUsd && callCost > config.perCallLimitUsd) {
    return {
      blocked: true,
      reason: `Call cost $${callCost.toFixed(4)} exceeds per-call limit $${config.perCallLimitUsd}`,
    };
  }

  if (config.dailyLimitUsd && todayCostSoFar + callCost > config.dailyLimitUsd) {
    return {
      blocked: true,
      reason: `Would exceed daily budget: $${(todayCostSoFar + callCost).toFixed(4)} > $${config.dailyLimitUsd}`,
    };
  }

  return { blocked: false };
}

export function formatAlerts(alerts: CostAlert[]): string {
  if (alerts.length === 0) return "No cost alerts.";

  const lines = ["═══ Cost Alerts ═══", ""];
  for (const alert of alerts) {
    const icon =
      alert.severity === "critical"
        ? "🔴"
        : alert.severity === "warning"
          ? "🟡"
          : "ℹ️";
    lines.push(`${icon} ${alert.message}`);
  }
  return lines.join("\n");
}
