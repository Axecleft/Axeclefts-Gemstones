/**
 * Axecleft's Gemstones — treasure rules (no Foundry needed, testable in Node).
 *
 * Nothing here is stored as finished items. A gem, art object or piece of
 * jewelry is assembled from small lists (gem types, objects, materials,
 * embellishments, size and quality steps) at the moment it is generated.
 */

export const MOD = "axecleft-gemstones";

/* -------------------------------------------- */
/*  Dice and random picks                       */
/* -------------------------------------------- */

/** Roll a simple formula such as "2d4*10", "((4d4)*10)*2.5" or "3". */
export function rollDice(formula, rng = Math.random) {
  const expr = String(formula).replace(/\s+/g, "").replace(/(\d*)d(\d+)/gi, (_, n, s) => {
    let t = 0;
    for (let i = 0; i < (+n || 1); i++) t += 1 + Math.floor(rng() * +s);
    return String(t);
  });
  if (!/^[\d+\-*/().]+$/.test(expr)) throw new Error(`Can't roll "${formula}"`);
  return Function(`"use strict"; return (${expr});`)();
}

/** Average of a simple formula (used for previews). */
export function averageOf(formula) {
  const expr = String(formula).replace(/\s+/g, "").replace(/(\d*)d(\d+)/gi, (_, n, s) => String((+n || 1) * (+s + 1) / 2));
  return Function(`"use strict"; return (${expr});`)();
}

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
export const gp = (n) => `${Number(round2(n)).toLocaleString("en-US")} gp`;
const article = (w) => (/^[aeiou]/i.test(w) && !/^(uni|eu|one)/i.test(w) ? "an" : "a");
export const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* -------------------------------------------- */
/*  Catalog: built-in lists + the GM's lists    */
/* -------------------------------------------- */

/**
 * Merge the module's data with the GM's custom lists.
 * custom = { gems, objects, materials, embellishments, disabled } (rows from the Treasure Lists journal)
 */
export function buildCatalog(gemData, artData, custom = {}) {
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
  return {
    grades: gemData.grades, sizes: gemData.sizes, gemQualities: gemData.qualities,
    levels: artData.levels, artQualities: artData.qualities, makes: artData.makes, jewelryImg: artData.jewelryImg,
    goodsByLevel: artData.goodsByLevel,
    gems: dedupe(gems), objects: dedupe(objects), materials: dedupe(materials), embellishments: dedupe(embellishments),
  };
}

/* -------------------------------------------- */
/*  Gems                                        */
/* -------------------------------------------- */

export const SOURCES = { srd: "SRD", homebrew: "Homebrew", custom: "Custom" };

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
    if (!gem) throw new Error(`Gem "${rest.join("|")}" is not in the lists`);
  } else {
    const pool = gemsFor(cat, { sources });
    if (!pool.length) throw new Error("No gems match those sources.");
    let grades = cat.grades.filter((g) => pool.some((x) => x.grade === g.value));
    if (opts.grade) grades = grades.filter((g) => g.value === Number(opts.grade));
    if (!grades.length) throw new Error(`No ${opts.grade} gp gems in the chosen lists.`);
    const grade = weighted(grades, rng).value;
    gem = pickOne(pool.filter((g) => g.grade === grade), rng);
  }
  const grade = cat.grades.find((g) => g.value === gem.grade);
  const vary = opts.variations !== false;
  const size = vary ? (cat.sizes.find((s) => s.key === opts.size) ?? weighted(cat.sizes, rng)) : cat.sizes.find((s) => s.key === "standard");
  const quality = vary ? (cat.gemQualities.find((q) => q.key === opts.quality) ?? weighted(cat.gemQualities, rng)) : cat.gemQualities.find((q) => q.key === "average");
  const mult = size.mult * quality.mult;
  const name = [size.key !== "standard" && size.label, quality.key !== "average" && quality.label, gem.name].filter(Boolean).join(", ");
  return {
    kind: "gem", name, gem: gem.name, source: gem.source, appraiseAs: gem.appraiseAs, img: gem.img,
    base: grade.value, formula: grade.formula, size: size.key, quality: quality.key, mult, variations: vary,
    priceFormula: mult === 1 ? `((${grade.formula}))` : `(((${grade.formula}))*${mult})`,
    range: [averageOf(grade.formula.replace(/(\d*)d(\d+)/gi, (_, n) => String(+n || 1))) * mult, averageOf(grade.formula.replace(/(\d*)d(\d+)/gi, (_, n, s) => String((+n || 1) * +s))) * mult],
    desc: gem.desc, unid: gem.unid,
  };
}

