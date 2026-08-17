# Tool of Truth — Project Plan
### Single Source of Truth — v1.0 (2026-08-17)

## Project Identity

| Field | Value |
|---|---|
| **Name** | Tool of Truth |
| **Tagline** | "Every tool call, proven." |
| **GitHub** | `adigoel07/tooloftruth` |
| **npm** | `tooloftruth`, `tooloftruth-mcp` |
| **License** | MIT |
| **Language** | TypeScript |
| **Package Manager** | pnpm (monorepo) |
| **MCP SDK** | `@modelcontextprotocol/sdk` |
| **Slash Command** | `/truth` |
| **Author** | adigoel07 (Adi Goel) |

---

## Live Status (2026-08-17)

The following are **wired and verified on this machine**, not just designed:

- **Sentinel MITM proxy**: MCP server exposes `echo__*` proxied tools from `test-servers/echo-minimal.cjs`. Verified: `echo__echo` call → trust 100, verdict VERIFIED, receipt written. Supports `npx tooloftruth-mcp <server>` to proxy a single downstream.
- **Manifest enforcement (LIVE)**: skill manifests now GATE calls. Undeclared tool → `BLOCKED_BY_MANIFEST`; arg/pattern/cost/output-rule violations recorded; verdict downgraded on errors. Verified: `echo__add` blocked (not in manifest), `echo__echo` allowed.
- **Real cost (LIVE)**: proxied calls compute cost via `calculateCost` (firecrawl $0.01/call, token-based for LLM providers). No more hardcoded `costUsd: 0`.
- **Receipts**: live in `~/.tooloftruth/receipts/*.jsonl`; index.json tracks totals (11+ calls recorded).
- **Conversation logger**: claims/actions persisted to `~/.tooloftruth/conversations/*.jsonl`.
- **Daemon**: `com.tooloftruth.daemon` loaded in launchd (PID live), KeepAlive, polls receipts → aggregates stats to `~/.tooloftruth/stats/YYYY-MM-DD.json`. Runs the **built** `monitor.js` (no experimental flags).
- **Continuous conversation monitoring (LIVE)**: the daemon tails `opencode.db` (SQLite) and logs every agent message + tool call as conversation entries and receipts (server=`opencode`). Verified: caught this session's live messages + `bash` tool call (VERIFIED). This closes the "can't see your chats" gap — real conversations ARE now monitored for truthfulness.
- **Sensitive-data detection (LIVE)**: 4-layer detector — secrets (24 gitleaks-style regex rules + entropy), structured PII (email/phone/SSN/credit-card w/ Luhn/IP/IBAN), prompt-injection/jailbreak, dangerous commands. Daemon scans every new message + tool call as it lands; alerts written to `~/.tooloftruth/alerts/` with redacted match, source, and context proof. gitleaks 8.30.1 integrated for deep repo scans.
- **Behavior ledger (LIVE)**: per-session tracking (model, message/tool counts, error rate, tokens, cost) → `~/.tooloftruth/ledger/`. Verified tracking a live `deepseek-v4-flash` session.
- **MCP tools**: `tooloftruth_alerts` (list + filter sensitive-data alerts), `tooloftruth_gitleaks` (deep repo scan), `tooloftruth_ledger` (per-session behavior).
- **Truth Scan**: Bing-html search via curl (DDG blocks curl) → decode Bing redirects → crawl4ai `crwl` fetch → evidence extraction → verdict.
- **Tests**: 72/72 passing (vitest), core features verified. Fabrication detector fixed to not flag sub-ms local stdio tools (verified: proxied echo → VERIFIED/100, not SUSPICIOUS).
- **Release-readiness**: all 3 packages (`@tooloftruth/core`, `tooloftruth-mcp`, `tooloftruth`) pack cleanly, consumer-install from tarball verified (95 pkgs, 0 vulns). MCP server spawns + CLI `status` works from a clean `npm install`. Core bundled into mcp (`noExternal`) so no runtime `workspace:` dep leak.

### To activate sentinel on this machine
1. `~/.tooloftruth/proxy.json` lists downstream servers (currently `echo` for smoke tests).
2. Point your agent's MCP config to `tooloftruth-mcp` as the proxy.
3. All proxied tool calls are intercepted, verified, and receipted.

