// Auto-generated from dashboard.html — do not edit by hand.
// Run: node scripts/inline-dashboard.mjs

export const DASHBOARD_HTML: string = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tool of Truth — Ledger</title>
<style>
/* ─── Brand tokens (PLAN.md) ─────────────────────────────────── */
:root {
  --proof: #10B981;        /* Proof Emerald — VERIFIED */
  --caught: #EF4444;       /* Caught Crimson — FABRICATION */
  --witness: #C9A227;      /* Witness Gold — accent/eyebrows */
  --mono: "SFMono-Regular", "Menlo", "Monaco", "Consolas", monospace;
  --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --maxw: 1440px;
}
/* Dark (default): Ink Black surface, Bone White ink */
:root, [data-theme="dark"] {
  --ink: #0A0A0A;
  --bone: #F6F4EF;
  --bone-dim: rgba(246,244,239,0.55);
  --panel: #141414;
  --panel-2: #1c1c1c;
  --rule: rgba(246,244,239,0.08);
  --nav-bg: rgba(10,10,10,0.85);
  --card-hover: rgba(201,162,39,0.04);
  --proof-dim: rgba(16,185,129,0.15);
  --caught-dim: rgba(239,68,68,0.15);
  --witness-dim: rgba(201,162,39,0.15);
  --selection: rgba(16,185,129,0.3);
}
/* Light: Bone White surface, Ink Black ink */
[data-theme="light"] {
  --ink: #F6F4EF;
  --bone: #16150F;
  --bone-dim: rgba(10,10,10,0.55);
  --panel: #FFFDF8;
  --panel-2: #F0EDE4;
  --rule: rgba(10,10,10,0.12);
  --nav-bg: rgba(246,244,239,0.9);
  --card-hover: rgba(201,162,39,0.08);
  --proof-dim: rgba(16,185,129,0.12);
  --caught-dim: rgba(239,68,68,0.12);
  --witness-dim: rgba(201,162,39,0.16);
  --selection: rgba(16,185,129,0.25);
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme]) {
    --ink: #F6F4EF;
    --bone: #16150F;
    --bone-dim: rgba(10,10,10,0.55);
    --panel: #FFFDF8;
    --panel-2: #F0EDE4;
    --rule: rgba(10,10,10,0.12);
    --nav-bg: rgba(246,244,239,0.9);
    --card-hover: rgba(201,162,39,0.08);
    --proof-dim: rgba(16,185,129,0.12);
    --caught-dim: rgba(239,68,68,0.12);
    --witness-dim: rgba(201,162,39,0.16);
    --selection: rgba(16,185,129,0.25);
  }
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html { -webkit-font-smoothing: antialiased; }
body {
  background: var(--ink);
  color: var(--bone);
  font-family: var(--sans);
  line-height: 1.55;
  font-size: 15px;
  transition: background 0.25s ease, color 0.25s ease;
}
::selection { background: var(--selection); }
a { color: var(--bone); text-decoration: none; }

/* ─── Masthead ───────────────────────────────────────────────── */
.masthead {
  max-width: var(--maxw);
  margin: 0 auto;
  padding: 2.5rem 2rem 1.5rem;
  border-bottom: 1px solid var(--rule);
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 2rem;
  flex-wrap: wrap;
}
.wordmark { display: flex; align-items: center; gap: 1rem; }
.emblem {
  width: 44px; height: 44px; border-radius: 50%;
  border: 1.5px solid var(--bone);
  position: relative;
  flex-shrink: 0;
}
.emblem::after {
  content: "";
  position: absolute; left: 50%; top: 50%;
  width: 40%; height: 3px;
  background: var(--proof);
  transform: translate(-50%, -50%) rotate(45deg);
  transform-origin: left center;
  border-radius: 2px;
}
.wordmark h1 {
  font-size: 1.15rem; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 700;
}
.wordmark .tag { font-family: var(--mono); font-size: 0.7rem; color: var(--bone-dim); margin-top: 0.25rem; }
.live-badge {
  font-family: var(--mono); font-size: 0.72rem; color: var(--proof);
  display: flex; align-items: center; gap: 0.5rem;
}
.live-badge::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--proof); animation: pulse 2s infinite; }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }

/* ─── Nav ────────────────────────────────────────────────────── */
nav {
  max-width: var(--maxw); margin: 0 auto; padding: 0 2rem;
  display: flex; gap: 0.5rem; flex-wrap: wrap; position: sticky; top: 0; z-index: 50;
  background: var(--nav-bg); backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--rule);
}
nav button {
  background: none; border: none; color: var(--bone-dim);
  font-family: var(--mono); font-size: 0.78rem; letter-spacing: 0.05em;
  padding: 1rem 0.9rem; cursor: pointer; text-transform: uppercase;
  border-bottom: 2px solid transparent; transition: color 0.15s, border-color 0.15s;
  min-height: 44px;
}
nav button:hover { color: var(--bone); }
nav button.active { color: var(--bone); border-bottom-color: var(--witness); }

/* ─── Views ──────────────────────────────────────────────────── */
.view { display: none; }
.view.active { display: block; }
main { max-width: var(--maxw); margin: 0 auto; padding: 1.5rem 2rem 4rem; }

.eyebrow {
  font-family: var(--mono); font-size: 0.7rem; letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--witness); margin-bottom: 0.5rem;
}
.section-title { font-size: 1.4rem; font-weight: 700; letter-spacing: -0.01em; margin-bottom: 1.5rem; }
.muted { color: var(--bone-dim); font-size: 0.85rem; }

/* ─── Stat cards ─────────────────────────────────────────────── */
.stats {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1px;
  background: var(--rule); border: 1px solid var(--rule); margin-bottom: 2.5rem;
}
.stat { background: var(--panel); padding: 1.25rem 1.25rem 1rem; }
.stat .label {
  font-family: var(--mono); font-size: 0.66rem; letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--bone-dim); margin-bottom: 0.5rem;
}
.stat .value { font-family: var(--mono); font-size: 1.7rem; font-weight: 700; letter-spacing: -0.02em; }
.stat .sub { font-family: var(--mono); font-size: 0.72rem; color: var(--bone-dim); margin-top: 0.25rem; }
.stat.verified .value { color: var(--proof); }
.stat.suspicious .value { color: var(--witness); }
.stat.fabricated .value { color: var(--caught); }

/* ─── Verdict gauge ──────────────────────────────────────────── */
.gauge-wrap { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--rule); border: 1px solid var(--rule); margin-bottom: 2.5rem; }
.gauge-panel { background: var(--panel); padding: 1.5rem; }
.gauge-panel .eyebrow { margin-bottom: 1rem; }
.gauge {
  position: relative; height: 160px; margin: 0 auto; max-width: 340px;
}
.gauge svg { width: 100%; height: 100%; }
.gauge-needle { transition: transform 0.8s cubic-bezier(0.22, 1, 0.36, 1); transform-origin: 120px 120px; }
.verdict-line { font-family: var(--mono); font-size: 0.9rem; text-align: center; margin-top: 0.5rem; }
.verdict-line .v { font-size: 1.2rem; font-weight: 700; }
.v-verified { color: var(--proof); }
.v-suspicious { color: var(--witness); }
.v-fabrication { color: var(--caught); }

/* ─── Table ──────────────────────────────────────────────────── */
.tbl-wrap { overflow-x: auto; border: 1px solid var(--rule); background: var(--panel); }
table { width: 100%; border-collapse: collapse; font-size: 0.85rem; min-width: 640px; }
thead th {
  text-align: left; font-family: var(--mono); font-size: 0.66rem; letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--bone-dim); padding: 0.9rem 1rem; border-bottom: 1px solid var(--rule); font-weight: 500;
  position: sticky; top: 0; background: var(--panel-2);
}
tbody td { padding: 0.8rem 1rem; border-bottom: 1px solid var(--rule); vertical-align: top; }
tbody tr:last-child td { border-bottom: none; }
tbody tr:hover { background: var(--card-hover); }
.tag {
  font-family: var(--mono); font-size: 0.66rem; letter-spacing: 0.06em; text-transform: uppercase;
  padding: 0.2rem 0.5rem; border-radius: 2px; display: inline-block; white-space: nowrap;
}
.tag.verified { background: var(--proof-dim); color: var(--proof); }
.tag.suspicious { background: var(--witness-dim); color: var(--witness); }
.tag.fabrication, .tag.critical { background: var(--caught-dim); color: var(--caught); }
.tag.warning { background: var(--witness-dim); color: var(--witness); }
.tag.info { background: var(--rule); color: var(--bone-dim); }
.tag.secret { background: var(--caught-dim); color: var(--caught); }
.tag.pii { background: var(--proof-dim); color: var(--proof); }
.tag.prompt_injection { background: var(--witness-dim); color: var(--witness); }
.tag.dangerous_command { background: var(--caught-dim); color: var(--caught); }
.mono { font-family: var(--mono); font-size: 0.78rem; }
.mono-sm { font-family: var(--mono); font-size: 0.72rem; color: var(--bone-dim); }
.match-red { color: var(--caught); }
.match-green { color: var(--proof); }
.match-gold { color: var(--witness); }

