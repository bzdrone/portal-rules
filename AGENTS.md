# portal-rules

Converts BF6 Portal block rules logic into TypeScript. Private project.

- Node 22, TypeScript (strict, ESM/NodeNext), Vitest.
- Layout: `src/` library + CLI, `test/` tests, `samples/` example Portal inputs.
- Planned pipeline: parse Portal rules -> typed IR -> TypeScript emitter.
- Open decisions: input format, whether output targets the Portal scripting API.

## Sample inputs

The Portal SDK is not vendored; reference it by path (machine-local, may differ elsewhere). Leave it unchanged.

- SDK: `C:/PortalSDK`, version 2.1.2.0 (`sdk.version.json`).
- Blockly rules sample: `C:/PortalSDK/GodotProject/mods/HybridExample/HybridExample.workspace.json` (paired hand-written `HybridExample.ts`).
- Format: `{ mod: { blocks: { blocks: [modBlock] }, variables } }`; `modBlock.RULES` -> chain of `ruleBlock` (`NAME`, `EVENTTYPE`, `OBJECTTYPE` fields, `ACTIONS` input) linked by `next`.
- Tests should read the SDK path from an env var (e.g. `PORTAL_SDK`, default `C:/PortalSDK`) and skip if absent.

### Main corpus: Custom* mode templates

Real rule sets, the primary test inputs (same `{ mod: { blocks, variables } }` format as the sample, much richer):

- `C:/PortalSDK/GodotProject/mods/CustomBT/custom_breakthrough_template_V5.0.json` (191 block types, 104 variables)
- `C:/PortalSDK/GodotProject/mods/CustomCQ/conquest_template_14.0.json` (189 types, 95 variables)
- `C:/PortalSDK/GodotProject/mods/CustomRush/rush_template_4.0.json` (140 types, 76 variables)
- Their `*_skel.json` files are experience configs (mutators, mapRotation, teamComposition, gameMode, attachments, empty `workspace`), not rules. Ignore for the parser; maybe model later.
- README.txt in each folder has authoring notes (ObjId conventions etc).

Format facts (from the templates, ~215 distinct block types in total):

- Top level `mod.blocks.blocks` is a flat list of top-level blocks: `modBlock` (rules chain via `RULES`/`next`), many `subroutineBlock`s (`extraState.subroutineName`, `parameters`, `ACTIONS` input), plus loose `Text`/`Message`/`GetVariable` blocks (stray comment-like blocks).
- `ruleBlock`: `fields.NAME/EVENTTYPE/OBJECTTYPE`; `OBJECTTYPE` is only present for Ongoing rules. Events seen: Ongoing, OnGameModeStarted, OnPlayerEarnedKill(Assist), OnRevived, OnPlayerDied/Deployed/JoinGame/Undeploy, OnCapturePointCaptured/Lost, OnPlayerEnter/ExitCapturePoint, OnPlayerInteract, OnPlayerEnter/ExitAreaTrigger, OnSpawnerSpawned, OnPlayerDamaged, OnPlayerEnter/ExitVehicle, OnAIMoveToFailed/Succeeded.
- Conditions: chain of `conditionBlock` (`inputs.CONDITION`, linked by `next`), AND-ed.
- Statements chain via `next`; expressions nest via `inputs.VALUE-n`; statement bodies via `DO` (`If`, `ForVariable` with VALUE-0 var, 1 from, 2 to, 3 step).
- Variables: `variableReferenceBlock` (`fields.OBJECTTYPE` Global/Team/Player..., `fields.VAR.id` into `mod.variables` [{name,id,type}], `extraState.isObjectVar` + `inputs.OBJECT` for per-object vars). `SetVariable`/`GetVariable` wrap them.
- Subroutines: `subroutineInstanceBlock` (`extraState.subroutineName/parameters`, args in `PARAM-n`), `subroutineArgumentBlock` (`ARGUMENT_INDEX`).
- Event context blocks: `EventPlayer`, `EventOtherPlayer`, `EventCapturePoint`, `EventAreaTrigger`. Enum-ish blocks end in `Item` (`UIAnchorItem`, `MusicEventsItem` with `VALUE-0`/`VALUE-1` fields). `Boolean` uses `fields.BOOL: "TRUE"`.
- Other block keys: `x`,`y`,`deletable`,`inline`,`collapsed`,`icons` (comments), `name`. Rule-level `Wait` is a statement.
- Most blocks map to a `mod.*` call of the same name; confirm against `C:/PortalSDK/code/types/mod/index.d.ts` (1.2 MB) and `modlib`.

