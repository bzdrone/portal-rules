import { type Workspace, walkBlocks } from "./workspace.js";

/**
 * Builds the `.strings.json` table: unique strings in workspace traversal order, keyed `s0`, `s1`...
 * Collected from Text blocks, enum item fields and subroutine call names inside the mod block and
 * subroutine definitions (stray top-level blocks are ignored). Matches EA's exporter on the Conquest template.
 */
export function emitStrings(ws: Workspace): Record<string, string> {
  const seen = new Set<string>();
  const add = (s: unknown) => {
    if (typeof s === "string") seen.add(s);
  };
  const roots = ws.mod.blocks.blocks.filter((b) => b.type === "modBlock" || b.type === "subroutineBlock");
  walkBlocks(roots, (b) => {
    if (b.type === "Text") add(b.fields?.TEXT);
    else if (b.type === "subroutineInstanceBlock") add(b.fields?.SUBROUTINE_NAME);
    else if (/Item$/.test(b.type) && b.fields && "VALUE-0" in b.fields) {
      add(b.fields["VALUE-0"]);
      add(b.fields["VALUE-1"]);
    }
  });
  return Object.fromEntries([...seen].map((s, i) => [`s${i}`, s]));
}
