export interface TruthScanResult {
  id: string;
  timestamp: string;
  input: string;
  inputType: "fact" | "claim" | "code" | "research" | "opinion" | "mixed";
  overallScore: number;
  confidence: number;
  verdict: "VERIFIED" | "MOSTLY_TRUE" | "MIXED" | "UNVERIFIABLE" | "MOSTLY_FALSE" | "FALSE";
  claims: ClaimAnalysis[];
  sources: Source[];
  suggestions: string[];
  methodology: string;
}

export interface ClaimAnalysis {
  claim: string;
  score: number;
  verdict: "supported" | "unsupported" | "contradicted" | "unverifiable";
  evidence: string[];
  sources: string[];
  reasoning: string;
}

export interface Source {
  url: string;
  title: string;
  snippet: string;
  relevance: number;
  reliability: number;
}

export interface ScanOptions {
  depth: "quick" | "standard" | "deep";
  maxSources: number;
  useCrawl4AI: boolean;
  scientificFramework: boolean;
}
