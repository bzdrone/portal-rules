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
- Most blocks map to a `mod.*` call of the same name; confirm against `C:/PortalSDK/code/types` (`index.d.ts`) and `modlib`.
