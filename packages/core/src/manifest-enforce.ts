import type { SkillManifest } from "./types.js";

export interface ManifestViolation {
  type:
    | "tool_not_required"
    | "required_tool_missing"
    | "wrong_order"
    | "arg_mismatch"
    | "cost_budget_exceeded"
    | "output_rule_violation";
  severity: "error" | "warning";
  detail: string;
}

export interface ManifestCheckResult {
  skill: string;
  version: string;
  allowed: boolean;
  violations: ManifestViolation[];
  costUsd: number;
}

export function checkManifestCall(
  manifest: SkillManifest,
  toolName: string,
  serverName: string,
  args: Record<string, unknown>,
  costUsd: number,
  result: unknown
): ManifestCheckResult {
  const violations: ManifestViolation[] = [];

  // 1. Is the called tool allowed by the manifest?
  const requirements = Object.entries(manifest.requires);
  const requiredToolNames = requirements.map(
    ([, req]) => (req as { tool?: string }).tool || ""
  );

  if (
    requiredToolNames.length > 0 &&
    !requiredToolNames.includes(toolName)
  ) {
    violations.push({
      type: "tool_not_required",
      severity: "error",
      detail: `'${toolName}' is not declared in manifest for skill '${manifest.skill}'`,
    });
  }

  // 2. Arg mismatch — expected_args declared for this tool?
  const matchingReq = requirements.find(
    ([, req]) =>
      (req as { tool?: string }).tool === toolName
  );
  if (matchingReq) {
    const req = matchingReq[1] as {
      expected_args?: Record<string, unknown>;
      expectedArgs?: Record<string, unknown>;
    };
    const expectedArgs = req.expected_args || req.expectedArgs;
    if (expectedArgs) {
      for (const [k, expected] of Object.entries(expectedArgs)) {
        const actual = args[k];
        if (actual === undefined) {
          violations.push({
            type: "arg_mismatch",
            severity: "error",
            detail: `Missing expected arg '${k}' for '${toolName}'`,
          });
        } else if (typeof expected === "string" && expected.includes("*")) {
          // Wildcard pattern like "/repos/*/stats/*"
          const pattern = expected;
          const re = new RegExp(
            "^" +
              pattern
                .split("*")
                .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
                .join(".*") +
              "$"
          );
          if (!re.test(String(actual))) {
            violations.push({
              type: "arg_mismatch",
              severity: "warning",
              detail: `Arg '${k}' = '${actual}' does not match expected pattern '${expected}'`,
            });
          }
        }
        // Plain-string expected_args mean "presence + type check", not exact
        // value equality — exact values are skill-specific and not enforceable
        // generically without false positives.
      }
    }
  }

  // 3. Cost budget exceeded
  const budget = manifest.maxCostUsd;
  if (budget !== undefined && costUsd > budget) {
    violations.push({
      type: "cost_budget_exceeded",
      severity: "error",
      detail: `Call cost $${costUsd.toFixed(4)} exceeds manifest budget $${budget.toFixed(4)}`,
    });
  }

  // 4. Output rules (best-effort keyword/substring checks)
  const outputText = JSON.stringify(result || "").toLowerCase();
  for (const rule of manifest.outputRules || []) {
    const ruleLower = rule.toLowerCase();
    // Heuristic: if the rule mentions a must-have keyword, check presence
    const keywords = ruleLower
      .match(/"[^"]+"/g)
      ?.map((k) => k.replace(/"/g, "").toLowerCase());
    if (keywords && keywords.length > 0) {
      const missing = keywords.filter((k) => !outputText.includes(k));
      if (missing.length > 0) {
        violations.push({
          type: "output_rule_violation",
          severity: "warning",
          detail: `Output missing expected content: ${missing.join(", ")}`,
        });
      }
    }
  }

  const errors = violations.filter((v) => v.severity === "error");
  const allowed = errors.length === 0;

  return {
    skill: manifest.skill,
    version: manifest.version,
    allowed,
    violations,
    costUsd,
  };
}

export function formatManifestResult(result: ManifestCheckResult): string {
  const lines = [
    `Skill: ${result.skill} v${result.version}`,
    `Verdict: ${result.allowed ? "PASS" : "BLOCKED"}`,
    `Cost: $${result.costUsd.toFixed(4)}`,
  ];
  if (result.violations.length > 0) {
    lines.push("Violations:");
    for (const v of result.violations) {
      lines.push(`  [${v.severity.toUpperCase()}] ${v.type}: ${v.detail}`);
    }
  }
  return lines.join("\n");
}
