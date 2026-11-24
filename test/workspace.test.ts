import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { extractBundle, parseBundle } from "../src/bundle.js";
import { emitWorkspace } from "../src/emit.js";
import { blockTypeCounts, parseWorkspace } from "../src/workspace.js";

const sdk = process.env.PORTAL_SDK ?? "C:/PortalSDK";
const mods = join(sdk, "GodotProject/mods");
const templates = {
  conquest: "CustomCQ/conquest_template_14.0.json",
  breakthrough: "CustomBT/custom_breakthrough_template_V5.0.json",
  rush: "CustomRush/rush_template_4.0.json",
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

// The experience bundles exported from the editor embed the rules workspace. They must convert exactly like the SDK templates
// (block ids and layout differ, the rules do not).
describe.skipIf(!existsSync(mods))("experience bundles", () => {
  const bundles: [string, string, string][] = [
    ["conquest", "conquest/customconquest_bundle.json", templates.conquest],
    ["breakthrough", "breakthrough/custombreakthrough_bundle.json", templates.breakthrough],
    ["rush", "rush/customrush_bundle.json", templates.rush],
  ];
  it.each(bundles)("%s bundle converts like its SDK template", (_name, bundle, template) => {
    const extracted = extractBundle(parseBundle(readFileSync(join(import.meta.dirname, "../golden", bundle), "utf8")));
    const fromBundle = emitWorkspace(extracted.workspace);
    const fromTemplate = emitWorkspace(parseWorkspace(readFileSync(join(mods, template), "utf8")));
    expect(fromBundle.ts).toEqual(fromTemplate.ts);
    expect(fromBundle.strings).toEqual(fromTemplate.strings);
  });
});
