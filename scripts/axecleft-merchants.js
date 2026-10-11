/**
 * Axecleft's Merchant Generator — shared script, version 7.5 (needs the Treasure Generator script version 9; 9.5 for the Epic campaign; 9.9 for epic stock).
 *
 * Copy this same file into every Axecleft module and list it in module.json
 * "esmodules" AFTER scripts/axecleft-tools.js and scripts/axecleft-treasure.js,
 * BEFORE the module's own scripts. Whichever copy has the highest version runs.
 *
 * Builds D35E merchants (an NPC on D35E's loot sheet in Merchant mode) and stocks
 * them from the same providers the Treasure Generator uses: Gemstones (gems, art,
 * jewelry), the D35E items compendium (alchemical items, tools and gear), and later
 * Axecleft's Armory (weapons, armor) and Axecleft's Curios (magic items).
 *
 * Open it from "Axecleft's Tools" on the left toolbar, or a macro:
 *   AxecleftMerchants.open();
 * Other modules can add shop types:
 *   AxecleftMerchants.registerMerchantType({ module, key, label, categories: { "mundane:weapon": 5, ... }, filter, tags });
 */
const AXECLEFT_MERCHANTS_VERSION = 7.5;
const AXECLEFT_MERCHANTS_HOST = (() => {
  try { return decodeURIComponent(new URL(import.meta.url).pathname).match(/\/modules\/([^/]+)\//)?.[1] ?? null; } catch (e) { return null; }
})();

(() => {
  const existing = globalThis.AxecleftMerchants;
  if (existing && existing.version >= AXECLEFT_MERCHANTS_VERSION) { existing.hosts?.add(AXECLEFT_MERCHANTS_HOST); return; }
  const hosts = existing?.hosts ?? new Set();
  if (AXECLEFT_MERCHANTS_HOST) hosts.add(AXECLEFT_MERCHANTS_HOST);
  const extraTypes = existing?.extraTypes ?? new Map();

  const T = () => globalThis.AxecleftTreasure;
  const STORE = "axecleft-merchants.";
  const FOLDER = "Merchants";
  const SHEET = "D35E.ActorSheetPFNPCLoot";
  const STOCK_TYPES = ["weapon", "equipment", "consumable", "loot"]; // item types a shop's stock is made of
  const FLAG_SCOPE = "world", FLAG_KEY = "axecleftMerchant";       // saved shop settings on the merchant actor
  const SET_TYPES = "axecleftMerchantTypes", SET_NAMES = "axecleftMerchantNames", SET_PORTRAITS = "axecleftMerchantPortraits";

  /* ------------------------------------------ */
  /*  Settlements, shop types, traits           */
  /* ------------------------------------------ */

  /** SRD community sizes and gp limits. Stock, purse and grades are this module's own defaults. */
  const SETTLEMENTS = [
    { key: "thorp", label: "Thorp", limit: 40, stock: "1d4+1", purse: "1d4*10", grades: ["minor"] },
    { key: "hamlet", label: "Hamlet", limit: 100, stock: "1d6+2", purse: "2d6*10", grades: ["minor"] },
    { key: "village", label: "Village", limit: 200, stock: "2d4+2", purse: "2d4*25", grades: ["minor"] },
    { key: "smalltown", label: "Small town", limit: 800, stock: "2d6+3", purse: "2d4*100", grades: ["minor"] },
    { key: "largetown", label: "Large town", limit: 3000, stock: "3d6+4", purse: "3d6*100", grades: ["minor", "medium"] },
    { key: "smallcity", label: "Small city", limit: 15000, stock: "4d6+5", purse: "2d4*1000", grades: ["minor", "medium"] },
    { key: "largecity", label: "Large city", limit: 40000, stock: "5d6+6", purse: "4d6*1000", grades: ["minor", "medium", "major"] },
    { key: "metropolis", label: "Metropolis", limit: 100000, stock: "6d6+8", purse: "6d6*1000", grades: ["minor", "medium", "major"] },
  ];
  const GRADE_WEIGHT = { minor: 60, medium: 30, major: 10 };
  const EPIC_STOCK = 0.1; // version 7.5: share of magic stock that is epic in an Epic campaign settlement

  /*
   * Shop types: Treasure categories with weights. Optional:
   *   filter: { kind: "jewelry" | "art", make: "Molded" | "Carved" | "Clothing" | "Book" }  (gems/art from Gemstones)
   *   tags:   hints passed to providers, e.g. ["ranged"] for a bowyer (used by the Armory once it exists)
   *   hints:  { category: [specialty tags] } limits a category to items carrying a Shop tag,
   *           e.g. { "magic:wondrous": ["Book"] }: a bookseller's wondrous items are tomes and manuals
   */
  const BASE_TYPES = [
    { key: "general", trade: "General Store", nouns: ["Lantern", "Barrel", "Wagon", "Scales"], label: "General store", categories: { "mundane:gear": 6, "mundane:alchemical": 2, "standard:weapon": 1, "standard:ammo": 1, "standard:armor": 1 } },
    { key: "outfitter", trade: "Outfitters", nouns: ["Pack", "Rope", "Compass", "Boot", "Lantern"], label: "Adventurer's outfitter", categories: { "mundane:gear": 5, "mundane:alchemical": 3, "standard:weapon": 1, "standard:ammo": 2, "standard:armor": 1, "magic:potion": 1 } },
    { key: "tradingpost", trade: "Trading Post", nouns: ["Wagon", "Scales", "Caravan", "Crossroads"], label: "Trading post", categories: { "mundane:gear": 3, "mundane:alchemical": 1, gem: 2, art: 2, "standard:weapon": 1, "standard:armor": 1, "standard:ammo": 1 } },
    { key: "blacksmith", trade: "Smithy", nouns: ["Anvil", "Hammer", "Forge", "Tongs"], label: "Blacksmith", categories: { "standard:weapon": 4, "standard:armor": 3, "standard:shield": 2, "standard:ammo": 1, "mundane:weapon": 1, "mundane:armor": 1, "mundane:gear": 1 } },
    { key: "weaponsmith", trade: "Blades", nouns: ["Blade", "Anvil", "Sword", "Forge"], label: "Weaponsmith", categories: { "standard:weapon": 6, "standard:ammo": 2, "mundane:weapon": 3, "magic:weapon": 1 } },
    { key: "armorer", trade: "Armory", nouns: ["Shield", "Helm", "Gauntlet", "Anvil"], label: "Armorer", categories: { "standard:armor": 5, "standard:shield": 3, "mundane:armor": 3, "magic:armor": 1 } },
    { key: "bowyer", trade: "Bows & Arrows", nouns: ["Arrow", "Bow", "Quiver", "Feather"], label: "Bowyer / fletcher", categories: { "standard:weapon": 5, "standard:ammo": 5, "mundane:weapon": 2, "magic:weapon": 1 }, tags: ["ranged"] },
    { key: "alchemist", trade: "Alchemy", nouns: ["Flask", "Retort", "Cauldron", "Phial"], label: "Alchemist", categories: { "mundane:alchemical": 6, "magic:potion": 3 } },
    { key: "herbalist", trade: "Herbs & Remedies", nouns: ["Mortar", "Herb", "Willow", "Root"], label: "Herbalist / apothecary", categories: { "magic:potion": 4, "mundane:alchemical": 3, "mundane:gear": 1 } },
    { key: "jeweler", trade: "Jewels", nouns: ["Gem", "Ring", "Pearl", "Facet"], label: "Jeweler", categories: { gem: 5, art: 4, "magic:ring": 1, "magic:wondrous": 1 }, filter: { kind: "jewelry" }, hints: { "magic:wondrous": ["Jewelry"] } },
    { key: "gemcutter", trade: "Gems", nouns: ["Facet", "Prism", "Gem", "Chisel"], label: "Gem cutter", categories: { gem: 1 } },
    { key: "silversmith", trade: "Silverworks", nouns: ["Goblet", "Chalice", "Crown", "Ingot"], label: "Gold- and silversmith", categories: { art: 1 }, filter: { make: "Molded" } },
    { key: "woodcarver", trade: "Carvings", nouns: ["Chisel", "Oak", "Statue", "Knot"], label: "Carver / sculptor", categories: { art: 1 }, filter: { make: "Carved" } },
    { key: "clothier", trade: "Clothiers", nouns: ["Needle", "Loom", "Spindle", "Thimble", "Fox"], label: "Clothier / furrier", categories: { art: 4, "mundane:gear": 1, "magic:wondrous": 1 }, filter: { make: "Clothing" }, hints: { "magic:wondrous": ["Clothing"] } },
    { key: "artdealer", trade: "Curios", nouns: ["Easel", "Frame", "Statue", "Urn"], label: "Art dealer / curio shop", categories: { art: 6, gem: 1 }, filter: { kind: "art" } },
    { key: "bookseller", trade: "Books", nouns: ["Tome", "Quill", "Page", "Inkwell"], label: "Bookseller", categories: { art: 3, "magic:scroll": 2, "magic:wondrous": 1 }, filter: { make: "Book" }, hints: { "magic:wondrous": ["Book"] } },
    { key: "scribe", trade: "Scriptorium", nouns: ["Quill", "Inkwell", "Scroll", "Seal"], label: "Scribe", categories: { "magic:scroll": 6, "mundane:gear": 1 } },
    { key: "temple", trade: "Temple Goods", nouns: ["Candle", "Censer", "Chalice", "Sun"], label: "Temple", categories: { "magic:potion": 3, "magic:scroll": 3, "mundane:alchemical": 2 } },
    { key: "wandwright", trade: "Wands", nouns: ["Wand", "Staff", "Star", "Rune"], label: "Wandwright / staff maker", categories: { "magic:wand": 5, "magic:staff": 2, "magic:rod": 2 } },
    { key: "magic", trade: "Arcana", nouns: ["Star", "Moon", "Grimoire", "Orb", "Sigil"], label: "Magic shop", categories: { "magic:potion": 3, "magic:scroll": 3, "magic:wand": 2, "magic:wondrous": 2, "magic:ring": 1, "magic:rod": 1, "magic:staff": 1, "magic:weapon": 1, "magic:armor": 1 } },
    { key: "exotic", trade: "Exotic Goods", nouns: ["Peacock", "Spice", "Silk", "Elephant"], label: "Exotic goods", categories: { art: 3, gem: 2, "magic:wondrous": 2, "magic:potion": 1 } },
    { key: "fence", trade: "Pawn & Trade", nouns: ["Purse", "Key", "Rat", "Lockbox"], label: "Fence / pawnbroker", categories: { gem: 2, art: 2, "mundane:gear": 2, "standard:weapon": 1, "standard:armor": 1, "mundane:weapon": 1, "mundane:armor": 1, "magic:potion": 1, "mundane:poison": 1 } },
    { key: "blackmarket", trade: "Goods", nouns: ["Mask", "Dagger", "Raven", "Shadow", "Viper", "Lockbox"], label: "Black market", categories: { "mundane:poison": 5, gem: 1, art: 1, "mundane:gear": 1, "mundane:weapon": 1, "mundane:armor": 1, "magic:potion": 1, "magic:wondrous": 1 } },
  ];

  /*
   * Settlement character. weights: multipliers per category ("magic:*" = every magic category);
   * stock, limit, price, unappraised: multipliers.
   */
  const TRAITS = [
    { key: "port", label: "Port / harbor", hint: "more exotic goods, gems and art", weights: { gem: 1.5, art: 1.5, "magic:wondrous": 1.5 }, stock: 1.2 },
    { key: "mining", label: "Mining town", hint: "gems, weapons and armor", weights: { gem: 2, "mundane:weapon": 1.3, "mundane:armor": 1.3 } },
    { key: "frontier", label: "Frontier / outpost", hint: "gear and arms, little magic, prices +10%", weights: { "mundane:gear": 1.5, "mundane:weapon": 1.5, "mundane:armor": 1.5, "magic:*": 0.5 }, price: 1.1 },
    { key: "trade", label: "Trade hub / crossroads", hint: "half again the stock, prices −5%", stock: 1.5, price: 0.95 },
    { key: "holy", label: "Holy site / temple city", hint: "potions, scrolls, holy water", weights: { "magic:potion": 2, "magic:scroll": 2, "mundane:alchemical": 1.5 } },
    { key: "arcane", label: "Arcane center", hint: "twice the magic, double gp limit", weights: { "magic:*": 2 }, limit: 2 },
    { key: "wealthy", label: "Wealthy", hint: "art and gems, gp limit ×1.5, prices +10%", weights: { art: 2, gem: 1.5 }, limit: 1.5, price: 1.1 },
    { key: "poor", label: "Poor / war-torn", hint: "less stock, half gp limit, prices +20%", stock: 0.6, limit: 0.5, price: 1.2 },
    { key: "remote", label: "Remote / isolated", hint: "less stock, prices +25%", stock: 0.75, price: 1.25 },
    { key: "lawless", label: "Lawless / thieves' haven", hint: "twice the unappraised goods and poisons, prices −10%", weights: { "mundane:poison": 2 }, unappraised: 2, price: 0.9 },
    // Version 7.4: shown only when the world's Epic items switch is on (Treasure Generator, Generation settings)
    { key: "epic", label: "Epic campaign", hint: "epic items in stock in any settlement (about 1 in 10 magic items, past the gp limit), every grade, gp limit ×10", limit: 10, epic: true, needs: "epic" },
  ];
  /** Settlement characters this world can use (the Epic campaign needs the world's Epic items switch). */
  const traitsAvailable = () => TRAITS.filter((t) => !t.needs || !!T()?.rules?.()?.[t.needs]);

  /* ------------------------------------------ */
  /*  Names (built-in lists, original)          */
  /* ------------------------------------------ */

  const RACES = [
    { key: "human", label: "Human", w: 50 }, { key: "dwarf", label: "Dwarf", w: 12 }, { key: "elf", label: "Elf", w: 8 }, { key: "gnome", label: "Gnome", w: 8 },
    { key: "halfling", label: "Halfling", w: 10 }, { key: "halfelf", label: "Half-elf", w: 8 }, { key: "halforc", label: "Half-orc", w: 4 },
  ];
  const SEXES = [{ key: "male", label: "Male" }, { key: "female", label: "Female" }];
  /* First names by race and sex; surnames by race. */
  const NAMES = {
    human: {
      male: ["Aldric", "Bertram", "Cedric", "Dorian", "Edwin", "Garrick", "Hollis", "Jasper", "Lorne", "Merrick", "Osric", "Percival", "Roderick", "Silas", "Tobias", "Walther"],
      female: ["Agnes", "Beatrix", "Cordelia", "Edith", "Greta", "Hilde", "Isolde", "Maren", "Odette", "Rosalind", "Sabine", "Tamsin", "Wilhelmina", "Yvette", "Elspeth", "Mirelle"],
      last: ["Ashdown", "Barrow", "Cobb", "Dunmore", "Fairweather", "Greaves", "Hawthorne", "Kettering", "Lockwood", "Marsh", "Pennywhistle", "Quill", "Redfern", "Stoneleigh",
        "Thatcher", "Underhill", "Vance", "Whitlock", "Yarrow", "Brightwater", "Coldbrook", "Fenwick"],
    },
    dwarf: {
      male: ["Baldrin", "Durgan", "Eitri", "Harbek", "Kordin", "Orsik", "Rurik", "Vondal", "Thorgar", "Dolgrin", "Hagrim", "Morgran"],
      female: ["Dagna", "Foldra", "Gimra", "Ilde", "Magna", "Thora", "Brunna", "Torgga", "Ingrid", "Ragna", "Sigrun", "Hulda"],
      last: ["Anvilheart", "Battlehammer", "Copperkettle", "Deepdelver", "Fireforge", "Goldvein", "Ironfist", "Oakenshield", "Rumnaheim", "Stonecutter", "Thunderbrow", "Steelbeard"],
    },
    elf: {
      male: ["Aelar", "Faelar", "Ilphas", "Quarion", "Riardon", "Thamior", "Ivellios", "Sylvar", "Thalion", "Aerendil", "Caladrel", "Lorethil"],
      female: ["Caelynn", "Elanil", "Lia", "Meriele", "Naivara", "Sariel", "Valanthe", "Yalanue", "Shava", "Ilyssa", "Nimuriel", "Aerilyn"],
      last: ["Amakiir", "Galanodel", "Holimion", "Liadon", "Meliamne", "Nailo", "Siannodel", "Xiloscient", "Moonwhisper", "Silverfrond", "Starbloom", "Windrivver"],
    },
    gnome: {
      male: ["Alston", "Carlin", "Dimble", "Fonkin", "Orryn", "Roywyn", "Seebo", "Zook", "Wizzle", "Bodrin"],
      female: ["Bimpnottin", "Ellyjobell", "Lilli", "Nissa", "Tana", "Waywocket", "Pipsa", "Quilla", "Mirtle", "Fizzbet"],
      last: ["Beren", "Daergel", "Folkor", "Garrick", "Nackle", "Murnig", "Ningel", "Raulnor", "Scheppen", "Timbers", "Turen", "Sprocketwhistle"],
    },
    halfling: {
      male: ["Andry", "Eldon", "Garret", "Merric", "Milo", "Osborn", "Perrin", "Roscoe", "Wellby", "Tobble"],
      female: ["Bree", "Callie", "Cora", "Kithri", "Lidda", "Nedda", "Seraphina", "Poppy", "Marigold", "Rosie"],
      last: ["Brushgather", "Goodbarrel", "Greenbottle", "Highhill", "Hilltopple", "Leagallow", "Tealeaf", "Thorngage", "Tosscobble", "Underbough", "Applewood", "Burrows"],
    },
    halforc: {
      male: ["Dench", "Feng", "Gell", "Henk", "Holg", "Imsh", "Keth", "Krusk", "Ront", "Shump", "Thokk"],
      female: ["Baggi", "Emen", "Engong", "Kansif", "Ovak", "Sutha", "Vola", "Grasha", "Urzul"],
      last: ["of the Broken Tusk", "Ironjaw", "Skullsplitter", "the Patient", "Ashbrand", "of Three Rivers", "Redhand", "Stonetooth"],
    },
  };
  NAMES.halfelf = {
    male: [...NAMES.human.male, ...NAMES.elf.male.slice(0, 6)], female: [...NAMES.human.female, ...NAMES.elf.female.slice(0, 6)],
    last: [...NAMES.human.last, ...NAMES.elf.last.slice(8)],
  };

  const SHOP_ADJ = ["Gilded", "Silver", "Rusty", "Crooked", "Golden", "Wandering", "Honest", "Lucky", "Iron", "Copper", "Laughing", "Sleeping", "Hidden", "Merry", "Old", "Painted", "Red", "Velvet", "Brass", "Twin"];
  const SHOP_NOUN = {
    default: ["Lantern", "Coin", "Scales", "Purse", "Wagon", "Barrel", "Crown", "Stag", "Raven", "Griffon", "Key", "Bell"],
    mundane: ["Pack", "Rope", "Wagon", "Lantern", "Barrel", "Compass"], weapon: ["Anvil", "Hammer", "Blade", "Forge", "Tongs", "Shield", "Arrow", "Bow"],
    alchemy: ["Mortar", "Flask", "Cauldron", "Phial", "Retort", "Herb"], gem: ["Gem", "Jewel", "Facet", "Ring", "Pearl", "Prism"],
    art: ["Easel", "Chisel", "Frame", "Loom", "Needle", "Quill", "Tome"], magic: ["Wand", "Star", "Moon", "Grimoire", "Sigil", "Candle", "Scroll", "Orb"],
  };
  const SHOP_PATTERNS = ["The {adj} {noun}", "The {adj} {noun}", "{last}'s {trade}", "{first}'s {trade}", "The {noun} and {noun2}", "{last} & Sons {trade}"];

  /* ------------------------------------------ */
  /*  Helpers                                   */
  /* ------------------------------------------ */

  const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const opt = (v, label, sel) => `<option value="${esc(v)}"${String(v) === String(sel ?? "") ? " selected" : ""}>${esc(label)}</option>`;
  const gp = (n) => `${Number(Math.round(n * 100) / 100).toLocaleString("en-US")} gp`;
  const remember = (k, v) => { try { localStorage.setItem(STORE + k, v); } catch (e) { /* private mode */ } };
  const recall = (k, d) => { try { return localStorage.getItem(STORE + k) ?? d; } catch (e) { return d; } };
  const host = () => [...hosts].find((h) => game.modules.get(h)?.active) ?? [...hosts][0] ?? null;
  const roll = (f) => (T()?.rollDice ? T().rollDice(f) : Number(f) || 0);
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const pickWeighted = (entries) => {
    const total = entries.reduce((a, [, w]) => a + w, 0);
    let r = Math.random() * total;
    for (const [k, w] of entries) if ((r -= w) < 0) return k;
    return entries[entries.length - 1]?.[0];
  };
  /** Display name of a Treasure category ("Magic weapon", "Potion", "Gem"...). */
  const catLabel = (c) => {
    const d = T()?.CATEGORIES?.[c];
    if (!d) return c;
    const l = d.magic ? `Magic ${d.label}` : d.label;
    return l.charAt(0).toUpperCase() + l.slice(1);
  };
  /** "Wondrous items tagged Book" for a shop type's limited category. */
  const hintLabel = (c, type) => (type?.hints?.[c]?.length ? `${catLabel(c)} tagged ${type.hints[c].join(" or ")}` : catLabel(c));
  const lines = (s) => String(s ?? "").split(/\r?\n|,/).map((x) => x.trim()).filter(Boolean);

  /* ------------------------------------------ */
  /*  World settings: custom shop types, names  */
  /* ------------------------------------------ */

  const ns = {};
  function registerWorld(key, def) {
    for (const n of ["world", host()].filter(Boolean)) {
      try {
        if (!game.settings.settings?.has?.(`${n}.${key}`)) game.settings.register(n, key, { scope: "world", config: false, type: Object, default: def });
        ns[key] = n;
        return;
      } catch (e) { console.warn(`AxecleftMerchants | could not register ${key} under "${n}"`, e); }
    }
  }
  const getWorld = (key, def) => { try { return ns[key] ? game.settings.get(ns[key], key) ?? def : def; } catch (e) { return def; } };
  const setWorld = async (key, v) => { if (!ns[key]) throw new Error("The setting is not registered."); return game.settings.set(ns[key], key, v); };

  const customTypes = () => (getWorld(SET_TYPES, { types: [] })?.types ?? []).map((t) => ({ ...t, custom: true }));
  async function saveCustomType(def) {
    const list = customTypes().filter((t) => t.key !== def.key).map(({ custom, ...t }) => t);
    list.push(def);
    await setWorld(SET_TYPES, { types: list });
  }
  async function deleteCustomType(key) {
    await setWorld(SET_TYPES, { types: customTypes().filter((t) => t.key !== key).map(({ custom, ...t }) => t) });
  }
  /*
   * Your names (world setting): { first, last, shops, groups: { <race key>: { male, female, first, last } } }.
   * Top-level first/last are for any race; "first" lists suit either sex.
   */
  const myNames = () => {
    const v = { first: [], last: [], shops: [], male: [], female: [], groups: {}, ...(getWorld(SET_NAMES, {}) ?? {}) };
    v.groups ??= {};
    return v;
  };
  /** Your first names and surnames for a race and sex (any-race lists included). */
  function myNamesFor(raceKey, sex) {
    const m = myNames(), g = m.groups[raceKey] ?? {};
    return { first: [...m.first, ...(m[sex] ?? []), ...(g.first ?? []), ...(g[sex] ?? [])], last: [...m.last, ...(g.last ?? [])] };
  }

  // A type with needs: "psionics" | "epic" shows only while that campaign switch is on (version 7.4)
  const types = () => [...BASE_TYPES, ...[...extraTypes.values()].filter((t) => (!t.module || (game.modules.get(t.module)?.active ?? true)) && (!t.needs || !!T()?.rules?.()?.[t.needs])), ...customTypes()];
  function registerMerchantType(def) {
    if (!def?.key || !def?.label || !def?.categories) return console.error("AxecleftMerchants | registerMerchantType() needs key, label and categories", def);
    extraTypes.set(def.key, def);
    api.refresh();
  }

  /* ------------------------------------------ */
  /*  Names                                     */
  /* ------------------------------------------ */

  const tradeWord = (type) => {
    const c = Object.keys(type?.categories ?? {});
    if (c.some((x) => x === "gem") && !c.some((x) => x.startsWith("mundane"))) return { trade: "Jewels", noun: "gem" };
    if (c.includes("art")) return { trade: "Curios", noun: "art" };
    if (c.some((x) => x.startsWith("magic:")) && !c.some((x) => x.startsWith("mundane"))) return { trade: "Arcana", noun: "magic" };
    if (c.includes("mundane:alchemical") && c.length <= 3) return { trade: "Remedies", noun: "alchemy" };
    if (c.some((x) => x.endsWith("weapon") || x.endsWith("armor")) && !c.includes("mundane:gear")) return { trade: "Smithy", noun: "weapon" };
    return { trade: "Goods", noun: "mundane" };
  };

  /**
   * A random merchant: { race, raceKey, sex, first, last, name, shop }.
   * race: a race key or "" (random); sex: "male" | "female" | "" (random); names: "both" | "mine" | "builtin".
   */
  function randomMerchant(type, { race = "", sex = "", names = "both" } = {}) {
    const rolled = pickWeighted(RACES.map((x) => [x.key, x.w]));
    const r = RACES.find((x) => x.key === race) ?? RACES.find((x) => x.key === rolled) ?? RACES[0];
    const sx = SEXES.find((x) => x.key === sex)?.key ?? pick(SEXES).key;
    const mine = myNames(), own = myNamesFor(r.key, sx);
    const pool = (builtin, o) => (names === "mine" && o.length ? o : names === "builtin" || !o.length ? builtin : [...builtin, ...o]);
    const first = pick(pool(NAMES[r.key][sx], own.first));
    const last = pick(pool(NAMES[r.key].last, own.last));
    const tw = type?.trade ? { trade: type.trade } : tradeWord(type);
    const nouns = type?.nouns?.length ? [...type.nouns, ...type.nouns, ...SHOP_NOUN.default] : [...SHOP_NOUN[tw.noun], ...SHOP_NOUN.default];
    let shop;
    if ((names === "mine" || (names === "both" && Math.random() < 0.3)) && mine.shops.length) shop = pick(mine.shops);
    else {
      const noun = pick(nouns);
      shop = pick(SHOP_PATTERNS).replace("{adj}", pick(SHOP_ADJ)).replace("{noun2}", pick(nouns.filter((n) => n !== noun))).replace("{noun}", noun)
        .replace("{first}", first).replace("{last}", last.startsWith("of ") || last.startsWith("the ") ? first : last).replace("{trade}", tw.trade);
    }
    return { race: r.label, raceKey: r.key, sex: sx, first, last, name: `${first} ${last}`, shop };
  }

  /* ------------------------------------------ */
  /*  Portraits                                 */
  /* ------------------------------------------ */

  /*
   * A portrait folder (world setting { source, folder }). Images are matched to a merchant by
   * race and sex words anywhere in the path: "portraits/dwarf/female/smith-01.webp",
   * "elf_male_3.png", "Half-Orc Women/ugra.jpg". Plurals (dwarves, elves, women) and m/f work.
   * Best match first: race and sex, then race only (no sex given), then sex only (no race given),
   * then untagged images. An image tagged with another race or sex is never used.
   */
  const IMG_EXT = /\.(webp|png|jpe?g|gif|avif|svg)$/i;
  const RACE_WORDS = {
    human: ["human", "humans"], dwarf: ["dwarf", "dwarves", "dwarfs"], elf: ["elf", "elves", "elven"], gnome: ["gnome", "gnomes"],
    halfling: ["halfling", "halflings"], halfelf: ["halfelf", "halfelves", "halfelven"], halforc: ["halforc", "halforcs"],
  };
  const SEX_WORDS = { male: ["male", "males", "man", "men", "m"], female: ["female", "females", "woman", "women", "f"] };
  /** { race, sex } read from an image path (null where none is given). */
  function portraitTags(path) {
    const p = String(path).toLowerCase().replace(/half[\s_.-]*(elf|elves|elven|orc|orcs)/g, "half$1");
    const words = new Set(p.replace(IMG_EXT, "").split(/[^a-z]+/).filter(Boolean));
    const race = Object.keys(RACE_WORDS).find((k) => RACE_WORDS[k].some((w) => words.has(w))) ?? null;
    const sex = Object.keys(SEX_WORDS).find((k) => SEX_WORDS[k].some((w) => words.has(w))) ?? null;
    return { race, sex };
  }
  const portraitSetting = () => ({ source: "data", folder: "", ...(getWorld(SET_PORTRAITS, {}) ?? {}) });
  let portraitCache = null; // { key, files: [{ path, race, sex }] }
  /** Every image in the portrait folder and its subfolders (cached until the folder changes or a rescan). */
  async function portraitFiles(force = false) {
    const { source, folder } = portraitSetting();
    if (!folder) return [];
    const key = `${source}|${folder}`;
    if (!force && portraitCache?.key === key) return portraitCache.files;
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
    const files = [];
    const walk = async (dir, depth) => {
      let res;
      try { res = await FP.browse(source, dir); } catch (err) { console.warn(`AxecleftMerchants | can't read portrait folder ${dir}`, err); return; }
      for (const f of res.files ?? []) {
        if (!IMG_EXT.test(f)) continue;
        const full = decodeURIComponent(f), at = full.indexOf(folder);
        files.push({ path: f, ...portraitTags(at >= 0 ? full.slice(at + folder.length) : full) }); // only the part below the folder counts
      }
      if (depth < 4) for (const d of res.dirs ?? []) await walk(d, depth + 1);
    };
    await walk(folder, 0);
    portraitCache = { key, files };
    return files;
  }
  /** A random portrait for a race key and sex, or "" if the folder has none that fit. */
  async function pickPortrait(raceKey, sex) {
    const files = await portraitFiles();
    const tiers = [
      files.filter((f) => f.race === raceKey && f.sex === sex),
      files.filter((f) => f.race === raceKey && !f.sex),
      files.filter((f) => !f.race && f.sex === sex),
      files.filter((f) => !f.race && !f.sex),
    ];
    const list = tiers.find((t) => t.length);
    return list ? pick(list).path : "";
  }

  /* ------------------------------------------ */
  /*  Rolling stock                             */
  /* ------------------------------------------ */

  /** Effective weights, stock, limit, price and unappraised multipliers after settlement traits. */
  function applyTraits(type, traitKeys = []) {
    const tr = TRAITS.filter((t) => traitKeys.includes(t.key));
    const weights = Object.fromEntries(Object.entries(type.categories).map(([c, w]) => {
      let m = 1;
      for (const t of tr) m *= t.weights?.[c] ?? (c.startsWith("magic:") ? t.weights?.["magic:*"] ?? 1 : 1);
      return [c, w * m];
    }));
    const mult = (k) => tr.reduce((a, t) => a * (t[k] ?? 1), 1);
    const epic = tr.some((t) => t.epic) && !!T()?.rules?.()?.epic;
    return { weights, stock: mult("stock"), limit: mult("limit"), price: mult("price"), unappraised: mult("unappraised"), traits: tr, epic };
  }

  const matches = (filter, ref) => !filter || !ref || Object.entries(filter).every(([k, v]) => !v || ref[k] === undefined || ref[k] === v);

  /**
   * Roll a shop's stock.
   * opts: { type, settlement, traits: [keys], cap (bool), stock (formula), count (number), unappraised (0-100), restock (bool) }
   * Returns { items, missing, skipped, type, town, fx, limit }.
   */
  async function rollStock(opts) {
    const hub = T();
    if (!hub?.rollCategory) throw new Error("The Treasure Generator script (axecleft-treasure.js version 6 or later) is not loaded.");
    const type = types().find((t) => t.key === opts.type) ?? BASE_TYPES[0];
    const town = SETTLEMENTS.find((s) => s.key === opts.settlement) ?? SETTLEMENTS[2];
    const fx = applyTraits(type, opts.traits ?? []);
    const cap = opts.cap !== false;
    const limit = cap ? Math.round(town.limit * fx.limit) : Infinity;
    const grades = !cap || fx.epic ? ["minor", "medium", "major"] : fx.limit >= 2 ? (SETTLEMENTS[Math.min(SETTLEMENTS.length - 1, SETTLEMENTS.indexOf(town) + 2)].grades) : town.grades;
    const cats = Object.entries(fx.weights).filter(([, w]) => w > 0);
    const hintFor = (c) => type.hints?.[c] ?? null;
    const available = cats.filter(([c]) => hub.hasProvider(c, hintFor(c)));
    const missing = cats.filter(([c]) => !hub.hasProvider(c, hintFor(c))).map(([c]) => c);
    if (!available.length) return { items: [], missing, skipped: 0, type, town, fx, limit };

    let count = Number.isFinite(opts.count) ? opts.count : Math.round(roll(opts.stock || town.stock) * fx.stock);
    if (opts.restock && !opts.stock && !Number.isFinite(opts.count)) count = Math.ceil(count / 2);
    count = Math.max(1, count);
    const unapp = Math.min(100, (Number(opts.unappraised) || 0) * fx.unappraised);
    const items = [];
    const exclude = new Set(); // version 7.5: an epic item isn't stocked twice
    let skipped = 0;
    for (let n = 0; n < count; n++) {
      const category = pickWeighted(available);
      const isGoods = category === "gem" || category === "art";
      let placed = false;
      for (let tries = 0; tries < 15 && !placed; tries++) {
        let grade = category.startsWith("magic:") ? pickWeighted(grades.map((g) => [g, GRADE_WEIGHT[g]])) : null;
        // Epic campaign (7.5): about 1 magic item in 10 is epic (the SRD epic tables, Armory and Curios), whatever the settlement
        let epicRoll = fx.epic && grade && tries === 0 && Math.random() < EPIC_STOCK;
        let entry = null;
        if (epicRoll) {
          [entry] = (await hub.rollCategory(category, { grade: "epic", level: null, merchant: true, settlement: town.key, tags: type.tags ?? [], hints: type.hints ?? {}, epic: true, exclude })).filter((e) => !e.placeholder && e.data);
          if (!entry) epicRoll = false; // nothing epic in this category (potions, wands, gems): an ordinary item instead
        }
        if (!entry) [entry] = await hub.rollCategory(category, { grade, level: null, merchant: true, mix: true, settlement: town.key, tags: type.tags ?? [], hints: type.hints ?? {}, epic: fx.epic });
        if (!entry || entry.placeholder || !entry.data) break;
        if (epicRoll) exclude.add(String(entry.name ?? entry.data.name).toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9']+/g, " ").trim());
        if (isGoods && !matches(type.filter, entry.ref)) continue;
        const data = await hub.rollCreationChanges(foundry.utils.deepClone(entry.data));
        const price = Number(data.system?.price) || 0;
        if (price > limit && !epicRoll) continue; // an epic shopkeeper's epic stock ignores the settlement's gp limit
        // Gems, art and jewelry: mostly appraised (identified at their true value);
        // a few stay unappraised, which D35E sells at the base value.
        const appraised = !isGoods || Math.random() * 100 >= unapp;
        foundry.utils.setProperty(data, "system.identified", appraised);
        delete data._id;
        items.push({ data, price, appraised, category, base: Number(data.system?.unidentified?.price) || price });
        placed = true;
      }
      if (!placed) skipped++;
    }
    // Stack identical pieces
    const stacked = [];
    for (const it of items) {
      const same = stacked.find((s) => s.data.name === it.data.name && s.appraised === it.appraised && s.price === it.price && s.data.type === it.data.type);
      if (same) foundry.utils.setProperty(same.data, "system.quantity", (Number(same.data.system?.quantity) || 1) + (Number(it.data.system?.quantity) || 1));
      else stacked.push(it);
    }
    return { items: stacked, missing, skipped, type, town, fx, limit };
  }

  /* ------------------------------------------ */
  /*  Making and restocking merchants           */
  /* ------------------------------------------ */

  async function merchantFolder() {
    return game.folders.find((f) => f.type === "Actor" && f.name === FOLDER) ?? Folder.create({ name: FOLDER, type: "Actor", color: "#3b24f0" });
  }

  /** Targets: { mode: "new" | "selected" | "actor", uuid } -> [{ actor, label, isNew }]. */
  async function targets(opts, person) {
    if (opts.mode === "new") {
      const folder = await merchantFolder();
      const fmt = opts.nameFormat ?? "both";
      const name = fmt === "shop" ? person.shop : fmt === "person" ? person.name : `${person.name} (${person.shop})`;
      const data = {
        name, type: "npc", folder: folder.id,
        ownership: { default: 0 }, // D35E's merchant sheet needs None; the GM sets permissions on the sheet
        prototypeToken: { actorLink: true, name: person.name },
      };
      if (opts.img) { data.img = opts.img; data.prototypeToken.texture = { src: opts.img }; }
      const actor = await Actor.create(data);
      return [{ actor, label: actor.name, isNew: true }];
    }
    if (opts.mode === "actor") {
      const doc = await fromUuid(opts.uuid);
      const actor = doc?.documentName === "Actor" ? doc : doc?.actor ?? null;
      if (!actor) throw new Error("Choose an actor or token (or drag one onto the window).");
      return [{ actor, label: doc.name ?? actor.name }];
    }
    const list = [], seen = new Set();
    for (const t of canvas?.tokens?.controlled ?? []) {
      const key = t.document?.uuid ?? t.id;
      if (!t.actor || seen.has(key)) continue;
      seen.add(key);
      list.push({ actor: t.actor, label: t.name ?? t.actor.name });
    }
    if (!list.length) throw new Error("Select one or more tokens (or choose another option under \"Make\").");
    return list;
  }

  /**
   * Generate, convert or restock merchant(s).
   * opts: { type, settlement, traits, cap, stock, unappraised, sell, buy, purse, mode, uuid, name, nameFormat, race, sex, names, img, portrait (false: no random portrait),
   *         stockMode: "replace" | "restock", useSaved }
   */
  async function generateMerchant(opts = {}) {
    const results = [];
    const baseType = types().find((t) => t.key === opts.type) ?? BASE_TYPES[0];
    const person = randomMerchant(baseType, { race: opts.race, sex: opts.sex, names: opts.names });
    if (opts.name?.trim()) person.name = opts.name.trim();
    if (opts.shop?.trim()) person.shop = opts.shop.trim();
    // A new merchant with no image chosen gets a portrait that fits, if there's a portrait folder
    if (opts.mode === "new" && !opts.img && opts.portrait !== false) opts = { ...opts, img: await pickPortrait(person.raceKey, person.sex) };
    const list = await targets(opts, person);
    for (const t of list) {
      const actor = t.actor;
      const saved = actor.getFlag?.(FLAG_SCOPE, FLAG_KEY) ?? actor.flags?.[FLAG_SCOPE]?.[FLAG_KEY] ?? null;
      const restock = !t.isNew && opts.stockMode === "restock";
      // A restock uses the merchant's own saved shop settings unless told otherwise.
      const o = restock && opts.useSaved !== false && saved ? { ...opts, ...saved, stock: opts.stock, purse: opts.purse, stockMode: "restock" } : { ...opts };
      const stock = await rollStock({ ...o, restock });
      const town = stock.town;
      const sell = Math.round((Number(o.sell) || 100) * stock.fx.price);
      const upd = {
        "flags.core.sheetClass": SHEET,
        "flags.D35E.lootsheettype": "Merchant",
        "flags.D35E.priceModifier": sell / 100,
        "flags.D35E.priceModifierBuy": (Number(o.buy) || 50) / 100,
        [`flags.${FLAG_SCOPE}.${FLAG_KEY}`]: { type: stock.type.key, settlement: town.key, traits: o.traits ?? [], cap: o.cap !== false, unappraised: Number(o.unappraised) || 0,
          sell: Number(o.sell) || 100, buy: Number(o.buy) || 50, shop: saved?.shop ?? person.shop, race: saved?.race ?? person.race, sex: saved?.sex ?? person.sex },
      };
      if (t.isNew) upd["system.details.biography.value"] = `<p><strong>${esc(person.name)}</strong>, ${esc(`${person.sex} ${person.race}`.toLowerCase())} proprietor of <em>${esc(person.shop)}</em>: ${esc(stock.type.label.toLowerCase())} in a ${esc(town.label.toLowerCase())}${stock.fx.traits.length ? ` (${esc(stock.fx.traits.map((x) => x.label.toLowerCase()).join(", "))})` : ""}.</p>`;
      // Cash on hand, paid in the world's coins (Treasure Generator currency settings)
      const purseGp = Math.max(0, Math.round(roll(o.purse || town.purse) * (restock ? 0.5 : 1)));
      let purseText = "";
      if (purseGp > 0) {
        const paid = T()?.convertCoins ? T().convertCoins({ gp: purseGp }) : { std: { gp: purseGp }, custom: {}, text: gp(purseGp) };
        const keep = restock;
        const cur = actor.system?.currency ?? {}, custom = actor.system?.customCurrency ?? {};
        for (const [k, v] of Object.entries(paid.std)) if (v) upd[`system.currency.${k}`] = (keep ? Number(cur[k]) || 0 : 0) + v;
        for (const [id, v] of Object.entries(paid.custom)) if (v) upd[`system.customCurrency.${id}`] = (keep ? Number(custom[id]) || 0 : 0) + v;
        purseText = paid.text;
      }
      await actor.update(upd);
      if (!t.isNew && !restock) {
        const old = actor.items.filter((i) => STOCK_TYPES.includes(i.type)).map((i) => i.id);
        if (old.length) await actor.deleteEmbeddedDocuments("Item", old);
      }
      if (stock.items.length) {
        if (restock) {
          // Stack onto pieces the merchant already has
          const fresh = [];
          for (const it of stock.items) {
            const have = actor.items.find((i) => i.name === it.data.name && i.type === it.data.type && Number(i.system?.price) === it.price && !!i.system?.identified === it.appraised);
            if (have) await have.update({ "system.quantity": (Number(have.system?.quantity) || 1) + (Number(it.data.system?.quantity) || 1) });
            else fresh.push(it.data);
          }
          if (fresh.length) await actor.createEmbeddedDocuments("Item", fresh);
        } else await actor.createEmbeddedDocuments("Item", stock.items.map((i) => i.data));
      }
      if (actor.sheet?.rendered) await actor.sheet.close();
      results.push({ actor, label: t.label, stock, purseText, restock, sell });
      await postChat(actor, t.label, stock, purseText, { ...o, sell }, restock, t.isNew ? person : null);
    }
    return results;
  }

  async function postChat(actor, label, stock, purseText, o, restock, person) {
    const list = stock.items.map((i) => {
      const q = Number(i.data.system?.quantity) || 1;
      const value = i.appraised ? gp(i.price) : `${gp(i.base)} unappraised (true value ${gp(i.price)})`;
      return `<li>${q > 1 ? `${q} × ` : ""}${esc(i.data.name)} <small>${esc(value)}</small></li>`;
    }).join("");
    const missing = stock.missing.length ? `<p><small>Not stocked (no source: a module isn't active or no items are tagged): ${esc([...new Set(stock.missing.map((c) => hintLabel(c, stock.type)))].join(", "))}.</small></p>` : "";
    const skipped = stock.skipped ? `<p><small>${stock.skipped} item${stock.skipped === 1 ? "" : "s"} skipped: nothing suitable under the ${gp(stock.limit)} limit.</small></p>` : "";
    const traits = stock.fx.traits.length ? ` ${esc(stock.fx.traits.map((x) => x.label).join(", "))}.` : "";
    await ChatMessage.create({
      whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id),
      speaker: { alias: "Merchant Generator" },
      content: `<h3>${restock ? "Restocked: " : ""}@UUID[${actor.uuid}]{${esc(label)}}</h3>
        ${person ? `<p><em>${esc(person.name)}, ${esc(`${person.sex} ${person.race}`.toLowerCase())}, proprietor of ${esc(person.shop)}.</em></p>` : ""}
        <p>${esc(stock.type.label)}, ${esc(stock.town.label.toLowerCase())}${o.cap === false ? " (no gp limit)" : ` (gp limit ${gp(stock.limit)})`}.${traits} Sells at ${o.sell}%, buys at ${Number(o.buy) || 50}%.${purseText ? ` ${restock ? "Added to the purse" : "Purse"}: ${esc(purseText)}.` : ""}</p>
        ${list ? `<ol>${list}</ol>` : "<p>No stock.</p>"}${missing}${skipped}
        <p><small>Players buy and sell from the merchant's token on the scene. Set player permissions on the merchant sheet.</small></p>`,
    });
  }

  /* ------------------------------------------ */
  /*  The window                                */
  /* ------------------------------------------ */

  const STYLE = `<style>
    #axecleft-merchant-generator { max-height: calc(100vh - 16px); }
    #axecleft-merchant-generator .window-content { overflow-y: auto; }
    .amg .amg-footer.sticky { position: sticky; bottom: -1rem; z-index: 2; margin: 8px 0 0; padding: 6px 0 calc(1rem + 4px); background: var(--background, var(--color-cool-5, #1b1d24)); }
    .amg details.amg-sec { border: 1px solid var(--color-border-light-tertiary, #888); border-radius: 4px; margin: 8px 0 4px; padding: 2px 8px 4px; }
    .amg details.amg-sec > summary { cursor: pointer; font-weight: bold; padding: 2px 0; }
    .amg details.amg-sec > summary small { font-weight: normal; opacity: 0.8; }
    .amg nav.amg-tabs { display: flex; gap: 2px; border-bottom: 1px solid var(--color-border-light-tertiary, #999); margin-bottom: 8px; position: sticky; top: -1rem; z-index: 3; margin-top: -1rem; padding-top: calc(1rem + 2px); background: var(--background, var(--color-cool-5, #1b1d24)); }
    .amg nav.amg-tabs button { flex: 1 1 auto; border-radius: 4px 4px 0 0; margin: 0; padding: 4px 6px; line-height: 1.4; white-space: nowrap; }
    .amg nav.amg-tabs button.active { font-weight: bold; box-shadow: inset 0 -3px 0 var(--color-warm-1, #c9593f); }
    .amg section[data-tab] { display: none; } .amg section[data-tab].active { display: block; }
    .amg .form-group > label { flex: 0 0 10em; }
    .amg .form-group select, .amg .form-group input[type=text] { flex: 1; min-width: 0; }
    .amg .form-group input[type=number] { flex: 0 0 5em; }
    .amg .hint { font-size: 0.85em; opacity: 0.85; margin: 2px 0 6px; }
    .amg fieldset { margin: 8px 0 4px; padding: 4px 8px 6px; }
    .amg .amg-footer { display: flex; gap: 6px; margin-top: 8px; } .amg .amg-footer button { flex: 1; }
    .amg .amg-sources { font-size: 0.9em; margin: 2px 0 4px; } .amg .ok { color: var(--color-level-success, #2a7d2a); } .amg .no { opacity: 0.7; }
    .amg .amg-drop { border: 2px dashed var(--color-border-light-tertiary, #888); border-radius: 6px; padding: 6px; text-align: center; font-size: 0.9em; opacity: 0.85; margin: 4px 0; }
    .amg .amg-drop.over { border-color: var(--color-warm-1, #c9593f); opacity: 1; }
    .amg .amg-traits { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 10px; font-size: 0.92em; }
    .amg .amg-traits label { display: flex; gap: 4px; align-items: flex-start; } .amg .amg-traits small { opacity: 0.75; display: block; }
    .amg .amg-weights { display: grid; grid-template-columns: 1fr 4.5em 1fr 4.5em; gap: 2px 8px; align-items: center; font-size: 0.92em; }
    .amg textarea { width: 100%; box-sizing: border-box; min-height: 6.5em; font-family: inherit; }
    .amg .amg-cols { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
    .amg .amg-cols4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 6px; } .amg .amg-cols4 label { font-size: 0.9em; }
    .amg table.amg-portraits { font-size: 0.9em; width: auto; } .amg table.amg-portraits td, .amg table.amg-portraits th { padding: 1px 8px; text-align: left; }
    .amg .amg-samples { font-size: 0.9em; margin: 4px 0; }
    .amg table.amg-packs { width: 100%; font-size: 0.92em; } .amg table.amg-packs td { padding: 2px 4px; vertical-align: top; } .amg table.amg-packs td:first-child { width: 1.6em; }
    .amg table.amg-packs small { opacity: 0.75; }
    .amg .amg-tagwrap { max-height: min(50vh, 460px); overflow-y: auto; border: 1px solid var(--color-border-light-tertiary, #888); border-radius: 4px; margin: 4px 0; }
    .amg table.amg-tags { width: 100%; font-size: 0.9em; border-collapse: collapse; margin: 0; }
    .amg table.amg-tags th { position: sticky; top: 0; z-index: 1; background: var(--background, var(--color-cool-5, #1b1d24)); text-align: left; padding: 3px 4px; }
    .amg table.amg-tags td { padding: 2px 4px; vertical-align: middle; border-top: 1px solid rgba(128,128,128,0.25); }
    .amg table.amg-tags td:first-child, .amg table.amg-tags th:first-child { width: 1.6em; }
    .amg table.amg-tags td small { opacity: 0.75; display: block; }
    .amg table.amg-tags input[type=text] { width: 100%; height: 1.8em; }
    .amg table.amg-tags tr.changed input[type=text] { border-color: var(--color-warm-1, #c9593f); }
    .amg table.amg-tags input.bad { outline: 2px solid #c33; }
    .amg .amg-tagbar { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin: 4px 0; }
    .amg .amg-tagbar > * { flex: 0 0 auto; } .amg .amg-tagbar input[type=text] { flex: 1 1 8em; min-width: 6em; }
    .amg .amg-tagstat { font-size: 0.9em; margin: 4px 0; }
    .amg details.amg-help p, .amg details.amg-help ul { font-size: 0.88em; margin: 3px 0; }
  </style>`;

  const CATEGORY_ORDER = ["gem", "art", "mundane:gear", "mundane:alchemical", "mundane:poison", "standard:weapon", "standard:ammo", "standard:armor", "standard:shield",
    "mundane:weapon", "mundane:armor", "magic:weapon", "magic:armor",
    "magic:potion", "magic:scroll", "magic:wand", "magic:ring", "magic:rod", "magic:staff", "magic:wondrous"];

  class MerchantGenerator extends foundry.applications.api.ApplicationV2 {
    static DEFAULT_OPTIONS = {
      id: "axecleft-merchant-generator",
      classes: ["axecleft-merchant-generator"],
      window: { title: "Merchant Generator", icon: "fas fa-store", resizable: true },
      position: { width: 600, height: "auto" },
    };
    tab = recall("tab", "merchant");
    editing = "";
    /** Shop Tags tab: the scanned compendium and its rows ({ id, name, folder, primary, current, suggested, text, ticked }). */
    tagPack = recall("tagPack", "");
    tagRows = null;

    /** Keep the window on screen: auto height, but never taller than the screen; the content scrolls. */
    fit() {
      if (!this.rendered || !this.element?.isConnected) return;
      try {
        this.setPosition({ height: "auto" });
        const max = window.innerHeight - 16;
        const rect = this.element.getBoundingClientRect();
        if (rect.height > max) this.setPosition({ height: max, top: 8 });
        else if (rect.bottom > window.innerHeight - 8) this.setPosition({ top: Math.max(8, window.innerHeight - rect.height - 8) });
      } catch (e) { /* closing */ }
    }

    _onRender(context, options) {
      super._onRender?.(context, options);
      this.fit();
    }

    async _renderHTML() {
      const tps = types(), r = (k, d) => recall(k, d);
      const CAT = T()?.CATEGORIES ?? {};
      const mode = r("mode", "new");
      const traitsOn = r("traits", "").split(",").filter(Boolean);
      const tokens = (canvas?.scene?.tokens?.contents ?? []).filter((t) => t.actor).sort((a, b) => a.name.localeCompare(b.name));
      const actors = [...(game.actors ?? [])].sort((a, b) => a.name.localeCompare(b.name));
      const actorOpts = opt("", "Choose an actor or token…")
        + (tokens.length ? `<optgroup label="Tokens on this scene">${tokens.map((t) => opt(t.uuid, `${t.name}${t.actorLink ? "" : " (unlinked token)"}`)).join("")}</optgroup>` : "")
        + (actors.length ? `<optgroup label="Actors">${actors.map((a) => opt(a.uuid, `${a.name} (${a.type})${a.getFlag?.(FLAG_SCOPE, FLAG_KEY) || a.flags?.[FLAG_SCOPE]?.[FLAG_KEY] ? " — merchant" : ""}`)).join("")}</optgroup>` : "");
      const typeOpts = (sel) => {
        const groups = [["Shop types", tps.filter((t) => !t.custom && !extraTypes.has(t.key))], ["From other modules", tps.filter((t) => extraTypes.has(t.key))], ["Your shop types", tps.filter((t) => t.custom)]];
        return groups.filter(([, l]) => l.length).map(([g, l]) => `<optgroup label="${g}">${l.map((t) => opt(t.key, t.label, sel)).join("")}</optgroup>`).join("");
      };

      const merchant = `<section data-tab="merchant">
        <div class="form-group"><label>Shop</label><select name="type">${typeOpts(r("type", "general"))}</select></div>
        <div class="amg-sources" data-sources></div>
        <div class="form-group"><label>Settlement</label><select name="settlement">${SETTLEMENTS.map((s) => opt(s.key, `${s.label} (gp limit ${gp(s.limit)})`, r("settlement", "village"))).join("")}</select></div>
        <div class="form-group"><label>GP limit</label><label style="flex:1;display:flex;gap:4px;align-items:center"><input type="checkbox" name="cap" ${r("cap", "1") === "1" ? "checked" : ""}> Nothing priced above the settlement's gp limit</label></div>
        <details class="amg-sec" data-sec="traits" ${r("sec.traits", "0") === "1" ? "open" : ""}><summary>Settlement character <small data-sec-note="traits"></small></summary><div class="amg-traits">
          ${traitsAvailable().map((t) => `<label><input type="checkbox" name="trait.${t.key}" ${traitsOn.includes(t.key) ? "checked" : ""}><span>${esc(t.label)}<small>${esc(t.hint)}</small></span></label>`).join("")}</div></details>
        <div class="form-group"><label>Different items</label><input type="text" name="stock" value=""><span class="hint" style="flex:1">dice formula; blank uses the settlement's (half for a restock)</span></div>
        <div class="form-group"><label>Unappraised goods</label><input type="number" name="unappraised" min="0" max="100" step="1" value="${esc(r("unappraised", "10"))}"><span class="hint" style="flex:1">% of gems, art and jewelry left unidentified (sold at base value)</span></div>
        <details class="amg-sec" data-sec="prices" ${r("sec.prices", "0") === "1" ? "open" : ""}><summary>Prices and purse <small data-sec-note="prices"></small></summary>
          <div class="form-group"><label>Sells at</label><input type="number" name="sell" min="1" step="5" value="${esc(r("sell", "100"))}"><span class="hint" style="flex:1">% of value (settlement character may adjust it)</span></div>
          <div class="form-group"><label>Buys at</label><input type="number" name="buy" min="0" step="5" value="${esc(r("buy", "50"))}"><span class="hint" style="flex:1">% of value (SRD: half)</span></div>
          <div class="form-group"><label>Purse (gp)</label><input type="text" name="purse" value=""><span class="hint" style="flex:1">dice formula; blank uses the settlement's; paid in this world's coins</span></div>
        </details>
        <fieldset><legend>Merchant</legend>
          <div class="form-group"><label>Make</label><select name="mode">
            ${opt("new", "A new merchant", mode)}${opt("selected", "Selected tokens", mode)}${opt("actor", "A chosen actor or token", mode)}</select></div>
          <div class="form-group" data-mode="new"><label>Race</label><select name="race">${opt("", "Random", r("race", ""))}${RACES.map((x) => opt(x.key, x.label, r("race", ""))).join("")}</select></div>
          <div class="form-group" data-mode="new"><label>Sex</label><select name="sex">${opt("", "Random", r("sex", ""))}${SEXES.map((x) => opt(x.key, x.label, r("sex", ""))).join("")}</select></div>
          <div class="form-group" data-mode="new"><label>Name</label><input type="text" name="name" placeholder="blank: a random name and shop"><button type="button" data-action="rollName" title="Roll a name" style="flex:0 0 2.2em"><i class="fas fa-dice"></i></button></div>
          <div class="form-group" data-mode="new"><label>Actor name</label><select name="nameFormat">${opt("both", "Merchant (Shop)", r("nameFormat", "both"))}${opt("person", "Merchant", r("nameFormat", "both"))}${opt("shop", "Shop", r("nameFormat", "both"))}</select></div>
          <div class="form-group" data-mode="new"><label>Image</label><input type="text" name="img" placeholder="${portraitSetting().folder ? "blank: a portrait from your portrait folder that fits" : "optional portrait or token image"}"><button type="button" data-action="pickImg" title="Browse" style="flex:0 0 2.2em"><i class="fas fa-file-image"></i></button></div>
          <div class="form-group" data-mode="actor"><label>Actor or token</label><select name="uuid">${actorOpts}</select></div>
          <div class="amg-drop" data-mode="actor"><i class="fas fa-hand-pointer"></i> Or drag an actor here from the Actors sidebar</div>
          <div class="form-group" data-mode="selected actor"><label>Stock</label><select name="stockMode">
            ${opt("replace", "Replace the old stock and purse", r("stockMode", "replace"))}${opt("restock", "Restock: keep the stock, add more", r("stockMode", "replace"))}</select></div>
          <div class="form-group" data-mode="selected actor" data-stock="restock"><label>Shop settings</label><label style="flex:1;display:flex;gap:4px;align-items:center"><input type="checkbox" name="useSaved" checked> Use each merchant's own saved shop, settlement and traits</label></div>
          <p class="hint" data-mode="selected actor">Replacing removes weapons, equipment, consumables and loot only; feats, classes and other items are kept.</p>
          <p class="hint" data-mode="new">Created in the "${FOLDER}" Actors folder on D35E's merchant sheet, with permissions set to None: set player permissions on the merchant sheet. Players buy and sell from its token.</p>
        </fieldset>
        <div class="amg-footer sticky"><button type="button" data-action="generate" class="bright"><i class="fas fa-store"></i> Generate Merchant</button></div>
      </section>`;

      const custom = customTypes();
      const ed = custom.find((t) => t.key === this.editing) ?? null;
      const weights = CATEGORY_ORDER.map((c) => `<span>${esc(catLabel(c))}</span><input type="number" name="w.${c}" min="0" step="1" value="${ed?.categories?.[c] ?? ""}" placeholder="0">`).join("");
      const typesTab = `<section data-tab="types">
        <p class="hint">Make your own shop types. Each category's number is its share of the stock (0 or blank: never sold). Saved in this world.</p>
        <div class="form-group"><label>Edit</label><select name="ct.edit">${opt("", "New shop type", this.editing)}${custom.map((t) => opt(t.key, t.label, this.editing)).join("")}</select></div>
        <div class="form-group"><label>Start from</label><select name="ct.from">${opt("", "—")}${typeOpts("")}</select></div>
        <div class="form-group"><label>Name</label><input type="text" name="ct.label" value="${esc(ed?.label ?? "")}" placeholder="e.g. Dragon-bone carver"></div>
        <fieldset><legend>What it sells</legend><div class="amg-weights">${weights}</div></fieldset>
        <div class="form-group"><label>Gems and art</label><select name="ct.kind">${opt("", "Any", ed?.filter?.kind)}${opt("art", "Art objects only", ed?.filter?.kind)}${opt("jewelry", "Jewelry only", ed?.filter?.kind)}</select></div>
        <div class="form-group"><label>Art made by</label><select name="ct.make">${opt("", "Any", ed?.filter?.make)}${opt("Molded", "Molded / cast (metal, glass)", ed?.filter?.make)}${opt("Carved", "Carved (wood, bone, stone)", ed?.filter?.make)}${opt("Clothing", "Cloth, fur and hide", ed?.filter?.make)}${opt("Book", "Books and documents", ed?.filter?.make)}</select></div>
        <div class="form-group"><label>Wondrous items</label><select name="ct.hint">${opt("", "Any", ed?.hints?.["magic:wondrous"]?.[0])}${(T()?.SHOP_HINTS ?? ["Book", "Clothing", "Jewelry"]).map((h) => opt(h, `Only those tagged "Shop: ${h}"`, ed?.hints?.["magic:wondrous"]?.[0])).join("")}</select></div>
        <div class="amg-footer"><button type="button" data-action="saveType"><i class="fas fa-save"></i> Save Shop Type</button><button type="button" data-action="deleteType" ${ed ? "" : "disabled"}><i class="fas fa-trash"></i> Delete</button></div>
      </section>`;

      const mine = myNames();
      this.namesDraft ??= structuredClone(mine);
      const grp = this.nameGroup ?? "any";
      const gv = grp === "any" ? this.namesDraft : (this.namesDraft.groups[grp] ?? {});
      const ta = (k, label) => `<div><label>${label}</label><textarea name="n.${k}">${esc((gv[k] ?? []).join("\n"))}</textarea></div>`;
      const groupCount = (k) => { const g = k === "any" ? this.namesDraft : this.namesDraft.groups[k] ?? {}; return ["male", "female", "first", "last"].reduce((a, x) => a + (g[x]?.length ?? 0), 0); };
      const ps = portraitSetting();
      const namesTab = `<section data-tab="names">
        <p class="hint">Add your own names, one per line (or separated by commas). Pick a race to give it its own names; "Any race" names are used for every race. Saved in this world.</p>
        <div class="form-group"><label>Names for</label><select name="n.group">${[["any", "Any race"], ...RACES.map((x) => [x.key, x.label])].map(([k, l]) => { const n = groupCount(k); return opt(k, n ? `${l} (${n})` : l, grp); }).join("")}</select></div>
        <div class="amg-cols4">${ta("male", "Male first names")}${ta("female", "Female first names")}${ta("first", "First names (either)")}${ta("last", "Surnames")}</div>
        <div><label>Shop names (any shop)</label><textarea name="n.shops" style="min-height:4em">${esc((this.namesDraft.shops ?? []).join("\n"))}</textarea></div>
        <div class="form-group"><label>Random names use</label><select name="names">${opt("both", "Built-in names and mine", r("names", "both"))}${opt("mine", "Only my names", r("names", "both"))}${opt("builtin", "Only built-in names", r("names", "both"))}</select></div>
        <div class="amg-footer"><button type="button" data-action="saveNames"><i class="fas fa-save"></i> Save Names</button><button type="button" data-action="sampleNames"><i class="fas fa-dice"></i> Show Examples</button></div>
        <div class="amg-samples" data-samples></div>
        <fieldset><legend>Portraits</legend>
          <div class="form-group"><label>Portrait folder</label><input type="text" name="p.folder" value="${esc(ps.folder)}" placeholder="none: new merchants get the default image"><button type="button" data-action="pickPortraitFolder" title="Browse" style="flex:0 0 2.2em"><i class="fas fa-folder-open"></i></button></div>
          <p class="hint">A new merchant with no image chosen gets a random portrait from this folder (and its subfolders) that fits its race and sex. Put the race and sex in folder or file names, for example <code>dwarf/female/smith-01.webp</code> or <code>elf_male_3.png</code> (plurals such as dwarves, elves, women, and m or f, work). Images with no race or sex in their path fit anyone; an image named for another race or sex is never used.</p>
          <div class="amg-footer"><button type="button" data-action="savePortraits"><i class="fas fa-save"></i> Save and Scan Folder</button></div>
          <div class="amg-samples" data-portraits></div>
        </fieldset>
      </section>`;

      const hub = T();
      const packs = hub?.listItemPacks?.() ?? [];
      const src = hub?.itemSources?.() ?? { mode: "auto", packs: [] };
      const stats = hub?.compendiumStats ?? {};
      const statText = (id) => {
        const st = stats[id];
        if (!st) return src.packs.includes(id) ? "not scanned yet" : "";
        const groups = {};
        for (const [c, n] of Object.entries(st.byCategory)) { const g = catLabel(c); groups[g] = (groups[g] ?? 0) + n; }
        return `${st.total} item${st.total === 1 ? "" : "s"}: ${Object.entries(groups).sort((a, b) => b[1] - a[1]).map(([g, n]) => `${n} ${g.toLowerCase()}`).join(", ")}${st.corrected ? `; ${st.corrected} price${st.corrected === 1 ? "" : "s"} corrected` : ""}`;
      };
      // Extra source kinds registered by modules (Armory: enhancements, special materials...)
      const kindsHtml = (hub?.sourceKinds?.() ?? []).map((k) => {
        const ks = hub.kindSources(k.id);
        const auto = (p) => { try { return typeof k.match === "function" ? !!k.match(p.label, p.id) : k.match instanceof RegExp && k.match.test(p.label); } catch (e) { return false; } };
        const secKey = `kind-${k.id.replace(/[^\w-]/g, "-")}`;
        return `<details class="amg-sec" data-sec="${esc(secKey)}" ${r(`sec.${secKey}`, "0") === "1" ? "open" : ""}><summary>${esc(k.label)} <small>(${esc(game.modules.get(k.module)?.title ?? k.module)}: ${ks.packs.length} compendium${ks.packs.length === 1 ? "" : "s"}, ${ks.mode === "auto" ? "automatic" : "your choice"})</small></summary>
          <div data-kind="${esc(k.id)}">
          ${k.hint ? `<p class="hint">${esc(k.hint)}</p>` : ""}
          <div class="form-group"><label>Compendiums</label><select name="kind.${esc(k.id)}.mode">${opt("auto", "Automatic (matching names)", ks.mode)}${opt("custom", "My choice (tick below)", ks.mode)}</select></div>
          <table class="amg-packs">${packs.map((p) => `<tr><td><input type="checkbox" name="kind.${esc(k.id)}.pack" value="${esc(p.id)}" data-auto="${auto(p) ? 1 : 0}" ${ks.packs.includes(p.id) ? "checked" : ""}></td>
            <td>${esc(p.label)}<br><small>${esc(p.source)}${auto(p) ? " · matches" : ""}</small></td></tr>`).join("")}</table></div></details>`;
      }).join("");
      const sourcesTab = `<section data-tab="sources">
        <p class="hint">Besides the SRD lists and Axecleft's modules, merchants (and treasure, where no module covers a category) draw items from Item compendiums. Each item is sorted by its own data: standard, masterwork or magic weapons, armor and shields, ammunition, gear, alchemical items, potions, scrolls, wands, rings, rods, staffs and wondrous items. Magic items are graded by price (minor up to 4,000 gp, medium up to 25,000 gp). Mounts, services and epic items are left out.</p>
        <div class="form-group"><label>Compendiums</label><select name="src.mode">
          ${opt("auto", "Automatic: D35E's item compendiums and any with a matching name", src.mode)}${opt("custom", "My choice (tick below)", src.mode)}</select></div>
        <p class="hint">Automatic matching picks compendiums named like D35E's (Items, Weapons and Ammo, Armor and Shields, Magic Items), with Gear, Equipment, Weapons, Ammo, Armor, Shields or Magic Items in their name, and Poison Consumables (Axecleft's Traps, Poisons, and Diseases). Poisons are found by their own data in any of your sources.</p>
        <details class="amg-sec" data-sec="srcpacks" ${r("sec.srcpacks", "0") === "1" ? "open" : ""}><summary>Item compendiums <small>(${src.packs.length} of ${packs.length} used, ${src.mode === "auto" ? "automatic" : "your choice"})</small></summary>
        <table class="amg-packs">${packs.map((p) => `<tr><td><input type="checkbox" name="src.pack" value="${esc(p.id)}" ${src.packs.includes(p.id) ? "checked" : ""}></td>
          <td>${esc(p.label)}<br><small>${esc(p.source)}${p.auto ? " · matches" : ""}</small></td><td><small>${esc(statText(p.id))}</small></td></tr>`).join("") || `<tr><td>No Item compendiums found.</td></tr>`}</table></details>
        ${kindsHtml}
        <div class="amg-footer"><button type="button" data-action="saveSources"><i class="fas fa-save"></i> Save and Rescan</button><button type="button" data-action="rescan"><i class="fas fa-rotate"></i> Rescan</button></div>
        <fieldset><legend>Price corrections</legend>
          <p class="hint">Some compendium items have wrong prices (several of D35E's specific magic arms, for example). Corrections from Axecleft's modules, and your own on the "Price Corrections" page of the Treasure Lists journal, fix them for treasure and merchant stock without changing the compendium. ${(hub?.priceCorrections?.() ?? []).length} correction${(hub?.priceCorrections?.() ?? []).length === 1 ? "" : "s"} in force.</p>
          <div class="amg-footer"><button type="button" data-action="priceCheck"><i class="fas fa-scale-balanced"></i> Price Check</button><button type="button" data-action="priceExport"><i class="fas fa-file-csv"></i> Export CSV</button></div>
          <div data-pricecheck></div>
        </fieldset>
      </section>`;
      const tagWords = [...Object.values(hub?.TAG_LABELS ?? {}), ...(hub?.SHOP_HINTS ?? [])];
      const tagsTab = `<section data-tab="tags">
        <p class="hint">Sort your compendium items into the shops that sell them. An item is already sold by the shops that stock its own kind (a magic tome is a wondrous item); a <b>Shop tag</b> lets other shops sell it too (tag the tome <em>Scroll</em> and scribes stock it, tag it <em>Book</em> and booksellers do).</p>
        <details class="amg-sec amg-help" data-sec="taghelp" ${r("sec.taghelp", "0") === "1" ? "open" : ""}><summary>How Shop tags work</summary>
          <p>Shop tags are ordinary D35E item tags written as <code>Shop: Scroll</code>, <code>Shop: Book</code> and so on. This tool writes them for you, and you can also add or remove them by hand in an item's tags.</p>
          <ul><li><b>Category tags</b> add the item to that category as well as its own: ${esc(Object.values(hub?.TAG_LABELS ?? {}).join(", "))}.</li>
          <li><b>Specialty tags</b> pick a specialty shop's wondrous items: <b>Book</b> (booksellers), <b>Clothing</b> (clothiers), <b>Jewelry</b> (jewelers). Your own shop types can use them too (Shop Types tab).</li>
          <li>Scan a compendium. Suggestions come from item names and folder names (a folder called "Books" suggests Scroll and Book). Edit any row's tags, separated by commas, tick the rows to change and press <b>Write Tags</b>. A blank row with a tick removes its Shop tags.</li>
          <li>Only compendiums in your <b>Item Sources</b> stock merchants. Locked compendiums are unlocked for the write and locked again. Write tags in your own compendiums: system and module compendiums are replaced when they update.</li></ul>
        </details>
        <div class="form-group"><label>Compendium</label><select name="tag.pack">${opt("", "Choose an Item compendium…", this.tagPack)}${packs.map((p) => opt(p.id, `${p.label} (${p.source})`, this.tagPack)).join("")}</select>
          <button type="button" data-action="tagScan" style="flex:0 0 7em"><i class="fas fa-magnifying-glass"></i> Scan</button></div>
        <div class="amg-tagstat" data-tagstat></div>
        <div data-tagbody style="display:none">
          <div class="amg-tagbar">
            <select name="tag.show">${opt("suggest", "Rows with new suggestions", r("tagShow", "suggest"))}${opt("all", "All items", r("tagShow", "suggest"))}${opt("tagged", "Items with Shop tags", r("tagShow", "suggest"))}${opt("untagged", "Items without Shop tags", r("tagShow", "suggest"))}${opt("ticked", "Ticked rows", r("tagShow", "suggest"))}</select>
            <input type="text" name="tag.filter" placeholder="Filter by name, folder or tag">
          </div>
          <div class="amg-tagbar">
            <span title="Changes the ticked rows the filter shows">Ticked rows shown:</span>
            <select name="tag.word">${tagWords.map((w) => opt(w, w)).join("")}</select>
            <button type="button" data-action="tagAdd" title="Add this tag to every ticked row"><i class="fas fa-plus"></i> Add</button>
            <button type="button" data-action="tagRemove" title="Remove this tag from every ticked row"><i class="fas fa-minus"></i> Remove</button>
            <button type="button" data-action="tagClear" title="Clear the tags of every ticked row"><i class="fas fa-eraser"></i> Clear</button>
            <button type="button" data-action="tagReset" title="Back to the current tags plus suggestions"><i class="fas fa-rotate-left"></i> Reset</button>
          </div>
          <div class="amg-tagwrap"><table class="amg-tags"><thead><tr><th><input type="checkbox" data-tagall title="Tick or untick every row shown"></th><th>Item</th><th>Sold as</th><th>Shop tags</th></tr></thead><tbody data-tagrows></tbody></table></div>
          <div class="amg-sources" data-tagsrc></div>
          <div class="amg-footer sticky"><button type="button" data-action="tagWrite" class="bright"><i class="fas fa-tags"></i> Write Tags to Ticked Items</button></div>
        </div>
      </section>`;
      const nav = `<nav class="amg-tabs">${[["merchant", "Merchant", "fa-store"], ["types", "Shop Types", "fa-shapes"], ["names", "People", "fa-users"], ["sources", "Item Sources", "fa-boxes-stacked"], ["tags", "Shop Tags", "fa-tags"]]
        .map(([k, l, i]) => `<button type="button" data-tab-btn="${k}"><i class="fas ${i}"></i> ${l}</button>`).join("")}</nav>`;
      return `${STYLE}<form class="amg" autocomplete="off">${nav}${merchant}${typesTab}${namesTab}${sourcesTab}${tagsTab}</form>`;
    }

    _replaceHTML(result, content) {
      content.innerHTML = result;
      const form = content.querySelector("form.amg"), el = (n) => form.elements[n];
      const fit = () => this.fit();
      // Collapsible sections: remember open/closed, and show what's set while closed
      const notes = () => {
        const n = TRAITS.filter((t) => el(`trait.${t.key}`)?.checked).map((t) => t.label.split(" /")[0]);
        const tn = form.querySelector('[data-sec-note="traits"]'); if (tn) tn.textContent = n.length ? `(${n.join(", ")})` : "(none)";
        const pn = form.querySelector('[data-sec-note="prices"]'); if (pn) pn.textContent = `(sells ${el("sell").value || 100}%, buys ${el("buy").value || 50}%, purse ${el("purse").value || "settlement's"})`;
      };
      form.querySelectorAll("details.amg-sec").forEach((d) => d.addEventListener("toggle", () => { remember(`sec.${d.dataset.sec}`, d.open ? "1" : "0"); fit(); }));
      form.addEventListener("change", notes); form.addEventListener("input", notes); notes();
      const showTab = (k) => {
        this.tab = k; remember("tab", k);
        form.querySelectorAll("[data-tab-btn]").forEach((b) => b.classList.toggle("active", b.dataset.tabBtn === k));
        form.querySelectorAll("section[data-tab]").forEach((s) => s.classList.toggle("active", s.dataset.tab === k));
        fit();
      };
      form.querySelectorAll("[data-tab-btn]").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tabBtn)));

      const sources = () => {
        const t = types().find((x) => x.key === el("type").value);
        const hub = T(), CAT = hub?.CATEGORIES ?? {};
        const cats = Object.entries(t?.categories ?? {}).filter(([, w]) => w > 0).map(([c]) => c);
        const hint = (c) => t?.hints?.[c] ?? null;
        const have = cats.filter((c) => hub?.hasProvider?.(c, hint(c))), lack = cats.filter((c) => !hub?.hasProvider?.(c, hint(c)));
        const untagged = lack.filter((c) => hint(c)), noMod = lack.filter((c) => !hint(c));
        const names = (l) => [...new Set(l.map((c) => hintLabel(c, t)))].join(", ");
        form.querySelector("[data-sources]").innerHTML = (have.length ? `<span class="ok">✔ ${esc(names(have))}</span>` : "")
          + (noMod.length ? `<br><span class="no">✘ ${esc(names(noMod))}: needs ${esc([...new Set(noMod.map((c) => CAT[c]?.module ?? "another module"))].join(", "))}</span>` : "")
          + (untagged.length ? `<br><span class="no">✘ ${esc(names(untagged))}: none in your item sources yet (see Shop Tags)</span>` : "");
        const town = SETTLEMENTS.find((s) => s.key === el("settlement").value);
        el("stock").placeholder = town.stock; el("purse").placeholder = town.purse;
      };
      const showMode = () => {
        const m = el("mode").value, sm = el("stockMode").value;
        form.querySelectorAll("[data-mode]").forEach((d) => {
          const on = d.dataset.mode.split(" ").includes(m) && (!d.dataset.stock || d.dataset.stock === sm);
          d.style.display = on ? "" : "none";
        });
        fit();
      };
      el("type").addEventListener("change", sources);
      el("settlement").addEventListener("change", sources);
      el("mode").addEventListener("change", showMode);
      el("stockMode").addEventListener("change", showMode);

      const drop = form.querySelector(".amg-drop");
      form.addEventListener("dragover", (ev) => { ev.preventDefault(); drop.classList.add("over"); });
      form.addEventListener("dragleave", () => drop.classList.remove("over"));
      form.addEventListener("drop", async (ev) => {
        ev.preventDefault(); drop.classList.remove("over");
        let data; try { data = JSON.parse(ev.dataTransfer.getData("text/plain")); } catch (e) { return; }
        if (!data?.uuid || !["Actor", "Token"].includes(data.type)) return ui.notifications.warn("Drop an actor from the Actors sidebar.");
        const doc = await fromUuid(data.uuid); if (!doc) return;
        const sel = el("uuid");
        if (![...sel.options].some((o) => o.value === doc.uuid)) sel.insertAdjacentHTML("beforeend", opt(doc.uuid, doc.name));
        sel.value = doc.uuid; el("mode").value = "actor"; showTab("merchant"); showMode();
      });

      const action = (name, fn) => form.querySelectorAll(`[data-action="${name}"]`).forEach((b) => b.addEventListener("click", async (ev) => {
        ev.preventDefault(); b.disabled = true;
        try { await fn(); } catch (err) { console.error(`AxecleftMerchants | ${name} failed`, err); ui.notifications.error(err.message); }
        finally { b.disabled = false; }
      }));

      action("rollName", () => {
        const p = randomMerchant(types().find((t) => t.key === el("type").value), { race: el("race").value, sex: el("sex").value, names: el("names").value });
        Object.assign(el("name").dataset, { shop: p.shop, rolled: p.name, race: p.raceKey, sex: p.sex });
        el("name").value = p.name;
        ui.notifications.info(`${p.name}, ${p.sex} ${p.race.toLowerCase()}: ${p.shop}`);
      });
      action("pickImg", () => {
        const FP = foundry.applications?.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
        new FP({ type: "imagevideo", current: el("img").value, callback: (path) => { el("img").value = path; } }).render(true);
      });
      action("generate", async () => {
        const v = (n) => el(n)?.value ?? "";
        const traits = TRAITS.filter((t) => el(`trait.${t.key}`)?.checked).map((t) => t.key);
        const opts = { type: v("type"), settlement: v("settlement"), cap: el("cap").checked, traits, stock: v("stock").trim(), unappraised: Number(v("unappraised")),
          sell: Number(v("sell")), buy: Number(v("buy")), purse: v("purse").trim(), mode: v("mode"), uuid: v("uuid"), name: v("name"), nameFormat: v("nameFormat"),
          race: v("race"), sex: v("sex"), names: v("names"), img: v("img").trim(), stockMode: v("stockMode"), useSaved: el("useSaved").checked,
          shop: el("name").dataset.rolled === v("name") ? el("name").dataset.shop : "" };
        // A rolled name keeps the race and sex it was rolled for
        if (el("name").dataset.rolled === v("name") && v("name")) Object.assign(opts, { race: el("name").dataset.race, sex: el("name").dataset.sex });
        for (const k of ["type", "settlement", "unappraised", "sell", "buy", "mode", "nameFormat", "stockMode", "names"]) remember(k, String(opts[k]));
        remember("race", v("race")); remember("sex", v("sex"));
        remember("cap", opts.cap ? "1" : "0"); remember("traits", traits.join(","));
        const res = await generateMerchant(opts);
        ui.notifications.info(`${res.some((x) => x.restock) ? "Restocked" : "Stocked"} ${res.map((x) => x.label).join(", ")}.`);
        if (opts.mode === "new") { res[0]?.actor.sheet?.render(true); el("name").value = ""; }
      });

      // Shop Types tab
      el("ct.edit").addEventListener("change", () => { this.editing = el("ct.edit").value; this.render(); });
      el("ct.from").addEventListener("change", () => {
        const src = types().find((t) => t.key === el("ct.from").value);
        if (!src) return;
        for (const c of CATEGORY_ORDER) el(`w.${c}`).value = src.categories?.[c] ?? "";
        el("ct.kind").value = src.filter?.kind ?? ""; el("ct.make").value = src.filter?.make ?? "";
        el("ct.hint").value = src.hints?.["magic:wondrous"]?.[0] ?? "";
        if (!el("ct.label").value) el("ct.label").value = `${src.label} (custom)`;
      });
      action("saveType", async () => {
        const label = el("ct.label").value.trim();
        if (!label) throw new Error("Give the shop type a name.");
        const categories = Object.fromEntries(CATEGORY_ORDER.map((c) => [c, Number(el(`w.${c}`).value) || 0]).filter(([, w]) => w > 0));
        if (!Object.keys(categories).length) throw new Error("Give at least one category a number above 0.");
        const key = this.editing || `custom-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`;
        const filter = {}; if (el("ct.kind").value) filter.kind = el("ct.kind").value; if (el("ct.make").value) filter.make = el("ct.make").value;
        const hints = el("ct.hint").value ? { "magic:wondrous": [el("ct.hint").value] } : null;
        await saveCustomType({ key, label, categories, ...(Object.keys(filter).length ? { filter } : {}), ...(hints ? { hints } : {}) });
        this.editing = key; remember("type", key);
        ui.notifications.info(`Saved the shop type "${label}".`);
        this.render();
      });
      action("deleteType", async () => {
        const t = customTypes().find((x) => x.key === this.editing);
        if (!t) return;
        await deleteCustomType(t.key);
        this.editing = "";
        ui.notifications.info(`Deleted the shop type "${t.label}".`);
        this.render();
      });

      // Item Sources tab
      const srcMode = () => {
        const auto = el("src.mode").value === "auto";
        const packs = T()?.listItemPacks?.() ?? [];
        form.querySelectorAll('input[name="src.pack"]').forEach((c) => {
          c.disabled = auto;
          if (auto) c.checked = !!packs.find((p) => p.id === c.value)?.auto;
        });
      };
      el("src.mode").addEventListener("change", srcMode); srcMode();
      form.querySelectorAll("div[data-kind]").forEach((fs) => {
        const id = fs.dataset.kind, sel = el(`kind.${id}.mode`);
        const kmode = () => fs.querySelectorAll(`input[name="kind.${CSS.escape(id)}.pack"]`).forEach((c) => {
          c.disabled = sel.value === "auto";
          if (sel.value === "auto") c.checked = c.dataset.auto === "1";
        });
        sel?.addEventListener("change", kmode); kmode();
      });
      action("priceCheck", async () => {
        const rows = await T().priceCheck();
        const box = form.querySelector("[data-pricecheck]");
        const need = rows.filter((r) => r.needed).length;
        box.innerHTML = rows.length ? `<details class="amg-sec" data-sec="pricecheck" open><summary>Price Check <small>(${need} of ${rows.length} compendium price${rows.length === 1 ? "" : "s"} differ${need === 1 ? "s" : ""} from the correction and are fixed in treasure and stock)</small></summary>
          <div class="amg-tagwrap"><table class="amg-tags"><thead><tr><th></th><th>Item</th><th>Compendium</th><th>Now</th><th>Corrected</th></tr></thead><tbody>${rows.map((r) => `<tr>
            <td>${r.needed ? "✘" : "✔"}</td><td>${esc(r.name)}<small>${esc(r.note)}${r.note ? " · " : ""}${esc(r.source)}</small></td><td><small>${esc(r.packLabel)}</small></td>
            <td>${r.found ? esc(gp(r.current)) : "<em>not found</em>"}</td><td>${esc(gp(r.corrected))}</td></tr>`).join("")}</tbody></table></div></details>`
          : `<p class="hint">No price corrections in force.</p>`;
        box.querySelector("details")?.addEventListener("toggle", fit);
        fit();
      });
      action("priceExport", async () => { const n = await T().exportPriceCheck(); ui.notifications.info(`Exported ${n} price check row${n === 1 ? "" : "s"}.`); });
      action("saveSources", async () => {
        for (const fs of form.querySelectorAll("div[data-kind]")) {
          const id = fs.dataset.kind;
          await T().setKindSources(id, { mode: el(`kind.${id}.mode`).value, packs: [...fs.querySelectorAll(`input[name="kind.${CSS.escape(id)}.pack"]`)].filter((c) => c.checked).map((c) => c.value) });
        }
        const packs = [...form.querySelectorAll('input[name="src.pack"]')].filter((c) => c.checked).map((c) => c.value);
        await T().setItemSources({ mode: el("src.mode").value, packs });
        ui.notifications.info("Saved the item sources and rescanned them.");
        this.render();
      });
      action("rescan", async () => { await T().scanCompendiums(); ui.notifications.info("Rescanned the item compendiums."); this.render(); });

      // Names tab
      // Name groups: edits are kept in a draft while switching groups, and saved together
      const NKEYS = ["male", "female", "first", "last"];
      const keepGroup = () => {
        const d = this.namesDraft, g = this.nameGroup ?? "any";
        const tgt = g === "any" ? d : (d.groups[g] ??= {});
        for (const k of NKEYS) tgt[k] = lines(el(`n.${k}`).value);
        d.shops = lines(el("n.shops").value);
      };
      el("n.group").addEventListener("change", () => {
        keepGroup();
        this.nameGroup = el("n.group").value;
        const d = this.namesDraft, g = this.nameGroup;
        const src = g === "any" ? d : d.groups[g] ?? {};
        for (const k of NKEYS) el(`n.${k}`).value = (src[k] ?? []).join("\n");
      });
      action("saveNames", async () => {
        keepGroup();
        const d = this.namesDraft;
        const groups = Object.fromEntries(Object.entries(d.groups ?? {}).map(([k, g]) => [k, Object.fromEntries(NKEYS.filter((x) => g[x]?.length).map((x) => [x, g[x]]))]).filter(([, g]) => Object.keys(g).length));
        await setWorld(SET_NAMES, { first: d.first ?? [], last: d.last ?? [], male: d.male ?? [], female: d.female ?? [], shops: d.shops ?? [], groups });
        this.namesDraft = null;
        remember("names", el("names").value);
        ui.notifications.info("Saved your names.");
        this.render();
      });
      action("sampleNames", () => {
        const t = types().find((x) => x.key === el("type").value);
        form.querySelector("[data-samples]").innerHTML = Array.from({ length: 6 }, () => {
          const g = el("n.group").value;
          const p = randomMerchant(t, { race: g !== "any" ? g : el("race").value, sex: el("sex").value, names: el("names").value });
          return `${esc(p.name)} <small>(${esc(`${p.sex} ${p.race}`.toLowerCase())})</small>: <em>${esc(p.shop)}</em>`;
        }).join("<br>");
        fit();
      });

      // Portraits
      const showPortraits = async (force) => {
        const box = form.querySelector("[data-portraits]");
        if (!portraitSetting().folder) { box.innerHTML = ""; return; }
        const files = await portraitFiles(force);
        const n = (race, sex) => files.filter((f) => f.race === race && f.sex === sex).length;
        const rows = [...RACES.map((x) => [x.key, x.label]), [null, "No race given"]];
        box.innerHTML = `${files.length} image${files.length === 1 ? "" : "s"} found.`
          + (files.length ? `<table class="amg-portraits"><tr><th></th><th>Male</th><th>Female</th><th>No sex given</th></tr>${rows.map(([k, l]) => `<tr><td>${esc(l)}</td><td>${n(k, "male")}</td><td>${n(k, "female")}</td><td>${n(k, null)}</td></tr>`).join("")}</table>` : "");
        fit();
      };
      action("pickPortraitFolder", () => {
        const FP = foundry.applications?.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
        new FP({ type: "folder", current: el("p.folder").value, callback: (path, picker) => { el("p.folder").value = path; el("p.folder").dataset.source = picker?.activeSource ?? ""; } }).render(true);
      });
      action("savePortraits", async () => {
        const folder = el("p.folder").value.trim().replace(/\/+$/, "");
        const source = el("p.folder").dataset.source || (folder === portraitSetting().folder ? portraitSetting().source : "") || "data";
        await setWorld(SET_PORTRAITS, { source, folder });
        el("img").placeholder = folder ? "blank: a portrait from your portrait folder that fits" : "optional portrait or token image";
        await showPortraits(true);
        ui.notifications.info(folder ? "Saved the portrait folder." : "Portraits turned off.");
      });
      showPortraits(false);

      // Shop Tags tab
      this.#wireTags(form, el, action, fit);

      sources(); showMode(); showTab(this.tab);
    }

    #wireTags(form, el, action, fit) {
      const hub = T();
      if (!hub?.tagSuggestions) {
        form.querySelector("[data-tagstat]").innerHTML = `<span class="no">Needs the Treasure Generator script version 7 or later (axecleft-treasure.js).</span>`;
        form.querySelectorAll('[data-action^="tag"]').forEach((b) => { b.disabled = true; });
        return;
      }
      const LABELS = hub.TAG_LABELS, HINTS = hub.SHOP_HINTS;
      const toText = ({ cats = [], hints = [] }) => [...cats.map((c) => LABELS[c] ?? c), ...hints].join(", ");
      const words = (text) => lines(text);
      /** Parse a row's text: { cats, hints, bad: [unknown words] }. */
      const parse = (text) => {
        const cats = new Set(), hints = new Set(), bad = [];
        for (const w of words(text)) {
          const t = hub.readShopTags([[`Shop: ${w.replace(/^shop:\s*/i, "")}`]]);
          if (!t.cats.length && !t.hints.length) bad.push(w);
          t.cats.forEach((c) => cats.add(c)); t.hints.forEach((h) => hints.add(h));
        }
        return { cats: [...cats], hints: [...hints], bad };
      };
      const same = (a, b) => a.cats.length === b.cats.length && a.hints.length === b.hints.length && a.cats.every((c) => b.cats.includes(c)) && a.hints.every((h) => b.hints.includes(h));
      const proposal = (r) => ({ cats: [...new Set([...r.current.cats, ...r.suggested.cats])], hints: [...new Set([...r.current.hints, ...r.suggested.hints])] });
      const body = form.querySelector("[data-tagrows]"), stat = form.querySelector("[data-tagstat]");

      const visible = () => {
        const show = el("tag.show").value, f = el("tag.filter").value.trim().toLowerCase();
        return (this.tagRows ?? []).filter((r) => {
          const hasNow = r.current.cats.length || r.current.hints.length;
          if (show === "suggest" && same(r.current, proposal(r))) return false;
          if (show === "tagged" && !hasNow) return false;
          if (show === "untagged" && hasNow) return false;
          if (show === "ticked" && !r.ticked) return false;
          return !f || `${r.name} ${r.folder} ${r.text} ${r.primary ? catLabel(r.primary) : ""}`.toLowerCase().includes(f);
        });
      };
      const drawStat = () => {
        const rows = this.tagRows ?? [];
        const tagged = rows.filter((r) => r.current.cats.length || r.current.hints.length).length;
        const sugg = rows.filter((r) => !same(r.current, proposal(r))).length;
        const ticked = rows.filter((r) => r.ticked).length;
        stat.innerHTML = this.tagRows ? `${rows.length} items · ${tagged} with Shop tags · ${sugg} with new suggestions · <b>${ticked} ticked</b>` : "";
        const inSources = hub.itemSources?.().packs?.includes(this.tagPack);
        const srcBox = form.querySelector("[data-tagsrc]");
        if (srcBox) srcBox.innerHTML = !this.tagRows || inSources ? ""
          : `<span class="no">This compendium is not one of your item sources, so merchants don't stock from it yet.</span> <button type="button" data-tag-addsrc style="width:auto"><i class="fas fa-plus"></i> Add to Item Sources</button>`;
        srcBox?.querySelector("[data-tag-addsrc]")?.addEventListener("click", async () => {
          const cur = hub.itemSources();
          const packs = [...new Set([...(cur.mode === "auto" ? hub.listItemPacks().filter((p) => p.auto).map((p) => p.id) : cur.packs), this.tagPack])];
          await hub.setItemSources({ mode: "custom", packs });
          ui.notifications.info("Added the compendium to your item sources (set to My choice) and rescanned.");
          drawStat();
        });
      };
      const MAX = 600;
      const draw = () => {
        if (!this.tagRows) { form.querySelector("[data-tagbody]").style.display = "none"; drawStat(); return; }
        form.querySelector("[data-tagbody]").style.display = "";
        const rows = visible(), shown = rows.slice(0, MAX);
        body.innerHTML = shown.map((r) => {
          const p = parse(r.text), changed = !same(p, r.current);
          return `<tr data-id="${esc(r.id)}" class="${changed ? "changed" : ""}"><td><input type="checkbox" data-tick ${r.ticked ? "checked" : ""}></td>
            <td>${esc(r.name)}${r.folder ? `<small>${esc(r.folder)}</small>` : ""}</td>
            <td><small style="display:inline">${esc(r.primary ? catLabel(r.primary) : "not sold")}</small></td>
            <td><input type="text" data-text value="${esc(r.text)}" class="${p.bad.length ? "bad" : ""}" title="${p.bad.length ? esc(`Not a Shop tag: ${p.bad.join(", ")}`) : esc(`Now: ${toText(r.current) || "none"}`)}"></td></tr>`;
        }).join("") + (rows.length > MAX ? `<tr><td></td><td colspan="3"><em>${rows.length - MAX} more rows: use the filter to narrow the list.</em></td></tr>` : "")
          + (!rows.length ? `<tr><td></td><td colspan="3"><em>No rows match.</em></td></tr>` : "");
        const all = form.querySelector("[data-tagall]");
        all.checked = shown.length > 0 && shown.every((r) => r.ticked);
        drawStat(); fit();
      };
      const rowOf = (tr) => this.tagRows?.find((r) => r.id === tr?.dataset.id);
      body.addEventListener("change", (ev) => {
        const r = rowOf(ev.target.closest("tr")); if (!r) return;
        if (ev.target.matches("[data-tick]")) { r.ticked = ev.target.checked; drawStat(); }
      });
      body.addEventListener("input", (ev) => {
        if (!ev.target.matches("[data-text]")) return;
        const tr = ev.target.closest("tr"), r = rowOf(tr); if (!r) return;
        r.text = ev.target.value; r.ticked = true;
        const p = parse(r.text);
        tr.querySelector("[data-tick]").checked = true;
        tr.classList.toggle("changed", !same(p, r.current));
        ev.target.classList.toggle("bad", p.bad.length > 0);
        ev.target.title = p.bad.length ? `Not a Shop tag: ${p.bad.join(", ")}` : `Now: ${toText(r.current) || "none"}`;
        drawStat();
      });
      form.querySelector("[data-tagall]").addEventListener("change", (ev) => {
        visible().slice(0, MAX).forEach((r) => { r.ticked = ev.target.checked; });
        draw();
      });
      el("tag.show").addEventListener("change", () => { remember("tagShow", el("tag.show").value); draw(); });
      el("tag.filter").addEventListener("input", draw);
      el("tag.pack").addEventListener("change", () => { this.tagPack = el("tag.pack").value; remember("tagPack", this.tagPack); this.tagRows = null; draw(); });

      const scan = async () => {
        if (!this.tagPack) throw new Error("Choose a compendium to scan.");
        const rows = await hub.tagSuggestions(this.tagPack);
        this.tagRows = rows.map((r) => {
          const prop = proposal(r);
          return { ...r, text: toText(prop), ticked: !same(r.current, prop) };
        });
      };
      action("tagScan", async () => { await scan(); draw(); });
      const edit = (fn) => {
        const w = el("tag.word").value;
        const ticked = visible().filter((r) => r.ticked); // only rows the filter shows, never hidden ones
        if (!ticked.length) throw new Error("Tick some of the rows shown first.");
        for (const r of ticked) r.text = fn(words(r.text), w).join(", ");
        draw();
      };
      action("tagAdd", () => edit((l, w) => (l.some((x) => x.toLowerCase() === w.toLowerCase()) ? l : [...l, w])));
      action("tagRemove", () => edit((l, w) => l.filter((x) => parse(x).cats.join() + parse(x).hints.join() !== parse(w).cats.join() + parse(w).hints.join())));
      action("tagClear", () => edit(() => []));
      action("tagReset", () => {
        for (const r of visible().filter((x) => x.ticked)) r.text = toText(proposal(r));
        draw();
      });
      action("tagWrite", async () => {
        const ticked = (this.tagRows ?? []).filter((r) => r.ticked);
        if (!ticked.length) throw new Error("Tick the rows to write.");
        const bad = ticked.filter((r) => parse(r.text).bad.length);
        if (bad.length) throw new Error(`Fix the unknown tags first (${bad.slice(0, 3).map((r) => r.name).join(", ")}${bad.length > 3 ? "…" : ""}). Shop tags: ${[...Object.values(LABELS), ...HINTS].join(", ")}.`);
        const writes = ticked.map((r) => ({ id: r.id, ...parse(r.text) })).filter((w) => !same(w, this.tagRows.find((r) => r.id === w.id).current));
        if (!writes.length) { ticked.forEach((r) => { r.ticked = false; }); draw(); return ui.notifications.info("Nothing to change: the ticked items already have those tags."); }
        const label = game.packs.get(this.tagPack)?.metadata?.label ?? this.tagPack;
        const ok = await foundry.applications.api.DialogV2.confirm({
          window: { title: "Write Shop Tags" },
          content: `<p>Write Shop tags to <b>${writes.length}</b> item${writes.length === 1 ? "" : "s"} in <b>${esc(label)}</b>?</p><p><small>Only the items' Shop tags change; their other tags are kept.</small></p>`,
        });
        if (!ok) return;
        const n = await hub.applyShopTags(this.tagPack, writes.map(({ id, cats, hints }) => ({ id, cats, hints })));
        await scan();
        ui.notifications.info(`Wrote Shop tags to ${n} item${n === 1 ? "" : "s"} in ${label}.`);
        this.render(); // the rescan may already have redrawn the window
      });
      draw();
    }
  }

  let APP = existing?._app ?? null;
  /** Open the window, optionally on a tab: "merchant", "types", "names", "sources" or "tags". */
  function open(tab) {
    if (!game.user.isGM) return ui.notifications.warn("Only the GM can generate merchants.");
    if (!(APP instanceof MerchantGenerator)) APP = new MerchantGenerator();
    api._app = APP;
    if (typeof tab === "string") { APP.tab = tab; remember("tab", tab); }
    return APP.render(true);
  }

  const api = {
    version: AXECLEFT_MERCHANTS_VERSION, hosts, extraTypes, SETTLEMENTS, TRAITS, RACES,
    get TYPES() { return types(); },
    SEXES, open, generateMerchant, rollStock, randomMerchant, pickPortrait, portraitFiles, portraitTags, registerMerchantType, saveCustomType, deleteCustomType,
    refresh() { if (APP?.rendered) APP.render(); },
    _onInit() {
      registerWorld(SET_TYPES, { types: [] });
      registerWorld(SET_NAMES, { first: [], last: [], shops: [] });
      registerWorld(SET_PORTRAITS, { source: "data", folder: "" });
      globalThis.AxecleftTools?.register({
        module: host() ?? "axecleft-merchants", name: "merchant-generator", title: "Merchant Generator", icon: "fas fa-store",
        hint: "Create, stock and restock D35E merchants", gmOnly: true, onClick: () => globalThis.AxecleftMerchants.open("merchant"),
      });
      globalThis.AxecleftTools?.register({
        module: host() ?? "axecleft-merchants", name: "shop-tags", title: "Shop Tags", icon: "fas fa-tags",
        hint: "Tag compendium items with the shops that sell them", gmOnly: true, onClick: () => globalThis.AxecleftMerchants.open("tags"),
      });
      Hooks.callAll("axecleftMerchants.ready", api);
    },
  };
  globalThis.AxecleftMerchants = api;
  if (!existing && globalThis.Hooks) Hooks.once("init", () => globalThis.AxecleftMerchants._onInit());
})();
