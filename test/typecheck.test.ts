import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { emitWorkspace } from "../src/emit.js";
import { parseWorkspace } from "../src/workspace.js";
// @ts-expect-error plain JS helpers shared with the CLI tools
import { typecheck } from "../scripts/typecheck.mjs";
// @ts-expect-error plain JS
import { cases, modsPath } from "../scripts/cases.mjs";

// The generated scripts must compile against the SDK's mod typings and modlib (EA's own exports do not: see docs/divergences.md).
describe.skipIf(!existsSync(modsPath()))("generated TypeScript compiles against the Portal SDK", () => {
  it.each(cases.map((c: { name: string; input: string }) => [c.name, c.input]))("%s", (name: string, input: string) => {
    const { ts, diagnostics } = emitWorkspace(parseWorkspace(readFileSync(join(modsPath(), input), "utf8")));
    expect(diagnostics).toEqual([]);
    const scratch = join(import.meta.dirname, "../tmp");
    mkdirSync(scratch, { recursive: true });
    const file = join(mkdtempSync(join(scratch, "pr-")), `${name}.ts`);
    writeFileSync(file, ts);
    expect(typecheck(file)).toEqual([]);
  }, 120_000);
});