/* ─── Buttons / copy ─────────────────────────────────────────── */
.btn {
  font-family: var(--mono); font-size: 0.72rem; letter-spacing: 0.05em;
  background: var(--panel-2); color: var(--bone); border: 1px solid var(--rule);
  padding: 0.5rem 0.9rem; border-radius: 3px; cursor: pointer; min-height: 44px;
  transition: border-color 0.15s, background 0.15s;
}
.btn:hover { border-color: var(--witness); background: var(--card-hover); }
.btn.primary { background: var(--proof); color: var(--ink); border-color: var(--proof); font-weight: 700; }
.btn.primary:hover { background: #0da271; }

/* ─── Alert block ────────────────────────────────────────────── */
.alert-card { border: 1px solid var(--rule); background: var(--panel); margin-bottom: 0.75rem; }
.alert-card.critical { border-left: 3px solid var(--caught); }
.alert-card.warning { border-left: 3px solid var(--witness); }
.alert-card.info { border-left: 3px solid var(--bone-dim); }
.alert-head { display: flex; align-items: center; gap: 0.75rem; padding: 0.9rem 1rem; cursor: pointer; flex-wrap: wrap; min-height: 44px; }
.alert-head:hover { background: var(--card-hover); }
.alert-title { font-family: var(--mono); font-size: 0.82rem; }
.alert-body { display: none; padding: 0 1rem 1rem; }
.alert-card.open .alert-body { display: block; }
.copy-block {
  background: var(--panel-2); border: 1px solid var(--rule); border-radius: 4px;
  padding: 1rem; font-family: var(--mono); font-size: 0.75rem; line-height: 1.6;
  white-space: pre-wrap; word-break: break-all; margin: 0.5rem 0 0.75rem;
  max-height: 320px; overflow: auto;
}
.alert-meta { display: flex; gap: 1rem; flex-wrap: wrap; font-family: var(--mono); font-size: 0.72rem; color: var(--bone-dim); margin-bottom: 0.5rem; }

/* ─── Ledger / sessions ──────────────────────────────────────── */
.session-row { border: 1px solid var(--rule); background: var(--panel); padding: 1rem 1.25rem; margin-bottom: 0.75rem; }
.session-row .top { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; align-items: baseline; }
.session-row h4 { font-size: 0.95rem; font-weight: 600; }
.session-row .meta { display: flex; gap: 1.25rem; flex-wrap: wrap; font-family: var(--mono); font-size: 0.75rem; color: var(--bone-dim); margin-top: 0.4rem; }
.err-rate { font-family: var(--mono); font-size: 0.75rem; }

/* ─── Conversation timeline ──────────────────────────────────── */
.msg { border-left: 2px solid var(--rule); padding: 0.6rem 0 1.2rem 1.25rem; margin-left: 0.25rem; position: relative; }
.msg::before { content: ""; position: absolute; left: -5px; top: 0.6rem; width: 8px; height: 8px; border-radius: 50%; background: var(--panel-2); border: 1.5px solid var(--bone-dim); }
.msg.user::before { background: var(--witness); border-color: var(--witness); }
.msg.assistant::before { background: var(--proof); border-color: var(--proof); }
.msg .role { font-family: var(--mono); font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.12em; color: var(--bone-dim); }
.msg.user .role { color: var(--witness); }
.msg.assistant .role { color: var(--proof); }
.msg .body { margin-top: 0.35rem; font-size: 0.9rem; max-width: 72ch; }
.msg .meta { font-family: var(--mono); font-size: 0.7rem; color: var(--bone-dim); margin-top: 0.4rem; }
.msg .tools { margin-top: 0.5rem; display: flex; flex-wrap: wrap; gap: 0.4rem; }
.tool-chip { font-family: var(--mono); font-size: 0.68rem; padding: 0.2rem 0.55rem; border: 1px solid var(--rule); border-radius: 3px; color: var(--bone-dim); }
.tool-chip.err { color: var(--caught); border-color: var(--caught-dim); }

/* ─── Filters ────────────────────────────────────────────────── */
.filterbar { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 1.25rem; align-items: center; }
.filterbar select, .filterbar input {
  background: var(--panel-2); color: var(--bone); border: 1px solid var(--rule); border-radius: 3px;
  font-family: var(--mono); font-size: 0.75rem; padding: 0.55rem 0.7rem; min-height: 44px;
}
.filterbar label { font-family: var(--mono); font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--bone-dim); }

/* ─── Empty state ────────────────────────────────────────────── */
.empty {
  border: 1px dashed var(--rule); padding: 3rem 2rem; text-align: center; color: var(--bone-dim);
  font-family: var(--mono); font-size: 0.85rem;
}
.empty .big { font-size: 2rem; margin-bottom: 0.75rem; }

/* ─── Gitleaks form ──────────────────────────────────────────── */
.gleak-form { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 1.5rem; align-items: center; }
.gleak-form input { flex: 1; min-width: 260px; }

/* ─── Toggle switches ────────────────────────────────────────── */
.toggle { position: relative; display: inline-block; width: 44px; height: 24px; vertical-align: middle; }
.toggle input { opacity: 0; width: 0; height: 0; }
.toggle .slider {
  position: absolute; cursor: pointer; inset: 0; border-radius: 24px;
  background: var(--bone-dim); transition: background 0.2s;
}
.toggle .slider::before {
  content: ""; position: absolute; height: 18px; width: 18px; left: 3px; top: 3px;
  background: var(--panel); border-radius: 50%; transition: transform 0.2s;
}
.toggle input:checked + .slider { background: var(--proof); }
.toggle input:checked + .slider::before { transform: translateX(20px); }
.toggle-row { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 1rem; }
.toggle-row .t-label { font-family: var(--mono); font-size: 0.75rem; flex: 1; }
.toggle-row .t-desc { font-family: var(--mono); font-size: 0.68rem; color: var(--bone-dim); }

/* ─── Responsive ─────────────────────────────────────────────── */
@media (max-width: 900px) {
  .gauge-wrap { grid-template-columns: 1fr; }
  main { padding: 1rem 1rem 3rem; }
  .masthead { padding: 1.5rem 1rem 1rem; }
  nav { padding: 0 1rem; }
  .stats { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 560px) {
  .stats { grid-template-columns: 1fr 1fr; }
  .stat .value { font-size: 1.3rem; }
  .masthead { align-items: flex-start; }
}
@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; }
}
</style>
</head>
<body>

<header class="masthead">
  <div class="wordmark">
    <div class="emblem" aria-hidden="true"></div>
    <div>
      <h1>Tool of Truth</h1>
      <div class="tag">every tool call, proven</div>
    </div>
  </div>
  <div style="display:flex;align-items:center;gap:1rem">
    <div class="live-badge">LIVE &nbsp;·&nbsp; local</div>
    <button class="btn" id="export-btn" title="Export today as report">⤓ Export</button>
    <button class="btn theme-toggle" id="theme-toggle" title="Toggle light/dark" style="min-height:36px">◐ Light</button>
  </div>
</header>

<nav>
  <button data-view="overview" class="active">Overview</button>
  <button data-view="alerts">Alerts</button>
  <button data-view="activity">Activity</button>
  <button data-view="ledger">Sessions</button>
  <button data-view="models">Models</button>
  <button data-view="conversations">Conversations</button>
  <button data-view="costs">Costs</button>
  <button data-view="gitleaks">Git scan</button>
  <button data-view="settings">Settings</button>
</nav>

