# Contributing

This page is for people who want to change the converter. If you only want to turn your rules into a script, see
[Export a script](README.md#export-a-script) in the README.

## Setup

- Node.js 22 or newer.
- The Portal SDK, installed separately (it is EA's and is not in this repo). Set `PORTAL_SDK` to its folder
  (default `C:/PortalSDK`). Tested with SDK 2.1.2.0.

```sh
git clone <repo> && cd portal-rules
npm install
npm test
```

Tests that need the SDK, or the local reference files below, skip themselves when those are missing, so `npm test` passes on a
bare clone (with fewer checks run).

## Where things are

- `src/`: the library and CLI (`cli.ts`). Pipeline: `workspace.ts` (parse) -> `emit.ts` (TypeScript) with `strings.ts`;
  `bundle.ts` splits experience bundles; `sdk.ts` reads block and event names from the SDK at run time (`sdk-core.ts` is the browser-safe part).
- `test/`: Vitest tests. `scripts/`: developer tools (compare, survey, extract, typecheck). `docs/`: findings and decisions.
- [AGENTS.md](AGENTS.md) has the full tooling table and working rules (it is also read by coding agents).

## The web site

`web/` is a static page that runs the converter in the browser (no server, nothing uploaded). It is published to GitHub Pages
by `.github/workflows/pages.yml` on every push to `main`.

- `web/app.ts`: the page logic. `web/index.html`, `web/style.css`: markup and styles.
- Browser code must not import Node modules. It uses `src/convert.ts` and `src/sdk-core.ts` (the browser-safe SDK parsing);
  `src/sdk.ts` and `src/cli.ts` are Node only. `tsconfig.web.json` has `types: []`, so a stray Node API fails the build.
- The SDK is EA's and is not bundled. The visitor picks `code/types/mod/index.d.ts` from their own SDK install; the page keeps
  it in the browser's IndexedDB. Do not commit SDK files or add them to the site.

Build and try it locally:

```sh
npm run build:web
```

This writes the site to `site/` (git-ignored): `tsc` compiles the browser code to `site/js/`, and `index.html` and
`style.css` are copied alongside. ES modules do not load from `file://`, so serve the folder over HTTP, for example
`npx http-server site`, then open the address it prints. Pick the SDK's `index.d.ts`, then drop in an experience export
or workspace `.json` and download the `.ts` and `.strings.json`.

To publish from a fork or new repo, set Settings > Pages > Source to "GitHub Actions" once; the workflow does the rest.

## Checking your change

| Command | Does |
|---|---|
| `npm test` | parsing, comparison with EA's output (if you have it locally), type-check of every template |
| `npm run compare -- [case]` | convert each template in `scripts/cases.mjs`, type-check, compare with the reference output |
| `npm run convert -- <file.json>` | the same command exporters use |
| `npm run typecheck:out -- <file.ts>` | type-check a generated script against the SDK typings |
| `npm run survey` | census of block types in a workspace |

Generated scripts must type-check with 0 errors.

## Reference files from EA's exporter (local only)

Comparing our output with EA's own exporter needs files that are EA's and are not committed: they live in a git-ignored
`golden/` folder. [docs/golden.md](docs/golden.md) explains how to create them (a Conquest walkthrough, plus troubleshooting for
an exporter bug that doubles the variables). Without them, those tests skip.

EA's output is a reference, not a specification: it can have bugs. Every difference between our output and theirs is classified
in [docs/divergences.md](docs/divergences.md) as bug-compatible, fixed or unknown. Portal behaviour we rely on is recorded
in [docs/portal-behavior.md](docs/portal-behavior.md).

## Style

TypeScript with `strict` on, ESM (NodeNext). Keep regex-heavy files free of shell-escaped backslashes (write them with an editor).
Scratch files go in the git-ignored `tmp/`.
