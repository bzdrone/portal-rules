// One call from file text to script + strings; shared by the CLI and the web page.
import { extractBundle, parseBundle } from "./bundle.js";
import { emitWorkspace } from "./emit.js";
import { parseWorkspace } from "./workspace.js";

export type EmitResult = ReturnType<typeof emitWorkspace>;

/** Accepts a bare workspace or an experience bundle (JSON text); needs SDK data set with `useSdk` first. */
export function convertText(text: string): EmitResult {
  const json = JSON.parse(text) as Record<string, unknown>;
  const workspace = json.workspace && !json.mod ? extractBundle(parseBundle(text)).workspace : parseWorkspace(text);
  return emitWorkspace(workspace);
}

/** The maps attached to a bundle, exactly as encoded (byte-exact), with distinct file names. A plain workspace has none. */
export function bundleMaps(text: string): { filename: string; text: string }[] {
  const json = JSON.parse(text) as Record<string, unknown>;
  if (!json.workspace || json.mod) return [];
  const maps = extractBundle(parseBundle(text)).spatial;
  const taken = new Set<string>();
  return maps.map((m, i) => {
    let filename = m.filename;
    if (taken.has(filename)) filename = filename.replace(/(\.[^.]+)?$/, `.${m.mapIdx ?? i}$1`);
    taken.add(filename);
    return { filename, text: m.text };
  });
}
