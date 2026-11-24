// Census of block types across Portal workspaces: how often each occurs and which inputs, fields and extraState keys it uses.
// Usage: node scripts/survey.mjs [--all] [workspace.json ...]   (default: the SDK templates in scripts/cases.mjs)
//   --all   list every block type, not only those with fields/extraState/next/special inputs
import { readFileSync } from "node:fs";
import { cases, modsPath } from "./cases.mjs";

const args = process.argv.slice(2);
const all = args.includes("--all");
const files = args.filter((a) => !a.startsWith("--"));
const paths = files.length ? files : cases.map((c) => `${modsPath()}/${c.input}`);

const shapes = new Map();
for (const p of paths) {
  const ws = JSON.parse(readFileSync(p, "utf8"));
  (function visit(o) {
    if (Array.isArray(o)) return o.forEach(visit);
    if (!o || typeof o !== "object") return;
    if (typeof o.type === "string" && o.id) {
      const s = shapes.get(o.type) ?? { n: 0, inputs: new Set(), fields: new Set(), extra: new Set(), next: 0 };
      shapes.set(o.type, s);
      s.n++;
      for (const k of Object.keys(o.inputs ?? {})) s.inputs.add(k.replace(/\d+/, "n"));
      for (const k of Object.keys(o.fields ?? {})) s.fields.add(k);
      for (const k of Object.keys(o.extraState ?? {})) s.extra.add(k);
      if (o.next) s.next++;
    }
    Object.values(o).forEach(visit);
  })(ws);
}

const rows = [...shapes].map(([type, s]) => ({ type, n: s.n, inputs: [...s.inputs].sort().join(","), fields: [...s.fields].join(","), extra: [...s.extra].join(","), next: s.next > 0 }));
const plain = (r) => /^(VALUE-n)?$/.test(r.inputs) && !r.fields && !r.extra && !r.next;
const shown = all ? rows : rows.filter((r) => !plain(r));
console.log(`${rows.length} block types in ${paths.length} workspaces; ${rows.filter(plain).length} are plain expressions (VALUE-n inputs only)`);
console.log("type | count | inputs | fields | extraState | statement");
for (const r of shown.sort((a, b) => b.n - a.n)) console.log(`${r.type} | ${r.n} | ${r.inputs} | ${r.fields} | ${r.extra} | ${r.next ? "yes" : ""}`);
