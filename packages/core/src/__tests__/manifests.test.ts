import { describe, it, expect } from "vitest";
import { parseManifest } from "../manifests.js";

describe("Manifests", () => {
  it("parses a valid manifest", () => {
    const data = {
      skill: "test-skill",
      version: "1.0.0",
      requires: {
        echo: { tool: "echo", mustBeCalled: true },
      },
    };
    const manifest = parseManifest(data);
    expect(manifest.skill).toBe("test-skill");
    expect(manifest.version).toBe("1.0.0");
    expect(manifest.requires["echo"].mustBeCalled).toBe(true);
  });

  it("rejects missing skill name", () => {
    expect(() => parseManifest({ version: "1.0", requires: {} })).toThrow();
  });

  it("rejects missing version", () => {
    expect(() => parseManifest({ skill: "x", requires: {} })).toThrow();
  });

  it("rejects missing requires", () => {
    expect(() => parseManifest({ skill: "x", version: "1.0" })).toThrow();
  });

  it("handles optional fields", () => {
    const data = {
      skill: "test",
      version: "1.0",
      requires: { echo: { tool: "echo", must_be_called: true } },
    };
    const manifest = parseManifest(data);
    expect(manifest.order).toEqual([]);
    expect(manifest.outputRules).toEqual([]);
    expect(manifest.maxCostUsd).toBeUndefined();
  });
});
