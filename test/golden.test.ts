import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { emitWorkspace } from "../src/emit.js";
import { parseWorkspace } from "../src/workspace.js";
// @ts-expect-error plain JS helpers shared with the CLI tools
import { units } from "../scripts/gdiff.mjs";
// @ts-expect-error plain JS
import { cases as allCases, isVarDecl } from "../scripts/cases.mjs";

const sdk = process.env.PORTAL_SDK ?? "C:/PortalSDK";
const mods = join(sdk, "GodotProject/mods");
const golden = join(import.meta.dirname, "../golden");


// golden/ is git-ignored EA material (docs/golden.md): skip when absent.
describe.skipIf(!existsSync(mods) || !existsSync(golden))("EA golden outputs", () => {
  for (const c of allCases.filter((c: { dir?: string }) => c.dir)) {
    describe(c.name, () => {
      const result = emitWorkspace(parseWorkspace(readFileSync(join(mods, c.input), "utf8")));
      const opts = { maskVars: !!c.maskVars };
      const keep = (m: Map<string, string>) => new Map([...m].filter(([k]) => !(c.maskVars && isVarDecl(k))));
      const ours: Map<string, string> = keep(units(result.ts, opts));
      const gold: Map<string, string> = keep(units(readFileSync(join(golden, c.dir, `${c.file}.ts`), "utf8"), opts));

      it("emits without diagnostics", () => {
        expect(result.diagnostics).toEqual([]);
      });

      it("emits the same top-level units (plus known extras)", () => {
        const extra = new Set(c.extra ?? []);
        expect([...ours.keys()].filter((k) => !extra.has(k)).sort()).toEqual([...gold.keys()].sort());
      });

      it("matches every unit except the known divergences", () => {
        const different = [...gold].filter(([name, text]) => ours.get(name) !== text).map(([name]) => name);
        expect(different.filter((n) => !c.known.includes(n))).toEqual([]);
        // A listed divergence that now matches means the list (and docs) are stale.
        expect(different.sort()).toEqual([...c.known].sort());
      });

      it("produces the same strings file", () => {
        expect(result.strings).toEqual(JSON.parse(readFileSync(join(golden, c.dir, `${c.file}.strings.json`), "utf8")));
      });
    });
  }
});
