/**
 * Axecleft's Gemstones — gems, art objects and jewelry for the shared Treasure Generator.
 *
 * The generator window itself is scripts/axecleft-treasure.js (shared by every
 * Axecleft module; the newest copy runs). This script adds:
 *   - the Gems, Art Objects and Jewelry tabs;
 *   - its custom lists (gems, art objects, materials, embellishment gems), kept by the
 *     shared script in the "Axecleft's Treasure Lists" journal and library file;
 *   - a provider for the "gem" and "art" categories of the SRD Treasure table
 *     (used by the Treasure by Level tab).
 *
 * Nothing is stored as finished items: each piece is built from small lists when
 * it is generated. Macro API: game.modules.get("axecleft-gemstones").api
 */

import * as C from "./treasure-core.js";

const { MOD, esc, gp } = C;
const T = () => globalThis.AxecleftTreasure;
const opt = (v, label, sel) => `<option value="${esc(v)}"${String(v) === String(sel ?? "") ? " selected" : ""}>${esc(label)}</option>`;
const fmtFormula = (f) => f.replace(/\*/g, " × ");
const setting = (k) => game.settings.get(MOD, k);
const repeat = (n, fn) => Array.from({ length: Math.min(50, Math.max(1, Number(n) || 1)) }, fn);

/* -------------------------------------------- */
/*  Data                                        */
/* -------------------------------------------- */

let GEMS = null, ART = null, CAT = null;
async function loadData() {
  GEMS ??= await (await fetch(`modules/${MOD}/data/gems.json`)).json();
  ART ??= await (await fetch(`modules/${MOD}/data/art.json`)).json();
}
export async function catalog() {
  await loadData();
  const hub = T();
  const custom = hub?.listRows ? { ...Object.fromEntries(LIST_KEYS.map((k) => [k, hub.listRows(MOD, k)])), disabled: hub.disabledEntries(MOD) } : {};
  return (CAT = C.buildCatalog(GEMS, ART, custom));
}

/** A generator entry for a rolled gem or art spec. */
const entry = (cat, spec) => ({
  name: spec.name, data: C.itemData(cat, spec), ref: spec, provider: `${MOD}.goods`,
  summary: C.summary(spec), describe: (price) => C.summary(spec, price),
});

/* -------------------------------------------- */
/*  Reading the tabs                            */
/* -------------------------------------------- */

const gemSources = (form) => ["srd", "homebrew", "custom"].filter((s) => form?.elements[`src.${s}`]?.checked ?? true);
function gemOptions(form) {
  const el = (n) => form?.elements[n];
  return { sources: form?.elements["src.srd"] ? gemSources(form) : undefined, variations: el("gem.variations") ? el("gem.variations").checked : setting("gemVariations") };
}
function artOptions(form, kind) {
  const el = (n) => form?.elements[n];
  return { variations: el(`${kind}.variations`) ? el(`${kind}.variations`).checked : setting("artVariations") };
}

/* -------------------------------------------- */
/*  Generating (also the macro API)             */
/* -------------------------------------------- */

/** Generate gems. opts as C.rollGem, plus count and dest ("selected", {mode:"actor",uuid}, "items", "chat"). */
export async function generateGems({ count = 1, dest = "items", ...opts } = {}) {
  const cat = await catalog();
  return T().runGeneration({ title: Number(count) > 1 ? "Gems" : "Gem", dest,
    rollFor: () => ({ entries: repeat(count, () => entry(cat, C.rollGem(cat, { variations: setting("gemVariations"), ...opts }))) }) });
}

/** Generate art objects or jewelry. opts as C.rollArt, plus count and dest. */
export async function generateArt({ count = 1, dest = "items", kind = "art", ...opts } = {}) {
  const cat = await catalog();
  return T().runGeneration({ title: kind === "jewelry" ? "Jewelry" : Number(count) > 1 ? "Art Objects" : "Art Object", dest,
    rollFor: () => ({ entries: repeat(count, () => entry(cat, C.rollArt(cat, { kind, variations: setting("artVariations"), ...opts }))) }) });
}

