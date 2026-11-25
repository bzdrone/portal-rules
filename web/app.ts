// Browser front end: load the SDK typings (kept in IndexedDB), convert a dropped experience export, offer downloads.
import { bundleMaps, convertText, type EmitResult } from "../src/convert.js";
import { parseSdkTypings, useSdk, type SdkData } from "../src/sdk-core.js";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// --- SDK typings, stored locally in this browser only ---
const openDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open("portal-rules", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("kv");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
async function kv<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = run(db.transaction("kv", mode).objectStore("kv"));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
const saveSdkSource = (typings: string, version: string) => kv("readwrite", (s) => s.put({ typings, version }, "sdk"));
const loadSdkSource = () => kv<{ typings: string; version: string } | undefined>("readonly", (s) => s.get("sdk"));

let sdkReady = false;
function applySdk(typings: string, version: string): SdkData {
  const data = parseSdkTypings(typings, version);
  if (!Object.keys(data.events).length || !data.functions.size) {
    throw new Error("That file does not look like the Portal SDK's mod/index.d.ts (no events or functions found).");
  }
  useSdk(data);
  sdkReady = true;
  $("sdk-status").className = "status ok";
  $("sdk-status").textContent = `Loaded: ${data.functions.size} blocks, ${Object.keys(data.events).length} events, SDK ${data.version}`;
  return data;
}

const showError = (msg: string) => {
  const el = $("error");
  el.textContent = msg;
  el.hidden = !msg;
};

$<HTMLInputElement>("sdk-file").addEventListener("change", async (e) => {
  const files = [...((e.target as HTMLInputElement).files ?? [])];
  showError("");
  try {
    const typings = files.find((f) => f.name.endsWith(".ts"));
    if (!typings) throw new Error("Choose the SDK's index.d.ts.");
    let version = "unknown";
    const vf = files.find((f) => f.name === "sdk.version.json");
    if (vf) version = String(JSON.parse(await vf.text()).version ?? "unknown");
    const text = await typings.text();
    applySdk(text, version);
    await saveSdkSource(text, version).catch(() => {});
  } catch (err) {
    showError((err as Error).message);
  }
});

// --- Conversion ---
const download = (name: string, text: string) => {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

function show(base: string, r: EmitResult, maps: { filename: string; text: string }[]) {
  const strings = `${JSON.stringify(r.strings, null, 2)}\n`;
  $("summary").textContent = `Converted ${base}: ${r.ts.split("\n").length} lines, ${Object.keys(r.strings).length} strings, ${r.diagnostics.length} warning(s).`;
  const ts = $<HTMLButtonElement>("dl-ts");
  const st = $<HTMLButtonElement>("dl-strings");
  ts.textContent = `Download ${base}.ts`;
  st.textContent = `Download ${base}.strings.json`;
  ts.onclick = () => download(`${base}.ts`, r.ts);
  st.onclick = () => download(`${base}.strings.json`, strings);
  $("map-list").replaceChildren(
    ...maps.map((m) => {
      const b = Object.assign(document.createElement("button"), { type: "button", textContent: `Download ${m.filename}` });
      b.onclick = () => download(m.filename, m.text); // exactly as encoded in the export
      return b;
    }),
  );
  $("maps").hidden = !maps.length;
  const list = $("diag-list");
  list.replaceChildren(...r.diagnostics.map((d) => Object.assign(document.createElement("li"), { textContent: d })));
  $("diagnostics").hidden = !r.diagnostics.length;
  $("preview").textContent = r.ts;
  $("result").hidden = false;
}

async function convertFile(file: File) {
  showError("");
  $("result").hidden = true;
  if (!sdkReady) return showError("Load the SDK typings first (step 1).");
  try {
    const text = await file.text();
    show(file.name.replace(/\.[^.]+$/, ""), convertText(text), bundleMaps(text));
  } catch (err) {
    showError(`${file.name} is not a Portal workspace or experience bundle: ${(err as Error).message}`);
  }
}

const drop = $("drop");
$<HTMLInputElement>("input-file").addEventListener("change", (e) => {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (f) void convertFile(f);
});
for (const t of ["dragenter", "dragover"]) {
  drop.addEventListener(t, (e) => {
    e.preventDefault();
    drop.classList.add("over");
  });
}
for (const t of ["dragleave", "drop"]) drop.addEventListener(t, () => drop.classList.remove("over"));
drop.addEventListener("drop", (e) => {
  e.preventDefault();
  const f = e.dataTransfer?.files[0];
  if (f) void convertFile(f);
});

// Restore the saved SDK on load.
loadSdkSource()
  .then((s) => s && applySdk(s.typings, s.version))
  .catch(() => {});
