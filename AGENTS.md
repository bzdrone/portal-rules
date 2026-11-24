# portal-rules

Converts BF6 Portal block rules logic into TypeScript. Private project.

- Node 22, TypeScript (strict, ESM/NodeNext), Vitest.
- Layout: `src/` library + CLI, `test/` tests, `samples/` example Portal inputs.
- Planned pipeline: parse Portal rules -> typed IR -> TypeScript emitter.
- Open decisions: input format, whether output targets the Portal scripting API.
