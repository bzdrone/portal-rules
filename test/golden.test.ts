import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { emitWorkspace } from "../src/emit.js";
import { parseWorkspace } from "../src/workspace.js";
// @ts-expect-error plain JS helper shared with the CLI diff tool
import { units } from "../scripts/gdiff.mjs";

const sdk = process.env.PORTAL_SDK ?? "C:/PortalSDK";
const input = join(sdk, "GodotProject/mods/CustomCQ/conquest_template_14.0.json");
const golden = join(import.meta.dirname, "../golden/conquest");

/** Units that intentionally differ from EA's output; each is explained in docs/divergences.md. */
const KNOWN_DIVERGENCES = new Set(["OutOfBounds"]);

describe.skipIf(!existsSync(input))("conquest template vs EA export", () => {
  const result = emitWorkspace(parseWorkspace(readFileSync(input, "utf8")));
  const ours: Map<string, string> = units(result.ts);
  const gold: Map<string, string> = units(readFileSync(join(golden, "customcq.ts"), "utf8"));

  it("emits without diagnostics", () => {
    expect(result.diagnostics).toEqual([]);
  });

  it("emits the same set of top-level units", () => {
    expect([...ours.keys()].sort()).toEqual([...gold.keys()].sort());
  });

  it("matches every unit except the known divergences", () => {
    const different = [...gold].filter(([name, text]) => ours.get(name) !== text).map(([name]) => name);
    expect(different.filter((n) => !KNOWN_DIVERGENCES.has(n))).toEqual([]);
    // A listed divergence that now matches means the list (and docs) are stale.
    expect(different.sort()).toEqual([...KNOWN_DIVERGENCES].sort());
  });

  it("produces the same strings file", () => {
    expect(result.strings).toEqual(JSON.parse(readFileSync(join(golden, "customcq.strings.json"), "utf8")));
  });
});

describe.skipIf(!existsSync(join(sdk, "GodotProject/mods")))("other SDK templates", () => {
  it.each([
    ["rush", "CustomRush/rush_template_4.0.json", []],
    ["breakthrough", "CustomBT/custom_breakthrough_template_V5.0.json", ["OngoingEmplacementSpawner: no modlib condition getter for EmplacementSpawner"]],
  ])("%s emits with only the known gaps", (_n, rel, expected) => {
    const r = emitWorkspace(parseWorkspace(readFileSync(join(sdk, "GodotProject/mods", rel), "utf8")));
    expect(r.diagnostics).toEqual(expected);
  });
});
