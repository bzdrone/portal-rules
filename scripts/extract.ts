// Extract the parts of a Portal experience bundle.
// Usage: npm run extract -- <bundle.json> [out-dir]      (default out-dir: tmp/<bundle name>)
// Writes: <map>.spatial.json for each attached map (exactly as encoded), mutators.json, experience.json
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { extractBundle, parseBundle } from "../src/bundle.js";

const [input, outArg] = process.argv.slice(2);
if (!input) {
  console.error("usage: extract <bundle.json> [out-dir]");
  process.exit(2);
}
const bundle = parseBundle(readFileSync(input, "utf8"));
const out = outArg ?? join(import.meta.dirname, "../tmp", basename(input, ".json"));
mkdirSync(out, { recursive: true });

const parts = extractBundle(bundle);
for (const s of parts.spatial) {
  writeFileSync(join(out, s.filename), s.text);
  console.log(`${join(out, s.filename)}  (${s.text.length} chars${s.mapIdx === undefined ? "" : `, map ${s.mapIdx}`})`);
}
writeFileSync(join(out, "mutators.json"), `${JSON.stringify(parts.mutators, null, 2)}\n`);
writeFileSync(join(out, "experience.json"), `${JSON.stringify(parts.experience, null, 2)}\n`);
console.log(`${join(out, "mutators.json")}  (${Object.keys(parts.mutators).length} mutators)`);
console.log(`${join(out, "experience.json")}  (${parts.experience.name}, ${parts.experience.mapRotation.length} map(s))`);
