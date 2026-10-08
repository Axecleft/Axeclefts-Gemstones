/**
 * Axecleft's Treasure Generator — shared hub, version 9.91.
 *
 * Copy this same file into every Axecleft module that makes treasure (Gemstones,
 * Armory, Curios...) and list it in module.json "esmodules" AFTER
 * scripts/axecleft-tools.js and BEFORE the module's own scripts. Whichever copy
 * has the highest version runs; the others step aside. So the Treasure Generator
 * works as long as ANY of those modules is active.
 *
 * The hub owns the window, "Put items in", chat cards and the SRD Treasure table
 * by encounter level (coins, goods, items). Modules plug in with:
 *
 *   const T = globalThis.AxecleftTreasure;
 *   T.registerTab({ module, name, title, icon, order, prepare?, content, wire?, generate? });
 *   T.registerButton({ module, name, title, icon, hint, onClick });
 *   T.registerProvider({ module, name, label, categories: ["gem", "art"], roll, recreate? });
 *   T.registerList({ module, key, page, label, cols: [[field, header, input?], ...], intro, normalize?, builtin? });
 *   T.customList(module, key)   // a list with the GM's additions and switched-off entries applied
 *   T.registerSourceKind({ module, key, label, match, accept, hint })   // extra compendium sources (enhancements, materials...)
 *   T.registerPriceCorrections({ module, corrections: [{ pack, name, price, note }] })   // fix wrong compendium prices
 *   T.generation()              // the world's Generation Settings (light, intelligence, hints, poisons)
 *   T.rules()                   // the world's campaign switches: { psionics, epic } (version 9.5)
 *   T.registerItemMarks({ module, epic: [names], psionic: [names] })   // mark compendium items as epic or psionic
 *   T.enhanceDatalists(root)    // searchable lists that scroll and stay on screen (version 9.6)
 *   T.lootTokens(tokens?, opts) // each NPC token's own SRD treasure by its CR (version 9.7); T.clearLoot(tokens?)
 *
 * Register at load time (top level of your script). See README "For module authors".
 */