<main>
  <!-- OVERVIEW -->
  <section class="view active" id="view-overview">
    <div class="eyebrow">Status</div>
    <h2 class="section-title">Truth ledger</h2>
    <div class="stats" id="stat-cards"></div>
    <div class="gauge-wrap">
      <div class="gauge-panel">
        <div class="eyebrow">Verdict mix</div>
        <div class="gauge">
          <svg viewBox="0 0 240 150" role="img" aria-label="Verdict distribution">
            <path d="M20 135 A 100 100 0 0 1 220 135" fill="none" stroke="var(--rule)" stroke-width="14" stroke-linecap="round"/>
            <path id="arc-verified" d="" fill="none" stroke="#10B981" stroke-width="14" stroke-linecap="round"/>
            <path id="arc-susp" d="" fill="none" stroke="#C9A227" stroke-width="14" stroke-linecap="round"/>
            <path id="arc-fab" d="" fill="none" stroke="#EF4444" stroke-width="14" stroke-linecap="round"/>
            <g id="needle-g">
              <line id="needle" x1="120" y1="135" x2="120" y2="35" stroke="#F6F4EF" stroke-width="3" class="gauge-needle"/>
              <circle cx="120" cy="135" r="6" fill="#F6F4EF"/>
            </g>
          </svg>
        </div>
        <div class="verdict-line" id="verdict-line"></div>
      </div>
      <div class="gauge-panel">
        <div class="eyebrow">Alerts</div>
        <div class="stats" id="alert-summary" style="grid-template-columns:repeat(auto-fit,minmax(120px,1fr));border:none;background:none;"></div>
        <div class="muted" style="margin-top:1rem" id="alert-note"></div>
      </div>
    </div>
    <div class="eyebrow" style="margin-top:1rem">Recent alerts</div>
    <div id="overview-alerts"></div>
  </section>

  <!-- ALERTS -->
  <section class="view" id="view-alerts">
    <div class="eyebrow">Security</div>
    <h2 class="section-title">Alerts</h2>
    <div class="filterbar">
      <label>Severity</label>
      <select id="alert-sev"><option value="">All</option><option>critical</option><option>warning</option><option>info</option></select>
      <label>Category</label>
      <select id="alert-cat"><option value="">All</option><option>secret</option><option>pii</option><option>prompt_injection</option><option>dangerous_command</option></select>
      <button class="btn" id="alert-copy-all">Copy all alerts</button>
    </div>
    <div id="alert-list"></div>
  </section>

  <!-- ACTIVITY -->
  <section class="view" id="view-activity">
    <div class="eyebrow">Audit trail</div>
    <h2 class="section-title">What changed</h2>
    <div class="filterbar">
      <label>Action</label>
      <select id="act-action"><option value="">All</option><option>write</option><option>edit</option><option>delete</option><option>install</option><option>duplicate</option><option>chmod</option><option>network_write</option></select>
      <label>Session</label>
      <select id="act-session"></select>
      <button class="btn" id="act-copy">Copy timeline</button>
    </div>
    <div id="act-list"></div>
  </section>

  <!-- SESSIONS -->
  <section class="view" id="view-ledger">
    <div class="eyebrow">Behavior</div>
    <h2 class="section-title">Sessions</h2>
    <div id="ledger-list"></div>
  </section>

  <!-- MODELS -->
  <section class="view" id="view-models">
    <div class="eyebrow">Behavior</div>
    <h2 class="section-title">Model insights</h2>
    <div class="stats" id="model-stats"></div>
    <div class="eyebrow" style="margin-top:1.5rem">Regression flags</div>
    <div id="model-flags"></div>
    <div class="eyebrow" style="margin-top:1.5rem">Per model</div>
    <div class="tbl-wrap"><table><thead><tr><th>Model</th><th>Grade</th><th>Sessions</th><th>Calls</th><th>Error rate</th><th>tok/call</th><th>$/call</th><th>Satisfaction</th><th>Peak err hr</th><th>Total</th></tr></thead><tbody id="model-table"></tbody></table></div>
    <div class="eyebrow" style="margin-top:1.5rem">Satisfaction by tool</div>
    <div id="model-sat-tools"></div>
    <div class="eyebrow" style="margin-top:1.5rem">Retry loops</div>
    <div id="model-retries"></div>
    <div class="eyebrow" style="margin-top:1.5rem">Cross-model quality</div>
    <div id="model-cross"></div>
    <div class="eyebrow" style="margin-top:1.5rem">Hourly efficiency</div>
    <div id="model-hourly"></div>
    <div class="eyebrow" style="margin-top:1.5rem">Per session</div>
    <div id="model-sessions"></div>
  </section>

  <!-- CONVERSATIONS -->
  <section class="view" id="view-conversations">
    <div class="eyebrow">Record</div>
    <h2 class="section-title">Conversations</h2>
    <div class="filterbar">
      <label>Session</label>
      <select id="conv-session"></select>
    </div>
    <div id="conv-list"></div>
  </section>

  <!-- COSTS -->
  <section class="view" id="view-costs">
    <div class="eyebrow">Spend</div>
    <h2 class="section-title">Costs</h2>
    <div class="stats" id="cost-cards"></div>
    <div class="eyebrow" style="margin-top:2rem">By tool</div>
    <div class="tbl-wrap"><table><thead><tr><th>Tool</th><th>Calls</th><th>Cost</th><th>Efficiency</th></tr></thead><tbody id="cost-table"></tbody></table></div>
  </section>

  <!-- GITLEAKS -->
  <section class="view" id="view-gitleaks">
    <div class="eyebrow">Deep scan</div>
    <h2 class="section-title">Secret scan</h2>
    <div class="gleak-form">
      <input id="gl-repo" placeholder="/absolute/path/to/git/repo" style="background:var(--panel-2);color:var(--bone);border:1px solid var(--rule);border-radius:3px;font-family:var(--mono);font-size:0.75rem;padding:0.55rem 0.7rem;min-height:44px">
      <button class="btn primary" id="gl-run">Run scan</button>
    </div>
    <div id="gl-results"></div>
  </section>

  <!-- SETTINGS -->
  <section class="view" id="view-settings">
    <div class="eyebrow">Configuration</div>
    <h2 class="section-title">Settings</h2>
    <div class="eyebrow">Alert toggles</div>
    <div class="tbl-wrap" style="margin-bottom:1rem">
      <table><tbody id="alert-config-body"></tbody></table>
    </div>
    <div class="eyebrow">Budget</div>
    <div class="tbl-wrap" style="margin-bottom:1rem">
      <div style="padding:1rem" id="budget-body"></div>
    </div>
    <div class="tbl-wrap" style="margin-bottom:1rem">
      <table><tbody id="settings-body"></tbody></table>
    </div>
    <div class="empty"><div class="big">🔒</div>All data stays on this machine.<br>No cloud, no network, no telemetry.</div>
  </section>
</main>

<script>
"use strict";
const $ = (s) => document.querySelector(s);
let DATA = null;

/* ─── Theme (light/dark) ─────────────────────────────────── */
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const btn = $("#theme-toggle");
  if (btn) btn.textContent = theme === "light" ? "◐ Dark" : "◐ Light";
  try { localStorage.setItem("tot-theme", theme); } catch {}
}
function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem("tot-theme"); } catch {}
  const theme = saved || (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  applyTheme(theme);
}
$("#theme-toggle")?.addEventListener("click", () => {
  const cur = document.documentElement.getAttribute("data-theme") || "dark";
  applyTheme(cur === "light" ? "dark" : "light");
});
initTheme();

