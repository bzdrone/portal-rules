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

export function parseWorkspace(json: string): Workspace {
  const w = JSON.parse(json) as Workspace;
  if (!w?.mod?.blocks?.blocks) throw new Error("Not a Portal workspace: missing mod.blocks.blocks");
  w.mod.variables ??= [];
  return w;
}

/** Visit every block (inputs and next chains included), depth first. */
export function walkBlocks(blocks: Block[], visit: (b: Block) => void): void {
  const go = (b: Block | undefined): void => {
    if (!b) return;
    visit(b);
    for (const ref of Object.values(b.inputs ?? {})) go(ref.block ?? ref.shadow);
    go(b.next?.block ?? b.next?.shadow);
  };
  blocks.forEach(go);
}

export function blockTypeCounts(w: Workspace): Map<string, number> {
  const counts = new Map<string, number>();
  walkBlocks(w.mod.blocks.blocks, (b) => counts.set(b.type, (counts.get(b.type) ?? 0) + 1));
  return counts;
}