/** Roll only the Goods column of the SRD Treasure table (gems and art). */
export async function generateGoods({ level = 1, times = 1, dest = "items" } = {}) {
  return T().generateTreasure({ level, times, dest, coins: false, goods: true, items: false });
}

/* -------------------------------------------- */
/*  Tabs                                        */
/* -------------------------------------------- */

const prepare = async () => { await catalog(); };
const countField = (name) => `<div class="form-group"><label>How many</label><input type="number" name="${name}" value="1" min="1" max="20" step="1"><span class="hint" style="flex:1">for each target</span></div>`;

const GEM_TAB = {
  module: MOD, name: "gems", title: "Gems", icon: "fas fa-gem", order: 10, prepare,
  content() {
    const cat = CAT;
    const n = (src) => cat.gems.filter((g) => g.source === src).length;
    return `
      <div class="form-group"><label>Gem lists</label><div class="atg-checks">
        <label><input type="checkbox" name="src.srd" checked> SRD (${n("srd")})</label>
        <label><input type="checkbox" name="src.homebrew" checked> Homebrew (${n("homebrew")})</label>
        <label><input type="checkbox" name="src.custom" ${n("custom") ? "checked" : "disabled"}> Custom (${n("custom")})</label></div></div>
      <div class="form-group"><label>Base value</label><select name="gem.grade">${opt("", "Random (SRD odds)")}${cat.grades.map((g) => opt(g.value, `${gp(g.value)}  (${fmtFormula(g.formula)} gp)`)).join("")}</select></div>
      <div class="form-group"><label>Gem</label><select name="gem.gem"></select></div>
      <div class="form-group"><label>Size &amp; quality</label><div class="atg-checks"><label><input type="checkbox" name="gem.variations" ${setting("gemVariations") ? "checked" : ""}> Use the homebrew size and quality variations</label></div></div>
      <div class="form-group" data-var="gem"><label>Size</label><select name="gem.size">${opt("", "Random (5/15/60/15/5)")}${cat.sizes.map((s) => opt(s.key, `${s.label} (×${s.mult})`)).join("")}</select></div>
      <div class="form-group" data-var="gem"><label>Quality</label><select name="gem.quality">${opt("", "Random (5/15/60/15/5)")}${cat.gemQualities.map((q) => opt(q.key, `${q.label} (×${q.mult})`)).join("")}</select></div>
      <div class="atg-preview" data-preview="gem"></div>
      ${countField("gem.count")}
      <p class="hint">These lists and the size/quality choice are also used for gems rolled on the Treasure by Level tab.</p>`;
  },
  wire(section) {
    const form = section.closest("form"), el = (n) => form.elements[n], cat = CAT;
    const fill = () => {
      const keep = el("gem.gem").value;
      const pool = C.gemsFor(cat, { sources: gemSources(form), grade: el("gem.grade").value || null });
      const groups = gemSources(form).map((s) => {
        const list = pool.filter((g) => g.source === s).sort((a, b) => a.grade - b.grade || a.name.localeCompare(b.name));
        return list.length ? `<optgroup label="${C.SOURCES[s]}">${list.map((g) => opt(`${g.source}|${g.name}`, `${g.name} (${gp(g.grade)})`, keep)).join("")}</optgroup>` : "";
      }).join("");
      el("gem.gem").innerHTML = opt("", `Random (${pool.length} gems)`, keep) + groups;
    };
    const toggle = () => section.querySelectorAll("[data-var=gem] select").forEach((s) => { s.disabled = !el("gem.variations").checked; });
    const preview = () => {
      const grade = cat.grades.find((g) => g.value === Number(el("gem.grade").value));
      const vary = el("gem.variations").checked;
      const sz = cat.sizes.find((s) => s.key === el("gem.size").value), q = cat.gemQualities.find((x) => x.key === el("gem.quality").value);
      const mult = !vary ? 1 : sz && q ? sz.mult * q.mult : null;
      section.querySelector("[data-preview=gem]").innerHTML = grade
        ? `True value: ${fmtFormula(grade.formula)} gp${mult === null ? " × size × quality" : mult !== 1 ? ` × ${mult}` : ""}. Players see ${gp(grade.value)} until it is appraised.`
        : `Combinations: ${C.gemsFor(cat, { sources: gemSources(form) }).length} gems${vary ? " × 5 sizes × 5 qualities" : ""}.`;
    };
    for (const s of ["srd", "homebrew", "custom"]) el(`src.${s}`)?.addEventListener("change", fill);
    el("gem.grade").addEventListener("change", fill);
    el("gem.variations").addEventListener("change", toggle);
    section.addEventListener("change", preview);
    fill(); toggle(); preview();
  },
  generate(form) {
    const v = (n) => form.elements[n]?.value || null;
    const opts = { ...gemOptions(form), grade: v("gem.grade"), gem: v("gem.gem"), size: v("gem.size"), quality: v("gem.quality") };
    if (!opts.sources?.length) throw new Error("Tick at least one gem list.");
    return { entries: repeat(v("gem.count"), () => entry(CAT, C.rollGem(CAT, opts))) };
  },
  generateTitle: (form) => (Number(form.elements["gem.count"]?.value) > 1 ? "Gems" : "Gem"),
};

