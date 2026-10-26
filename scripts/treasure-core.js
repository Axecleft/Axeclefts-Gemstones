/**
 * Axecleft's Gemstones — treasure rules (no Foundry needed, testable in Node).
 *
 * Nothing here is stored as finished items. A gem, art object or piece of
 * jewelry is assembled from small lists (gem types, objects, materials,
 * embellishments, size and quality steps) at the moment it is generated.
 */

export const MOD = "axecleft-gemstones";

/** Text in the world's language (Axecleft's Tools 8.2 language files: lang/<code>.json), else the English. {placeholders} are filled from data. */
export const t = (s, d) => globalThis.AxecleftTools?.t?.(s, d) ?? (d ? String(s).replace(/\{(\w+)\}/g, (m, k) => d[k] ?? m) : String(s));
/** A name or phrase from a pattern, in the world's language (Axecleft's Tools 8.3 grammar); { lang: "en" } for the English one. */
/** A word for N(): its English, with the text to show when the word file has none (Axecleft's Tools 8.4 word files: gender, forms). */
export const W = (en, text = null) => globalThis.AxecleftTools?.word?.(en, { text }) ?? (text ?? en);
export const N = (p, s = {}, o = {}) => globalThis.AxecleftTools?.compose?.(p, s, o) ?? String(p).replace(/\[([^\]]*)\]/g, (m, g) => ([...g.matchAll(/\{(\w+)[^}]*\}/g)].every(([, k]) => s[k] !== undefined && s[k] !== "" && s[k] !== null && !(Array.isArray(s[k]) && !s[k].length)) ? g : "")).replace(/\{(\w+)([^}]*)\}/g, (m, k, mods) => { let v = [s[k] ?? ""].flat().map((x) => x?.text ?? x).join(" "); if (/lower/.test(mods)) v = v.toLowerCase(); if (/:a\b/.test(mods) && v) v = `${/^[aeiou]/i.test(v) && !/^(uni|eu|one)/i.test(v) ? "an" : "a"} ${v}`; return v; }).replace(/\s{2,}/g, " ").trim();
/** Names and phrases (patterns translated in lang/<code>.json; Axecleft's Tools 8.3 grammar). */
export const GEM_NAME = /*t*/"[{size}, ][{quality}, ]{gem}";
/** Art and jewelry names by how the gem is attached: set (molded, and all jewelry), inlaid (carved), adorned (cloth), decorated (books). */
export const ART_NAMES = {
  set: /*t*/"[{quality}, ]{material} {object}[ set with {gem}]",
  inlaid: /*t*/"[{quality}, ]{material} {object}[ inlaid with {gem}]",
  adorned: /*t*/"[{quality}, ]{material} {object}[ adorned with {gem}]",
  book: /*t*/"[{quality}, ]{object}[ bound in {material}][ decorated with {gem}]",
};
/** What an art object is, in its description ("a relief panel carved from soapstone, inlaid with jade"), by construction. */
export const ART_PHRASES = {
  Molded: /*t*/"{object:a:lower}[ cast and worked in {material:lower}][, set with {gem:lower}]",
  Carved: /*t*/"{object:a:lower}[ carved from {material:lower}][, inlaid with {gem:lower}]",
  Clothing: /*t*/"{object:a:lower}[ made of {material:lower}][, adorned with {gem:lower}]",
  Book: /*t*/"{object:a:lower}[ bound in {material:lower}][, decorated with {gem:lower}]",
};
/** A word from the data lists in the world's language: the word file's (with its gender and forms), else the language file's, else as written. */
const tw = (s) => (s ? W(s, t(s)) : s);
/** A number in the world's language format. */
export const num = (n) => { const l = globalThis.AxecleftTools?.i18n?.lang; return Number(n).toLocaleString(l && l !== "en" ? l : "en-US"); };
/** Size, quality and construction labels from data/gems.json and data/art.json, for the dropdowns (generated names stay English until the word files). */
export const DATA_WORDS = [/*t*/"Tiny", /*t*/"Small", /*t*/"Standard", /*t*/"Large", /*t*/"Huge", /*t*/"Flawed", /*t*/"Common", /*t*/"Average", /*t*/"Fine", /*t*/"Exceptional",
  /*t*/"Junk", /*t*/"Masterpiece", /*t*/"Molded / cast", /*t*/"Carved", /*t*/"Cloth / hide", /*t*/"Book / document"];

