import { EVENTS, MOD_ENUMS, MOD_FUNCTIONS } from "./generated/sdk.js";
import { emitStrings } from "./strings.js";
import { type Block, type BlockRef, type Workspace, type VariableDecl, walkBlocks } from "./workspace.js";

export interface EmitResult {
  ts: string;
  /** Contents of the `.strings.json` file. */
  strings: Record<string, string>;
  /** Problems that did not stop emission (unknown block types, missing inputs...). */
  diagnostics: string[];
}

interface SubInfo {
  block: Block;
  name: string;
  params: { name: string; type: string }[];
  isAsync: boolean;
  needsEventInfo: boolean;
}

interface Ctx {
  vars: Map<string, VarInfo>;
  subs: Map<string, SubInfo>;
  /** Subroutine being emitted (for subroutineArgumentBlock). */
  sub?: SubInfo;
  diagnostics: string[];
  /** Local helper functions the emitted code needs (see HELPERS). */
  helpers: Set<string>;
}

interface VarInfo {
  decl: VariableDecl;
  ident: string;
  index: number;
}

/** Condition-state getter in modlib for an event's first parameter type. */
const CONDITION_GETTER: Record<string, string> = {
  Player: "getPlayerCondition",
  Team: "getTeamCondition",
  CapturePoint: "getCapturePointCondition",
  MCOM: "getMCOMCondition",
  Vehicle: "getVehicleCondition",
  HQ: "getHQCondition",
  Sector: "getSectorCondition",
  VehicleSpawner: "getVehicleSpawnerCondition",
};

/** Blocks whose last argument is a condition evaluated per array element. */
const ARRAY_LAMBDA = new Set(["FilteredArray", "IsTrueForAll", "IsTrueForAny"]);

const HELPERS: Record<string, string> = {
  // modlib.SortedArray wants a JS array and returns one; convert from and back to a mod array.
  SortedModArray: [
    "function SortedModArray(array: mod.Array, compare: (a: any, b: any) => number): mod.Array {",
    " const sorted = modlib.SortedArray(modlib.ConvertArray(array), compare);",
    " let result = mod.EmptyArray();",
    " for (let i = 0; i < sorted.length; i++) {",
    "  result = mod.AppendToArray(result, sorted[i]);",
    " }",
    " return result;",
    "}",
    "",
  ].join("\n"),
};

const VAR_SECTIONS = ["Global", "Player", "Team", "CapturePoint", "MCOM", "Vehicle"];

export function ident(name: string): string {
  const s = name.replace(/\W/g, "_");
  return /^\d/.test(s) ? `_${s}` : s;
}

function child(ref: BlockRef | undefined): Block | undefined {
  return ref?.block ?? ref?.shadow;
}

/** The blocks of a next-chain starting at `first`. */
function chain(first: Block | undefined): Block[] {
  const out: Block[] = [];
  for (let b = first; b; b = child(b.next)) out.push(b);
  return out;
}

function valueInputs(b: Block, prefix = "VALUE"): (Block | undefined)[] {
  const keys = Object.keys(b.inputs ?? {})
    .map((k) => new RegExp(`^${prefix}-(\\d+)$`).exec(k))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => Number(m[1]));
  const n = keys.length ? Math.max(...keys) + 1 : 0;
  return Array.from({ length: n }, (_, i) => child(b.inputs?.[`${prefix}-${i}`]));
}

function contains(root: Block[], pred: (b: Block) => boolean): boolean {
  let found = false;
  walkBlocks(root, (b) => {
    if (pred(b)) found = true;
  });
  return found;
}

const isWait = (b: Block) => b.type === "Wait" || b.type === "WaitUntil";
const isEvent = (b: Block) => /^Event[A-Z]/.test(b.type) && !MOD_FUNCTIONS.has(b.type);

// ---------------------------------------------------------------------------
// Expressions and statements
// ---------------------------------------------------------------------------

function args(b: Block, ctx: Ctx, prefix = "VALUE"): string[] {
  return valueInputs(b, prefix).map((v) => {
    if (!v) {
      ctx.diagnostics.push(`${b.type}: empty input`);
      return "undefined";
    }
    return expr(v, ctx);
  });
}

