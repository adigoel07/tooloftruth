# Verification Checks

Every tool call that flows through the Tool of Truth sentinel is verified
across five weighted checks:

| Check | Weight | What it does |
|---|---|---|
| Installation | 0.15 | Is the tool actually installed? |
| Configuration | 0.15 | Are credentials valid? Endpoint reachable? |
| Invocation | 0.30 | Was the tool ACTUALLY called? (call log) |
| Output Validity | 0.20 | Does output match expected schema/format? |
| Fabrication | 0.20 | Does it look fabricated? |

## Trust Score

```
score = Σ (check_weight × check_result) × 100
special: if fabrication confidence > 0.7, cap score at 15
```

## Verdicts

- **VERIFIED** — evidence exists, output plausible, no fabrication signals
- **SUSPICIOUS** — some checks failed (e.g. output mismatched, low trust)
- **FABRICATION** — no execution trace or high fabrication confidence

## Fabrication Signals (deep analysis)

| Signal | Weight | Detection |
|---|---|---|
| no_execution_trace | 0.35 | Claim made but call log has no record |
| output_matches_docs | 0.25 | Output too similar to skill README |
| no_network_activity | 0.15 | No HTTP during supposed API call |
| timing_too_fast | 0.10 | Response < 100ms for a > 500ms tool |
| no_file_changes | 0.05 | Tool should create files but didn't |
| placeholder_patterns | 0.05 | Contains "example.com", generic dates |
| internal_contradiction | 0.05 | Values contradict known facts |

## Checking a tool

```bash
# Via MCP (agent has access)
tooloftruth_check  # with tool name

# Via CLI
tooloftruth status
```

## Outcome Verification

Beyond whether a tool was *called*, outcome verification checks whether the
*result* matches what the user actually asked for — entity extraction, error
detection, and doc-similarity analysis against the original prompt.
