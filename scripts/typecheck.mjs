// Type-check generated Portal scripts against the SDK typings and modlib.
// CLI: node scripts/typecheck.mjs <file.ts> [more files]   (env PORTAL_SDK, N=<errors to print>)
import { mkdtempSync, copyFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { spawnSync } from "node:child_process";

const tsc = join(import.meta.dirname, "../node_modules/typescript/bin/tsc");

/** Returns tsc's error lines for a generated script ("script.ts(line,col): error TSxxxx: ..."). */
export function typecheck(file, sdkPath = process.env.PORTAL_SDK ?? "C:/PortalSDK") {
  const sdk = sdkPath.replaceAll("\\", "/");
  const dir = mkdtempSync(join(tmpdir(), "portal-check-"));
  try {
    copyFileSync(file, join(dir, "script.ts"));
    writeFileSync(
      join(dir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2020", module: "ESNext", moduleResolution: "Bundler", strict: true, noEmit: true, skipLibCheck: true,
          typeRoots: [`${sdk}/code/types`], types: ["mod"],
          paths: { modlib: [`${sdk}/code/modlib/index.ts`] },
        },
        files: ["script.ts"],
      }),
    );
    const r = spawnSync("node", [tsc, "-p", dir, "--pretty", "false"], { encoding: "utf8" });
    return (r.stdout + r.stderr).split("\n").filter((l) => /error TS\d+/.test(l)).map((l) => l.replace(/^.*?script\.ts/, "script.ts"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (process.argv[1]?.endsWith("typecheck.mjs")) {
  for (const file of process.argv.slice(2)) {
    const lines = typecheck(file);
    const byCode = {};
    for (const l of lines) { const c = /error (TS\d+)/.exec(l)[1]; byCode[c] = (byCode[c] ?? 0) + 1; }
    console.log(`${basename(file)}: ${lines.length} errors ${JSON.stringify(byCode)}`);
    for (const l of lines.slice(0, Number(process.env.N ?? 8))) console.log("  " + l.slice(0, 220));
  }
}