function varRef(b: Block, ctx: Ctx): string {
  const id = (b.fields?.VAR as { id: string } | undefined)?.id;
  const info = id ? ctx.vars.get(id) : undefined;
  if (!info) {
    ctx.diagnostics.push(`variableReferenceBlock: unknown variable ${id}`);
    return "undefined";
  }
  if (!b.extraState?.isObjectVar) return `${info.ident}GlobalVar`;
  const obj = child(b.inputs?.OBJECT);
  const scope = info.decl.type;
  return `mod.ObjectVariable(${obj ? expr(obj, ctx) : "undefined"},${info.ident}${scope}Var)`;
}

export function expr(b: Block, ctx: Ctx): string {
  switch (b.type) {
    case "Number":
      return String(b.fields?.NUM ?? 0);
    case "Text":
      return JSON.stringify(String(b.fields?.TEXT ?? ""));
    case "Boolean":
      return String(b.fields?.BOOL).toUpperCase() === "TRUE" ? "true" : "false";
    case "variableReferenceBlock":
      return varRef(b, ctx);
    case "subroutineArgumentBlock": {
      const p = ctx.sub?.params[Number(b.fields?.ARGUMENT_INDEX)];
      if (!p) ctx.diagnostics.push("subroutineArgumentBlock outside a subroutine or bad index");
      return p?.name ?? "undefined";
    }
    case "CurrentArrayElement":
      return "currentArrayElement";
    case "subroutineInstanceBlock":
      return callSub(b, ctx);
    default:
  }
  if (isEvent(b)) return `eventInfo.${b.type[0].toLowerCase()}${b.type.slice(1)}`;
  const item = /^(\w+)Item$/.exec(b.type);
  if (item && b.fields && "VALUE-0" in b.fields) {
    const group = String(b.fields["VALUE-0"]);
    if (!MOD_ENUMS.has(group)) ctx.diagnostics.push(`${b.type}: unknown enum ${group}`);
    return `mod.${group}.${String(b.fields["VALUE-1"])}`;
  }
  if (ARRAY_LAMBDA.has(b.type)) {
    const [arr, cond] = args(b, ctx);
    return `modlib.${b.type}(${arr},(currentArrayElement: any) => ${cond})`;
  }
  if (b.type === "SortedArray") {
    // EA passes the key expression straight to Array.sort as the comparator, which sorts arbitrarily (divergence 12).
    const [arr, key] = args(b, ctx);
    const k = `((currentArrayElement: any) => ${key})`;
    ctx.helpers.add("SortedModArray");
    return `SortedModArray(${arr},(a: any, b: any) => ${k}(a) - ${k}(b))`;
  }
  if (b.type === "ArrayContains") {
    const [arr, x] = args(b, ctx);
    return `modlib.IsTrueForAny(${arr},(currentArrayElement: any) => mod.Equals(currentArrayElement,${x}))`;
  }
  if (b.type === "IndexOfArrayValue") {
    // Inferred, not seen in an EA export yet (see docs/divergences.md).
    const [arr, x] = args(b, ctx);
    return `modlib.IndexOfFirstTrue(${arr},(currentArrayElement: any) => mod.Equals(currentArrayElement,${x}))`;
  }
  if (b.type === "RemoveFromArray") {
    const [arr, x] = args(b, ctx);
    return `modlib.FilteredArray(${arr},(currentArrayElement: any) => mod.NotEqualTo(currentArrayElement,${x}))`;
  }
  if (!MOD_FUNCTIONS.has(b.type)) ctx.diagnostics.push(`unknown block type ${b.type}`);
  // mod.And / mod.Or take exactly two arguments; EA emits them variadic. modlib.And is variadic, modlib has no Or.
  if (b.type === "And" && valueInputs(b).length > 2) return `modlib.And(${args(b, ctx).join(",")})`;
  if (b.type === "Or" && valueInputs(b).length > 2) return args(b, ctx).reduce((a, c) => `mod.Or(${a},${c})`);
  return `mod.${b.type}(${args(b, ctx).join(",")})`;
}

function callSub(b: Block, ctx: Ctx): string {
  const name = String(b.fields?.SUBROUTINE_NAME ?? (b.extraState?.subroutineName as string));
  const callee = ctx.subs.get(name);
  if (!callee) ctx.diagnostics.push(`call to unknown subroutine ${name}`);
  const a = args(b, ctx, "PARAM");
  if (callee?.needsEventInfo) a.push("eventInfo");
  return `${ident(name)}(${a.join(",")})`;
}