function artTab(kind, order) {
  return {
    module: MOD, name: kind, title: kind === "jewelry" ? "Jewelry" : "Art Objects", icon: kind === "jewelry" ? "fas fa-ring" : "fas fa-palette", order, prepare,
    content() {
      const cat = CAT;
      return `
        <div class="form-group"><label>Value</label><select name="${kind}.level">${opt("", "Random (SRD odds)")}${cat.levels.map((l) => opt(l.level, `${l.level}: ${fmtFormula(l.formula)} gp (about ${gp(l.avg)})`)).join("")}</select></div>
        <div class="form-group"><label>${kind === "jewelry" ? "Piece" : "Object"}</label><select name="${kind}.object">${opt("", "Random")}${C.objectsFor(cat, kind).map((o) => opt(o.name, `${o.name} (${(cat.makes[o.make]?.label ?? o.make).toLowerCase()})${o.source === "custom" ? " *" : ""}`)).join("")}</select></div>
        <div class="form-group"><label>Material</label><select name="${kind}.material"></select></div>
        <div class="form-group"><label>Gemstone</label><select name="${kind}.gem">${opt("", "Random (more likely at higher values)")}${opt("none", "None")}${cat.embellishments.map((g) => opt(g.name, `${g.name} (values ${g.minLevel}–${g.maxLevel})`)).join("")}</select></div>
        <div class="form-group"><label>Quality</label><div class="atg-checks"><label><input type="checkbox" name="${kind}.variations" ${setting("artVariations") ? "checked" : ""}> Use the homebrew quality variations</label></div></div>
        <div class="form-group" data-var="${kind}"><label>Workmanship</label><select name="${kind}.quality">${opt("", "Random (5/15/60/15/5)")}${cat.artQualities.map((q) => opt(q.key, `${q.label} (×${q.mult})`)).join("")}</select></div>
        <div class="atg-preview" data-preview="${kind}"></div>
        ${countField(`${kind}.count`)}
        ${kind === "art" ? `<div class="form-group"><label>Treasure by Level</label><div class="atg-checks"><label><input type="checkbox" name="art.withJewelry" checked> Art rolled by level can be jewelry too</label></div></div>` : ""}`;
    },
    wire(section) {
      const form = section.closest("form"), el = (n) => form.elements[n], cat = CAT;
      const fillMaterials = () => {
        const sel = el(`${kind}.material`), keep = sel.value;
        const obj = cat.objects.find((o) => o.name === el(`${kind}.object`).value);
        const level = Number(el(`${kind}.level`).value) || null;
        if (obj && obj.fixedMaterial !== undefined) {
          sel.innerHTML = opt("", obj.fixedMaterial ? `${obj.fixedMaterial} (part of the object)` : "None (part of the object)");
          sel.disabled = true;
          return;
        }
        sel.disabled = false;
        const makes = obj ? [obj.make] : [...new Set(C.objectsFor(cat, kind).map((o) => o.make))];
        const fits = (m) => !level || (m.minLevel <= level && level <= m.maxLevel);
        const group = (label, list) => (list.length ? `<optgroup label="${esc(label)}">${list.map((m) => opt(m.name, `${m.name} (values ${m.minLevel}–${m.maxLevel})${m.source === "custom" ? " *" : ""}`, keep)).join("")}</optgroup>` : "");
        sel.innerHTML = opt("", level ? "Random (suits the value)" : "Random (suits the value rolled)", keep) + makes.map((mk) => {
          const list = cat.materials.filter((m) => (m.uses ?? []).includes(mk)).sort((a, b) => a.name.localeCompare(b.name));
          const label = cat.makes[mk]?.label ?? mk;
          return level ? group(`${label}: suits value ${level}`, list.filter(fits)) + group(`${label}: other values`, list.filter((m) => !fits(m))) : group(label, list);
        }).join("");
      };
      const toggle = () => section.querySelectorAll(`[data-var="${kind}"] select`).forEach((s) => { s.disabled = !el(`${kind}.variations`).checked; });
      const preview = () => {
        const lv = cat.levels.find((l) => l.level === Number(el(`${kind}.level`).value));
        const q = cat.artQualities.find((x) => x.key === el(`${kind}.quality`).value);
        const m = el(`${kind}.variations`).checked ? q?.mult ?? null : 1;
        section.querySelector(`[data-preview="${kind}"]`).innerHTML = lv
          ? `True value: ${fmtFormula(lv.formula)} gp${m === null ? " × quality" : m !== 1 ? ` × ${m}` : ""}. Players see ${gp(lv.avg)} until it is appraised.`
          : `${C.objectsFor(cat, kind).length} ${kind === "jewelry" ? "pieces" : "objects"} × ${cat.materials.length} materials × ${cat.embellishments.length + 1} gem options × 12 values${el(`${kind}.variations`).checked ? " × 5 qualities" : ""}.`;
      };
      el(`${kind}.object`).addEventListener("change", fillMaterials);
      el(`${kind}.level`).addEventListener("change", fillMaterials);
      el(`${kind}.variations`).addEventListener("change", toggle);
      section.addEventListener("change", preview);
      fillMaterials(); toggle(); preview();
    },
    generate(form) {
      const v = (n) => form.elements[n]?.value || null, el = (n) => form.elements[n];
      const opts = { kind, level: v(`${kind}.level`), object: v(`${kind}.object`), material: el(`${kind}.material`).disabled ? null : v(`${kind}.material`),
        gem: v(`${kind}.gem`), quality: v(`${kind}.quality`), ...artOptions(form, kind) };
      return { entries: repeat(v(`${kind}.count`), () => entry(CAT, C.rollArt(CAT, opts))) };
    },
    generateTitle: (form) => (kind === "jewelry" ? "Jewelry" : Number(form.elements["art.count"]?.value) > 1 ? "Art Objects" : "Art Object"),
  };
}