/** The size × quality multiplier table, with this gem's cell marked. */
export function multiplierTable(cat, spec) {
  const head = cat.sizes.map((s) => `<th>${s.label}</th>`).join("");
  const rows = cat.gemQualities.map((q) => `<tr><th>${q.label}</th>${cat.sizes.map((s) => {
    const v = Number((s.mult * q.mult).toFixed(4));
    return s.key === spec.size && q.key === spec.quality ? `<td><strong>×${v}</strong></td>` : `<td>×${v}</td>`;
  }).join("")}</tr>`).join("");
  return `<table class="axecleft-mult"><thead><tr><th>Value multipliers</th>${head}</tr></thead><tbody>${rows}</tbody></table>`;
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

/** Display name of an object made of a material (and gem). */
export function artName(obj, material, gem) {
  let core;
  if (obj.fixedMaterial !== undefined || !material) core = obj.name;
  else if (obj.make === "Book") core = `${obj.name} bound in ${material.name}`;
  else core = `${material.adj ?? material.name} ${obj.name}`;
  if (gem) core += ` ${obj.make === "Book" ? "decorated" : obj.kind === "jewelry" ? "set" : obj.make === "Carved" ? "inlaid" : obj.make === "Clothing" ? "adorned" : "set"} with ${gem.name}`;
  return core;
}

/**
 * Roll one art object or piece of jewelry.
 * opts: kind ("art" | "jewelry" | "any"), level (1-12), object, material, gem (name | "none"), quality, variations
 */
export function rollArt(cat, opts = {}, rng = Math.random) {
  const kind = opts.kind ?? "any";
  const level = cat.levels.find((l) => l.level === Number(opts.level)) ?? weighted(cat.levels, rng);
  let pool = objectsFor(cat, kind);
  const chosenMat = opts.material ? cat.materials.find((m) => m.name === opts.material) : null;
  if (chosenMat && !opts.object) {
    const fit = pool.filter((o) => o.fixedMaterial === undefined && (chosenMat.uses ?? []).includes(o.make));
    if (fit.length) pool = fit;
  }
  const obj = opts.object ? cat.objects.find((o) => o.name === opts.object) : pickOne(pool, rng);
  if (!obj) throw new Error(opts.object ? `Object "${opts.object}" is not in the lists` : "No objects in the lists.");
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
  const name = quality.key === "average" ? core : `${quality.label}, ${core}`;
  const mult = quality.mult;
  const lo = averageOf(level.formula.replace(/(\d*)d(\d+)/gi, (_, n) => String(+n || 1))) * mult;
  const hi = averageOf(level.formula.replace(/(\d*)d(\d+)/gi, (_, n, s) => String((+n || 1) * +s))) * mult;
  return {
    kind: obj.kind, name, core, object: obj.name, make: obj.make, material: material?.name ?? null, gem: gem?.name ?? null,
    quality: quality.key, qualityLabel: quality.label, qualityText: quality.text, variations: vary,
    level: level.level, base: level.avg, formula: level.formula, mult, range: [lo, hi],
    priceFormula: mult === 1 ? `((${level.formula}))` : `(((${level.formula}))*${mult})`,
    img: obj.img || (obj.kind === "jewelry" ? cat.jewelryImg : make.img), weight: Number(obj.weight) || 0, objDesc: obj.desc ?? "",
  };
}

/** Description HTML for an art object: what anyone sees, and what an appraiser learns. */
export function artDescriptions(cat, s) {
  const make = cat.makes[s.make] ?? cat.makes.Molded;
  const what = s.material && !cat.objects.find((o) => o.name === s.object)?.fixedMaterial
    ? `${article(s.object)} ${s.object.toLowerCase()} ${make.verb} ${s.material.toLowerCase()}`
    : `${article(s.object)} ${s.object.toLowerCase()}`;
  const gemTxt = s.gem ? `, ${make.gem} ${s.gem.toLowerCase()}` : "";
  const kindTxt = s.kind === "jewelry" ? "A piece of jewelry" : "An art object";
  const seen = `<h3>${esc(s.core)}</h3><p>${kindTxt}: ${esc(what + gemTxt)}.</p>${s.objDesc ? `<p>${esc(s.objDesc)}</p>` : ""}`;
  const unid = `${seen}<p>It looks to be worth about ${gp(s.base)}. Its true value is unknown until it is appraised.</p>`;
  const quality = s.variations ? `<p><strong>Quality: ${esc(s.qualityLabel)}.</strong> ${esc(s.qualityText)}</p>` : "";
  const value = `<p><strong>Appraised value:</strong> SRD art object value ${s.level} (${s.formula.replace("*", " × ")} gp)${s.mult !== 1 ? ` × ${s.mult} for ${s.qualityLabel.toLowerCase()} quality` : ""}: ${gp(s.range[0])} to ${gp(s.range[1])}.</p>`;
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
  if (!row) throw new Error(`No goods row for encounter level ${el}`);
  const roll = 1 + Math.floor(rng() * 100);
  if (roll <= row.none) return { level: row.level, roll, type: "none", dice: null, count: 0, items: [] };
  const type = roll <= row.gemsTo ? "gems" : "art";
  const dice = type === "gems" ? row.gems : row.art;
  const count = Math.max(1, Math.round(rollDice(dice, rng)));
  const items = [];
  for (let i = 0; i < count; i++) {
    items.push(type === "gems"
      ? rollGem(cat, { sources: gem.sources, variations: gem.variations }, rng)
      : rollArt(cat, { kind: art.kind ?? "any", variations: art.variations }, rng));
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
      unidentified: { price: spec.base, name: spec.kind === "gem" ? spec.appraiseAs : spec.core },
      creationChanges: rollNow ? [] : [["price", spec.priceFormula]],
    },
    flags: { [MOD]: { generated: { ...strip(spec), price: rollNow ? price : null } } },
  };
}
const strip = (s) => { const { desc, unid, objDesc, qualityText, ...rest } = s; return rest; };

/** One-line summary for chat cards. */
export function summary(spec, price = null) {
  const value = price != null ? `true value ${gp(price)}` : `true value ${gp(spec.range[0])}–${gp(spec.range[1])}, rolled when added to a character`;
  const what = spec.kind === "gem" ? `${SOURCES[spec.source] ?? spec.source} gem, base ${gp(spec.base)}` : `${spec.kind === "jewelry" ? "Jewelry" : "Art"}, value ${spec.level}, base ${gp(spec.base)}`;
  return `${what}; ${value}`;
}