### Release checklist
- [x] Packages build + tests pass (72/72)
- [x] Tarballs pack clean (`npm pack` dry-run)
- [x] Consumer install from tarball verified (`npm i ./tooloftruth-*.tgz`)
- [x] CLI `status` works from clean install
- [x] MCP server spawns from clean install
- [x] Daemon runs built `monitor.js`
- [ ] `npm login` + publish `@tooloftruth/core` → `tooloftruth-mcp` → `tooloftruth`

---

## Brand System

### Color Palette

| Name | Hex | Role |
|---|---|---|
| Ink Black | `#0A0A0A` | Primary, emblem bg, text |
| Bone White | `#F6F4EF` | Paper, light surfaces |
| Proof Emerald | `#10B981` | VERIFIED status |
| Caught Crimson | `#EF4444` | FABRICATION_DETECTED status |
| Witness Gold | `#C9A227` | Pro tier accents |

### Typography

| Role | Typeface |
|---|---|
| Wordmark | Custom-drawn (not stock) |
| Display | Monument Extended or Archivo Black |
| Body | Inter |
| Code / receipts | IBM Plex Mono |

### Voice

- "Agent said X. Tool of Truth saw Y."
- Status labels only: VERIFIED / FABRICATION_DETECTED / UNVERIFIABLE
- No hype. Trust tools must sound trustworthy.

### Emblem

"The Needle" — a polygraph needle deflected 45° inside a circle.
Dark variant: black circle, white needle (light backgrounds).
Light variant: white circle, black needle (dark backgrounds).
Two alternates available: Gavel, Verify Stamp.

---

## Problem Statement

AI agents (Claude, ChatGPT, Gemini, OpenCode) sometimes fabricate tool usage.
They read a skill's documentation, mimic the expected output from training data,
and present fabricated results as if the tool was called — without ever calling it.
No verification boundary exists between "agent claims tool was used" and
"tool was actually used." Tool of Truth creates that boundary.

---

## Solution Architecture

### Two Components

**1. Sentinel MCP Proxy (primary)**
An always-on MITM (man-in-the-middle) proxy that sits between the agent and
all MCP servers. Every tool call flows through Tool of Truth automatically.
Zero changes to agent behavior — the user changes one line of MCP config:

```json
"firecrawl": { "command": "npx tooloftruth-mcp firecrawl" }
```

All traffic is transparently proxied. Every call is intercepted, measured,
verified, and recorded.

**2. SKILL.md (fallback)**
A skill the agent loads. Contains self-verification protocol and the `/truth`
command. Works when MCP server isn't connected. Agent is trusted to follow rules.

### How They Work Together

```
IF Tool of Truth MCP is connected:
  → Sentinel intercepts ALL tool calls automatically
  → Agent calls tooloftruth_verify for any tool on-demand
  → Verdict is returned with receipt

IF Tool of Truth MCP is NOT connected:
  → SKILL.md protocol kicks in
  → Agent runs self-check before claiming tool use
  → Falls back to agent honesty (limited but better than nothing)
  → SKILL.md says: "For maximum truth, connect Tool of Truth MCP"
```

---

## 7 Core Features

| # | Feature | Status | Description |
|---|---|---|---|
| 1 | Fabrication Detection | ✅ | 7-signal deep analysis: trace, doc-similarity, timing, placeholders, contradictions |
| 2 | Outcome Verification | ✅ | Entity extraction, error detection, doc-similarity, generic text detection |
| 3 | Skill Adherence | ✅ | Manifest parsing + verification |
| 4 | User Satisfaction | ✅ | Pattern matching + SatisfactionTracker |
| 5 | Tool Transparency | ✅ | Shows what downstream tools do via schema display |
| 6 | Truth Scan | ✅ | Fact-checking with scientific frameworks, claim extraction, evidence assessment |
| 7 | Continuous Honesty | ✅ | Conversation logging, claim audit, cross-reference against tool calls |

### Additional Features

| Feature | Status | Description |
|---|---|---|
| MITM Proxy | 🟢 LIVE | Proxies `echo` test server; receipted end-to-end (echo__echo → VERIFIED) |
| Auto-Discovery | ✅ | Scans agent configs, auto-generates proxy.json |
| Tool Reliability | ✅ | Success rate, fabrication rate, A-F grading |
| CLI Wrapper | ✅ | `tooloftruth-run` monitors non-MCP tools |
| Daemon | 🟢 LIVE | launchd `com.tooloftruth.daemon`, KeepAlive, stats aggregation → `~/.tooloftruth/stats/` |
| SKILL.md | ✅ | Agent fallback verification |
| `/truth` Command | ✅ | Invokable via "/" in chat |
| JSONL Receipts | 🟢 LIVE | Receipts persisted; verified end-to-end |

