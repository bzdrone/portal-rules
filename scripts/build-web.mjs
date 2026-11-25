// Builds the GitHub Pages site into site/: compiles the browser code (tsconfig.web.json) and copies the static files.
import { spawnSync } from "node:child_process";
import { cpSync, rmSync } from "node:fs";

rmSync("site", { recursive: true, force: true });
const tsc = spawnSync(process.execPath, ["node_modules/typescript/bin/tsc", "-p", "tsconfig.web.json"], { stdio: "inherit" });
if (tsc.status !== 0) process.exit(tsc.status ?? 1);
for (const f of ["index.html", "style.css"]) cpSync(`web/${f}`, `site/${f}`);
console.log("Built site/");
