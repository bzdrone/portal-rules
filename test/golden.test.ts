import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { emitWorkspace } from "../src/emit.js";
import { parseWorkspace } from "../src/workspace.js";
// @ts-expect-error plain JS helper shared with the CLI diff tool
import { units } from "../scripts/gdiff.mjs";

const sdk = process.env.PORTAL_SDK ?? "C:/PortalSDK";
const mods = join(sdk, "GodotProject/mods");
const golden = join(import.meta.dirname, "../golden");

interface Case {
  name: string;
  input: string;
  dir: string;
  file: string;
  /** Golden's variable table is unreliable: ignore variable names and declarations. */
  maskVars?: boolean;
  /** Units that intentionally differ from EA's output; each is explained in docs/divergences.md. */
  known: string[];
  /** Units only we emit (not present in the golden file). */
  extra?: string[];
}

const cases: Case[] = [
  {
    name: "customcq",
    input: "CustomCQ/conquest_template_14.0.json",
    dir: "conquest",
    file: "customcq",
    known: ["OutOfBounds"], // #1 #3 #4
  },
  {
    name: "custombt",
    input: "CustomBT/custom_breakthrough_template_V5.0.json",
    dir: "custombt",
    file: "custombt",
    maskVars: true, // golden/README.md: this export has a polluted variable table
    known: [
      "OnGameModeStarted_Game_Started_Action", // #12 sort comparator
      "OngoingGlobal_Change_Sector_Action", // #3 negative step
      "OngoingGlobal_Reinforcments_UI_Animation_Action", // #3
      "OOB_Logic", // #3 (+ #1)
      "OngoingEmplacementSpawner", // #11 missing modlib getter
    ],
    extra: ["EmplacementSpawnerConditions", "getEmplacementSpawnerCondition"],
  },
];

const isVarDecl = (name: string) => name.endsWith("Var") || name.startsWith("//");

describe.skipIf(!existsSync(mods))("EA golden outputs", () => {
  for (const c of cases) {
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

  it("emits the Rush template without diagnostics", () => {
    const r = emitWorkspace(parseWorkspace(readFileSync(join(mods, "CustomRush/rush_template_4.0.json"), "utf8")));
    expect(r.diagnostics).toEqual([]);
  });
});