/* -------------------------------------------- */
/*  Dice and random picks                       */
/* -------------------------------------------- */

/** Functions a value formula may use (as Foundry's dice rolls do): "max(10, 4d4)" is never below 10. */
const FNS = ["max", "min", "floor", "ceil", "round", "abs"];
/** Evaluate a formula whose dice are already numbers: digits, + - * / ( ) . , and the functions above. */
function evalFormula(expr, formula) {
  const bare = expr.replace(new RegExp(`\\b(${FNS.join("|")})\\(`, "g"), "(");
  if (!/^[\d+\-*/().,]+$/.test(bare)) throw new Error(t("Can't roll \"{formula}\"", { formula }));
  return Function(...FNS, `"use strict"; return (${expr});`)(...FNS.map((f) => Math[f]));
}
/** Roll a simple formula such as "2d4*10", "((4d4)*10)*2.5", "max(10, 4d4)" or "3". */
export function rollDice(formula, rng = Math.random) {
  const expr = String(formula).replace(/\s+/g, "").replace(/(\d*)d(\d+)/gi, (_, n, s) => {
    let sum = 0;
    for (let i = 0; i < (+n || 1); i++) sum += 1 + Math.floor(rng() * +s);
    return String(sum);
  });
  return evalFormula(expr, formula);
}

/** Average of a simple formula (used for previews). */
export function averageOf(formula) {
  const expr = String(formula).replace(/\s+/g, "").replace(/(\d*)d(\d+)/gi, (_, n, s) => String((+n || 1) * (+s + 1) / 2));
  return evalFormula(expr, formula);
}
/** Lowest and highest a formula can roll. */
export function rangeOf(formula) {
  const f = String(formula).replace(/\s+/g, "");
  return [evalFormula(f.replace(/(\d*)d(\d+)/gi, (_, n) => String(+n || 1)), formula), evalFormula(f.replace(/(\d*)d(\d+)/gi, (_, n, s) => String((+n || 1) * +s)), formula)];
}
/** A value formula with the GM's rule that the roll is never below the base value. */
export const withMinBase = (formula, base, on) => (on ? `max(${Number(base) || 0}, (${formula}))` : formula);

/** Pick from [{w, ...}] by weight; entries without w count as 1. */
export function weighted(list, rng = Math.random) {
  const total = list.reduce((a, e) => a + (e.w ?? 1), 0);
  let r = rng() * total;
  for (const e of list) if ((r -= e.w ?? 1) < 0) return e;
  return list[list.length - 1];
}
const pickOne = (list, rng) => list[Math.floor(rng() * list.length)];

const norm = (s) => String(s ?? "").trim().toLowerCase();
const round2 = (n) => Math.round(n * 100) / 100;
export const gp = (n) => t("{n} gp", { n: num(round2(n)) });
const article = (w) => (/^[aeiou]/i.test(w) && !/^(uni|eu|one)/i.test(w) ? "an" : "a");
export const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* -------------------------------------------- */
/*  Catalog: built-in lists + the GM's lists    */
/* -------------------------------------------- */

/**
 * Merge the module's data with the GM's custom lists.
 * custom = { gems, objects, materials, embellishments, disabled } (rows from the Treasure Lists journal)
 */
