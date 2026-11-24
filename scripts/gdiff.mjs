// Compare two generated .ts files unit by unit (top-level functions/consts), ignoring whitespace outside strings.
// Usage: node scripts/gdiff.mjs ours.ts golden.ts [filterRegex]
//   env N=<n>          number of diffs to print
//   env MASK_VARS=1    ignore variable names (for exports whose variable table is unreliable, e.g. golden/breakthrough)
//   env STRICT_EVENTINFO=1  do not ignore eventInfo plumbing
import { readFileSync } from "node:fs";

const NAME = "[A-Za-z0-9_]";

export function norm(s, { maskVars = false, strictEventInfo = false } = {}) {
  let out = "", q = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { out += c; if (c === "\\") out += s[++i]; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === "`") { q = c; out += c; continue; }
    if (/\s/.test(c)) continue;
    if (c === ";") continue; // trailing semicolons are cosmetic
    out += c;
  }
  // `{a: a}` and `{a}` are the same object literal (EA writes both forms).
  out = out.replace(/([A-Za-z0-9_]+):\1(?=[,}])/g, "$1");
  // eventInfo plumbing into subroutines is a known, deliberate divergence (docs/divergences.md #2).
  if (!strictEventInfo) out = out.replaceAll(",eventInfo)", ")").replaceAll(",eventInfo:any)", ")");
  // Variable indices are arbitrary but unique; EA's order is not derivable from the workspace file (#8).
  out = out.replace(/GlobalVariable\(\d+\)/g, "GlobalVariable(#)").replace(/^(const\w+Var)=\d+$/, "$1=#");
  // EA returns a subroutine's conditions before its body (dead code); we gate the body instead (#1).
  out = out.replace(/^(.*?function\w+\([^)]*\)\{)constnewState=(.*?)returnnewState/, (_, head, x) => `${head}if(!(${x.replaceAll("await", "")})){return}`);
  if (maskVars) {
    out = out
      .replace(new RegExp(`${NAME}+?(Global|Player|Team|CapturePoint|MCOM|Vehicle)Var(?!${NAME})`, "g"), "VAR$1")
      .replace(new RegExp(`${NAME}+Var(?!${NAME})`, "g"), "LOOPVAR");
  }
  // modlib.And is the variadic form of mod.And (divergence #14).
  out = out.replaceAll("modlib.And(", "mod.And(");
  // Which condition state an event rule gets (edge-triggered per object vs none) is divergence #5; compare the rest of dispatch.
  out = out.replace(/(?:modlib\.)?get[A-Za-z]*Condition\([^():]*\)/g, "COND").replace(/leteventNum=\d+/g, "");
  out = flattenNary(out);
  if (maskVars) out = maskObjectVariableIndex(out);
  return out;
}

/** In ObjectVariable(obj, X), treat a raw index or a masked name as the same thing (unresolved names in golden). */
function maskObjectVariableIndex(s) {
  const key = "ObjectVariable(";
  let res = "", i = 0;
  for (;;) {
    const at = s.indexOf(key, i);
    if (at < 0) return res + s.slice(i);
    res += s.slice(i, at + key.length);
    let depth = 1, j = at + key.length, lastComma = -1;
    for (; j < s.length && depth > 0; j++) {
      if (s[j] === "(") depth++;
      else if (s[j] === ")") depth--;
      else if (s[j] === "," && depth === 1) lastComma = j;
    }
    // [at+key.length, j-1) holds the arguments; lastComma splits obj from the index
    const inner = s.slice(at + key.length, j - 1);
    const rel = lastComma - (at + key.length);
    const idx = inner.slice(rel + 1);
    const masked = /^(\d+|VAR\w+)$/.test(idx) ? inner.slice(0, rel + 1) + "VARX" : inner;
    res += maskObjectVariableIndex(masked) + ")";
    i = j;
  }
}

/** mod.And(mod.And(a,b),c) is the two-argument form of EA's mod.And(a,b,c); flatten so both compare equal. */
function flattenNary(s) {
  for (const fn of ["mod.And(", "mod.Or("]) {
    const head = fn + fn;
    for (let at = s.indexOf(head); at >= 0; at = s.indexOf(head, at + 1)) {
      const innerStart = at + fn.length;
      let depth = 0, j = innerStart + fn.length - 1;
      for (; j < s.length; j++) {
        if (s[j] === "(") depth++;
        else if (s[j] === ")" && --depth === 0) break;
      }
      // j is the end of the inner call (its closing paren), which must be followed by a comma to be the first argument.
      if (s[j + 1] === ",") {
        s = s.slice(0, innerStart) + s.slice(innerStart + fn.length, j) + s.slice(j + 1);
        at = -1; // restart scan for this function
      }
    }
  }
  return s;
}

export function units(src, opts) {
  const map = new Map();
  const re = /^(?:export )?(?:async )?function (\w+)|^const (\w+(?:Var|Conditions))\b[^=\n]* =|^\/\/ \w[\w ]* vars/gm;
  const marks = [...src.matchAll(re)].map((m) => ({ name: m[1] ?? m[2] ?? m[0], at: m.index }));
  marks.forEach((m, i) => map.set(m.name, norm(src.slice(m.at, marks[i + 1]?.at ?? src.length), opts)));
  return map;
}

if (process.argv[1]?.endsWith("gdiff.mjs")) {
  const [a, b, filter] = process.argv.slice(2);
  const opts = { maskVars: !!process.env.MASK_VARS, strictEventInfo: !!process.env.STRICT_EVENTINFO };
  const ours = units(readFileSync(a, "utf8"), opts), gold = units(readFileSync(b, "utf8"), opts);
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