/* -------------------------------------------- */
/*  Custom lists (kept by the shared script)    */
/* -------------------------------------------- */

const MAKES = ["Molded", "Carved", "Clothing", "Book"];
const makeOf = (v) => {
  const s = String(v ?? "").toLowerCase();
  if (/cloth|fur|hide|fabric|textile/.test(s)) return "Clothing";
  if (/book|paper|document|scroll/.test(s)) return "Book";
  if (/carv/.test(s)) return "Carved";
  if (/mold|mould|cast|metal|forge/.test(s)) return "Molded";
  return MAKES.find((m) => m.toLowerCase() === s) ?? null;
};
const num = (v, d) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : d);
const lvl = (v, d) => Math.min(12, Math.max(1, Math.round(num(v, d))));
const levelRange = (r) => { const lo = lvl(r.minLevel, 1), hi = lvl(r.maxLevel, 12); return { minLevel: Math.min(lo, hi), maxLevel: Math.max(lo, hi) }; };
const makeOptions = () => Object.entries(ART?.makes ?? {}).map(([m, d]) => [m, d.label]);
const levelInput = (value) => ({ type: "number", value, min: 1, max: 12, step: 1 });

/** Gemstones' lists: same page names and columns as Gemstones 1.14, so existing journals keep working. */
const LIST_DEFS = [
  {
    key: "gems", page: "Custom Gems", label: "Gem type", order: 10,
    cols: [["name", "Gem"], ["appraiseAs", "Appraises As"], ["grade", "Base Value (gp)", { type: "select", options: () => (GEMS?.grades ?? []).map((g) => [g.value, gp(g.value)]) }],
      ["img", "Image", { placeholder: "optional, e.g. icons/commodities/gems/gem-faceted-round-white.webp" }], ["desc", "Description"]],
    scopes: [["srd", "SRD gems only"], ["homebrew", "Homebrew gems only"]],
    intro: "Gem types for the generator. <strong>Appraises As</strong> is the name shown before the gem is appraised (e.g. a \"Dragon's Eye Opal\" appraises as \"Opal\"). <strong>Base Value</strong> is one of the SRD gem values: 10, 50, 100, 500, 1000 or 5000. Image and Description are optional.",
    normalize: (r) => ({ name: r.name, appraiseAs: String(r.appraiseAs ?? "").trim() || r.name, grade: num(String(r.grade ?? "").replace(/[^\d.]/g, ""), 10),
      img: String(r.img ?? "").trim(), desc: r.desc ? (/^</.test(r.desc) ? r.desc : `<p>${esc(r.desc)}</p>`) : "" }),
    builtin: () => [...(GEMS?.srd ?? []).map((g) => ({ ...g, scope: "srd" })), ...(GEMS?.homebrew ?? []).map((g) => ({ ...g, scope: "homebrew" }))],
  },
  {
    key: "objects", page: "Custom Art & Jewelry", label: "Art object or jewelry", order: 20,
    cols: [["name", "Object"], ["make", "Construction", { type: "select", options: makeOptions }], ["kind", "Art or Jewelry", { type: "select", options: [["art", "Art object"], ["jewelry", "Jewelry"]] }],
      ["weight", "Weight (lb.)", { type: "number", value: 1, min: 0, step: 0.1 }], ["img", "Image", { placeholder: "optional" }], ["desc", "Description"]],
    intro: "Base objects for art and jewelry. <strong>Construction</strong> decides which materials it can be made of: Molded (metals, glass, ceramic), Carved (wood, bone, ivory, stone), Clothing (cloth, fur, hide) or Book (paper, leather, silk). <strong>Art or Jewelry</strong> decides which tab it appears on.",
    normalize: (r) => ({ name: r.name, make: makeOf(r.make) ?? "Molded", kind: /jewel/i.test(r.kind) ? "jewelry" : "art",
      weight: num(r.weight, /jewel/i.test(r.kind) ? 0 : 1), img: String(r.img ?? "").trim(), desc: String(r.desc ?? "").trim() }),
    format: (f, r) => (f === "kind" ? (r.kind === "jewelry" ? "Jewelry" : "Art") : undefined),
    builtin: () => ART?.objects ?? [],
  },
  {
    key: "materials", page: "Custom Materials", label: "Material", order: 30,
    cols: [["name", "Material"], ["uses", "Used For", { type: "checks", options: makeOptions }], ["minLevel", "Min Value Level", levelInput(1)], ["maxLevel", "Max Value Level", levelInput(12)], ["adj", "Name As"]],
    intro: "Materials for art and jewelry. <strong>Used For</strong> lists the constructions it suits (Molded, Carved, Clothing, Book; separate several with commas). Random rolls only use a material at art values between its <strong>Min</strong> and <strong>Max Value Level</strong> (1 to 12). <strong>Name As</strong> is optional: \"Wolf\" named as \"Wolf Fur\" gives \"Wolf Fur Cloak\".",
    normalize: (r) => {
      const uses = [...new Set((Array.isArray(r.uses) ? r.uses : String(r.uses ?? "").split(/[,;/]| and /)).map(makeOf).filter(Boolean))];
      const m = { name: r.name, uses: uses.length ? uses : ["Molded"], ...levelRange(r), group: "custom" };
      if (String(r.adj ?? "").trim()) m.adj = String(r.adj).trim();
      return m;
    },
    builtin: () => ART?.materials ?? [],
  },
  {
    key: "embellishments", page: "Custom Embellishment Gems", label: "Embellishment gem", order: 40,
    cols: [["name", "Gem"], ["minLevel", "Min Value Level", levelInput(1)], ["maxLevel", "Max Value Level", levelInput(12)]],
    intro: "Gemstones that can decorate art and jewelry (\"set with ruby\", \"inlaid with jade\"). Random rolls use them at art values between Min and Max Value Level (1 to 12).",
    normalize: (r) => ({ name: r.name, ...levelRange(r) }),
    builtin: () => ART?.gemstones ?? [],
  },
];
const LIST_KEYS = LIST_DEFS.map((d) => d.key);

