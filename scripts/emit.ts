// Usage: tsx scripts/emit.ts <workspace.json> [out-base]   (writes <out-base>.ts and <out-base>.strings.json)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { emitWorkspace } from "../src/emit.js";
import { parseWorkspace } from "../src/workspace.js";
const [inp, base] = process.argv.slice(2);
const r = emitWorkspace(parseWorkspace(readFileSync(inp, "utf8")));
if (!base) console.log("(no out-base given: nothing written)");
if (base) {
  mkdirSync(dirname(base), { recursive: true });
  writeFileSync(`${base}.ts`, r.ts);
  writeFileSync(`${base}.strings.json`, `${JSON.stringify(r.strings, null, 2)}\n`);
}
console.log(r.diagnostics.length ? r.diagnostics.join("\n") : "no diagnostics");
