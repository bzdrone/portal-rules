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

Layout (one folder per case, names as in `scripts/cases.mjs`):

| Folder | Input workspace (under `<sdk>/GodotProject/mods`) | Files |
|---|---|---|
| `golden/conquest/` | `CustomCQ/conquest_template_14.0.json` | `conquest.ts`, `conquest.strings.json`, `customconquest_bundle.json`, `conquest.spatial.json`, `conquest.mutators.json` |
| `golden/breakthrough/` | `CustomBT/custom_breakthrough_template_V5.0.json` | `breakthrough.*`, `custombreakthrough_bundle.json` |
| `golden/rush/` | `CustomRush/rush_template_4.0.json` | `rush.*`, `customrush_bundle.json` |

1. **Exported script and strings** (`<mode>.ts`, `<mode>.strings.json`): load the template workspace in the Portal editor
   (or the SDK's exporter) and export the TypeScript. Save the script and its strings file under the names above.
   Export from a freshly started editor with only that one workspace loaded: earlier exports from a session with several
   workspaces had polluted variable tables (duplicate `const` names, raw numeric variable indices). If your export is
   polluted the same way, set `maskVars: true` for the case in `scripts/cases.mjs`; a clean export needs no masking.
2. **Experience bundle** (`custom*_bundle.json`): export the full experience from the editor (the JSON with `workspace`,
   `mutators`, `teamComposition`, `mapRotation` and `attachments`).
3. **Spatial map and mutators**: extract them from the bundle (byte-exact):

   ```sh
   npm run extract -- golden/<mode>/<bundle>.json golden/<mode> --name <mode>
   ```

   The maps used were `MP_FireStorm` (conquest) and `MP_Plaza` (breakthrough, rush).

Golden files are byte-exact: do not let git or an editor convert line endings (they are ignored by git, so this only matters
if you copy them around).

Then run `npm test` and `npm run compare`. Your exports may differ from the ones this project was developed against (a
different SDK or editor version); differences are classified in `docs/divergences.md`, and the `known` lists in
`scripts/cases.mjs` may need adjusting to match your exports.

A golden is a reference, not ground truth: the exporter can have bugs. Small hand-built workspaces that isolate single block
types would make better references than the full templates.
