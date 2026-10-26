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

const { MOD, esc, gp, t } = C;
const H = (s, d) => esc(t(s, d));
const T = () => globalThis.AxecleftTreasure;

/** A name from this module's English data as shown in the world's language: the word file's entry, else the name given
 *  (Babele's), else the English; first letter capitalised for lists. */
const dn = (en, shown) => {
  const s = String(globalThis.AxecleftTools?.word?.(en, { text: shown ?? null })?.text || shown || en || "");
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const opt = (v, label, sel) => `<option value="${esc(v)}"${String(v) === String(sel ?? "") ? " selected" : ""}>${esc(label)}</option>`;
const fmtFormula = (f) => f.replace(/\*/g, " × ");
const setting = (k) => game.settings.get(MOD, k);
const repeat = (n, fn) => Array.from({ length: Math.min(50, Math.max(1, Number(n) || 1)) }, fn);

/* -------------------------------------------- */
/*  Data                                        */
/* -------------------------------------------- */

let GEMS = null, ART = null, PREMADE = null, CAT = null;
async function loadData() {
  GEMS ??= await (await fetch(`modules/${MOD}/data/gems.json`)).json();
  ART ??= await (await fetch(`modules/${MOD}/data/art.json`)).json();
  // Premade art and books (contributed pieces, generated as they were made).
  if (!PREMADE) {
    try { PREMADE = (await (await fetch(`modules/${MOD}/data/premade-art.json`)).json()).items ?? []; }
    catch (err) { console.warn(`${MOD} | data/premade-art.json could not be read`, err); PREMADE = []; }
  }
}
export async function catalog() {
  await loadData();
  const hub = T();
  const custom = hub?.listRows ? { ...Object.fromEntries(LIST_KEYS.map((k) => [k, hub.listRows(MOD, k)])), disabled: hub.disabledEntries(MOD) } : {};
  return (CAT = C.buildCatalog(GEMS, ART, custom, PREMADE, valueSettings()));
}
/** The GM's value rolls and base values, the "never below the base value" rule and Full Resale Price (world settings). */
function valueSettings() {
  let v = {};
  try { v = foundry.utils.deepClone(setting("valueRolls") ?? {}); } catch (e) { v = {}; }
  let full = true;
  try { full = setting("fullResale") !== false; } catch (e) { /* default */ }
  return { gems: v.gems ?? {}, art: v.art ?? {}, minBase: !!v.minBase, fullResale: full };
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
  return { variations: el(`${kind}.variations`) ? el(`${kind}.variations`).checked : setting("artVariations"), premadeShare: setting("premadeShare") };
}

/* -------------------------------------------- */
/*  Generating (also the macro API)             */
/* -------------------------------------------- */

/** Generate gems. opts as C.rollGem, plus count and dest ("selected", {mode:"actor",uuid}, "items", "chat"). */
export async function generateGems({ count = 1, dest = "items", ...opts } = {}) {
  const cat = await catalog();
  return T().runGeneration({ title: t(Number(count) > 1 ? "Gems" : "Gem"), dest,
    rollFor: () => ({ entries: repeat(count, () => entry(cat, C.rollGem(cat, { variations: setting("gemVariations"), ...opts }))) }) });
}

/** Generate art objects or jewelry. opts as C.rollArt, plus count and dest. */
export async function generateArt({ count = 1, dest = "items", kind = "art", ...opts } = {}) {
  const cat = await catalog();
  return T().runGeneration({ title: t(kind === "jewelry" ? "Jewelry" : Number(count) > 1 ? "Art Objects" : "Art Object"), dest,
    rollFor: () => ({ entries: repeat(count, () => entry(cat, C.rollArt(cat, { kind, variations: setting("artVariations"), premadeShare: setting("premadeShare"), ...opts }))) }) });
}

/** Roll only the Goods column of the SRD Treasure table (gems and art). */
export async function generateGoods({ level = 1, times = 1, dest = "items" } = {}) {
  return T().generateTreasure({ level, times, dest, coins: false, goods: true, items: false });
}

/* -------------------------------------------- */
/*  Tabs                                        */
/* -------------------------------------------- */

const prepare = async () => { await catalog(); };
/** The Object list: base objects, then each contributor's premade pieces in their own group. */
function objectOptions(cat, kind) {
  const list = C.objectsFor(cat, kind);
  const base = list.filter((o) => !o.premade).map((o) => opt(o.name, `${dn(o.name)} (${t(cat.makes[o.make]?.label ?? o.make).toLowerCase()})${o.source === "custom" ? " *" : ""}`)).join("");
  const byCreator = new Map();
  for (const o of list.filter((x) => x.premade)) { const c = o.premade.creator || ""; if (!byCreator.has(c)) byCreator.set(c, []); byCreator.get(c).push(o); }
  const groups = [...byCreator].map(([c, objs]) => `<optgroup label="${esc(c ? t("Premade by {creator}", { creator: c }) : t("Premade"))}">${objs
    .sort((a, b) => dn(a.name).localeCompare(dn(b.name))).map((o) => opt(o.name, `${dn(o.name)} (${t(cat.makes[o.make]?.label ?? o.make).toLowerCase()})`)).join("")}</optgroup>`).join("");
  return byCreator.size ? `<optgroup label="${esc(t("Objects"))}">${base}</optgroup>${groups}` : base;
}
const countField = (name) => `<div class="form-group"><label>${H("How many")}</label><input type="number" name="${name}" value="1" min="1" max="20" step="1"><span class="hint" style="flex:1">${H("for each target")}</span></div>`;

const GEM_TAB = {
  module: MOD, name: "gems", title: /*t*/"Gems", icon: "fas fa-gem", order: 10, prepare,
  content() {
    const cat = CAT;
    const n = (src) => cat.gems.filter((g) => g.source === src).length;
    return `
      <div class="form-group"><label>${H("Gem lists")}</label><div class="atg-checks">
        <label><input type="checkbox" name="src.srd" checked> SRD (${n("srd")})</label>
        <label><input type="checkbox" name="src.homebrew" checked> ${H("Homebrew")} (${n("homebrew")})</label>
        <label><input type="checkbox" name="src.custom" ${n("custom") ? "checked" : "disabled"}> ${H("Custom")} (${n("custom")})</label></div></div>
      <div class="form-group"><label>${H("Base value")}</label><select name="gem.grade">${opt("", t("Random (SRD odds)"))}${cat.grades.map((g) => opt(g.value, `${gp(g.value)}  (${fmtFormula(g.formula)} ${t("gp")})`)).join("")}</select></div>
      <div class="form-group"><label>${H("Gem")}</label><select name="gem.gem"></select></div>
      <div class="form-group"><label>${H("Size & quality")}</label><div class="atg-checks"><label><input type="checkbox" name="gem.variations" ${setting("gemVariations") ? "checked" : ""}> ${H("Use the homebrew size and quality variations")}</label></div></div>
      <div class="form-group" data-var="gem"><label>${H("Size")}</label><select name="gem.size">${opt("", t("Random (5/15/60/15/5)"))}${cat.sizes.map((s) => opt(s.key, `${t(s.label)} (×${s.mult})`)).join("")}</select></div>
      <div class="form-group" data-var="gem"><label>${H("Quality")}</label><select name="gem.quality">${opt("", t("Random (5/15/60/15/5)"))}${cat.gemQualities.map((q) => opt(q.key, `${t(q.label)} (×${q.mult})`)).join("")}</select></div>
      <div class="atg-preview" data-preview="gem"></div>
      ${countField("gem.count")}
      <p class="hint">${H("These lists and the size/quality choice are also used for gems rolled on the Treasure by Level tab.")}</p>`;
  },
  wire(section) {
    const form = section.closest("form"), el = (n) => form.elements[n], cat = CAT;
    const fill = () => {
      const keep = el("gem.gem").value;
      const pool = C.gemsFor(cat, { sources: gemSources(form), grade: el("gem.grade").value || null });
      const groups = gemSources(form).map((s) => {
        const list = pool.filter((g) => g.source === s).sort((a, b) => a.grade - b.grade || dn(a.name).localeCompare(dn(b.name)));
        return list.length ? `<optgroup label="${esc(C.sourceName(s))}">${list.map((g) => opt(`${g.source}|${g.name}`, `${dn(g.name)} (${gp(g.grade)})`, keep)).join("")}</optgroup>` : "";
      }).join("");
      el("gem.gem").innerHTML = opt("", t("Random ({n} gems)", { n: pool.length }), keep) + groups;
    };
    const toggle = () => section.querySelectorAll("[data-var=gem] select").forEach((s) => { s.disabled = !el("gem.variations").checked; });
    const preview = () => {
      const grade = cat.grades.find((g) => g.value === Number(el("gem.grade").value));
      const vary = el("gem.variations").checked;
      const sz = cat.sizes.find((s) => s.key === el("gem.size").value), q = cat.gemQualities.find((x) => x.key === el("gem.quality").value);
      const mult = !vary ? 1 : sz && q ? sz.mult * q.mult : null;
      section.querySelector("[data-preview=gem]").innerHTML = grade
        ? H("True value: {formula}. Players see {value} until it is appraised.", { formula: `${fmtFormula(grade.formula)} ${t("gp")}${mult === null ? t(" × size × quality") : mult !== 1 ? ` × ${mult}` : ""}`, value: gp(grade.value) })
        : H(vary ? "Combinations: {n} gems × 5 sizes × 5 qualities." : "Combinations: {n} gems.", { n: C.gemsFor(cat, { sources: gemSources(form) }).length });
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
    if (!opts.sources?.length) throw new Error(t("Tick at least one gem list."));
    return { entries: repeat(v("gem.count"), () => entry(CAT, C.rollGem(CAT, opts))) };
  },
  generateTitle: (form) => t(Number(form.elements["gem.count"]?.value) > 1 ? "Gems" : "Gem"),
};

function artTab(kind, order) {
  return {
    module: MOD, name: kind, title: kind === "jewelry" ? /*t*/"Jewelry" : /*t*/"Art Objects", icon: kind === "jewelry" ? "fas fa-ring" : "fas fa-palette", order, prepare,
    content() {
      const cat = CAT;
      return `
        <div class="form-group"><label>${H("Value")}</label><select name="${kind}.level">${opt("", t("Random (SRD odds)"))}${cat.levels.map((l) => opt(l.level, t("{level}: {formula} gp (about {value})", { level: l.level, formula: fmtFormula(l.formula), value: gp(l.avg) }))).join("")}</select></div>
        <div class="form-group"><label>${H(kind === "jewelry" ? "Piece" : "Object")}</label><select name="${kind}.object">${opt("", t("Random"))}${objectOptions(cat, kind)}</select></div>
        <div class="form-group"><label>${H("Material")}</label><select name="${kind}.material"></select></div>
        <div class="form-group"><label>${H("Gemstone")}</label><select name="${kind}.gem">${opt("", t("Random (more likely at higher values)"))}${opt("none", t("None"))}${cat.embellishments.map((g) => opt(g.name, t("{name} (values {min}–{max})", { name: dn(g.name), min: g.minLevel, max: g.maxLevel }))).join("")}</select></div>
        <div class="form-group"><label>${H("Quality")}</label><div class="atg-checks"><label><input type="checkbox" name="${kind}.variations" ${setting("artVariations") ? "checked" : ""}> ${H("Use the homebrew quality variations")}</label></div></div>
        <div class="form-group" data-var="${kind}"><label>${H("Workmanship")}</label><select name="${kind}.quality">${opt("", t("Random (5/15/60/15/5)"))}${cat.artQualities.map((q) => opt(q.key, `${t(q.label)} (×${q.mult})`)).join("")}</select></div>
        <div class="atg-preview" data-preview="${kind}"></div>
        ${countField(`${kind}.count`)}
        ${kind === "art" ? `<div class="form-group"><label>${H("Treasure by Level")}</label><div class="atg-checks"><label><input type="checkbox" name="art.withJewelry" checked> ${H("Art rolled by level can be jewelry too")}</label></div></div>` : ""}`;
    },
    wire(section) {
      const form = section.closest("form"), el = (n) => form.elements[n], cat = CAT;
      const fillMaterials = () => {
        const sel = el(`${kind}.material`), keep = sel.value;
        const obj = cat.objects.find((o) => o.name === el(`${kind}.object`).value);
        const level = Number(el(`${kind}.level`).value) || null;
        if (obj && obj.fixedMaterial !== undefined) {
          sel.innerHTML = opt("", obj.fixedMaterial ? t("{material} (part of the object)", { material: dn(obj.fixedMaterial) }) : t("None (part of the object)"));
          sel.disabled = true;
          return;
        }
        sel.disabled = false;
        const makes = obj ? [obj.make] : [...new Set(C.objectsFor(cat, kind).map((o) => o.make))];
        const fits = (m) => !level || (m.minLevel <= level && level <= m.maxLevel);
        const group = (label, list) => (list.length ? `<optgroup label="${esc(label)}">${list.map((m) => opt(m.name, `${t("{name} (values {min}–{max})", { name: dn(m.name), min: m.minLevel, max: m.maxLevel })}${m.source === "custom" ? " *" : ""}`, keep)).join("")}</optgroup>` : "");
        sel.innerHTML = opt("", t(level ? "Random (suits the value)" : "Random (suits the value rolled)"), keep) + makes.map((mk) => {
          const list = cat.materials.filter((m) => (m.uses ?? []).includes(mk)).sort((a, b) => dn(a.name).localeCompare(dn(b.name)));
          const label = t(cat.makes[mk]?.label ?? mk);
          return level ? group(t("{construction}: suits value {level}", { construction: label, level }), list.filter(fits)) + group(t("{construction}: other values", { construction: label }), list.filter((m) => !fits(m))) : group(label, list);
        }).join("");
      };
      const toggle = () => section.querySelectorAll(`[data-var="${kind}"] select`).forEach((s) => { s.disabled = !el(`${kind}.variations`).checked; });
      const preview = () => {
        const pre = cat.objects.find((o) => o.name === el(`${kind}.object`).value)?.premade;
        if (pre) {
          section.querySelector(`[data-preview="${kind}"]`).innerHTML = H("Premade by {creator}: generated as it was made, with no material, gem or quality. True value: {formula} gp, rolled when it is added to a character.", { creator: pre.creator, formula: fmtFormula(pre.formula) });
          return;
        }
        const lv = cat.levels.find((l) => l.level === Number(el(`${kind}.level`).value));
        const q = cat.artQualities.find((x) => x.key === el(`${kind}.quality`).value);
        const m = el(`${kind}.variations`).checked ? q?.mult ?? null : 1;
        section.querySelector(`[data-preview="${kind}"]`).innerHTML = lv
          ? H("True value: {formula}. Players see {value} until it is appraised.", { formula: `${fmtFormula(lv.formula)} ${t("gp")}${m === null ? t(" × quality") : m !== 1 ? ` × ${m}` : ""}`, value: gp(lv.avg) })
          : H(kind === "jewelry" ? "{objects} pieces × {materials} materials × {gems} gem options × 12 values{qualities}." : "{objects} objects × {materials} materials × {gems} gem options × 12 values{qualities}.",
            { objects: C.objectsFor(cat, kind).length, materials: cat.materials.length, gems: cat.embellishments.length + 1, qualities: el(`${kind}.variations`).checked ? t(" × 5 qualities") : "" });
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
    generateTitle: (form) => t(kind === "jewelry" ? "Jewelry" : Number(form.elements["art.count"]?.value) > 1 ? "Art Objects" : "Art Object"),
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

/** The SRD Art Objects table's 12 value rows (data/art.json has the same), for the lists' explanation. */
const VALUE_LEVELS = [[1, "1d10*10", 55], [2, "3d6*10", 105], [3, "1d6*100", 350], [4, "1d10*100", 550], [5, "2d6*100", 700], [6, "3d6*100", 1050],
  [7, "4d6*100", 1400], [8, "5d6*100", 1750], [9, "1d4*1000", 2500], [10, "1d6*1000", 3500], [11, "2d4*1000", 5000], [12, "2d6*1000", 7000]];
/** What Min and Max Value Level mean, with the 12 levels (built when the page is shown, in the world's language). */
function valueLevelsNote() {
  const levels = (ART?.levels?.length ? ART.levels.map((l) => [l.level, l.formula, l.avg]) : VALUE_LEVELS)
    .map(([level, formula, avg]) => `<li>${esc(t("{level}: {formula} gp (about {value})", { level, formula: fmtFormula(formula), value: gp(avg) }))}</li>`).join("");
  return `<p>${t("<strong>Value levels</strong> are the 12 rows of the SRD Art Objects table, the same as the <strong>Value</strong> list on the Art objects and Jewelry tabs. Each random art object or piece of jewelry is rolled at one level, then only uses the materials and gems whose Min to Max range includes that level:")}</p><ul>${levels}</ul><p>${t("For example, Min 9 and Max 12 keep it for pieces worth about 2,500 gp and more; Min 1 and Max 4, for pieces up to about 1,000 gp.")}</p>`;
}

/** Gemstones' lists: same page names and columns as Gemstones 1.14, so existing journals keep working. */
const LIST_DEFS = [
  {
    key: "gems", page: /*t*/"Custom Gems", label: /*t*/"Gem type", order: 10,
    cols: [["name", /*t*/"Gem"], ["appraiseAs", /*t*/"Appraises As"], ["grade", /*t*/"Base Value (gp)", { type: "select", options: () => (GEMS?.grades ?? []).map((g) => [g.value, gp(g.value)]) }],
      ["img", /*t*/"Image", { placeholder: /*t*/"optional, e.g. icons/commodities/gems/gem-faceted-round-white.webp" }], ["desc", /*t*/"Description"]],
    scopes: [["srd", /*t*/"SRD gems only"], ["homebrew", /*t*/"Homebrew gems only"]],
    intro: /*t*/"Gem types for the generator.",
    help: { name: /*t*/"the gem's name once it is appraised.", appraiseAs: /*t*/"the name shown before the gem is appraised (a \"Dragon's Eye Opal\" appraises as \"Opal\"); blank: its own name.",
      grade: /*t*/"one of the SRD gem values: 10, 50, 100, 500, 1000 or 5000.", img: /*t*/"optional: an image path.", desc: /*t*/"optional: a description for the item." },
    example: { name: "Dragon's Eye Opal", appraiseAs: "Opal", grade: 500, img: "icons/commodities/gems/gem-faceted-round-white.webp", desc: "A milky opal with a slit of red fire at its center." },
    normalize: (r) => ({ name: r.name, appraiseAs: String(r.appraiseAs ?? "").trim() || r.name, grade: num(String(r.grade ?? "").replace(/[^\d.]/g, ""), 10),
      img: String(r.img ?? "").trim(), desc: r.desc ? (/^</.test(r.desc) ? r.desc : `<p>${esc(r.desc)}</p>`) : "" }),
    builtin: () => [...(GEMS?.srd ?? []).map((g) => ({ ...g, scope: "srd" })), ...(GEMS?.homebrew ?? []).map((g) => ({ ...g, scope: "homebrew" }))],
  },
  {
    key: "objects", page: /*t*/"Custom Art & Jewelry", label: /*t*/"Art object or jewelry", order: 20,
    cols: [["name", /*t*/"Object"], ["make", /*t*/"Construction", { type: "select", options: makeOptions }], ["kind", /*t*/"Art or Jewelry", { type: "select", options: [["art", /*t*/"Art object"], ["jewelry", /*t*/"Jewelry"]] }],
      ["weight", /*t*/"Weight (lb.)", { type: "number", value: 1, min: 0, step: 0.1 }], ["img", /*t*/"Image", { placeholder: /*t*/"optional" }], ["desc", /*t*/"Description"]],
    intro: /*t*/"Base objects for art and jewelry.",
    help: { name: /*t*/"the object's name, without its material (\"Cloak\", not \"Wolf Fur Cloak\").", make: /*t*/"which materials it can be made of: Molded (metals, glass, ceramic), Carved (wood, bone, ivory, stone), Clothing (cloth, fur, hide) or Book (paper, leather, silk).",
      kind: /*t*/"Art or Jewelry: which tab it appears on.", weight: /*t*/"its weight in pounds.", img: /*t*/"optional: an image path.", desc: /*t*/"optional: a description for the item." },
    example: { name: "Hand Mirror", make: "Molded", kind: "art", weight: 1, img: "", desc: "A small mirror with an ornate handle." },
    normalize: (r) => ({ name: r.name, make: makeOf(r.make) ?? "Molded", kind: /jewel/i.test(r.kind) ? "jewelry" : "art",
      weight: num(r.weight, /jewel/i.test(r.kind) ? 0 : 1), img: String(r.img ?? "").trim(), desc: String(r.desc ?? "").trim() }),
    format: (f, r) => (f === "kind" ? (r.kind === "jewelry" ? "Jewelry" : "Art") : undefined),
    builtin: () => ART?.objects ?? [],
  },
  {
    key: "materials", page: /*t*/"Custom Materials", label: /*t*/"Material", order: 30,
    cols: [["name", /*t*/"Material"], ["uses", /*t*/"Used For", { type: "checks", options: makeOptions }], ["minLevel", /*t*/"Min Value Level", levelInput(1)], ["maxLevel", /*t*/"Max Value Level", levelInput(12)], ["adj", /*t*/"Name As"]],
    intro: /*t*/"Materials for art and jewelry.",
    help: { name: /*t*/"the material's name.", uses: /*t*/"the constructions it suits: Molded, Carved, Clothing, Book (separate several with commas).",
      minLevel: /*t*/"the lowest value level (1 to 12, see below) at which random art and jewelry can be made of it.", maxLevel: /*t*/"the highest value level (1 to 12, see below) at which random art and jewelry can be made of it.",
      adj: /*t*/"optional: the word used in item names (\"Wolf\" named as \"Wolf Fur\" gives \"Wolf Fur Cloak\")." },
    note: () => valueLevelsNote(),
    example: { name: "Wolf", uses: ["Clothing"], minLevel: 1, maxLevel: 4, adj: "Wolf Fur" },
    normalize: (r) => {
      const uses = [...new Set((Array.isArray(r.uses) ? r.uses : String(r.uses ?? "").split(/[,;/]| and /)).map(makeOf).filter(Boolean))];
      const m = { name: r.name, uses: uses.length ? uses : ["Molded"], ...levelRange(r), group: "custom" };
      if (String(r.adj ?? "").trim()) m.adj = String(r.adj).trim();
      return m;
    },
    builtin: () => ART?.materials ?? [],
  },
  {
    key: "embellishments", page: /*t*/"Custom Embellishment Gems", label: /*t*/"Embellishment gem", order: 40,
    cols: [["name", /*t*/"Gem"], ["minLevel", /*t*/"Min Value Level", levelInput(1)], ["maxLevel", /*t*/"Max Value Level", levelInput(12)]],
    intro: /*t*/"Gemstones that can decorate art and jewelry (\"set with ruby\", \"inlaid with jade\").",
    help: { name: /*t*/"the gemstone's name, as it reads in \"set with …\".", minLevel: /*t*/"the lowest value level (1 to 12, see below) at which random art and jewelry can be set with it.", maxLevel: /*t*/"the highest value level (1 to 12, see below) at which random art and jewelry can be set with it." },
    note: () => valueLevelsNote(),
    example: { name: "moonstone", minLevel: 2, maxLevel: 8 },
    normalize: (r) => ({ name: r.name, ...levelRange(r) }),
    builtin: () => ART?.gemstones ?? [],
  },
];
// Premade pieces (version 1.14.6.22): fixed items, generated as made: contributed ones (data/premade-art.json) and the GM's own,
// such as treasure from a book they own. Each is rolled at the SRD value row nearest its average value.
const levelForValue = (avg) => VALUE_LEVELS.reduce((best, [lv, , a]) => (Math.abs(a - avg) < Math.abs(best[1] - avg) ? [lv, a] : best), [1, 55])[0];
const valueFormula = (v) => String(v ?? "").replace(/\s*gp\s*$/i, "").replace(/[×x]/g, "*").replace(/\s+/g, "").trim();
LIST_DEFS.push({
  key: "premade", page: /*t*/"Custom Premade Art", label: /*t*/"Premade piece", order: 50,
  cols: [["name", /*t*/"Name"], ["kind", /*t*/"Art or Jewelry", { type: "select", options: [["art", /*t*/"Art object"], ["jewelry", /*t*/"Jewelry"]] }],
    ["make", /*t*/"Construction", { type: "select", options: makeOptions }], ["value", /*t*/"Value (gp)", { placeholder: /*t*/"dice or a number, e.g. 3d6*10 or 250" }],
    ["weight", /*t*/"Weight (lb.)", { type: "number", value: 1, min: 0, step: 0.1 }], ["img", /*t*/"Image", { placeholder: /*t*/"optional" }],
    ["desc", /*t*/"Description"], ["creator", /*t*/"Created By", { placeholder: /*t*/"optional" }], ["source", /*t*/"Source", { placeholder: /*t*/"optional, e.g. the book it comes from" }]],
  intro: /*t*/"Complete pieces that are generated exactly as written: no material, gem or quality is added. Random art includes them at their own value, as often as the \"Premade pieces in random art\" setting says (5% by default), and the Art Objects and Jewelry tabs list them to pick.",
  help: { name: /*t*/"the item's full name.", kind: /*t*/"Art or Jewelry: which tab it appears on.", make: /*t*/"the construction shown next to it in the lists (Molded, Carved, Clothing or Book).",
    value: /*t*/"its value in gp: dice (3d6*10) are rolled when the item is added to a character; a number is a fixed value.", weight: /*t*/"its weight in pounds.",
    img: /*t*/"optional: an image path.", desc: /*t*/"the item's description.", creator: /*t*/"optional: who made it; the description ends with \"Created by …\".",
    source: /*t*/"optional: where it comes from (the item's Source field)." },
  example: { name: "Silver Chalice of the Dawn Choir", kind: "art", make: "Molded", value: "4d6*10", weight: 2, img: "", desc: "A temple chalice engraved with a ring of singing figures.", creator: "", source: "" },
  normalize: (r) => {
    const formula = valueFormula(r.value) || "1";
    const avg = C.averageOf(formula) || 0;
    const kind = /jewel/i.test(r.kind) ? "jewelry" : "art";
    return { name: r.name, kind, make: makeOf(r.make) ?? "Molded", formula, avg, level: levelForValue(avg), weight: num(r.weight, kind === "jewelry" ? 0 : 1),
      img: String(r.img ?? "").trim(), desc: r.desc ? (/^</.test(r.desc) ? r.desc : `<p>${esc(r.desc)}</p>`) : "", creator: String(r.creator ?? "").trim(),
      source: String(r.source ?? "").trim(), tags: [], subType: "misc" };
  },
  format: (f, r) => (f === "kind" ? (r.kind === "jewelry" ? "Jewelry" : "Art") : f === "value" ? (r.formula ?? r.value) : undefined),
  builtin: () => PREMADE ?? [],
});
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

/* -------------------------------------------- */
/*  Gem and art values (settings)               */
/* -------------------------------------------- */

/** The GM's value rolls and base values: one row for each SRD gem value and each SRD art value. Blank: the SRD's. */
async function openValues() {
  if (!game.user.isGM) return;
  await loadData();
  const v = valueSettings();
  const row = (list, key, label, srdF, srdB) => {
    const o = v[list]?.[key] ?? {};
    return `<tr><th>${esc(label)}</th><td class="hint">${esc(fmtFormula(srdF))}</td>
      <td><input type="text" name="${list}.${key}.formula" value="${esc(o.formula ?? "")}" placeholder="${esc(srdF)}" autocomplete="off" spellcheck="false"></td>
      <td class="hint">${esc(C.num(srdB))}</td><td><input type="text" inputmode="decimal" name="${list}.${key}.base" value="${esc(o.base ?? "")}" placeholder="${esc(srdB)}" style="width:6em"></td></tr>`;
  };
  const head = `<tr><th></th><th>${H("SRD roll")}</th><th>${H("Your roll")}</th><th>${H("SRD base")}</th><th>${H("Your base (gp)")}</th></tr>`;
  const gems = (GEMS?.grades ?? []).map((g) => row("gems", g.value, t("{value} gems", { value: gp(g.value) }), g.formula, g.value)).join("");
  const art = (ART?.levels ?? []).map((l) => row("art", l.level, t("Art value {level}", { level: l.level }), l.formula, l.avg)).join("");
  const content = `<p class="hint">${H("Each gem, art object and piece of jewelry has a base value (what it looks to be worth, until it is appraised) and a value roll (its true value, rolled when it reaches a character). Leave a box blank for the SRD's. A roll can use dice and max(), min(), floor(), ceil() and round(): max(10, 4d4) is never below 10.")}</p>
    <label class="atg-cb"><input type="checkbox" name="minBase" ${v.minBase ? "checked" : ""}> ${H("A rolled value is never below the base value")}</label>
    <div style="max-height:55vh;overflow-y:auto"><table class="atg-sources"><thead>${head}</thead><tbody>
      <tr><th colspan="5">${H("Gems")}</th></tr>${gems}<tr><th colspan="5">${H("Art objects and jewelry")}</th></tr>${art}</tbody></table></div>
    <p class="hint">${H("Size and quality variations multiply the value rolled. Pieces already made keep their values.")}</p>`;
  const Dlg = globalThis.AxecleftTools?.DialogV2 ?? foundry.applications.api.DialogV2;
  const res = await Dlg.wait({
    window: { title: t("Gem and art values"), icon: "fas fa-coins" }, position: { width: 640 }, content,
    buttons: [
      { action: "save", label: t("Save"), icon: "fas fa-floppy-disk", default: true, callback: (ev, btn) => {
        const f = btn.form?.elements ?? {};
        const out = { gems: {}, art: {}, minBase: !!f.minBase?.checked };
        const errors = [];
        const read = (list, key) => {
          const formula = String(f[`${list}.${key}.formula`]?.value ?? "").trim(), base = String(f[`${list}.${key}.base`]?.value ?? "").trim();
          if (formula) { try { C.rollDice(formula); } catch (e) { errors.push(formula); } }
          if (base && !(Number(base) > 0)) errors.push(base);
          if (formula || base) out[list][key] = { ...(formula ? { formula } : {}), ...(base ? { base: Number(base) } : {}) };
        };
        for (const g of GEMS?.grades ?? []) read("gems", g.value);
        for (const l of ART?.levels ?? []) read("art", l.level);
        return errors.length ? { errors } : out;
      } },
      { action: "reset", label: t("SRD values"), icon: "fas fa-rotate-left" },
    ],
  });
  if (res === "reset") { await game.settings.set(MOD, "valueRolls", {}); CAT = null; return ui.notifications.info(t("Gem and art values are the SRD's again.")); }
  if (!res || typeof res !== "object") return;
  if (res.errors) { ui.notifications.error(t("Not saved: these can't be rolled or aren't values: {list}", { list: res.errors.join(", ") })); return openValues(); }
  await game.settings.set(MOD, "valueRolls", res);
  CAT = null;
  ui.notifications.info(t("Gem and art values saved."));
}

/**
 * The SRD gems in this module's compendiums are trade goods: Full Resale Price on (D35E). The compendiums are brought in
 * step once, by the GM, when an older copy still has it off (the module's own compendiums, unlocked for the change and
 * locked again). Taking a gem from a compendium follows the world's setting either way (preCreateItem above).
 */
async function packsFullResale() {
  if (!game.user.isGM || (game.users.activeGM && !game.users.activeGM.isSelf)) return;
  for (const pack of game.packs) {
    if (pack.metadata?.packageName !== MOD || pack.documentName !== "Item" || !/^gems-\d+-gp$/.test(pack.metadata?.name ?? "")) continue;
    const index = await pack.getIndex({ fields: ["system.fullResalePrice"] });
    const updates = [...index].filter((e) => e.system?.fullResalePrice !== true).map((e) => ({ _id: e._id, "system.fullResalePrice": true }));
    if (!updates.length) continue;
    const locked = pack.locked;
    try {
      if (locked) await pack.configure({ locked: false });
      await Item.implementation.updateDocuments(updates, { pack: pack.collection });
      console.log(`${MOD} | ${pack.title}: Full Resale Price on for ${updates.length} gem(s)`);
    } finally { if (locked) await pack.configure({ locked: true }); }
  }
}

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
    reg("gemVariations", { name: /*t*/"Gem size & quality variations", hint: /*t*/"Random gems use the homebrew sizes (Tiny to Huge) and qualities (Flawed to Exceptional). Turn off to generate plain SRD-value gems. The generator has the same checkbox for one-off changes.", type: Boolean, default: true });
    reg("artVariations", { name: /*t*/"Art & jewelry quality variations", hint: /*t*/"Random art and jewelry use the homebrew workmanship qualities (Junk to Masterpiece). Turn off for plain SRD art values.", type: Boolean, default: true });
    reg("premadeShare", { name: /*t*/"Premade pieces in random art (%)", hint: /*t*/"How often a random art object or piece of jewelry is a premade piece (Leo's art and books, and your own on the Custom Premade Art list) instead of one built from an object, material and gem. Premade pieces are rolled only at their own value. 0 = never; they can still be picked on the Art Objects tab.", type: Number, default: 5, range: { min: 0, max: 100, step: 1 } });
    reg("fullResale", { name: /*t*/"Full resale price for gems, jewelry and art", hint: /*t*/"Gems, jewelry and art objects are trade goods: merchants buy and sell them at their full value (D35E's Full Resale Price). Applies to generated pieces and to gems taken from this module's compendiums. Off: merchants buy them at half price, like other items.", type: Boolean, default: true });
    game.settings.register(MOD, "valueRolls", { scope: "world", config: false, type: Object, default: {}, onChange: () => { CAT = null; } });
    // The Gem and art values window (a settings menu opens a window; this one opens a dialog)
    const Base = foundry.applications?.api?.ApplicationV2 ?? (typeof FormApplication !== "undefined" ? FormApplication : null);
    if (Base) {
      class GemstonesValues extends Base { render() { openValues(); return this; } }
      game.settings.registerMenu(MOD, "values", {
        name: /*t*/"Gem and art values", label: /*t*/"Value rolls and base values", icon: "fas fa-coins", restricted: true, type: GemstonesValues,
        hint: /*t*/"Your own value roll and base value for each of the 6 gem values and the 12 art values (blank keeps the SRD's), and the rule that a rolled value is never below the base value.",
      });
    }
    // "Shared treasure lists library" and "Shared library folder" are registered by the shared script (axecleft-treasure.js).
  });

  // Pieces taken from this module's compendiums (dragged or dropped, or by a merchant): Full Resale Price as set, and a gem's
  // value rolled with the GM's formula for its grade (generated pieces already carry both)
  Hooks.on("preCreateItem", (item, data) => {
    try {
      if (item.type !== "loot") return;
      const src = String(item._stats?.compendiumSource ?? item.flags?.core?.sourceId ?? "");
      const fromHere = src.startsWith(`Compendium.${MOD}.`);
      if (!fromHere && !item.flags?.[MOD]?.generated) return;
      const update = {};
      const full = setting("fullResale") !== false;
      if (!!item.system?.fullResalePrice !== full) update["system.fullResalePrice"] = full;
      const grade = src.match(new RegExp(`^Compendium\\.${MOD}\\.gems-(\\d+)-gp\\.`))?.[1];
      if (grade && !item.flags?.[MOD]?.generated) {
        const v = valueSettings(), o = v.gems?.[grade] ?? {}, g = (GEMS?.grades ?? []).find((x) => String(x.value) === grade);
        const formula = String(o.formula ?? "").trim() || g?.formula, base = Number(o.base) > 0 ? Number(o.base) : Number(grade);
        const changes = foundry.utils.deepClone(item.system?.creationChanges ?? []);
        const i = changes.findIndex((c) => (Array.isArray(c) ? c[0] : c?.target) === "price");
        if (formula && i >= 0 && (o.formula || o.base || v.minBase)) {
          const f = `((${C.withMinBase(formula, base, v.minBase)}))`;
          if (Array.isArray(changes[i])) changes[i][1] = f; else changes[i].formula = f;
          update["system.creationChanges"] = changes;
        }
        if (Number(o.base) > 0) update["system.unidentified.price"] = base;
      }
      if (Object.keys(update).length) item.updateSource(update);
    } catch (err) { console.warn(`${MOD} | compendium piece`, err); }
  });

  Hooks.once("ready", () => {
    const mod = game.modules.get(MOD);
    if (mod) mod.api = API;
    loadData().catch(() => {}); // the gem grades, for pieces dragged from the compendiums
    packsFullResale().catch((err) => console.warn(`${MOD} | compendium gems`, err));
  });
}
