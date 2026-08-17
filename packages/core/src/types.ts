export interface ToolCallRecord {
  id: string;
  timestamp: string;
  tool: string;
  server: string;
  sessionId: string;
  userPrompt: string;
  params: Record<string, unknown>;
  result: Record<string, unknown> | string;
  durationMs: number;
  isError: boolean;
  tokens: TokenUsage;
  costUsd: number;
  verification: VerificationResult;
}

export interface TokenUsage {
  input: number;
  output: number;
}

export interface VerificationResult {
  schemaValid: boolean;
  responsePlausible: boolean;
  trustScore: number;
  verdict: "VERIFIED" | "SUSPICIOUS" | "FABRICATION" | "UNVERIFIABLE";
  fabricationConfidence: number;
  checksPerformed: string[];
}

export interface CheckResult {
  status: "pass" | "fail" | "skip";
  detail: string;
  durationMs: number;
}

export interface PreflightResult {
  installed: boolean;
  configured: boolean;
  version: string | null;
  endpoint: { reachable: boolean; latencyMs: number } | null;
  issues: string[];
  suggestions: string[];
}

export interface TrustScore {
  overall: number;
  breakdown: {
    installation: number;
    configuration: number;
    invocation: number;
    output: number;
    fabrication: number;
  };
  verdict: "VERIFIED" | "SUSPICIOUS" | "FABRICATION" | "UNVERIFIABLE";
}

export interface Receipt {
  version: "1.0.0";
  id: string;
  timestamp: string;
  tooloftruthVersion: string;
  agent: AgentInfo;
  target: TargetInfo;
  calls: ToolCallRecord[];
  sessionSummary: SessionSummary;
  receiptHash: string;
}

export interface AgentInfo {
  name: string;
  version: string;
  sessionId: string;
}

export interface TargetInfo {
  name: string;
  type: "mcp" | "cli" | "npm" | "pip" | "skill";
  installed: boolean;
  configured: boolean;
}

export interface SessionSummary {
  totalCalls: number;
  verified: number;
  fabricated: number;
  suspicious: number;
  totalCostUsd: number;
  totalTokens: TokenUsage;
  avgTrustScore: number;
}

export interface SkillManifest {
  skill: string;
  version: string;
  requires: Record<string, ToolRequirement>;
  order?: string[];
  outputRules?: string[];
  maxCostUsd?: number;
}

export interface ToolRequirement {
  tool: string;
  mustBeCalled: boolean;
  expectedArgs?: Record<string, unknown>;
  maxCost?: number;
}

export interface FabricationSignal {
  name: string;
  weight: number;
  triggered: boolean;
  detail: string;
}

export interface CostBreakdown {
  totalCostUsd: number;
  totalTokens: TokenUsage;
  byTool: Record<
    string,
    {
      calls: number;
      tokens: TokenUsage;
      costUsd: number;
      avgEfficiency: number;
    }
  >;
  efficiency: number;
  recommendations: string[];
}

export interface IndexData {
  lastUpdated: string;
  totalCalls: number;
  totalCostUsd: number;
  byTool: Record<
    string,
    {
      totalCalls: number;
      totalCostUsd: number;
      lastCalled: string;
      avgTrustScore: number;
      fabricationsDetected: number;
      files: string[];
    }
  >;
  bySession: Record<
    string,
    {
      started: string;
      calls: number;
      costUsd: number;
      fabrications: number;
    }
  >;
}
