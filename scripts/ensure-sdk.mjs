// Generates src/generated/sdk.ts if it is missing (it is git-ignored). Used by the pre* npm scripts.
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const out = new URL("../src/generated/sdk.ts", import.meta.url);
if (!existsSync(out)) {
  const sdk = process.env.PORTAL_SDK ?? "C:/PortalSDK";
  if (!existsSync(`${sdk}/code/types/mod/index.d.ts`)) {
    console.error(
      `src/generated/sdk.ts is missing and the Portal SDK was not found at ${sdk}.\n` +
        "Install the Portal SDK and set PORTAL_SDK to its folder (see docs/golden.md).",
    );
    process.exit(1);
  }
  const r = spawnSync(process.execPath, [fileURLToPath(new URL("./gen-sdk.mjs", import.meta.url))], {
    stdio: "inherit",
    env: process.env,
  });
  process.exit(r.status ?? 1);
}
