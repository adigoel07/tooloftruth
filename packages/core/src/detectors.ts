// ─────────────────────────────────────────────────────────────
// Detectors — PII, secrets, prompt-injection, dangerous commands
//
// Layers:
//   Layer 1 — Secrets: deterministic regex catalog (gitleaks-style)
//   Layer 2 — Structured PII: email, phone, SSN, credit card (Luhn), IP
//   Layer 3 — Prompt injection / jailbreak patterns
//   Layer 4 — Dangerous commands in tool calls
//
// All detectors are pure regex/validation over text → zero network,
// microseconds per scan. "requiresReview" marks fuzzy/low-confidence hits.
// ─────────────────────────────────────────────────────────────

export type DetectionCategory =
  | "secret"
  | "pii"
  | "prompt_injection"
  | "dangerous_command";

export type DetectionSeverity = "critical" | "warning" | "info";

export interface Detection {
  id: string;
  category: DetectionCategory;
  rule: string;
  severity: DetectionSeverity;
  match: string; // the matched secret/PII (may be partially redacted in output)
  matchRedacted: string; // safe to display (e.g. "AKIA•••")
  start: number; // char offset in scanned text
  end: number;
  source: string; // "message:msg_xxx" | "tool:bash" | etc.
  confidence: number; // 0..1
  requiresReview: boolean; // fuzzy / needs human eyes
  context: string; // surrounding snippet for proof
}

