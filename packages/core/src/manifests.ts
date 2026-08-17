import type { SkillManifest } from "./types.js";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

export function parseManifest(data: unknown): SkillManifest {
  const d = data as Record<string, unknown>;

  if (!d.skill || typeof d.skill !== "string") {
    throw new Error("Manifest must have a 'skill' string field");
  }
  if (!d.version || typeof d.version !== "string") {
    throw new Error("Manifest must have a 'version' string field");
  }
  if (!d.requires || typeof d.requires !== "object") {
    throw new Error("Manifest must have a 'requires' object field");
  }

  return {
    skill: d.skill as string,
    version: d.version as string,
    requires: d.requires as SkillManifest["requires"],
    order: (d.order as string[]) || [],
    outputRules: (d.outputRules as string[]) || [],
    maxCostUsd: (d.maxCostUsd as number) || undefined,
  };
}

export function loadManifestFromDisk(
  baseDir: string,
  skillName: string
): SkillManifest | null {
  const manifestPath = join(baseDir, "manifests", `${skillName}.json`);
  if (!existsSync(manifestPath)) return null;
  try {
    const data = JSON.parse(readFileSync(manifestPath, "utf-8"));
    return parseManifest(data);
  } catch {
    return null;
  }
}

export function loadAllManifests(baseDir: string): Map<string, SkillManifest> {
  const manifests = new Map<string, SkillManifest>();
  const manifestsDir = join(baseDir, "manifests");
  if (!existsSync(manifestsDir)) return manifests;

  const { readdirSync } = require("fs");
  const files = readdirSync(manifestsDir).filter((f: string) =>
    f.endsWith(".json")
  );

  for (const file of files) {
    try {
      const data = JSON.parse(
        readFileSync(join(manifestsDir, file), "utf-8")
      );
      const manifest = parseManifest(data);
      manifests.set(manifest.skill, manifest);
    } catch {
      continue;
    }
  }

  return manifests;
}
