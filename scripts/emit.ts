// Usage: tsx scripts/emit.ts <workspace.json> [out-base]   (writes <out-base>.ts and <out-base>.strings.json)
import { readFileSync, writeFileSync } from "node:fs";
import { emitWorkspace } from "../src/emit.js";
import { parseWorkspace } from "../src/workspace.js";
const [inp, base] = process.argv.slice(2);
const r = emitWorkspace(parseWorkspace(readFileSync(inp, "utf8")));
if (base) {
  writeFileSync(`${base}.ts`, r.ts);
  writeFileSync(`${base}.strings.json`, `${JSON.stringify(r.strings, null, 2)}\n`);
}
console.log(r.diagnostics.length ? r.diagnostics.join("\n") : "no diagnostics");
