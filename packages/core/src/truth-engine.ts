import type { TruthScanResult, ClaimAnalysis, Source, ScanOptions } from "./truth-scan.js";
import { searchWeb, crawlPage } from "./crawl4ai-client.js";
import type { SearchResult, CrawlResult } from "./crawl4ai-client.js";

// ─── Claim Extraction ────────────────────────────────────────

export function extractClaims(text: string): string[] {
  const claims: string[] = [];

  // Split by sentences
  const sentences = text
    .replace(/\n+/g, ". ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15);

  for (const sentence of sentences) {
    // Skip questions, exclamations, pure opinions
    if (sentence.endsWith("?") || sentence.endsWith("!")) continue;

    // Skip pure opinions (first person, subjective)
    if (/^(I think|I believe|I feel|in my opinion|personally)/i.test(sentence)) continue;

    // Skip instructions/commands
    if (/^(please|make sure|ensure|always|never|don't)/i.test(sentence)) continue;

    // Keep factual claims
    if (isFactualClaim(sentence)) {
      claims.push(sentence);
    }
  }

  return claims;
}

function isFactualClaim(sentence: string): boolean {
  // Patterns that suggest factual claims
  const factualPatterns = [
    /\b(is|are|was|were|has|have|had|can|will|does|do|did)\b/i,
    /\b\d+/,
    /\b(study|research|data|evidence|report|survey)\b/i,
    /\b(according to|published in|found that|showed that|indicates)\b/i,
    /\b(increase|decrease|growth|rate|percentage|billion|million)\b/i,
    /\b(proven|established|confirmed|demonstrated|established)\b/i,
  ];

  return factualPatterns.some((p) => p.test(sentence));
}

// ─── Claim Classification ────────────────────────────────────

export type ClaimType = "factual" | "statistical" | "temporal" | "causal" | "comparative" | "definitional";

export function classifyClaim(claim: string): ClaimType {
  if (/\b\d+[%$]|\b\d+\s*(billion|million|thousand|%)\b/i.test(claim)) return "statistical";
  if (/\b(before|after|during|in \d{4}|since|ago|last|next)\b/i.test(claim)) return "temporal";
  if (/\b(because|causes|leads to|results in|due to|effect of)\b/i.test(claim)) return "causal";
  if (/\b(more|less|greater|fewer|higher|lower|better|worse|than)\b/i.test(claim)) return "comparative";
  if (/\b(is defined as|means|refers to|is a|is the)\b/i.test(claim)) return "definitional";
  return "factual";
}

// ─── Evidence Assessment ─────────────────────────────────────

export interface EvidenceAssessment {
  hasEvidence: boolean;
  evidenceType: "data" | "citation" | "authority" | "anecdotal" | "none";
  strength: number; // 0-1
  notes: string[];
}

export function assessEvidence(claim: string): EvidenceAssessment {
  const notes: string[] = [];
  let hasEvidence = false;
  let evidenceType: EvidenceAssessment["evidenceType"] = "none";
  let strength = 0;

  // Check for citations
  if (/\[\d+\]|\(.*\d{4}\)|according to|cited in|published in/i.test(claim)) {
    hasEvidence = true;
    evidenceType = "citation";
    strength = 0.7;
    notes.push("Contains citation or reference");
  }

  // Check for data/statistics
  if (/\d+[%$]|\d+\s*(billion|million|thousand)/i.test(claim)) {
    hasEvidence = true;
    evidenceType = "data";
    strength = 0.8;
    notes.push("Contains quantitative data");
  }

  // Check for authority attribution
  if (/\b(study|research|university|institute|journal|WHO|FDA|NASA)\b/i.test(claim)) {
    hasEvidence = true;
    evidenceType = "authority";
    strength = 0.6;
    notes.push("References authoritative source");
  }

  // Check for hedging language (weakens claim)
  if (/\b(may|might|could|possibly|perhaps|some say|it is said)\b/i.test(claim)) {
    strength *= 0.5;
    notes.push("Contains hedging language");
  }

  // Check for absolutes (weird for factual claims)
  if (/\b(always|never|every|all|none|no one|everyone)\b/i.test(claim)) {
    strength *= 0.7;
    notes.push("Contains absolute language — harder to verify");
  }

  return { hasEvidence, evidenceType, strength, notes };
}

// ─── Credibility Scoring ─────────────────────────────────────

export function calculateCredibility(
  claim: string,
  sources: Source[],
  evidence: EvidenceAssessment
): { score: number; factors: string[] } {
  const factors: string[] = [];
  let score = 50; // Start neutral

  // Source quality
  const reliableSources = sources.filter((s) => s.reliability > 0.7);
  const unreliableSources = sources.filter((s) => s.reliability < 0.3);

  if (reliableSources.length > 0) {
    score += Math.min(20, reliableSources.length * 10);
    factors.push(`${reliableSources.length} reliable source(s)`);
  }

  if (unreliableSources.length > 0) {
    score -= Math.min(20, unreliableSources.length * 10);
    factors.push(`${unreliableSources.length} unreliable source(s)`);
  }

  // Evidence strength
  if (evidence.hasEvidence) {
    score += Math.round(evidence.strength * 20);
    factors.push(`Evidence type: ${evidence.evidenceType} (strength: ${Math.round(evidence.strength * 100)}%)`);
  } else {
    score -= 15;
    factors.push("No evidence provided");
  }

  // Source count
  if (sources.length === 0) {
    score -= 20;
    factors.push("No sources found");
  } else if (sources.length >= 3) {
    score += 10;
    factors.push(`${sources.length} sources found`);
  }

  // Claim type adjustments
  const claimType = classifyClaim(claim);
  if (claimType === "statistical") {
    // Statistical claims are harder to verify without sources
    if (sources.length === 0) score -= 10;
    factors.push("Statistical claim — requires data verification");
  }

  if (claimType === "causal") {
    // Causal claims are inherently harder to prove
    score -= 5;
    factors.push("Causal claim — correlation vs causation risk");
  }

  return { score: Math.max(0, Math.min(100, score)), factors };
}

// ─── Verdict Determination ───────────────────────────────────

export function determineVerdict(score: number): TruthScanResult["verdict"] {
  if (score >= 85) return "VERIFIED";
  if (score >= 70) return "MOSTLY_TRUE";
  if (score >= 40) return "MIXED";
  if (score >= 20) return "UNVERIFIABLE";
  if (score >= 10) return "MOSTLY_FALSE";
  return "FALSE";
}

// ─── Scientific Framework Assessment ─────────────────────────

export interface ScientificAssessment {
  hasHypothesis: boolean;
  hasMethodology: boolean;
  hasEvidence: boolean;
  hasPeerReview: boolean;
  hasReproducibility: boolean;
  score: number;
  notes: string[];
}

export function assessScientificRigor(text: string): ScientificAssessment {
  const notes: string[] = [];
  let score = 0;

  const hasHypothesis = /\b(hypothesis|prediction|expected|theory|proposed)\b/i.test(text);
  const hasMethodology = /\b(method|procedure|experiment|study design|sample|control group)\b/i.test(text);
  const hasEvidence = /\b(data|results|findings|evidence|observations|measurements)\b/i.test(text);
  const hasPeerReview = /\b(peer.reviewed|published in|journal|reviewed by)\b/i.test(text);
  const hasReproducibility = /\b(reproducib|replicated|replicated study|replication)\b/i.test(text);

  if (hasHypothesis) { score += 20; notes.push("Has clear hypothesis"); }
  if (hasMethodology) { score += 25; notes.push("Describes methodology"); }
  if (hasEvidence) { score += 25; notes.push("Presents evidence"); }
  if (hasPeerReview) { score += 15; notes.push("Peer-reviewed"); }
  if (hasReproducibility) { score += 15; notes.push("Reproducibility mentioned"); }

  return {
    hasHypothesis,
    hasMethodology,
    hasEvidence,
    hasPeerReview,
    hasReproducibility,
    score: Math.min(100, score),
    notes,
  };
}

// ─── Input Classification ────────────────────────────────────

export function classifyInput(text: string): TruthScanResult["inputType"] {
  const lower = text.toLowerCase();

  // Code detection
  if (/\b(function|const|let|var|class|import|export|return|if\s*\(|for\s*\(|while\s*\()\b/.test(text) ||
      /[{}();]/.test(text) && text.split("\n").length > 2) {
    return "code";
  }

  // Research detection
  if (/\b(study|research|paper|journal|experiment|hypothesis|methodology|findings)\b/i.test(text)) {
    return "research";
  }

  // Opinion detection
  if (/\b(I think|I believe|I feel|in my opinion|personally|subjective)\b/i.test(text)) {
    return "opinion";
  }

  // Mixed
  const hasFactual = /\b(is|are|was|were|has|have|had)\b/i.test(text);
  const hasOpinion = /\b(I think|should|must|better|worse)\b/i.test(text);
  if (hasFactual && hasOpinion) return "mixed";

  return "fact";
}

// ─── Crawl4AI Source Verification ────────────────────────────

export function verifyClaimAgainstSources(
  claim: string,
  maxSources: number = 3
): { sources: Source[]; evidenceTexts: string[] } {
  const searchResults = searchWeb(claim, maxSources);
  const sources: Source[] = [];
  const evidenceTexts: string[] = [];

  for (const result of searchResults) {
    if (!result.url) continue;

    const crawled = crawlPage(result.url, 4000);
    if (!crawled) continue;

    // Assess source reliability
    const reliability = assessSourceReliability(result.url, crawled);

    // Check if the crawled content supports or contradicts the claim
    const evidenceStrength = assessContentAgainstClaim(claim, crawled.content);

    sources.push({
      url: result.url,
      title: crawled.title || result.title,
      snippet: crawled.content.slice(0, 300),
      relevance: evidenceStrength.relevance,
      reliability,
    });

    if (evidenceStrength.evidence) {
      evidenceTexts.push(evidenceStrength.evidence);
    }
  }

  return { sources, evidenceTexts };
}

function assessSourceReliability(url: string, crawled: CrawlResult): number {
  let score = 0.5; // baseline

  const domain = url.toLowerCase();

  // High-reliability domains
  if (/\.gov|\.edu|\.org|wikipedia\.org|nature\.com|science\.org|who\.int|nih\.gov|cdc\.gov/i.test(domain)) {
    score = 0.9;
  }
  // Medium-reliability domains
  else if (/bbc\.|reuters\.|apnews\.|nytimes\.|theguardian\.|washingtonpost\.|economist\.|forbes\.|techcrunch\.|arstechnica\./i.test(domain)) {
    score = 0.7;
  }
  // Known low-reliability patterns
  else if (/wiki|fandom|reddit\.com|quora\.com|medium\.com|substack\.com|wordpress\.com|blogspot\./i.test(domain)) {
    score = 0.3;
  }
  // GitHub/code repos
  else if (/github\.com|gitlab\.com|stackoverflow\.com/i.test(domain)) {
    score = 0.6;
  }
  // Default
  else {
    score = 0.5;
  }

  // Content quality adjustments
  if (crawled.content.length < 200) score *= 0.7; // thin content
  if (crawled.content.length > 5000) score = Math.min(1, score * 1.1); // substantial content

  return Math.round(score * 100) / 100;
}

function assessContentAgainstClaim(
  claim: string,
  content: string
): { relevance: number; evidence: string | null } {
  const claimWords = claim
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);

  // Count how many claim words appear in content
  const contentLower = content.toLowerCase();
  const matches = claimWords.filter((w) => contentLower.includes(w));
  const relevance = claimWords.length > 0 ? matches.length / claimWords.length : 0;

  // Find the most relevant paragraph
  const paragraphs = content.split(/\n\n+/);
  let bestParagraph = "";
  let bestScore = 0;

  for (const para of paragraphs) {
    const paraLower = para.toLowerCase();
    const paraMatches = claimWords.filter((w) => paraLower.includes(w)).length;
    if (paraMatches > bestScore) {
      bestScore = paraMatches;
      bestParagraph = para;
    }
  }

  // Determine if evidence supports or contradicts
  const hasNegation = /\b(not|no|never|does not|doesnt|isn't|wasn't|cannot|can't|false|incorrect)\b/i.test(bestParagraph);
  const hasAffirmation = /\b(yes|confirmed|verified|true|correct|accurate|according to|study found|research shows)\b/i.test(bestParagraph);

  let evidence: string | null = null;
  if (relevance > 0.3 && bestParagraph.length > 50) {
    const snippet = bestParagraph.slice(0, 500);
    if (hasNegation && !hasAffirmation) {
      evidence = `[CONTRADICTS] ${snippet}`;
    } else if (hasAffirmation && !hasNegation) {
      evidence = `[SUPPORTS] ${snippet}`;
    } else {
      evidence = `[NEUTRAL] ${snippet}`;
    }
  }

  return { relevance: Math.min(1, relevance), evidence };
}

// ─── Credibility Scoring with Sources ────────────────────────

export function calculateCredibilityWithSources(
  claim: string,
  sources: Source[],
  evidence: EvidenceAssessment,
  evidenceTexts: string[]
): { score: number; factors: string[] } {
  const factors: string[] = [];
  let score = 50;

  // Source quality
  const reliableSources = sources.filter((s) => s.reliability > 0.7);
  const unreliableSources = sources.filter((s) => s.reliability < 0.3);

  if (reliableSources.length > 0) {
    score += Math.min(25, reliableSources.length * 12);
    factors.push(`${reliableSources.length} reliable source(s) found`);
  }

  if (unreliableSources.length > 0) {
    score -= Math.min(15, unreliableSources.length * 8);
    factors.push(`${unreliableSources.length} low-reliability source(s)`);
  }

  // Evidence from web
  const supportingEvidence = evidenceTexts.filter((e) => e.startsWith("[SUPPORTS]"));
  const contradictingEvidence = evidenceTexts.filter((e) => e.startsWith("[CONTRADICTS]"));

  if (supportingEvidence.length > 0) {
    score += Math.min(20, supportingEvidence.length * 10);
    factors.push(`${supportingEvidence.length} source(s) support the claim`);
  }

  if (contradictingEvidence.length > 0) {
    score -= Math.min(25, contradictingEvidence.length * 12);
    factors.push(`${contradictingEvidence.length} source(s) contradict the claim`);
  }

  // Relevance
  const avgRelevance = sources.length > 0
    ? sources.reduce((s, src) => s + src.relevance, 0) / sources.length
    : 0;
  if (avgRelevance > 0.5) {
    score += 10;
    factors.push("Sources are relevant to the claim");
  }

  // Evidence strength from text analysis
  if (evidence.hasEvidence) {
    score += Math.round(evidence.strength * 15);
    factors.push(`In-text evidence: ${evidence.evidenceType}`);
  }

  // Source count
  if (sources.length === 0) {
    score -= 20;
    factors.push("No sources found online");
  } else if (sources.length >= 3) {
    score += 5;
    factors.push(`${sources.length} sources cross-referenced`);
  }

  return { score: Math.max(0, Math.min(100, score)), factors };
}

// ─── Suggestion Generation ───────────────────────────────────

export function generateSuggestions(
  claims: ClaimAnalysis[],
  sources: Source[],
  scientific?: ScientificAssessment
): string[] {
  const suggestions: string[] = [];

  // Check for unsupported claims
  const unsupported = claims.filter((c) => c.verdict === "unsupported");
  if (unsupported.length > 0) {
    suggestions.push(`Found ${unsupported.length} unsupported claim(s) — add sources or citations`);
  }

  // Check for source diversity
  if (sources.length < 2 && claims.length > 0) {
    suggestions.push("Only 1 source found — cross-reference with additional sources");
  }

  // Check for source quality
  const lowQuality = sources.filter((s) => s.reliability < 0.5);
  if (lowQuality.length > 0) {
    suggestions.push(`${lowQuality.length} source(s) have low reliability — verify with authoritative sources`);
  }

  // Scientific rigor suggestions
  if (scientific) {
    if (!scientific.hasMethodology) suggestions.push("Add methodology description for scientific claims");
    if (!scientific.hasPeerReview) suggestions.push("Cite peer-reviewed sources for stronger credibility");
    if (!scientific.hasReproducibility) suggestions.push("Mention reproducibility for scientific claims");
  }

  // Statistical claims
  const statistical = claims.filter((c) => classifyClaim(c.claim) === "statistical");
  if (statistical.length > 0) {
    suggestions.push("Statistical claims detected — ensure data is from primary sources");
  }

  // Causal claims
  const causal = claims.filter((c) => classifyClaim(c.claim) === "causal");
  if (causal.length > 0) {
    suggestions.push("Causal claims detected — verify correlation vs causation");
  }

  if (suggestions.length === 0) {
    suggestions.push("Claims appear well-supported — consider adding more diverse sources");
  }

  return suggestions;
}
