/** Blockly JSON serialization as written by the Portal rules editor. */
export interface BlockRef {
  block?: Block;
  shadow?: Block;
}

export interface Block {
  type: string;
  id: string;
  x?: number;
  y?: number;
  collapsed?: boolean;
  inline?: boolean;
  deletable?: boolean;
  extraState?: Record<string, unknown>;
  fields?: Record<string, unknown>;
  inputs?: Record<string, BlockRef>;
  next?: BlockRef;
  icons?: unknown;
}

export interface VariableDecl {
  name: string;
  id: string;
  type: string;
}

export interface Workspace {
  mod: {
    blocks: { languageVersion: number; blocks: Block[] };
    variables: VariableDecl[];
  };
}

/**
 * Parses a rules workspace. Accepts either a bare workspace (`{ mod: ... }`, as in the SDK templates) or an
 * experience bundle (`{ name, mutators, mapRotation, workspace: { mod: ... }, ... }`).
 */
export function parseWorkspace(json: string): Workspace {
  let w = JSON.parse(json) as Workspace & { workspace?: Workspace };
  if (!w?.mod && w?.workspace?.mod) w = w.workspace;
  if (!w?.mod?.blocks?.blocks) throw new Error("Not a Portal workspace: missing mod.blocks.blocks");
  w.mod.variables ??= [];
  return w;
}

/** Visit every block (inputs and next chains included), depth first. */
/**
 * A block's inputs in editor order: conditions and objects, then value arguments by number, then statement bodies.
 * The JSON key order is not reliable (experience bundles store keys alphabetically, so a `DO` body precedes its condition).
 */
export function orderedInputs(b: Block): [string, BlockRef][] {
  const rank = (key: string): [number, number] => {
    if (b.type === "If") {
      // VALUE-0, DO, IF1, DO1, IF2, DO2, ..., ELSE
      if (key === "VALUE-0") return [0, 0];
      if (key === "DO") return [0, 1];
      if (key === "ELSE") return [Number.MAX_SAFE_INTEGER, 0];
      const m = /^(IF|DO)(\d+)$/.exec(key);
      if (m) return [Number(m[2]), m[1] === "IF" ? 0 : 1];
    }
    if (key === "CONDITIONS" || key === "CONDITION" || key === "OBJECT") return [0, 0];
    const m = /^(?:VALUE|PARAM)-(\d+)$/.exec(key);
    if (m) return [1, Number(m[1])];
    if (key === "ACTIONS" || key === "DO" || key === "ELSE" || key === "RULES") return [2, 0];
    return [3, 0];
  };
  return Object.entries(b.inputs ?? {}).sort(([a], [c]) => {
    const [a0, a1] = rank(a);
    const [c0, c1] = rank(c);
    return a0 - c0 || a1 - c1;
  });
}

export function walkBlocks(blocks: Block[], visit: (b: Block) => void): void {
  const go = (b: Block | undefined): void => {
    if (!b) return;
    visit(b);
    for (const [, ref] of orderedInputs(b)) go(ref.block ?? ref.shadow);
    go(b.next?.block ?? b.next?.shadow);
  };
  blocks.forEach(go);
}

export function blockTypeCounts(w: Workspace): Map<string, number> {
  const counts = new Map<string, number>();
  walkBlocks(w.mod.blocks.blocks, (b) => counts.set(b.type, (counts.get(b.type) ?? 0) + 1));
  return counts;
}
