import { execSync } from "child_process";
import type {
  FabricationSignal,
  VerificationResult,
  TrustScore,
  ToolCallRecord,
  PreflightResult,
  SkillManifest,
} from "./types.js";

export class Verifier {
  private knownTools: Map<string, PreflightResult> = new Map();
  private manifests: Map<string, SkillManifest> = new Map();

  async checkPreflight(tool: string): Promise<PreflightResult> {
    if (this.knownTools.has(tool)) {
      return this.knownTools.get(tool)!;
    }

    const result = await this.runPreflightChecks(tool);
    this.knownTools.set(tool, result);
    return result;
  }

  private async runPreflightChecks(tool: string): Promise<PreflightResult> {
    const issues: string[] = [];
    const suggestions: string[] = [];

    const installed = this.checkInstalled(tool);
    if (!installed) {
      issues.push(`${tool} is not installed`);
      suggestions.push(`Install ${tool} and try again`);
    }

    const configured = await this.checkConfigured(tool);
    if (!configured) {
      issues.push(`${tool} credentials not found`);
      suggestions.push(`Configure ${tool} API key in environment`);
    }

    const endpoint = await this.checkEndpoint(tool);

    return {
      installed,
      configured,
      version: this.getVersion(tool),
      endpoint,
      issues,
      suggestions,
    };
  }

  private checkInstalled(tool: string): boolean {
    try {
      execSync(`which ${tool} 2>/dev/null`, { stdio: "pipe" });
      return true;
    } catch {
      return false;
    }
  }

  private async checkConfigured(_tool: string): Promise<boolean> {
    return true;
  }

  private getVersion(tool: string): string | null {
    try {
      const out = execSync(`${tool} --version 2>/dev/null`, {
        stdio: "pipe",
      }).toString();
      const match = out.match(/[\d]+\.[\d]+[\d.]*/);
      return match ? match[0] : null;
    } catch {
      return null;
    }
  }

  private async checkEndpoint(
    _tool: string
  ): Promise<{ reachable: boolean; latencyMs: number } | null> {
    return null;
  }

  async verifyToolCall(
    record: ToolCallRecord,
    manifest?: SkillManifest
  ): Promise<VerificationResult> {
    const checksPerformed: string[] = [];

    const invocationCheck = this.checkInvocation(record);
    checksPerformed.push("invocation");

    const outputCheck = this.checkOutput(record);
    checksPerformed.push("output");

    const fabricationSignals = this.detectFabrication(record);
    checksPerformed.push("fabrication");

    let skillCheck = true;
    if (manifest) {
      skillCheck = this.checkSkillAdherence(record, manifest);
      checksPerformed.push("skill_adherence");
    }

    const trustScore = this.calculateTrustScore(
      invocationCheck,
      outputCheck,
      fabricationSignals,
      skillCheck
    );

    return {
      schemaValid: outputCheck,
      responsePlausible: invocationCheck && skillCheck,
      trustScore: trustScore.overall,
      verdict: trustScore.verdict,
      fabricationConfidence: fabricationSignals
        .filter((s) => s.triggered)
        .reduce((sum, s) => sum + s.weight, 0),
      checksPerformed,
    };
  }

  private checkInvocation(record: ToolCallRecord): boolean {
    return (
      record.durationMs > 0 &&
      !record.isError &&
      record.result !== null &&
      record.result !== undefined
    );
  }

  private checkOutput(record: ToolCallRecord): boolean {
    if (!record.result) return false;
    if (typeof record.result === "string") {
      return record.result.length > 0;
    }
    return Object.keys(record.result).length > 0;
  }

  private detectFabrication(record: ToolCallRecord): FabricationSignal[] {
    const signals: FabricationSignal[] = [];

    signals.push({
      name: "no_execution_trace",
      weight: 0.35,
      triggered: record.durationMs === 0,
      detail:
        record.durationMs === 0
          ? "No execution trace found"
          : "Execution trace present",
    });

    signals.push({
      name: "output_matches_docs",
      weight: 0.25,
      triggered: false,
      detail: "Output similarity check pending",
    });

    signals.push({
      name: "no_network_activity",
      weight: 0.15,
      triggered: false,
      detail: "Network activity check pending",
    });

    signals.push({
      name: "timing_too_fast",
      weight: 0.10,
      triggered: record.durationMs < 50 && record.durationMs > 0,
      detail:
        record.durationMs < 50 && record.durationMs > 0
          ? `Response in ${record.durationMs}ms (suspiciously fast)`
          : "Timing normal",
    });

    signals.push({
      name: "no_file_changes",
      weight: 0.05,
      triggered: false,
      detail: "File system check pending",
    });

    signals.push({
      name: "placeholder_patterns",
      weight: 0.05,
      triggered: this.hasPlaceholders(record),
      detail: this.hasPlaceholders(record)
        ? "Output contains placeholder patterns"
        : "No placeholders detected",
    });

    signals.push({
      name: "internal_contradiction",
      weight: 0.05,
      triggered: false,
      detail: "Contradiction check pending",
    });

    return signals;
  }

  private hasPlaceholders(record: ToolCallRecord): boolean {
    const text = JSON.stringify(record.result).toLowerCase();
    const patterns = [
      "example.com",
      "lorem ipsum",
      "placeholder",
      "todo",
      "dummy",
      "sample data",
    ];
    return patterns.some((p) => text.includes(p));
  }

  calculateTrustScore(
    invocationValid: boolean,
    outputValid: boolean,
    fabricationSignals: FabricationSignal[],
    skillAdherent: boolean
  ): TrustScore {
    const fabricationConfidence = fabricationSignals
      .filter((s) => s.triggered)
      .reduce((sum, s) => sum + s.weight, 0);

    const breakdown = {
      installation: 15,
      configuration: 15,
      invocation: invocationValid ? 30 : 0,
      output: outputValid ? 20 : 0,
      fabrication: fabricationConfidence < 0.3 ? 20 : 0,
    };

    let overall = Object.values(breakdown).reduce((a, b) => a + b, 0);

    if (fabricationConfidence > 0.7) {
      overall = Math.min(overall, 15);
    }

    if (!skillAdherent) {
      overall = Math.max(0, overall - 10);
    }

    const verdict: TrustScore["verdict"] =
      overall >= 90
        ? "VERIFIED"
        : overall >= 70
          ? "VERIFIED"
          : overall >= 50
            ? "SUSPICIOUS"
            : overall >= 30
              ? "SUSPICIOUS"
              : "FABRICATION";

    return { overall, breakdown, verdict };
  }

  checkSkillAdherence(
    record: ToolCallRecord,
    manifest: SkillManifest
  ): boolean {
    const requirement = manifest.requires[record.server];
    if (!requirement) return true;
    if (!requirement.mustBeCalled) return true;
    if (record.isError) return false;
    return true;
  }

  loadManifest(name: string, manifest: SkillManifest): void {
    this.manifests.set(name, manifest);
  }

  getManifest(name: string): SkillManifest | undefined {
    return this.manifests.get(name);
  }
}
