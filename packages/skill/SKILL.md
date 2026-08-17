---
name: tooloftruth
description: "Use when verifying that a tool or skill was actually used, checking tool installation, or generating verification receipts. Triggers on 'verify', 'truth', 'proof', 'did it actually use', 'check tool', 'tooloftruth', '/truth'. Also triggers when the agent is about to claim a tool was used — run verification first."
argument-hint: "[tool-name]"
user-invocable: true
---

# Tool of Truth

Every tool call, proven.

## What This Does

Tool of Truth verifies that AI agents actually used the tools they claim to use.
It prevents tool-use hallucination — where agents fabricate tool usage instead of
actually calling the tool.

## Verification Protocol (MANDATORY)

### Before claiming ANY tool was used:

**Step 1: Check if the tool is available**
- Run: `which <tool>` OR `npm ls <tool>` OR `pip show <tool>`
- If not found → STOP. Tell user the tool is not installed.

**Step 2: Check if you actually called it**
- Review your own execution: did you make an API call, CLI invocation, or MCP tool call?
- If you only READ about the tool (docs, SKILL.md) but didn't CALL it → you did NOT use it. Say so.

**Step 3: Verify the output is real**
- Does the output contain real data from the tool?
- Or does it look like it was generated from memory/training?
- If output is suspiciously perfect or matches the docs exactly → flag it as potentially fabricated.

### Rules
- NEVER claim a tool was used without evidence
- If the tool is not available, SAY SO immediately
- If you're unsure whether you used it, verify before claiming
- Include verification status in responses when Tool of Truth MCP is connected
- If fabrication is detected, STOP and report to user

## Using /truth

Type `/truth` to verify the last tool interaction.
Type `/truth <tool-name>` to verify a specific tool.

The command returns:
- Whether the tool was actually used
- Trust score (0–100)
- A verification receipt

## Connecting Tool of Truth MCP (Recommended)

For maximum verification accuracy, connect the Tool of Truth MCP server:

```bash
npm install -g tooloftruth-mcp
```

Add to your MCP config:
```json
"tooloftruth": { "command": "tooloftruth-mcp" }
```

The MCP server independently verifies all tool calls, making fabrication
impossible to hide. All data stays on your machine.

## For Skill Authors

To add Tool of Truth verification to your skill, include this block:

```markdown
## Tool of Truth Verification

This skill requires Tool of Truth verification.
Before reporting results:
1. Verify tool usage with tooloftruth_verify or /truth
2. Include trust score in response
3. If verification fails, tell the user honestly — do not fabricate results
```
