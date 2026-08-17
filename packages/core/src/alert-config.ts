import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

// Alert configuration — which detection types produce alerts.
// Stored in ~/.tooloftruth/config.json under "alerts".
// Control surfaces: chat (MCP), CLI, dashboard.

export type AlertCategory =
  | "secret"
  | "pii"
  | "prompt_injection"
  | "dangerous_command"
  | "filesystem_action"
  | "install_action";

export interface AlertConfig {
  enabled: boolean; // master switch
  categories: Record<AlertCategory, boolean>;
  minSeverity: "info" | "warning" | "critical";
  notifyCritical: boolean; // native notifications for critical
  notifyWarning: boolean; // native notifications for warning
}

export interface AlertConfigFile {
  alerts?: Partial<AlertConfig> & { categories?: Partial<Record<AlertCategory, boolean>> };
}

const DEFAULT_CATEGORIES: Record<AlertCategory, boolean> = {
  secret: true,
  pii: true,
  prompt_injection: true,
  dangerous_command: true,
  filesystem_action: true,
  install_action: true,
};

export function defaultAlertConfig(): AlertConfig {
  return {
    enabled: true,
    categories: { ...DEFAULT_CATEGORIES },
    minSeverity: "info",
    notifyCritical: true,
    notifyWarning: true,
  };
}

function configPath(tooloftruthDir?: string): string {
  return join(tooloftruthDir || join(homedir(), ".tooloftruth"), "config.json");
}

export function loadAlertConfig(tooloftruthDir?: string): AlertConfig {
  const path = configPath(tooloftruthDir);
  const base = defaultAlertConfig();
  if (!existsSync(path)) return base;
  try {
    const data = JSON.parse(readFileSync(path, "utf-8")) as AlertConfigFile;
    const c = data.alerts || {};
    return {
      enabled: c.enabled ?? base.enabled,
      categories: {
        ...base.categories,
        ...(c.categories || {}),
      },
      minSeverity: c.minSeverity ?? base.minSeverity,
      notifyCritical: c.notifyCritical ?? base.notifyCritical,
      notifyWarning: c.notifyWarning ?? base.notifyWarning,
    };
  } catch {
    return base;
  }
}

export function saveAlertConfig(cfg: AlertConfig, tooloftruthDir?: string): void {
  const path = configPath(tooloftruthDir);
  let existing: AlertConfigFile = {};
  try {
    if (existsSync(path)) {
      existing = JSON.parse(readFileSync(path, "utf-8")) as AlertConfigFile;
    }
  } catch {
    existing = {};
  }
  const merged = {
    ...existing,
    alerts: {
      enabled: cfg.enabled,
      categories: cfg.categories,
      minSeverity: cfg.minSeverity,
      notifyCritical: cfg.notifyCritical,
      notifyWarning: cfg.notifyWarning,
    },
  };
  writeFileSync(path, JSON.stringify(merged, null, 2));
}

export interface SetAlertConfigInput {
  enabled?: boolean;
  category?: AlertCategory;
  categoryEnabled?: boolean;
  minSeverity?: AlertConfig["minSeverity"];
  notifyCritical?: boolean;
  notifyWarning?: boolean;
}

export function updateAlertConfig(input: SetAlertConfigInput, tooloftruthDir?: string): AlertConfig {
  const cfg = loadAlertConfig(tooloftruthDir);
  if (input.enabled !== undefined) cfg.enabled = input.enabled;
  if (input.category && input.categoryEnabled !== undefined) {
    cfg.categories[input.category] = input.categoryEnabled;
  }
  if (input.minSeverity) cfg.minSeverity = input.minSeverity;
  if (input.notifyCritical !== undefined) cfg.notifyCritical = input.notifyCritical;
  if (input.notifyWarning !== undefined) cfg.notifyWarning = input.notifyWarning;
  saveAlertConfig(cfg, tooloftruthDir);
  return cfg;
}

export function shouldAlert(
  cfg: AlertConfig,
  category: AlertCategory,
  severity: "info" | "warning" | "critical"
): boolean {
  if (!cfg.enabled) return false;
  if (!cfg.categories[category]) return false;
  const sevRank = { info: 0, warning: 1, critical: 2 } as const;
  return sevRank[severity] >= sevRank[cfg.minSeverity];
}

export function shouldNotify(
  cfg: AlertConfig,
  severity: "info" | "warning" | "critical"
): boolean {
  if (severity === "critical") return cfg.notifyCritical;
  if (severity === "warning") return cfg.notifyWarning;
  return false;
}

export function formatAlertConfig(cfg: AlertConfig): string {
  const lines = [
    "═══ Alert Configuration ═══",
    "",
    `  Master:      ${cfg.enabled ? "ON" : "OFF"}`,
    `  Min severity: ${cfg.minSeverity}`,
    `  Notifications: critical=${cfg.notifyCritical ? "ON" : "OFF"} warning=${cfg.notifyWarning ? "ON" : "OFF"}`,
    "",
    "  Categories:",
  ];
  for (const [cat, on] of Object.entries(cfg.categories)) {
    lines.push(`    ${on ? "✓" : "✗"} ${cat}`);
  }
  return lines.join("\n");
}
