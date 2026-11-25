import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { emitWorkspace } from "../src/emit.js";
import { parseWorkspace } from "../src/workspace.js";

const sdk = process.env.PORTAL_SDK ?? "C:/PortalSDK";
const template = join(sdk, "GodotProject/mods/CustomRush/rush_template_4.0.json");
const cli = join(import.meta.dirname, "../src/cli.ts");

const run = (...args: string[]) =>
  spawnSync(process.execPath, ["--import", "tsx", cli, ...args], { encoding: "utf8", env: { ...process.env, PORTAL_SDK: sdk } });

describe("cli", () => {
  it("prints usage and fails without arguments", () => {
    const r = run();
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("Usage: portal-rules");
  });

  it("rejects a file that is not a workspace", () => {
    const r = run(join(import.meta.dirname, "../package.json"));
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/not a Portal workspace|Portal SDK not found/);
  });

  it("explains a missing SDK", () => {
    const r = run(join(import.meta.dirname, "../package.json"), "--sdk", join(import.meta.dirname, "no-such-sdk"));
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("Portal SDK not found");
  });

  describe.skipIf(!existsSync(template))("with the SDK", () => {
    it("writes the same script and strings as the library", () => {
      const scratch = join(import.meta.dirname, "../tmp");
      mkdirSync(scratch, { recursive: true });
      const out = mkdtempSync(join(scratch, "cli-"));
      const r = run(template, "--out", out);
      expect(r.status).toBe(0);
      expect(r.stderr).toContain("conversion is not complete");
      const expected = emitWorkspace(parseWorkspace(readFileSync(template, "utf8")));
      expect(readFileSync(join(out, "rush_template_4.0.ts"), "utf8")).toBe(expected.ts);
      expect(JSON.parse(readFileSync(join(out, "rush_template_4.0.strings.json"), "utf8"))).toEqual(expected.strings);
    }, 30_000);
  });
});