export function buildCatalog(gemData, artData, custom = {}, premade = [], values = {}) {
  const off = new Set((custom.disabled ?? []).map((d) => `${norm(d.list)}|${norm(d.name)}`));
  const on = (list, name) => !off.has(`${list}|${norm(name)}`) && !off.has(`any|${norm(name)}`);
  const gradeOf = (v) => gemData.grades.reduce((best, g) => (Math.abs(g.value - v) < Math.abs(best.value - v) ? g : best)).value;

  const gems = [
    ...gemData.srd.map((g) => ({ ...g, source: "srd" })),
    ...gemData.homebrew.map((g) => ({ ...g, source: "homebrew" })),
    ...(custom.gems ?? []).map((g) => ({
      name: g.name, appraiseAs: g.appraiseAs || g.name, grade: gradeOf(Number(g.grade) || 10), img: g.img || "icons/commodities/gems/gem-faceted-round-white.webp",
      desc: g.desc || `<p>${esc(g.name)}.</p>`, unid: g.unid || g.desc || `<p>${esc(g.appraiseAs || g.name)}.</p>`, source: "custom",
    })),
  ].filter((g) => on("gems", g.name) && on(g.source, g.name));

  const objects = [
    ...artData.objects.map((o) => ({ ...o, source: "module" })),
    // Premade pieces (data/premade-art.json and the Custom Premade Art list): generated exactly as made, with no material, gem or quality.
    ...[...(premade ?? []).map((p) => ({ p, source: "module" })), ...(custom.premade ?? []).map((p) => ({ p, source: "custom" }))]
      .filter(({ p }) => on("premade", p.name))
      .map(({ p, source }) => ({ name: p.name, make: p.make, kind: p.kind ?? "art", fixedMaterial: "", weight: p.weight, premade: p, source })),
    ...(custom.objects ?? []).map((o) => ({ ...o, source: "custom" })),
  ].filter((o) => on("objects", o.name));
  const materials = [
    ...artData.materials.map((m) => ({ ...m, source: "module" })),
    ...(custom.materials ?? []).map((m) => ({ ...m, source: "custom" })),
  ].filter((m) => on("materials", m.name));
  const embellishments = [
    ...artData.gemstones.map((g) => ({ ...g, source: "module" })),
    ...(custom.embellishments ?? []).map((g) => ({ ...g, source: "custom" })),
  ].filter((g) => on("embellishments", g.name));

  // Custom entries replace built-in ones with the same name.
  const dedupe = (list) => {
    const m = new Map();
    for (const e of list) { const k = `${e.source === "srd" ? "srd" : "x"}|${norm(e.name)}`; if (!m.has(k) || e.source === "custom") m.set(k, e); }
    return [...m.values()];
  };
  // The GM's value rolls and base values (Gemstones settings: Gem and art values): blank keeps the SRD's
  const ov = (list, key) => (values?.[list]?.[key] ?? {});
  const grades = gemData.grades.map((g) => { const o = ov("gems", g.value); return { ...g, srdFormula: g.formula, formula: String(o.formula ?? "").trim() || g.formula, base: Number(o.base) > 0 ? Number(o.base) : g.value }; });
  const levels = artData.levels.map((l) => { const o = ov("art", l.level); return { ...l, srdFormula: l.formula, srdAvg: l.avg, formula: String(o.formula ?? "").trim() || l.formula, avg: Number(o.base) > 0 ? Number(o.base) : l.avg }; });
  return {
    minBase: !!values?.minBase, fullResale: values?.fullResale !== false,
    grades, sizes: gemData.sizes, gemQualities: gemData.qualities,
    levels, artQualities: artData.qualities, makes: artData.makes, jewelryImg: artData.jewelryImg,
    goodsByLevel: artData.goodsByLevel,
    gems: dedupe(gems), objects: dedupe(objects), materials: dedupe(materials), embellishments: dedupe(embellishments),
  };
}

/* -------------------------------------------- */
/*  Gems                                        */
/* -------------------------------------------- */

export const SOURCES = { srd: "SRD", homebrew: /*t*/"Homebrew", custom: /*t*/"Custom" };
/** A gem list's name in the world's language. */
export const sourceName = (s) => (SOURCES[s] ? t(SOURCES[s]) : s);

/** Gems available from the chosen sources (optionally one grade). */
export function gemsFor(cat, { sources = ["srd", "homebrew", "custom"], grade = null } = {}) {
  return cat.gems.filter((g) => sources.includes(g.source) && (!grade || g.grade === Number(grade)));
}

/**
 * Roll one gem. opts: sources, grade, gem ("source|name"), size, quality (keys), variations (bool).
 * Returns a gem spec; the value itself is rolled later (when the item reaches an actor).
 */
