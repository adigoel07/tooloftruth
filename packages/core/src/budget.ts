import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

// Budget enforcement — a configurable daily spend limit. When the daemon sees
// the day's total cost cross the budget, it raises a single (deduped) alert.
// The budget lives in ~/.tooloftruth/config.json under "budget".
//
// Control surfaces: MCP tooloftruth_budget, CLI `tooloftruth budget`, dashboard
// Settings. All read/write the same config file.

export interface BudgetConfig {
  dailyLimitUsd: number; // 0 = disabled
  perCallLimitUsd?: number; // optional per-call cap
  weeklyLimitUsd?: number; // optional weekly cap
  action: "alert" | "warn"; // what to do when crossed (always logged)
  lastAlertDate?: string; // last date a crossing alert was raised
}

export function defaultBudgetConfig(): BudgetConfig {
  return { dailyLimitUsd: 0, action: "alert" };
}

function budgetPath(tooloftruthDir?: string): string {
  return join(tooloftruthDir || join(homedir(), ".tooloftruth"), "config.json");
}

export function loadBudgetConfig(tooloftruthDir?: string): BudgetConfig {
  const path = budgetPath(tooloftruthDir);
  const base = defaultBudgetConfig();
  if (!existsSync(path)) return base;
  try {
    const data = JSON.parse(readFileSync(path, "utf-8")) as { budget?: Partial<BudgetConfig> };
    const b = data.budget || {};
    return {
      dailyLimitUsd: b.dailyLimitUsd ?? base.dailyLimitUsd,
      perCallLimitUsd: b.perCallLimitUsd,
      weeklyLimitUsd: b.weeklyLimitUsd,
      action: b.action ?? base.action,
      lastAlertDate: b.lastAlertDate,
    };
  } catch {
    return base;
  }
}

export function saveBudgetConfig(cfg: BudgetConfig, tooloftruthDir?: string): void {
  const path = budgetPath(tooloftruthDir);
  let existing: Record<string, unknown> = {};
  try {
    if (existsSync(path)) existing = JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
  } catch {
    existing = {};
  }
  existing.budget = {
    dailyLimitUsd: cfg.dailyLimitUsd,
    action: cfg.action,
    ...(cfg.perCallLimitUsd !== undefined ? { perCallLimitUsd: cfg.perCallLimitUsd } : {}),
    ...(cfg.weeklyLimitUsd !== undefined ? { weeklyLimitUsd: cfg.weeklyLimitUsd } : {}),
    ...(cfg.lastAlertDate ? { lastAlertDate: cfg.lastAlertDate } : {}),
  };
  writeFileSync(path, JSON.stringify(existing, null, 2));
}

export function setBudgetLimit(usd: number, tooloftruthDir?: string): BudgetConfig {
  const cfg = loadBudgetConfig(tooloftruthDir);
  cfg.dailyLimitUsd = Math.max(0, usd);
  cfg.lastAlertDate = undefined; // reset so a new limit can trigger cleanly
  saveBudgetConfig(cfg, tooloftruthDir);
  return cfg;
}

export function setBudgetAction(action: "alert" | "warn", tooloftruthDir?: string): BudgetConfig {
  const cfg = loadBudgetConfig(tooloftruthDir);
  cfg.action = action;
  saveBudgetConfig(cfg, tooloftruthDir);
  return cfg;
}

export function setPerCallLimit(usd: number, tooloftruthDir?: string): BudgetConfig {
  const cfg = loadBudgetConfig(tooloftruthDir);
  cfg.perCallLimitUsd = usd > 0 ? usd : undefined;
  saveBudgetConfig(cfg, tooloftruthDir);
  return cfg;
}

export function setWeeklyLimit(usd: number, tooloftruthDir?: string): BudgetConfig {
  const cfg = loadBudgetConfig(tooloftruthDir);
  cfg.weeklyLimitUsd = usd > 0 ? usd : undefined;
  saveBudgetConfig(cfg, tooloftruthDir);
  return cfg;
}

