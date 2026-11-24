import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { blockTypeCounts, parseWorkspace } from "../src/workspace.js";

const sdk = process.env.PORTAL_SDK ?? "C:/PortalSDK";
const mods = join(sdk, "GodotProject/mods");
const templates = {
  conquest: "CustomCQ/conquest_template_14.0.json",
  breakthrough: "CustomBT/custom_breakthrough_template_V5.0.json",
  rush: "CustomRush/rush_template_4.0.json",
  hybrid: "HybridExample/HybridExample.workspace.json",
};

describe.skipIf(!existsSync(mods))("SDK workspaces", () => {
  for (const [name, rel] of Object.entries(templates)) {
    it(`parses ${name}`, () => {
      const w = parseWorkspace(readFileSync(join(mods, rel), "utf8"));
      const counts = blockTypeCounts(w);
      expect(w.mod.blocks.blocks[0].type).toBe("modBlock");
      expect(counts.get("ruleBlock")).toBeGreaterThan(0);
    });
  }
});
