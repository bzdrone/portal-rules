// Names the converter needs from the Portal SDK typings (events, `mod.*` functions and enums), read at run time.
// The SDK is not vendored (it is EA's); point PORTAL_SDK at an install, or pass a path to loadSdk.
import { existsSync, readFileSync } from "node:fs";

export interface EventParam {
  name: string;
  type: string;
}

export interface SdkData {
  version: string;
  /** Event handler signatures (name -> params). */
  events: Record<string, EventParam[]>;
  /** Names of `mod.*` functions. */
  functions: ReadonlySet<string>;
  /** Names of `mod.*` enums. */
  enums: ReadonlySet<string>;
}

export const DEFAULT_SDK_PATH = "C:/PortalSDK";

export const sdkPathFromEnv = (): string => process.env.PORTAL_SDK ?? DEFAULT_SDK_PATH;

export function parseSdkTypings(src: string, version: string): SdkData {
  const functions = new Set<string>();
  const enums = new Set<string>();
  for (const m of src.matchAll(/^ {4}export function (\w+)\(/gm)) functions.add(m[1]);
  for (const m of src.matchAll(/^ {4}export enum (\w+)/gm)) enums.add(m[1]);

  // namespace EventHandlerSignatures { export function OnX(a: mod.T, ...): void; }
  const events: Record<string, EventParam[]> = {};
  const ns = src.slice(src.indexOf("namespace EventHandlerSignatures"));
  for (const m of ns.matchAll(/export function (On\w+|Ongoing\w+)\(([^)]*)\)\s*:\s*void/g)) {
    events[m[1]] = m[2]
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => {
        const [name, type] = p.split(":").map((s) => s.trim());
        return { name, type: type.replace(/^mod\./, "") };
      });
  }
  return { version, events, functions, enums };
}

/** Reads `<sdk>/code/types/mod/index.d.ts` and `<sdk>/sdk.version.json`. Throws a readable error when the SDK is missing. */
export function loadSdk(sdkPath: string): SdkData {
  const typings = `${sdkPath}/code/types/mod/index.d.ts`;
  if (!existsSync(typings)) {
    throw new Error(
      `Portal SDK not found at ${sdkPath} (looked for code/types/mod/index.d.ts).\n` +
        "Install the Portal SDK and pass its folder with --sdk <folder> or the PORTAL_SDK environment variable.",
    );
  }
  const versionFile = `${sdkPath}/sdk.version.json`;
  const version = existsSync(versionFile) ? String(JSON.parse(readFileSync(versionFile, "utf8")).version) : "unknown";
  return parseSdkTypings(readFileSync(typings, "utf8"), version);
}

let current: SdkData | undefined;

/** Use this SDK data for later conversions (the CLI sets it from --sdk). */
export function useSdk(data: SdkData): void {
  current = data;
}

/** The SDK data in use: the one set with `useSdk`, otherwise loaded once from PORTAL_SDK (default C:/PortalSDK). */
export function getSdk(): SdkData {
  current ??= loadSdk(sdkPathFromEnv());
  return current;
}