### Golden output (EA exporter)

`golden/` holds what EA's tool generates from a workspace (see `golden/README.md`). A reference, not a spec: the exporter can have bugs, so matching it is a default, not a goal. Observed in `golden/conquest/customcq.ts` (2399 lines, from conquest_template_14.0.json):

- Header `import * as modlib from 'modlib';`. Each rule becomes `<Event>_<Name>_Condition(eventInfo): boolean` (only if it has conditions; AND-ed via `mod.And`), `<Event>_<Name>_Action(eventInfo)` (`async` when it contains `Wait`, which becomes `await mod.Wait(..)`), and a wrapper `<Event>_<Name>(conditionState, eventInfo)` doing `if (!conditionState.update(newState)) return;`. Ongoing rules are prefixed `OngoingGlobal_`; names have spaces replaced with `_`.
- Dispatch: one `export function <Event>(...)` per event type with an `eventInfo` object of the event's params and a running `eventNum`; calls each rule wrapper with `modlib.getGlobalCondition(n)` / `getPlayerCondition(eventPlayer, n)` / `getCapturePointCondition(cp, n)`. `eventNum` is a global counter per condition kind (Global/Player/CapturePoint), assigned in rule order.
- Subroutines become plain `function Name(params)`; calls are direct calls. Params keep their declared names.
- Variables: `const <Name><Scope>Var = mod.GlobalVariable(n)` (also object variables, under `// global vars`, `// mcom vars`, `// vehicle vars` trailers). Reads are `mod.GetVariable(x)`, writes `mod.SetVariable(x, v)`, per-object `mod.ObjectVariable(obj, VarConst)`.
- Expressions stay as `mod.*` calls (Blockly name -> `mod.Name`); `ForVariable` -> a `for` loop with `iteratorVar` that also copies into the loop variable; FilteredArray/IsTrueForAll etc. use `modlib` with `(currentArrayElement: any) => ...`; enum items -> `mod.Enum.Member`. Text goes through `mod.Message("...")`, with string literals inline; strings.json holds `sN` keys for enum/name strings.
- Formatting is irregular (embedded newlines in arg lists, 1-space indent). Compare after normalising whitespace.

### Golden output policy

- Judge correctness against the intended block semantics (SDK docs, `code/types/mod/index.d.ts`, `modlib`, in-game behaviour), not only the exporter.
- Every difference between our output and golden is classified in `docs/divergences.md` as one of: **bug-compatible** (we copy a quirk on purpose), **fixed** (EA is wrong, we differ), or **unknown** (needs testing or a docs check). No unexplained diffs.
- Suspicious spots to check first: for-loop bounds/step direction vs Blockly semantics, `async` actions fired without `await`, condition-state numbering, `eventInfo` fields, and unqualified calls (e.g. user subroutines shadowing `mod`/`modlib` names).

### Tooling

Reuse these instead of writing throwaway scripts (`tmp/` is gitignored scratch only).

| Command | Does |
|---|---|
| `npm test` | vitest: parsing, golden comparison, type-check of every template |
| `npm run compare -- [case]` | emit each template in `scripts/cases.mjs`, type-check, compare with golden; env `N`, `UNIT=<re>`, `OUT`, `NOTYPES` |
| `npm run emit -- <workspace.json> <out-base>` | convert one workspace to `<out-base>.ts` and `.strings.json` |
| `npm run typecheck:out -- <file.ts>` | type-check generated output against the SDK typings and modlib, with source context |
| `npm run survey -- [--all] [files]` | block-type census: counts, inputs, fields, extraState |
| `npm run gen:sdk` | regenerate `src/generated/sdk.ts` from the SDK |
| `node scripts/gdiff.mjs ours.ts golden.ts [unitRegex]` | low-level unit diff (`MASK_VARS=1`, `N`) |

Add new templates or goldens in `scripts/cases.mjs` (the tests and `compare` both read it). Keep known divergences there in sync with `docs/divergences.md`.

- EA's own exports fail the type-check (22 errors Conquest, 269 Breakthrough); ours must stay at 0.
- Write regex-heavy files with the Write/Edit tools: backslashes in shell heredocs and `node -e` get eaten.