export function formatBudgetConfig(cfg: BudgetConfig): string {
  const limit = cfg.dailyLimitUsd > 0 ? `$${cfg.dailyLimitUsd.toFixed(2)}` : "disabled";
  return [
    "═══ Budget Configuration ═══",
    "",
    `  Daily limit: ${limit}`,
    `  Action:      ${cfg.action} (when crossed)`,
    `  Last alert:  ${cfg.lastAlertDate || "never"}`,
  ].join("\n");
}

export interface BudgetStatus {
  enabled: boolean;
  dailyLimitUsd: number;
  spentUsd: number;
  remainingUsd: number;
  pctUsed: number;
  crossed: boolean;
  action: "alert" | "warn";
}

function readSpendForDate(date: string, tooloftruthDir?: string): number {
  const dir = join(tooloftruthDir || join(homedir(), ".tooloftruth"), "receipts");
  const file = join(dir, `${date}.jsonl`);
  if (!existsSync(file)) return 0;
  let total = 0;
  const lines = readFileSync(file, "utf-8").split("\n").filter(Boolean);
  for (const line of lines) {
    try {
      const r = JSON.parse(line);
      total += r.costUsd || 0;
    } catch { /* skip */ }
  }
  return total;
}

export function computeBudgetStatus(tooloftruthDir?: string): BudgetStatus {
  const cfg = loadBudgetConfig(tooloftruthDir);
  const date = new Date().toISOString().slice(0, 10);
  const spent = readSpendForDate(date, tooloftruthDir);
  const enabled = cfg.dailyLimitUsd > 0;
  const pct = enabled ? (spent / cfg.dailyLimitUsd) * 100 : 0;
  return {
    enabled,
    dailyLimitUsd: cfg.dailyLimitUsd,
    spentUsd: spent,
    remainingUsd: enabled ? Math.max(0, cfg.dailyLimitUsd - spent) : 0,
    pctUsed: Math.round(pct),
    crossed: enabled && spent >= cfg.dailyLimitUsd,
    action: cfg.action,
  };
}

/**
 * Checks the budget and — if a crossing is new for the day — marks the
 * crossing date in config and returns a descriptor the daemon can alert on.
 * Returns null when budget disabled, not crossed, or already alerted today.
 */
export function checkBudgetCrossing(tooloftruthDir?: string): {
  status: BudgetStatus;
  detail: string;
} | null {
  const cfg = loadBudgetConfig(tooloftruthDir);
  if (cfg.dailyLimitUsd <= 0) return null;
  const status = computeBudgetStatus(tooloftruthDir);
  if (!status.crossed) return null;
  const today = new Date().toISOString().slice(0, 10);
  if (cfg.lastAlertDate === today) return null; // already alerted today
  const updated = loadBudgetConfig(tooloftruthDir);
  updated.lastAlertDate = today;
  saveBudgetConfig(updated, tooloftruthDir);
  return {
    status,
    detail: `Budget of $${cfg.dailyLimitUsd.toFixed(2)} crossed (spent $${status.spentUsd.toFixed(2)}, ${status.pctUsed}% of limit)`,
  };
}

export function formatBudgetStatus(status: BudgetStatus): string {
  const lines = [
    "═══ Budget Status ═══",
    "",
    `  Daily limit: ${status.enabled ? `$${status.dailyLimitUsd.toFixed(2)}` : "disabled"}`,
    `  Spent today: $${status.spentUsd.toFixed(4)}`,
    `  Used:        ${status.pctUsed}%`,
    `  Remaining:   ${status.enabled ? `$${status.remainingUsd.toFixed(2)}` : "—"}`,
  ];
  if (status.crossed) {
    lines.push(`  ⚠ CROSSED — action: ${status.action}`);
  }
  return lines.join("\n");
}

export function readAllLedgerSessions(tooloftruthDir?: string): Record<string, any> {
  const dir = join(tooloftruthDir || join(homedir(), ".tooloftruth"), "ledger");
  const out: Record<string, any> = {};
  if (!existsSync(dir)) return out;
  const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort().reverse();
  for (const f of files) {
    try {
      const data = JSON.parse(readFileSync(join(dir, f), "utf-8"));
      Object.assign(out, data);
    } catch { /* skip */ }
  }
  return out;
}