/* -------------------------------------------- */
/*  Provider: gems and art for Treasure by Level */
/* -------------------------------------------- */

const PROVIDER = {
  module: MOD, name: "goods", label: "Axecleft's Gemstones", categories: ["gem", "art"],
  async roll({ category, form }) {
    const cat = await catalog();
    if (category === "gem") return [entry(cat, C.rollGem(cat, gemOptions(form)))];
    const withJewelry = form?.elements["art.withJewelry"] ? form.elements["art.withJewelry"].checked : true;
    return [entry(cat, C.rollArt(cat, { kind: withJewelry ? "any" : "art", ...artOptions(form, "art") }))];
  },
  async recreate(spec) { return C.itemData(await catalog(), spec); },
};

/* -------------------------------------------- */
/*  Registration and hooks                      */
/* -------------------------------------------- */

/** The custom lists, through the shared script: lists.customList("gems"), lists.rows("objects"), lists.addRow("materials", {...}). */
const lists = {
  keys: LIST_KEYS,
  customList: (k) => T()?.customList?.(MOD, k) ?? [],
  rows: (k) => T()?.listRows?.(MOD, k) ?? [],
  disabled: () => T()?.disabledEntries?.(MOD) ?? [],
  addRow: (k, row) => T().lists.addRow(MOD, k, row),
  removeRow: (k, name) => T().lists.removeRow(MOD, k, name),
};
export const API = { generateGems, generateArt, generateGoods, catalog, lists, core: C, open: (tab) => T()?.open(tab) };

