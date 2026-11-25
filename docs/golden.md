# Golden outputs (local only)

This repo does not contain Electronic Arts' material. The `golden/` folder, holding what EA's Portal exporter produced for the
three templates plus the experience bundles those exports came from, is git-ignored and must be recreated on your machine.
Without it the golden comparison and bundle tests skip. The Portal SDK itself is not included in this repo either: install it separately and
point `PORTAL_SDK` at it (default `C:/PortalSDK`). Tested against SDK 2.1.2.0 (`sdk.version.json`).

## Recreate `golden/` (Conquest walkthrough)

The comparison tests use `golden/conquest/`. This walks through that one case; Breakthrough (`CustomBT/`,
`custom_breakthrough_template_V5.0.json`) and Rush (`CustomRush/`, `rush_template_4.0.json`) work the same way with their own
template (see `scripts/cases.mjs`). You need two things: an experience bundle from the SDK's Godot editor, and the TypeScript
export from EA's Portal web builder. Both come from the Conquest template, `<sdk>/GodotProject/mods/CustomCQ/conquest_template_14.0.json`.

### 1. Export the experience bundle (Godot)

1. Open `<sdk>/GodotProject` in the Godot editor that ships with the SDK.
2. Use the BFPortal plugin's experience exporter, choose Custom Conquest, and export it. (The plugin is
   `code/gdplugins/bf_portal/experience_exporter` in the SDK; the exact button label was not confirmed.)
3. It writes `<sdk>/export/customconquest-<timestamp>/customconquest_bundle.json`. Copy it to
   `golden/conquest/customconquest_bundle.json`.

### 2. Export the TypeScript (Portal web builder)

1. Sign in at `https://portal.battlefield.com/bf6/`. Use a desktop-width window: at narrow widths the Script page says "The
   rules editor is not supported on this screen size."
2. **Create New**, open the **Portal Custom** tab, choose **Default**, press **Start Editing**. (The Official Modes tab, such
   as Conquest, makes a draft with no Rules Editor.) This creates a draft in your account; delete it when you are done. You do
   not need to publish anything.
3. In the left sidebar open **Rules Editor**, then **Blocks**.
4. In the toolbar at the top right of the workspace (left to right: Search, **Export to Script**, **Export Workspace**,
   **Import Workspace**, **Reset Workspace**), click **Import Workspace**. In the dialog choose
   `conquest_template_14.0.json` with the folder button, then **Import**. The template's rules appear (the first is
   "Initialise"). Import once only.
5. Click **Export to Script**. The dialog shows a preview of the script (it starts with `import * as modlib from 'modlib';`)
   named `script-conversion.ts`, and a preview of the strings named `strings-conversion.json`. Press **Export** to save both
   files. (If the script has doubled variables, copy from the preview instead: see Troubleshooting.)
6. Save them as `golden/conquest/conquest.ts` and `golden/conquest/conquest.strings.json`.

Nothing is published and the Script page is not needed. (The Script page is where these files would be imported back into an
experience.)

### 3. Extract the spatial map and mutators

```sh
npm run extract -- golden/conquest/customconquest_bundle.json golden/conquest --name conquest
```

The user-facing version of this step (including the web page) is "Get the map" in the [README](../README.md#get-the-map-optional). This writes `conquest.spatial.json` (byte-exact) and `conquest.mutators.json`. The map is `MP_FireStorm`.

### 4. Check it

```sh
npm test
npm run compare
```

Expected layout: `golden/conquest/{customconquest_bundle.json, conquest.ts, conquest.strings.json, conquest.spatial.json,
conquest.mutators.json}`. Your export may come from a different SDK or editor version than the one this project was developed
against, so some differences may be new: classify them in `docs/divergences.md` and adjust the `known` list in
`scripts/cases.mjs`. Golden files are byte-exact; do not let an editor convert their line endings.

## Troubleshooting

The problems below were observed in the Portal web builder on 2026-11-25 (SDK 2.1.2.0). They look like exporter bugs, so they may
already be fixed when you read this: try the normal Export path first and use the workaround only if you hit them.

**The script declares every variable more than once.** Count the declarations: `grep -c "^const .*Var = " conquest.ts` should
be 95 (the template's variable count). If it is 190 or 390, the export is polluted. What we saw:

- A new draft with the template imported once gives a clean script (95 declarations; the strings file matched the existing
  golden byte for byte) in the **preview** the first time the Export to Script dialog opens.
- The file saved by pressing **Export** had every variable twice (190 declarations, 110,090 bytes), and a second export from
  the same page gave four copies (390, 119,604 bytes). The strings file stayed correct. This happened on two separate new
  drafts.
- The duplicates are stored in the draft. After saving the draft and reopening it, the first preview already had 390.
- With the duplicates, the wrong variable name is used in some places (12 units differ from the golden), so removing the extra
  `const` lines from the `.ts` by hand is not enough.

Workaround, if you hit this: copy the text from the Export to Script dialog instead of pressing **Export**. On a new draft, import the template
once, open **Export to Script** once, and in each of the two preview boxes click, press Ctrl+A then Ctrl+C, and paste into
`golden/conquest/conquest.ts` and `golden/conquest/conquest.strings.json`. Do not reopen the dialog, and do not reuse a draft
that has already been exported or saved (it already holds the duplicates). If you cannot get a clean export at all, set
`maskVars: true` for that case in `scripts/cases.mjs`: the comparison then ignores variable names and declarations.

A golden is a reference, not ground truth: the exporter can have bugs. Small hand-built workspaces that isolate single block
types would make better references than the full templates.
