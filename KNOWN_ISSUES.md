# Known Issues

## 1. macOS system notifications don't display (BLOCKED)

**Status:** Blocked — revisit later.

**Symptom:** `terminal-notifier` and `osascript` both exit 0, but no notification
appears on screen. Clicking "Show" on the one osascript-delivered banner opened
Script Editor (not a URL).

**Root cause (investigated):**
- `terminal-notifier` (brew 2.0.0) ships **unsigned** (`codesign -dv` → "not signed").
  macOS silently drops notifications from unsigned processes.
- Ad-hoc signing the `.app` bundle (`codesign -s - .../terminal-notifier.app`)
  succeeded, but notifications still didn't display.
- launchd-agent context lacks GUI notification entitlement; `launchctl asuser`
  workaround also did not produce a banner.
- Likely remaining cause: macOS Notification Center permission for the process
  context is not granted (requires manual System Settings → Notifications grant,
  which cannot be automated).

**What we tried:**
- `osascript display notification` → banner appeared once, "Show" opened Script Editor
- `terminal-notifier` with `-open`, `-group`, `-activate` → exit 0, no banner
- Ad-hoc sign `.app` bundle → no change
- `launchctl asuser <uid> terminal-notifier ...` from launchd daemon → exit 0, no banner
- Running from detached subshell → no banner

**Current state:**
- Notification code remains in `packages/cli/src/monitor.ts` (`notifySystem`),
  but `notifyCritical`/`notifyWarning` are set to `false` in
  `~/.tooloftruth/config.json` so no notifications are attempted.
- Dashboard deep-link (`?alert=<id>`) is implemented and **works** — a manually
  opened URL highlights the exact alert. The gap is only the OS banner.

**Next steps when revisited:**
1. Try signing with a proper Developer ID / notarized binary, or a signed
   helper app (e.g. `osascript` → a signed AppleScript app, or `swift` helper).
2. Grant the daemon/helper explicit Notification Center permission
   (System Settings → Notifications).
3. Verify with `terminal-notifier -list` / `log show` before trusting exit codes.

---

## 2. Session ID reconciliation is partial

**Status:** Improving — see `packages/core/src/session-reconcile.ts`.

Receipts from the MCP (`sess_*`), daemon (`opencode_*`), and CLI (`cli_*`)
don't always share one canonical session id. The reconcile module groups them
under the opencode session id when known, but cross-source linking is best-effort.

## 3. Truth-scan search quality

Bing HTML search (curl) works but is the weak spot — it can return irrelevant
landing pages for some queries. The `u=a1` Bing redirect decoder is in source;
live MCP sessions need a restart to pick it up.