export interface ScanResult {
  detections: Detection[];
  scannedAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────

function redact(match: string, keep: number = 4): string {
  if (match.length <= keep * 2) return "•".repeat(Math.min(match.length, 8));
  return match.slice(0, keep) + "•".repeat(Math.max(4, match.length - keep * 2)) + match.slice(-keep);
}

function entropy(text: string): number {
  if (!text) return 0;
  const freq: Record<string, number> = {};
  for (const c of text) freq[c] = (freq[c] || 0) + 1;
  let h = 0;
  const len = text.length;
  for (const k of Object.keys(freq)) {
    const p = freq[k] / len;
    h -= p * Math.log2(p);
  }
  return h;
}

function luhnCheck(num: string): boolean {
  const digits = num.replace(/\D/g, "");
  if (digits.length < 12 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function buildContext(text: string, start: number, end: number, pad = 40): string {
  const s = Math.max(0, start - pad);
  const e = Math.min(text.length, end + pad);
  return (s > 0 ? "…" : "") + text.slice(s, e) + (e < text.length ? "…" : "");
}

// matchAll requires the global flag. Return a global copy of the regex so
// the original (non-global) rules stay reusable across calls.
function asGlobal(re: RegExp): RegExp {
  if (re.global) return re;
  return new RegExp(re.source, re.flags + "g");
}

// ─── Layer 1: Secret rules (gitleaks-style catalog) ──────────

interface SecretRule {
  rule: string;
  regex: RegExp;
  severity: DetectionSeverity;
  confidence: number;
  entropyMin?: number; // if set, requires entropy >= this to confirm
  requiresReview?: boolean;
}

// Ordered: more specific first so AWS generic doesn't shadow AKIA
const SECRET_RULES: SecretRule[] = [
  {
    rule: "aws_access_key",
    regex: /\b(?:AKIA|ASIA|AGPA|AROA|AIDA|AIPA)[A-Z0-9]{16}\b/,
    severity: "critical",
    confidence: 0.98,
  },
  {
    rule: "aws_secret_key",
    regex: /\baws_secret_access_key\s*[:=]\s*['"]?([A-Za-z0-9/+=]{40})['"]?\b/i,
    severity: "critical",
    confidence: 0.95,
    entropyMin: 3.0,
  },
  {
    rule: "github_token",
    regex: /\bgh[pousr]_[A-Za-z0-9]{36,255}\b/,
    severity: "critical",
    confidence: 0.97,
  },
  {
    rule: "github_fine_grained",
    regex: /\bgithub_pat_[A-Za-z0-9_]{22,255}\b/,
    severity: "critical",
    confidence: 0.97,
  },
  {
    rule: "openai_key",
    regex: /\bsk-[A-Za-z0-9]{20}T3BlbkFJ[A-Za-z0-9]{20}\b|\bsk-proj-[A-Za-z0-9_-]{20,}\b/,
    severity: "critical",
    confidence: 0.95,
  },
  {
    rule: "google_api_key",
    regex: /\bAIza[0-9A-Za-z_-]{35}\b/,
    severity: "critical",
    confidence: 0.95,
  },
  {
    rule: "anthropic_key",
    regex: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/,
    severity: "critical",
    confidence: 0.95,
  },
  {
    rule: "slack_token",
    regex: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/,
    severity: "critical",
    confidence: 0.92,
  },
  {
    rule: "stripe_secret",
    regex: /\bsk_live_[0-9A-Za-z]{24,}\b/,
    severity: "critical",
    confidence: 0.97,
  },
  {
    rule: "stripe_publishable",
    regex: /\bpk_live_[0-9A-Za-z]{24,}\b/,
    severity: "warning",
    confidence: 0.9,
  },
  {
    rule: "twilio_api_key",
    regex: /\bSK[0-9a-fA-F]{32}\b/,
    severity: "critical",
    confidence: 0.85,
  },
  {
    rule: "sendgrid_api_key",
    regex: /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/,
    severity: "critical",
    confidence: 0.95,
  },
  {
    rule: "slack_webhook",
    regex: /https:\/\/hooks\.slack\.com\/services\/[A-Z0-9]{8,}\/[A-Z0-9]{8,}\/[A-Za-z0-9]{20,}/,
    severity: "critical",
    confidence: 0.92,
  },
  {
    rule: "jwt",
    regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
    severity: "warning",
    confidence: 0.85,
  },
  {
    rule: "private_key_block",
    regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
    severity: "critical",
    confidence: 0.98,
  },
  {
    rule: "ssh_private_key",
    regex: /-----BEGIN OPENSSH PRIVATE KEY-----/,
    severity: "critical",
    confidence: 0.98,
  },
  {
    rule: "db_connection_string",
    regex: /\b(?:postgres|mysql|mongodb(?:\+srv)?|redis|amqp|sqlserver):\/\/[^\s'"<>]{4,}:[^\s'"<>@]{4,}@/,
    severity: "critical",
    confidence: 0.9,
  },
  {
    rule: "aws_cloudwatch_key",
    regex: /\bAKIA[A-Z0-9]{16}\b/,
    severity: "critical",
    confidence: 0.95,
  },
  {
    rule: "docker_registry_creds",
    regex: /(?:https?:\/\/)?[a-z0-9.-]+\.docker\.config\b/i,
    severity: "info",
    confidence: 0.5,
    requiresReview: true,
  },
  {
    rule: "facebook_secret",
    regex: /\bEAACEdE0[0-9A-Za-z]{30,}\b/,
    severity: "critical",
    confidence: 0.85,
  },
  {
    rule: "twitter_bearer",
    regex: /\bAAAA?[0-9A-Za-z]{20,}(?:%[0-9A-Za-z]{2})+[0-9A-Za-z_-]{20,}\b/,
    severity: "warning",
    confidence: 0.8,
  },
  {
    rule: "github_old_token",
    regex: /\b[0-9a-f]{40}\b/,
    severity: "warning",
    confidence: 0.5,
    entropyMin: 3.5,
    requiresReview: true,
  },
  {
    rule: "generic_api_key",
    regex: /\b(?:api[_-]?key|apikey|secret[_-]?key|client[_-]?secret|access[_-]?token|auth[_-]?token|bearer[_-]?token)\s*[:=]\s*['"]?([A-Za-z0-9_\-./+=]{16,})['"]?\b/i,
    severity: "warning",
    confidence: 0.7,
    entropyMin: 2.8,
  },
  {
    rule: "password_assignment",
    regex: /\b(?:password|passwd|pwd|db_password|DB_PASSWORD)\s*[:=]\s*['"]?([^\s'"]{6,})['"]?\b/i,
    severity: "warning",
    confidence: 0.6,
    entropyMin: 2.5,
    requiresReview: true,
  },
];

// ─── Layer 2: Structured PII rules ───────────────────────────

interface Piirule {
  rule: string;
  regex: RegExp;
  severity: DetectionSeverity;
  confidence: number;
  validate?: (m: string) => boolean;
  requiresReview?: boolean;
}

const PII_RULES: Piirule[] = [
  {
    rule: "email",
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,
    severity: "warning",
    confidence: 0.9,
  },
  {
    rule: "us_phone",
    regex: /\b(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/,
    severity: "warning",
    confidence: 0.85,
  },
];

// SSN and credit card added via push to keep the array clean
PII_RULES.push({
  rule: "us_ssn",
  regex: /\b(?!000|666|9\d{2})\d{3}[- ](?!00)\d{2}[- ](?!0000)\d{4}\b/,
  severity: "critical",
  confidence: 0.9,
  validate: (m) => {
    const digits = m.replace(/\D/g, "");
    if (digits === "000000000" || digits === "123456789") return false;
    return true;
  },
});

PII_RULES.push({
  rule: "credit_card",
  regex: /\b(?:\d[ -]*?){13,19}\b/,
  severity: "critical",
  confidence: 0.8,
  validate: (m) => luhnCheck(m),
});

PII_RULES.push({
  rule: "ipv4",
  regex: /\b(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b/,
  severity: "info",
  confidence: 0.7,
  requiresReview: true, // private IPs (192.168.*, 10.*) are usually fine
});

PII_RULES.push({
  rule: "iban",
  regex: /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}[A-Z0-9]{0,18}\b/,
  severity: "warning",
  confidence: 0.85,
});

// ─── Layer 3: Prompt injection / jailbreak ───────────────────

const INJECTION_PATTERNS: Array<{
  rule: string;
  regex: RegExp;
  severity: DetectionSeverity;
  confidence: number;
}> = [
  {
    rule: "ignore_previous_instructions",
    regex: /\b(?:ignore|disregard|forget|forget all|override)\s+(?:all\s+)?(?:previous|prior|above|earlier)\s+(?:instructions?|prompts?|rules?)\b/i,
    severity: "critical",
    confidence: 0.9,
  },
  {
    rule: "system_prompt_reveal",
    regex: /\b(?:reveal|print|show|output|paste)\s+(?:your|the)\s+(?:system\s+)?(?:prompt|instructions?|system\s+message)\b/i,
    severity: "critical",
    confidence: 0.85,
  },
  {
    rule: "DAN_jailbreak",
    regex: /\b(?:DAN|do anything now|jailbreak|developer mode)\b/i,
    severity: "warning",
    confidence: 0.7,
  },
  {
    rule: "privilege_escalation",
    regex: /\b(?:you are now|act as|pretend to be|roleplay as)\s+(?:an?|the)\s+(?:unfiltered|uncensored|god|sudo|root|admin|superuser)\b/i,
    severity: "warning",
    confidence: 0.7,
  },
  {
    rule: "token_exfiltration",
    regex: /\b(?:exfiltrate|send|upload|post|copy)\s+(?:my|the)\s+(?:API[-\s]?key|token|secret|password|credentials|keys)\b/i,
    severity: "warning",
    confidence: 0.6,
  },
  {
    rule: "new_instructions_override",
    regex: /\b(?:from now on|in this conversation)\s+(?:you will|you must|always|never)\b/i,
    severity: "warning",
    confidence: 0.5,
  },
  {
    rule: "harmful_override",
    regex: /\b(?:no (?:safety|ethical|moral|legal)\s+(?:guidelines|rules|restrictions|boundaries|limitations|constraints))\b/i,
    severity: "warning",
    confidence: 0.6,
  },
  {
    rule: "xml_tag_injection",
    regex: /<system[\s>]|<\/system>|<instructions?[\s>]|<user_input[\s>]/i,
    severity: "critical",
    confidence: 0.8,
  },
];

// ─── Layer 4: Dangerous commands ─────────────────────────────

const DANGEROUS_PATTERNS: Array<{
  rule: string;
  regex: RegExp;
  severity: DetectionSeverity;
  confidence: number;
  requiresReview?: boolean;
}> = [
  {
    rule: "rm_rf_root",
    regex: /\brm\s+-rf\s+\/(?:\s|$)|rm\s+-rf\s+\.|\brm\s+-rf\s+[~/]\s/,
    severity: "critical",
    confidence: 0.95,
  },
  {
    rule: "curl_pipe_shell",
    regex: /\bcurl\s+[^|]*\|\s*(?:sudo\s+)?(?:sh|bash|zsh)\b/,
    severity: "critical",
    confidence: 0.9,
  },
  {
    rule: "sudo_root_shell",
    regex: /\bsudo\s+(?:su\s+-|bash|sh|zsh|fish)\b/,
    severity: "warning",
    confidence: 0.8,
  },
  {
    rule: "chmod_777",
    regex: /\bchmod\s+(?:-R\s+)?777\b/,
    severity: "warning",
    confidence: 0.9,
  },
  {
    rule: "dd_disk",
    regex: /\bdd\s+if=.*\s+of=\/(?:dev\/(?:sda|sdb|sdc|disk)\d?|dev\/zero|dev\/null)\b/,
    severity: "critical",
    confidence: 0.85,
  },
  {
    rule: "exfiltration_curl_upload",
    regex: /\bcurl\s+.*(?:-T|-F|--upload-file)\s+.*\b(?:https?|ftp):\/\//,
    severity: "warning",
    confidence: 0.6,
    requiresReview: true,
  },
  {
    rule: "base64_decode_to_shell",
    regex: /\b(?:echo|printf)\s+['"]?[A-Za-z0-9+/=]{20,}['"]?\s*\|\s*base64\s*-\s*d\s*\|\s*(?:sh|bash|zsh)\b/,
    severity: "critical",
    confidence: 0.85,
  },
  {
    rule: "wget_pipe_shell",
    regex: /\bwget\s+[^|]*\|\s*(?:sudo\s+)?(?:sh|bash|zsh)\b/,
    severity: "critical",
    confidence: 0.9,
  },
  {
    rule: "mkfs_format",
    regex: /\bmkfs(?:\.[a-z0-9]+)?\s+/,
    severity: "critical",
    confidence: 0.9,
  },
  {
    rule: "kill_system",
    regex: /\bkill\s+-9\s+(?:1|0|-1)\b|\bpkill\s+-9\s+(?:systemd|kernel|launchd)\b/,
    severity: "critical",
    confidence: 0.7,
  },
];

// ─── Scan engine ─────────────────────────────────────────────

let detectionCounter = 0;

function pushDetections(
  out: Detection[],
  text: string,
  rules: { rule: string; regex: RegExp; severity: DetectionSeverity; confidence: number; entropyMin?: number; validate?: (m: string) => boolean; requiresReview?: boolean }[],
  category: DetectionCategory,
  source: string,
  onEach?: (rule: string) => void
): void {
  if (!text) return;
  for (const rule of rules) {
    // Use matchAll — safe with \b-anchored regexes. Manual lastIndex advancing
    // on exec() has a known V8 bug where \b matches re-fire at the same index
    // forever (e.g. "AKIA..." matched 500+ times → OOM).
    const matchAll = text.matchAll(asGlobal(rule.regex));
    for (const m of matchAll) {
      const matched = m[0];
      const index = (m as RegExpMatchArray & { index?: number }).index ?? 0;
      // Entropy gate (avoid flagging "password = hunter2" style low-entropy)
      if (rule.entropyMin !== undefined && entropy(matched) < rule.entropyMin) {
        continue;
      }
      // Validator gate (Luhn, SSN blacklist)
      if (rule.validate && !rule.validate(matched)) {
        continue;
      }
      out.push({
        id: `det_${++detectionCounter}`,
        category,
        rule: rule.rule,
        severity: rule.severity,
        match: matched,
        matchRedacted: redact(matched),
        start: index,
        end: index + matched.length,
        source,
        confidence: rule.confidence,
        requiresReview: !!rule.requiresReview,
        context: buildContext(text, index, index + matched.length),
      });
      onEach?.(rule.rule);
    }
  }
}

export interface ScanOptions2 {
  categories?: DetectionCategory[];
  redactInOutput?: boolean;
}

export function scanForSensitiveData(
  text: string,
  source: string,
  options: ScanOptions2 = {}
): ScanResult {
  const out: Detection[] = [];
  const cats = options.categories || ["secret", "pii", "prompt_injection", "dangerous_command"];

  if (cats.includes("secret")) {
    pushDetections(out, text, SECRET_RULES, "secret", source);
  }
  if (cats.includes("pii")) {
    pushDetections(out, text, PII_RULES, "pii", source);
  }
  if (cats.includes("prompt_injection")) {
    pushDetections(out, text, INJECTION_PATTERNS, "prompt_injection", source);
  }
  if (cats.includes("dangerous_command")) {
    pushDetections(out, text, DANGEROUS_PATTERNS, "dangerous_command", source);
  }

  // De-dupe overlapping matches (keep the higher-confidence one)
  const deduped = out.sort((a, b) => a.start - b.start || b.confidence - a.confidence)
    .filter((d, i, arr) => i === 0 || d.start >= arr[i - 1].end);

  return { detections: deduped, scannedAt: new Date().toISOString() };
}

export function formatDetection(d: Detection): string {
  const flag = d.severity === "critical" ? "🔴" : d.severity === "warning" ? "🟡" : "ℹ️";
  return `${flag} [${d.category}:${d.rule}] ${d.severity.toUpperCase()} conf ${Math.round(d.confidence * 100)}%\n     match: ${d.matchRedacted}\n     source: ${d.source} @ ${d.start}\n     context: ${d.context}`;
}

export function formatScanResult(r: ScanResult): string {
  if (r.detections.length === 0) return "No sensitive data detected.";
  return r.detections.map(formatDetection).join("\n");
}
