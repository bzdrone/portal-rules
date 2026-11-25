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

## Usage

```sh
npm install
PORTAL_SDK=/path/to/PortalSDK npm run gen:sdk      # once: extracts API names from the SDK typings (git-ignored output)
npm run emit -- <workspace.json> <out-base>        # writes <out-base>.ts and <out-base>.strings.json
npm run typecheck:out -- <out-base>.ts             # type-check the result against the SDK
```

Experience bundles (full editor exports) are split into workspace, spatial map and mutators with
`npm run extract -- <bundle.json> [out-dir]`; convert the extracted `workspace.json` with `emit`.

`npm test` runs the unit tests; checks that need the SDK or the local golden files skip when those are absent.

## Development

See [AGENTS.md](AGENTS.md) for the project layout and tooling, and [docs/golden.md](docs/golden.md) for how to recreate the
git-ignored reference files (`golden/`, `src/generated/`) used for comparison against EA's exporter.

## License

[MIT](LICENSE). This covers this repository only, not the Portal SDK or any EA content you use with it.