export function rollGem(cat, opts = {}, rng = Math.random) {
  const sources = opts.sources?.length ? opts.sources : ["srd", "homebrew", "custom"];
  let gem = null;
  if (opts.gem) {
    const [src, ...rest] = String(opts.gem).split("|");
    gem = cat.gems.find((g) => g.source === src && g.name === rest.join("|"));
    if (!gem) throw new Error(t("Gem \"{gem}\" is not in the lists", { gem: rest.join("|") }));
  } else {
    const pool = gemsFor(cat, { sources });
    if (!pool.length) throw new Error(t("No gems match those sources."));
    let grades = cat.grades.filter((g) => pool.some((x) => x.grade === g.value));
    if (opts.grade) grades = grades.filter((g) => g.value === Number(opts.grade));
    if (!grades.length) throw new Error(t("No {value} gems in the chosen lists.", { value: gp(Number(opts.grade)) }));
    const grade = weighted(grades, rng).value;
    gem = pickOne(pool.filter((g) => g.grade === grade), rng);
  }
  const grade = cat.grades.find((g) => g.value === gem.grade);
  const vary = opts.variations !== false;
  const size = vary ? (cat.sizes.find((s) => s.key === opts.size) ?? weighted(cat.sizes, rng)) : cat.sizes.find((s) => s.key === "standard");
  const quality = vary ? (cat.gemQualities.find((q) => q.key === opts.quality) ?? weighted(cat.gemQualities, rng)) : cat.gemQualities.find((q) => q.key === "average");
  const mult = size.mult * quality.mult;
  const parts = (en) => ({ size: size.key !== "standard" ? (en ? size.label : tw(size.label)) : "", quality: quality.key !== "average" ? (en ? quality.label : tw(quality.label)) : "", gem: en ? gem.name : tw(gem.name) });
  const name = N(GEM_NAME, parts(false));
  const nameEn = N(GEM_NAME, parts(true), { lang: "en" });
  return {
    kind: "gem", name, nameEn, gem: gem.name, source: gem.source, appraiseAs: gem.appraiseAs, img: gem.img,
    base: grade.base ?? grade.value, formula: grade.formula, size: size.key, quality: quality.key, mult, variations: vary,
    priceFormula: mult === 1 ? `((${valueOf(cat, grade.formula, grade.base ?? grade.value)}))` : `(((${valueOf(cat, grade.formula, grade.base ?? grade.value)}))*${mult})`,
    range: rangeOf(valueOf(cat, grade.formula, grade.base ?? grade.value)).map((v) => v * mult),
    desc: gem.desc, unid: gem.unid,
  };
}

/** The formula an item's value is rolled with: the grade's or level's, never below its base value when the GM says so. */
const valueOf = (cat, formula, base) => withMinBase(formula, base, cat.minBase);

/** The size × quality multiplier table, with this gem's cell marked. */
export function multiplierTable(cat, spec) {
  const head = cat.sizes.map((s) => `<th>${s.label}</th>`).join("");
  const rows = cat.gemQualities.map((q) => `<tr><th>${q.label}</th>${cat.sizes.map((s) => {
    const v = Number((s.mult * q.mult).toFixed(4));
    return s.key === spec.size && q.key === spec.quality ? `<td><strong>×${v}</strong></td>` : `<td>×${v}</td>`;
  }).join("")}</tr>`).join("");
  return `<table class="axecleft-mult"><thead><tr><th>${esc(t("Value multipliers"))}</th>${head}</tr></thead><tbody>${rows}</tbody></table>`;
}

/* -------------------------------------------- */
/*  Art objects and jewelry                     */
/* -------------------------------------------- */

export function objectsFor(cat, kind = "any") {
  return cat.objects.filter((o) => kind === "any" || o.kind === kind);
}
/** Materials an object can be made of; with a level, only those that fit it. */
export function materialsFor(cat, obj, level = null) {
  const fits = cat.materials.filter((m) => (m.uses ?? []).includes(obj.make));
  if (!level) return fits;
  const inRange = fits.filter((m) => m.minLevel <= level && level <= m.maxLevel);
  return inRange.length ? inRange : fits;
}
export function embellishmentsFor(cat, level = null) {
  if (!level) return cat.embellishments;
  const inRange = cat.embellishments.filter((g) => g.minLevel <= level && level <= g.maxLevel);
  return inRange.length ? inRange : cat.embellishments;
}
/** Chance that a randomly rolled piece carries a gemstone. */
export const gemChance = (kind, level) => (kind === "jewelry" ? Math.min(0.85, 0.25 + 0.05 * level) : Math.min(0.45, 0.05 + 0.03 * level));

