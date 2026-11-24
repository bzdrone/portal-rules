import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { decodeAttachment, extractBundle, parseBundle } from "../src/bundle.js";

const golden = join(import.meta.dirname, "../golden");
const bundles = [
  ["conquest", "conquest/customconquest_bundle.json", { MaxPlayerCount_PerTeam: 32, MaxTeamCount: 2 }, "MP_FireStorm_Conquest.spatial.json"],
  ["breakthrough", "breakthrough/custombreakthrough_bundle.json", { MaxPlayerCount_PerTeam: 32, MaxTeamCount: 2 }, "MP_Plaza_Breakthrough.spatial.json"],
  [
    "rush",
    "rush/customrush_bundle.json",
    {
      AI_ManDownExperienceType_PerTeam: 1,
      AiSpawnType: 2,
      FactionID_PerTeam: [
        [0, 607944106],
        [1, -1865993703],
      ],
      MaxPlayerCount_PerTeam: 16,
      ScoreboardType: 3,
    },
    "MP_Plaza_Rush.spatial.json",
  ],
] as const;

describe.each(bundles)("%s bundle", (_name, file, mutators, spatialName) => {
  const bundle = parseBundle(readFileSync(join(golden, file), "utf8"));
  const parts = extractBundle(bundle);

  it("extracts the mutators unchanged", () => {
    expect(parts.mutators).toEqual(mutators);
  });

  it("extracts one spatial map, named as in the bundle", () => {
    expect(parts.spatial.map((s) => s.filename)).toEqual([spatialName]);
    expect(parts.spatial[0].mapIdx).toBe(0);
  });

  it("extracts spatial JSON that re-encodes to the original bytes", () => {
    for (const a of bundle.attachments) {
      expect(Buffer.from(decodeAttachment(a), "utf8").toString("base64")).toBe(a.attachmentData.original);
    }
  });

  it("extracts a well-formed spatial document", () => {
    const spatial = JSON.parse(parts.spatial[0].text);
    expect(Object.keys(spatial).sort()).toEqual(["Portal_Dynamic", "Static"]);
    expect(spatial.Portal_Dynamic.length).toBeGreaterThan(0);
    for (const o of spatial.Portal_Dynamic) {
      expect(typeof o.id).toBe("string");
      expect(typeof o.type).toBe("string");
    }
  });

  it("lists the map rotation by attachment, without the data", () => {
    expect(parts.experience.mapRotation).toHaveLength(bundle.mapRotation.length);
    for (const m of parts.experience.mapRotation) {
      expect(bundle.attachments.some((a) => a.id === m.attachmentId && a.filename === m.filename)).toBe(true);
    }
    expect(JSON.stringify(parts.experience)).not.toContain(bundle.attachments[0].attachmentData.original.slice(0, 40));
  });
});

it("rejects a plain workspace as a bundle", () => {
  expect(() => parseBundle(JSON.stringify({ mod: { blocks: { blocks: [] } } }))).toThrow(/experience bundle/);
});
