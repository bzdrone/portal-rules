// Names the converter needs from the Portal SDK typings (events, `mod.*` functions and enums), read at run time.
// The SDK is not included in this repo (it is EA's); point PORTAL_SDK at an install, or pass a path to loadSdk.

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

let current: SdkData | undefined;
let fallback: (() => SdkData) | undefined;

/** Registers how to load SDK data on first use when none was set (the Node entry point reads PORTAL_SDK). */
export function setSdkFallback(load: () => SdkData): void {
  fallback = load;
}

/** Use this SDK data for later conversions (the CLI sets it from --sdk). */
export function useSdk(data: SdkData): void {
  current = data;
}

/** The SDK data in use: the one set with `useSdk`, otherwise loaded once from PORTAL_SDK (default C:/PortalSDK). */
export function getSdk(): SdkData {
  current ??= fallback?.();
  if (!current) throw new Error("No Portal SDK data loaded: call useSdk() first.");
  return current;
}
