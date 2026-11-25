# portal-rules

Converts Battlefield 6 Portal block-rules workspaces (the Blockly JSON the Portal editor saves) into TypeScript scripts that use
the Portal scripting API (`mod.*` and `modlib`).

Status: early. The converter handles the three official Custom* templates (Conquest, Breakthrough, Rush); its output
type-checks against the SDK typings. Behaviour that is inferred rather than confirmed is tracked in
[docs/portal-behavior.md](docs/portal-behavior.md), and differences from EA's own exporter in
[docs/divergences.md](docs/divergences.md).

This is an unofficial community project. It is not affiliated with or endorsed by Electronic Arts or DICE. Battlefield and
Portal are trademarks of Electronic Arts. This repository contains no EA code, SDK files, templates or exports.

## Requirements

- Node 22+
- The Battlefield 6 Portal SDK, installed separately. Set `PORTAL_SDK` to its folder (default `C:/PortalSDK`). Tested with
  SDK 2.1.2.0.

## Quick start

1. Install Node 22+ and the Portal SDK. Tell the tool where the SDK is (default `C:/PortalSDK`):

   ```sh
   # PowerShell
   $env:PORTAL_SDK = "D:/path/to/PortalSDK"
   # macOS / Linux / Git Bash
   export PORTAL_SDK=/path/to/PortalSDK
   ```

2. Clone and install:

   ```sh
   git clone <this repo> && cd portal-rules
   npm install
   ```

3. Convert a rules workspace (the first run also extracts API names from the SDK typings into the git-ignored
   `src/generated/sdk.ts`):

   ```sh
   npm run emit -- "$PORTAL_SDK/GodotProject/mods/CustomRush/rush_template_4.0.json" out/rush
   ```

   This writes `out/rush.ts` (the script) and `out/rush.strings.json`. Use `$env:PORTAL_SDK` in PowerShell.

4. Check the result compiles against the SDK typings:

   ```sh
   npm run typecheck:out -- out/rush.ts
   ```

Input must be a bare workspace (`{ "mod": { "blocks": ... } }`). For a full experience export (bundle), split it first with
`npm run extract -- <bundle.json> <out-dir>` and convert the `workspace.json` it writes.

`npm test` runs the tests; checks that need the SDK or the local golden files skip when those are absent. There is no
published package or standalone CLI yet; everything runs through the npm scripts.

## Development

See [AGENTS.md](AGENTS.md) for the project layout and tooling, and [docs/golden.md](docs/golden.md) for how to recreate the
git-ignored reference files (`golden/`, `src/generated/`) used for comparison against EA's exporter.

## License

[MIT](LICENSE). This covers this repository only, not the Portal SDK or any EA content you use with it.
