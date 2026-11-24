// Extract the parts of a Portal experience bundle.
//
// Usage: npm run extract -- <bundle.json> [out-dir] [--name <base>]
//   default out-dir: tmp/<bundle file name>
//
// Without --name: workspace.json (the rules, input of the conversion step), <map>.spatial.json for each attached map
//                 (named as in the bundle), mutators.json, experience.json.
// With --name:    <base>.spatial.json (<base>.<mapIdx>.spatial.json when there are several maps) and <base>.mutators.json only,
//                 the layout used in golden/<mode>/.
// Spatial files are written exactly as encoded in the bundle.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { extractBundle, parseBundle } from "../src/bundle.js";

const argv = process.argv.slice(2);
const nameAt = argv.indexOf("--name");
const base = nameAt >= 0 ? argv[nameAt + 1] : undefined;
const positional = argv.filter((_, i) => i !== nameAt && i !== nameAt + 1 || nameAt < 0);
const [input, outArg] = positional;
if (!input || (nameAt >= 0 && !base)) {
  console.error("usage: extract <bundle.json> [out-dir] [--name <base>]");
  process.exit(2);
}

const bundle = parseBundle(readFileSync(input, "utf8"));
const out = outArg ?? join(import.meta.dirname, "../tmp", basename(input, ".json"));
mkdirSync(out, { recursive: true });
const parts = extractBundle(bundle);
const write = (file: string, text: string) => {
  writeFileSync(join(out, file), text);
  console.log(`${join(out, file)}  (${text.length} chars)`);
};

parts.spatial.forEach((s, i) => {
  const file = base ? (parts.spatial.length === 1 ? `${base}.spatial.json` : `${base}.${s.mapIdx ?? i}.spatial.json`) : s.filename;
  write(file, s.text);
});
write(base ? `${base}.mutators.json` : "mutators.json", `${JSON.stringify(parts.mutators, null, 2)}\n`);
if (!base) {
  write("experience.json", `${JSON.stringify(parts.experience, null, 2)}\n`);
  write("workspace.json", JSON.stringify(parts.workspace));
}
