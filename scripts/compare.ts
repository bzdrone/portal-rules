// Emit each SDK template, type-check it, and compare with its EA golden output.
//
// Usage: npm run compare -- [case ...]
//   env N=<n>       differences to show per case (default 5)
//   env UNIT=<re>   show only units whose name matches, with full detail
//   env OUT=<dir>   keep the emitted files (<dir>/<case>.ts and .strings.json)
//   env NOTYPES=1   skip the type-check
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { emitWorkspace } from "../src/emit.js";
import { parseWorkspace } from "../src/workspace.js";
// @ts-expect-error plain JS modules shared with the tests
import { cases, isVarDecl, modsPath } from "./cases.mjs";
// @ts-expect-error plain JS
import { units } from "./gdiff.mjs";
// @ts-expect-error plain JS
import { typecheck } from "./typecheck.mjs";

const golden = join(import.meta.dirname, "../golden");
const wanted = process.argv.slice(2);
const limit = Number(process.env.N ?? 5);
const unitFilter = process.env.UNIT ? new RegExp(process.env.UNIT) : undefined;
const outDir = process.env.OUT ?? join(import.meta.dirname, "../tmp");
mkdirSync(outDir, { recursive: true });

let failed = false;
for (const c of cases) {
  if (wanted.length && !wanted.includes(c.name)) continue;
  const { ts, strings, diagnostics } = emitWorkspace(parseWorkspace(readFileSync(join(modsPath(), c.input), "utf8")));
  const base = join(outDir, c.name);
  writeFileSync(`${base}.ts`, ts);
  writeFileSync(`${base}.strings.json`, `${JSON.stringify(strings, null, 2)}\n`);
  console.log(`\n== ${c.name}  (${ts.split("\n").length} lines -> ${base}.ts)`);
  if (diagnostics.length) {
    failed = true;
    console.log(`  diagnostics: ${diagnostics.join("; ")}`);
  }

  if (!process.env.NOTYPES) {
    const errors: string[] = typecheck(`${base}.ts`);
    if (errors.length) failed = true;
    console.log(`  types: ${errors.length ? `${errors.length} errors` : "ok"}`);
    errors.slice(0, limit).forEach((e) => console.log(`    ${e.slice(0, 200)}`));
  }

  if (!c.dir) continue;
  const opts = { maskVars: !!c.maskVars };
  const keep = (m: Map<string, string>) => new Map([...m].filter(([k]) => !(c.maskVars && isVarDecl(k))));
  const ours: Map<string, string> = keep(units(ts, opts));
  const gold: Map<string, string> = keep(units(readFileSync(join(golden, c.dir, `${c.file}.ts`), "utf8"), opts));
  const known = new Set<string>(c.known ?? []);
  const extra = new Set<string>(c.extra ?? []);

  const different = [...gold].filter(([k, v]) => ours.get(k) !== v && (!unitFilter || unitFilter.test(k)));
  const missing = different.filter(([k]) => !ours.has(k)).map(([k]) => k);
  const unexpected = different.filter(([k]) => !known.has(k));
  const stale = [...known].filter((k) => !different.some(([d]) => d === k) && !unitFilter);
  const added = [...ours.keys()].filter((k) => !gold.has(k) && !extra.has(k));
  const strOk = JSON.stringify(strings) === JSON.stringify(JSON.parse(readFileSync(join(golden, c.dir, `${c.file}.strings.json`), "utf8")));

  console.log(`  golden: ${gold.size - different.length}/${gold.size} units match, ${different.length - unexpected.length} known divergences, ${unexpected.length} unexpected; strings ${strOk ? "match" : "DIFFER"}`);
  if (unexpected.length || stale.length || added.length || !strOk) failed = true;
  for (const [k, v] of unexpected.slice(0, unitFilter ? 50 : limit)) {
    const o = ours.get(k) ?? "";
    let i = 0;
    while (i < v.length && o[i] === v[i]) i++;
    console.log(`    DIFF ${k} @${i}${missing.includes(k) ? " (missing)" : ""}\n      gold: ...${v.slice(Math.max(0, i - 40), i + 100)}\n      ours: ...${o.slice(Math.max(0, i - 40), i + 100)}`);
  }
  if (stale.length) console.log(`    stale known divergences (now match; update cases.mjs and docs): ${stale.join(", ")}`);
  if (added.length) console.log(`    extra units not in golden or cases.mjs: ${added.join(", ")}`);
}
process.exit(failed ? 1 : 0);
