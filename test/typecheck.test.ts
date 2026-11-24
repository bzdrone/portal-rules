import { describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emitWorkspace } from "../src/emit.js";
import { parseWorkspace } from "../src/workspace.js";
// @ts-expect-error plain JS helper shared with the CLI
import { typecheck } from "../scripts/typecheck.mjs";

const sdk = process.env.PORTAL_SDK ?? "C:/PortalSDK";
const mods = join(sdk, "GodotProject/mods");

// The generated scripts must compile against the SDK's mod typings and modlib (EA's own exports do not: see docs/divergences.md).
describe.skipIf(!existsSync(mods))("generated TypeScript compiles against the Portal SDK", () => {
  it.each([
    ["conquest", "CustomCQ/conquest_template_14.0.json"],
    ["breakthrough", "CustomBT/custom_breakthrough_template_V5.0.json"],
    ["rush", "CustomRush/rush_template_4.0.json"],
    ["hybrid", "HybridExample/HybridExample.workspace.json"],
  ])("%s", (name, rel) => {
    const { ts } = emitWorkspace(parseWorkspace(readFileSync(join(mods, rel), "utf8")));
    const file = join(mkdtempSync(join(tmpdir(), "pr-")), `${name}.ts`);
    writeFileSync(file, ts);
    expect(typecheck(file, sdk)).toEqual([]);
  }, 120_000);
});