function body(first: Block | undefined, ctx: Ctx, depth: number): string {
  return chain(first)
    .map((s) => stmt(s, ctx, depth))
    .join("");
}

function stmt(b: Block, ctx: Ctx, depth: number): string {
  const pad = " ".repeat(depth);
  switch (b.type) {
    case "If": {
      const extra = b.extraState as { elseif?: number; else?: number | boolean } | undefined;
      const cond = (i: number) => child(b.inputs?.[i === 0 ? "VALUE-0" : `IF${i}`]);
      const act = (i: number) => child(b.inputs?.[i === 0 ? "DO" : `DO${i}`]);
      const c0 = cond(0);
      let out = `${pad}if (${c0 ? expr(c0, ctx) : "undefined"}) {\n${body(act(0), ctx, depth + 1)}${pad}}`;
      for (let i = 1; i <= (extra?.elseif ?? 0); i++) {
        const c = cond(i);
        out += ` else if (${c ? expr(c, ctx) : "undefined"}) {\n${body(act(i), ctx, depth + 1)}${pad}}`;
      }
      if (extra?.else) out += ` else {\n${body(child(b.inputs?.ELSE), ctx, depth + 1)}${pad}}`;
      return `${out}\n`;
    }
    case "While": {
      const [cond] = args(b, ctx);
      return `${pad}while (${cond}) {\n${body(child(b.inputs?.DO), ctx, depth + 1)}${pad}}\n`;
    }
    case "ForVariable": {
      const ref = child(b.inputs?.["VALUE-0"]);
      const [, from, to, step] = args(b, ctx);
      const info = ctx.vars.get((ref?.fields?.VAR as { id: string } | undefined)?.id ?? "");
      const it = `${info?.ident ?? "i"}Var`;
      const stepBlock = child(b.inputs?.["VALUE-3"]);
      const stepNum = stepBlock?.type === "Number" ? Number(stepBlock.fields?.NUM) : undefined;
      // EA's exporter always emits `<`, so downward loops never run. Pick the comparison from the step's sign.
      const test = stepNum === undefined ? `(${step} >= 0 ? ${it} < ${to} : ${it} > ${to})` : stepNum >= 0 ? `${it} < ${to}` : `${it} > ${to}`;
      return (
        `${pad}for (let ${it} = ${from}; ${test}; ${it} += ${step}) {\n` +
        `${pad} mod.SetVariable(${ref ? expr(ref, ctx) : "undefined"}, ${it});\n` +
        `${body(child(b.inputs?.DO), ctx, depth + 1)}${pad}}\n`
      );
    }
    case "Wait":
      return `${pad}await mod.Wait(${args(b, ctx).join(",")})\n`;
    case "WaitUntil": {
      // mod.WaitUntil does not exist; modlib.WaitUntil takes a condition callback.
      const [delay, cond] = args(b, ctx);
      return `${pad}await modlib.WaitUntil(${delay},() => ${cond})\n`;
    }
    case "Break":
      return `${pad}break\n`;
    case "Continue":
      return `${pad}continue\n`;
    default:
      return `${pad}${expr(b, ctx)}\n`;
  }
}

// ---------------------------------------------------------------------------
// Rules, subroutines, dispatch
// ---------------------------------------------------------------------------

function conditionExpr(first: Block | undefined, ctx: Ctx): string | undefined {
  const conds = chain(first).map((c) => {
    const e = child(c.inputs?.CONDITION);
    if (!e) {
      ctx.diagnostics.push("conditionBlock: empty condition");
      return "undefined";
    }
    return expr(e, ctx);
  });
  if (conds.length === 0) return undefined;
  return conds.length === 1 ? conds[0] : conds.length === 2 ? `mod.And(${conds[0]},${conds[1]})` : `modlib.And(${conds.join(",")})`;
}

interface Rule {
  block: Block;
  event: string;
  fn: string;
  params: { name: string; type: string }[];
  kind: "global" | string;
  condNum: number;
}

