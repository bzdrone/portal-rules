import { describe, expect, it } from "vitest";
import { decodeAttachment, extractBundle, parseBundle } from "../src/bundle.js";
import { bundleMaps } from "../src/convert.js";

// Synthetic data only: no EA maps or exports.
const encode = (text: string) => Buffer.from(text, "utf8").toString("base64");
const attachment = (filename: string, attachmentType: number, text: string, mapIdx = 0) => ({
  attachmentData: { compiled: "", original: encode(text) },
  attachmentType,
  errors: [],
  filename,
  id: filename,
  isProcessable: true,
  metadata: `mapIdx=${mapIdx}`,
  processingStatus: 0,
  version: "1",
});
const workspace = { mod: { blocks: { languageVersion: 0, blocks: [] }, variables: [] } };
const bundle = (attachments: unknown[]) =>
  JSON.stringify({ name: "x", description: "", gameMode: "", mutators: {}, teamComposition: [], mapRotation: [], attachments, workspace });

// Not minified, with a BOM and non-ASCII text, to check nothing is reformatted or re-encoded.
const mapText = '﻿{\n  "Portal_Dynamic": [ {"id": "HQ_Team1", "name": "Café"} ],\n  "Static": []\n}\n';

describe("bundle maps", () => {
  it("keeps only spatial attachments (a web builder export also has an empty script and blacklist)", () => {
    const text = bundle([attachment("blank.ts", 2, ""), attachment("start.json", 1, mapText), attachment("blacklist.json", 3, "")]);
    expect(extractBundle(parseBundle(text)).spatial.map((s) => s.filename)).toEqual(["start.json"]);
  });

  it("returns the map text exactly as encoded", () => {
    const b = parseBundle(bundle([attachment("start.json", 1, mapText)]));
    expect(decodeAttachment(b.attachments[0])).toBe(mapText);
    const [map] = bundleMaps(bundle([attachment("start.json", 1, mapText)]));
    expect(Buffer.from(map.text, "utf8").toString("base64")).toBe(b.attachments[0].attachmentData.original);
  });

  it("gives several maps with the same file name distinct names", () => {
    const maps = bundleMaps(bundle([attachment("map.json", 1, "{}", 0), attachment("map.json", 1, "{}", 1)]));
    expect(maps.map((m) => m.filename)).toEqual(["map.json", "map.1.json"]);
  });

  it("offers nothing for a plain workspace", () => {
    expect(bundleMaps(JSON.stringify(workspace))).toEqual([]);
  });
});