---

## Product Tiers

### Open Source (MIT — all features, self-hosted)

All 7 features fully free. User installs locally, runs MCP server themselves.
- Sentinel MCP proxy (MCP tool call interception)
- Fabrication detection
- Cost tracking + token counting
- Outcome verification + skill adherence
- User satisfaction inference
- Tool transparency
- Trust scores, receipts, historical search
- SKILL.md agent self-verification
- `/truth` slash command
- All local. No cloud. No license key.

### Hosted MCP ($19–49/mo — zero-setup, your server)

Same product, hosted endpoint. User points agent at `mcp.tooloftruth.dev`.
- Zero installation required
- Automatic updates
- All data stays local on user's machine (hosted endpoint is stateless)
- Revenue: subscription. Infra: one VPS ($5–20/mo).
- No databases. No user data custody. No GDPR. Asset-light.

### When to add hosted tier

After v1 ships and gets traction. Build it when users say "I wish I didn't have to install this."

---

## Skill Manifest System

Skills attach a JSON manifest declaring what tools they call and what to verify:

```jsonc
{
  "skill": "last-30-days",
  "version": "2.1.0",
  "requires": {
    "github_mcp": {
      "tool": "get_repo_stats",
      "must_be_called": true,
      "expected_args": { "endpoint": "/repos/*/stats/*" },
      "max_cost": 0.0
    }
  },
  "order": ["github_mcp"],
  "output_rules": [
    "Report must contain dates within the last 30 days",
    "Report must cite sources returned by the tool"
  ]
}
```

Tool of Truth reads this and verifies: correct tools called? right order?
right args? output follows rules? cost within budget?

---

## File Structure

```
tooloftruth/
├── README.md
├── PLAN.md                              ← THIS FILE
├── ASSETS.md                            ← Brand generation guide
├── LICENSE                              ← MIT
├── package.json                         ← pnpm workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .gitignore
├── .tooloftruth/                        ← Dogfooding config
│   ├── config.json
│   └── receipts/
├── assets/
│   └── brand/
│       ├── emblem-dark.png
│       ├── emblem-light.png
│       ├── logotype-horizontal.png
│       ├── logotype-stacked.png
│       ├── og-preview.png
│       ├── favicon-16.png
│       ├── favicon-32.png
│       └── favicon-192.png
├── packages/
│   ├── core/                            ← @tooloftruth/core
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── types.ts                 ← All interfaces
│   │       ├── verifier.ts              ← Verification engine
│   │       ├── fabrication.ts           ← Fabrication detection
│   │       ├── trust.ts                 ← Trust scoring
│   │       ├── receipt.ts               ← Receipt generation
│   │       ├── cost.ts                  ← Cost tracking (pro)
│   │       ├── outcome.ts               ← Outcome verification (pro)
│   │       ├── satisfaction.ts          ← User satisfaction (pro)
│   │       ├── manifests.ts             ← Skill manifest parser
│   │       └── transparency.ts          ← Tool schema transparency
│   ├── mcp/                             ← tooloftruth-mcp
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts                 ← MCP server entry
│   │       ├── sentinel.ts              ← The MITM proxy core
│   │       ├── tools/
│   │       │   ├── verify.ts            ← tooloftruth_verify
│   │       │   ├── check.ts             ← tooloftruth_check
│   │       │   ├── receipt.ts           ← tooloftruth_receipt
│   │       │   ├── cost.ts              ← tooloftruth_cost (pro)
│   │       │   ├── history.ts           ← tooloftruth_history (pro)
│   │       │   └── truth.ts             ← tooloftruth_truth (full session)
│   │       └── lib/
│   │           ├── interceptor.ts       ← MCP call interception
│   │           ├── logger.ts            ← Receipt logger
│   │           └── license.ts           ← Pro license validation
│   └── skill/                           ← SKILL.md + /truth command
│       ├── SKILL.md
│       └── commands/
│           └── truth.md
├── manifests/                           ← Skill manifest registry
│   └── _template.json
├── docs/
│   ├── quick-start.md
│   ├── verification-checks.md
│   ├── skill-manifests.md
│   └── contributing.md
└── schemas/
    └── receipt-v1.json                  ← Receipt JSON schema
```

---

## Implementation Phases

### Phase 1: Sentinel + Core (Week 1–2)

**Goal:** Ship the MCP sentinel proxy and core verification. Dogfood it.