const AXECLEFT_TREASURE_VERSION = 9.91;
const AXECLEFT_TREASURE_HOST = (() => {
  try { return decodeURIComponent(new URL(import.meta.url).pathname).match(/\/modules\/([^/]+)\//)?.[1] ?? null; } catch (e) { return null; }
})();

(() => {
  const existing = globalThis.AxecleftTreasure;
  if (existing && existing.version >= AXECLEFT_TREASURE_VERSION) { existing.hosts?.add(AXECLEFT_TREASURE_HOST); return; }

  const registry = existing?.registry ?? { tabs: new Map(), buttons: new Map(), providers: new Map() };
  registry.sourceKinds ??= new Map();  // "module.key" -> extra compendium source kind (version 9)
  registry.corrections ??= new Map();  // module -> [{ pack, name, price, note }] (version 9)
  registry.marks ??= new Map();        // module -> { epic: Set, psionic: Set } of normalized item names (version 9.5)
  const hosts = existing?.hosts ?? new Set();
  if (AXECLEFT_TREASURE_HOST) hosts.add(AXECLEFT_TREASURE_HOST);

  const ITEM_FOLDER = "Generated Treasure";
  const FLAG = "world";               // chat card flags live under flags.world.axecleftTreasure
  const FLAG_KEY = "axecleftTreasure";
  const STORE = "axecleft-treasure.";  // localStorage keys for remembered choices

  /* ------------------------------------------ */
  /*  SRD tables                                */
  /* ------------------------------------------ */

  // Treasure by Encounter Level 1-20: [d% min, d% max, type, amount]
  const LEVELS = [{"level":1,"coins":[[1,14,"nothing","1d1"],[15,29,"cp","1d6*1000"],[30,52,"sp","1d8*100"],[53,95,"gp","2d8*10"],[96,100,"pp","1d4*10"]],"goods":[[1,90,"nothing","1d1"],[91,95,"gems","1d1"],[96,100,"art","1d1"]],"items":[[1,71,"nothing","1d1"],[72,95,"mundane","1d1"],[96,100,"minor","1d1"]]},{"level":2,"coins":[[1,13,"nothing","1d1"],[14,23,"cp","1d10*1000"],[24,43,"sp","2d10*100"],[44,95,"gp","4d10*10"],[96,100,"pp","2d8*10"]],"goods":[[1,81,"nothing","1d1"],[82,95,"gems","1d3"],[96,100,"art","1d3"]],"items":[[1,49,"nothing","1d1"],[50,85,"mundane","1d1"],[86,100,"minor","1d1"]]},{"level":3,"coins":[[1,11,"nothing","1d1"],[12,21,"cp","2d10*1000"],[22,41,"sp","4d8*100"],[42,95,"gp","1d4*100"],[96,100,"pp","1d10*10"]],"goods":[[1,77,"nothing","1d1"],[78,95,"gems","1d3"],[96,100,"art","1d3"]],"items":[[1,49,"nothing","1d1"],[50,79,"mundane","1d3"],[80,100,"minor","1d1"]]},{"level":4,"coins":[[1,11,"nothing","1d1"],[12,21,"cp","3d10*1000"],[22,41,"sp","4d12*1000"],[42,95,"gp","1d6*100"],[96,100,"pp","1d8*10"]],"goods":[[1,70,"nothing","1d1"],[71,95,"gems","1d4"],[96,100,"art","1d3"]],"items":[[1,42,"nothing","1d1"],[43,62,"mundane","1d4"],[63,100,"minor","1d1"]]},{"level":5,"coins":[[1,10,"nothing","1d1"],[11,19,"cp","1d4*10000"],[20,38,"sp","1d6*1000"],[39,95,"gp","1d8*100"],[96,100,"pp","1d10*10"]],"goods":[[1,60,"nothing","1d1"],[61,95,"gems","1d4"],[96,100,"art","1d4"]],"items":[[1,57,"nothing","1d1"],[58,67,"mundane","1d4"],[68,100,"minor","1d3"]]},{"level":6,"coins":[[1,10,"nothing","1d1"],[11,18,"cp","1d6*10000"],[19,37,"sp","1d8*1000"],[38,95,"gp","1d10*100"],[96,100,"pp","1d12*10"]],"goods":[[1,56,"nothing","1d1"],[57,92,"gems","1d4"],[93,100,"art","1d4"]],"items":[[1,54,"nothing","1d1"],[55,59,"mundane","1d4"],[60,99,"minor","1d3"],[100,100,"medium","1d1"]]},{"level":7,"coins":[[1,11,"nothing","1d1"],[12,18,"cp","1d10*10000"],[19,35,"sp","1d12*1000"],[36,93,"gp","2d6*100"],[94,100,"pp","3d4*10"]],"goods":[[1,48,"nothing","1d1"],[49,88,"gems","1d4"],[89,100,"art","1d4"]],"items":[[1,51,"nothing","1d1"],[52,97,"minor","1d3"],[98,100,"medium","1d1"]]},{"level":8,"coins":[[1,10,"nothing","1d1"],[11,15,"cp","1d12*10000"],[16,29,"sp","2d6*1000"],[30,87,"gp","2d8*100"],[88,100,"pp","3d6*10"]],"goods":[[1,45,"nothing","1d1"],[46,85,"gems","1d6"],[86,100,"art","1d4"]],"items":[[1,48,"nothing","1d1"],[49,96,"minor","1d4"],[97,100,"medium","1d1"]]},{"level":9,"coins":[[1,10,"nothing","1d1"],[11,15,"cp","2d6*10000"],[16,29,"sp","2d8*1000"],[30,85,"gp","5d4*100"],[86,100,"pp","2d12*10"]],"goods":[[1,40,"nothing","1d1"],[41,80,"gems","1d8"],[81,100,"art","1d4"]],"items":[[1,43,"nothing","1d1"],[44,91,"minor","1d4"],[92,100,"medium","1d1"]]},{"level":10,"coins":[[1,10,"nothing","1d1"],[11,24,"sp","2d10*1000"],[25,79,"gp","6d4*100"],[80,100,"pp","5d6*10"]],"goods":[[1,35,"nothing","1d1"],[36,79,"gems","1d8"],[80,100,"art","1d6"]],"items":[[1,40,"nothing","1d1"],[41,88,"minor","1d4"],[89,99,"medium","1d1"],[100,100,"major","1d1"]]},{"level":11,"coins":[[1,8,"nothing","1d1"],[9,14,"sp","3d10*1000"],[15,75,"gp","4d8*100"],[76,100,"pp","4d10*10"]],"goods":[[1,24,"nothing","1d1"],[25,74,"gems","1d10"],[75,100,"art","1d6"]],"items":[[1,31,"nothing","1d1"],[32,84,"minor","1d4"],[85,98,"medium","1d1"],[99,100,"major","1d1"]]},{"level":12,"coins":[[1,8,"nothing","1d1"],[9,14,"sp","3d12*1000"],[15,75,"gp","1d4*1000"],[76,100,"pp","1d4*100"]],"goods":[[1,17,"nothing","1d1"],[18,70,"gems","1d10"],[71,100,"art","1d8"]],"items":[[1,27,"nothing","1d1"],[28,82,"minor","1d6"],[83,97,"medium","1d1"],[98,100,"major","1d1"]]},{"level":13,"coins":[[1,8,"nothing","1d1"],[9,75,"gp","1d4*1000"],[76,100,"pp","1d10*100"]],"goods":[[1,11,"nothing","1d1"],[12,66,"gems","1d12"],[67,100,"art","1d10"]],"items":[[1,19,"nothing","1d1"],[20,73,"minor","1d6"],[74,95,"medium","1d1"],[96,100,"major","1d1"]]},{"level":14,"coins":[[1,8,"nothing","1d1"],[9,75,"gp","1d6*1000"],[76,100,"pp","1d12*100"]],"goods":[[1,11,"nothing","1d1"],[12,66,"gems","2d8"],[67,100,"art","2d6"]],"items":[[1,19,"nothing","1d1"],[20,58,"minor","1d6"],[59,92,"medium","1d1"],[93,100,"major","1d1"]]},{"level":15,"coins":[[1,3,"nothing","1d1"],[4,74,"gp","1d8*1000"],[75,100,"pp","3d4*100"]],"goods":[[1,9,"nothing","1d1"],[10,65,"gems","2d10"],[66,100,"art","2d8"]],"items":[[1,11,"nothing","1d1"],[12,46,"minor","1d10"],[47,90,"medium","1d1"],[91,100,"major","1d1"]]},{"level":16,"coins":[[1,3,"nothing","1d1"],[4,74,"gp","1d12*1000"],[75,100,"pp","3d4*100"]],"goods":[[1,7,"nothing","1d1"],[8,64,"gems","4d6"],[65,100,"art","2d10"]],"items":[[1,40,"nothing","1d1"],[41,46,"minor","1d10"],[47,90,"medium","1d3"],[91,100,"major","1d1"]]},{"level":17,"coins":[[1,3,"nothing","1d1"],[4,68,"gp","3d4*1000"],[69,100,"pp","2d10*100"]],"goods":[[1,4,"nothing","1d1"],[5,63,"gems","4d8"],[64,100,"art","3d8"]],"items":[[1,33,"nothing","1d1"],[34,83,"medium","1d3"],[84,100,"major","1d1"]]},{"level":18,"coins":[[1,2,"nothing","1d1"],[3,65,"gp","3d6*1000"],[66,100,"pp","5d4*100"]],"goods":[[1,4,"nothing","1d1"],[5,54,"gems","3d12"],[55,100,"art","3d10"]],"items":[[1,24,"nothing","1d1"],[25,80,"medium","1d4"],[81,100,"major","1d1"]]},{"level":19,"coins":[[1,2,"nothing","1d1"],[3,65,"gp","3d8*1000"],[66,100,"pp","3d10*100"]],"goods":[[1,3,"nothing","1d1"],[4,50,"gems","6d6"],[51,100,"art","6d6"]],"items":[[1,4,"nothing","1d1"],[5,70,"medium","1d4"],[71,100,"major","1d1"]]},{"level":20,"coins":[[1,2,"nothing","1d1"],[3,65,"gp","4d8*1000"],[66,100,"pp","4d10*100"]],"goods":[[1,2,"nothing","1d1"],[3,38,"gems","4d10"],[39,100,"art","7d6"]],"items":[[1,25,"nothing","1d1"],[26,65,"medium","1d4"],[66,100,"major","1d3"]]}];
  // SRD Mundane Items: d% -> category
  const MUNDANE = [[1, 17, "mundane:alchemical"], [18, 50, "mundane:armor"], [51, 83, "mundane:weapon"], [84, 100, "mundane:gear"]];
  // Alchemical items and tools & gear: [min, max, name, quantity, value]
  const MUNDANE_ITEMS = {"alchemical":[[1,12,"Alchemist’s fire","1d4",20],[13,24,"Acid","2d4",10],[25,36,"Smokesticks","1d4",20],[37,48,"Holy water","1d4",25],[49,62,"Antitoxin","1d4",50],[63,74,"Everburning torch","1d1",0],[75,88,"Tanglefoot bags","1d4",50],[89,100,"Thunderstones","1d4",30]],"gear":[[1,3,"Backpack, empty","1d1",2],[4,6,"Crowbar","1d1",2],[7,11,"Lantern, bullseye","1d1",12],[12,16,"Lock, simple","1d1",20],[17,21,"Lock, average","1d1",40],[22,28,"Lock, good","1d1",80],[29,35,"Lock, superior","1d1",150],[36,40,"Manacles, masterwork","1d1",50],[41,43,"Mirror, small steel","1d1",10],[44,46,"Rope, silk (50 ft.)","1d1",10],[47,53,"Spyglass","1d1",1000],[54,58,"Artisan’s tools, masterwork","1d1",55],[59,63,"Climber’s kit","1d1",80],[64,68,"Disguise kit","1d1",50],[69,73,"Healer’s kit","1d1",50],[74,77,"Holy symbol, silver","1d1",25],[78,81,"Hourglass","1d1",25],[82,88,"Magnifying glass","1d1",100],[89,95,"Musical instrument, masterwork","1d1",100],[96,100,"Thieves’ tools, masterwork","1d1",50]]};
  // Random magic items: [type, minor range, medium range, major range]
  const MAGIC = [["Armor and shields",[1,4],[1,10],[1,10]],["Weapons",[5,9],[11,20],[11,20]],["Potions",[10,44],[21,30],[21,25]],["Rings",[45,46],[31,40],[26,35]],["Rods",[0,0],[41,50],[36,45]],["Scrolls",[47,81],[51,65],[46,55]],["Staffs",[0,0],[66,68],[56,75]],["Wands",[82,91],[69,83],[76,80]],["Wondrous items",[92,100],[84,100],[81,100]]];
  const MAGIC_KEYS = { "Armor and shields": "magic:armor", Weapons: "magic:weapon", Potions: "magic:potion", Rings: "magic:ring", Rods: "magic:rod",
    Scrolls: "magic:scroll", Staffs: "magic:staff", Wands: "magic:wand", "Wondrous items": "magic:wondrous" };

  /** Every category the Treasure table can ask for, and which module is expected to supply it. */
  const CATEGORIES = {
    gem: { label: "Gem", module: "Axecleft's Gemstones" },
    art: { label: "Art object", module: "Axecleft's Gemstones" },
    "mundane:alchemical": { label: "Alchemical item", module: "built in (D35E items)" },
    "mundane:armor": { label: "Masterwork armor or shield", module: "Axecleft's Armory" },
    "mundane:weapon": { label: "Masterwork weapon", module: "Axecleft's Armory" },
    "mundane:gear": { label: "Tools and gear", module: "built in (D35E items)" },
    "mundane:poison": { label: "Poison", module: "item compendiums (Axecleft's Traps, Poisons, and Diseases)" },
    "magic:armor": { label: "armor or shield", magic: true, module: "Axecleft's Armory" },
    "magic:weapon": { label: "weapon", magic: true, module: "Axecleft's Armory" },
    "magic:potion": { graded: true, label: "potion", module: "Axecleft's Curios" },
    "magic:ring": { graded: true, label: "ring", module: "Axecleft's Curios" },
    "magic:rod": { graded: true, label: "rod", module: "Axecleft's Curios" },
    "magic:scroll": { graded: true, label: "scroll", module: "Axecleft's Curios" },
    "magic:staff": { graded: true, label: "staff", module: "Axecleft's Curios" },
    "magic:wand": { graded: true, label: "wand", module: "Axecleft's Curios" },
    "magic:wondrous": { graded: true, label: "wondrous item", module: "Axecleft's Curios" },
    // Merchant stock (not on the SRD Treasure table): ordinary arms and armor
    "standard:weapon": { label: "Weapon", module: "item compendiums" },
    "standard:armor": { label: "Armor", module: "item compendiums" },
    "standard:shield": { label: "Shield", module: "item compendiums" },
    "standard:ammo": { label: "Ammunition", module: "item compendiums" },
  };

  /* ------------------------------------------ */
  /*  Small helpers                             */
  /* ------------------------------------------ */

  const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const opt = (v, label, sel) => `<option value="${esc(v)}"${String(v) === String(sel ?? "") ? " selected" : ""}>${esc(label)}</option>`;
  const gp = (n) => `${Number(Math.round(n * 100) / 100).toLocaleString("en-US")} gp`;
  const d100 = () => 1 + Math.floor(Math.random() * 100);
  const inRange = (rows, r) => rows.find((x) => r >= x[0] && r <= x[1]);
  const diceText = (d) => (d === "1d1" ? "1" : d.replace(/\*/g, " × "));
  function rollDice(formula) {
    const expr = String(formula).replace(/\s+/g, "").replace(/(\d*)d(\d+)/gi, (_, n, s) => {
      let t = 0; for (let i = 0; i < (+n || 1); i++) t += 1 + Math.floor(Math.random() * +s); return String(t);
    });
    if (!/^[\d+\-*/().]+$/.test(expr)) throw new Error(`Can't roll "${formula}"`);
    return Function(`"use strict"; return (${expr});`)();
  }
  const remember = (k, v) => { try { localStorage.setItem(STORE + k, v); } catch (e) { /* private mode */ } };
  const recall = (k, d) => { try { return localStorage.getItem(STORE + k) ?? d; } catch (e) { return d; } };
  const isActive = (def) => !def?.module || (game.modules.get(def.module)?.active ?? true);
  const host = () => [...hosts].find((h) => game.modules.get(h)?.active) ?? [...hosts][0] ?? null;

  /* ------------------------------------------ */
  /*  Currencies (D35E renamed and custom coins) */
  /* ------------------------------------------ */

  const STD = ["pp", "gp", "sp", "cp"];
  const STD_VALUE = { pp: 10, gp: 1, sp: 0.1, cp: 0.01 };
  const COIN_FLAG = "axecleftTreasureCoins";

  /**
   * The world's currencies: the four standard coins (with any names set in D35E's
   * "Currency names" setting) and the custom currencies from D35E's Currency
   * Configuration ([id, name, weight, value in gp, group]).
   */
  function currencies() {
    const names = globalThis.CONFIG?.D35E?.currencies ?? {};
    const label = (k) => { const n = names[k]; return n ? (game.i18n?.localize?.(n) ?? n) : k; };
    const std = STD.map((k) => ({ key: `std:${k}`, id: k, custom: false, name: label(k), value: STD_VALUE[k] }));
    let rows = [];
    try { rows = game.settings.get("D35E", "currencyConfig")?.currency ?? []; } catch (e) { /* setting missing */ }
    const custom = rows.filter((c) => Array.isArray(c) && String(c[0] ?? "").trim())
      .map((c) => ({ key: `custom:${c[0]}`, id: String(c[0]), custom: true, name: String(c[1] || c[0]), value: Number(c[3]) || 0, group: String(c[4] || "") }));
    return { std, custom, all: [...std, ...custom], byKey: (k) => [...std, ...custom].find((x) => x.key === k) ?? null, name: label };
  }

  /*
   * The Coins choices are a world setting, so each world keeps its own currency
   * setup whichever GM opens the generator. It is registered under the "world"
   * namespace (not a module's), so it survives whichever Axecleft modules are active.
   * Version 2 kept the choices on the GM's user; those are read once as a fallback.
   */
  let coinNamespace = null;
  function registerCoinSetting() {
    for (const ns of ["world", host()].filter(Boolean)) {
      try {
        if (!game.settings.settings?.has?.(`${ns}.${COIN_FLAG}`)) game.settings.register(ns, COIN_FLAG, { scope: "world", config: false, type: Object, default: {} });
        coinNamespace = ns;
        return;
      } catch (e) { console.warn(`AxecleftTreasure | could not register the coin setting under "${ns}"`, e); }
    }
  }
  const savedCoins = () => {
    let saved = null;
    try { if (coinNamespace) saved = game.settings.get(coinNamespace, COIN_FLAG); } catch (e) { /* not registered */ }
    if (!saved?.map) saved = game.user?.getFlag?.(FLAG, COIN_FLAG) ?? {}; // version 2 (per GM)
    return saved ?? {};
  };

  /** How SRD coins are paid out: { map: { pp: "std:pp" | "custom:id", ... }, purse: "currency" | "altCurrency" }. */
  function coinSettings() {
    const saved = savedCoins();
    return { map: Object.fromEntries(STD.map((k) => [k, saved.map?.[k] || `std:${k}`])), purse: saved.purse === "altCurrency" ? "altCurrency" : "currency" };
  }
  async function saveCoinSettings(cfg) {
    try {
      if (!coinNamespace) throw new Error("setting not registered");
      await game.settings.set(coinNamespace, COIN_FLAG, cfg);
    } catch (e) {
      console.warn("AxecleftTreasure | could not save the world coin setting; saving for this GM instead", e);
      try { await game.user?.setFlag?.(FLAG, COIN_FLAG, cfg); } catch (e2) { /* give up quietly */ }
    }
  }

  /**
   * Convert rolled SRD coins (e.g. { gp: 2000, sp: 300 }) into the currencies chosen
   * on the Treasure by Level tab, by value. A custom currency only takes whole coins;
   * what's left over is paid as change in standard coins (gp, sp, cp).
   * Returns { std: {pp,gp,sp,cp}, custom: {id: n}, text }.
   */
  function convertCoins(coins, cfg = coinSettings(), cur = currencies()) {
    const std = { pp: 0, gp: 0, sp: 0, cp: 0 }, custom = {};
    let changeCp = 0;
    for (const [k, amount] of Object.entries(coins)) {
      if (!amount) continue;
      const target = cur.byKey(cfg.map[k]);
      if (!target || target.key === `std:${k}` || !(target.value > 0)) { std[k] += amount; continue; }
      const totalCp = Math.round(amount * STD_VALUE[k] * 100);
      const unitCp = target.value * 100;
      const units = Math.floor(totalCp / unitCp + 1e-9);
      if (target.custom) custom[target.id] = (custom[target.id] ?? 0) + units;
      else std[target.id] += units;
      changeCp += Math.round(totalCp - units * unitCp);
    }
    if (changeCp > 0) { std.gp += Math.floor(changeCp / 100); std.sp += Math.floor((changeCp % 100) / 10); std.cp += changeCp % 10; }
    const fmt = (n) => Number(n).toLocaleString("en-US");
    const text = [
      ...STD.filter((k) => std[k]).map((k) => `${fmt(std[k])} ${cur.name(k)}`),
      ...Object.entries(custom).filter(([, n]) => n).map(([id, n]) => `${fmt(n)} ${cur.custom.find((c) => c.id === id)?.name ?? id}`),
    ].join(", ");
    return { std, custom, text };
  }


  /* ------------------------------------------ */
  /*  Generation Settings (version 9)           */
  /* ------------------------------------------ */

  /*
   * World settings for extras the generators add to random items: light, intelligence, inscription
   * hints and poisons. Shared by every Axecleft module (Armory and Curios read them with
   * T.generation()); edited in the "Generation settings" section of the Treasure by Level tab.
   * Defaults: the SRD where it has a rule (30% of magic melee weapons shed light as a light spell;
   * 15% of weapons carry a hint; under 1% of permanent items are intelligent), Axecleft's house rules
   * elsewhere (light on 5% of armor and shields, 1% of other permanent items; poison on 1% of mundane rolls).
   */
  const GEN_KEY = "axecleftGeneration";
  let pendingGen = null; // a Generation settings save waiting for its debounce (flushed when the window closes)
  const GEN_CATS = [["melee", "Magic melee weapons"], ["ranged", "Magic ranged weapons"], ["armor", "Magic armor and shields"], ["other", "Other permanent magic items"]];
  const GEN_DEFAULTS = {
    light: {
      enabled: true, themes: true, powerBrightness: true, scaleRadii: false, scaleFeet: 5,
      melee: { on: true, chance: 30, bright: 20, dim: 40 },
      ranged: { on: false, chance: 0, bright: 20, dim: 40 },
      armor: { on: true, chance: 5, bright: 10, dim: 20 },
      other: { on: true, chance: 1, bright: 5, dim: 10 },
    },
    intelligence: {
      enabled: true,
      melee: { on: true, chance: 1 }, ranged: { on: true, chance: 1 }, armor: { on: true, chance: 1 }, other: { on: true, chance: 1 },
      purpose: { on: true, greater: true, chance: 0 },
    },
    hints: { enabled: true, melee: { on: true, chance: 15 }, ranged: { on: true, chance: 15 } },
    poison: { enabled: true, chance: 1 },
    size: { enabled: true, small: 30, medium: 60, large: 10 },
    // Campaign switches (version 9.5), shared by every Axecleft module: psionic items and powers, and epic items
    rules: { psionics: true, epic: false, epicShare: 25 },
    // Token loot (version 9.7): each NPC token's own treasure by its CR
    loot: { auto: false, chat: true, hidden: true, coins: true, goods: true, items: true, replace: true, trapShare: 0.25 },
  };
  function registerGenerationSetting() {
    const ns = coinNamespace ?? "world";
    try { if (!game.settings.settings?.has?.(`${ns}.${GEN_KEY}`)) game.settings.register(ns, GEN_KEY, { scope: "world", config: false, type: Object, default: {} }); }
    catch (e) { console.warn("AxecleftTreasure | could not register the generation setting", e); }
  }
  /** The world's Generation Settings: the defaults with the GM's changes merged in. */
  function generation() {
    let saved = {};
    try { saved = game.settings.get(coinNamespace ?? "world", GEN_KEY) ?? {}; } catch (e) { /* not registered */ }
    return foundry.utils.mergeObject(foundry.utils.deepClone(GEN_DEFAULTS), saved ?? {}, { inplace: false, insertKeys: false });
  }
  async function saveGeneration(cfg) {
    try { await game.settings.set(coinNamespace ?? "world", GEN_KEY, cfg); }
    catch (e) { console.error("AxecleftTreasure | could not save the generation settings", e); ui.notifications.error("Could not save the generation settings."); }
  }
  const resetGeneration = () => saveGeneration({});
  /** The world's campaign switches: { psionics: true|false, epic: true|false }. */
  const rules = () => ({ psionics: true, epic: false, epicShare: 25, ...(generation().rules ?? {}) });

  /** Roll whether a random item gets an extra: genChance("light", "melee") is true about 30% of the time by default. */
  function genChance(kind, cat = null) {
    const g = generation()[kind];
    if (!g?.enabled) return false;
    const c = cat ? g[cat] : g;
    if (!c || c.on === false) return false;
    return Math.random() * 100 < (Number(c.chance) || 0);
  }

  /** The Generation settings fieldset on the Treasure by Level tab. */
  function generationSection() {
    const g = generation();
    const num = (name, v, max = 100, step = 1) => `<input type="number" name="${name}" value="${esc(v)}" min="0" max="${max}" step="${step}">`;
    const cb = (name, v, label = "") => `<label class="atg-cb"><input type="checkbox" name="${name}" ${v ? "checked" : ""}>${label ? ` ${esc(label)}` : ""}</label>`;
    const rows = GEN_CATS.map(([k, label]) => `<tr><td>${esc(label)}</td>
        <td>${cb(`gen.light.${k}.on`, g.light[k].on)} ${num(`gen.light.${k}.chance`, g.light[k].chance)}%</td>
        <td>${num(`gen.light.${k}.bright`, g.light[k].bright, 120, 5)} / ${num(`gen.light.${k}.dim`, g.light[k].dim, 240, 5)} ft</td>
        <td>${cb(`gen.intelligence.${k}.on`, g.intelligence[k].on)} ${num(`gen.intelligence.${k}.chance`, g.intelligence[k].chance)}%</td>
        <td>${g.hints[k] ? `${cb(`gen.hints.${k}.on`, g.hints[k].on)} ${num(`gen.hints.${k}.chance`, g.hints[k].chance)}%` : "—"}</td></tr>`).join("");
    const changed = JSON.stringify(g) !== JSON.stringify(GEN_DEFAULTS);
    return `<details class="atg-sec atg-gen" data-sec="gen" ${recall("sec.gen", "0") === "1" ? "open" : ""}><summary>Generation settings <small>(${changed ? "changed for this world" : "SRD and Axecleft defaults"})</small></summary>
      <p class="hint">Extras that Axecleft's modules (Armory, Curios) add to randomly generated magic items, and poisons among mundane items. Untick a row or set 0% to turn it off. Crafting tools (the Armory's Forge) can always add them by hand. Saved for this world.</p>
      <div class="form-group"><label>Campaign</label>${cb("gen.rules.psionics", g.rules.psionics, "Psionics")}${cb("gen.rules.epic", g.rules.epic, "Epic items")}<span class="hint">Epic share of the extra items at EL 21+:</span> ${num("gen.rules.epicShare", g.rules.epicShare ?? 25)}<span class="hint">%</span></div>
      <p class="hint">For every Axecleft module. <strong>Psionics</strong> off hides psionic items, powers, power stones, psionic tattoos, dorjes and psicrowns from treasure, merchants, crafting and the Forge. <strong>Epic items</strong> on lets the Forge and crafting make epic items (past the SRD +5/+10 limits) and lets merchants with the <em>Epic campaign</em> settlement character stock them; random treasure stays SRD up to EL 20. EL 21–30 (DMG): the EL 20 row plus 1, 2, 4, 6, 9, 12, 17, 23, 31 or 42 extra major items; while Epic items is on, this share of them are epic items from the SRD epic tables (house rule).</p>
      <div class="atg-checks">${cb("gen.light.enabled", g.light.enabled, "Random light")}${cb("gen.intelligence.enabled", g.intelligence.enabled, "Random intelligence")}${cb("gen.hints.enabled", g.hints.enabled, "Inscription hints")}</div>
      <table class="atg-gen-table"><thead><tr><th></th><th>Sheds light</th><th>Bright / dim</th><th>Intelligent</th><th>Hint</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="hint">SRD: 30% of magic melee weapons shed light (a <em>light</em> spell: 20 ft bright, 40 ft dim); ranged weapons don't; 15% of weapons carry an inscription hinting at their power; fewer than 1% of permanent items are intelligent (never potions, scrolls, wands or ammunition). Light on armor, shields and other items is a house rule.</p>
      <div class="atg-checks">${cb("gen.intelligence.purpose.on", g.intelligence.purpose.on, "Intelligent items can have a special purpose:")}${cb("gen.intelligence.purpose.greater", g.intelligence.purpose.greater, "always with greater powers")} <span>plus</span> ${num("gen.intelligence.purpose.chance", g.intelligence.purpose.chance)}<span class="hint">% of the others</span></div>
      <p class="hint">The SRD lists special purposes and dedicated powers but doesn't say how often they occur; this is Axecleft's default (the most capable items, with greater powers, have one).</p>
      <div class="atg-checks">${cb("gen.light.themes", g.light.themes, "Light color and animation follow the item's abilities")}${cb("gen.light.powerBrightness", g.light.powerBrightness, "Stronger items glow brighter")}</div>
      <div class="atg-checks">${cb("gen.light.scaleRadii", g.light.scaleRadii, "Stronger items shine farther:")} ${num("gen.light.scaleFeet", g.light.scaleFeet, 30, 5)} <span class="hint">ft per +1 above +2</span></div>
      <div class="form-group"><label>Sizes of arms</label>${cb("gen.size.enabled", g.size.enabled)} ${num("gen.size.small", g.size.small)}<span class="hint">% Small</span> ${num("gen.size.medium", g.size.medium)}<span class="hint">% Medium</span> ${num("gen.size.large", g.size.large)}<span class="hint">% Large</span></div>
      <p class="hint">SRD: random armor and weapons are Small 30%, Medium 60% and another size 10% (Large here). Small arms cost the same and weigh half; Large cost twice as much and weigh twice as much. Untick for all Medium.</p>
      <div class="form-group"><label>Poisons</label>${cb("gen.poison.enabled", g.poison.enabled)} ${num("gen.poison.chance", g.poison.chance, 100, 0.5)}<span class="hint" style="flex:1">% of mundane item rolls become a poison from your item sources (house rule; raise it where poison is common)</span></div>
      <div class="atg-footer"><button type="button" data-gen-reset><i class="fas fa-rotate-left"></i> Reset to Defaults</button></div>
    </details>`;
  }
  /** Read the Generation settings fieldset back into a settings object (only the fields it shows). */
  function readGenerationForm(section) {
    const g = generation();
    for (const el of section.querySelectorAll("[name^='gen.']")) {
      const path = el.name.slice(4);
      const v = el.type === "checkbox" ? el.checked : Math.max(0, Number(el.value) || 0);
      foundry.utils.setProperty(g, path, v);
    }
    return g;
  }


  /* ------------------------------------------ */
  /*  Searchable lists (version 9.6)            */
  /* ------------------------------------------ */

  /*
   * Text boxes with suggestions (<input list> + <datalist>) use the browser's own popup, which in Foundry
   * doesn't scroll and runs off the bottom of the screen with long lists. enhanceDatalists(root) swaps each one
   * for Axecleft's own list: it scrolls, flips above the box when there's no room below, filters as you type,
   * shows everything on a double-click or the arrow key, and works with the keyboard (↑ ↓ Enter Esc).
   * The <datalist> stays in the page as the source of options, so code that refills it keeps working.
   */
  const COMBO_CSS = `.axecleft-combo { position: fixed; z-index: 100000; overflow-y: auto; min-width: 160px; background: var(--color-bg-option, #1f2029); color: var(--color-text-primary, #e8e6e3);
      border: 1px solid var(--color-border-highlight, #ff6400); border-radius: 4px; box-shadow: 0 4px 14px rgba(0,0,0,0.55); font-size: var(--font-size-13, 13px); padding: 2px 0; }
    .axecleft-combo div { padding: 3px 8px; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .axecleft-combo div.active, .axecleft-combo div:hover { background: var(--color-warm-2, #a33b24); color: #fff; }
    .axecleft-combo div.none { opacity: 0.7; cursor: default; font-style: italic; } .axecleft-combo div.none:hover { background: none; color: inherit; }
    .axecleft-combo mark { background: none; color: inherit; font-weight: bold; text-decoration: underline; }`;
  let comboEl = null, comboFor = null, comboActive = -1;
  function comboBox() {
    if (comboEl?.isConnected) return comboEl;
    if (!document.getElementById("axecleft-combo-css")) {
      const st = document.createElement("style"); st.id = "axecleft-combo-css"; st.textContent = COMBO_CSS; document.head.append(st);
    }
    comboEl = document.createElement("div");
    comboEl.className = "axecleft-combo";
    comboEl.style.display = "none";
    comboEl.addEventListener("mousedown", (ev) => ev.preventDefault()); // keep focus in the text box
    document.body.append(comboEl);
    // Close when anything else scrolls (the box would drift away from its text box) or the window resizes
    document.addEventListener("scroll", (ev) => { if (comboFor && ev.target !== comboEl && !comboEl.contains(ev.target)) comboClose(); }, true);
    window.addEventListener("resize", () => comboClose());
    return comboEl;
  }
  function comboClose() { if (comboEl) comboEl.style.display = "none"; comboFor = null; comboActive = -1; }
  function comboItems() { return comboEl ? [...comboEl.querySelectorAll("div[data-v]")] : []; }
  function comboMark(i) {
    const items = comboItems();
    items.forEach((x, n) => x.classList.toggle("active", n === i));
    comboActive = i;
    items[i]?.scrollIntoView({ block: "nearest" });
  }
  function comboPick(input, value) {
    input.value = value;
    comboClose();
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function comboOpen(input, filter) {
    const box = comboBox();
    const all = input._axcOptions?.() ?? [];
    const q = filter ? String(input.value ?? "").trim().toLowerCase() : "";
    const hits = q ? all.filter((v) => v.toLowerCase().includes(q)) : all;
    const LIMIT = 400;
    const shown = hits.slice(0, LIMIT);
    const hi = (v) => {
      if (!q) return esc(v);
      const i = v.toLowerCase().indexOf(q);
      return `${esc(v.slice(0, i))}<mark>${esc(v.slice(i, i + q.length))}</mark>${esc(v.slice(i + q.length))}`;
    };
    box.innerHTML = shown.map((v) => `<div data-v="${esc(v)}" title="${esc(v)}">${hi(v)}</div>`).join("")
      + (hits.length > LIMIT ? `<div class="none">${hits.length - LIMIT} more — type to narrow the list</div>` : "")
      + (!hits.length ? `<div class="none">${all.length ? "No match" : "Nothing to choose from"}</div>` : "");
    box.querySelectorAll("div[data-v]").forEach((el) => el.addEventListener("click", () => comboPick(input, el.dataset.v)));
    // Below the text box, or above it when there's more room there; never past the screen's edge
    const r = input.getBoundingClientRect(), gap = 6, MAX = 320;
    const below = window.innerHeight - r.bottom - gap, above = r.top - gap;
    const down = below >= Math.min(MAX, 180) || below >= above;
    box.style.display = "block";
    box.style.left = `${Math.max(4, Math.min(r.left, window.innerWidth - Math.max(r.width, 160) - 4))}px`;
    box.style.width = `${Math.max(r.width, 160)}px`;
    box.style.maxHeight = `${Math.max(80, Math.min(MAX, down ? below : above))}px`;
    if (down) { box.style.top = `${r.bottom + 2}px`; box.style.bottom = ""; }
    else { box.style.top = ""; box.style.bottom = `${window.innerHeight - r.top + 2}px`; }
    box.scrollTop = 0;
    comboFor = input;
    comboActive = -1;
    const exact = shown.findIndex((v) => v === input.value);
    if (exact >= 0) comboMark(exact);
  }
  /** Turn every <input list="…"> inside root into a scrolling searchable list. */
  function enhanceDatalists(root) {
    if (!root?.querySelectorAll) return;
    for (const input of root.querySelectorAll("input[list]")) {
      if (input._axcOptions) continue;
      const id = input.getAttribute("list");
      const find = () => root.querySelector?.(`datalist#${CSS.escape(id)}`) ?? document.getElementById(id);
      input._axcOptions = () => [...(find()?.options ?? [])].map((o) => o.value).filter(Boolean);
      input.dataset.list = id;
      input.removeAttribute("list");
      input.setAttribute("autocomplete", "off");
      input.addEventListener("dblclick", () => comboOpen(input, false));
      input.addEventListener("click", () => { if (comboFor !== input && !input.value) comboOpen(input, false); });
      input.addEventListener("input", (ev) => { if (ev.isTrusted) comboOpen(input, true); }); // typing filters; our own picks don't reopen it
      input.addEventListener("blur", () => setTimeout(() => { if (comboFor === input) comboClose(); }, 120));
      input.addEventListener("keydown", (ev) => {
        const open = comboFor === input && comboEl?.style.display !== "none";
        if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
          ev.preventDefault();
          if (!open) { comboOpen(input, false); return; }
          const n = comboItems().length;
          if (n) comboMark(ev.key === "ArrowDown" ? (comboActive + 1) % n : (comboActive - 1 + n) % n);
        } else if (ev.key === "Enter" && open && comboActive >= 0) {
          ev.preventDefault();
          comboPick(input, comboItems()[comboActive].dataset.v);
        } else if (ev.key === "Escape" && open) { ev.preventDefault(); ev.stopPropagation(); comboClose(); }
        else if (ev.key === "Tab") comboClose();
      });
    }
  }

  /* ------------------------------------------ */
  /*  Registration                              */
  /* ------------------------------------------ */

  function registerTab(def) {
    if (!def?.module || !def?.name || typeof def.content !== "function") return console.error("AxecleftTreasure | registerTab() needs module, name and content", def);
    registry.tabs.set(`${def.module}.${def.name}`, { icon: "fas fa-box", order: 100, ...def, id: `t-${def.module}-${def.name}`.replace(/[^\w-]/g, "-") });
    api.refresh();
  }
  function registerButton(def) {
    if (!def?.module || !def?.name || typeof def.onClick !== "function") return console.error("AxecleftTreasure | registerButton() needs module, name and onClick", def);
    registry.buttons.set(`${def.module}.${def.name}`, { icon: "fas fa-wrench", ...def });
    api.refresh();
  }
  /** A provider makes items for Treasure-table categories. Later registrations win over built-in ones. */
  function registerProvider(def) {
    if (!def?.module || !def?.name || !Array.isArray(def.categories) || typeof def.roll !== "function") return console.error("AxecleftTreasure | registerProvider() needs module, name, categories and roll", def);
    registry.providers.set(`${def.module}.${def.name}`, { label: def.name, ...def });
    api.refresh();
  }
  /** Providers that can supply a category right now. */
  /** hints: a specialty limit such as ["Book"]; only providers that declare hints: true can honor it. */
  const providersFor = (category, hints = null) => [...registry.providers.values()]
    .filter((p) => p.categories.includes(category) && isActive(p) && (!hints?.length || p.hints)
      && (typeof p.available !== "function" || p.available(category, hints)));
  /** The provider the Treasure table uses: a module's first, then the SRD lists, then item compendiums. */
  function providerFor(category, hints = null) {
    const list = providersFor(category, hints);
    return list.find((p) => !p.builtin) ?? list.find((p) => p.builtin && !p.compendium) ?? list[0] ?? null;
  }

  /* ------------------------------------------ */
  /*  Built-in provider: D35E alchemical items  */
  /*  and tools & gear                          */
  /* ------------------------------------------ */

  const normName = (s) => String(s).toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9']+/g, " ").trim();
  let d35eIndex = null;
  async function d35eItem(name) {
    const pack = game.packs.get("D35E.items");
    if (!pack) return null;
    d35eIndex ??= [...await pack.getIndex()];
    const n = normName(name);
    const sing = (t) => t.split(" ").map((w) => w.replace(/(?<=\w\w)s$/, "")).join(" ");
    const e = d35eIndex.find((x) => normName(x.name) === n)
      ?? d35eIndex.find((x) => sing(normName(x.name)) === sing(n))
      ?? d35eIndex.find((x) => normName(x.name).replace(/\s*\(.*\)$/, "") === n.replace(/\s*\(.*\)$/, ""))
      ?? d35eIndex.find((x) => normName(x.name).startsWith(n.split(",")[0]));
    if (!e) return null;
    const doc = await pack.getDocument(e._id);
    const data = doc.toObject();
    delete data._id; delete data.folder; delete data.sort;
    return data;
  }
  registerProviderBuiltin();
  function registerProviderBuiltin() {
    registry.providers.set("axecleft-treasure.mundane", {
      module: null, name: "mundane", label: "D35E items", builtin: true, categories: ["mundane:alchemical", "mundane:gear"],
      async roll({ category }) {
        const rows = MUNDANE_ITEMS[category === "mundane:alchemical" ? "alchemical" : "gear"];
        const [, , name, qty, value] = inRange(rows, d100());
        const quantity = Math.max(1, Math.round(rollDice(qty)));
        const data = await d35eItem(name);
        const label = quantity > 1 ? `${name} (${quantity})` : name;
        if (!data) return [{ name: label, placeholder: true, summary: `${CATEGORIES[category].label}, ${gp(value)} each; not found in the D35E items compendium` }];
        foundry.utils.setProperty(data, "system.quantity", quantity);
        applyPriceCorrection("D35E.items", data);
        if (!(Number(data.system?.price) > 0) && value > 0) foundry.utils.setProperty(data, "system.price", value); // SRD price when the compendium has none
        return [{ name: label, data, summary: `${CATEGORIES[category].label}, ${gp(value)} each` }];
      },
    });
  }

  /* ------------------------------------------ */
  /*  Built-in provider: item compendiums       */
  /*  (D35E's own and any world or module       */
  /*  compendium with a matching name)          */
  /* ------------------------------------------ */

  const SOURCES_KEY = "axecleftItemSources";
  const SYSTEM_PACKS = ["D35E.items", "D35E.weapons-and-ammo", "D35E.armors-and-shields", "D35E.magicitems"];
  const MATCH = /^(items|magic items)$|\b(gear|equipment|goods|supplies|weapons?|ammo|ammunition|arms|armou?rs?|shields?|magic items?|wondrous)\b/i;
  const NOT_MATCH = /spell|buff|aura|feat|class|race|racial|abilit|power|attack|condition|enhancement|material|damage|template|natural|poison|disease|trap|gem|art object|treasure lists/i;
  const POISON_PACK = /\bpoison consumables?\b/i; // Axecleft's Traps, Poisons, and Diseases: auto-included despite "poison" in NOT_MATCH
  // SRD diseases, and the generator's disease consumables ("Vial" before identification), are not poisons
  const DISEASE = /\b(blinding sickness|cackle fever|demon fever|devil chills|filth fever|mindfire|mummy rot|red ache|the shakes|shakes|slimy doom|disease|plague|fever|pox|rot)\b/i;
  const ALCHEMICAL = /\b(acid|alchemist.?s fire|antitoxin|smokestick|sunrod|tanglefoot|thunderstone|tindertwig|holy water|unholy water|everburning|alchemical)\b/i;
  const SKIP = /\b(horse|warhorse|pony|warpony|dog|donkey|mule|stabling|feed|lodging|meal|(?<!of )passage|spellcasting service|hireling)\b/i;
  const MINOR_MAX = 4000, MEDIUM_MAX = 25000; // magic item grade by price (gp)
  const INDEX_FIELDS = ["type", "system.subType", "system.equipmentType", "system.equipmentSubtype", "system.weaponSubtype", "system.masterwork",
    "system.enh", "system.armor.enh", "system.price", "system.consumableType", "system.slot", "system.epic", "system.psionic", "system.isPower", "system.tags", "system.unidentified.name", "folder"];

  let compPools = {};      // category -> [{ pack, id, name, price, ranged, label }]
  let compStats = {};      // pack id -> { label, total, byCategory }
  let compScanning = null;

  /** Item compendiums the generator can read, with whether automatic matching picks them. */
  function listItemPacks() {
    return [...game.packs].filter((p) => p.documentName === "Item").map((p) => {
      const id = p.collection, label = p.metadata?.label ?? p.title ?? id;
      const pkg = p.metadata?.packageType === "system" || id.startsWith(`${game.system?.id}.`) ? "System" : p.metadata?.packageType === "world" || id.startsWith("world.") ? "World" : (game.modules.get(p.metadata?.packageName)?.title ?? p.metadata?.packageName ?? "Module");
      const auto = SYSTEM_PACKS.includes(id) || POISON_PACK.test(label) || (!id.startsWith(`${game.system?.id}.`) && MATCH.test(label) && !NOT_MATCH.test(label));
      return { id, label, source: pkg, auto };
    }).sort((a, b) => (a.source === "System" ? 0 : a.source === "World" ? 1 : 2) - (b.source === "System" ? 0 : b.source === "World" ? 1 : 2) || a.label.localeCompare(b.label));
  }
  function itemSources() {
    let saved = null;
    try { saved = game.settings.get(coinNamespace ?? "world", SOURCES_KEY); } catch (e) { /* not registered */ }
    const all = listItemPacks();
    const custom = saved?.mode === "custom";
    return { mode: custom ? "custom" : "auto", packs: custom ? (saved.packs ?? []).filter((id) => all.some((p) => p.id === id)) : all.filter((p) => p.auto).map((p) => p.id) };
  }
  async function setItemSources(cfg) {
    let kinds = {};
    try { kinds = game.settings.get(coinNamespace ?? "world", SOURCES_KEY)?.kinds ?? {}; } catch (e) { /* not registered */ }
    await game.settings.set(coinNamespace ?? "world", SOURCES_KEY, { mode: cfg.mode === "custom" ? "custom" : "auto", packs: cfg.packs ?? [], kinds });
    await scanCompendiums();
  }

  /** Which Treasure category an item belongs in, from its own data (null: not shop or treasure stock). */
  function classifyItem(e, magicPack, { allowEpic = false } = {}) {
    const s = e.system ?? {}, name = String(e.name ?? "");
    if (SKIP.test(name) || (!allowEpic && isEpicItem(e))) return null;
    const price = Number(s.price) || 0;
    if (price <= 0) return null; // no price set: can't be sold or valued
    const mw = s.masterwork === true || /masterwork/i.test(name);
    // In a magic item compendium an unenhanced weapon or armor is magic, unless it's a special material piece.
    const special = /masterwork|mithral|mithril|adamantine|darkwood|cold iron|alchemical silver|silvered|silver dagger|dragonhide/i.test(name);
    const enh = Number(s.enh) || 0, armorEnh = Number(s.armor?.enh) || 0;
    // No SRD magic weapon or armor costs under 1,000 gp: a lower price means the price is missing.
    const magicPriceOk = price >= 1000;
    if (e.type === "weapon") {
      if (enh > 0) return magicPriceOk ? "magic:weapon" : null;
      if (magicPack ? special : mw) return "mundane:weapon";
      return magicPack ? (magicPriceOk ? "magic:weapon" : null) : "standard:weapon";
    }
    if (e.type === "equipment") {
      const et = s.equipmentType;
      if (et === "armor" || et === "shield") {
        if (armorEnh > 0) return magicPriceOk ? "magic:armor" : null;
        if (magicPack ? special : mw) return "mundane:armor";
        return magicPack ? (magicPriceOk ? "magic:armor" : null) : et === "armor" ? "standard:armor" : "standard:shield";
      }
      if (s.equipmentSubtype === "wondrous" || magicPack) {
        if (s.slot === "ring" || /^ring\b/i.test(name)) return "magic:ring";
        if (/^rod\b|\brod of\b/i.test(name)) return "magic:rod";
        if (/^staff\b|\bstaff of\b/i.test(name)) return "magic:staff";
        return "magic:wondrous";
      }
      return ALCHEMICAL.test(name) ? "mundane:alchemical" : "mundane:gear";
    }
    if (e.type === "consumable") {
      const ct = s.consumableType;
      // Poisons (D35E consumables of type "poison", as made by Axecleft's Traps, Poisons, and Diseases).
      // Its disease consumables share the type; they are left out (tag one "Shop: Poison" to sell it anyway).
      if (ct === "poison") return isDisease(e) ? null : "mundane:poison";
      if (ct === "potion" || ct === "tattoo") return "magic:potion";      // psionic tattoos are the potion equivalent
      if (ct === "scroll" || ct === "powerstone") return "magic:scroll";  // power stones are psionic scrolls
      if (ct === "wand" || ct === "dorje") return "magic:wand";           // dorjes are psionic wands
      if (ct === "staff") return "magic:staff";
      return ALCHEMICAL.test(name) ? "mundane:alchemical" : magicPack ? "magic:wondrous" : "mundane:gear";
    }
    if (e.type === "loot") {
      const st = s.subType;
      if (st === "tradeGoods") return null; // gems and art: Axecleft's Gemstones
      if (st === "ammo") return magicPack || enh > 0 ? "magic:weapon" : "standard:ammo";
      if (magicPack) return "magic:wondrous";
      return ALCHEMICAL.test(name) && !/\blab\b/i.test(name) ? "mundane:alchemical" : "mundane:gear";
    }
    return null;
  }

  /* ---- Epic and psionic items (version 9.5) ----
   * Marked by name lists that modules register (Curios ships the SRD lists), D35E's own epic/psionic
   * fields when a compendium fills them, and names that say so. The campaign switches (rules()) then
   * keep them out of treasure, merchants and the Forge. */
  const PSIONIC_NAME = /\b(psionic|psicrowns?|dorjes?|power stones?|cognizance crystals?|psionatrix|psychoactive)\b/i;
  const truthy = (v) => v === true || (typeof v === "string" && /^(true|yes|1|epic|psionic)$/i.test(v.trim()));
  function registerItemMarks(def) {
    if (!def?.module) return console.error("AxecleftTreasure | registerItemMarks() needs module", def);
    registry.marks.set(def.module, { epic: new Set((def.epic ?? []).map(normName)), psionic: new Set((def.psionic ?? []).map(normName)) });
  }
  const marked = (kind, name) => [...registry.marks.entries()].some(([m, sets]) => (game.modules?.get(m)?.active ?? true) && sets[kind]?.has(normName(name)));
  function isEpicItem(e) { return truthy(e?.system?.epic) || /\bepic\b/i.test(e?.name ?? "") || marked("epic", e?.name); }
  function isPsionicItem(e) {
    const s = e?.system ?? {};
    return truthy(s.psionic) || s.isPower === true || ["dorje", "tattoo", "powerstone"].includes(s.consumableType) || PSIONIC_NAME.test(e?.name ?? "") || marked("psionic", e?.name);
  }
  /** Drop pool entries the campaign switches rule out. ctx.epic: this roll may include epic items (Forge, Epic campaign merchants). */
  function allowedByRules(list, ctx = {}) {
    const r = rules();
    return list.filter((x) => (r.psionics || !x.psionic) && (!x.epic || (r.epic && ctx.epic)));
  }

  /** A disease consumable: unidentified as "Vial" (the Poison and Disease generator) or named like an SRD disease. */
  function isDisease(e) {
    const s = e.system ?? {};
    return /^vial$/i.test(String(s.unidentified?.name ?? "").trim()) || DISEASE.test(String(e.name ?? ""));
  }

  /* ---- Shop tags: D35E item tags such as "Shop: Scroll" or "Shop: Book" ----
   * A category tag adds the item to that category as well as the one its data gives it
   * (a magic tome stays a wondrous item and also counts as a scroll). A specialty tag
   * (Book, Clothing, Jewelry) lets specialty shops pick the right wondrous items. */
  const TAG_PREFIX = "Shop:";
  const TAG_LABELS = {
    gem: "Gem", art: "Art object", "mundane:gear": "Tools and gear", "mundane:alchemical": "Alchemical item", "mundane:poison": "Poison",
    "standard:weapon": "Weapon", "standard:armor": "Armor", "standard:shield": "Shield", "standard:ammo": "Ammunition",
    "mundane:weapon": "Masterwork weapon", "mundane:armor": "Masterwork armor", "magic:weapon": "Magic weapon", "magic:armor": "Magic armor",
    "magic:potion": "Potion", "magic:scroll": "Scroll", "magic:wand": "Wand", "magic:ring": "Ring", "magic:rod": "Rod", "magic:staff": "Staff", "magic:wondrous": "Wondrous item",
  };
  const HINTS = ["Book", "Clothing", "Jewelry"];
  const tagText = (x) => `${TAG_PREFIX} ${TAG_LABELS[x] ?? x}`;
  /** Read Shop tags from an item's system.tags ([[tag], ...]). */
  function readShopTags(tags) {
    const cats = new Set(), hints = new Set();
    for (const t of Array.isArray(tags) ? tags : []) {
      const txt = String(Array.isArray(t) ? t[0] : t ?? "").trim();
      if (!txt.toLowerCase().startsWith(TAG_PREFIX.toLowerCase())) continue;
      const v = txt.slice(TAG_PREFIX.length).trim().toLowerCase();
      const cat = Object.keys(TAG_LABELS).find((k) => k === v || TAG_LABELS[k].toLowerCase() === v || TAG_LABELS[k].toLowerCase() + "s" === v);
      if (cat) cats.add(cat);
      const hint = HINTS.find((h) => h.toLowerCase() === v || h.toLowerCase() + "s" === v);
      if (hint) hints.add(hint);
    }
    return { cats: [...cats], hints: [...hints] };
  }
  /** system.tags with the item's Shop tags replaced. */
  function writeShopTags(tags, cats = [], hints = []) {
    const keep = (Array.isArray(tags) ? tags : []).filter((t) => !String(Array.isArray(t) ? t[0] : t ?? "").trim().toLowerCase().startsWith(TAG_PREFIX.toLowerCase()));
    return [...keep, ...cats.map((c) => [tagText(c)]), ...hints.map((h) => [`${TAG_PREFIX} ${h}`])];
  }
  const SUGGEST = [
    [/\b(books?|tomes?|librams?|manuals?|codex|codices|grimoires?|folios?|analects?|lexicons?|treatises?|journals?|bestiar(?:y|ies)|primers?|almanacs?)\b/i, ["magic:scroll"], ["Book"]],
    [/\bscrolls?\b/i, ["magic:scroll"], []],
    [/\b(potions?|elixirs?|philt(?:er|re)s?|draughts?|oils?|salves?|unguents?|brews?|tinctures?|ointments?)\b/i, ["magic:potion"], []],
    [/\brings?\b/i, ["magic:ring"], ["Jewelry"]],
    [/\b(staff|staves)\b/i, ["magic:staff"], []],
    [/\bwands?\b/i, ["magic:wand"], []],
    [/\brods?\b/i, ["magic:rod"], []],
    [/\b(cloth(?:ing|es)?|robes?|cloaks?|boots|gloves|hats?|vestments?|belts?|bracers|capes?|mantles?|shirts?|slippers|gauntlets|tunics?|hoods?|masks?|sashes|sash|girdles?|garments?|scarf|scarves|shoes|sandals|veils?|turbans?|coats?)\b/i, [], ["Clothing"]],
    [/\b(gems?|jewel(?:ry|lery|s)?|amulets?|necklaces?|brooch(?:es)?|crowns?|periapts?|pendants?|medallions?|torcs?|bracelets?|earrings?|scarabs?|ioun|circlets?|tiaras?|diadems?|phylacter(?:y|ies)|talismans?|lockets?|charms?)\b/i, [], ["Jewelry"]],
  ];
  /** Suggested Shop tags for an item from its name, its compendium folder names and its data category. */
  function suggestShopTags(name, folderPath, primary) {
    const cats = new Set(), hints = new Set();
    for (const [re, c, h] of SUGGEST) {
      for (const text of [name, folderPath]) if (text && re.test(text)) { c.forEach((x) => cats.add(x)); h.forEach((x) => hints.add(x)); }
    }
    // "Ring" in a folder of rings is a category; for a ring's name only if it really is one ("Ring of ...", "... Ring")
    if (primary) cats.delete(primary);
    // Specialty hints only steer wondrous items and rings: none on weapons, armor or shields
    if (/weapon$|armor$|shield$|ammo$/.test(primary ?? "")) hints.clear();
    if (!primary?.startsWith("magic:")) for (const c of [...cats]) if (c.startsWith("magic:") && !/magic|wondrous|enchant/i.test(folderPath ?? "")) cats.delete(c);
    return { cats: [...cats], hints: [...hints] };
  }
  const folderPathOf = (pack, folderId) => {
    const names = [];
    let f = folderId && pack.folders?.get?.(folderId);
    while (f) { names.unshift(f.name); f = f.folder ? pack.folders.get(f.folder.id ?? f.folder) : null; }
    return names.join(" / ");
  };

  /** Shop-tag suggestions for every item in a compendium (for the Tag Items tool). */
  async function tagSuggestions(packId) {
    const pack = game.packs.get(packId);
    if (!pack) throw new Error(`Compendium ${packId} not found.`);
    const label = pack.metadata?.label ?? packId;
    const magicPack = /magic|wondrous|enchant/i.test(label) || packId === "D35E.magicitems";
    const index = await pack.getIndex({ fields: INDEX_FIELDS });
    const rows = [];
    for (const e of index) {
      if (e.type === "Folder") continue;
      const primary = classifyItem(e, magicPack);
      const folder = folderPathOf(pack, e.folder);
      const current = readShopTags(e.system?.tags);
      // Epic items stay out of shops: no suggestions (a hand-written tag still counts)
      const epic = e.system?.epic === true || /\bepic\b/i.test(e.name ?? "");
      const suggested = epic ? { cats: [], hints: [] } : suggestShopTags(e.name, `${folder} ${magicPack ? "magic" : ""}`.trim(), primary);
      rows.push({ id: e._id, name: e.name, folder, primary, current, suggested });
    }
    return rows.sort((a, b) => a.folder.localeCompare(b.folder) || a.name.localeCompare(b.name));
  }

  /** Write Shop tags. rows: [{ id, cats, hints }]. Unlocks a locked compendium for the update and locks it again. */
  async function applyShopTags(packId, rows) {
    const pack = game.packs.get(packId);
    if (!pack) throw new Error(`Compendium ${packId} not found.`);
    const wasLocked = !!pack.locked;
    if (wasLocked) await pack.configure({ locked: false });
    let n = 0;
    try {
      const index = await pack.getIndex({ fields: ["system.tags"] });
      const byId = new Map([...index].map((e) => [e._id, e]));
      const updates = rows.map((r) => ({ _id: r.id, "system.tags": writeShopTags(byId.get(r.id)?.system?.tags, r.cats, r.hints) }));
      for (let i = 0; i < updates.length; i += 100) {
        await CONFIG.Item.documentClass.updateDocuments(updates.slice(i, i + 100), { pack: packId });
        n += Math.min(100, updates.length - i);
      }
    } finally { if (wasLocked) await pack.configure({ locked: true }); }
    await scanCompendiums();
    return n;
  }

  /* ------------------------------------------ */
  /*  Price corrections (version 9)             */
  /* ------------------------------------------ */

  /*
   * Some compendium items carry wrong prices (D35E 3.1.0's specific magic arms, for example), and
   * legacy system versions will never be fixed. A correction is matched by compendium id and item
   * name (not item id, so one table serves every system version), and is applied in memory only:
   * to the scan (grading, gp limits, stock) and to the copy made when an item is generated.
   * A correction does nothing once the compendium's price already matches, so upstream fixes win.
   *
   *   T.registerPriceCorrections({ module, corrections: [{ pack: "D35E.magicitems", name, price, note }] })
   *
   * GMs add their own on the "Price Corrections" page of the Treasure Lists journal (Compendium blank =
   * any compendium); theirs win over a module's for the same item.
   */
  const CORR_MOD = "axecleft-treasure";
  function registerPriceCorrections(def) {
    if (!def?.module || !Array.isArray(def.corrections)) return console.error("AxecleftTreasure | registerPriceCorrections() needs module and corrections", def);
    registry.corrections.set(def.module, def.corrections.filter((c) => c?.name && Number(c.price) > 0).map((c) => ({ ...c, price: Number(c.price), module: def.module })));
    corrIndex = null;
  }
  let corrIndex = null;
  const corrKey = (pack, name) => `${pack ?? ""}|${normName(name)}`;
  /** Every correction in force: [{ pack, name, price, note, module, source }] (GM rows first). */
  function priceCorrections() {
    const gm = (() => { try { return customList(CORR_MOD, "prices").filter((r) => r.source === "custom"); } catch (e) { return []; } })()
      .map((r) => ({ pack: String(r.pack ?? "").trim(), name: r.name, price: Number(r.price) || 0, note: r.note ?? "", module: null, source: "gm" }))
      .filter((r) => r.price > 0);
    const mods = [...registry.corrections.entries()].filter(([m]) => game.modules.get(m)?.active ?? true)
      .flatMap(([, list]) => list.map((c) => ({ ...c, source: "module" })));
    let off = new Set();
    try { off = new Set(disabledEntries(CORR_MOD).map((d) => normName(d.name))); } catch (e) { /* lists not ready */ }
    return [...gm, ...mods.filter((c) => !off.has(normName(c.name)))];
  }
  function correctionIndex() {
    if (corrIndex) return corrIndex;
    corrIndex = new Map();
    for (const c of priceCorrections()) {
      const k = corrKey(c.pack, c.name);
      if (!corrIndex.has(k)) corrIndex.set(k, c);
    }
    return corrIndex;
  }
  /** The correction for an item in a compendium (or null): exact compendium first, then "any compendium". */
  function correctionFor(packId, name) {
    const idx = correctionIndex();
    return idx.get(corrKey(packId, name)) ?? idx.get(corrKey("", name)) ?? null;
  }
  /** The price to use for a compendium item: the corrected one when it differs, else the item's own. */
  function correctedPrice(packId, name, price) {
    const c = correctionFor(packId, name);
    return c && Number(c.price) !== Number(price) ? Number(c.price) : Number(price) || 0;
  }
  /** Fix the price on item data copied from a compendium. Returns the correction applied (or null). */
  function applyPriceCorrection(packId, data) {
    const c = correctionFor(packId, data?.name);
    if (!c || Number(data.system?.price) === c.price) return null;
    foundry.utils.setProperty(data, "system.price", c.price);
    return c;
  }
  /**
   * Price Check: every correction, with what the compendium holds now. Rows:
   * { pack, packLabel, name, found, current, corrected, needed, note, source }. needed: the compendium price differs.
   */
  async function priceCheck() {
    const rows = [];
    const byPack = new Map();
    for (const c of priceCorrections()) {
      const packs = c.pack ? [c.pack] : itemSources().packs;
      for (const id of packs) (byPack.get(id) ?? byPack.set(id, []).get(id)).push(c);
    }
    for (const [id, list] of byPack) {
      const pack = game.packs.get(id);
      let index = [];
      try { index = pack ? [...await pack.getIndex({ fields: ["system.price"] })] : []; } catch (e) { /* unreadable */ }
      for (const c of list) {
        const e = index.find((x) => normName(x.name) === normName(c.name));
        if (!e && !c.pack) continue; // an "any compendium" row only reports where the item exists
        const current = e ? Number(e.system?.price) || 0 : null;
        rows.push({ pack: id, packLabel: pack?.metadata?.label ?? id, name: e?.name ?? c.name, found: !!e, current, corrected: c.price,
          needed: !!e && current !== c.price, note: c.note ?? "", source: c.source === "gm" ? "GM" : (game.modules.get(c.module)?.title ?? c.module) });
      }
    }
    return rows.sort((a, b) => a.packLabel.localeCompare(b.packLabel) || a.name.localeCompare(b.name));
  }
  /** Download the Price Check as CSV (to send to a compendium's maintainer). */
  async function exportPriceCheck() {
    const rows = await priceCheck();
    const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [["Compendium", "Compendium id", "Item", "Current price (gp)", "Corrected price (gp)", "Needs fixing", "Note", "From"].map(q).join(","),
      ...rows.map((r) => [r.packLabel, r.pack, r.name, r.found ? r.current : "not found", r.corrected, r.needed ? "yes" : "no", r.note, r.source].map(q).join(","))].join("\n");
    const save = foundry.utils.saveDataToFile ?? globalThis.saveDataToFile;
    save(csv, "text/csv", "axecleft-price-check.csv");
    return rows.length;
  }

  /* ------------------------------------------ */
  /*  Extra source kinds (version 9)            */
  /* ------------------------------------------ */

  /*
   * Besides shop and treasure stock, modules can read other kinds of items from compendiums the GM
   * chooses on the Merchant Generator's Item Sources tab, for example Axecleft's Armory's enhancements
   * and special materials:
   *   T.registerSourceKind({ module, key: "enhancements", label: "Enhancements",
   *     match: /enhancement/i,                        // automatic: compendium labels (or a function(label, id))
   *     accept: (e) => e.type === "enhancement",       // which index entries count
   *     fields: ["system.enhancementType"],            // extra index fields to read
   *     hint: "Special abilities for magic arms" });
   *   await T.kindItems("axeclefts-armory.enhancements")   // [{ pack, id, name, entry }]
   * Choices are saved per world with the item sources.
   */
  function registerSourceKind(def) {
    if (!def?.module || !def?.key || !def?.label) return console.error("AxecleftTreasure | registerSourceKind() needs module, key and label", def);
    registry.sourceKinds.set(`${def.module}.${def.key}`, { ...def, id: `${def.module}.${def.key}` });
    kindCache.delete(`${def.module}.${def.key}`);
    globalThis.AxecleftMerchants?.refresh?.();
  }
  const kindCache = new Map(); // kind id -> Promise of [{ pack, id, name, entry }]
  const sourceKinds = () => [...registry.sourceKinds.values()].filter(isActive);
  const kindMatches = (k, p) => (typeof k.match === "function" ? !!k.match(p.label, p.id) : k.match instanceof RegExp ? k.match.test(p.label) : false);
  function kindSources(kindId) {
    const k = registry.sourceKinds.get(kindId);
    if (!k) return { mode: "auto", packs: [] };
    let saved = null;
    try { saved = game.settings.get(coinNamespace ?? "world", SOURCES_KEY)?.kinds?.[kindId]; } catch (e) { /* not registered */ }
    const all = listItemPacks();
    if (saved?.mode === "custom") return { mode: "custom", packs: (saved.packs ?? []).filter((id) => all.some((p) => p.id === id)) };
    return { mode: "auto", packs: all.filter((p) => kindMatches(k, p)).map((p) => p.id) };
  }
  async function setKindSources(kindId, cfg) {
    const ns = coinNamespace ?? "world";
    const cur = foundry.utils.deepClone(game.settings.get(ns, SOURCES_KEY) ?? {});
    cur.kinds = { ...(cur.kinds ?? {}), [kindId]: { mode: cfg.mode === "custom" ? "custom" : "auto", packs: cfg.packs ?? [] } };
    await game.settings.set(ns, SOURCES_KEY, cur);
    kindCache.delete(kindId);
  }
  /** The items of a source kind from its chosen compendiums: [{ pack, packLabel, id, name, entry }] (index entries). */
  function kindItems(kindId, { force = false } = {}) {
    if (!force && kindCache.has(kindId)) return kindCache.get(kindId);
    const k = registry.sourceKinds.get(kindId);
    const p = (async () => {
      if (!k) return [];
      const out = [];
      for (const id of kindSources(kindId).packs) {
        const pack = game.packs.get(id);
        if (!pack) continue;
        let index;
        try { index = await pack.getIndex({ fields: [...new Set([...INDEX_FIELDS, ...(k.fields ?? [])])] }); } catch (err) { console.warn(`AxecleftTreasure | could not read ${id}`, err); continue; }
        for (const e of index) {
          if (e.type === "Folder") continue;
          try { if (k.accept && !k.accept(e)) continue; } catch (err) { continue; }
          out.push({ pack: id, packLabel: pack.metadata?.label ?? id, id: e._id, name: e.name, entry: e });
        }
      }
      return out;
    })();
    kindCache.set(kindId, p);
    return p;
  }

  /** Read the chosen compendiums' indexes and sort every item into a category. */
  async function scanCompendiums() {
    if (compScanning) return compScanning;
    compScanning = (async () => {
      corrIndex = null; // pick up corrections added since the last scan
      const pools = {}, stats = {};
      for (const id of itemSources().packs) {
        const pack = game.packs.get(id);
        if (!pack) continue;
        const label = pack.metadata?.label ?? id;
        const magicPack = /magic|wondrous|enchant/i.test(label) || id === "D35E.magicitems";
        let index;
        try { index = await pack.getIndex({ fields: INDEX_FIELDS }); } catch (err) { console.warn(`AxecleftTreasure | could not read ${id}`, err); continue; }
        const st = stats[id] = { label, total: 0, byCategory: {} };
        for (const e0 of index) {
          if (e0.type === "Folder") continue;
          // Price corrections apply before sorting: a 0 gp item with a correction becomes stock, a mispriced one is graded right
          const price = correctedPrice(id, e0.name, e0.system?.price);
          const corrected = price !== (Number(e0.system?.price) || 0);
          const e = corrected ? { ...e0, system: { ...(e0.system ?? {}), price } } : e0;
          const cat = classifyItem(e, magicPack, { allowEpic: true });
          const tags = readShopTags(e.system?.tags);
          if (!cat && !(tags.cats.length && price > 0)) continue;
          if (corrected) st.corrected = (st.corrected ?? 0) + 1;
          const entry = { pack: id, id: e._id, name: e.name, price, ranged: e.system?.weaponSubtype === "ranged" || e.system?.subType === "ammo", label, hints: tags.hints, epic: isEpicItem(e), psionic: isPsionicItem(e) };
          for (const c of new Set([cat, ...tags.cats].filter(Boolean))) {
            (pools[c] ??= []).push(entry);
            st.byCategory[c] = (st.byCategory[c] ?? 0) + 1;
          }
          st.total++;
          if (tags.cats.length || tags.hints.length) st.tagged = (st.tagged ?? 0) + 1;
        }
      }
      compPools = pools; compStats = stats;
      kindCache.clear();
      api.refresh?.();
      globalThis.AxecleftMerchants?.refresh?.();
      return stats;
    })();
    try { return await compScanning; } finally { compScanning = null; }
  }

  const gradeOf = (price) => (price <= MINOR_MAX ? "minor" : price <= MEDIUM_MAX ? "medium" : "major");
  registry.providers.set("axecleft-treasure.compendiums", {
    module: null, name: "compendiums", label: "Item compendiums", builtin: true, compendium: true, hints: true,
    categories: Object.keys(CATEGORIES).filter((c) => c !== "gem" && c !== "art"),
    available: (category, hints) => allowedByRules(compPools[category] ?? []).some((x) => !hints?.length || x.hints?.some((h) => hints.includes(h))),
    async roll({ category, grade, tags = [], merchant, hints = {}, epic = false }) {
      let pool = allowedByRules(compPools[category] ?? [], { epic });
      // A specialty shop's limit for this category (e.g. a bookseller's wondrous items: only those tagged Book)
      const want = hints?.[category];
      if (want?.length) pool = pool.filter((x) => x.hints?.some((h) => want.includes(h)));
      if (tags.includes("ranged") && /weapon$/.test(category)) pool = pool.filter((x) => x.ranged); // a bowyer sells no swords
      if (tags.includes("psionic")) pool = pool.filter((x) => x.psionic); // a psionic shop sells only psionic items (version 9.5)
      if (grade && category.startsWith("magic:")) { const g = pool.filter((x) => gradeOf(x.price) === grade); if (g.length) pool = g; }
      if (!pool.length) return [placeholder(category, grade)];
      const pick = pool[Math.floor(Math.random() * pool.length)];
      const doc = await game.packs.get(pick.pack)?.getDocument(pick.id);
      if (!doc) return [placeholder(category, grade)];
      const data = doc.toObject();
      delete data._id; delete data.folder; delete data.sort;
      const fix = applyPriceCorrection(pick.pack, data);
      let qty = Number(data.system?.quantity) || 1;
      if (category === "standard:ammo" && merchant) qty = /\(\d+\)/.test(pick.name) ? Math.max(1, Math.round(rollDice("1d4"))) : Math.round(rollDice("2d4*10"));
      foundry.utils.setProperty(data, "system.quantity", qty);
      const each = qty > 1 ? " each" : "";
      return [{ name: qty > 1 ? `${data.name} (${qty})` : data.name, data, summary: `${CATEGORIES[category].label}, ${gp(pick.price)}${each}; from ${pick.label}${fix ? " (price corrected)" : ""}` }];
    },
  });

  /* ------------------------------------------ */
  /*  Rolling the Treasure table                */
  /* ------------------------------------------ */

  const placeholder = (category, grade) => {
    const c = CATEGORIES[category] ?? { label: category, module: "another module" };
    const g = grade ? `${grade[0].toUpperCase()}${grade.slice(1)} ` : "";
    const name = c.magic ? `${g}magic ${c.label}` : c.graded ? `${g}${c.label}` : c.label;
    return { name, placeholder: true, summary: `needs ${c.module}` };
  };

  /** ctx.mix: pick at random among every source for the category (merchants), instead of the preferred one. */
  async function fromCategory(category, ctx) {
    const hints = ctx.hints?.[category] ?? null;
    const all = ctx.mix ? providersFor(category, hints) : [];
    const p = all.length ? all[Math.floor(Math.random() * all.length)] : providerFor(category, hints);
    if (!p) return [placeholder(category, ctx.grade)];
    try {
      const out = await p.roll({ ...ctx, category });
      return (out ?? []).map((e) => ({ provider: `${p.module}.${p.name}`, ...e }));
    } catch (err) {
      console.error(`AxecleftTreasure | ${p.module}.${p.name} failed for ${category}`, err);
      return [{ ...placeholder(category, ctx.grade), summary: `${p.label} failed: ${err.message}` }];
    }
  }

  /**
   * Roll one treasure for an encounter level. Returns { entries, notes }.
   * parts: { coins, goods, items } (all true by default). ctx: { actor, form } passed to providers.
   */
  /** DMG: treasure for EL 21–30 is the EL 20 row plus this many extra major magic items. */
  const EXTRA_MAJOR = [1, 2, 4, 6, 9, 12, 17, 23, 31, 42];
  const EPIC_CATS = ["magic:armor", "magic:weapon", "magic:ring", "magic:rod", "magic:scroll", "magic:staff", "magic:wondrous"]; // 9.91: epic scrolls (Curios)
  async function rollTreasure(level, parts = {}, ctx = {}) {
    const lv = Math.min(30, Math.max(1, Math.floor(Number(level) || 1)));
    const row = LEVELS[Math.min(20, lv) - 1];
    const entries = [], notes = [];
    const { coins = true, goods = true, items = true } = parts;
    if (coins) {
      const r = d100(); const [, , type, dice] = inRange(row.coins, r);
      if (type === "nothing") notes.push(`Coins d% ${r}: none`);
      else {
        const amount = Math.round(rollDice(dice));
        const nm = currencies().name(type);
        const shown = nm === type ? type : `${nm} (${type})`;
        notes.push(`Coins d% ${r}: ${diceText(dice)} ${shown} → ${amount.toLocaleString("en-US")} ${shown}`);
        entries.push({ coins: { [type]: amount }, name: `${amount.toLocaleString("en-US")} ${shown}` });
      }
    }
    if (goods) {
      const r = d100(); const [, , type, dice] = inRange(row.goods, r);
      if (type === "nothing") notes.push(`Goods d% ${r}: none`);
      else {
        const n = Math.max(1, Math.round(rollDice(dice)));
        notes.push(`Goods d% ${r}: ${diceText(dice)} ${type === "gems" ? "gems" : "art objects"} → ${n}`);
        for (let i = 0; i < n; i++) entries.push(...await fromCategory(type === "gems" ? "gem" : "art", { level: row.level, ...ctx }));
      }
    }
    if (items) {
      const r = d100(); const [, , type, dice] = inRange(row.items, r);
      if (type === "nothing") notes.push(`Items d% ${r}: none`);
      else {
        const n = Math.max(1, Math.round(rollDice(dice)));
        notes.push(`Items d% ${r}: ${diceText(dice)} ${type === "mundane" ? "mundane" : `${type} magic`} item${n > 1 ? "s" : ""} → ${n}`);
        for (let i = 0; i < n; i++) {
          if (type === "mundane") {
            // House rule (Generation settings): a share of mundane rolls are a poison, when an item source has poisons
            if (genChance("poison") && providerFor("mundane:poison")) {
              notes.push("Mundane item: a poison (Generation settings)");
              entries.push(...await fromCategory("mundane:poison", { level: row.level, grade: null, ...ctx }));
              continue;
            }
            const [, , cat] = inRange(MUNDANE, d100());
            entries.push(...await fromCategory(cat, { level: row.level, grade: null, ...ctx }));
          } else {
            const gi = { minor: 1, medium: 2, major: 3 }[type];
            const rr = d100();
            const m = MAGIC.find((x) => rr >= x[gi][0] && rr <= x[gi][1]);
            entries.push(...await fromCategory(MAGIC_KEYS[m[0]], { level: row.level, grade: type, ...ctx }));
          }
        }
      }
      // EL 21–30 (DMG): extra major items; while Epic items is on, a share of them are epic (house rule, Generation settings)
      if (lv > 20) {
        const n = EXTRA_MAJOR[lv - 21];
        const ru = rules();
        const share = ru.epic ? Math.min(100, Math.max(0, Number(ru.epicShare ?? 25) || 0)) : 0;
        const exclude = ctx.exclude ?? new Set();
        let epicCount = 0;
        for (let i = 0; i < n; i++) {
          const majorCat = () => { const rr = d100(); const m = MAGIC.find((x) => rr >= x[3][0] && rr <= x[3][1]); return MAGIC_KEYS[m[0]]; };
          if (share && Math.random() * 100 < share) {
            // An epic item: a category from the major table that has SRD epic items (arms, rings, rods, staffs, wondrous)
            let cat = majorCat();
            for (let g = 0; g < 10 && !EPIC_CATS.includes(cat); g++) cat = majorCat();
            if (!EPIC_CATS.includes(cat)) cat = "magic:wondrous";
            const got = (await fromCategory(cat, { level: 20, grade: "epic", epic: true, ...ctx, exclude })).filter((e) => !e.placeholder && e.data);
            if (got.length) {
              for (const e of got) exclude.add(normKey(e.name));
              entries.push(...got.map((e) => ({ ...e, summary: e.summary ? `${e.summary}` : "epic item" })));
              epicCount++;
              continue;
            }
          }
          entries.push(...await fromCategory(majorCat(), { level: 20, grade: "major", ...ctx }));
        }
        notes.push(`EL ${lv} (DMG): EL 20 row plus ${n} extra major item${n > 1 ? "s" : ""}${share ? `; ${epicCount} of them epic (${share}% share)` : ""}`);
      }
    }
    return { entries, notes };
  }
  const normKey = (s) => String(s ?? "").toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9']+/g, " ").trim();

  /* ------------------------------------------ */
  /*  Where items go                            */
  /* ------------------------------------------ */

  async function itemFolder() {
    return game.folders.find((f) => f.type === "Item" && f.name === ITEM_FOLDER)
      ?? Folder.create({ name: ITEM_FOLDER, type: "Item", color: "#3b24f0" });
  }

  /**
   * dest: "selected" (each selected token gets its own roll) | { mode: "actor", uuid } |
   * "items" (Generated Treasure folder) | "chat" (chat card with Create Item buttons)
   */
  async function resolveDestination(dest) {
    const d = typeof dest === "string" ? { mode: dest } : { ...(dest ?? {}) };
    if (d.mode === "actor" && !d.uuid) d.mode = "selected";
    if (d.mode === "selected") {
      const targets = [], seen = new Set();
      for (const t of canvas?.tokens?.controlled ?? []) {
        const key = t.document?.uuid ?? t.id;
        if (!t.actor || seen.has(key)) continue;
        seen.add(key);
        targets.push({ actor: t.actor, label: t.name ?? t.actor.name });
      }
      if (!targets.length && game.user.character) targets.push({ actor: game.user.character, label: game.user.character.name });
      if (!targets.length) {
        ui.notifications.warn("No token is selected, so the treasure went to the Items sidebar. Select tokens, or choose an actor under \"Put items in\".");
        return { mode: "items" };
      }
      return { mode: "actors", targets };
    }
    if (d.mode === "actor") {
      const doc = await fromUuid(d.uuid);
      const actor = doc?.documentName === "Actor" ? doc : doc?.actor ?? null;
      if (!actor) { ui.notifications.warn("That actor or token no longer exists, so the treasure went to the Items sidebar."); return { mode: "items" }; }
      return { mode: "actors", targets: [{ actor, label: doc.name ?? actor.name }] };
    }
    return { mode: d.mode === "chat" ? "chat" : "items" };
  }

  /** Roll an item's creation changes now (as D35E does when an item is dropped on a sheet). */
  async function rollCreationChanges(data) {
    const sys = data.system ?? (data.system = {});
    for (const [path, formula] of sys.creationChanges ?? []) {
      if (!path || !formula) continue;
      let total;
      try { total = (await new (foundry.dice?.Roll ?? Roll)(String(formula)).evaluate()).total; }
      catch (e) { total = rollDice(formula); }
      foundry.utils.setProperty(sys, path, Math.round(total * 100) / 100);
    }
    sys.creationChanges = [];
    return data;
  }

  /** Create entries; returns chat rows and a coin note. */
  async function place(entries, mode, actor, { mark = null } = {}) {
    const coins = { pp: 0, gp: 0, sp: 0, cp: 0 };
    const real = [], rows = [];
    for (const e of entries) {
      if (e.coins) { for (const [k, v] of Object.entries(e.coins)) coins[k] = (coins[k] ?? 0) + v; continue; }
      const row = { name: e.name, summary: e.summary ?? "", uuid: null, price: null, placeholder: !!e.placeholder || !e.data,
        provider: e.provider ?? null, ref: e.ref ?? null, data: e.ref && e.provider && registry.providers.get(e.provider)?.recreate ? null : e.data ?? null, describe: e.describe };
      rows.push(row);
      if (!row.placeholder) real.push([row, e.data]);
    }
    if (real.length && mode === "actors") {
      const data = [];
      for (const [, d] of real) {
        const c = await rollCreationChanges(foundry.utils.deepClone(d));
        if (mark) foundry.utils.setProperty(c, `flags.${FLAG}.${LOOT_KEY}`, mark); // token loot: removable later
        data.push(c);
      }
      const made = await actor.createEmbeddedDocuments("Item", data);
      made.forEach((doc, i) => { real[i][0].uuid = doc.uuid; real[i][0].price = data[i].system?.price ?? null; });
    } else if (real.length && mode === "items") {
      const folder = await itemFolder();
      const made = await CONFIG.Item.documentClass.createDocuments(real.map(([, d]) => ({ ...foundry.utils.deepClone(d), folder: folder.id })));
      made.forEach((doc, i) => { real[i][0].uuid = doc.uuid; });
    }
    let coinNote = "", paid = null;
    if (Object.values(coins).some((v) => v)) {
      const cfg = coinSettings();
      paid = convertCoins(coins, cfg);
      paid.purse = cfg.purse;
      if (mode === "actors") {
        const purse = actor.system?.[cfg.purse] ?? {};
        const customNow = actor.system?.customCurrency ?? {};
        const upd = {};
        for (const k of STD) if (paid.std[k]) upd[`system.${cfg.purse}.${k}`] = (Number(purse[k]) || 0) + paid.std[k];
        for (const [id, n] of Object.entries(paid.custom)) if (n) upd[`system.customCurrency.${id}`] = (Number(customNow[id]) || 0) + n;
        await actor.update(upd);
        const stdAny = STD.some((k) => paid.std[k]);
        coinNote = `Coins added: ${paid.text}${stdAny && cfg.purse === "altCurrency" ? " (standard coins as weightless coins)" : ""}.`;
      } else coinNote = `Coins (hand out yourself): ${paid.text}.`;
    }
    for (const r of rows) { if (typeof r.describe === "function") r.summary = r.describe(r.price); delete r.describe; }
    return { rows, coinNote, paid };
  }

  const rowSummary = (r) => [r.summary, !r.describe && r.price != null && !/value/.test(r.summary) ? `value ${gp(r.price)}` : ""].filter(Boolean).join("; ");

  function chatContent(title, rows, note = "") {
    const li = rows.map((r, i) => {
      if (r.placeholder) return `<li><em>${esc(r.name)}</em><br><small>${esc(r.summary)}</small></li>`;
      const link = r.uuid ? `@UUID[${r.uuid}]{${esc(r.name)}}` : `<strong>${esc(r.name)}</strong>`;
      const btn = r.uuid ? "" : `<br><button type="button" class="atg-create" data-index="${i}"><i class="fas fa-plus"></i> Create Item</button>`;
      return `<li>${link}<br><small>${esc(rowSummary(r))}</small>${btn}</li>`;
    }).join("");
    return `<h3>${esc(title)}</h3>${note ? `<p>${note}</p>` : ""}${rows.length ? `<ol>${li}</ol>` : ""}`;
  }

  async function postChat(title, rows, note) {
    return ChatMessage.create({
      content: chatContent(title, rows, note),
      whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id),
      speaker: { alias: "Treasure Generator" },
      flags: { [FLAG]: { [FLAG_KEY]: { title, note, rows } } },
    });
  }

  function onChat(message, html) {
    const root = html instanceof HTMLElement ? html : html?.[0];
    const flags = message?.flags?.[FLAG]?.[FLAG_KEY];
    if (!root || !flags?.rows) return;
    root.querySelectorAll("button.atg-create").forEach((btn) => {
      if (!game.user.isGM) return btn.remove();
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        btn.disabled = true;
        try {
          const i = Number(btn.dataset.index);
          const rows = foundry.utils.deepClone(flags.rows);
          const p = rows[i].provider && registry.providers.get(rows[i].provider);
          const data = rows[i].ref && p?.recreate ? await p.recreate(rows[i].ref) : rows[i].data;
          if (!data) throw new Error(`The module that made "${rows[i].name}" is not active.`);
          const folder = await itemFolder();
          const doc = await CONFIG.Item.documentClass.create({ ...data, folder: folder.id });
          rows[i].uuid = doc.uuid;
          await message.update({ content: chatContent(flags.title, rows, flags.note), [`flags.${FLAG}.${FLAG_KEY}.rows`]: rows });
        } catch (err) {
          btn.disabled = false;
          console.error("AxecleftTreasure | Create Item failed", err);
          ui.notifications.error(`Could not create the item: ${err.message}`);
        }
      });
    });
  }

  /**
   * Generate and place treasure. rollFor(actor) returns { entries, note } and is called
   * once per target actor, so each selected token gets its own roll.
   */
  async function runGeneration({ title, dest = "items", rollFor }) {
    const target = await resolveDestination(dest);
    const groups = target.mode === "actors" ? target.targets : [null];
    const out = [];
    for (const g of groups) {
      const { entries = [], note = "" } = (await rollFor(g?.actor ?? null)) ?? {};
      const { rows, coinNote } = await place(entries, target.mode, g?.actor);
      const where = g ? `Placed on ${esc(g.label)}; values rolled.` : target.mode === "items" && rows.some((r) => !r.placeholder) ? `Created in the "${esc(ITEM_FOLDER)}" Items folder.` : "";
      const missing = rows.some((r) => r.placeholder) ? "Items in <em>italics</em> need a module that isn't active; roll or pick them yourself." : "";
      await postChat(g ? `${title}: ${g.label}` : title, rows, [note, coinNote && esc(coinNote), where && `<small>${where}</small>`, missing && `<small>${missing}</small>`].filter(Boolean).join("<br>"));
      out.push({ actor: g?.actor ?? null, rows });
    }
    return out;
  }

  /** Roll the SRD Treasure table `times` times for each target and place the results. */
  async function generateTreasure({ level = 1, times = 1, dest = "items", coins = true, goods = true, items = true, form = null } = {}) {
    const n = Math.min(10, Math.max(1, Number(times) || 1));
    const parts = [coins && "coins", goods && "goods", items && "items"].filter(Boolean).join(", ");
    return runGeneration({ title: `Treasure, EL ${level}`, dest, rollFor: async (actor) => {
      const entries = [], notes = [];
      for (let i = 0; i < n; i++) {
        const r = await rollTreasure(level, { coins, goods, items }, { actor, form });
        entries.push(...r.entries);
        notes.push((n > 1 ? `<strong>Roll ${i + 1}:</strong> ` : "") + r.notes.map(esc).join("; "));
      }
      return { entries, note: notes.join("<br>") || esc(`Nothing rolled (${parts || "no parts ticked"}).`) };
    } });
  }

  /* ------------------------------------------ */
  /*  Token loot (version 9.7)                  */
  /* ------------------------------------------ */

  /*
   * Each NPC token gets its own roll on the SRD Treasure table at its Challenge Rating (SRD: a lone creature's
   * treasure is rolled with its CR as the encounter level), scaled by the Treasure setting on its D35E NPC sheet
   * (system.details.treasure: coins, goods, items in %; Standard 100, Double 200, None 0). Each full 100% is one
   * roll of that part; the rest is the chance of one more (D35E's own rule). CR below 1: EL 1, with the chance
   * scaled by the CR (Axecleft's rule; CR 1/2 rolls each part half the time). CR 21–30: EL 21–30 (version 9.9).
   * Loot goes into that token's inventory and purse (an unlinked token keeps it on that one creature), each item
   * marked so Clear Loot can take it back out, and the coins paid are recorded on the token.
   */
  const LOOT_KEY = "axecleftLoot";
  const lootSettings = () => ({ ...GEN_DEFAULTS.loot, ...(generation().loot ?? {}) });

  /** A creature's CR as a number ("1/2" → 0.5). */
  function crOf(actor) {
    const d = actor?.system?.details ?? {};
    const raw = d.totalCr ?? d.cr ?? 0;
    if (typeof raw === "string" && raw.includes("/")) { const [a, b] = raw.split("/").map(Number); return b ? a / b : 0; }
    return Math.max(0, Number(raw) || 0);
  }
  /** The D35E Treasure setting as percentages: { coins, goods, items }. */
  function treasurePct(actor) {
    const t = actor?.system?.details?.treasure ?? {};
    const n = (v) => (v === undefined || v === null || v === "" ? 100 : Math.max(0, Number(v) || 0));
    return { coins: n(t.coins), goods: n(t.goods), items: n(t.items) };
  }
  const rollsFor = (pct) => Math.floor(pct / 100) + (Math.random() * 100 < pct % 100 ? 1 : 0);
  /** Where the loot record lives: the token for an unlinked token, the actor for a linked one. */
  const lootHolder = (tokenDoc) => (tokenDoc.actorLink ? tokenDoc.actor : tokenDoc);
  const lootRecord = (tokenDoc) => lootHolder(tokenDoc)?.getFlag?.(FLAG, LOOT_KEY) ?? null;

  /** Why a token gets no loot (or null). */
  function lootProblem(tokenDoc, { auto = false } = {}) {
    const actor = tokenDoc?.actor;
    if (!actor) return "has no actor";
    // Traps (version 9.8): incidental loot, by hand only, at the Trap loot share of a creature's treasure
    if (actor.type === "trap") { if (auto) return "is a trap (trap loot is rolled by hand)"; }
    else if (actor.type !== "npc") return `is a ${actor.type}, not an NPC`;
    if (actor.hasPlayerOwner) return "belongs to a player";
    if (auto && tokenDoc.actorLink) return "is linked to its actor";
    if (auto && tokenDoc.hidden && !lootSettings().hidden) return "is hidden";
    if (auto && lootRecord(tokenDoc)) return "already has loot";
    const p = treasurePct(actor);
    if (!p.coins && !p.goods && !p.items) return "has Treasure: None";
    return null;
  }

  /** Take back the loot rolled before: its marked items and the coins recorded (never below 0). */
  async function clearLoot(tokenDoc) {
    const actor = tokenDoc?.actor;
    const rec = lootRecord(tokenDoc);
    if (!actor) return false;
    const ids = actor.items.filter((i) => i.getFlag?.(FLAG, LOOT_KEY) ?? i.flags?.[FLAG]?.[LOOT_KEY]).map((i) => i.id);
    if (ids.length) await actor.deleteEmbeddedDocuments("Item", ids);
    if (rec?.paid) {
      const upd = {}, purse = rec.paid.purse ?? "currency";
      for (const k of STD) if (rec.paid.std?.[k]) upd[`system.${purse}.${k}`] = Math.max(0, (Number(actor.system?.[purse]?.[k]) || 0) - rec.paid.std[k]);
      for (const [id, n] of Object.entries(rec.paid.custom ?? {})) if (n) upd[`system.customCurrency.${id}`] = Math.max(0, (Number(actor.system?.customCurrency?.[id]) || 0) - n);
      if (Object.keys(upd).length) await actor.update(upd);
    }
    if (rec) await lootHolder(tokenDoc).unsetFlag(FLAG, LOOT_KEY);
    return !!(ids.length || rec);
  }

  /**
   * Roll and place one token's loot. opts: { chat, replace, auto, coins, goods, items } (settings by default).
   * Returns { token, rows, note } or { token, skipped: reason }.
   */
  async function lootToken(tokenDoc, opts = {}) {
    tokenDoc = tokenDoc?.document ?? tokenDoc; // a Token placeable or its document
    const s = { ...lootSettings(), ...opts };
    const why = lootProblem(tokenDoc, { auto: !!opts.auto }); // opts.auto: rolled because a token was placed (not the Automatic loot setting)
    if (why) return { token: tokenDoc, skipped: why };
    const actor = tokenDoc.actor;
    if (s.replace !== false && lootRecord(tokenDoc)) await clearLoot(tokenDoc);
    const cr = crOf(actor), level = Math.min(30, Math.max(1, Math.floor(cr) || 1)); // 9.9: CR 21–30 as EL 21–30 (DMG); above 30, EL 30
    const trapShare = actor.type === "trap" ? Math.min(1, Math.max(0, Number(s.trapShare) || 0.25)) : 1;
    const scale = (cr > 0 && cr < 1 ? cr : 1) * trapShare;
    const pct = treasurePct(actor);
    const entries = [], notes = [];
    for (const part of ["coins", "goods", "items"]) {
      if (!s[part]) continue;
      const n = rollsFor(pct[part] * scale);
      for (let i = 0; i < n; i++) {
        const r = await rollTreasure(level, { coins: part === "coins", goods: part === "goods", items: part === "items" }, { actor, form: null });
        entries.push(...r.entries);
        notes.push(...r.notes);
      }
      if (!n) notes.push(`${part[0].toUpperCase()}${part.slice(1)}: no roll (${Math.round(pct[part] * scale)}% chance)`);
    }
    const mark = { at: Date.now() };
    const { rows, coinNote, paid } = await place(entries, "actors", actor, { mark });
    await lootHolder(tokenDoc).setFlag(FLAG, LOOT_KEY, { at: mark.at, cr, level, paid: paid ? { std: paid.std, custom: paid.custom, purse: paid.purse } : null });
    const crText = cr > 0 && cr < 1 ? `CR 1/${Math.round(1 / cr)}` : `CR ${cr}`;
    const pctText = pct.coins === pct.goods && pct.goods === pct.items ? ({ 100: "standard", 200: "double", 300: "triple" }[pct.coins] ?? `${pct.coins}%`) : `coins ${pct.coins}%, goods ${pct.goods}%, items ${pct.items}%`;
    const shareText = trapShare < 1 ? `; trap loot ×${{ 0.25: "¼", 0.5: "½", 0.75: "¾" }[trapShare] ?? trapShare}` : actor.type === "trap" ? "; trap loot ×1" : "";
    const note = [`${esc(crText)} → EL ${level}${cr > 30 ? " (the table stops at 30)" : ""}; treasure ${esc(pctText)}${shareText}.`, notes.map(esc).join("; "), coinNote && esc(coinNote),
      rows.some((r) => r.placeholder) ? "<small>Items in <em>italics</em> need a module that isn't active; roll or pick them yourself.</small>" : ""].filter(Boolean).join("<br>");
    if (s.chat !== false) await postChat(`Loot: ${tokenDoc.name}`, rows, note);
    return { token: tokenDoc, rows, note };
  }

  /** Loot for several tokens (default: the selected ones), one after another. */
  async function lootTokens(tokens = null, opts = {}) {
    const list = (tokens ?? canvas?.tokens?.controlled ?? []).map((t) => t?.document ?? t).filter(Boolean);
    if (!list.length) { ui.notifications.warn("Select one or more NPC tokens first."); return []; }
    const out = [];
    for (const t of list) {
      try { out.push(await lootToken(t, opts)); }
      catch (err) { console.error(`AxecleftTreasure | loot for ${t.name} failed`, err); out.push({ token: t, skipped: `failed: ${err.message}` }); }
    }
    const done = out.filter((o) => !o.skipped).length, skipped = out.filter((o) => o.skipped);
    if (!opts.auto) {
      if (done) ui.notifications.info(`Loot rolled for ${done} token${done > 1 ? "s" : ""}.`);
      if (skipped.length) ui.notifications.warn(`No loot for ${skipped.map((o) => `${o.token.name} (${o.skipped})`).join(", ")}.`);
    }
    return out;
  }
  async function clearLootTokens(tokens = null) {
    const list = (tokens ?? canvas?.tokens?.controlled ?? []).map((t) => t?.document ?? t).filter(Boolean);
    if (!list.length) return ui.notifications.warn("Select one or more tokens first.");
    let n = 0;
    for (const t of list) if (await clearLoot(t)) n++;
    ui.notifications.info(n ? `Loot cleared from ${n} token${n > 1 ? "s" : ""}.` : "None of the selected tokens has loot from the Treasure Generator.");
  }

  // Automatic loot: unlinked NPC tokens placed on a scene, rolled one at a time by the active GM
  let lootQueue = Promise.resolve();
  function onCreateToken(tokenDoc, options) {
    if (!game.user.isGM || (game.users.activeGM && !game.users.activeGM.isSelf)) return;
    if (options?.axecleftNoLoot || !lootSettings().auto || lootProblem(tokenDoc, { auto: true })) return;
    lootQueue = lootQueue.then(() => lootToken(tokenDoc, { auto: true, replace: false })).catch((err) => console.error(`AxecleftTreasure | automatic loot for ${tokenDoc.name} failed`, err));
  }

  /** A button in the token controls (left toolbar): loot for the selected tokens. */
  function onSceneControls(controls) {
    if (!game.user.isGM) return;
    const tool = { name: "axecleft-loot", title: "Roll Loot for Selected Tokens (Treasure Generator, by CR)", icon: "fas fa-sack-dollar", button: true, visible: true };
    if (Array.isArray(controls)) { // Foundry 11-12
      const tc = controls.find((c) => c.name === "token");
      tc?.tools?.push({ ...tool, onClick: () => lootTokens() });
    } else { // Foundry 13+
      const tc = controls.tokens ?? controls.token;
      if (tc?.tools) tc.tools[tool.name] = { ...tool, order: Object.keys(tc.tools).length + 1, onChange: () => lootTokens() };
    }
  }

  /* ------------------------------------------ */
  /*  The window                                */
  /* ------------------------------------------ */

  /* ------------------------------------------ */
  /*  Shared custom lists (journal + library)   */
  /* ------------------------------------------ */

  /*
   * Every Axecleft module can keep user-made lists (new gem types, weapon
   * qualities, ...). They all live in one world journal, "Axecleft's Treasure
   * Lists", one page per list, as plain tables the GM can edit like any journal
   * page or add to from the generator's Lists tab. Every change is also saved
   * to one library file in the Foundry Data folder
   * (Data/axecleft-treasure/treasure-lists.json by default), outside the module
   * and world folders, so module updates never touch it and every world on the
   * server loads it. Loading only ever adds rows (matched by name).
   *
   * A module declares its lists at load time:
   *   T.registerList({ module, key, page, label, cols: [[field, header, input?], ...], intro,
   *                    normalize?, format?, builtin?, names?, scopes?, prepare?, order? })
   *   input: { type: "text" | "number" | "select" | "checks", options: [[value, label]] | () => [...],
   *            value, min, max, step, placeholder }
   * and reads them with T.customList(module, key) (built-in rows minus the
   * disabled ones, plus the GM's rows) or T.listRows(module, key) (the GM's rows only).
   * Each module also gets a "Disabled Entries" page: built-in entries to switch off.
   */
  registry.lists ??= new Map(); // "module|key" -> spec
  const JOURNAL_NAME = "Axecleft's Treasure Lists";
  const LIBRARY_FILE = "treasure-lists.json";
  const LEGACY_MOD = "axecleft-gemstones"; // Gemstones 1.14 kept the journal flags and the library in its own layout
  const J_FLAG = "axecleftLists", P_FLAG = "axecleftList", DISABLED = "disabled";

  function registerList(def) {
    if (!def?.module || !def?.key || !Array.isArray(def.cols) || def.key === DISABLED || /\|/.test(def.key)) {
      return console.error("AxecleftTreasure | registerList() needs module, key (not \"disabled\") and cols", def);
    }
    const cols = def.cols.map((c) => (Array.isArray(c) ? { field: c[0], header: c[1], input: c[2] ?? null } : c));
    if (!cols.some((c) => c.field === "name")) return console.error("AxecleftTreasure | registerList() needs a \"name\" column", def);
    registry.lists.set(`${def.module}|${def.key}`, { intro: "", scopes: [], order: 100, ...def, page: def.page ?? def.label ?? def.key, label: def.label ?? def.page ?? def.key, cols, id: `${def.module}|${def.key}` });
    api.refresh();
  }
  const listSpec = (m, k) => (k === DISABLED ? disabledSpec(m) : registry.lists.get(`${m}|${k}`) ?? null);
  const activeLists = () => [...registry.lists.values()].filter(isActive).sort((a, b) => a.module.localeCompare(b.module) || (a.order ?? 100) - (b.order ?? 100));
  const listModules = () => [...new Set(activeLists().map((s) => s.module))];
  const modTitle = (m) => (m === CORR_MOD ? "Treasure Generator" : game.modules.get(m)?.title ?? m);
  /** The values a disabled entry's List column can take for a module: its list keys, their scopes, and "any". */
  const disableTargets = (m) => [...activeLists().filter((s) => s.module === m).flatMap((s) => [[s.key, s.label], ...(s.scopes ?? [])]), ["any", "Any list"]];
  function disabledSpec(m) {
    return {
      module: m, key: DISABLED, id: `${m}|${DISABLED}`, page: `Disabled Entries (${modTitle(m)})`, label: "Disabled entry",
      cols: [{ field: "name", header: "Name" }, { field: "list", header: "List" }],
      intro: `Built-in entries of ${esc(modTitle(m))} that should never be used. <strong>List</strong> is one of: ${disableTargets(m).map(([v]) => esc(v)).join(", ")}.`,
      normalize: (r) => ({ name: String(r.name).trim(), list: String(r.list ?? "any").trim().toLowerCase() || "any" }),
    };
  }

  /* ---- tables <-> rows ---- */
  const decodeCell = (s) => String(s).replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#0?39;|&apos;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
  const headKey = (s) => decodeCell(s).toLowerCase().replace(/[^a-z]/g, "");
  const rowKey = (r) => `${String(r.name).toLowerCase()}|${r.list ?? ""}`;

  /** Clean up one row for a list (null if it has no name). */
  function normalizeRow(spec, r0) {
    const name = String(r0?.name ?? "").trim();
    if (!name) return null;
    if (spec.normalize) { const r = spec.normalize({ ...r0, name }); return r?.name ? r : null; }
    const out = { name };
    for (const c of spec.cols) {
      if (c.field === "name") continue;
      const v = r0?.[c.field], t = c.input?.type;
      if (t === "number") { const n = parseFloat(v); out[c.field] = Number.isFinite(n) ? n : Number(c.input.value ?? 0); }
      else if (t === "checks") out[c.field] = (Array.isArray(v) ? v : String(v ?? "").split(/[,;]/)).map((x) => String(x).trim()).filter(Boolean);
      else out[c.field] = Array.isArray(v) ? v : String(v ?? "").trim();
    }
    return out;
  }
  const cellText = (spec, field, row) => {
    const own = spec.format?.(field, row);
    if (own !== undefined && own !== null) return String(own);
    const v = row[field];
    if (Array.isArray(v)) return v.join(", ");
    return /^\s*</.test(String(v ?? "")) ? decodeCell(v) : String(v ?? "");
  };
  /** Read the first table of a page into rows, matching columns by their headers. */
  function parseTable(spec, html) {
    const table = String(html ?? "").match(/<table[\s\S]*?<\/table>/i)?.[0];
    if (!table) return [];
    const rows = [...table.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((m) => [...m[0].matchAll(/<t([hd])[^>]*>([\s\S]*?)<\/t\1>/gi)].map((c) => c[2]));
    if (!rows.length) return [];
    const header = rows[0].map(headKey);
    const index = spec.cols.map(({ header: h }) => { const i = header.indexOf(headKey(h)); return i >= 0 ? i : header.findIndex((x) => x.startsWith(headKey(h).slice(0, 5))); });
    return rows.slice(1).map((cells) => {
      const r = {};
      spec.cols.forEach(({ field }, j) => { const i = index[j]; r[field] = i >= 0 && cells[i] !== undefined ? decodeCell(cells[i]) : ""; });
      return normalizeRow(spec, r);
    }).filter(Boolean);
  }
  function tableHtml(spec, rows) {
    const head = spec.cols.map((c) => `<th>${esc(c.header)}</th>`).join("");
    const body = [...rows].sort((a, b) => a.name.localeCompare(b.name)).map((r) => `<tr>${spec.cols.map((c) => `<td>${esc(cellText(spec, c.field, r))}</td>`).join("")}</tr>`).join("");
    const blank = `<tr>${spec.cols.map(() => "<td></td>").join("")}</tr>`;
    return `<p>${spec.intro ?? ""}</p><p><em>Add a row to the table (or use the Lists tab of the Treasure Generator). Rows without a name are ignored.</em></p>`
      + `<table><thead><tr>${head}</tr></thead><tbody>${body}${blank}</tbody></table>`;
  }
  /** Add rows from extra that base doesn't have (by name). Returns { rows, added }. */
  function mergeRows(spec, base = [], extra = []) {
    const have = new Map(base.map((r) => [rowKey(r), r]));
    let added = 0;
    for (const r0 of extra ?? []) { const r = normalizeRow(spec, r0); if (r && !have.has(rowKey(r))) { have.set(rowKey(r), r); added++; } }
    return { rows: [...have.values()], added };
  }

  /* ---- the journal ---- */
  const HOW_TO = () => `<h2>${JOURNAL_NAME}</h2>
<p>These pages hold <strong>your own additions</strong> to Axecleft's modules (${listModules().map((m) => esc(modTitle(m))).join(", ") || "none active"}), plus any built-in entries you want switched off.</p>
<ul>
<li>Edit the tables on the other pages like any journal table, or use the <strong>Lists</strong> tab of the Treasure Generator (Axecleft's Tools on the left toolbar).</li>
<li>Changes take effect at once.</li>
<li><strong>Shared library:</strong> every change is also saved to <code>Data/${esc(libraryPath())}</code> on your Foundry server. Module updates never touch that file, and every world on this Foundry install loads it, so your lists follow you from world to world. Loading only adds missing rows; it never deletes rows from a world.</li>
<li>Pages of a module that isn't active are kept as they are.</li>
<li>To move the lists to a different Foundry install, use <strong>Export</strong> and <strong>Import</strong> on the Lists tab.</li>
</ul>
<p>Deleting this journal is safe: it is rebuilt from the shared library the next time the world loads.</p>`;
  let suppressSave = 0;
  const pageId = (p) => p?.flags?.world?.[P_FLAG] ?? null;
  function findJournal() {
    const all = game.journal ?? [];
    return all.find((j) => j.flags?.world?.[J_FLAG]) ?? all.find((j) => j.flags?.[LEGACY_MOD]?.lists) ?? null;
  }
  const pageFor = (j, spec) => j?.pages?.find((p) => pageId(p) === spec.id) ?? null;
  const newPage = (spec, rows, sort) => ({ name: spec.page, type: "text", text: { content: tableHtml(spec, rows) }, sort, flags: { world: { [P_FLAG]: spec.id } } });
  const specsFor = (m) => [...activeLists().filter((s) => s.module === m), disabledSpec(m)];

  /** Gemstones 1.14 journal: flags under its module scope, and a plain "Disabled Entries" page. Move them to the shared layout. */
  async function migrateJournal(j) {
    if (j.flags?.world?.[J_FLAG]) return;
    for (const p of j.pages ?? []) {
      const old = p.flags?.[LEGACY_MOD]?.list;
      if (old && !pageId(p)) {
        const upd = { [`flags.world.${P_FLAG}`]: `${LEGACY_MOD}|${old}` };
        if (old === DISABLED) upd.name = disabledSpec(LEGACY_MOD).page;
        await p.update(upd);
      } else if (!pageId(p) && p.name === "How to Use") await p.update({ [`flags.world.${P_FLAG}`]: "howto", "text.content": HOW_TO() });
    }
    await j.update({ [`flags.world.${J_FLAG}`]: true });
    console.log("AxecleftTreasure | moved the Treasure Lists journal to the shared layout");
  }

  /** The world's lists journal, created if missing; migrated and given pages for any newly registered lists. */
  async function getJournal({ create = true } = {}) {
    let j = findJournal();
    if (!game.user?.isGM) return j;
    if (!j && !create) return null;
    suppressSave++;
    try {
      if (!j) {
        const specs = listModules().flatMap(specsFor);
        j = await JournalEntry.create({
          name: JOURNAL_NAME, ownership: { default: 0 }, flags: { world: { [J_FLAG]: true } },
          pages: [{ name: "How to Use", type: "text", text: { content: HOW_TO() }, sort: 0, flags: { world: { [P_FLAG]: "howto" } } },
            ...specs.map((s, i) => newPage(s, [], (i + 1) * 1000))],
        });
        return j;
      }
      await migrateJournal(j);
      const missing = listModules().flatMap(specsFor).filter((s) => !pageFor(j, s));
      if (missing.length) {
        const top = Math.max(0, ...(j.pages ?? []).map((p) => p.sort ?? 0));
        await j.createEmbeddedDocuments("JournalEntryPage", missing.map((s, i) => newPage(s, [], top + (i + 1) * 1000)));
      }
      return j;
    } finally { suppressSave--; }
  }

  /** One module's lists from the journal: { key: rows, ..., disabled: rows }. */
  function readModule(m, j = findJournal()) {
    const out = {};
    for (const s of specsFor(m)) out[s.key] = j ? parseTable(s, pageFor(j, s)?.text?.content ?? "") : [];
    return out;
  }
  /** Every active module's lists: { module: { key: rows } }. */
  const readAll = (j = findJournal()) => Object.fromEntries(listModules().map((m) => [m, readModule(m, j)]));
  const countRows = (all) => Object.values(all ?? {}).reduce((a, mod) => a + Object.values(mod ?? {}).reduce((b, rows) => b + (rows?.length ?? 0), 0), 0);

  /** Rewrite the pages that changed. all: { module: { key: rows } } (modules missing from it are left alone). */
  async function writeLists(all, { save = true } = {}) {
    const j = await getJournal();
    const current = readAll(j);
    suppressSave++;
    try {
      for (const [m, lists] of Object.entries(all)) {
        for (const s of specsFor(m)) {
          if (!lists?.[s.key] || JSON.stringify(current[m]?.[s.key]) === JSON.stringify(lists[s.key])) continue;
          const page = pageFor(j, s), content = tableHtml(s, lists[s.key]);
          if (page) await page.update({ "text.content": content });
          else await j.createEmbeddedDocuments("JournalEntryPage", [newPage(s, lists[s.key])]);
        }
      }
    } finally { suppressSave--; }
    corrIndex = null;
    Hooks.callAll("axecleftTreasure.listsChanged");
    api.refresh();
    if (save && librarySync() === "auto") await saveLibrary();
  }

  /** Add one row (replacing a row of the same name). */
  async function addRow(m, k, row) {
    const spec = listSpec(m, k);
    if (!spec) throw new Error(`There is no list "${k}" for ${m}.`);
    const r = normalizeRow(spec, row);
    if (!r) throw new Error("It needs a name.");
    const lists = readModule(m, await getJournal());
    lists[k] = lists[k].filter((x) => rowKey(x) !== rowKey(r)).concat(r);
    await writeLists({ [m]: lists });
    return r;
  }
  /** Remove a row by name (and List, for disabled entries). */
  async function removeRow(m, k, name, list = undefined) {
    const lists = readModule(m, await getJournal());
    const key = rowKey({ name, list });
    const before = lists[k]?.length ?? 0;
    lists[k] = (lists[k] ?? []).filter((x) => rowKey(x) !== key);
    if (lists[k].length !== before) await writeLists({ [m]: lists });
    return before - lists[k].length;
  }

  /** The GM's rows of a list. */
  const listRows = (m, k) => readModule(m)[k] ?? [];
  /** A module's disabled entries: [{ name, list }]. */
  const disabledEntries = (m) => readModule(m)[DISABLED] ?? [];
  /**
   * A list as a module should use it: its built-in rows (spec.builtin) minus the disabled ones,
   * then the GM's rows (which replace built-in rows of the same name). Rows get source "builtin" or "custom".
   */
  function customList(m, k) {
    const spec = listSpec(m, k);
    if (!spec) return [];
    const mod = readModule(m);
    const off = new Set((mod[DISABLED] ?? []).map((d) => `${d.list}|${String(d.name).toLowerCase()}`));
    const on = (r) => !off.has(`${k}|${String(r.name).toLowerCase()}`) && !off.has(`any|${String(r.name).toLowerCase()}`) && !(r.scope && off.has(`${r.scope}|${String(r.name).toLowerCase()}`));
    let builtin = [];
    try { builtin = (typeof spec.builtin === "function" ? spec.builtin() : spec.builtin) ?? []; } catch (e) { console.warn(`AxecleftTreasure | ${spec.id} builtin failed`, e); }
    const own = mod[k] ?? [];
    const mine = new Set(own.map((r) => String(r.name).toLowerCase()));
    return [...builtin.filter((r) => on(r) && !mine.has(String(r.name).toLowerCase())).map((r) => ({ ...r, source: r.source ?? "builtin" })), ...own.map((r) => ({ ...r, source: "custom" }))];
  }

  /* ---- the shared library file ---- */
  let libNs = null;
  function registerLibrarySettings() {
    for (const ns of [host(), "world"].filter(Boolean)) {
      try {
        const reg = (k, o) => { if (!game.settings.settings?.has?.(`${ns}.${k}`)) game.settings.register(ns, k, { scope: "world", config: true, ...o }); };
        reg("librarySync", { name: "Shared treasure lists library", hint: "Automatic: your Treasure Lists (custom gems, art, weapons and so on, for every Axecleft module) are saved to a file in the Foundry Data folder whenever you change them, and every world loads them at start-up, so they survive module updates and follow you between worlds. Manual: only when you press Save / Load on the Treasure Generator's Lists tab.", type: String, default: "auto", choices: { auto: "Automatic", manual: "Manual" } });
        reg("libraryFolder", { name: "Shared library folder", hint: `Folder inside your Foundry Data folder that holds ${LIBRARY_FILE}.`, type: String, default: "axecleft-treasure" });
        libNs = ns;
        return;
      } catch (e) { console.warn(`AxecleftTreasure | could not register the library settings under "${ns}"`, e); }
    }
  }
  const libSetting = (k, d) => { try { return libNs ? game.settings.get(libNs, k) ?? d : d; } catch (e) { return d; } };
  const librarySync = () => libSetting("librarySync", "auto");
  const libraryFolder = () => String(libSetting("libraryFolder", "") || "axecleft-treasure").replace(/^\/+|\/+$/g, "");
  const libraryPath = () => `${libraryFolder()}/${LIBRARY_FILE}`;
  const FPi = () => foundry.applications?.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
  const fileSource = () => (typeof ForgeVTT !== "undefined" && ForgeVTT?.usingTheForge ? "forgevtt" : "data");

  /** { module: { key: rows } } from a library or export file, old (Gemstones 1.14) or new layout. */
  function fileModules(data) {
    if (!data || typeof data !== "object") return null;
    if (data.modules && typeof data.modules === "object") return data.modules;
    if (data.lists && typeof data.lists === "object") return { [data.module || LEGACY_MOD]: data.lists };
    if (["gems", "objects", "materials", "embellishments"].some((k) => Array.isArray(data[k]))) return { [LEGACY_MOD]: data };
    return null;
  }
  let libFormat = null; // layout of the library file last read: 1 (Gemstones 1.14) or 2
  async function readLibrary() {
    try {
      const res = await FPi().browse(fileSource(), libraryFolder());
      const url = res?.files?.find((f) => decodeURIComponent(f).endsWith(`/${LIBRARY_FILE}`));
      if (!url) return null;
      const r = await fetch(`${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`, { cache: "no-store" });
      if (!r.ok) return null;
      const data = await r.json();
      libFormat = data?.format === 2 ? 2 : 1;
      return fileModules(data);
    } catch (err) { return null; } // the folder doesn't exist yet
  }
  /** Save the active modules' lists to the library file; other modules' lists already in it are kept. */
  async function saveLibrary() {
    if (!game.user?.isGM) return false;
    const modules = { ...((await readLibrary()) ?? {}), ...readAll() };
    const versions = Object.fromEntries(Object.keys(modules).map((m) => [m, game.modules.get(m)?.version ?? null]));
    const data = { format: 2, saved: new Date().toISOString(), world: game.world?.id, versions, modules };
    // Gemstones 1.14 (before the shared lists) reads only "module" and "lists": keep a copy of its lists there.
    if (modules[LEGACY_MOD]) Object.assign(data, { module: LEGACY_MOD, lists: modules[LEGACY_MOD] });
    const file = new File([JSON.stringify(data, null, 1)], LIBRARY_FILE, { type: "application/json" });
    try {
      try { await FPi().createDirectory(fileSource(), libraryFolder(), {}); } catch (e) { /* already exists */ }
      await FPi().upload(fileSource(), libraryFolder(), file, {}, { notify: false });
      return true;
    } catch (err) {
      console.warn("AxecleftTreasure | could not save the shared treasure library", err);
      ui.notifications.warn(`Treasure Lists: could not save the shared library (${err.message}). Your lists are still saved in this world.`);
      return false;
    }
  }
  /** Merge { module: { key: rows } } into the journal (adds rows only). Returns the number added. */
  async function mergeIn(modules, { save = false } = {}) {
    const j = await getJournal();
    const all = readAll(j);
    let added = 0;
    for (const m of Object.keys(all)) {
      for (const s of specsFor(m)) {
        const res = mergeRows(s, all[m][s.key], modules?.[m]?.[s.key]);
        all[m][s.key] = res.rows; added += res.added;
      }
    }
    if (added) await writeLists(all, { save });
    return added;
  }
  async function loadLibrary({ notify = true } = {}) {
    const lib = await readLibrary();
    if (!lib) { if (notify) ui.notifications.info("No shared treasure library yet. It is created the first time you save a list."); return 0; }
    const added = await mergeIn(lib);
    if (notify) ui.notifications.info(added ? `Treasure Lists: added ${added} entr${added === 1 ? "y" : "ies"} from the shared library.` : "Treasure Lists: this world already has everything in the shared library.");
    return added;
  }
  function exportLists() {
    const data = { format: 2, saved: new Date().toISOString(), modules: readAll() };
    const save = foundry.utils.saveDataToFile ?? globalThis.saveDataToFile;
    save(JSON.stringify(data, null, 1), "application/json", "axecleft-treasure-lists.json");
  }
  async function importLists(file) {
    const modules = fileModules(JSON.parse(await file.text()));
    if (!modules) throw new Error("That file has no treasure lists in it.");
    const added = await mergeIn(modules, { save: true });
    return added;
  }

  /** World load (GM): make or migrate the journal, pull in the library, and save back anything the library lacks. */
  async function startLists() {
    if (!game.user?.isGM || !registry.lists.size) return;
    await getJournal();
    if (librarySync() !== "auto") return;
    const lib = await readLibrary();
    if (lib) {
      const added = await mergeIn(lib);
      if (added) ui.notifications.info(`Treasure Lists: loaded ${added} custom entr${added === 1 ? "y" : "ies"} from the shared library.`);
    }
    // Save back if the world has rows the library lacks (a first run, edits made with sync off) or the file is in the old layout
    const all = readAll();
    const lacks = Object.entries(all).some(([m, lists]) => specsFor(m).some((s) => {
      const have = new Set((lib?.[m]?.[s.key] ?? []).map((r) => normalizeRow(s, r)).filter(Boolean).map(rowKey));
      return (lists[s.key] ?? []).some((r) => !have.has(rowKey(r)));
    }));
    if (lacks || (lib && libFormat !== 2 && countRows(all))) await saveLibrary();
  }
  let saveTimer = null, rescanTimer = null;
  function onListPage(page, userId) {
    const j = page?.parent;
    if (!j || !(j.flags?.world?.[J_FLAG] || j.flags?.[LEGACY_MOD]?.lists)) return;
    Hooks.callAll("axecleftTreasure.listsChanged");
    corrIndex = null;
    if (game.user?.isGM && /price corrections/i.test(page?.name ?? "")) { clearTimeout(rescanTimer); rescanTimer = setTimeout(() => scanCompendiums(), 1500); }
    api.refresh();
    if (suppressSave || userId !== game.user?.id || !game.user?.isGM || librarySync() !== "auto") return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveLibrary(), 1500);
  }

  /* ---- the Lists tab ---- */
  function listInput(spec, c, name) {
    const i = c.input ?? {};
    const options = typeof i.options === "function" ? i.options() : i.options ?? [];
    if (i.type === "select") return `<select name="${name}">${options.map(([v, l]) => opt(v, l, i.value)).join("")}</select>`;
    if (i.type === "checks") return `<div class="atg-checks">${options.map(([v, l]) => `<label><input type="checkbox" name="${name}" value="${esc(v)}"> ${esc(l)}</label>`).join("")}</div>`;
    if (i.type === "number") return `<input type="number" name="${name}" value="${esc(i.value ?? "")}"${i.min !== undefined ? ` min="${i.min}"` : ""}${i.max !== undefined ? ` max="${i.max}"` : ""} step="${i.step ?? 1}">`;
    return `<input type="text" name="${name}" placeholder="${esc(i.placeholder ?? "")}">`;
  }
  const chips = (rows, m, k, label) => (rows.length
    ? `<div class="atg-chips">${rows.slice(0, 200).map((r) => `<span class="atg-chip">${esc(label(r))}<a data-remove="${esc(JSON.stringify([m, k, r.name, r.list]))}" title="Remove">✕</a></span>`).join("")}${rows.length > 200 ? ` <em>…and ${rows.length - 200} more (see the journal)</em>` : ""}</div>`
    : "<p class=\"hint\">None.</p>");

  const LISTS_TAB = {
    module: "axecleft-treasure", name: "lists", id: "t-axecleft-treasure-lists", title: "Lists", icon: "fas fa-list", order: 1000,
    async prepare() { for (const s of activeLists()) { try { await s.prepare?.(); } catch (e) { console.warn(`AxecleftTreasure | ${s.id} prepare failed`, e); } } },
    content(app) {
      const specs = activeLists(), mods = listModules(), all = readAll();
      const sel = specs.find((s) => s.id === app.listSel) ?? specs.find((s) => s.id === recall("lists.sel", "")) ?? specs[0];
      app.listSel = sel?.id;
      const sync = librarySync() === "auto";
      const counts = mods.map((m) => `${mods.length > 1 ? `<tr><th colspan="3" style="text-align:left;padding-top:4px">${esc(modTitle(m))}</th></tr>` : ""}`
        + specs.filter((s) => s.module === m).map((s) => {
          const off = (all[m]?.[DISABLED] ?? []).filter((d) => [s.key, ...(s.scopes ?? []).map((x) => x[0])].includes(d.list)).length;
          return `<tr><td>${esc(s.page)}</td><td>${all[m]?.[s.key]?.length ?? 0} added</td><td>${off ? `${off} switched off` : ""}</td></tr>`;
        }).join("")
        + `${(all[m]?.[DISABLED] ?? []).some((d) => d.list === "any") ? `<tr><td>Any list</td><td></td><td>${all[m][DISABLED].filter((d) => d.list === "any").length} switched off</td></tr>` : ""}`).join("");
      const listOpts = mods.map((m) => `<optgroup label="${esc(modTitle(m))}">${specs.filter((s) => s.module === m).map((s) => opt(s.id, s.label, sel?.id)).join("")}</optgroup>`).join("");
      const forms = specs.map((s, i) => {
        const mine = all[s.module]?.[s.key] ?? [];
        const targets = [[s.key, `This list`], ...(s.scopes ?? []), ["any", `Every ${modTitle(s.module)} list`]];
        const offRows = (all[s.module]?.[DISABLED] ?? []).filter((d) => targets.some(([v]) => v === d.list));
        let names = [];
        try { names = s.names?.() ?? (typeof s.builtin === "function" ? s.builtin() : s.builtin ?? []).map((r) => r.name); } catch (e) { /* none */ }
        return `<div data-list-form="${esc(s.id)}" data-i="${i}">
          <fieldset><legend>Add to ${esc(s.page)}</legend>
            ${s.cols.map((c) => `<div class="form-group"><label>${esc(c.header)}</label>${listInput(s, c, `ladd.${i}.${c.field}`)}</div>`).join("")}
            <div class="atg-footer"><button type="button" data-lists="addRow" data-i="${i}"><i class="fas fa-plus"></i> Add to List</button></div>
            <details class="atg-sec" data-sec="mine"><summary>Your entries <small>(${mine.length})</small></summary>${chips(mine, s.module, s.key, (r) => r.name)}</details>
          </fieldset>
          <fieldset><legend>Switch off built-in entries</legend>
            <p class="hint">Switched-off entries are never used. They go on the "${esc(disabledSpec(s.module).page)}" page.</p>
            <div class="form-group"><label>Name</label><input type="text" name="loff.${i}.name" list="atg-names-${i}"><datalist id="atg-names-${i}">${[...new Set(names)].sort().map((n) => `<option value="${esc(n)}">`).join("")}</datalist></div>
            <div class="form-group"><label>Where</label><select name="loff.${i}.list">${targets.map(([v, l]) => opt(v, l)).join("")}</select></div>
            <div class="atg-footer"><button type="button" data-lists="disable" data-i="${i}"><i class="fas fa-ban"></i> Switch Off</button></div>
            ${chips(offRows, s.module, DISABLED, (r) => (r.list === s.key ? r.name : `${r.name} (${targets.find(([v]) => v === r.list)?.[1] ?? r.list})`))}
          </fieldset></div>`;
      }).join("");
      return `
        <p class="hint">Your own entries for Axecleft's modules live in the <strong>${esc(JOURNAL_NAME)}</strong> journal (edit its tables directly, or use this tab). ${sync
          ? `Every change is also saved to the shared library <code>Data/${esc(libraryPath())}</code>, which module updates never touch and every world on this server loads.`
          : "Automatic library sync is off (module settings); use the buttons below."}</p>
        <table class="atg-counts">${counts}</table>
        <div class="atg-footer">
          <button type="button" data-lists="openJournal"><i class="fas fa-book-open"></i> Open Lists Journal</button>
          <button type="button" data-lists="saveLibrary"><i class="fas fa-cloud-arrow-up"></i> Save to Library</button>
          <button type="button" data-lists="loadLibrary"><i class="fas fa-cloud-arrow-down"></i> Load from Library</button>
        </div>
        <div class="form-group" style="margin-top:8px"><label>List</label><select name="lists.sel">${listOpts}</select></div>
        ${forms}
        <fieldset><legend>Another Foundry server</legend>
          <p class="hint">Export downloads your lists (every active module's) as a file; Import merges such a file in (it only adds entries). Files exported by Gemstones 1.14 work too.</p>
          <div class="atg-footer">
            <button type="button" data-lists="export"><i class="fas fa-file-export"></i> Export</button>
            <button type="button" data-lists="import"><i class="fas fa-file-import"></i> Import</button>
            <input type="file" name="lists.importFile" accept=".json,application/json" hidden>
          </div>
        </fieldset>`;
    },
    wire(section, app) {
      const form = section.closest("form"), el = (n) => form.elements[n];
      const specs = activeLists();
      const show = () => {
        app.listSel = el("lists.sel").value; remember("lists.sel", app.listSel);
        section.querySelectorAll("[data-list-form]").forEach((d) => { d.style.display = d.dataset.listForm === app.listSel ? "" : "none"; });
        api.refreshSize?.();
      };
      el("lists.sel").addEventListener("change", show);
      show();
      section.querySelectorAll("details.atg-sec").forEach((d) => d.addEventListener("toggle", () => api.refreshSize?.()));
      el("lists.importFile").addEventListener("change", async (ev) => {
        const file = ev.target.files?.[0];
        if (!file) return;
        try { const added = await importLists(file); ui.notifications.info(`Imported ${added} new entr${added === 1 ? "y" : "ies"}.`); app.render(); }
        catch (err) { ui.notifications.error(`Import failed: ${err.message}`); }
        ev.target.value = "";
      });
      section.querySelectorAll("[data-remove]").forEach((a) => a.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const [m, k, name, list] = JSON.parse(a.dataset.remove);
        try { await removeRow(m, k, name, list ?? undefined); ui.notifications.info(`Removed "${name}".`); app.render(); }
        catch (err) { ui.notifications.error(err.message); }
      }));
      section.querySelectorAll("[data-lists]").forEach((b) => b.addEventListener("click", async (ev) => {
        ev.preventDefault();
        b.disabled = true;
        try {
          const i = Number(b.dataset.i), s = specs[i];
          switch (b.dataset.lists) {
            case "openJournal": (await getJournal()).sheet.render(true); break;
            case "saveLibrary": if (await saveLibrary()) ui.notifications.info(`Saved your lists to Data/${libraryPath()}.`); break;
            case "loadLibrary": await loadLibrary(); app.render(); break;
            case "export": exportLists(); break;
            case "import": el("lists.importFile").click(); break;
            case "addRow": {
              const row = {};
              for (const c of s.cols) {
                const name = `ladd.${i}.${c.field}`;
                if (c.input?.type === "checks") row[c.field] = [...section.querySelectorAll(`input[name="${CSS.escape(name)}"]:checked`)].map((x) => x.value).join(", ");
                else row[c.field] = el(name)?.value ?? "";
              }
              const r = await addRow(s.module, s.key, row);
              // Clear the form for the next entry (the window keeps typed values across a redraw)
              for (const c of s.cols) {
                const name = `ladd.${i}.${c.field}`;
                if (c.input?.type === "checks") section.querySelectorAll(`input[name="${CSS.escape(name)}"]`).forEach((x) => { x.checked = false; });
                else if (el(name) && el(name).tagName !== "SELECT") el(name).value = c.input?.value ?? "";
              }
              ui.notifications.info(`Added "${r.name}" to ${s.page}.`);
              app.render();
              break;
            }
            case "disable": {
              const name = el(`loff.${i}.name`).value.trim();
              if (!name) throw new Error("Type the name of the entry to switch off.");
              await addRow(s.module, DISABLED, { name, list: el(`loff.${i}.list`).value });
              el(`loff.${i}.name`).value = "";
              ui.notifications.info(`Switched off "${name}".`);
              app.render();
              break;
            }
          }
        } catch (err) { console.error(`AxecleftTreasure | ${b.dataset.lists} failed`, err); ui.notifications.error(err.message); }
        finally { b.disabled = false; }
      }));
    },
  };

  const STYLE = `<style>
    #axecleft-treasure-generator { max-height: calc(100vh - 16px); }
    #axecleft-treasure-generator .window-content { overflow-y: auto; }
    .atg fieldset.atg-dest { margin-bottom: 0; }
    .atg .atg-footer.sticky { position: sticky; bottom: -1rem; z-index: 2; margin: 8px 0 0; padding: 6px 0 calc(1rem + 4px); background: var(--background, var(--color-cool-5, #1b1d24)); }
    .atg details.atg-sec { border: 1px solid var(--color-border-light-tertiary, #888); border-radius: 4px; margin: 8px 0 4px; padding: 2px 8px 4px; }
    .atg details.atg-sec > summary { cursor: pointer; font-weight: bold; padding: 2px 0; }
    .atg details.atg-sec > summary small { font-weight: normal; opacity: 0.8; }
    .atg nav.atg-tabs { display: flex; gap: 2px; border-bottom: 1px solid var(--color-border-light-tertiary, #999); margin-bottom: 8px; flex-wrap: wrap; position: sticky; top: -1rem; z-index: 3; margin-top: -1rem; padding-top: calc(1rem + 2px); background: var(--background, var(--color-cool-5, #1b1d24)); }
    .atg nav.atg-tabs button { flex: 1 1 auto; border-radius: 4px 4px 0 0; margin: 0; padding: 4px 6px; line-height: 1.4; white-space: nowrap; font-size: var(--font-size-13, 13px); }
    .atg nav.atg-tabs button.active { font-weight: bold; box-shadow: inset 0 -3px 0 var(--color-warm-1, #c9593f); }
    .atg section[data-tab] { display: none; } .atg section[data-tab].active { display: block; }
    .atg .form-group > label { flex: 0 0 9em; }
    .atg .form-group select, .atg .form-group input[type=text] { flex: 1; min-width: 0; }
    .atg .form-group input[type=number] { flex: 0 0 5em; }
    .atg .atg-checks { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
    .atg .atg-checks label { display: flex; gap: 4px; align-items: center; flex: none; }
    .atg .hint { font-size: 0.85em; opacity: 0.85; margin: 2px 0 6px; }
    .atg fieldset { margin: 8px 0 4px; padding: 4px 8px 6px; }
    .atg .atg-footer { display: flex; gap: 6px; margin-top: 8px; }
    .atg .atg-footer button { flex: 1; }
    .atg .atg-preview { min-height: 1.4em; font-size: 0.9em; opacity: 0.9; margin: 4px 0; }
    .atg .atg-ext-buttons { display: flex; gap: 4px; flex-wrap: wrap; margin: -4px 0 8px; }
    .atg .atg-ext-buttons button { flex: 1 1 auto; }
    .atg .atg-drop { border: 2px dashed var(--color-border-light-tertiary, #888); border-radius: 6px; padding: 6px; text-align: center; font-size: 0.9em; opacity: 0.85; margin: 4px 0; }
    .atg .atg-drop.over { border-color: var(--color-warm-1, #c9593f); opacity: 1; }
    .atg table.atg-sources td { padding: 1px 6px; } .atg .atg-ok { color: var(--color-level-success, #2a7d2a); } .atg .atg-no { opacity: 0.7; }
    .atg [disabled] { opacity: 0.55; }
    .atg table.atg-counts td { padding: 1px 6px; } .atg table.atg-counts td:first-child { padding-left: 0; }
    .atg .atg-chips { display: flex; flex-wrap: wrap; gap: 3px; margin: 4px 0; font-size: 0.9em; }
    .atg .atg-chip { border: 1px solid var(--color-border-light-tertiary, #888); border-radius: 10px; padding: 0 4px 0 7px; display: inline-flex; gap: 4px; align-items: center; }
    .atg .atg-chip a { cursor: pointer; opacity: 0.7; } .atg .atg-chip a:hover { opacity: 1; color: var(--color-warm-1, #c9593f); }
    .atg table.atg-gen-table { width: 100%; font-size: 0.9em; margin: 4px 0; } .atg table.atg-gen-table th { text-align: left; font-weight: normal; opacity: 0.8; }
    .atg table.atg-gen-table input[type=number], .atg .atg-gen input[type=number] { width: 3.6em; flex: 0 0 3.6em; }
    .atg .atg-cb { display: inline-flex; gap: 3px; align-items: center; }
  </style>`;

  /** The hub's own tab: the SRD Treasure table by encounter level. */
  /** The Coins fieldset: pay each SRD coin as itself or as another (standard or custom) currency. */
  function coinSection() {
    const cur = currencies(), cfg = coinSettings();
    const choices = (k) => {
      const std = cur.std.map((c) => opt(c.key, `${c.name}${c.name !== c.id ? ` (${c.id})` : ""}${c.key === `std:${k}` ? " (as rolled)" : ` (${c.value} gp)`}`, cfg.map[k])).join("");
      const groups = [...new Set(cur.custom.map((c) => c.group))];
      const custom = groups.map((g) => `<optgroup label="${esc(g || "Custom currencies")}">${cur.custom.filter((c) => c.group === g)
        .map((c) => opt(c.key, `${c.name} (${c.value > 0 ? `${c.value} gp` : "no gp value set"})`, cfg.map[k])).join("")}</optgroup>`).join("");
      return `<optgroup label="Standard coins">${std}</optgroup>${custom}`;
    };
    const rows = STD.slice().reverse().map((k) => `<div class="form-group"><label>Pay ${esc(cur.name(k))}${cur.name(k) !== k ? ` (${k})` : ""} as</label><select name="coin.${k}" data-coin="${k}">${choices(k)}</select></div>`).join("");
    const changed = STD.filter((k) => cfg.map[k] !== `std:${k}`).map((k) => `${cur.name(k)} as ${cur.byKey(cfg.map[k])?.name ?? "?"}`);
    const note = [changed.length ? changed.join(", ") : "paid as rolled", cfg.purse === "altCurrency" ? "weightless" : ""].filter(Boolean).join("; ");
    return `<details class="atg-sec atg-coins" data-sec="coins" ${recall("sec.coins", "0") === "1" ? "open" : ""}><summary>Coins <small>(${esc(note)})</small></summary>
      <p class="hint">The SRD rolls copper, silver, gold and platinum. Pay each as itself or as any other currency, including D35E custom currencies${cur.custom.length ? ` (${cur.custom.length} set up in this world)` : " (none set up in this world; add them in D35E's Currency Configuration)"}. Amounts convert by gp value; anything that doesn't make a whole coin is paid as change in standard coins. These choices are saved for this world.</p>
      ${rows}
      <div class="form-group"><label>Standard coins go</label><select name="coin.purse">${opt("currency", "In the carried purse", cfg.purse)}${opt("altCurrency", "In the weightless coins", cfg.purse)}</select></div>
      <div class="atg-preview" data-preview="coins"></div></details>`;
  }

  const LEVEL_TAB = {
    module: null, name: "treasure", title: "Treasure by Level", icon: "fas fa-sack-dollar", order: 500, id: "t-treasure-level",
    content() {
      const status = (cats) => {
        const ps = [...new Set(cats.map((c) => providerFor(c)?.label).filter(Boolean))];
        const missing = cats.filter((c) => !providerFor(c));
        return ps.length && !missing.length ? `<span class="atg-ok">✔ ${esc(ps.join(", "))}</span>`
          : ps.length ? `<span class="atg-ok">✔ ${esc(ps.join(", "))}</span> <span class="atg-no">(rest listed in chat)</span>`
          : `<span class="atg-no">✘ needs ${esc(CATEGORIES[cats[0]].module)}; listed in chat</span>`;
      };
      const groups = [
        ["Coins", null], ["Gems and art objects", ["gem", "art"]], ["Alchemical items, tools and gear", ["mundane:alchemical", "mundane:gear"]], ["Poisons (Generation settings)", ["mundane:poison"]],
        ["Weapons, armor and shields", ["mundane:weapon", "mundane:armor", "magic:weapon", "magic:armor"]],
        ["Potions, rings, rods, scrolls, staffs, wands, wondrous items", ["magic:potion", "magic:ring", "magic:rod", "magic:scroll", "magic:staff", "magic:wand", "magic:wondrous"]],
      ];
      return `<p class="hint">Rolls the SRD Treasure table for an encounter level: coins, goods (gems, art) and items (mundane, minor, medium, major). Each part comes from the module that makes it; anything without its module is listed in the chat card for you to handle.</p>
        <div class="form-group"><label>Encounter Level</label><select name="lvl.level">${Array.from({ length: 30 }, (_, i) => opt(i + 1, i < 20 ? `EL ${i + 1}` : `EL ${i + 1} (EL 20 + ${EXTRA_MAJOR[i - 20]} major item${i > 20 ? "s" : ""})`)).join("")}</select></div>
        <div class="form-group"><label>Roll</label><div class="atg-checks">
          <label><input type="checkbox" name="lvl.coins" checked> Coins</label><label><input type="checkbox" name="lvl.goods" checked> Goods</label><label><input type="checkbox" name="lvl.items" checked> Items</label></div></div>
        <div class="form-group"><label>Treasure rolls</label><input type="number" name="lvl.count" value="1" min="1" max="10" step="1"><span class="hint" style="flex:1">for each target</span></div>
        <div class="atg-preview" data-preview="lvl"></div>
        <table class="atg-sources">${groups.map(([l, cats]) => `<tr><td>${esc(l)}</td><td>${cats ? status(cats) : '<span class="atg-ok">✔ built in (paid as set below)</span>'}</td></tr>`).join("")}</table>
        ${coinSection()}
        ${generationSection()}`;
    },
    wire(section) {
      const form = section.closest("form");
      const show = () => {
        const lvSel = Number(form.elements["lvl.level"].value) || 1;
        const row = LEVELS[Math.min(20, lvSel) - 1];
        const fmt = (rows, what) => rows.filter((r) => r[2] !== "nothing").map((r) => `${r[0]}–${r[1]} ${diceText(r[3])} ${what(r[2])}`).join(", ");
        const ru = rules();
        const extra = lvSel > 20 ? ` Plus ${EXTRA_MAJOR[lvSel - 21]} extra major item${lvSel > 21 ? "s" : ""} (DMG, EL 21+)${ru.epic ? `, ${ru.epicShare ?? 25}% of them epic` : " (turn on Epic items for epic ones)"}.` : "";
        section.querySelector("[data-preview=lvl]").innerHTML = esc(`${lvSel > 20 ? "EL 20 row. " : ""}Coins: ${fmt(row.coins, (t) => t)}. Goods: ${fmt(row.goods, (t) => t)}. Items: ${fmt(row.items, (t) => t)}.${extra}`);
      };
      form.elements["lvl.level"].addEventListener("change", show);
      show();
      const coinPreview = () => {
        const cfg = { map: Object.fromEntries(STD.map((k) => [k, form.elements[`coin.${k}`]?.value || `std:${k}`])), purse: form.elements["coin.purse"]?.value || "currency" };
        const ex = convertCoins({ gp: 1234, sp: 56, cp: 78 }, cfg);
        const p = section.querySelector("[data-preview=coins]");
        if (p) p.textContent = `Example: 1,234 gp + 56 sp + 78 cp is paid as ${ex.text}.`;
        return cfg;
      };
      section.querySelectorAll("select[data-coin], select[name='coin.purse']").forEach((sel) => sel.addEventListener("change", () => saveCoinSettings(coinPreview())));
      // Generation settings: saved on every change
      const gen = section.querySelector(".atg-gen");
      if (gen) {
        let tmo = null;
        const save = () => { clearTimeout(tmo); tmo = null; pendingGen = null; return saveGeneration(readGenerationForm(gen)); };
        // Save as you type (not only when a field loses focus), and flush a pending save when the window closes
        gen.querySelectorAll("[name^='gen.']").forEach((x) => {
          for (const ev of ["input", "change"]) x.addEventListener(ev, () => { clearTimeout(tmo); pendingGen = save; tmo = setTimeout(save, 300); });
        });
        gen.querySelector("[data-gen-reset]")?.addEventListener("click", async (ev) => {
          ev.preventDefault();
          clearTimeout(tmo); pendingGen = null;
          await resetGeneration();
          ui.notifications.info("Generation settings reset to the defaults.");
          api.refresh();
        });
      }
      section.querySelectorAll("details.atg-sec").forEach((d) => d.addEventListener("toggle", () => { remember(`sec.${d.dataset.sec}`, d.open ? "1" : "0"); api.refreshSize?.(); }));
      coinPreview();
    },
    generate: null, // handled by the hub (see #generate)
  };

  /** Token Loot tab (version 9.7): each NPC token's own treasure by its CR. */
  const LOOT_TAB = {
    module: null, name: "loot", title: "Token Loot", icon: "fas fa-sack-dollar", order: 510, id: "t-token-loot",
    content() {
      const s = lootSettings();
      const cb = (k, label) => `<label class="atg-cb"><input type="checkbox" name="loot.${k}" ${s[k] ? "checked" : ""}> ${esc(label)}</label>`;
      const sel = (canvas?.tokens?.controlled ?? []).map((t) => t.document);
      const pctText = (a) => { const p = treasurePct(a); return p.coins === p.goods && p.goods === p.items ? ({ 0: "none", 100: "standard", 200: "double", 300: "triple" }[p.coins] ?? `${p.coins}%`) : `coins ${p.coins}%, goods ${p.goods}%, items ${p.items}%`; };
      const crText = (cr) => (cr > 0 && cr < 1 ? `1/${Math.round(1 / cr)}` : String(cr));
      const rows = sel.map((t) => {
        const why = lootProblem(t);
        const rec = lootRecord(t);
        return `<tr><td>${esc(t.name)}${t.actorLink ? "" : " <small>(unlinked)</small>"}</td><td>${["npc", "trap"].includes(t.actor?.type) ? `CR ${esc(crText(crOf(t.actor)))}` : "—"}</td><td>${t.actor?.type === "npc" ? esc(pctText(t.actor)) : t.actor?.type === "trap" ? `trap, ×${esc({ 0.25: "¼", 0.5: "½", 0.75: "¾", 1: "1" }[s.trapShare] ?? s.trapShare)}` : "—"}</td>
          <td>${why ? `<span class="atg-no">${esc(why)}</span>` : rec ? '<span class="atg-ok">has loot</span>' : ""}</td></tr>`;
      }).join("");
      return `<p class="hint">Each token gets its own roll on the SRD Treasure table, at its Challenge Rating (SRD: a lone creature's treasure uses its CR as the encounter level), scaled by the <strong>Treasure</strong> setting on its NPC sheet (D35E: None, Standard, Double, Triple or a % for coins, goods and items). Items go into that token's inventory with their value rolled, and coins into its purse, ready to loot. An unlinked token keeps its loot on that one creature; a linked token's loot goes on its actor.</p>
        <fieldset><legend>Selected tokens</legend>
          ${sel.length ? `<table class="atg-sources"><thead><tr><th>Token</th><th>CR</th><th>Treasure</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="hint">No tokens selected. Select NPC tokens on the scene, then press <em>Refresh</em> or the buttons below.</p>'}
          <div class="atg-footer"><button type="button" data-loot="refresh"><i class="fas fa-rotate"></i> Refresh</button><button type="button" data-loot="clear"><i class="fas fa-eraser"></i> Clear Loot</button><button type="button" data-loot="roll" class="bright"><i class="fas fa-dice-d20"></i> Roll Loot for Selected Tokens</button></div>
          <div class="form-group"><label>Roll</label><div class="atg-checks">${cb("coins", "Coins")}${cb("goods", "Goods")}${cb("items", "Items")}</div></div>
          <div class="atg-checks">${cb("replace", "Replace loot rolled before (its items and coins are taken back first)")}</div>
          <div class="form-group"><label>Trap loot</label><select name="loot.trapShare">${[[0.25, "¼ of a creature's treasure"], [0.5, "½"], [0.75, "¾"], [1, "The full treasure for its CR"]].map(([v, l]) => opt(v, l, s.trapShare)).join("")}</select></div>
          <p class="hint">Traps can get incidental loot too (bones and belongings of earlier victims): select trap tokens and roll. Rolled at the trap's CR, scaled by this share; never automatic.</p>
          <p class="hint">Clear Loot removes only what the Treasure Generator put on the token: its marked items and the coins it added. The same roll is on the token toolbar (<i class="fas fa-sack-dollar"></i>).</p>
        </fieldset>
        <fieldset><legend>Automatic loot</legend>
          <div class="atg-checks">${cb("auto", "Roll loot when an unlinked NPC token is placed on a scene")}</div>
          <div class="atg-checks">${cb("chat", "Post a chat card (GM only) for each token's loot")}${cb("hidden", "Hidden tokens too")}</div>
          <p class="hint">Only unlinked NPC tokens (never traps), never characters or tokens a player owns, and never a token that already has loot (a copied token keeps the loot it was copied with). Saved for this world.</p>
        </fieldset>
        <p class="hint">CR below 1: EL 1, with each part's chance scaled by the CR (CR 1/2 rolls half the time). CR 21–30: EL 21–30 (the EL 20 row plus extra major items, some of them epic while Epic items is on); above 30, EL 30. NPCs with class levels carry NPC gear in the SRD instead of treasure; set their Treasure to None if you equip them by hand. Parts and sources follow the Treasure by Level tab (coins paid as set there, Generation settings for light, poisons and the rest).</p>`;
    },
    wire(section, app) {
      const read = () => { const g = generation(); g.loot = { ...lootSettings() }; section.querySelectorAll("[name^='loot.']").forEach((x) => { g.loot[x.name.slice(5)] = x.type === "checkbox" ? x.checked : Number(x.value) || x.value; }); return g; };
      section.querySelectorAll("[name^='loot.']").forEach((x) => x.addEventListener("change", () => saveGeneration(read())));
      section.querySelectorAll("[data-loot]").forEach((b) => b.addEventListener("click", async (ev) => {
        ev.preventDefault();
        b.disabled = true;
        try {
          if (b.dataset.loot === "roll") { await saveGeneration(read()); await lootTokens(null, { auto: false }); }
          if (b.dataset.loot === "clear") await clearLootTokens();
        } catch (err) { console.error("AxecleftTreasure | token loot failed", err); ui.notifications.error(err.message); }
        finally { b.disabled = false; app.render(); }
      }));
    },
  };

  class TreasureGenerator extends foundry.applications.api.ApplicationV2 {
    static DEFAULT_OPTIONS = {
      id: "axecleft-treasure-generator",
      classes: ["axecleft-treasure-generator"],
      window: { title: "Treasure Generator", icon: "fas fa-gem", resizable: true },
      position: { width: 600, height: "auto" },
    };

    tab = recall("tab", null);
    values = null;

    tabs() {
      return [...[...registry.tabs.values()].filter(isActive), LEVEL_TAB, LOOT_TAB, ...(activeLists().length ? [LISTS_TAB] : [])].sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
    }

    async _renderHTML() {
      const tabs = this.tabs();
      for (const t of tabs) { try { await t.prepare?.(this); } catch (err) { console.error(`AxecleftTreasure | ${t.module}.${t.name} prepare failed`, err); } }
      const sections = tabs.map((t) => {
        let body;
        try { body = t.content(this) ?? ""; } catch (err) { body = `<p class="hint">This tab failed to load: ${esc(err.message)}</p>`; console.error(`AxecleftTreasure | ${t.module}.${t.name}`, err); }
        return `<section data-tab="${t.id}">${body}</section>`;
      }).join("");
      const nav = `<nav class="atg-tabs">${tabs.map((t) => `<button type="button" data-tab-btn="${t.id}"><i class="${esc(t.icon)}"></i> ${esc(t.title)}</button>`).join("")}</nav>`;
      const buttons = [...registry.buttons.values()].filter(isActive);
      const extButtons = buttons.length ? `<div class="atg-ext-buttons">${buttons.map((b) => `<button type="button" data-ext-button="${esc(`${b.module}.${b.name}`)}" title="${esc(b.hint ?? "")}"><i class="${esc(b.icon)}"></i> ${esc(b.title)}</button>`).join("")}</div>` : "";

      const mode = recall("dest", "selected");
      const tokens = (canvas?.scene?.tokens?.contents ?? []).filter((t) => t.actor).sort((a, b) => a.name.localeCompare(b.name));
      const actors = [...(game.actors ?? [])].sort((a, b) => a.name.localeCompare(b.name));
      const actorOpts = opt("", "Choose an actor or token…")
        + (tokens.length ? `<optgroup label="Tokens on this scene">${tokens.map((t) => opt(t.uuid, `${t.name}${t.actorLink ? "" : " (unlinked token)"}`)).join("")}</optgroup>` : "")
        + (actors.length ? `<optgroup label="Actors">${actors.map((a) => opt(a.uuid, `${a.name} (${a.type})`)).join("")}</optgroup>` : "");
      const footer = `<fieldset class="atg-dest" data-gen><legend>Put items in</legend>
          <div class="form-group"><label>Destination</label><select name="dest.mode">
            ${opt("selected", "Selected tokens (each gets its own roll)", mode)}${opt("actor", "A chosen actor or token", mode)}
            ${opt("items", `Items sidebar ("${ITEM_FOLDER}" folder)`, mode)}${opt("chat", "Chat card only (create items later)", mode)}</select></div>
          <div class="form-group" data-dest="actor"><label>Actor or token</label><select name="dest.uuid">${actorOpts}</select></div>
          <div class="atg-drop" data-dest="actor"><i class="fas fa-hand-pointer"></i> Or drag an actor here from the Actors sidebar</div>
          <p class="hint" data-dest="selected actor">Items go straight into the inventory with their true value already rolled, ready for a loot sheet; coins go into the purse. An unlinked token keeps its loot on that one creature.</p>
          <p class="hint" data-dest="items chat">Items start unappraised; their true value is rolled when they are dropped onto a character.</p>
        </fieldset>
        <div class="atg-footer sticky" data-gen><button type="button" data-action="generate" class="bright"><i class="fas fa-dice-d20"></i> Generate</button></div>`;
      return `${STYLE}<form class="atg" autocomplete="off">${nav}${extButtons}${sections}${footer}</form>`;
    }

    _replaceHTML(result, content) {
      const old = content.querySelector("form.atg");
      if (old) this.values = [...new FormData(old).entries()].concat([...old.querySelectorAll("input[type=checkbox]")].map((c) => [`__cb_${c.name}`, c.checked]));
      content.innerHTML = result;
      this.#wire(content.querySelector("form.atg"));
    }

    /** Keep the window on screen: auto height, but never taller than the screen; the content scrolls. */
    #fitHeight() {
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
      this.#fitHeight();
    }

    /** Save Generation settings typed just before closing. */
    async close(options) {
      if (pendingGen) { try { await pendingGen(); } catch (e) { /* reported by saveGeneration */ } }
      return super.close(options);
    }

    #restore(form, selectsOnly = false) {
      // World settings (Coins, Generation settings) always show what is saved, never what was typed before a redraw
      const saved = (k) => /^(__cb_)?(gen|coin)\./.test(k);
      for (const [k, v] of this.values ?? []) {
        if (saved(k)) continue;
        if (k.startsWith("__cb_")) { if (selectsOnly) continue; const c = form.querySelector(`input[type=checkbox][name="${CSS.escape(k.slice(5))}"]`); if (c && !c.disabled) c.checked = v; continue; }
        const el = form.elements[k];
        if (!el || el.type === "file" || el.type === "checkbox" || (selectsOnly && el.tagName !== "SELECT")) continue;
        if (el.tagName === "SELECT" && ![...el.options].some((o) => o.value === v)) continue;
        el.value = v;
      }
    }

    #wire(form) {
      if (!form) return;
      const el = (n) => form.elements[n];
      this.#restore(form);
      const tabs = this.tabs();
      const showTab = (id) => {
        const t = tabs.find((x) => x.id === id) ?? tabs[0];
        this.tab = t.id; remember("tab", t.id);
        form.querySelectorAll("[data-tab-btn]").forEach((b) => b.classList.toggle("active", b.dataset.tabBtn === t.id));
        form.querySelectorAll("section[data-tab]").forEach((s) => s.classList.toggle("active", s.dataset.tab === t.id));
        const gen = t === LEVEL_TAB || typeof t.generate === "function";
        form.querySelectorAll("[data-gen]").forEach((g) => { g.style.display = gen ? "" : "none"; });
        this.#fitHeight();
      };
      form.querySelectorAll("[data-tab-btn]").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tabBtn)));

      for (const t of tabs) {
        const sec = form.querySelector(`section[data-tab="${t.id}"]`);
        try { t.wire?.(sec, this); } catch (err) { console.error(`AxecleftTreasure | ${t.module}.${t.name} wire failed`, err); }
      }
      enhanceDatalists(form); // version 9.6: scrolling searchable lists
      this.#restore(form, true);
      form.dispatchEvent(new Event("change"));

      // Destination
      const showDest = () => {
        const m = el("dest.mode").value;
        remember("dest", m);
        form.querySelectorAll("[data-dest]").forEach((d) => { d.style.display = d.dataset.dest.split(" ").includes(m) ? "" : "none"; });
        this.#fitHeight();
      };
      el("dest.mode").addEventListener("change", showDest);
      const drop = form.querySelector(".atg-drop");
      form.addEventListener("dragover", (ev) => { ev.preventDefault(); drop.classList.add("over"); });
      form.addEventListener("dragleave", () => drop.classList.remove("over"));
      form.addEventListener("drop", async (ev) => {
        ev.preventDefault();
        drop.classList.remove("over");
        let data;
        try { data = JSON.parse(ev.dataTransfer.getData("text/plain")); } catch (e) { return; }
        if (!data?.uuid || !["Actor", "Token"].includes(data.type)) return ui.notifications.warn("Drop an actor from the Actors sidebar.");
        const doc = await fromUuid(data.uuid);
        if (!doc) return;
        const sel = el("dest.uuid");
        if (![...sel.options].some((o) => o.value === doc.uuid)) sel.insertAdjacentHTML("beforeend", opt(doc.uuid, doc.name));
        sel.value = doc.uuid;
        el("dest.mode").value = "actor";
        showDest();
      });

      form.querySelectorAll("[data-ext-button]").forEach((b) => b.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const def = registry.buttons.get(b.dataset.extButton);
        try { await def?.onClick?.(this); } catch (err) { console.error(`AxecleftTreasure | ${b.dataset.extButton} failed`, err); ui.notifications.error(`${def.title} failed: ${err.message}`); }
      }));
      form.querySelector("[data-action=generate]").addEventListener("click", async (ev) => {
        ev.preventDefault();
        const btn = ev.currentTarget;
        btn.disabled = true;
        try { await this.#generate(form); }
        catch (err) { console.error("AxecleftTreasure | generate failed", err); ui.notifications.error(err.message); }
        finally { btn.disabled = false; }
      });

      showDest();
      showTab(this.tab);
    }

    async #generate(form) {
      const v = (n) => form.elements[n]?.value || null;
      const mode = v("dest.mode") ?? "items";
      if (mode === "actor" && !v("dest.uuid")) throw new Error("Choose an actor or token (or drag one onto the window).");
      const dest = mode === "actor" ? { mode, uuid: v("dest.uuid") } : mode;
      const t = this.tabs().find((x) => x.id === this.tab);
      if (t === LEVEL_TAB) {
        const cb = (n) => !!form.elements[n]?.checked;
        return generateTreasure({ level: Number(v("lvl.level")), times: v("lvl.count"), dest, coins: cb("lvl.coins"), goods: cb("lvl.goods"), items: cb("lvl.items"), form });
      }
      if (typeof t?.generate !== "function") return;
      const section = form.querySelector(`section[data-tab="${t.id}"]`);
      const title = t.generateTitle?.(form) ?? t.title;
      return runGeneration({ title, dest, rollFor: (actor) => t.generate(form, { actor, section, app: this }) });
    }
  }

  let APP = existing?._app ?? null;
  function open(tab = null) {
    if (!game.user.isGM) return ui.notifications.warn("Only the GM can generate treasure.");
    if (!(APP instanceof TreasureGenerator)) APP = new TreasureGenerator();
    api._app = APP;
    if (tab) APP.tab = tab;
    return APP.render(true);
  }

  /* ------------------------------------------ */
  /*  API and hooks                             */
  /* ------------------------------------------ */

  const api = {
    version: AXECLEFT_TREASURE_VERSION, registry, hosts, CATEGORIES,
    open, registerTab, registerButton, registerProvider, providerFor, currencies, convertCoins, coinSettings,
    runGeneration, generateTreasure, rollTreasure, rollCreationChanges, resolveDestination,
    // Version 9.7: token loot by CR
    lootToken, lootTokens, clearLoot, clearLootTokens, crOf, treasurePct,
    /** One item (or a placeholder) for a category from whichever provider supplies it; used by the Merchant Generator. */
    rollCategory: (category, ctx = {}) => fromCategory(category, ctx),
    hasProvider: (category, hints = null) => !!providerFor(category, hints),
    /** Every source that can supply a category (labels), e.g. ["Axecleft's Gemstones", "Item compendiums"]. */
    sourcesFor: (category) => providersFor(category).map((p) => p.label),
    listItemPacks, itemSources, setItemSources, scanCompendiums, classifyItem, isDisease,
    // Version 9: extra source kinds, price corrections, generation settings
    registerSourceKind, sourceKinds, kindSources, setKindSources, kindItems,
    registerPriceCorrections, priceCorrections, correctionFor, correctedPrice, applyPriceCorrection, priceCheck, exportPriceCheck,
    generation, saveGeneration, resetGeneration, genChance, GEN_DEFAULTS, GEN_CATS,
    // Version 9.5: campaign switches and epic/psionic item marks
    rules, registerItemMarks, isEpicItem, isPsionicItem, allowedByRules,
    enhanceDatalists,
    tagSuggestions, applyShopTags, readShopTags, writeShopTags, TAG_LABELS, SHOP_HINTS: HINTS,
    get compendiumStats() { return compStats; },
    // Shared custom lists
    registerList, customList, listRows, disabledEntries, JOURNAL_NAME,
    get LISTS() { return activeLists(); },
    lists: { getJournal, findJournal, readAll, readModule, addRow, removeRow, writeLists, saveLibrary, loadLibrary, readLibrary, exportLists, importLists,
      libraryPath, librarySync, parseTable, tableHtml, normalizeRow, mergeRows, fileModules },
    _startLists: startLists, _onListPage: onListPage,
    rollDice,
    refresh() { if (APP?.rendered) APP.render(); },
    refreshSize() { if (APP?.rendered) APP._onRender?.({}, {}); },
    _onInit() {
      registerCoinSetting();
      registerLibrarySettings();
      registerGenerationSetting();
      registerList({
        module: CORR_MOD, key: "prices", page: "Price Corrections", label: "Price correction", order: 900,
        intro: "Fix the price of compendium items without editing the compendium. <strong>Compendium</strong> is the compendium id (for example D35E.magicitems); leave it blank for any compendium. Corrections apply to generated treasure and merchant stock; an item whose compendium price already matches is left alone. Built-in corrections come from Axecleft's modules (switch one off on the Disabled Entries page).",
        cols: [["name", "Item"], ["pack", "Compendium", { type: "text", placeholder: "blank: any compendium" }], ["price", "Price (gp)", { type: "number", value: 0, min: 0, step: 0.01 }], ["note", "Note"]],
        builtin: () => [...registry.corrections.values()].flat().map((c) => ({ name: c.name, pack: c.pack ?? "", price: c.price, note: c.note ?? "" })),
      });
      // Shared lists: build or migrate the journal and sync the library once the world is ready; save after the GM edits a list page.
      Hooks.once("ready", async () => { try { await globalThis.AxecleftTreasure._startLists(); } catch (err) { console.error("AxecleftTreasure | Treasure Lists start-up failed", err); } });
      for (const h of ["createJournalEntryPage", "updateJournalEntryPage", "deleteJournalEntryPage"]) {
        Hooks.on(h, (page, ...rest) => globalThis.AxecleftTreasure._onListPage(page, rest[rest.length - 1]));
      }
      try {
        const ns = coinNamespace ?? "world";
        if (!game.settings.settings?.has?.(`${ns}.${SOURCES_KEY}`)) game.settings.register(ns, SOURCES_KEY, { scope: "world", config: false, type: Object, default: { mode: "auto", packs: [] } });
      } catch (e) { console.warn("AxecleftTreasure | could not register the item sources setting", e); }
      Hooks.once("ready", () => { if (game.user.isGM) globalThis.AxecleftTreasure.scanCompendiums?.(); });
      // Rescan shortly after items in a chosen compendium are added, changed or removed.
      let t = null;
      const changed = (doc) => {
        if (!game.user.isGM || !doc?.pack || !itemSources().packs.includes(doc.pack)) return;
        clearTimeout(t); t = setTimeout(() => globalThis.AxecleftTreasure.scanCompendiums?.(), 2000);
      };
      for (const h of ["createItem", "updateItem", "deleteItem"]) Hooks.on(h, changed);
      // Token loot (version 9.7): automatic loot for new unlinked NPC tokens, and a token toolbar button
      Hooks.on("createToken", (doc, options) => globalThis.AxecleftTreasure._onCreateToken?.(doc, options));
      Hooks.on("getSceneControlButtons", (controls) => globalThis.AxecleftTreasure._onSceneControls?.(controls));
      let ct = null; // keep the Token Loot tab's list of selected tokens current
      Hooks.on("controlToken", () => { clearTimeout(ct); ct = setTimeout(() => { const app = globalThis.AxecleftTreasure._app; if (app?.rendered && app.tab === "t-token-loot") app.render(); }, 150); });
      Hooks.callAll("axecleftTreasure.ready", api);
      const h = host();
      globalThis.AxecleftTools?.register({
        module: h ?? "axecleft-treasure", name: "treasure-generator", title: "Treasure Generator", icon: "fas fa-gem",
        hint: "Generate treasure: coins, gems, art, jewelry and items", gmOnly: true, onClick: () => globalThis.AxecleftTreasure.open(),
      });
    },
    _onChat: onChat,
    _onCreateToken: onCreateToken, _onSceneControls: onSceneControls,
    _onItemDirectory(app, html) {
      if (!game.user.isGM) return;
      const root = html instanceof HTMLElement ? html : html?.[0] ?? app.element;
      if (!root || root.querySelector(".atg-open")) return;
      const target = root.querySelector(".header-actions") ?? root.querySelector(".directory-header");
      if (!target) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "atg-open";
      btn.innerHTML = '<i class="fas fa-gem"></i> Treasure';
      btn.addEventListener("click", (ev) => { ev.preventDefault(); globalThis.AxecleftTreasure.open(); });
      target.append(btn);
    },
  };
  globalThis.AxecleftTreasure = api;

  // Hooks are added once (by the first copy) and always call the newest copy.
  if (!existing && globalThis.Hooks) {
    Hooks.once("init", () => globalThis.AxecleftTreasure._onInit());
    Hooks.on("renderChatMessageHTML", (m, h) => globalThis.AxecleftTreasure._onChat(m, h));
    Hooks.on("renderItemDirectory", (a, h) => globalThis.AxecleftTreasure._onItemDirectory(a, h));
  }
})();