if (globalThis.Hooks) {
  const hub = T();
  if (hub) {
    hub.registerTab(GEM_TAB);
    hub.registerTab(artTab("art", 20));
    hub.registerTab(artTab("jewelry", 30));
    hub.registerProvider(PROVIDER);
    if (hub.registerList) for (const d of LIST_DEFS) hub.registerList({ module: MOD, prepare: loadData, ...d });
    else console.error(`${MOD} | the shared Treasure Generator script is older than version 8; custom lists are unavailable.`);
  } else console.error(`${MOD} | scripts/axecleft-treasure.js did not load; the Treasure Generator is unavailable.`);

  Hooks.once("init", () => {
    const reg = (k, o) => game.settings.register(MOD, k, { scope: "world", config: true, ...o });
    reg("gemVariations", { name: "Gem size & quality variations", hint: "Random gems use the homebrew sizes (Tiny to Huge) and qualities (Flawed to Exceptional). Turn off to generate plain SRD-value gems. The generator has the same checkbox for one-off changes.", type: Boolean, default: true });
    reg("artVariations", { name: "Art & jewelry quality variations", hint: "Random art and jewelry use the homebrew workmanship qualities (Junk to Masterpiece). Turn off for plain SRD art values.", type: Boolean, default: true });
    // "Shared treasure lists library" and "Shared library folder" are registered by the shared script (axecleft-treasure.js).
  });

  Hooks.once("ready", () => {
    const mod = game.modules.get(MOD);
    if (mod) mod.api = API;
  });
}