function ruleList(ws: Workspace): Block[] {
  const rules: Block[] = [];
  for (const top of ws.mod.blocks.blocks) {
    if (top.type !== "modBlock") continue;
    for (const r of chain(child(top.inputs?.RULES))) if (r.type === "ruleBlock") rules.push(r);
  }
  return rules;
}

function subList(ws: Workspace): Block[] {
  return ws.mod.blocks.blocks.filter((b) => b.type === "subroutineBlock");
}

const paramType = (t: string) => (t === "Number" ? "number" : t === "String" ? "string" : t === "Boolean" ? "boolean" : "any");

export function emitWorkspace(ws: Workspace): EmitResult {
  const diagnostics: string[] = [];

  // Variables: stable index per scope, in declaration order.
  const vars = new Map<string, VarInfo>();
  const perScope = new Map<string, number>();
  for (const decl of ws.mod.variables) {
    const index = perScope.get(decl.type) ?? 0;
    perScope.set(decl.type, index + 1);
    vars.set(decl.id, { decl, ident: ident(decl.name), index });
  }

  // Subroutines, with async / eventInfo propagated through calls.
  const subs = new Map<string, SubInfo>();
  for (const block of subList(ws)) {
    const extra = block.extraState as { subroutineName: string; parameters: { types: string; name: string }[] };
    const name = String(block.fields?.SUBROUTINE_NAME ?? extra.subroutineName);
    const roots = [child(block.inputs?.ACTIONS), child(block.inputs?.CONDITIONS)].filter((x): x is Block => !!x);
    subs.set(name, {
      block,
      name,
      params: (extra.parameters ?? []).map((p) => ({ name: ident(p.name), type: paramType(p.types) })),
      isAsync: contains(roots, isWait),
      needsEventInfo: contains(roots, isEvent),
    });
  }
  for (let changed = true; changed; ) {
    changed = false;
    for (const s of subs.values()) {
      if (s.needsEventInfo) continue;
      const roots = [child(s.block.inputs?.ACTIONS), child(s.block.inputs?.CONDITIONS)].filter((x): x is Block => !!x);
      const calls = contains(roots, (b) => b.type === "subroutineInstanceBlock" && !!subs.get(String(b.fields?.SUBROUTINE_NAME))?.needsEventInfo);
      if (calls) {
        s.needsEventInfo = true;
        changed = true;
      }
    }
  }

  const ctx: Ctx = { vars, subs, diagnostics, helpers: new Set() };

  // Rules: name, dispatch grouping and condition-state numbering.
  const seen = new Map<string, number>();
  const counters = new Map<string, number>();
  const groups = new Map<string, Rule[]>();
  const rules: Rule[] = [];
  for (const block of ruleList(ws)) {
    const type = String(block.fields?.EVENTTYPE);
    const event = type === "Ongoing" ? `Ongoing${String(block.fields?.OBJECTTYPE)}` : type;
    const params = EVENTS[event];
    if (!params) {
      diagnostics.push(`unknown event ${event}`);
      continue;
    }
    const kind = params.length === 0 ? "global" : params[0].type;
    const base = `${event}_${String(block.fields?.NAME).replace(/\s+/g, "_")}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    const rule: Rule = { block, event, fn: n === 0 ? base : `${base}${n}`, params, kind, condNum: -1 };
    rules.push(rule);
    if (!groups.has(event)) groups.set(event, []);
    groups.get(event)!.push(rule);
  }
  // Only Ongoing rules are edge triggered ("when the condition becomes true") and need a state slot per object.
  // Event rules run whenever their event fires and their conditions hold. Numbers are assigned in dispatch order
  // (grouped by event, groups in first-appearance order).
  for (const group of groups.values())
    for (const r of group) {
      if (!r.event.startsWith("Ongoing")) continue;
      r.condNum = counters.get(r.kind) ?? 0;
      counters.set(r.kind, r.condNum + 1);
    }

  const out: string[] = ["", "import * as modlib from 'modlib';", ""];

  for (const r of rules) {
    const hasInfo = r.params.length > 0;
    const info = hasInfo ? "eventInfo: any" : "";
    const actions = child(r.block.inputs?.ACTIONS);
    const cond = conditionExpr(child(r.block.inputs?.CONDITIONS), ctx);
    const isAsync = contains(chain(actions), isWait);
    if (cond) out.push(`function ${r.fn}_Condition(${info}): boolean {\n  const newState = ${cond};\n return newState;\n}\n`);
    out.push(`${isAsync ? "async " : ""}function ${r.fn}_Action(${info}) {\n${body(actions, ctx, 1)}}`);
    out.push(
      `function ${r.fn}(conditionState: any${hasInfo ? ", eventInfo: any" : ""}) {\n` +
        `let newState = ${cond ? `${r.fn}_Condition(${hasInfo ? "eventInfo" : ""})` : "true"};\n` +
        `if (!conditionState.update(newState)) {\n return;\n}\n${r.fn}_Action(${hasInfo ? "eventInfo" : ""});\n}\n`,
    );
  }

  for (const s of subs.values()) {
    const sctx: Ctx = { ...ctx, sub: s };
    const params = s.params.map((p) => `${p.name}: ${p.type}`);
    if (s.needsEventInfo) params.push("eventInfo: any");
    const cond = conditionExpr(child(s.block.inputs?.CONDITIONS), sctx);
    // EA's exporter returns the condition unconditionally and drops the body; gate the body instead.
    const gate = cond ? ` if (!(${cond})) {\n  return;\n }\n` : "";
    out.push(`${s.isAsync ? "async " : ""}function ${ident(s.name)}(${params.join(", ")}) {\n${gate}${body(child(s.block.inputs?.ACTIONS), sctx, 1)}}`);
  }

  // Variable declarations.
  const varsAt = out.length;
  const scopes = [...new Set([...VAR_SECTIONS, ...ws.mod.variables.map((v) => v.type)])];
  for (const scope of scopes) {
    const label = scope === "CapturePoint" ? "capture point" : scope.toLowerCase();
    out.push(`// ${label} vars`);
    for (const v of vars.values()) {
      if (v.decl.type !== scope) continue;
      out.push(scope === "Global" ? `const ${v.ident}GlobalVar = mod.GlobalVariable(${v.index})` : `const ${v.ident}${scope}Var = ${v.index};`);
    }
    out.push("");
  }

  // Event dispatch. Object types without a modlib getter get a local helper (EA calls a modlib function that does not exist).
  const dispatch: string[] = [];
  const localGetters = new Set<string>();
  for (const [event, group] of groups) {
    const params = group[0].params;
    const kind = group[0].kind;
    const sig = params.map((p) => `${p.name}: mod.${p.type}`).join(", ");
    const edgeTriggered = event.startsWith("Ongoing");
    let getter = "modlib.getGlobalCondition";
    if (edgeTriggered && kind !== "global") {
      if (CONDITION_GETTER[kind]) getter = `modlib.${CONDITION_GETTER[kind]}`;
      else {
        getter = `get${kind}Condition`;
        localGetters.add(kind);
      }
    }
    const first = kind === "global" ? "" : `${params[0].name}, `;
    const state = (): string => (edgeTriggered ? `${getter}(${first}eventNum++)` : "modlib.getSimpleCondition()");
    const lines = group.map((r) => `  ${r.fn}(${state()}${params.length ? ", eventInfo" : ""});`);
    const counter = edgeTriggered ? `let eventNum = ${group[0].condNum};\n` : "";
    dispatch.push(`export function ${event}(${sig}) {\nconst eventInfo = {${params.map((p) => p.name).join(", ")}};\n${counter}${lines.join("\n")}\n}\n`);
  }
  const helpers: string[] = [];
  for (const name of ctx.helpers) helpers.push(HELPERS[name]);
  for (const kind of localGetters) {
    helpers.push(
      `const ${kind}Conditions: { [id: number]: any[] } = {};
` +
        `function get${kind}Condition(obj: mod.${kind}, n: number) {
` +
        ` const id = mod.GetObjId(obj);
` +
        ` if (!${kind}Conditions[id]) {
  ${kind}Conditions[id] = [];
 }
` +
        ` const states = ${kind}Conditions[id];
` +
        ` while (n >= states.length) {
  states.push(new modlib.ConditionState());
 }
` +
        ` return states[n];
}
`,
    );
  }
  out.splice(varsAt, 0, ...helpers);
  out.push(...dispatch);

  return { ts: `${out.join("\n")}\n`, strings: emitStrings(ws), diagnostics: [...new Set(diagnostics)] };
}
