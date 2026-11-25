#!/usr/bin/env node
// Convert a Portal rules workspace (or a full experience bundle) to a TypeScript script and strings file.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { convertText } from "./convert.js";
import { loadSdk, sdkPathFromEnv, useSdk } from "./sdk.js";

const USAGE = `Usage: portal-rules <workspace.json | bundle.json> [--out <folder>] [--sdk <PortalSDK folder>]

Converts the rules in a Portal workspace (the file the web builder's "Export Workspace" saves) or an experience bundle
into a TypeScript script and a strings file:
  <name>.ts            the script
  <name>.strings.json  the strings

--out <folder>   where to write them (default: next to the input file)
--sdk <folder>   the Portal SDK folder (default: PORTAL_SDK environment variable, then C:/PortalSDK).
                 The SDK is only read for the list of block and event names; nothing from it is copied.

Warning: the conversion is not complete. The generated script may be missing, approximate or wrong in places;
be prepared to review it and make manual fixes, and test it in a copy of your experience.
`;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const args = process.argv.slice(2);
const take = (flag: string): string | undefined => {
  const i = args.indexOf(flag);
  if (i < 0) return undefined;
  const value = args[i + 1];
  if (!value || value.startsWith("--")) fail(`${flag} needs a value\n\n${USAGE}`);
  args.splice(i, 2);
  return value;
};

if (args.includes("--help") || args.includes("-h") || args.length === 0) {
  console.log(USAGE);
  process.exit(args.length === 0 ? 1 : 0);
}

const outDir = take("--out");
const sdkPath = take("--sdk") ?? sdkPathFromEnv();
const unknown = args.filter((a) => a.startsWith("--"));
if (unknown.length) fail(`Unknown option ${unknown[0]}\n\n${USAGE}`);
if (args.length !== 1) fail(`Expected one input file\n\n${USAGE}`);
const input = resolve(args[0]);

let text: string;
try {
  text = readFileSync(input, "utf8");
} catch {
  fail(`Cannot read ${input}`);
}

try {
  useSdk(loadSdk(sdkPath));
} catch (e) {
  fail((e as Error).message);
}

let result;
try {
  result = convertText(text);
} catch (e) {
  fail(`${input} is not a Portal workspace or experience bundle: ${(e as Error).message}`);
}
const folder = outDir ? resolve(outDir) : dirname(input);
const base = basename(input, extname(input));
mkdirSync(folder, { recursive: true });
const scriptFile = join(folder, `${base}.ts`);
const stringsFile = join(folder, `${base}.strings.json`);
writeFileSync(scriptFile, result.ts);
writeFileSync(stringsFile, `${JSON.stringify(result.strings, null, 2)}\n`);

console.log(`Wrote ${scriptFile}\n      ${stringsFile}`);
console.warn(
  "\nWarning: the conversion is not complete. The generated script may need manual fixes; " +
    "review it and test it in a copy of your experience before relying on it.",
);
if (result.diagnostics.length) {
  console.warn(`\n${result.diagnostics.length} warning(s) (the script may need attention):`);
  for (const d of result.diagnostics) console.warn(`  ${d}`);
}
