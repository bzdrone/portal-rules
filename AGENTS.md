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
- Block types seen so far: modBlock, ruleBlock, SetVariable, GetVariable, variableReferenceBlock, JsValue, JsAction, Text, Number, Global. No conditions/events beyond Ongoing and OnGameModeStarted yet.
- Tests should read the SDK path from an env var (e.g. `PORTAL_SDK`, default `C:/PortalSDK`) and skip if absent.
