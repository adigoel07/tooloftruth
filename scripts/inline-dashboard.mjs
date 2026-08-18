#!/usr/bin/env node
// Regenerates packages/cli/src/dashboard-html.ts from packages/dashboard/src/dashboard.html.
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "..", "packages", "dashboard", "src", "dashboard.html");
const out = join(here, "..", "packages", "cli", "src", "dashboard-html.ts");

const html = readFileSync(src, "utf-8");
// Escape the template-literal delimiters the HTML uses (backticks, ${).
const escaped = html.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");

const ts = `// Auto-generated from dashboard.html — do not edit by hand.\n// Run: node scripts/inline-dashboard.mjs\n\nexport const DASHBOARD_HTML: string = \`${escaped}\`;\n`;
writeFileSync(out, ts);
console.log(`Regenerated ${out} (${ts.length} bytes)`);
