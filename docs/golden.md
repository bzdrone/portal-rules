# Golden outputs and generated SDK data (local only)

This repo does not contain Electronic Arts' material. Two things are git-ignored and must be recreated on your machine:

- `golden/`: what EA's Portal exporter produced for three templates, plus the experience bundles those exports came from.
- `src/generated/sdk.ts`: event signatures and `mod` function/enum names extracted from the Portal SDK typings.

Without them, the golden comparison and bundle tests skip; the converter itself needs `src/generated/sdk.ts` (see below).
The Portal SDK itself is not vendored either: install it separately and point `PORTAL_SDK` at it (default `C:/PortalSDK`).
Tested against SDK 2.1.2.0 (`sdk.version.json`).

## Recreate `src/generated/sdk.ts`

```sh
PORTAL_SDK=/path/to/PortalSDK npm run gen:sdk
```

It reads `<sdk>/code/types/mod/index.d.ts` and `<sdk>/sdk.version.json`. `npm test`, `npm run build` and `npm run typecheck`
run this automatically when the file is missing.

## Recreate `golden/`

Each template mode needs an experience bundle (from the SDK's Godot editor) and a TypeScript export (from EA's Portal web
builder). Names below are for Conquest; the other modes are in the table.

| Mode | Template folder in `<sdk>/GodotProject/mods` | Workspace file | Golden folder / bundle name |
|---|---|---|---|
| Conquest | `CustomCQ/` | `conquest_template_14.0.json` | `golden/conquest/`, `customconquest_bundle.json` |
| Breakthrough | `CustomBT/` | `custom_breakthrough_template_V5.0.json` | `golden/breakthrough/`, `custombreakthrough_bundle.json` |
| Rush | `CustomRush/` | `rush_template_4.0.json` | `golden/rush/`, `customrush_bundle.json` |

### 1. Export the experience bundle (documented by the SDK)

1. Open `<sdk>/GodotProject` in the Godot editor that ships with the SDK.
2. Use the BFPortal plugin's experience exporter, pick the mode (e.g. Custom Conquest), and export it. The exporter is
   `code/gdplugins/bf_portal/experience_exporter` in the SDK; I have not confirmed the exact button label.
3. It writes `<sdk>/export/<mode>-<timestamp>/<mode>_bundle.json` (the folder is `modExportDir` in the plugin's
   `bf_portal.config.json`). The bundle contains the workspace (the rules), the map rotation and the spatial map.
4. Copy it into the golden folder, e.g. `golden/conquest/customconquest_bundle.json`.

### 2. Export the TypeScript from the Portal web builder (not documented by the SDK)

This is the file the converter is compared against. The SDK only says that the web builder can turn blocks into scripts and
generate a strings file; it does not describe the export steps, so follow the web builder's own UI:

1. Open the Portal web builder (`https://portal.battlefield.com/bf6/`), start a **fresh** session and load only the one
   workspace: import the template's workspace JSON (`<sdk>/GodotProject/mods/<folder>/<workspace file>`) in the block
   editor via its Import button. The template READMEs describe this.
2. Export or download the generated TypeScript script and its strings file.
3. Save them as `golden/<mode>/<mode>.ts` and `golden/<mode>/<mode>.strings.json` (e.g. `golden/conquest/conquest.ts`).

Do one workspace per fresh session. The Breakthrough and Rush exports used so far came from a session that had other workspaces
loaded and have polluted variable tables (duplicate `const` names, raw numeric variable indices). If yours are polluted the
same way, keep `maskVars: true` for that case in `scripts/cases.mjs`; a clean export can drop it.

### 3. Extract the spatial map and mutators from the bundle

```sh
npm run extract -- golden/conquest/customconquest_bundle.json golden/conquest --name conquest
npm run extract -- golden/breakthrough/custombreakthrough_bundle.json golden/breakthrough --name breakthrough
npm run extract -- golden/rush/customrush_bundle.json golden/rush --name rush
```

This writes `<mode>.spatial.json` (byte-exact) and `<mode>.mutators.json` next to each bundle. The maps are
`MP_FireStorm` (Conquest) and `MP_Plaza` (Breakthrough, Rush).

### 4. Check it

```sh
npm test
npm run compare
```

`compare` prints, per mode, how many units match the golden and which differ. Your exports may come from a different
SDK or editor version than the ones this project was developed against, so some differences may be new: classify them in
`docs/divergences.md` and adjust the `known` lists in `scripts/cases.mjs`. Expected folder layout when done:

```
golden/conquest/{customconquest_bundle.json, conquest.ts, conquest.strings.json, conquest.spatial.json, conquest.mutators.json}
golden/breakthrough/{custombreakthrough_bundle.json, breakthrough.*}
golden/rush/{customrush_bundle.json, rush.*}
```

Golden files are byte-exact: do not let git or an editor convert line endings (they are ignored by git, so this only matters
if you copy them around).

A golden is a reference, not ground truth: the exporter can have bugs. Small hand-built workspaces that isolate single block
types would make better references than the full templates.
