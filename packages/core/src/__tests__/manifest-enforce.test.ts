import { describe, it, expect } from "vitest";
import { checkManifestCall } from "../manifest-enforce.js";
import type { SkillManifest } from "../types.js";

const manifest: SkillManifest = {
  skill: "echo",
  version: "1.0.0",
  requires: {
    echo: { tool: "echo", mustBeCalled: true, expectedArgs: { message: "" } },
  },
  order: ["echo"],
  outputRules: ['Output must contain "Echo:"'],
  maxCostUsd: 1.0,
};

// Mirrors the raw JSON manifest shape (snake_case) that parseManifest passes through
const snakeManifest = {
  ...manifest,
  requires: {
    echo: { tool: "echo", must_be_called: true, expected_args: { message: "" } },
  },
} as unknown as SkillManifest;

describe("Manifest enforcement", () => {
  it("allows a call that matches the manifest", () => {
    const res = checkManifestCall(manifest, "echo", "echo", { message: "hello" }, 0.001, { content: [{ type: "text", text: "Echo: hello" }] });
    expect(res.allowed).toBe(true);
    expect(res.violations).toHaveLength(0);
  });

  it("blocks a tool not declared in the manifest", () => {
    const res = checkManifestCall(manifest, "add", "echo", { a: 1, b: 2 }, 0, null);
    expect(res.allowed).toBe(false);
    expect(res.violations[0].type).toBe("tool_not_required");
  });

  it("blocks when a required arg is missing", () => {
    const res = checkManifestCall(manifest, "echo", "echo", {}, 0, null);
    expect(res.allowed).toBe(false);
    expect(res.violations.some((v) => v.type === "arg_mismatch")).toBe(true);
  });

  it("handles snake_case manifest shape (real parseManifest output)", () => {
    const res = checkManifestCall(snakeManifest, "echo", "echo", {}, 0, null);
    expect(res.allowed).toBe(false);
    expect(res.violations.some((v) => v.type === "arg_mismatch")).toBe(true);
  });

  it("blocks when cost budget is exceeded", () => {
    const res = checkManifestCall(manifest, "echo", "echo", { message: "x" }, 5.0, { content: [] });
    expect(res.allowed).toBe(false);
    expect(res.violations.some((v) => v.type === "cost_budget_exceeded")).toBe(true);
  });

  it("flags output rule violations", () => {
    const res = checkManifestCall(manifest, "echo", "echo", { message: "x" }, 0.001, { content: [{ type: "text", text: "no prefix here" }] });
    expect(res.violations.some((v) => v.type === "output_rule_violation")).toBe(true);
  });
});
