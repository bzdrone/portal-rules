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