- `@tooloftruth/core` — types, verifier, fabrication detector, trust scorer, receipt generator
- `tooloftruth-mcp` — MCP server with sentinel proxy, intercept tool calls, verify, return receipts
- SKILL.md + `/truth` command — agent fallback verification protocol
- Manifest parser + `_template.json`
- Basic receipts (JSON)
- Free tier: fabrication detection + trust scoring + receipts
- Pro features: all implemented but unlocked via license key (no key needed during dev)

### Phase 2: Pro Features (Week 3–4)

**Goal:** Cost tracking, outcome verification, satisfaction inference, tool transparency.

- Cost tracker — per-call cost, session totals, price table
- Token counter — input/output per call
- Outcome verifier — checks result against user prompt
- Skill adherence — manifest-based workflow verification
- Satisfaction checker — reads user's next message
- Tool transparency — extracts + displays tool schema + behavior
- Usage patterns storage + historical receipts

### Phase 3: Launch (Week 5)

**Goal:** GitHub launch, community, initial adoption.

- README.md with badges, hero image, quick start
- GitHub repo setup (topics, social preview)
- Launch posts: HN, Reddit, Twitter/X, Dev.to
- MCP server directories, awesome-mcp-servers

---

## Revenue Model

| Stream | Model | Pricing | When |
|---|---|---|---|
| GitHub Sponsors | Voluntary | $5–50/mo tiers | Month 1 |
| Hosted MCP endpoint | Subscription | $19–49/mo | Month 3+ |
| Consulting / support | Hourly / retainer | Custom | When needed |

---

## Verification Engine Logic

### Interception Pipeline (MITM)

```
Agent sends tool call via MCP
  → Tool of Truth intercepts (transparent proxy)
  → Records: tool name, params, timestamp
  → Forwards to real MCP server
  → Real MCP server responds
  → Tool of Truth records: response, duration, tokens, cost
  → Runs verification checks
  → Generates receipt
  → Returns response to agent unchanged
  → Agent never knows it was intercepted
```

### Verification Checks

| Check | Weight | What It Does |
|---|---|---|
| Installation | 0.15 | Is the tool actually installed? |
| Configuration | 0.15 | Are credentials valid? Endpoint reachable? |
| Invocation | 0.30 | Was the tool ACTUALLY called? (call log) |
| Output Validity | 0.20 | Does output match expected schema/format? |
| Fabrication | 0.20 | Does it look fabricated? (doc-similarity, timing, placeholders) |

### Trust Score

```
score = Σ (check_weight × check_result) × 100
special: if fabrication confidence > 0.7, cap score at 15
```

### Fabrication Detection Signals

| Signal | Weight | Detection |
|---|---|---|
| no_execution_trace | 0.35 | Agent claims use but call log has no record |
| output_matches_docs | 0.25 | Output too similar to skill README |
| no_network_activity | 0.15 | No HTTP requests during supposed API call |
| timing_too_fast | 0.10 | Response < 100ms for a > 500ms tool |
| no_file_changes | 0.05 | Tool should create files but didn't |
| placeholder_patterns | 0.05 | Contains "example.com", generic dates |
| internal_contradiction | 0.05 | Values contradict each other or known facts |

---

## Receipt Format (receipt-v1)

```jsonc
{
  "version": "1.0.0",
  "id": "rcpt_<timestamp>_<random>",
  "timestamp": "ISO-8601",
  "tooloftruth_version": "x.y.z",
  "agent": {
    "name": "claude-code",
    "version": "string",
    "session_id": "string"
  },
  "target": {
    "name": "tool or skill name",
    "type": "cli | npm | pip | mcp | skill",
    "installed": "boolean",
    "configured": "boolean"
  },
  "calls": [
    {
      "tool": "string",
      "server": "string",
      "timestamp": "ISO-8601",
      "params": {},
      "result": {},
      "duration_ms": "number",
      "is_error": "boolean",
      "tokens": { "input": "number", "output": "number" },
      "cost_usd": "number",
      "verification": {
        "schema_valid": "boolean",
        "response_plausible": "boolean",
        "trust_score": "number",
        "verdict": "VERIFIED | SUSPICIOUS | FABRICATION"
      }
    }
  ],
  "session_summary": {
    "total_calls": "number",
    "verified": "number",
    "fabricated": "number",
    "total_cost_usd": "number",
    "total_tokens": "number",
    "avg_trust_score": "number"
  },
  "receipt_hash": "sha256:<64-char-hex>"
}
```

---

## Local Storage Design

