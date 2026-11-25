# Portal behaviour we rely on

What the converter (and any simulator running its output) assumes about how Portal runs rules, and how well each point is supported. Kept apart from `divergences.md`, which lists where our output differs from EA's exporter.

**Evidence basis.** The three SDK Custom* experiences (Conquest, Breakthrough, Rush) worked as blocks in the real game. How their authors use blocks therefore shows what the blocks do. EA's TypeScript exporter working or not says nothing about the blocks. Nothing here was measured in game by this project.

Status: **inferred** (a working template depends on it), **interpreted** (read from SDK text, not shown by a template), **assumed** (a choice made to proceed), **open** (undecided).

## Rules

| Behaviour | Status | Evidence |
|---|---|---|
| Event rules run on every event whose conditions hold. Only Ongoing rules are edge triggered ("when the condition becomes true"), per object. | inferred | `OnPlayerDeployed: Add Equipment` has no conditions and must re-equip on every respawn; kill rules must score every kill. |
| Ongoing rules are evaluated at least once before `OnGameModeStarted`. | inferred | Conquest sets `TimeLimit` in an Ongoing rule (`Initialise`) and reads it in `OnGameModeStarted`. Run the other way round in the simulator, the match ends after 7 s. |
| A subroutine's conditions guard it: when false, the logic does not run. Evaluated on every call, not edge triggered. | assumed (consistent with use) | Used as per-call guards and re-entry flags (`NearEndMusic`, `OutOfBounds`, `AI_Scouting`). Not confirmed in the editor. |
| `ForVariable` with a negative step counts down. | inferred | Countdowns `10 to 0 by -1`, `25 to 0`, `400 to 0 by -40`, `48 to 32 by -2` all exist and run. |
| `ForVariable` upper bound is exclusive for `to CountOf(array)`. | inferred | Array indexing; used 25 times across the templates. |
| `ForVariable` bound for other literals (exclusive or inclusive). | open | Round-number ends (`48 to 32`, `10 to 100`) suggest inclusive; `CountOf` suggests exclusive. The loop bodies were not examined. |
| `Wait` inside a called subroutine: does the caller wait for it. | open | The templates were not examined for a caller that depends on it. EA does not await. |
| `mod.And` and `mod.Or` take two arguments in the SDK types; `modlib.And` is variadic, `modlib` has no variadic `Or`. | inferred from SDK | `types/mod/index.d.ts`, `modlib/index.ts`. |

## Game objects

| Behaviour | Status | Evidence |
|---|---|---|
| A variable that was never set reads as 0. | assumed | The templates initialise every variable they read. |
| AI soldiers stay in the game and redeploy after death unless the spawner was told `AISetUnspawnOnDead(spawner, true)`; `SetUnspawnDelayInSeconds` is the delay before unspawning in that case. | interpreted | SDK: the option decides whether AI "will leave the game after they are killed". Conquest sets a 300 s unspawn delay and never calls `AISetUnspawnOnDead`. |
| Capture: a single team on a point neutralizes the owner, then captures; contested points do not change; players capture faster in numbers up to the point's maximum multiplier. | assumed | Default capture and neutralization times (10 s) and maximum multiplier (1) are guesses; the templates set all three. |
| `mod.GetCurrentOwnerTeam` is the owning team. | interpreted | The SDK text calls it "the team currently capturing"; the Conquest rules use it as the owner. |
| Team tickets in Conquest are drawn by the game's native HUD (`mod.SetHUDTicker`), not by the script. | inferred | The script builds only a timer, a credit line and an out-of-bounds warning, but sets the scores with `SetGameModeScore`. |

## Maps

- Spatial objects carry `ObjId`, `position` and `type`; links to other objects are property names listed in `linked`, resolved by `id`. `PolygonVolume` entries are areas referenced by capture points (`CaptureArea`), sectors and the combat area.
- In the Conquest map the four HQs lie 300 m or more outside the combat area, and each capture point lists infantry spawn points per team (`InfantrySpawnPoints_Team1/2`).
- The spatial maps in the experience bundles differ from the SDK's copies of the same maps. The bundle's workspace is byte-for-byte different from the SDK template but converts to identical TypeScript.

## Web builder

- The web builder appears to run a profanity filter on text when an experience is saved. In an experience export of the Conquest template (made 2026-11-25), the one-letter text `"F"` (a flag letter in `ObjectiveLetters`) came back as `"#"`, while the SDK template has `"F"`. Hash marks in exported text are usually the filter's masking. Status: **interpreted** (the explanation comes from the user, not from EA documentation). The converter copies text as it finds it, so the `#` ends up in the generated script; fix such text in the editor (or the exported file) before converting.
