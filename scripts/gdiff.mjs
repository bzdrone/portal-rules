// Compare two generated .ts files unit by unit (top-level functions/consts), ignoring whitespace outside strings.
// Usage: node scripts/gdiff.mjs ours.ts golden.ts [filterRegex]
import { readFileSync } from "node:fs";
export function norm(s) {
  let out = "", q = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { out += c; if (c === "\\") out += s[++i]; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === "`") { q = c; out += c; continue; }
    if (/\s/.test(c)) continue;
    if (c === ";" ) continue; // trailing semicolons are cosmetic
    out += c;
  }
  // eventInfo plumbing into subroutines is a known, deliberate divergence (see docs/divergences.md).
  if (!process.env.STRICT_EVENTINFO) out = out.replaceAll(",eventInfo)", ")").replaceAll(",eventInfo:any)", ")");
  // Variable indices are arbitrary but unique; EA's order is not derivable from the workspace file.
  out = out.replace(/GlobalVariable\(\d+\)/g, "GlobalVariable(#)").replace(/^(const\w+Var)=\d+$/, "$1=#");
  // EA returns a subroutine's conditions before its body (dead code); we gate the body instead.
  out = out.replace(/^(.*?function\w+\([^)]*\)\{)constnewState=(.*?)returnnewState/, (_, head, x) => `${head}if(!(${x.replaceAll("await", "")})){return}`);
  return out;
}
export function units(src) {
  const map = new Map();
  const re = /^(?:export )?(?:async )?function (\w+)|^const (\w+) =|^\/\/ \w[\w ]* vars/gm;
  const marks = [...src.matchAll(re)].map((m) => ({ name: m[1] ?? m[2] ?? m[0], at: m.index }));
  marks.forEach((m, i) => map.set(m.name, norm(src.slice(m.at, marks[i + 1]?.at ?? src.length))));
  return map;
}
if (process.argv[1].endsWith("gdiff.mjs")) {
  const [a, b, filter] = process.argv.slice(2);
  const ours = units(readFileSync(a, "utf8")), gold = units(readFileSync(b, "utf8"));
  let same = 0; const diffs = [];
  for (const [k, v] of gold) {
    if (filter && !new RegExp(filter).test(k)) continue;
    if (!ours.has(k)) { diffs.push(`MISSING ${k}`); continue; }
    if (ours.get(k) === v) { same++; continue; }
    const o = ours.get(k); let i = 0; while (i < v.length && o[i] === v[i]) i++;
    diffs.push(`DIFF ${k} @${i}\n   gold: ...${v.slice(Math.max(0, i - 40), i + 90)}\n   ours: ...${o.slice(Math.max(0, i - 40), i + 90)}`);
  }
  for (const k of ours.keys()) if (!gold.has(k) && (!filter || new RegExp(filter).test(k))) diffs.push(`EXTRA ${k}`);
  console.log(`same ${same}, different ${diffs.length}`);
  console.log(diffs.slice(0, Number(process.env.N ?? 12)).join("\n"));
}