All data lives on the user's machine. No cloud. No remote storage.

### Directory Layout

```
.tooloftruth/
├── config.json                      ← user settings
├── index.json                       ← fast lookup index (loaded into memory)
├── receipts/
│   ├── 2026-08-17.jsonl             ← today's calls (one JSON receipt per line)
│   ├── 2026-08-16.jsonl             ← yesterday
│   └── ...
└── manifests/
    └── <skill-name>.json            ← cached skill manifests
```

### JSONL Format (one receipt per line)

Each line in a daily file is a complete receipt:

```jsonc
{"id":"rcpt_20260817_a1b2c3","timestamp":"2026-08-17T10:30:00Z","tool":"firecrawl","server":"firecrawl","params":{"url":"https://example.com"},"result":{"markdown":"..."},"duration_ms":1234,"is_error":false,"tokens":{"input":4200,"output":1800},"cost_usd":0.03,"verification":{"schema_valid":true,"response_plausible":true,"trust_score":98,"verdict":"VERIFIED"},"session_id":"sess_abc123","user_prompt":"scrape example.com"}
```

Why JSONL:
- Append-only: new calls just append a line, no file rewriting
- Fast scan: grep-like search is line-by-line, no full JSON parse needed
- Memory efficient: stream one line at a time
- Repairable: one corrupt line doesn't break the rest
- Standard: every language has JSONL readers

### Index File (index.json)

Loaded into memory on MCP server startup. Enables instant queries:

```jsonc
{
  "last_updated": "2026-08-17T10:30:00Z",
  "total_calls": 342,
  "total_cost_usd": 12.47,
  "by_tool": {
    "firecrawl": {
      "total_calls": 45,
      "total_cost_usd": 4.50,
      "last_called": "2026-08-17T10:28:00Z",
      "avg_trust_score": 96,
      "fabrications_detected": 0,
      "files": ["2026-08-17.jsonl"]
    }
  },
  "by_session": {
    "sess_abc123": {
      "started": "2026-08-17T09:00:00Z",
      "calls": 12,
      "cost_usd": 0.47,
      "fabrications": 0
    }
  }
}
```

Updated after every tool call (in-memory), flushed to disk every 100 calls or 5 min.

### Query Speed

| Query | Method | Speed |
|---|---|---|
| "How many firecrawl calls today?" | Read index.json | Instant |
| "Show me last 5 receipts" | Stream last 5 lines from today's JSONL | Fast |
| "How much did I spend this week?" | Sum index.json entries for last 7 days | Fast |
| "Show me fabrications from today" | Grep today's JSONL for FABRICATION verdict | Fast |
| "Full session audit" | Grep all files for session_id | Fast |

### File Rotation

```jsonc
// .tooloftruth/config.json
{
  "retention_days": 90,
  "max_file_size_mb": 50,
  "compress_old": true
}
```

---

## Open Source + Ecosystem Strategy

### Step 1: Sentinel Ships Alone (v1.0)
Connect ToT. Zero ecosystem needed. Instant value for any user.

### Step 2: Skill Manifests (v1.1)
Ship `manifests/` with popular open-source skills pre-manifested.
Users discover: "this downloaded skill does NONE of what it claims."
Pull moment → users demand verification from authors.

### Step 3: Verified Badge (v1.2)
Authors who manifest their skill earn a "ToT Verified" badge for their README.
Badge = downloads. Adoption loop begins.

### Step 4: Track Records + Marketplace (later)
Every verified run → signed receipt. Skills accumulate honest track records:
"This skill: 214 verified runs, 0 fabrications, $0.03 avg cost."
Marketplace gates on verification. Revenue from transaction cut.

---

## Monetization (Detailed)

**Free:** Core sentinel, fabrication detection, receipts, trust scores, SKILL.md
**Pro:** Cost tracking, tokens, outcomes, skill adherence, satisfaction, history, budgets

Pro delivery: Same MCP server binary. `.tooloftruth/config.json` holds license key.
Features unlock locally. No cloud. No SaaS. Agent displays everything.

**When to add payments:** After thorough testing. GitHub Sponsors first.
Pro license keys via simple Stripe link or GitHub Sponsors tier.

---

## Success Metrics

| Metric | Month 1 | Month 3 |
|---|---|---|
| GitHub stars | 100+ | 500+ |
| npm weekly downloads | 50+ | 500+ |
| GitHub Sponsors | $50/mo | $200/mo |
| Pro subscribers | 0 (testing) | 10+ |