/** Display name of an object made of a material (and gem), with its quality word if any; { en: true } for the English name. */
export function artName(obj, material, gem, { quality = "", en = false } = {}) {
  const pattern = ART_NAMES[obj.make === "Book" ? "book" : obj.kind === "jewelry" ? "set" : obj.make === "Carved" ? "inlaid" : obj.make === "Clothing" ? "adorned" : "set"];
  const w = (s) => (en ? s ?? "" : tw(s ?? ""));
  const mat = obj.fixedMaterial !== undefined || !material ? "" : obj.make === "Book" ? material.name : material.adj ?? material.name;
  return N(pattern, { quality: w(quality), material: w(mat), object: w(obj.name), gem: gem ? w(gem.name) : "" }, en ? { lang: "en" } : {});
}

/**
 * Roll one art object or piece of jewelry.
 * opts: kind ("art" | "jewelry" | "any"), level (1-12), object, material, gem (name | "none"), quality, variations
 */
export function rollArt(cat, opts = {}, rng = Math.random) {
  const kind = opts.kind ?? "any";
  const level = cat.levels.find((l) => l.level === Number(opts.level)) ?? weighted(cat.levels, rng);
  // Premade pieces: a random pick takes one only at its own value row, and only premadeShare % of the time (default 5).
  const all = objectsFor(cat, kind);
  let pool = all.filter((o) => !o.premade);
  const premades = all.filter((o) => o.premade && o.premade.level === level.level);
  const chosenMat = opts.material ? cat.materials.find((m) => m.name === opts.material) : null;
  if (chosenMat && !opts.object) {
    const fit = pool.filter((o) => o.fixedMaterial === undefined && (chosenMat.uses ?? []).includes(o.make));
    if (fit.length) pool = fit;
  }
  const share = Math.min(100, Math.max(0, Number(opts.premadeShare ?? 5)));
  const takePremade = !opts.object && !chosenMat && premades.length && share > 0 && (!pool.length || rng() * 100 < share);
  const obj = opts.object ? cat.objects.find((o) => o.name === opts.object) : pickOne(takePremade ? premades : pool, rng);
  if (!obj) throw new Error(opts.object ? t("Object \"{object}\" is not in the lists", { object: opts.object }) : t("No objects in the lists."));
  if (obj.premade) return premadeSpec(cat, obj.premade);
  const make = cat.makes[obj.make] ?? cat.makes.Molded;

  let material = null;
  if (obj.fixedMaterial === undefined) {
    material = opts.material ? cat.materials.find((m) => m.name === opts.material) : pickOne(materialsFor(cat, obj, level.level), rng) ?? null;
  } else if (obj.fixedMaterial) material = cat.materials.find((m) => m.name === obj.fixedMaterial) ?? { name: obj.fixedMaterial };

  let gem = null;
  if (opts.gem && opts.gem !== "none") gem = cat.embellishments.find((g) => g.name === opts.gem) ?? { name: opts.gem };
  else if (!opts.gem && rng() < gemChance(obj.kind, level.level)) gem = pickOne(embellishmentsFor(cat, level.level), rng) ?? null;

  const vary = opts.variations !== false;
  const quality = vary ? (cat.artQualities.find((q) => q.key === opts.quality) ?? weighted(cat.artQualities, rng)) : cat.artQualities.find((q) => q.key === "average");
  const core = artName(obj, material, gem);
  const coreEn = artName(obj, material, gem, { en: true });
  const name = quality.key === "average" ? core : artName(obj, material, gem, { quality: quality.label });
  const nameEn = quality.key === "average" ? coreEn : artName(obj, material, gem, { quality: quality.label, en: true });
  const mult = quality.mult;
  const vf = valueOf(cat, level.formula, level.avg);
  const [lo, hi] = rangeOf(vf).map((v) => v * mult);
  return {
    kind: obj.kind, name, nameEn, core, coreEn, object: obj.name, make: obj.make, material: material?.name ?? null, gem: gem?.name ?? null,
    quality: quality.key, qualityLabel: quality.label, qualityText: quality.text, variations: vary,
    level: level.level, base: level.avg, formula: level.formula, mult, range: [lo, hi],
    priceFormula: mult === 1 ? `((${vf}))` : `(((${vf}))*${mult})`,
    img: obj.img || (obj.kind === "jewelry" ? cat.jewelryImg : make.img), weight: Number(obj.weight) || 0, objDesc: obj.desc ?? "",
  };
}

