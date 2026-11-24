// The SDK templates we convert, and what we know about their EA golden outputs.
// Shared by test/golden.test.ts and scripts/compare.ts.

/**
 * @typedef {object} Case
 * @property {string} name        short id (customcq, breakthrough, ...)
 * @property {string} input       workspace path relative to <sdk>/GodotProject/mods
 * @property {string} [dir]       golden folder under golden/ (omit when there is no golden yet)
 * @property {string} [file]      golden file base name
 * @property {boolean} [maskVars] golden's variable table is unreliable: ignore variable names and declarations
 * @property {string[]} [known]   units that intentionally differ from EA (explained in docs/divergences.md)
 * @property {string[]} [extra]   units only we emit
 */

/** @type {Case[]} */
export const cases = [
  {
    name: "customcq",
    input: "CustomCQ/conquest_template_14.0.json",
    dir: "conquest",
    file: "customcq",
    known: ["OutOfBounds"], // #1 #3 #4
  },
  {
    name: "breakthrough",
    input: "CustomBT/custom_breakthrough_template_V5.0.json",
    dir: "breakthrough",
    file: "breakthrough",
    maskVars: true, // golden/README.md: this export has a polluted variable table
    known: [
      "OnGameModeStarted_Game_Started_Action", // #12 sort comparator
      "OngoingGlobal_Change_Sector_Action", // #3 negative step
      "OngoingGlobal_Reinforcments_UI_Animation_Action", // #3
      "OOB_Logic", // #3 (+ #1)
      "OngoingEmplacementSpawner", // #11 missing modlib getter
    ],
    extra: ["EmplacementSpawnerConditions", "getEmplacementSpawnerCondition", "SortedModArray"],
  },
  { name: "customrush", input: "CustomRush/rush_template_4.0.json" },
];

export const sdkPath = () => process.env.PORTAL_SDK ?? "C:/PortalSDK";
export const modsPath = () => `${sdkPath()}/GodotProject/mods`;

/** True for units that declare variables (ignored when a golden's variable table is unreliable). */
export const isVarDecl = (name) => name.endsWith("Var") || name.startsWith("//");
