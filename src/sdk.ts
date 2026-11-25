// Node side of the SDK data: reads the SDK folder from disk. The browser build uses sdk-core.ts only.
import { existsSync, readFileSync } from "node:fs";
import { parseSdkTypings, setSdkFallback, type SdkData } from "./sdk-core.js";

export * from "./sdk-core.js";

export const DEFAULT_SDK_PATH = "C:/PortalSDK";

export const sdkPathFromEnv = (): string => process.env.PORTAL_SDK ?? DEFAULT_SDK_PATH;

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

setSdkFallback(() => loadSdk(sdkPathFromEnv()));
