# Divergences from EA exporter output

Classes: **fixed** (EA output is wrong, we differ), **bug-compatible** (we copy a quirk on purpose),
**unknown** (needs an in-game test or docs check), **harmless** (differs but equivalent).
Reference: `golden/conquest/customcq.ts` (from `conquest_template_14.0.json`). `test/golden.test.ts` enforces the
list of differing units; `scripts/gdiff.mjs ours.ts golden.ts` shows details.

| # | Area | EA output | Ours | Class | Evidence |
|---|---|---|---|---|---|
| 1 | Subroutine with conditions | `const newState = <cond>; return newState;` before the body, so the whole body is dead code. Affects OutOfBounds, DisableOutOfBounds, AI_Scouting, ConquestAssaultWinCheck, NearEndMusic, AI_VehicleDeploy. When async it also puts `await` before every call in the condition. | `if (!(cond)) { return; }` then the body | fixed | golden lines ~166-1900; code after `return` is unreachable |
| 2 | `eventInfo` into subroutines | Callee gets `eventInfo` only if it uses an Event block directly, and callers pass it only when the callee has no other parameters. `PlayerOOBToggleIUI(true)` and `AI_VehicleDeploy(60)` leave `eventInfo` undefined, so `eventInfo.eventPlayer` throws. Callees that only reach events through other subroutines (AI_Scouting) get none. | Needed transitively through calls; always passed as the last argument | fixed | golden `AI_VehicleDeploy(60)` vs `(Distance: number, eventInfo: any)` |
| 3 | `ForVariable` with negative step | `for (i = 10; i < 0; i += -1)`: never runs (OutOfBounds countdown) | `>` comparison when the step is negative (runtime sign test for non-literal steps) | fixed | golden lines 1685, 1700 |
| 4 | `WaitUntil` | `await mod.WaitUntil(1, cond)`: `mod.WaitUntil` is not in the SDK typings | `await modlib.WaitUntil(1, () => cond)` | fixed | `modlib/index.ts` WaitUntil(delay, cond: () => boolean); not in `types/mod/index.d.ts` |
| 5 | Event rules use edge-detecting `ConditionState` | `modlib.getPlayerCondition(...)` returns a state that only fires when the condition goes false then true, so an event rule with no condition (or an always-true one, like kill checks) runs once per player/object. `modlib.getSimpleCondition()` (no edge detection) exists but is never used. | Same as EA for now | unknown (suspected EA bug) | Needs an in-game test: two kills by one player, does the kill rule run twice? |
| 6 | Calls to async subroutines | Not awaited, so the caller continues before the callee's `Wait` finishes | Same as EA | unknown | Check rules-editor semantics of Wait inside a called subroutine |
| 7 | `ForVariable` upper bound | `i < to` (exclusive) | Same as EA | unknown | Check editor semantics ("from 0 to 10": does 10 run?) |
| 8 | Variable indices | Order differs from the workspace's `variables` array | Declaration order per scope | harmless | indices only need to be unique per scope |
| 9 | `ArrayContains`, `RemoveFromArray` | `modlib.IsTrueForAny` / `modlib.FilteredArray` with an Equals/NotEqualTo lambda | Same | n/a (matches) | golden PlayerUISetup |
| 10 | `IndexOfArrayValue` | not in the Conquest export | Inferred `modlib.IndexOfFirstTrue(arr, e => mod.Equals(e, x))` | unknown | Need the Breakthrough export |
| 11 | `OngoingEmplacementSpawner` | not in the Conquest export; modlib has no condition getter for EmplacementSpawner | Diagnostic, rule skipped | unknown | Need the Breakthrough export |
