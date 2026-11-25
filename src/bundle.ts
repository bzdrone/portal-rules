import type { Workspace } from "./workspace.js";

/** `attachmentType` of a spatial map. Web builder exports also carry an (empty) script (2) and blacklist (3). */
export const SPATIAL_ATTACHMENT = 1;

/** A file attached to an experience, base64 encoded; maps are `attachmentType` 1. */
export interface Attachment {
  attachmentData: { compiled: string; original: string };
  attachmentType: number;
  errors: unknown[];
  filename: string;
  id: string;
  isProcessable: boolean;
  /** e.g. `mapIdx=0`: which map in the rotation this belongs to. */
  metadata: string;
  processingStatus: number;
  version: string;
}

export interface MapRotationEntry {
  id: string;
  spatialAttachment: Attachment;
}

/** The experience export from the Portal editor (`custom*_bundle.json`). */
export interface Bundle {
  name: string;
  description: string;
  gameMode: string;
  mutators: Record<string, unknown>;
  /** `[teamId, { humanCapacity, aiCapacity, aiType }]` pairs. */
  teamComposition: unknown[];
  assetRestrictions?: Record<string, unknown>;
  mapRotation: MapRotationEntry[];
  attachments: Attachment[];
  workspace: Workspace;
}

export function parseBundle(json: string): Bundle {
  const b = JSON.parse(json) as Bundle;
  if (!b?.workspace?.mod || !Array.isArray(b.attachments) || !b.mutators) {
    throw new Error("Not a Portal experience bundle: expected workspace, mutators and attachments");
  }
  return b;
}

/** Decodes an attachment's payload exactly as stored (UTF-8 text; for spatial maps, a JSON document). */
export function decodeAttachment(a: Attachment): string {
  const bytes = Uint8Array.from(atob(a.attachmentData.original), (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes); // keep a BOM so the text re-encodes byte-exact
}

export interface ExtractedBundle {
  /** The rules workspace, the input of the blocks-to-TypeScript conversion (`emitWorkspace`). */
  workspace: Workspace;
  /** One file per spatial map, named as in the bundle (e.g. `MP_Plaza_Rush.spatial.json`), contents exactly as encoded. */
  spatial: { filename: string; text: string; mapIdx: number | undefined }[];
  /** The `mutators` object, unchanged. */
  mutators: Record<string, unknown>;
  /** Everything else about the experience; the maps are listed by attachment id and filename, without their data. */
  experience: {
    name: string;
    description: string;
    gameMode: string;
    teamComposition: unknown[];
    assetRestrictions?: Record<string, unknown>;
    mapRotation: { id: string; attachmentId: string; filename: string }[];
  };
}

export function extractBundle(b: Bundle): ExtractedBundle {
  const mapIdx = (a: Attachment) => {
    const m = /mapIdx=(\d+)/.exec(a.metadata);
    return m ? Number(m[1]) : undefined;
  };
  const experience: ExtractedBundle["experience"] = {
    name: b.name,
    description: b.description,
    gameMode: b.gameMode,
    teamComposition: b.teamComposition,
    mapRotation: b.mapRotation.map((m) => ({ id: m.id, attachmentId: m.spatialAttachment.id, filename: m.spatialAttachment.filename })),
  };
  if (b.assetRestrictions) experience.assetRestrictions = b.assetRestrictions;
  return {
    workspace: b.workspace,
    spatial: b.attachments.filter((a) => a.attachmentType === SPATIAL_ATTACHMENT).map((a) => ({ filename: a.filename, text: decodeAttachment(a), mapIdx: mapIdx(a) })),
    mutators: b.mutators,
    experience,
  };
}