/** A premade piece, as it was made: its own name, description, picture, weight and value (no material, gem or quality). */
export function premadeSpec(cat, p) {
  const dice = String(p.formula);
  const lo = averageOf(dice.replace(/(\d*)d(\d+)/gi, (_, n) => String(+n || 1)));
  const hi = averageOf(dice.replace(/(\d*)d(\d+)/gi, (_, n, s) => String((+n || 1) * +s)));
  const name = tw(p.name)?.text || p.name;
  return {
    kind: p.kind ?? "art", name, nameEn: p.name, core: name, coreEn: p.name, object: p.name, make: p.make, material: null, gem: null,
    quality: "average", qualityLabel: "Average", qualityText: "", variations: false,
    level: p.level, base: Math.round(Number(p.avg) || averageOf(dice)), formula: dice, mult: 1, range: [lo, hi], priceFormula: `((${dice}))`,
    img: p.img || (cat.makes[p.make] ?? cat.makes.Molded).img, weight: Number(p.weight) || 0, objDesc: "",
    premade: true, creator: p.creator ?? "", premadeDesc: p.desc ?? "", tags: p.tags ?? [], sourceText: p.source ?? "", subType: p.subType ?? "misc",
  };
}

/** Description HTML for an art object: what anyone sees, and what an appraiser learns. */
export function artDescriptions(cat, s) {
  // "a relief panel carved from soapstone, inlaid with jade" (Axecleft's Tools 8.3 grammar: word order, articles and agreement of the world's language)
  const withMaterial = s.material && !cat.objects.find((o) => o.name === s.object)?.fixedMaterial;
  const what = N(ART_PHRASES[s.make] ?? ART_PHRASES.Molded, { object: tw(s.object), material: withMaterial ? tw(s.material) : "", gem: tw(s.gem ?? "") }, { phrase: true });
  const kindTxt = t(s.kind === "jewelry" ? "A piece of jewelry: {what}." : "An art object: {what}.", { what });
  const seen = `<h3>${esc(s.core)}</h3><p>${esc(kindTxt)}</p>${s.objDesc ? `<p>${esc(s.objDesc)}</p>` : ""}`;
  const unid = `${seen}<p>${esc(t("It looks to be worth about {value}. Its true value is unknown until it is appraised.", { value: gp(s.base) }))}</p>`;
  const quality = s.variations ? `<p><strong>${esc(t("Quality: {quality}.", { quality: t(s.qualityLabel) }))}</strong> ${esc(s.qualityText)}</p>` : "";
  const rule = t("SRD art object value {level} ({formula} gp)", { level: s.level, formula: s.formula.replace("*", " × ") })
    + (s.mult !== 1 ? t(" × {mult} for {quality} quality", { mult: s.mult, quality: t(s.qualityLabel).toLowerCase() }) : "");
  const value = `<p><strong>${esc(t("Appraised value:"))}</strong> ${esc(t("{rule}: {low} to {high}.", { rule, low: gp(s.range[0]), high: gp(s.range[1]) }))}</p>`;
  return { value: seen + quality + value, unidentified: unid };
}

/* -------------------------------------------- */
/*  Goods by encounter level (SRD Treasure)     */
/* -------------------------------------------- */

/**
 * Roll the SRD "Goods" column for an encounter level: nothing, gems or art objects.
 * Returns { level, roll, type: "none" | "gems" | "art", dice, count, items: [specs] }.
 */
export function rollGoods(cat, el, { gem = {}, art = {} } = {}, rng = Math.random) {
  const row = cat.goodsByLevel.find((r) => r.level === Number(el));
  if (!row) throw new Error(t("No goods row for encounter level {el}", { el }));
  const roll = 1 + Math.floor(rng() * 100);
  if (roll <= row.none) return { level: row.level, roll, type: "none", dice: null, count: 0, items: [] };
  const type = roll <= row.gemsTo ? "gems" : "art";
  const dice = type === "gems" ? row.gems : row.art;
  const count = Math.max(1, Math.round(rollDice(dice, rng)));
  const items = [];
  for (let i = 0; i < count; i++) {
    items.push(type === "gems"
      ? rollGem(cat, { sources: gem.sources, variations: gem.variations }, rng)
      : rollArt(cat, { kind: art.kind ?? "any", variations: art.variations, premadeShare: art.premadeShare }, rng));
  }
  return { level: row.level, roll, type, dice, count, items };
}