/* ─── Export (report) ─────────────────────────────────────── */
$("#export-btn")?.addEventListener("click", () => {
  // Today's report in HTML, opens in a new tab for print/save.
  const today = new Date().toISOString().slice(0, 10);
  window.open(\`/api/export?scope=day&date=\${today}&format=html\`, "_blank");
});
function exportSession(id) {
  const enc = encodeURIComponent(id);
  window.open(\`/api/export?scope=session&id=\${enc}&format=html\`, "_blank");
}

async function load() {
  try {
    const r = await fetch("/api/data");
    DATA = await r.json();
  } catch {
    DATA = { receipts: [], alerts: [], conversations: [], stats: [], ledger: {}, index: null, proxy: null };
  }
  renderAll();
}

/* ─── Helpers ─────────────────────────────────────────────── */
function fmtMoney(n) { return "$" + (n || 0).toFixed(4); }
function fmtTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function shortId(id) { return id ? String(id).slice(-12) : "—"; }
function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function verdictTag(v) {
  const vv = String(v || "unknown").toLowerCase();
  const cls = vv === "verified" ? "verified" : vv === "suspicious" ? "suspicious" : vv === "fabrication" ? "fabrication" : "";
  return \`<span class="tag \${cls}">\${esc(v || "—")}</span>\`;
}
function severityTag(s) {
  const cls = s === "critical" ? "critical" : s === "warning" ? "warning" : "info";
  return \`<span class="tag \${cls}">\${esc(s)}</span>\`;
}
function catTag(c) {
  const cls = (c === "secret" || c === "dangerous_command") ? "secret" : c === "pii" ? "pii" : c === "prompt_injection" ? "prompt_injection" : "info";
  return \`<span class="tag \${cls}">\${esc(c)}</span>\`;
}
function buildAlertBlock(a) {
  const flag = a.severity === "critical" ? "🔴" : a.severity === "warning" ? "🟡" : "ℹ️";
  return [
    "\`\`\`alert",
    \`\${flag} TOOL OF TRUTH ALERT\`,
    \`severity:  \${a.severity}\`,
    \`category:  \${a.category}\`,
    \`rule:      \${a.rule}\`,
    \`confidence: \${Math.round((a.confidence || 0) * 100)}%\`,
    \`requiresReview: \${a.requiresReview}\`,
    \`source:    \${a.source}\`,
    \`sourceDetail: \${a.sourceDetail || ""}\`,
    \`timestamp: \${a.timestamp}\`,
    \`alertId:   \${a.id}\`,
    \`matched:   \${a.matchRedacted}\`,
    \`context:   \${a.context}\`,
    "",
    "investigate: check the conversation log at ~/.tooloftruth/conversations/",
    "and receipts at ~/.tooloftruth/receipts/ for this source.",
    "\`\`\`",
  ].join("\\n");
}
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); } catch {
    const ta = document.createElement("textarea"); ta.value = t; document.body.appendChild(ta); ta.select();
    document.execCommand("copy"); ta.remove();
  }
}

/* ─── Renderers ───────────────────────────────────────────── */
/* ─── Model insights ──────────────────────────────────────── */
function computeModels() {
  // Lightweight inline version of core's behavior-insights (dashboard is
  // static single-file; no server compute needed for these aggregates).
  const sessions = Object.values(DATA.ledger || {}).map(s => {
    const toolCalls = s.toolCalls || 0, errors = s.errors || 0, tokens = s.totalTokens || 0, cost = s.costUsd || 0;
    return {
      ...s,
      errorRate: toolCalls > 0 ? errors / toolCalls : 0,
      tokensPerCall: toolCalls > 0 ? Math.round(tokens / toolCalls) : 0,
      costPerCall: toolCalls > 0 ? cost / toolCalls : 0,
    };
  });
  const byModel = {};
  sessions.forEach(s => {
    const m = s.model || "unknown";
    byModel[m] = byModel[m] || { model: m, sessions: 0, toolCalls: 0, errors: 0, totalCostUsd: 0, messages: 0, totalTokens: 0 };
    byModel[m].sessions++; byModel[m].toolCalls += s.toolCalls; byModel[m].errors += s.errors;
    byModel[m].totalCostUsd += s.costUsd; byModel[m].messages += s.messages; byModel[m].totalTokens += s.totalTokens;
  });
  Object.values(byModel).forEach(m => {
    m.errorRate = m.toolCalls > 0 ? m.errors / m.toolCalls : 0;
    m.grade = m.errorRate <= 0.02 ? "A" : m.errorRate <= 0.05 ? "B" : m.errorRate <= 0.10 ? "C" : m.errorRate <= 0.20 ? "D" : "F";
    m.avgTokPerCall = m.toolCalls > 0 ? Math.round(m.totalTokens / m.toolCalls) : 0;
    m.avgCostPerCall = m.toolCalls > 0 ? m.totalCostUsd / m.toolCalls : 0;
  });
  const flags = [];
  sessions.forEach(s => {
    if (s.errorRate > 0.12) flags.push(\`Session \${esc(shortId(s.sessionId))} — error rate \${Math.round(s.errorRate*100)}% (above 12%)\`);
    if (s.tokensPerCall > 5000) flags.push(\`Session \${esc(shortId(s.sessionId))} — \${s.tokensPerCall} tokens/call (context bloat)\`);
    if (s.toolCalls > (s.messages||0) * 1.2 && (s.messages||0) > 0) flags.push(\`Session \${esc(shortId(s.sessionId))} — tool-heavy (\${s.toolCalls} tools vs \${s.messages} msgs)\`);
  });
  Object.values(byModel).forEach(m => {
    if (m.grade === "D" || m.grade === "F") flags.push(\`Model \${esc(m.model)} grade \${m.grade} — \${Math.round(m.errorRate*100)}% error rate\`);
  });
  return { sessions, byModel: Object.values(byModel).sort((a,b) => b.toolCalls - a.toolCalls), flags };
}
function renderModels() {
  const { sessions, byModel, flags } = computeModels();
  const totErr = sessions.reduce((s, x) => s + (x.toolCalls > 0 ? x.errors / x.toolCalls : 0), 0);
  const avgErr = sessions.length ? Math.round((totErr / sessions.length) * 100) : 0;
  const regressions = flags.length;
  $("#model-stats").innerHTML = [
    \`<div class="stat"><div class="label">Models</div><div class="value">\${byModel.length}</div></div>\`,
    \`<div class="stat"><div class="label">Sessions</div><div class="value">\${sessions.length}</div></div>\`,
    \`<div class="stat \${avgErr > 10 ? "fabricated" : "verified"}"><div class="label">Avg error rate</div><div class="value">\${avgErr}%</div></div>\`,
    \`<div class="stat \${regressions > 0 ? "suspicious" : "verified"}"><div class="label">Regression flags</div><div class="value">\${regressions}</div></div>\`,
  ].join("");

  const deep = computeDeepInsights();
  flags.push(...deep.flags);

  $("#model-flags").innerHTML = flags.map(f => \`<div class="alert-card warning"><div class="alert-head"><span class="tag warning">⚠</span><span class="alert-title">\${f}</span></div></div>\`).join("") || emptyState("No regressions detected");
  $("#model-table").innerHTML = byModel.map(m => {
    const gCls = m.grade === "A" ? "verified" : m.grade === "B" ? "verified" : m.grade === "C" ? "suspicious" : "fabrication";
    const sat = deep.satByModel[m.model];
    const satHtml = sat === undefined ? "—" : \`<span style="color:\${sat.dissatisfied > sat.satisfied ? "var(--caught)" : "var(--proof)"}">\${sat.satisfied}👍/\${sat.dissatisfied}👎</span>\`;
    const peakHr = deep.peakHourByModel[m.model];
    return \`<tr><td class="mono">\${esc(m.model)}</td><td><span class="tag \${gCls}">\${m.grade}</span></td><td class="mono">\${m.sessions}</td><td class="mono">\${m.toolCalls}</td><td class="mono">\${Math.round(m.errorRate*100)}%</td><td class="mono">\${m.avgTokPerCall}</td><td class="mono">\${fmtMoney(m.avgCostPerCall)}</td><td class="mono">\${satHtml}</td><td class="mono">\${peakHr === undefined ? "—" : String(peakHr).padStart(2,"0") + ":00"}</td><td class="mono">\${fmtMoney(m.totalCostUsd)}</td></tr>\`;
  }).join("") || \`<tr><td colspan="10" class="muted">No model data yet</td></tr>\`;

  // F1: satisfaction by tool
  $("#model-sat-tools").innerHTML = deep.satByTool.length === 0
    ? emptyState("No satisfaction data yet — use tooloftruth_satisfaction")
    : \`<div class="tbl-wrap"><table><thead><tr><th>Tool</th><th>Satisfied</th><th>Dissatisfied</th><th>Unknown</th><th>Rate</th></tr></thead><tbody>\${
        deep.satByTool.map(t => \`<tr><td class="mono">\${esc(t.tool)}</td><td class="mono" style="color:var(--proof)">\${t.satisfied}</td><td class="mono" style="color:var(--caught)">\${t.dissatisfied}</td><td class="mono">\${t.unknown}</td><td class="mono">\${t.rate === null ? "—" : Math.round(t.rate*100) + "%"}</td></tr>\`).join("")
      }</tbody></table></div>\`;

  // F2: retry loops
  $("#model-retries").innerHTML = deep.retryLoops.length === 0
    ? emptyState("No error retry loops detected")
    : deep.retryLoops.slice(0, 15).map(l => \`<div class="alert-card warning"><div class="alert-head"><span class="tag warning">↻ \${l.count}×</span><span class="alert-title">\${esc(l.tool)} — \${esc(shortId(l.sessionId))}</span></div></div>\`).join("");

  // F5: cross-model quality
  $("#model-cross").innerHTML = deep.crossModel.length === 0
    ? emptyState("Not enough data — need same tool used by 2+ models")
    : deep.crossModel.slice(0, 10).map(c => \`
        <div class="session-row">
          <div class="top"><h4>\${esc(c.tool)} <span class="muted">(trust spread \${c.spread} pts)</span></h4></div>
          <div class="tbl-wrap" style="margin-top:.5rem"><table><thead><tr><th>Model</th><th>Calls</th><th>Trust</th><th>Error</th><th>Fabrication</th><th>Sat</th></tr></thead><tbody>
          \${c.models.map(m => \`<tr><td class="mono">\${esc(m.model)}</td><td class="mono">\${m.calls}</td><td class="mono">\${m.avgTrustScore}/100</td><td class="mono">\${Math.round(m.errorRate*100)}%</td><td class="mono">\${Math.round((m.fabricationRate||0)*100)}%</td><td class="mono">\${m.satisfactionRate === null ? "—" : Math.round(m.satisfactionRate*100) + "%"}</td></tr>\`).join("")}
          </tbody></table></div>
        </div>\`).join("");

  // F3: hourly efficiency
  $("#model-hourly").innerHTML = deep.hourly.length === 0
    ? emptyState("No timing data")
    : \`<div class="tbl-wrap"><table><thead><tr><th>Hour</th><th>Calls</th><th>Error rate</th><th>Avg ms</th></tr></thead><tbody>\${
        deep.hourly.map(h => \`<tr><td class="mono">\${String(h.hour).padStart(2,"0")}:00</td><td class="mono">\${h.calls}</td><td class="mono" style="color:\${h.errorRate > 0.25 ? "var(--caught)" : "var(--bone)"}">\${Math.round(h.errorRate*100)}%</td><td class="mono">\${h.avgDurationMs}ms</td></tr>\`).join("")
      }</tbody></table></div>\`;

  $("#model-sessions").innerHTML = sessions.sort((a,b) => new Date(b.lastSeen) - new Date(a.lastSeen)).map(s => {
    const errCls = s.errorRate > 0.12 ? "color:var(--caught)" : s.errorRate > 0 ? "color:var(--witness)" : "color:var(--proof)";
    const reg = [];
    if (s.errorRate > 0.12) reg.push("error");
    if (s.tokensPerCall > 5000) reg.push("context-bloat");
    const regHtml = reg.length ? ' <span class="tag warning">' + esc(reg.join(", ")) + '</span>' : "";
    return \`<div class="session-row">
      <div class="top"><h4>\${esc(s.model || "unknown")}</h4><span class="mono-sm">\${esc(shortId(s.sessionId))}</span></div>
      <div class="meta">
        <span>\${s.messages} msgs</span><span>\${s.toolCalls} tools</span>
        <span class="err-rate" style="\${errCls}">\${s.errors} err (\${Math.round(s.errorRate*100)}%)</span>
        <span>\${s.totalTokens} tok</span><span>\${fmtMoney(s.costUsd)}</span>
        <span>\${fmtTime(s.lastSeen)}</span>\${regHtml}
      </div>
    </div>\`;
  }).join("") || emptyState("No sessions");
}

/* ─── Deep insights (F1-F5) computed client-side ──────────── */
function computeDeepInsights() {
  const receipts = DATA.receipts || [];
  const convs = DATA.conversations || [];

  // F2: retry loops (consecutive same-tool runs WITH errors, ≥3)
  const bySess = {};
  receipts.forEach(r => { (bySess[r.sessionId] = bySess[r.sessionId] || []).push(r); });
  const retryLoops = [];
  Object.values(bySess).forEach(calls => {
    calls.sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
    let start = 0;
    for (let i = 1; i <= calls.length; i++) {
      const same = i < calls.length && calls[i].tool === calls[i-1].tool;
      if (!same) {
        const run = calls.slice(start, i);
        if (run.length >= 3 && run[0].tool && run.some(c => c.isError)) {
          retryLoops.push({ sessionId: run[0].sessionId, tool: run[0].tool, count: run.length });
        }
        start = i;
      }
    }
  });
  retryLoops.sort((a,b) => b.count - a.count);

  // F3: hourly buckets
  const hours = {};
  receipts.forEach(r => {
    if (!r.timestamp) return;
    const h = new Date(r.timestamp).getHours();
    hours[h] = hours[h] || { hour: h, calls: 0, errors: 0, durations: [] };
    hours[h].calls++;
    if (r.isError) hours[h].errors++;
    if (typeof r.durationMs === "number") hours[h].durations.push(r.durationMs);
  });
  const hourly = Object.values(hours).map(h => ({
    hour: h.hour, calls: h.calls,
    errorRate: h.calls > 0 ? h.errors / h.calls : 0,
    avgDurationMs: h.durations.length ? Math.round(h.durations.reduce((s,d) => s+d, 0) / h.durations.length) : 0,
  })).sort((a,b) => a.hour - b.hour);
  const peakHourByModel = {};
  byModel.forEach(m => {
    const mReceipts = receipts.filter(r => (r.server||"") === m.model);
    const mHours = {};
    mReceipts.forEach(r => {
      if (!r.timestamp) return;
      const h = new Date(r.timestamp).getHours();
      mHours[h] = mHours[h] || { calls: 0, errors: 0 };
      mHours[h].calls++;
      if (r.isError) mHours[h].errors++;
    });
    const entries = Object.values(mHours);
    if (entries.length) {
      const worst = entries.sort((a,b) => (b.errors/Math.max(1,b.calls)) - (a.errors/Math.max(1,a.calls)) || b.calls - a.calls)[0];
      peakHourByModel[m.model] = Object.keys(mHours).find(k => mHours[k] === worst) ? Number(Object.keys(mHours).find(k => mHours[k] === worst)) : null;
    }
  });

  // F4: prompt creep from conversations
  const bySessConvs = {};
  convs.forEach(c => {
    if (!c.sessionId) return;
    const sid = c.sessionId.startsWith("opencode_") ? c.sessionId.slice(9) : c.sessionId;
    (bySessConvs[sid] = bySessConvs[sid] || []).push(c);
  });

  // F1: satisfaction by tool (records live in DATA.satisfaction if present)
  const satRecords = DATA.satisfaction || [];
  const satByTool = {};
  const satByModel = {};
  satRecords.forEach(r => {
    const t = r.tool || "?";
    satByTool[t] = satByTool[t] || { tool: t, satisfied: 0, dissatisfied: 0, unknown: 0, rate: null };
    if (r.satisfied === true) satByTool[t].satisfied++;
    else if (r.satisfied === false) satByTool[t].dissatisfied++;
    else satByTool[t].unknown++;
    if (r.server) {
      satByModel[r.server] = satByModel[r.server] || { satisfied: 0, dissatisfied: 0 };
      if (r.satisfied === true) satByModel[r.server].satisfied++;
      else if (r.satisfied === false) satByModel[r.server].dissatisfied++;
    }
  });
  Object.values(satByTool).forEach(t => {
    const total = t.satisfied + t.dissatisfied;
    t.rate = total > 0 ? t.satisfied / total : null;
  });

  // F5: cross-model quality (same tool, 2+ models)
  const crossByTool = {};
  receipts.forEach(r => {
    const t = r.tool || "?";
    const model = r.server || "?";
    crossByTool[t] = crossByTool[t] || {};
    crossByTool[t][model] = crossByTool[t][model] || { calls: 0, errors: 0, trust: 0, fab: 0 };
    crossByTool[t][model].calls++;
    if (r.isError) crossByTool[t][model].errors++;
    crossByTool[t][model].trust += r.verification?.trustScore || 0;
    if (r.verification?.verdict === "FABRICATION") crossByTool[t][model].fab++;
  });
  const crossModel = Object.entries(crossByTool).map(([tool, models]) => {
    const rows = Object.entries(models).filter(([,m]) => m.calls >= 2).map(([model, m]) => ({
      model, calls: m.calls,
      errorRate: m.calls ? m.errors / m.calls : 0,
      avgTrustScore: Math.round((m.trust / m.calls) * 10) / 10,
      fabricationRate: m.calls ? m.fab / m.calls : 0,
      satisfactionRate: null,
    }));
    if (rows.length < 2) return null;
    const scores = rows.map(r => r.avgTrustScore);
    return { tool, models: rows, spread: Math.round((Math.max(...scores) - Math.min(...scores)) * 10) / 10 };
  }).filter(Boolean);

  const flags = [];
  retryLoops.filter(l => l.count >= 4).forEach(l => flags.push(\`Session \${shortId(l.sessionId)} — \${l.tool} retried \${l.count}x with errors (stuck?)\`));
  Object.entries(bySessConvs).forEach(([sid, msgs]) => {
    const sorted = msgs.sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
    const inputs = sorted.map(c => c.tokens?.input || 0).filter(t => t > 0);
    if (inputs.length >= 8) {
      const half = Math.floor(inputs.length / 2);
      const avg = arr => arr.reduce((s,n) => s+n, 0) / Math.max(1, arr.length);
      const f = avg(inputs.slice(0, half)), s2 = avg(inputs.slice(half));
      if (f > 0 && (s2 - f) / f > 0.5) flags.push(\`Session \${shortId(sid)} — input tokens grew \${Math.round(((s2-f)/f)*100)}% across session (prompt creep)\`);
    }
  });
  Object.values(satByTool).forEach(t => {
    if (t.dissatisfied >= 2 && t.rate !== null && t.rate < 0.5) flags.push(\`Tool \${t.tool} — \${t.dissatisfied} dissatisfied outcomes\`);
  });
  crossModel.forEach(c => {
    if (c.spread > 20) {
      const worst = c.models.reduce((a,b) => b.avgTrustScore < a.avgTrustScore ? b : a);
      flags.push(\`Tool \${c.tool} trust spread \${c.spread} pts — worst: \${worst.model}\`);
    }
  });
  hourly.forEach(h => {
    if (h.calls >= 5 && h.errorRate > 0.25) flags.push(\`Hour \${String(h.hour).padStart(2,"0")}:00 — \${Math.round(h.errorRate*100)}% error rate\`);
  });

  return { satByTool: Object.values(satByTool), satByModel, retryLoops, hourly, crossModel, peakHourByModel, flags };
}
function renderAll() {
  renderOverview();
  renderAlerts();
  renderActivity();
  renderLedger();
  renderModels();
  renderConversations();
  renderCosts();
  renderSettings();
}

function renderOverview() {
  const receipts = DATA.receipts || [];
  const verified = receipts.filter(r => r.verification?.verdict === "VERIFIED").length;
  const suspicious = receipts.filter(r => r.verification?.verdict === "SUSPICIOUS").length;
  const fabricated = receipts.filter(r => r.verification?.verdict === "FABRICATION").length;
  const total = receipts.length;
  const cost = receipts.reduce((s, r) => s + (r.costUsd || 0), 0);
  const alerts = DATA.alerts || [];
  const crit = alerts.filter(a => a.severity === "critical").length;
  const warn = alerts.filter(a => a.severity === "warning").length;

  $("#stat-cards").innerHTML = [
    \`<div class="stat"><div class="label">Total calls</div><div class="value">\${total}</div></div>\`,
    \`<div class="stat verified"><div class="label">Verified</div><div class="value">\${verified}</div></div>\`,
    \`<div class="stat suspicious"><div class="label">Suspicious</div><div class="value">\${suspicious}</div></div>\`,
    \`<div class="stat fabricated"><div class="label">Fabricated</div><div class="value">\${fabricated}</div></div>\`,
    \`<div class="stat"><div class="label">Cost</div><div class="value">\${fmtMoney(cost)}</div></div>\`,
    \`<div class="stat"><div class="label">Critical alerts</div><div class="value" style="color:\${crit > 0 ? "var(--caught)" : "var(--bone)"}">\${crit}</div></div>\`,
  ].join("");

  // Gauge arcs (pie-style segments on the half-circle)
  const pct = (n) => (total > 0 ? n / total : 0);
  const seg = (start, frac) => {
    const a0 = Math.PI + start * Math.PI, a1 = a0 + frac * Math.PI;
    const r = 100, cx = 120, cy = 135;
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    return \`M \${cx} \${cy} M \${x0} \${y0} A \${r} \${r} 0 0 1 \${x1} \${y1}\`;
  };
  let acc = 0;
  const arcV = pct(verified), arcS = pct(suspicious), arcF = pct(fabricated);
  $("#arc-verified").setAttribute("d", seg(acc, arcV)); acc += arcV;
  $("#arc-susp").setAttribute("d", seg(acc, arcS)); acc += arcS;
  $("#arc-fab").setAttribute("d", seg(acc, arcF));

  // Needle → weighted verdict (fabrication-heavy = swing right/crimson)
  const needleAngle = Math.min(90, Math.max(-90, (pct(fabricated) * 90) - (pct(verified) * 45)));
  $("#needle").setAttribute("transform", \`rotate(\${needleAngle} 120 135)\`);

  const dominant = fabricated >= verified && fabricated > 0 ? "v-fabrication"
    : suspicious >= verified ? "v-suspicious" : "v-verified";
  const dominantTxt = fabricated >= verified && fabricated > 0 ? "FABRICATION" : suspicious >= verified ? "SUSPICIOUS" : "VERIFIED";
  $("#verdict-line").innerHTML = \`Dominant verdict: <span class="v \${dominant}">\${dominantTxt}</span> <span class="muted">(\${total} calls)</span>\`;

  $("#alert-summary").innerHTML = [
    \`<div class="stat"><div class="label">Critical</div><div class="value" style="color:var(--caught)">\${crit}</div></div>\`,
    \`<div class="stat"><div class="label">Warning</div><div class="value" style="color:var(--witness)">\${warn}</div></div>\`,
    \`<div class="stat"><div class="label">Total</div><div class="value">\${alerts.length}</div></div>\`,
  ].join("");
  $("#alert-note").textContent = alerts.length === 0 ? "No sensitive data flagged yet." : \`Last alert: \${fmtTime(alerts[0]?.timestamp)}\`;

  $("#overview-alerts").innerHTML = alerts.slice(0, 5).map(renderAlertCard).join("") || emptyState("No alerts");
}

function renderAlertCard(a) {
  const cls = a.severity === "critical" ? "critical" : a.severity === "warning" ? "warning" : "info";
  return \`<div class="alert-card \${cls}" data-alert-id="\${esc(a.id)}">
    <div class="alert-head" onclick="this.parentElement.classList.toggle('open')">
      \${severityTag(a.severity)} \${catTag(a.category)} <span class="alert-title">\${esc(a.rule)}</span>
      <span class="mono-sm" style="margin-left:auto">\${fmtTime(a.timestamp)}</span>
    </div>
    <div class="alert-body">
      <div class="alert-meta">
        <span>match: <span class="match-red">\${esc(a.matchRedacted)}</span></span>
        <span>conf \${Math.round((a.confidence||0)*100)}%</span>
        <span>\${esc(a.source)}</span>
      </div>
      <div class="copy-block" id="block-\${esc(a.id)}">\${esc(buildAlertBlock(a))}</div>
      <button class="btn" onclick="copyAlert('\${esc(a.id)}')">Copy to investigate</button>
    </div>
  </div>\`;
}
window.copyAlert = async function(id) {
  const a = (DATA.alerts || []).find(x => x.id === id);
  if (!a) return;
  await copyText(buildAlertBlock(a));
  const btn = event.target; btn.textContent = "Copied"; setTimeout(() => btn.textContent = "Copy to investigate", 1500);
};

function renderAlerts() {
  const sev = $("#alert-sev").value, cat = $("#alert-cat").value;
  let alerts = (DATA.alerts || []).slice();
  if (sev) alerts = alerts.filter(a => a.severity === sev);
  if (cat) alerts = alerts.filter(a => a.category === cat);
  $("#alert-list").innerHTML = alerts.map(renderAlertCard).join("") || emptyState("No alerts match these filters");
  $("#alert-copy-all").onclick = async () => {
    const blocks = alerts.map(a => buildAlertBlock(a)).join("\\n\\n");
    await copyText(blocks);
    $("#alert-copy-all").textContent = \`Copied \${alerts.length}\`;
    setTimeout(() => $("#alert-copy-all").textContent = "Copy all alerts", 1500);
  };
}
$("#alert-sev").addEventListener("change", renderAlerts);
$("#alert-cat").addEventListener("change", renderAlerts);

function renderLedger() {
  const sessions = Object.values(DATA.ledger || {});
  if (sessions.length === 0) { $("#ledger-list").innerHTML = emptyState("No sessions tracked yet"); return; }
  $("#ledger-list").innerHTML = sessions.sort((a,b) => new Date(b.lastSeen) - new Date(a.lastSeen)).map(s => {
    const errRate = s.toolCalls > 0 ? Math.round((s.errors / s.toolCalls) * 100) : 0;
    const errCls = errRate > 20 ? "color:var(--caught)" : errRate > 0 ? "color:var(--witness)" : "color:var(--proof)";
    return \`<div class="session-row">
      <div class="top">
        <h4>\${esc(s.model || "unknown model")}</h4>
        <span style="display:flex;gap:.5rem;align-items:center">
          <span class="mono-sm">\${esc(s.sessionId || "")}</span>
          <button class="btn" style="min-height:32px;padding:.25rem .6rem" onclick="exportSession('\${esc(s.sessionId)}')">⤓ report</button>
        </span>
      </div>
      <div class="meta">
        <span>\${s.messages} msgs</span>
        <span>\${s.toolCalls} tool calls</span>
        <span class="err-rate" style="\${errCls}">\${s.errors} errors (\${errRate}%)</span>
        <span>\${s.totalTokens} tokens</span>
        <span>\${fmtMoney(s.costUsd)}</span>
        <span>\${fmtTime(s.lastSeen)}</span>
      </div>
    </div>\`;
  }).join("");
}

function renderConversations() {
  const convs = DATA.conversations || [];
  const sessions = [...new Set(convs.map(c => c.sessionId).filter(Boolean))];
  const sel = $("#conv-session");
  const cur = sel.value;
  sel.innerHTML = \`<option value="">All sessions</option>\` + sessions.map(s => \`<option value="\${esc(s)}">\${esc(shortId(s))}</option>\`).join("");
  if (cur) sel.value = cur;
  const filtered = sel.value ? convs.filter(c => c.sessionId === sel.value) : convs;
  const bySession = {};
  filtered.forEach(c => { (bySession[c.sessionId] = bySession[c.sessionId] || []).push(c); });
  $("#conv-list").innerHTML = Object.entries(bySession).slice(0, 20).map(([sid, msgs]) => {
    return \`<div style="margin-bottom:2.5rem">
      <div class="eyebrow">Session \${esc(shortId(sid))}</div>
      \${msgs.slice(-50).map(m => {
        const roleCls = m.role === "user" ? "user" : m.role === "assistant" ? "assistant" : "";
        const tools = (m.toolCalls || []).map(t => \`<span class="tool-chip \${t.isError ? "err" : ""}">\${esc(t.tool)}</span>\`).join("");
        return \`<div class="msg \${roleCls}">
          <div class="role">\${esc(m.role || "?")}</div>
          <div class="body">\${esc(m.content || "").slice(0, 400)}</div>
          <div class="meta">\${m.model || ""} · \${m.tokens?.input||0}/\${m.tokens?.output||0} tok · \${fmtTime(m.timestamp)}</div>
          \${tools ? \`<div class="tools">\${tools}</div>\` : ""}
        </div>\`;
      }).join("")}
    </div>\`;
  }).join("") || emptyState("No conversations yet");
}
$("#conv-session").addEventListener("change", renderConversations);

/* ─── Activity (what changed) timeline ────────────────────── */
function activityItems() {
  // fs-action alerts carry action/rule/target in a stable shape. Build a
  // readable per-session "installed X, wrote Y, deleted Z" timeline.
  const items = (DATA.alerts || []).filter(a =>
    a.category === "filesystem_action" || a.category === "install_action"
  ).map(a => {
    const action = (a.rule || "").replace("shell_", "").replace("tool_", "");
    return {
      ts: a.timestamp,
      sessionId: a.sessionId || a.source || "",
      action,
      rule: a.rule,
      target: a.matchRedacted || a.sourceDetail || a.context || "",
      severity: a.severity,
      source: a.source,
    };
  });
  // Receipts also carry write/edit/delete intent via params for proxied tools.
  (DATA.receipts || []).forEach(r => {
    const p = r.params || {};
    let action = null;
    if (r.tool === "write" && p.filePath) action = { a: "write", t: String(p.filePath) };
    else if (r.tool === "edit" && p.filePath) action = { a: "edit", t: String(p.filePath) };
    else if (r.tool === "bash" && typeof p.command === "string") {
      const cmd = p.command;
      if (/rm\\s+-rf|\\brm\\b/.test(cmd)) action = { a: "delete", t: (cmd.match(/rm\\s+-rf?\\s+(\\S+)/) || [])[1] || cmd.slice(0, 40) };
      else if (/(npm|pnpm|yarn|brew|pip|cargo|go|apt).*(install|add)/.test(cmd)) action = { a: "install", t: (cmd.match(/install\\s+(\\S+)/) || [])[1] || cmd.slice(0, 40) };
      else if (/cp\\s+/.test(cmd)) action = { a: "duplicate", t: cmd.slice(0, 50) };
    }
    if (action) {
      items.push({
        ts: r.timestamp,
        sessionId: r.sessionId || "",
        action: action.a,
        rule: r.tool,
        target: action.t,
        severity: r.isError ? "warning" : "info",
        source: \`tool:\${r.tool}\`,
      });
    }
  });
  return items.sort((a, b) => new Date(b.ts) - new Date(a.ts));
}

function renderActivity() {
  const items = activityItems();
  const sessions = [...new Set(items.map(i => i.sessionId).filter(Boolean))];
  const sel = $("#act-session");
  const cur = sel.value;
  sel.innerHTML = \`<option value="">All sessions</option>\` + sessions.map(s => \`<option value="\${esc(s)}">\${esc(shortId(s))}</option>\`).join("");
  if (cur) sel.value = cur;
  const actionFilter = $("#act-action").value;
  let filtered = items;
  if (actionFilter) filtered = filtered.filter(i => i.action === actionFilter);
  if (sel.value) filtered = filtered.filter(i => i.sessionId === sel.value);
  const ACTION_ICON = { write: "✎", edit: "✎", delete: "✗", install: "↓", duplicate: "⧉", chmod: "🔒", network_write: "⇣" };
  const ACTION_COLOR = { delete: "var(--caught)", install: "var(--witness)", write: "var(--proof)", edit: "var(--proof)" };
  $("#act-list").innerHTML = filtered.slice(0, 300).map(i => {
    const icon = ACTION_ICON[i.action] || "•";
    const color = ACTION_COLOR[i.action] || "var(--bone-dim)";
    return \`<div class="msg">
      <div class="role" style="color:\${color}">\${icon} \${esc(i.action)} <span style="color:var(--bone-dim)">\${esc(i.rule)}</span></div>
      <div class="body">\${esc(i.target)}</div>
      <div class="meta">\${fmtTime(i.ts)} · \${esc(shortId(i.sessionId))} · \${esc(i.source)}</div>
    </div>\`;
  }).join("") || emptyState("No activity recorded yet");
  window.__actItems = filtered;
}
$("#act-action").addEventListener("change", renderActivity);
$("#act-session").addEventListener("change", renderActivity);
$("#act-copy").addEventListener("click", async () => {
  const lines = (window.__actItems || []).map(i => \`[\${i.action}] \${i.target} @ \${fmtTime(i.ts)} (\${i.sessionId})\`).join("\\n");
  await copyText(lines || "No activity");
  $("#act-copy").textContent = "Copied";
  setTimeout(() => $("#act-copy").textContent = "Copy timeline", 1500);
});

function renderCosts() {
  const receipts = DATA.receipts || [];
  const byTool = {};
  receipts.forEach(r => {
    const t = r.tool || "?";
    byTool[t] = byTool[t] || { calls: 0, cost: 0, err: 0 };
    byTool[t].calls++;
    byTool[t].cost += r.costUsd || 0;
    if (r.isError) byTool[t].err++;
  });
  const totalCost = Object.values(byTool).reduce((s, t) => s + t.cost, 0);
  const totalCalls = receipts.length;
  const totalTokens = receipts.reduce((s, r) => s + (r.tokens?.input||0) + (r.tokens?.output||0), 0);
  $("#cost-cards").innerHTML = [
    \`<div class="stat"><div class="label">Total cost</div><div class="value">\${fmtMoney(totalCost)}</div></div>\`,
    \`<div class="stat"><div class="label">Calls</div><div class="value">\${totalCalls}</div></div>\`,
    \`<div class="stat"><div class="label">Tokens</div><div class="value">\${totalTokens}</div></div>\`,
    \`<div class="stat"><div class="label">Tools</div><div class="value">\${Object.keys(byTool).length}</div></div>\`,
  ].join("");
  $("#cost-table").innerHTML = Object.entries(byTool).sort((a,b) => b[1].cost - a[1].cost).map(([tool, t]) =>
    \`<tr><td class="mono">\${esc(tool)}</td><td class="mono">\${t.calls}</td><td class="mono">\${fmtMoney(t.cost)}</td><td class="mono" style="color:\${t.err > 0 ? "var(--caught)" : "var(--proof)"}">\${t.err} errors</td></tr>\`
  ).join("") || \`<tr><td colspan="4" class="muted">No receipts yet</td></tr>\`;
}

function renderSettings() {
  const rows = [
    ["Data dir", TOOL_DATA_DIR || "~/.tooloftruth"],
    ["Receipts", (DATA.receipts||[]).length + " records"],
    ["Alerts", (DATA.alerts||[]).length + " records"],
    ["Sessions", Object.keys(DATA.ledger||{}).length],
    ["Proxy servers", Object.keys(DATA.proxy?.servers||{}).join(", ") || "none"],
  ];
  $("#settings-body").innerHTML = rows.map(([k, v]) => \`<tr><td class="mono" style="color:var(--bone-dim);width:180px">\${esc(k)}</td><td class="mono">\${esc(v)}</td></tr>\`).join("");
  renderAlertConfig();
  renderBudget();
}

/* ─── Budget ───────────────────────────────────────────────── */
function renderBudget() {
  const b = DATA.budget || {};
  const body = $("#budget-body");
  if (!body) return;
  const pct = b.pctUsed || 0;
  const crossed = b.crossed;
  body.innerHTML = \`
    <div style="display:flex;gap:1.5rem;flex-wrap:wrap;align-items:center">
      <div class="mono" style="flex:1;min-width:220px">
        <div style="display:flex;justify-content:space-between;margin-bottom:.5rem">
          <span>\${fmtMoney(b.spentUsd||0)} spent today</span>
          <span>\${b.dailyLimitUsd ? "of " + fmtMoney(b.dailyLimitUsd) + " limit" : "no limit set"}</span>
        </div>
        <div style="height:8px;border-radius:4px;background:var(--panel-2);overflow:hidden">
          <div style="height:100%;width:\${Math.min(100,pct)}%;background:\${crossed?"var(--caught)":pct>80?"var(--witness)":"var(--proof)"};transition:width .4s"></div>
        </div>
        <div style="margin-top:.5rem;color:\${crossed?"var(--caught)":"var(--bone-dim)"};font-size:.72rem">
          \${crossed ? "⚠ Daily budget crossed" : pct + "% of daily budget used"}
        </div>
      </div>
      <div style="display:flex;gap:.5rem;align-items:center">
        <label class="mono muted" for="budget-limit" style="font-size:.72rem">Daily limit ($)</label>
        <input id="budget-limit" type="number" min="0" step="0.5" value="\${b.dailyLimitUsd || ""}" placeholder="0 = off" style="width:110px;background:var(--panel-2);color:var(--bone);border:1px solid var(--rule);border-radius:3px;font-family:var(--mono);font-size:.75rem;padding:.5rem;min-height:44px">
        <button class="btn" id="budget-save">Save</button>
      </div>
    </div>\`;
  $("#budget-save").onclick = async () => {
    const v = Number($("#budget-limit").value || 0);
    const r = await fetch("/api/budget", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dailyLimitUsd: v }) });
    const j = await r.json();
    DATA.budget = j.status;
    renderBudget();
  };
}

/* ─── Alert config toggles ─────────────────────────────────── */
const CATEGORY_LABELS = {
  secret: "Secrets — API keys, tokens, passwords",
  pii: "PII — email, phone, SSN, cards, IP",
  prompt_injection: "Prompt injection — jailbreaks, overrides",
  dangerous_command: "Dangerous commands — rm -rf, curl|sh",
  filesystem_action: "Filesystem actions — writes, edits, deletes, copies",
  install_action: "Installs — brew/npm/pip/pnpm",
};
let ALERT_CFG = null;

async function loadAlertConfig() {
  try {
    const r = await fetch("/api/alerts-config");
    ALERT_CFG = await r.json();
  } catch { ALERT_CFG = null; }
  renderAlertConfig();
}

function renderAlertConfig() {
  const body = $("#alert-config-body");
  if (!ALERT_CFG) { body.innerHTML = \`<tr><td class="muted">Unable to load alert config</td></tr>\`; return; }
  const rows = [];
  // Master switch
  rows.push(\`<tr><td colspan="2">
    <div class="toggle-row">
      <span class="t-label">Master alerts</span>
      <label class="toggle"><input type="checkbox" \${ALERT_CFG.enabled ? "checked" : ""} data-cfg="enabled"><span class="slider"></span></label>
      <span class="t-desc">All alerting on/off</span>
    </div>
  </td></tr>\`);
  // Categories
  for (const [cat, on] of Object.entries(ALERT_CFG.categories || {})) {
    rows.push(\`<tr><td colspan="2">
      <div class="toggle-row">
        <span class="t-label">\${esc(CATEGORY_LABELS[cat] || cat)}</span>
        <label class="toggle"><input type="checkbox" \${on ? "checked" : ""} data-cfg="category" data-cat="\${esc(cat)}"><span class="slider"></span></label>
      </div>
    </td></tr>\`);
  }
  // Notifications
  rows.push(\`<tr><td colspan="2">
    <div class="toggle-row">
      <span class="t-label">Critical → native notification</span>
      <label class="toggle"><input type="checkbox" \${ALERT_CFG.notifyCritical ? "checked" : ""} data-cfg="notifyCritical"><span class="slider"></span></label>
    </div>
  </td></tr>\`);
  rows.push(\`<tr><td colspan="2">
    <div class="toggle-row">
      <span class="t-label">Warning → native notification</span>
      <label class="toggle"><input type="checkbox" \${ALERT_CFG.notifyWarning ? "checked" : ""} data-cfg="notifyWarning"><span class="slider"></span></label>
    </div>
  </td></tr>\`);
  body.innerHTML = rows.join("");
}

$("#alert-config-body").addEventListener("change", async (e) => {
  const input = e.target;
  const cfg = input.dataset.cfg;
  const checked = input.checked;
  const payload = {};
  if (cfg === "enabled") payload.enabled = checked;
  else if (cfg === "category") payload.category = input.dataset.cat, payload.categoryEnabled = checked;
  else if (cfg === "notifyCritical") payload.notifyCritical = checked;
  else if (cfg === "notifyWarning") payload.notifyWarning = checked;
  try {
    const r = await fetch("/api/alerts-config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    ALERT_CFG = await r.json();
  } catch { /* keep current */ }
});
loadAlertConfig();
const TOOL_DATA_DIR = "/Users/adityagoel/.tooloftruth";

/* ─── Gitleaks ─────────────────────────────────────────────── */
$("#gl-run").addEventListener("click", async () => {
  const repo = $("#gl-repo").value.trim();
  if (!repo) return;
  $("#gl-results").innerHTML = \`<div class="mono muted">Scanning \${esc(repo)}…</div>\`;
  try {
    const r = await fetch("/api/gitleaks?repo=" + encodeURIComponent(repo));
    const j = await r.json();
    const fs = j.findings || [];
    $("#gl-results").innerHTML = fs.length === 0
      ? emptyState("No secrets found")
      : fs.map(f => \`<div class="alert-card critical">
          <div class="alert-head"><span class="tag critical">\${esc(f.RuleID)}</span><span class="alert-title">\${esc(f.Description || "")}</span></div>
          <div class="alert-body" style="display:block">
            <div class="alert-meta"><span class="match-red">\${esc((f.Secret||"").slice(0,12))}•••\${esc((f.Secret||"").slice(-4))}</span><span>\${esc(f.File)}:\${f.StartLine}:\${f.StartColumn}</span><span>\${esc((f.Commit||"").slice(0,8))}</span></div>
          </div>
        </div>\`).join("");
  } catch (e) {
    $("#gl-results").innerHTML = emptyState("Scan failed: " + esc(e.message));
  }
});

/* ─── Empty state ──────────────────────────────────────────── */
function emptyState(msg) { return \`<div class="empty"><div class="big">◆</div>\${esc(msg)}</div>\`; }

/* ─── Nav ──────────────────────────────────────────────────── */
document.querySelectorAll("nav button").forEach(b => {
  b.addEventListener("click", () => {
    document.querySelectorAll("nav button").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    $("#view-" + b.dataset.view).classList.add("active");
  });
});

/* ─── Deep-link handling: ?alert=<id> ─────────────────────── */
function handleDeepLink() {
  const params = new URLSearchParams(window.location.search);
  const alertId = params.get("alert");
  if (!alertId) return;
  // Switch to Alerts view
  const alertsBtn = document.querySelector('button[data-view="alerts"]');
  if (alertsBtn) alertsBtn.click();
  // Wait for data, then find + highlight the alert
  const highlight = () => {
    const card = document.querySelector(\`.alert-card[data-alert-id="\${CSS.escape(alertId)}"]\`);
    if (card) {
      card.classList.add("open");
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      card.style.transition = "box-shadow 0.3s";
      card.style.boxShadow = "0 0 0 3px var(--witness)";
      setTimeout(() => { card.style.boxShadow = "none"; }, 4000);
    }
  };
  if (document.querySelectorAll(".alert-card").length > 0) highlight();
  else setTimeout(highlight, 1000);
  // Clear the URL param so refresh doesn't re-trigger
  history.replaceState({}, "", "/");
}

/* ─── Auto-refresh ─────────────────────────────────────────── */
load();
setInterval(load, 15000);
setTimeout(handleDeepLink, 500);
</script>
</body>
</html>
`;