/* -------------------------------------------- */
/*  D35E loot item data                         */
/* -------------------------------------------- */

/**
 * Item data for a rolled spec. The item starts unidentified at its base value.
 * rollNow = false: the true value is a creation change, rolled by D35E when the
 *   item is added to a character (as the module's compendium gems work).
 * rollNow = true: the value is rolled here (used when creating straight onto a character).
 */
export function itemData(cat, spec, { rollNow = false, rng = Math.random } = {}) {
  if (spec.premade) return premadeItemData(spec, { rollNow, rng, fullResale: cat.fullResale !== false });
  let desc, unid, weight;
  if (spec.kind === "gem") {
    desc = spec.desc + (spec.variations ? multiplierTable(cat, spec) : "");
    unid = spec.unid;
    weight = 0;
  } else {
    ({ value: desc, unidentified: unid } = artDescriptions(cat, spec));
    weight = spec.weight;
  }
  const price = rollNow ? round2(rollDice(spec.priceFormula, rng)) : 0;
  return {
    name: spec.name,
    type: "loot",
    img: spec.img,
    system: {
      description: { value: desc, unidentified: unid, chat: "" },
      subType: "tradeGoods",
      quantity: 1,
      weight,
      price,
      identified: false,
      carried: true,
      identifiedName: spec.name,
      fullResalePrice: cat.fullResale !== false, // trade goods: merchants buy and sell them at their full value (D35E)
      unidentified: { price: spec.base, name: spec.kind === "gem" ? (tw(spec.appraiseAs)?.text ?? spec.appraiseAs) : spec.core },
      creationChanges: rollNow ? [] : [["price", spec.priceFormula]],
    },
    flags: { [MOD]: { generated: { ...strip(spec), price: rollNow ? price : null } }, world: { axecleftEn: spec.nameEn ?? spec.name } },
  };
}
const strip = (s) => { const { desc, unid, objDesc, qualityText, premadeDesc, ...rest } = s; return rest; };

/** Item data for a premade piece: identified, in its original form, with its creator credited in the description. */
function premadeItemData(spec, { rollNow = false, rng = Math.random, fullResale = true } = {}) {
  const credit = spec.creator ? `<p><em>${esc(t("Created by {name}.", { name: spec.creator }))}</em></p>` : "";
  const price = rollNow ? round2(rollDice(spec.priceFormula, rng)) : 0;
  return {
    name: spec.name,
    type: "loot",
    img: spec.img,
    system: {
      description: { value: `${spec.premadeDesc}${credit}`, unidentified: "", chat: "" },
      subType: spec.subType || "misc",
      tags: [...(spec.tags ?? [])],
      source: spec.sourceText ?? "",
      quantity: 1,
      weight: spec.weight,
      price,
      identified: true,
      carried: true,
      identifiedName: spec.name,
      fullResalePrice: fullResale,
      unidentified: { price: spec.base, name: spec.name },
      creationChanges: rollNow ? [] : [["price", spec.priceFormula]],
    },
    flags: { [MOD]: { generated: { ...strip(spec), price: rollNow ? price : null } }, world: { axecleftEn: spec.nameEn ?? spec.name } },
  };
}

/** One-line summary for chat cards. */
export function summary(spec, price = null) {
  const value = price != null ? t("true value {value}", { value: gp(price) }) : t("true value {low}–{high}, rolled when added to a character", { low: gp(spec.range[0]), high: gp(spec.range[1]) });
  const what = spec.premade ? t("Art by {creator}, base {value}", { creator: spec.creator, value: gp(spec.base) }) : spec.kind === "gem" ? t("{list} gem, base {value}", { list: sourceName(spec.source), value: gp(spec.base) })
    : t(spec.kind === "jewelry" ? "Jewelry, value {level}, base {value}" : "Art, value {level}, base {value}", { level: spec.level, value: gp(spec.base) });
  return `${what}; ${value}`;
}
