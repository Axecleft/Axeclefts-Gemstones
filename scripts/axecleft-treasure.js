/**
 * Axecleft's Treasure Generator — shared hub, version 9.97.
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
 *   T.generation()              // the world's Generation Settings (light, intelligence, hints, poisons, curses)
 *   T.curse(entry, category, ctx, { force })  // curse a generated item by the SRD tables (version 9.96)
 *   T.rules()                   // the world's campaign switches: { psionics, epic } (version 9.5)
 *   T.registerItemMarks({ module, epic: [names], psionic: [names] })   // mark compendium items as epic or psionic
 *   T.enhanceDatalists(root)    // searchable lists that scroll and stay on screen (version 9.6)
 *   T.lootTokens(tokens?, opts) // each NPC token's own SRD treasure by its CR (version 9.7); T.clearLoot(tokens?)
 *
 * Register at load time (top level of your script). See README "For module authors".
 */
const AXECLEFT_TREASURE_VERSION = 9.994; // 9.994: a share of treasure and merchant stock from your Item compendiums (Generation settings), Treasure weight tags; 9.993: Generation settings: Sizes of arms, Poisons and Cursed items start with their checkbox, like the other rows; 9.992: a list's note can be built when shown (Gemstones' value levels), column help as tooltips on the Lists tab; 9.991: numbers right-aligned in their boxes; Treasure Lists pages in the world's language (rewritten when it changes), a line per column, an example row and a warning to keep the headings; 9.99: Item Sources show the items found in each compendium of an extra source kind (enhancements, materials, spells…); 9.98: a cursed item's eerie light only while the curse is active (D35E sheet animations); 9.97: custom curses (Treasure Lists); 9.96: cursed items (SRD tables, Generation settings, Forge/Workshop option); 9.94: text in the world's language (Axecleft's Tools 8.2 language files); 9.95: Foundry v11 (Tools 9 window, chat), no intelligent items before D35E 3.1
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

  const ITEM_FOLDER = /*t*/"Generated Treasure";
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
    gem: { label: /*t*/"Gem", module: /*t*/"Axecleft's Gemstones" },
    art: { label: /*t*/"Art object", module: /*t*/"Axecleft's Gemstones" },
    "mundane:alchemical": { label: /*t*/"Alchemical item", module: /*t*/"built in (D35E items)" },
    "mundane:armor": { label: /*t*/"Masterwork armor or shield", module: /*t*/"Axecleft's Armory" },
    "mundane:weapon": { label: /*t*/"Masterwork weapon", module: /*t*/"Axecleft's Armory" },
    "mundane:gear": { label: /*t*/"Tools and gear", module: /*t*/"built in (D35E items)" },
    "mundane:poison": { label: /*t*/"Poison", module: /*t*/"item compendiums (Axecleft's Traps, Poisons, and Diseases)" },
    "magic:armor": { label: /*t*/"armor or shield", magic: true, module: /*t*/"Axecleft's Armory" },
    "magic:weapon": { label: /*t*/"weapon", magic: true, module: /*t*/"Axecleft's Armory" },
    "magic:potion": { graded: true, label: /*t*/"potion", module: /*t*/"Axecleft's Curios" },
    "magic:ring": { graded: true, label: /*t*/"ring", module: /*t*/"Axecleft's Curios" },
    "magic:rod": { graded: true, label: /*t*/"rod", module: /*t*/"Axecleft's Curios" },
    "magic:scroll": { graded: true, label: /*t*/"scroll", module: /*t*/"Axecleft's Curios" },
    "magic:staff": { graded: true, label: /*t*/"staff", module: /*t*/"Axecleft's Curios" },
    "magic:wand": { graded: true, label: /*t*/"wand", module: /*t*/"Axecleft's Curios" },
    "magic:wondrous": { graded: true, label: /*t*/"wondrous item", module: /*t*/"Axecleft's Curios" },
    // Merchant stock (not on the SRD Treasure table): ordinary arms and armor
    "standard:weapon": { label: /*t*/"Weapon", module: /*t*/"item compendiums" },
    "standard:armor": { label: /*t*/"Armor", module: /*t*/"item compendiums" },
    "standard:shield": { label: /*t*/"Shield", module: /*t*/"item compendiums" },
    "standard:ammo": { label: /*t*/"Ammunition", module: /*t*/"item compendiums" },
  };

  /* ------------------------------------------ */
  /*  Small helpers                             */
  /* ------------------------------------------ */

  const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const opt = (v, label, sel) => `<option value="${esc(v)}"${String(v) === String(sel ?? "") ? " selected" : ""}>${esc(label)}</option>`;
  // Text in the world's language (Axecleft's Tools 8.2 language files), else the English
  const t = (s, d) => globalThis.AxecleftTools?.t?.(s, d) ?? (d ? String(s).replace(/\{(\w+)\}/g, (m, k) => d[k] ?? m) : String(s));
  const locale = () => { const l = globalThis.AxecleftTools?.i18n?.lang; return l && l !== "en" ? l : "en-US"; };
  const num = (n) => Number(n).toLocaleString(locale());
  const gp = (n) => t("{n} gp", { n: num(Math.round(n * 100) / 100) });
  /** A category's label in the world's language. */
  const catLabel = (c) => (CATEGORIES[c]?.label ? t(CATEGORIES[c].label) : c);
  const d100 = () => 1 + Math.floor(Math.random() * 100);
  const inRange = (rows, r) => rows.find((x) => r >= x[0] && r <= x[1]);
  const diceText = (d) => (d === "1d1" ? "1" : d.replace(/\*/g, " × "));
  function rollDice(formula) {
    const expr = String(formula).replace(/\s+/g, "").replace(/(\d*)d(\d+)/gi, (_, n, s) => {
      let t = 0; for (let i = 0; i < (+n || 1); i++) t += 1 + Math.floor(Math.random() * +s); return String(t);
    });
    if (!/^[\d+\-*/().]+$/.test(expr)) throw new Error(t("Can't roll \"{formula}\"", { formula }));
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
    const fmt = num;
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
  const GEN_CATS = [["melee", /*t*/"Magic melee weapons"], ["ranged", /*t*/"Magic ranged weapons"], ["armor", /*t*/"Magic armor and shields"], ["other", /*t*/"Other permanent magic items"]];
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
    // Cursed items (version 9.96): a flat rate, or a rate by grade (the SRD gives no frequency)
    curse: { enabled: true, method: "flat", flat: 1, minor: 3, medium: 2, major: 1, merchants: false, specific: true, mechanics: true },
    size: { enabled: true, small: 30, medium: 60, large: 10 },
    // Version 9.994: how much treasure and merchant stock comes from the GM's Item compendiums where a module also supplies the category
    sources: { enabled: true, treasure: 0, merchants: 50 },
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
    catch (e) { console.error("AxecleftTreasure | could not save the generation settings", e); ui.notifications.error(t("Could not save the generation settings.")); }
  }
  const resetGeneration = () => saveGeneration({});
  /** The world's campaign switches: { psionics: true|false, epic: true|false }. */
  const rules = () => ({ psionics: true, epic: false, epicShare: 25, ...(generation().rules ?? {}) });

  /** Roll whether a random item gets an extra: genChance("light", "melee") is true about 30% of the time by default. */
  function genChance(kind, cat = null) {
    if (kind === "intelligence" && globalThis.AxecleftTools?.intelligentItems?.() === false) return false; // D35E before 3.1.0: no intelligent items
    const g = generation()[kind];
    if (!g?.enabled) return false;
    const c = cat ? g[cat] : g;
    if (!c || c.on === false) return false;
    return Math.random() * 100 < (Number(c.chance) || 0);
  }

  /* ------------------------------------------ */
  /*  Cursed items (version 9.96)               */
  /* ------------------------------------------ */

  /*
   * SRD "Cursed Items": a random magic item can be cursed (any magic item: arms, armor, rings, rods, staffs,
   * wondrous items, potions, scrolls, wands, psionic, epic and intelligent items). The SRD gives no frequency, so the
   * chance is a Generation setting: a flat rate (1% by default) or a rate by grade (minor 3%, medium 2%, major 1%).
   * The curse is rolled on the SRD tables (common curses, intermittent functioning, dependent situations, drawbacks,
   * specific cursed items; cursed psionic items for psionic items). The item gets D35E's own "Cursed" mark
   * (players see nothing until the GM ticks "Curse Identified" or "Curse Active"), the curse is kept in
   * flags.world.axecleftCurse and shown to the GM on the item sheet, and simple effects are applied as D35E data:
   * reversed bonuses on arms and armor become penalties, reversed item changes are negated, a delusion item loses
   * its magic, blurred vision and a subversive psionic item get their penalties. A cursed item that sheds light
   * glows with an eerie light instead while the curse is active (9.98). Ticking "Curse Identified" adds the curse to the item's description.
   */
  const CURSE_FLAG = "axecleftCurse";
  const CURSE_GRADES = ["minor", "medium", "major", "epic"];
  const COMMON_CURSES = [[1, 15, "delusion"], [16, 35, "reversed"], [36, 45, "intermittent"], [46, 60, "requirement"], [61, 75, "drawback"], [76, 90, "different"], [91, 100, "specific"]];
  const PSIONIC_CURSES = [[1, 33, "backfire"], [34, 66, "exhausting"], [67, 100, "subversive"]];
  const CURSE_LABELS = {
    delusion: /*t*/"Delusion", reversed: /*t*/"Opposite effect or target", intermittent: /*t*/"Intermittent functioning",
    requirement: /*t*/"Requirement", drawback: /*t*/"Drawback", different: /*t*/"Completely different effect", specific: /*t*/"Specific cursed item",
    backfire: /*t*/"Backfire (psionic)", exhausting: /*t*/"Exhausting (psionic)", subversive: /*t*/"Subversive (psionic)",
  };
  const CURSE_TEXT = {
    delusion: /*t*/"Delusion: the user believes the item is what it seems, but it has no magical power beyond the deception. The user can't be convinced otherwise without remove curse.",
    reversed: /*t*/"Opposite effect or target: the item does the reverse of what it should, or targets its user instead of others. Once this is known the item can be discarded, unless a compulsion keeps the user from it (remove curse).",
    requirement: /*t*/"Requirement: the item works only while the user meets a condition the GM chooses (the SRD says never to roll it). Examples: eat or sleep twice as much; sacrifice valuables or magic items each week; swear fealty to a noble or a deity; take a new name; discard all other magic items; finish a quest. If the requirement isn't met, the item stops working until it is.",
    different: /*t*/"Completely different effect: the item does something else entirely. It actually works as {item}.",
    differentNone: /*t*/"Completely different effect: the item does something else entirely, of the GM's choosing.",
    backfire: /*t*/"Backfire: whenever the item's power is used, it affects the user instead of the intended target.",
    exhausting: /*t*/"Exhausting: each time the item's power is used, it drains power points from the user as well.",
    subversive: /*t*/"Subversive: the item imposes a constant –2 penalty on its wearer's saving throws, which may go unnoticed for some time.",
  };
  /*t*/"unreliable"; /*t*/"dependent"; /*t*/"uncontrolled"; // the kinds of intermittent functioning, shown in summaries
  const INTERMITTENT = [
    ["unreliable", /*t*/"Intermittent functioning (unreliable): each time the item is activated there is a 5% chance (01–05 on d%) that it doesn't work."],
    ["dependent", /*t*/"Intermittent functioning (dependent): the item works only in a certain situation: {situation}."],
    ["uncontrolled", /*t*/"Intermittent functioning (uncontrolled): the item activates on its own. Roll d% each day: on 01–05 it activates at a random moment that day."],
  ];
  const DEPENDENT = [
    [1, 3, /*t*/"below freezing"], [4, 5, /*t*/"above freezing"], [6, 10, /*t*/"during the day"], [11, 15, /*t*/"during the night"],
    [16, 20, /*t*/"in direct sunlight"], [21, 25, /*t*/"out of direct sunlight"], [26, 34, /*t*/"underwater"], [35, 37, /*t*/"out of water"],
    [38, 45, /*t*/"underground"], [46, 55, /*t*/"aboveground"], [56, 60, /*t*/"within 10 feet of a creature of a type the GM chooses"],
    [61, 64, /*t*/"within 10 feet of a creature of a race or kind the GM chooses"], [65, 72, /*t*/"within 10 feet of an arcane spellcaster"],
    [73, 80, /*t*/"within 10 feet of a divine spellcaster"], [81, 85, /*t*/"in the hands of a nonspellcaster"], [86, 90, /*t*/"in the hands of a spellcaster"],
    [91, 95, /*t*/"in the hands of a creature of an alignment the GM chooses"], [96, 96, /*t*/"in the hands of a creature of a gender the GM chooses"],
    [97, 99, /*t*/"on nonholy days or during particular astrological events"], [100, 100, /*t*/"more than 100 miles from a particular site"],
  ];
  // Drawbacks: [low, high, short name (the buff's name), text, D35E changes (as a buff on the holder) or null]
  const NEG = (n) => [[`-${n}`, "attack", "attack", "penalty"], [`-${n}`, "savingThrows", "allSavingThrows", "penalty"], [`-${n}`, "skills", "skills", "penalty"], [`-${n}`, "abilityChecks", "allChecks", "penalty"], [`-${5 * n}`, "misc", "mhp", "penalty"]];
  const DRAWBACKS = [
    [1, 4, /*t*/"Growing hair", /*t*/"The user's hair grows 1 inch longer (once only).", null],
    [5, 9, /*t*/"Changing height", /*t*/"The user shrinks or grows 1/2 inch (once only; 50% chance of each).", null],
    [10, 13, /*t*/"Chill", /*t*/"The temperature around the item is 10° F cooler than normal.", null],
    [14, 17, /*t*/"Warmth", /*t*/"The temperature around the item is 10° F warmer than normal.", null],
    [18, 21, /*t*/"Hair color", /*t*/"The user's hair color changes.", null],
    [22, 25, /*t*/"Skin color", /*t*/"The user's skin color changes.", null],
    [26, 29, /*t*/"Identifying mark", /*t*/"The user bears an identifying mark (tattoo, weird glow, or the like).", null],
    [30, 32, /*t*/"Gender change", /*t*/"The user's gender changes.", null],
    [33, 34, /*t*/"Race change", /*t*/"The user's race or kind changes.", null],
    [35, 35, /*t*/"Incurable disease", /*t*/"The user is afflicted with a random disease that can't be cured.", null],
    [36, 39, /*t*/"Disturbing sound", /*t*/"The item continually emits a disturbing sound (moaning, weeping, screaming, cursing, insults).", null],
    [40, 40, /*t*/"Ridiculous look", /*t*/"The item looks ridiculous (garishly colored, silly shape, glows bright pink…).", null],
    [41, 45, /*t*/"Possessiveness", /*t*/"The user becomes selfishly possessive of the item.", null],
    [46, 49, /*t*/"Paranoia", /*t*/"The user becomes paranoid about losing the item and afraid of damage to it.", null],
    [50, 51, /*t*/"Alignment change", /*t*/"The user's alignment changes.", null],
    [52, 54, /*t*/"Compulsive attacks", /*t*/"The user must attack the nearest creature (5% chance, 01–05 on d%, each day).", null],
    [55, 57, /*t*/"Stunning", /*t*/"The user is stunned for 1d4 rounds once the item's function is finished (or at random once per day).", null],
    [58, 60, /*t*/"Blurred vision", /*t*/"The user's vision is blurry (–2 penalty on attack rolls, saves and skill checks requiring vision).", [["-2", "attack", "attack", "penalty"], ["-2", "savingThrows", "allSavingThrows", "penalty"], ["-2", "skill", "skill.spt", "penalty"], ["-2", "skill", "skill.src", "penalty"]]],
    [61, 64, /*t*/"One negative level", /*t*/"The user gains one negative level (–1 on attacks, saves, skill and ability checks; –5 hit points; –1 effective level).", NEG(1)],
    [65, 65, /*t*/"Two negative levels", /*t*/"The user gains two negative levels (–2 on attacks, saves, skill and ability checks; –10 hit points; –2 effective levels).", NEG(2)],
    [66, 70, /*t*/"Intelligence drain", /*t*/"The user must make a Will save each day or take 1 point of Intelligence damage.", null],
    [71, 75, /*t*/"Wisdom drain", /*t*/"The user must make a Will save each day or take 1 point of Wisdom damage.", null],
    [76, 80, /*t*/"Charisma drain", /*t*/"The user must make a Will save each day or take 1 point of Charisma damage.", null],
    [81, 85, /*t*/"Constitution drain", /*t*/"The user must make a Fortitude save each day or take 1 point of Constitution damage.", null],
    [86, 90, /*t*/"Strength drain", /*t*/"The user must make a Fortitude save each day or take 1 point of Strength damage.", null],
    [91, 95, /*t*/"Dexterity drain", /*t*/"The user must make a Fortitude save each day or take 1 point of Dexterity damage.", null],
    [96, 96, /*t*/"Polymorph", /*t*/"The user is polymorphed into a specific creature (5% chance, 01–05 on d%, each day).", null],
    [97, 97, /*t*/"No arcane spells", /*t*/"The user can't cast arcane spells.", null],
    [98, 98, /*t*/"No divine spells", /*t*/"The user can't cast divine spells.", null],
    [99, 99, /*t*/"No spells", /*t*/"The user can't cast any spells.", null],
    [100, 100, /*t*/"GM's drawback", /*t*/"A drawback the GM chooses or creates, suited to the item.", null],
  ];
  // Specific cursed items (SRD table): [low, high, name in D35E's magic item compendium, SRD price]
  const SPECIFIC_CURSED = [
    [1, 5, "Incense of Obsession", 200], [6, 15, "Ring of Clumsiness", 500], [16, 20, "Amulet of Inescapable Location", 1000],
    [21, 25, "Stone of Weight (Loadstone)", 1000], [26, 30, "Bracers of Defenselessness", 1200], [31, 35, "Gauntlets of Fumbling", 1300],
    [36, 40, "-2 Sword, Cursed", 1500], [41, 43, "Armor of Rage", 1600], [44, 46, "Medallion of Thought Projection", 1800],
    [47, 52, "Flask of Curses", 2100], [53, 54, "Dust of Sneezing and Choking", 2400], [55, 55, "Helm of Opposite Alignment", 4000],
    [56, 60, "Potion of Poison", 5000], [61, 61, "Broom of Animated Attack", 5200], [62, 63, "Robe of Powerlessness", 5500],
    [64, 64, "Vacuous Grimoire", 6000], [65, 68, "Spear, Cursed Backbiter", 7500], [69, 70, "Armor of Arrow Attraction", 9000],
    [71, 72, "Net of Snaring", 10000], [73, 75, "Bag of Devouring", null], [76, 80, "Mace of Blood", 16000], [81, 85, "Robe of Vermin", 16500],
    [86, 88, "Periapt of Foul Rotting", 17000], [89, 92, "Sword, Berserking", 17500], [93, 96, "Boots of Dancing", 30000],
    [97, 97, "Crystal Hypnosis Ball", null], [98, 98, "Necklace of Strangulation", 60000], [99, 99, "Cloak of Poisonousness", 62000], [100, 100, "Scarab of Death", 80000],
  ];
  /**
   * Eerie light for cursed items that shed light (9.98: only while the curse is active; animations from D35E's item
   * sheet list, so saving the sheet keeps them; all in Foundry v11 to v14).
   */
  const CURSED_LIGHTS = [
    { color: "#7fd13b", type: "ghost", speed: 2, intensity: 4 },      // sickly green, drifting
    { color: "#6a2c91", type: "emanation", speed: 3, intensity: 5 },  // bruised violet, seeping
    { color: "#9b1c1c", type: "pulse", speed: 2, intensity: 4 },      // blood red, slow throb
    { color: "#4f6b3a", type: "fog", speed: 2, intensity: 5 },        // murky, smoky
    { color: "#b38bd9", type: "hexa", speed: 4, intensity: 5 },       // pale witch-light
    { color: "#3fbfa5", type: "fog", speed: 1, intensity: 6 },        // corpse-light fog
  ];
  const pickCursedLight = () => ({ ...CURSED_LIGHTS[Math.floor(Math.random() * CURSED_LIGHTS.length)] });
  const LIGHT_KEYS = ["color", "type", "animationSpeed", "animationIntensity", "alpha"];
  /** Curse Active on/off: an item that sheds light swaps its own light for the curse's eerie light, and back. */
  async function curseLightUpdate(item, c, active) {
    const light = item.system?.light ?? {};
    if (active) {
      if (!light.emitLight || c.normalLight) return;
      const L = c.eerie ?? ((Number(c.version) || 0) >= 9.98 ? pickCursedLight() : null); // older items got it when made
      if (!L) return;
      const normal = Object.fromEntries(LIGHT_KEYS.map((k) => [k, light[k] ?? null]));
      await item.update({ "system.light.color": L.color, "system.light.type": L.type, "system.light.animationSpeed": L.speed,
        "system.light.animationIntensity": L.intensity, "system.light.alpha": Math.max(0.5, Number(light.alpha) || 0.5),
        [`flags.world.${CURSE_FLAG}.normalLight`]: normal, [`flags.world.${CURSE_FLAG}.eerie`]: L });
    } else if (c.normalLight) {
      const back = Object.fromEntries(LIGHT_KEYS.filter((k) => c.normalLight[k] !== null && c.normalLight[k] !== undefined).map((k) => [`system.light.${k}`, c.normalLight[k]]));
      await item.update({ ...back, [`flags.world.${CURSE_FLAG}.normalLight`]: null });
    }
  }
  const CURSE_GEN_DEFAULTS = { enabled: true, method: "flat", flat: 1, minor: 3, medium: 2, major: 1, merchants: false, specific: true, mechanics: true };

  const curseSettings = () => ({ ...CURSE_GEN_DEFAULTS, ...(generation().curse ?? {}) });
  /** This roll's chance (%) of a curse, or 0: ctx { grade, merchant, curse: false }. */
  function curseChance(category, ctx = {}) {
    if (ctx.curse === false || !String(category ?? "").startsWith("magic:")) return 0;
    const c = curseSettings();
    if (!c.enabled || (ctx.merchant && !c.merchants)) return 0;
    const grade = CURSE_GRADES.includes(ctx.grade) ? ctx.grade : null;
    if (!grade) return 0; // mundane rolls
    if (c.method === "grade") return Number(c[grade === "epic" ? "major" : grade]) || 0;
    return Number(c.flat) || 0;
  }
  /** A specific cursed item from D35E's magic item compendium (Babele-translated names too), or null. */
  async function specificCursed(name) {
    const d35e = game.packs.get("D35E.magicitems") ?? game.packs.get("D35E.magic-items") ?? game.packs.find((p) => (p.metadata?.packageName ?? p.metadata?.system) === "D35E" && /magic.?items/i.test(p.metadata?.name ?? ""));
    // D35E's magic items first, then the world's item sources (custom specific cursed items), then the Items sidebar
    let sources = [];
    try { sources = itemSources().packs ?? []; } catch (e) { /* none */ }
    const packs = [d35e, ...sources.map((id) => game.packs.get(id))].filter((p, i, a) => p && a.indexOf(p) === i);
    const want = normKey(name);
    for (const pack of packs) {
      const idx = await pack.getIndex({ fields: ["flags.babele.originalName"] });
      // Babele translates compendium names: match the English name, Babele's original name, or Babele's translation of it
      const tr = game.babele?.packs?.get?.(pack.collection)?.translations?.[name]?.name;
      const hit = idx.find((e) => [e.originalName, e.flags?.babele?.originalName, e.name].some((n) => n && normKey(n) === want) || (tr && normKey(e.name) === normKey(tr)));
      if (hit) { const doc = await pack.getDocument(hit._id); return doc?.toObject?.() ?? null; }
    }
    const own = game.items?.find?.((i) => normKey(i.name) === want);
    return own?.toObject?.() ?? null;
  }
  /** The SRD's "–2 sword, cursed": a longsword that seems fine in practice but has a –2 penalty in real combat (Armory). */
  async function cursedSword() {
    const armory = game.modules.get("axeclefts-armory");
    if (!armory?.active || !armory.api?.build) return null;
    const b = await armory.api.build({ base: { name: "Longsword" }, masterwork: true });
    const data = b?.data;
    if (!data) return null;
    data.name = t("–2 Sword, Cursed");
    foundry.utils.setProperty(data, "flags.world.axecleftEn", "-2 Sword, Cursed");
    foundry.utils.setProperty(data, "system.enh", -2);
    foundry.utils.setProperty(data, "system.price", 1500);
    return data;
  }

  /*
   * Custom curses (version 9.97): the "Custom Curses" page of the Treasure Lists journal. Every SRD table row is a
   * built-in row (switch it off on the Disabled Entries page); the GM's rows join the tables with their own weight.
   * Tables: common (a curse of its own, among delusion, opposite effect…), drawback, situation (a dependent situation
   * for intermittent functioning), psionic (a cursed psionic item's curse), specific (an item from the item compendiums).
   * Weight is the row's share of the d% table, as the SRD's rows have (01–05 = 5). Kinds limit which items can get it.
   * Penalties (for the curse buff) are written "-2 attack; -2 saves; -1 str; -4 spot; -5 hp".
   */
  const CURSE_TABLES = [["common", /*t*/"Curse (common curses table)"], ["drawback", /*t*/"Drawback"], ["situation", /*t*/"Dependent situation (intermittent)"], ["psionic", /*t*/"Cursed psionic item"], ["specific", /*t*/"Specific cursed item"]];
  const CURSE_KINDS = [["arms", /*t*/"Arms and armor"], ["ring", /*t*/"Rings"], ["rod", /*t*/"Rods"], ["staff", /*t*/"Staffs"], ["wondrous", /*t*/"Wondrous items"], ["potion", /*t*/"Potions"], ["scroll", /*t*/"Scrolls"], ["wand", /*t*/"Wands"]];
  const kindOfCategory = (cat) => ({ "magic:weapon": "arms", "magic:armor": "arms", "magic:ring": "ring", "magic:rod": "rod", "magic:staff": "staff", "magic:wondrous": "wondrous", "magic:potion": "potion", "magic:scroll": "scroll", "magic:wand": "wand" })[cat] ?? null;
  const SKILL_KEYS = { appraise: "apr", balance: "blc", bluff: "blf", climb: "clm", concentration: "coc", craft: "crf", "decipher script": "dsc", diplomacy: "dip", "disable device": "dev", disguise: "dis",
    "escape artist": "esc", forgery: "fog", "gather information": "gif", "handle animal": "han", heal: "hea", hide: "hid", intimidate: "int", jump: "jmp", listen: "lis", "move silently": "mos", "open lock": "opl",
    perform: "prf", profession: "pro", ride: "rid", search: "src", "sense motive": "sen", "sleight of hand": "slt", spellcraft: "spl", spot: "spt", survival: "sur", swim: "swm", tumble: "tmb", "use magic device": "umd" };
  const PENALTY_TARGETS = {
    attack: ["attack", "attack"], attacks: ["attack", "attack"], melee: ["attack", "mattack"], ranged: ["attack", "rattack"], damage: ["damage", "damage"],
    ac: ["ac", "ac"], saves: ["savingThrows", "allSavingThrows"], save: ["savingThrows", "allSavingThrows"], fort: ["savingThrows", "fort"], fortitude: ["savingThrows", "fort"],
    ref: ["savingThrows", "ref"], reflex: ["savingThrows", "ref"], will: ["savingThrows", "will"], checks: ["abilityChecks", "allChecks"], skills: ["skills", "skills"],
    hp: ["misc", "mhp"], init: ["misc", "init"], initiative: ["misc", "init"], speed: ["speed", "allSpeeds"],
    str: ["ability", "str"], dex: ["ability", "dex"], con: ["ability", "con"], int: ["ability", "int"], wis: ["ability", "wis"], cha: ["ability", "cha"],
    strength: ["ability", "str"], dexterity: ["ability", "dex"], constitution: ["ability", "con"], intelligence: ["ability", "int"], wisdom: ["ability", "wis"], charisma: ["ability", "cha"],
  };
  /** "-2 attack; -2 saves; -1 str; -4 spot; -5 hp" → { changes: D35E changes, bad: [parts not understood] }. */
  function parsePenalties(text) {
    const changes = [], bad = [];
    for (const part of String(text ?? "").split(/[;,\n]/).map((x) => x.trim()).filter(Boolean)) {
      const m = part.match(/^([+-−–]?\s*\d+(?:\.\d+)?)\s+(.+)$/);
      if (!m) { bad.push(part); continue; }
      const n = m[1].replace(/[−–]/, "-").replace(/\s+/g, "");
      const what = m[2].toLowerCase().replace(/\s+/g, " ").replace(/^skill:\s*/, "skill:");
      const type = Number(n) < 0 ? "penalty" : "untyped";
      if (PENALTY_TARGETS[what]) changes.push([n, ...PENALTY_TARGETS[what], type]);
      else if (SKILL_KEYS[what]) changes.push([n, "skill", `skill.${SKILL_KEYS[what]}`, type]);
      else if (/^skill:[a-z]{3}$/.test(what)) changes.push([n, "skill", `skill.${what.slice(6)}`, type]);
      else bad.push(part);
    }
    return { changes, bad };
  }
  /** D35E changes back to "-2 attack; -2 saves" (for the list page). */
  function penaltyText(changes) {
    const names = Object.fromEntries(Object.entries(PENALTY_TARGETS).reverse().map(([k, v]) => [v.join("|"), k]));
    const skills = Object.fromEntries(Object.entries(SKILL_KEYS).map(([k, v]) => [v, k]));
    return (changes ?? []).map(([f, tg, st]) => `${f} ${names[`${tg}|${st}`] ?? (tg === "skill" ? skills[String(st).replace("skill.", "")] ?? st : `${tg}:${st}`)}`).join("; ");
  }
  /** The SRD tables as rows of the Custom Curses list (built-in rows). */
  function builtinCurseRows() {
    const w = (lo, hi) => hi - lo + 1;
    return [
      ...COMMON_CURSES.map(([lo, hi, key]) => ({ name: CURSE_LABELS[key], table: "common", weight: w(lo, hi), kinds: [], text: key === "specific" ? "" : (CURSE_TEXT[key === "different" ? "differentNone" : key] ?? ""), penalties: "", key })),
      ...DRAWBACKS.map(([lo, hi, short, text, changes]) => ({ name: short, table: "drawback", weight: w(lo, hi), kinds: [], text, penalties: penaltyText(changes), changes, key: "drawback" })),
      ...DEPENDENT.map(([lo, hi, sit]) => ({ name: sit, table: "situation", weight: w(lo, hi), kinds: [], text: "", penalties: "", key: "situation" })),
      ...PSIONIC_CURSES.map(([lo, hi, key]) => ({ name: CURSE_LABELS[key], table: "psionic", weight: w(lo, hi), kinds: [], text: CURSE_TEXT[key], penalties: key === "subversive" ? "-2 saves" : "", changes: key === "subversive" ? [["-2", "savingThrows", "allSavingThrows", "penalty"]] : null, key })),
      ...SPECIFIC_CURSED.map(([lo, hi, name, price]) => ({ name, table: "specific", weight: w(lo, hi), kinds: [], text: "", penalties: "", price, key: "specific" })),
    ];
  }
  /** A table's rows (built-in minus switched off, plus the GM's), for an item category. */
  function curseRows(table, category = null) {
    let rows;
    try { rows = registry.lists.has(`${CORR_MOD}|curses`) ? customList(CORR_MOD, "curses") : builtinCurseRows(); } catch (e) { rows = builtinCurseRows(); }
    const kind = kindOfCategory(category);
    return rows.filter((r) => r.table === table && (Number(r.weight) || 0) > 0 && (!kind || !r.kinds?.length || r.kinds.includes(kind)));
  }
  /** A select or checks option's key from its key, its English label or its label in the world's language (list pages show labels). */
  const optionKey = (opts, v) => {
    const x = String(v ?? "").trim().toLowerCase();
    if (!x) return null;
    return opts.find(([k, l]) => k === x || String(l).toLowerCase() === x || String(t(l)).toLowerCase() === x)?.[0] ?? null;
  };
  const pickWeighted = (rows) => {
    const total = rows.reduce((a, r) => a + (Number(r.weight) || 0), 0);
    if (!(total > 0)) return null;
    let x = Math.random() * total;
    for (const r of rows) { x -= Number(r.weight) || 0; if (x < 0) return r; }
    return rows.at(-1);
  };
  /** The curse a custom row makes (or a built-in row's own curse). */
  const rowChanges = (r) => (r.source === "custom" ? parsePenalties(r.penalties).changes : (r.changes ?? parsePenalties(r.penalties).changes));

  /**
   * Roll a curse on the SRD tables for an item: { key, label, text, changes, light, specific?, item? }.
   * opts.type: a curse type instead of a roll ("delusion", "reversed", …, "specific"); opts.psionic: use the psionic table.
   */
  async function rollCurse(data, { type = null, category = null, ctx = {}, psionic = null } = {}) {
    const psi = psionic ?? isPsionicItem(data);
    const rolls = [];
    let row = null, key = type;
    if (key?.startsWith?.("custom:")) { row = curseRows("common").concat(curseRows("psionic")).find((r) => r.name === key.slice(7)) ?? null; key = row?.key ?? "custom"; }
    else if (!key) {
      // Psionic items: the cursed psionic item table or the common curses (even odds); the common curses otherwise
      const tbl = psi && Math.random() < 0.5 && curseRows("psionic", category).length ? "psionic" : "common";
      const rows = curseRows(tbl, category).filter((r) => !(r.key === "specific" && curseSettings().specific === false));
      row = pickWeighted(rows);
      key = row ? (row.source === "custom" ? "custom" : row.key) : "requirement";
    }
    const out = { key, label: row && key === "custom" ? row.name : (CURSE_LABELS[key] ?? key), rolls, changes: null, text: "" };
    if (key === "custom") {
      out.text = `${row?.name ?? t("Curse")}: ${row?.text ?? ""}`.trim();
      out.changes = row ? rowChanges(row) : null;
      out.custom = row?.name ?? null;
    } else if (key === "intermittent") {
      const [sub, text] = INTERMITTENT[Math.floor(Math.random() * INTERMITTENT.length)]; // the SRD lists the three kinds without odds: equal chances
      out.sub = sub;
      const sitRow = sub === "dependent" ? pickWeighted(curseRows("situation", category)) : null;
      if (sub === "dependent" && !sitRow) { out.sub = "unreliable"; out.text = t(INTERMITTENT[0][1]); }
      else {
        out.situation = sitRow?.name ?? null;
        const sitText = sitRow ? (sitRow.source === "custom" ? (sitRow.text || sitRow.name) : t(sitRow.name)) : null;
        out.text = sitText ? t(text, { situation: sitText }) : t(text);
      }
    } else if (key === "drawback") {
      const d = pickWeighted(curseRows("drawback", category));
      out.sub = d?.name ?? null;
      out.text = d ? `${t("Drawback:")} ${d.source === "custom" ? d.text : t(d.text)}` : t(DRAWBACKS.at(-1)[3]);
      out.changes = d ? rowChanges(d) : null;
    } else if (key === "different") {
      let other = null;
      if (category) { try { other = (await fromCategory(category, { ...ctx, curse: false })).find((e) => e.data && !e.placeholder); } catch (e) { /* none */ } }
      out.other = other?.name ?? null;
      out.text = other ? t(CURSE_TEXT.different, { item: other.name }) : t(CURSE_TEXT.differentNone);
    } else if (key === "subversive") {
      out.text = t(CURSE_TEXT.subversive);
      out.changes = [["-2", "savingThrows", "allSavingThrows", "penalty"]];
    } else if (key === "specific") {
      const sp = pickWeighted(curseRows("specific", category)) ?? { name: SPECIFIC_CURSED[0][2], price: SPECIFIC_CURSED[0][3] };
      out.specific = sp.name; out.price = sp.source === "custom" ? null : sp.price;
      out.text = t("Replaced by a specific cursed item from the SRD: {item}.", { item: sp.name });
    } else out.text = CURSE_TEXT[key] ? t(CURSE_TEXT[key]) : "";
    return out;
  }

  /** Make item data cursed (in place) with a rolled curse; returns the curse. opts.mechanics: apply simple effects. */
  function curseData(data, curse, { mechanics = curseSettings().mechanics } = {}) {
    const s = data.system ??= {};
    s.cursed = true; s.identifiedCurse = false; s.curseActive = false;
    const applied = [];
    if (mechanics) {
      if (curse.key === "reversed") {
        if (data.type === "weapon" && Number(s.enh) > 0) { s.enh = -Number(s.enh); applied.push(t("enhancement bonus reversed to {n}", { n: s.enh })); }
        else if (Number(s.armor?.enh) > 0) { s.armor.enh = -Number(s.armor.enh); applied.push(t("enhancement bonus reversed to {n}", { n: s.armor.enh })); }
        const ch = Array.isArray(s.changes) ? s.changes : [];
        let n = 0;
        s.changes = ch.map((c) => { if (!Array.isArray(c) || !String(c[0] ?? "").trim() || c[3] === "penalty") return c; n++; return [`-(${c[0]})`, ...c.slice(1)]; });
        if (n) applied.push(t("{n} item changes reversed", { n }));
      } else if (curse.key === "delusion") {
        if (data.type === "weapon" && s.enh) { s.enh = 0; applied.push(t("no enhancement bonus")); }
        if (s.armor?.enh) { s.armor.enh = 0; applied.push(t("no enhancement bonus")); }
        if (s.enhancements?.items?.length) { s.enhancements.items = []; applied.push(t("no special abilities")); }
        if (Array.isArray(s.changes) && s.changes.length) { s.changes = []; applied.push(t("no item changes")); }
      }
      if (curse.changes?.length) applied.push(t("penalties on the curse buff"));
    }
    // A cursed item that sheds light glows with an eerie light, but only once the curse is active (9.98): until then
    // its light is its own, so the light doesn't give the curse away
    const eerie = pickCursedLight();
    if (s.light?.emitLight) { curse.light = eerie.type; applied.push(t("eerie light while the curse is active")); }
    curse.applied = applied;
    const html = `<p><strong>${esc(t("Curse:"))}</strong> ${esc(curse.text)}${applied.length ? ` <em>(${esc(applied.join("; "))})</em>` : ""}</p>`;
    foundry.utils.setProperty(data, `flags.world.${CURSE_FLAG}`, { key: curse.key, sub: curse.sub ?? null, situation: curse.situation ?? null, custom: curse.custom ?? null, ref: curseRef(curse), label: curse.label, text: curse.text, eerie,
      changes: mechanics && curse.changes?.length ? curse.changes.map((c) => [...c]) : [], applied, html, revealed: false, version: AXECLEFT_TREASURE_VERSION });
    return curse;
  }

  /**
   * Curse a generated entry ({ name, data, summary }) or not, by the Generation settings; returns the entry (or the
   * specific cursed item that replaces it). opts.force: a curse type (or "random") from the Forge/Workshop.
   */
  async function maybeCurse(entry, category, ctx = {}, { force = null } = {}) {
    if (!entry?.data || entry.placeholder) return entry;
    if (!force) {
      const pct = curseChance(category, ctx);
      if (!(pct > 0) || Math.random() * 100 >= pct) return entry;
    }
    const curse = await rollCurse(entry.data, { type: force && force !== "random" ? force : null, category, ctx });
    let out = entry;
    if (curse.key === "specific") {
      const data = curse.specific === "-2 Sword, Cursed" ? await cursedSword() : await specificCursed(curse.specific);
      if (data) {
        if (curse.price != null) foundry.utils.setProperty(data, "system.price", curse.price);
        if (entry.data.system?.identified === false) foundry.utils.setProperty(data, "system.identified", false);
        out = { ...entry, name: data.name, data, price: Number(data.system?.price) || entry.price, summary: t("specific cursed item (SRD), {price}", { price: gp(Number(data.system?.price) || 0) }) };
      } else {
        // Not in the compendiums (or no Armory for the sword): a drawback on the rolled item instead
        Object.assign(curse, await rollCurse(entry.data, { type: "drawback" }));
      }
    }
    curseData(out.data, curse);
    // The curse's buff (Common Buffs compendium) linked in the identified description, for the GM to apply
    const link = await curseBuffLink(curseRef(curse)).catch(() => "");
    if (link) {
      const d = out.data.system.description ??= {};
      d.value = `${d.value ?? ""}<p><strong>${esc(t("Curse:"))}</strong> ${link}</p>`;
      foundry.utils.setProperty(out.data, `flags.world.${CURSE_FLAG}.link`, link);
    }
    out.cursed = curse.key;
    out.summary = `${out.summary ? `${out.summary}; ` : ""}${t("CURSED: {curse}", { curse: t(curse.label) })}${curse.sub ? ` (${t(curse.sub)})` : ""}`;
    return out;
  }

  /** GM-only: the curse at the top of the item sheet; "Curse Identified" adds it to the description. */
  function onItemSheetCurse(app, html) {
    if (!game.user?.isGM) return;
    const item = app?.document ?? app?.item ?? app?.object;
    const c = item?.flags?.world?.[CURSE_FLAG];
    if (!c?.html) return;
    const root = html instanceof HTMLElement ? html : html?.[0];
    const form = root?.querySelector?.("form") ?? root;
    if (!form || form.querySelector(".axecleft-curse")) return;
    const box = document.createElement("div");
    box.className = "axecleft-curse";
    box.style.cssText = "margin:4px 8px;padding:4px 8px;border:1px solid #9b1c1c;border-radius:4px;background:rgba(155,28,28,0.12);font-size:12px";
    box.innerHTML = `<i class="fas fa-skull"></i> <small>${esc(t("GM only"))}</small> ${c.html}${c.link ? `<p>${esc(t("Buff:"))} ${c.link.replace(/@UUID\[([^\]]+)\]\{([^}]*)\}/, (m, u, n) => `<a class="content-link" draggable="true" data-uuid="${u}" data-link><i class="fas fa-suitcase"></i>${esc(n)}</a>`)}</p>` : ""}${item.system?.identifiedCurse ? "" : `<small>${esc(t("Tick \"Curse Identified\" to add the curse to the item's description for the players."))}</small>`}`;
    const anchor = form.querySelector(".sheet-header") ?? form.firstElementChild;
    anchor ? anchor.after(box) : form.prepend(box);
  }
  /** The category a made item would roll as (for "completely different effect"). */
  function curseCategoryOf(data) {
    const s = data?.system ?? {};
    if (data?.type === "weapon" || s.subType === "ammo") return "magic:weapon";
    if (data?.type === "equipment" && ["armor", "shield"].includes(s.equipmentType)) return "magic:armor";
    if (data?.type === "consumable") return { potion: "magic:potion", scroll: "magic:scroll", wand: "magic:wand", tattoo: "magic:potion", powerstone: "magic:scroll", dorje: "magic:wand" }[s.consumableType] ?? "magic:potion";
    if (s.slot === "ring") return "magic:ring";
    if (/\bstaff\b/i.test(data?.flags?.world?.axecleftEn ?? data?.name ?? "")) return "magic:staff";
    if (/\brod\b/i.test(data?.flags?.world?.axecleftEn ?? data?.name ?? "")) return "magic:rod";
    return "magic:wondrous";
  }
  /** The "Cursed" row for crafting tabs (Forge, Workshop): No, a random curse, or a curse type. */
  function curseField(name, value = "none") {
    let mine = [];
    try { mine = curseRows("common").concat(curseRows("psionic")).filter((r) => r.source === "custom").map((r) => [`custom:${r.name}`, r.name]); } catch (e) { /* none */ }
    const opts = [["none", /*t*/"No"], ["random", /*t*/"Random curse (SRD tables)"], ...["delusion", "reversed", "intermittent", "requirement", "drawback", "different", "specific"].map((k) => [k, CURSE_LABELS[k]]), ...mine];
    return `<div class="form-group"><label>${esc(t("Cursed"))}</label><select name="${name}">${opts.map(([v, l]) => `<option value="${esc(v)}" ${v === value ? "selected" : ""}>${esc(v.startsWith("custom:") ? l : t(l))}</option>`).join("")}</select><span class="hint" style="flex:1">${esc(t("SRD cursed items; the GM sees the curse on the item sheet"))}</span></div>`;
  }
  /** Curse made entries by a crafting tab's "Cursed" choice ("none" leaves them alone). */
  async function curseEntries(entries, force = "none") {
    if (!force || force === "none") return entries;
    const out = [];
    for (const e of entries) out.push(e?.data && !e.placeholder ? await maybeCurse(e, curseCategoryOf(e.data), {}, { force }) : e);
    return out;
  }
  const curseWriter = () => { const gm = game.users?.activeGM ?? game.users?.find((u) => u.isGM && u.active); return gm?.id === game.user?.id; }; // one GM writes
  const CURSE_BUFF = "axecleftCurseBuff";
  const CURSE_IMG = "icons/svg/skull.svg";
  /** A D35E buff for a curse: its penalties as changes, its text as the description. */
  function curseBuffData({ name, text, changes = [], html = null, key = null, item = null, ref = null, group = null }) {
    return {
      name, type: "buff", img: CURSE_IMG,
      system: { buffType: "item", active: !!item, changes: (changes ?? []).map((c) => [...c]), description: { value: html ?? `<p>${esc(text)}</p>` } },
      flags: { world: { [CURSE_BUFF]: { key, item, ref, group } } },
    };
  }
  /** A curse's buff reference: "drawback/Blurred vision", "intermittent/underwater", "delusion" (English, stable across languages). */
  function curseRef(c) {
    if (c.key === "drawback") return c.sub ? `drawback/${c.sub}` : null;
    if (c.key === "intermittent") return c.sub === "dependent" ? (c.situation ? `intermittent/${c.situation}` : null) : `intermittent/${c.sub}`;
    if (c.key === "custom") return c.custom ? `custom/${c.custom}` : null;
    return ["delusion", "reversed", "requirement", "different", "backfire", "exhausting", "subversive"].includes(c.key) ? c.key : null;
  }
  /** The compendiums with curse buffs: Curios' "Common Buffs", then the GM's own "Axecleft's Curses". */
  const CURSE_PACKS = ["axeclefts-curios.common-buffs", "world.axecleft-curses"];
  const curseIndex = new Map();
  /** "@UUID[Compendium.…]{Curse: …}" for a curse's buff, or "". */
  async function curseBuffLink(ref) {
    if (!ref) return "";
    for (const id of CURSE_PACKS) {
      const pack = game.packs?.get?.(id);
      if (!pack) continue;
      let idx = curseIndex.get(id);
      if (!idx) { idx = await pack.getIndex({ fields: [`flags.world.${CURSE_BUFF}`] }); curseIndex.set(id, idx); }
      const hit = idx.find((e) => e.flags?.world?.[CURSE_BUFF]?.ref === ref);
      if (hit) return `@UUID[Compendium.${pack.collection}.Item.${hit._id}]{${hit.name}}`;
    }
    return "";
  }
  /** The buff for a cursed item's curse, named after what the holder sees of the item. */
  function itemCurseBuff(item, c) {
    const shown = item.system?.identified === false ? (item.system?.unidentified?.name || item.name) : item.name;
    const what = c.key === "drawback" && c.sub ? t(c.sub) : t(c.label);
    return curseBuffData({ name: t("Curse: {curse} ({item})", { curse: what, item: shown }), text: c.text, html: c.html, changes: c.changes, key: c.key, item: item.id });
  }
  const curseBuffsOf = (item) => item?.actor?.items?.filter((i) => i.flags?.world?.[CURSE_BUFF]?.item === item.id) ?? [];
  async function onItemUpdateCurse(item, changes) {
    const c = item?.flags?.world?.[CURSE_FLAG];
    if (!c || !curseWriter()) return;
    // "Curse Identified": the curse goes into the item's description, for the players
    if (foundry.utils.getProperty(changes, "system.identifiedCurse") === true && c.html && !c.revealed) {
      const desc = String(item.system?.description?.value ?? "");
      await item.update({ "system.description.value": `${desc}<hr>${c.html}`, [`flags.world.${CURSE_FLAG}.revealed`]: true });
    }
    // "Curse Active" (D35E: the item can't be unequipped or dropped): the holder gets the curse as a buff
    const act = foundry.utils.getProperty(changes, "system.curseActive");
    if (act === undefined) return;
    try { await curseLightUpdate(item, c, !!act); } catch (e) { console.warn("AxecleftTreasure | cursed light", e); }
    if (!item.actor) return;
    const have = curseBuffsOf(item);
    if (act && !have.length) await item.actor.createEmbeddedDocuments("Item", [itemCurseBuff(item, c)]);
    else if (!act && have.length) await item.actor.deleteEmbeddedDocuments("Item", have.map((i) => i.id));
  }
  /** The item is gone (sold, destroyed, curse lifted by removing it): so is its curse buff. */
  async function onItemDeleteCurse(item) {
    if (!item?.actor || !item.flags?.world?.[CURSE_FLAG] || !curseWriter()) return;
    const have = curseBuffsOf(item).filter((i) => item.actor.items.has(i.id));
    if (have.length) await item.actor.deleteEmbeddedDocuments("Item", have.map((i) => i.id));
  }

  /** Every curse in the SRD tables as a buff, for the "Axecleft's Curses" compendium (GM's own use: drag onto a character). */
  function allCurseBuffs() {
    const out = [];
    const add = (group, ref, curse, detail, text, changes = null) => out.push(curseBuffData({ name: detail ? t("Curse: {curse} – {detail}", { curse: t(curse), detail }) : t("Curse: {curse}", { curse: t(curse) }), text, changes, ref, group, key: ref.split("/")[0] }));
    for (const k of ["delusion", "reversed", "requirement"]) add("Item curses", k, CURSE_LABELS[k], null, t(CURSE_TEXT[k]));
    add("Item curses", "different", CURSE_LABELS.different, null, t(CURSE_TEXT.differentNone));
    add("Intermittent functioning", "intermittent/unreliable", CURSE_LABELS.intermittent, t("unreliable"), t(INTERMITTENT[0][1]));
    add("Intermittent functioning", "intermittent/uncontrolled", CURSE_LABELS.intermittent, t("uncontrolled"), t(INTERMITTENT[2][1]));
    for (const [, , sit] of DEPENDENT) add("Intermittent functioning", `intermittent/${sit}`, CURSE_LABELS.intermittent, t(sit), t(INTERMITTENT[1][1], { situation: t(sit) }));
    for (const [, , short, text, changes] of DRAWBACKS) add("Drawbacks", `drawback/${short}`, CURSE_LABELS.drawback, t(short), `${t("Drawback:")} ${t(text)}`, changes);
    add("Psionic item curses", "backfire", CURSE_LABELS.backfire, null, t(CURSE_TEXT.backfire));
    add("Psionic item curses", "exhausting", CURSE_LABELS.exhausting, null, t(CURSE_TEXT.exhausting));
    add("Psionic item curses", "subversive", CURSE_LABELS.subversive, null, t(CURSE_TEXT.subversive), [["-2", "savingThrows", "allSavingThrows", "penalty"]]);
    // The GM's own curses (Custom Curses page)
    let mine = [];
    try { mine = registry.lists.has(`${CORR_MOD}|curses`) ? listRows(CORR_MOD, "curses") : []; } catch (e) { /* none */ }
    for (const r of mine) {
      const ch = parsePenalties(r.penalties).changes;
      if (r.table === "common" || r.table === "psionic") out.push(curseBuffData({ name: t("Curse: {curse}", { curse: r.name }), text: `${r.name}: ${r.text ?? ""}`, changes: ch, ref: `custom/${r.name}`, group: "Custom curses", key: "custom" }));
      else if (r.table === "drawback") add("Custom curses", `drawback/${r.name}`, CURSE_LABELS.drawback, r.name, `${t("Drawback:")} ${r.text ?? ""}`, ch);
      else if (r.table === "situation") add("Custom curses", `intermittent/${r.name}`, CURSE_LABELS.intermittent, r.text || r.name, t(INTERMITTENT[1][1], { situation: r.text || r.name }));
    }
    return out;
  }
  /** Create (or refill) the world compendium "Axecleft's Curses" with every curse buff. */
  async function buildCurseCompendium() {
    if (!game.user?.isGM) return null;
    const CC = typeof CompendiumCollection !== "undefined" ? CompendiumCollection : foundry.documents.collections.CompendiumCollection;
    const id = "world.axecleft-curses";
    let pack = game.packs.get(id);
    if (!pack) pack = await CC.createCompendium({ name: "axecleft-curses", label: t("Axecleft's Curses"), type: "Item", package: "world" });
    if (pack.locked) { ui.notifications.warn(t("The \"{name}\" compendium is locked. Unlock it and try again.", { name: pack.metadata.label })); return null; }
    const Item = CONFIG.Item.documentClass;
    const old = (await pack.getIndex()).filter((e) => e.flags?.world?.[CURSE_BUFF] || e.type === "buff").map((e) => e._id);
    if (old.length) await Item.deleteDocuments(old, { pack: pack.collection });
    const docs = allCurseBuffs();
    await Item.createDocuments(docs, { pack: pack.collection });
    curseIndex.delete(pack.collection);
    ui.notifications.info(t("{name}: {n} curse buffs.", { name: pack.metadata.label, n: docs.length }));
    return pack;
  }

  /** The Generation settings fieldset on the Treasure by Level tab. */
  function generationSection() {
    const g = generation();
    const num = (name, v, max = 100, step = 1, cls = "") => `<input type="number"${cls ? ` class="${cls}"` : ""} name="${name}" value="${esc(v)}" min="0" max="${max}" step="${step}">`;
    const cb = (name, v, label = "") => `<label class="atg-cb"><input type="checkbox" name="${name}" ${v ? "checked" : ""}>${label ? ` ${esc(t(label))}` : ""}</label>`;
    const H = (s) => `<span class="hint">${esc(t(s))}</span>`;
    const IQ = globalThis.AxecleftTools?.intelligentItems?.() !== false; // D35E before 3.1.0 has no intelligent items
    const rows = GEN_CATS.map(([k, label]) => `<tr><td>${esc(t(label))}</td>
        <td>${cb(`gen.light.${k}.on`, g.light[k].on)} ${num(`gen.light.${k}.chance`, g.light[k].chance)}%</td>
        <td>${num(`gen.light.${k}.bright`, g.light[k].bright, 120, 5, "atg-ft")} / ${num(`gen.light.${k}.dim`, g.light[k].dim, 240, 5, "atg-ft")} ${esc(t("ft"))}</td>
        ${IQ ? `<td>${cb(`gen.intelligence.${k}.on`, g.intelligence[k].on)} ${num(`gen.intelligence.${k}.chance`, g.intelligence[k].chance)}%</td>` : ""}
        <td>${g.hints[k] ? `${cb(`gen.hints.${k}.on`, g.hints[k].on)} ${num(`gen.hints.${k}.chance`, g.hints[k].chance)}%` : "—"}</td></tr>`).join("");
    const changed = JSON.stringify(g) !== JSON.stringify(GEN_DEFAULTS);
    return `<details class="atg-sec atg-gen" data-sec="gen" ${recall("sec.gen", "0") === "1" ? "open" : ""}><summary>${esc(t("Generation settings"))} <small>(${esc(changed ? t("changed for this world") : t("SRD and Axecleft defaults"))})</small></summary>
      <p class="hint">${esc(t("Extras that Axecleft's modules (Armory, Curios) add to randomly generated magic items, and poisons among mundane items. Untick a row or set 0% to turn it off. Crafting tools (the Armory's Forge) can always add them by hand. Saved for this world."))}</p>
      <div class="form-group"><label>${esc(t("Campaign"))}</label>${cb("gen.rules.psionics", g.rules.psionics, /*t*/"Psionics")}${cb("gen.rules.epic", g.rules.epic, /*t*/"Epic items")}${H("Epic share of the extra items at EL 21+:")} ${num("gen.rules.epicShare", g.rules.epicShare ?? 25)}<span class="hint">%</span></div>
      <p class="hint">${t("For every Axecleft module. <strong>Psionics</strong> off hides psionic items, powers, power stones, psionic tattoos, dorjes and psicrowns from treasure, merchants, crafting and the Forge. <strong>Epic items</strong> on lets the Forge and crafting make epic items (past the SRD +5/+10 limits) and lets merchants with the <em>Epic campaign</em> settlement character stock them; random treasure stays SRD up to EL 20. EL 21–30 (DMG): the EL 20 row plus 1, 2, 4, 6, 9, 12, 17, 23, 31 or 42 extra major items; while Epic items is on, this share of them are epic items from the SRD epic tables (house rule).")}</p>
      <div class="atg-checks">${cb("gen.light.enabled", g.light.enabled, /*t*/"Random light")}${IQ ? cb("gen.intelligence.enabled", g.intelligence.enabled, /*t*/"Random intelligence") : ""}${cb("gen.hints.enabled", g.hints.enabled, /*t*/"Inscription hints")}</div>
      <table class="atg-gen-table"><thead><tr><th></th><th>${esc(t("Sheds light"))}</th><th>${esc(t("Bright / dim"))}</th>${IQ ? `<th>${esc(t("Intelligent"))}</th>` : ""}<th>${esc(t("Hint"))}</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="hint">${t("SRD: 30% of magic melee weapons shed light (a <em>light</em> spell: 20 ft bright, 40 ft dim); ranged weapons don't; 15% of weapons carry an inscription hinting at their power; fewer than 1% of permanent items are intelligent (never potions, scrolls, wands or ammunition). Light on armor, shields and other items is a house rule.")}</p>
      ${IQ ? `<div class="atg-checks">${cb("gen.intelligence.purpose.on", g.intelligence.purpose.on, /*t*/"Intelligent items can have a special purpose:")}${cb("gen.intelligence.purpose.greater", g.intelligence.purpose.greater, /*t*/"always with greater powers")} <span>${esc(t("plus"))}</span> ${num("gen.intelligence.purpose.chance", g.intelligence.purpose.chance)}${H("% of the others")}</div>
      <p class="hint">${esc(t("The SRD lists special purposes and dedicated powers but doesn't say how often they occur; this is Axecleft's default (the most capable items, with greater powers, have one)."))}</p>` : ""}
      <div class="atg-checks">${cb("gen.light.themes", g.light.themes, /*t*/"Light color and animation follow the item's abilities")}${cb("gen.light.powerBrightness", g.light.powerBrightness, /*t*/"Stronger items glow brighter")}</div>
      <div class="atg-checks">${cb("gen.light.scaleRadii", g.light.scaleRadii, /*t*/"Stronger items shine farther:")} ${num("gen.light.scaleFeet", g.light.scaleFeet, 30, 5)} ${H("ft per +1 above +2")}</div>
      <div class="atg-checks">${cb("gen.size.enabled", g.size.enabled, /*t*/"Sizes of arms")} <span>${num("gen.size.small", g.size.small)}${H("% Small")}</span> <span>${num("gen.size.medium", g.size.medium)}${H("% Medium")}</span> <span>${num("gen.size.large", g.size.large)}${H("% Large")}</span></div>
      <p class="hint">${esc(t("SRD: random armor and weapons are Small 30%, Medium 60% and another size 10% (Large here). Small arms cost the same and weigh half; Large cost twice as much and weigh twice as much. Untick for all Medium."))}</p>
      <div class="atg-checks">${cb("gen.poison.enabled", g.poison.enabled, /*t*/"Poisons")} <span style="flex:1">${num("gen.poison.chance", g.poison.chance, 100, 0.5)}<span class="hint">${esc(t("% of mundane item rolls become a poison from your item sources (house rule; raise it where poison is common)"))}</span></span></div>
      <div class="atg-checks">${cb("gen.sources.enabled", g.sources.enabled, /*t*/"Your item compendiums:")} <span>${num("gen.sources.treasure", g.sources.treasure)}${H("% of treasure")}</span> <span>${num("gen.sources.merchants", g.sources.merchants)}${H("% of merchant stock")}</span></div>
      <p class="hint">${t("Treasure by Level and token loot roll magic arms, potions, scrolls and the rest on the SRD tables of Axecleft's modules (Armory, Curios); this share of those items comes from your Item compendiums instead (same kind and grade, when one exists), so your own items turn up in treasure. Merchants draw this share of their stock from your Item compendiums wherever a module also supplies the kind (50%: half and half). An item tagged <code>Treasure weight: 3</code> comes up three times as often as the others in its compendium pool; <code>Treasure weight: 0</code>, never at random. Unticked: nothing from your compendiums where a module supplies the kind.")}</p>
      <div class="atg-checks">${cb("gen.curse.enabled", g.curse.enabled, /*t*/"Cursed items")} <select name="gen.curse.method" style="flex:0 0 auto; width:auto">${[["flat", /*t*/"Flat rate"], ["grade", /*t*/"Rate by grade"]].map(([v, l]) => `<option value="${v}" ${g.curse.method === v ? "selected" : ""}>${esc(t(l))}</option>`).join("")}</select>
        <span data-curse="flat">${num("gen.curse.flat", g.curse.flat, 100, 0.5)}${H("% of magic items")}</span>
        <span data-curse="grade">${num("gen.curse.minor", g.curse.minor, 100, 0.5)}${H("% minor")} ${num("gen.curse.medium", g.curse.medium, 100, 0.5)}${H("% medium")} ${num("gen.curse.major", g.curse.major, 100, 0.5)}${H("% major and epic")}</span></div>
      <div class="atg-checks">${cb("gen.curse.specific", g.curse.specific, /*t*/"Specific cursed items (SRD table)")}${cb("gen.curse.mechanics", g.curse.mechanics, /*t*/"Apply simple effects (penalties, reversed bonuses)")}${cb("gen.curse.merchants", g.curse.merchants, /*t*/"Merchant stock can be cursed")}<button type="button" data-curse-pack><i class="fas fa-skull"></i> ${esc(t("Create the curse buffs compendium"))}</button></div>
      <p class="hint">${esc(t("SRD: any magic item can be cursed (the SRD gives no frequency; 1% flat, or 3% / 2% / 1% by grade, is Axecleft's default). Curses are rolled on the SRD tables: delusion, opposite effect, intermittent functioning, requirement (the GM chooses it), drawback, completely different effect, or a specific cursed item; psionic items can also roll a cursed psionic item's curse. The item is marked Cursed for the GM only; the curse shows at the top of its sheet, and ticking \"Curse Identified\" adds it to the description. Ticking \"Curse Active\" (the holder can't unequip or drop it) gives the holder the curse as a buff, with its penalties; unticking it, or losing the item, removes the buff. Cursed items that shed light glow with an eerie light while the curse is active. The compendium button makes every curse in the SRD tables a buff, to apply by hand."))}</p>
      <div class="atg-footer"><button type="button" data-gen-reset><i class="fas fa-rotate-left"></i> ${esc(t("Reset to Defaults"))}</button></div>
    </details>`;
  }
  /** Read the Generation settings fieldset back into a settings object (only the fields it shows). */
  function readGenerationForm(section) {
    const g = generation();
    for (const el of section.querySelectorAll("[name^='gen.']")) {
      const path = el.name.slice(4);
      const v = el.type === "checkbox" ? el.checked : el.tagName === "SELECT" ? el.value : Math.max(0, Number(el.value) || 0);
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
      + (hits.length > LIMIT ? `<div class="none">${esc(t("{n} more — type to narrow the list", { n: hits.length - LIMIT }))}</div>` : "")
      + (!hits.length ? `<div class="none">${esc(all.length ? t("No match") : t("Nothing to choose from"))}</div>` : "");
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
  /** A compendium index with English names (Axecleft's Tools 8: Babele and other languages), display: the shown name. */
  const enIndex = async (pack, opts = {}) => (globalThis.AxecleftTools?.enIndex ? globalThis.AxecleftTools.enIndex(pack, opts) : [...await pack.getIndex(opts)]);
  /** An item's English name (Axecleft's Tools 8), else its name. */
  const enOf = (x, pack = null) => globalThis.AxecleftTools?.enName?.(x, { pack }) ?? x?.name ?? "";
  let d35eIndex = null;
  async function d35eItem(name) {
    const pack = game.packs.get("D35E.items");
    if (!pack) return null;
    d35eIndex ??= await enIndex(pack);
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
      module: null, name: "mundane", label: /*t*/"D35E items", builtin: true, categories: ["mundane:alchemical", "mundane:gear"],
      async roll({ category }) {
        const rows = MUNDANE_ITEMS[category === "mundane:alchemical" ? "alchemical" : "gear"];
        const [, , name, qty, value] = inRange(rows, d100());
        const quantity = Math.max(1, Math.round(rollDice(qty)));
        const data = await d35eItem(name);
        const shown = data?.name ?? name; // the compendium's name (translated in a Babele world)
        const label = quantity > 1 ? `${shown} (${quantity})` : shown;
        if (!data) return [{ name: label, placeholder: true, summary: t("{category}, {gp} each; not found in the D35E items compendium", { category: catLabel(category), gp: gp(value) }) }];
        foundry.utils.setProperty(data, "system.quantity", quantity);
        applyPriceCorrection("D35E.items", data);
        if (!(Number(data.system?.price) > 0) && value > 0) foundry.utils.setProperty(data, "system.price", value); // SRD price when the compendium has none
        return [{ name: label, data, summary: t("{category}, {gp} each", { category: catLabel(category), gp: gp(value) }) }];
      },
    });
  }

  /* ------------------------------------------ */
  /*  Built-in provider: item compendiums       */
  /*  (D35E's own and any world or module       */
  /*  compendium with a matching name)          */
  /* ------------------------------------------ */

  const SOURCES_KEY = "axecleftItemSources";
  /** A compendium's label in English: Babele keeps the original in metadata.originalLabel when it translates the label. */
  const labelEn = (p) => p?.metadata?.originalLabel ?? p?.metadata?.label ?? p?.title ?? p?.collection ?? "";
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
      const id = p.collection, label = p.metadata?.label ?? p.title ?? id, en = labelEn(p);
      const pkg = p.metadata?.packageType === "system" || id.startsWith(`${game.system?.id}.`) ? "System" : p.metadata?.packageType === "world" || id.startsWith("world.") ? "World" : (game.modules.get(p.metadata?.packageName)?.title ?? p.metadata?.packageName ?? "Module");
      const auto = SYSTEM_PACKS.includes(id) || POISON_PACK.test(en) || (!id.startsWith(`${game.system?.id}.`) && MATCH.test(en) && !NOT_MATCH.test(en));
      return { id, label, en, source: pkg, auto };
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
  function isEpicItem(e) { const n = enOf(e); return truthy(e?.system?.epic) || /\bepic\b/i.test(n) || marked("epic", n); }
  function isPsionicItem(e) {
    const s = e?.system ?? {};
    return truthy(s.psionic) || s.isPower === true || ["dorje", "tattoo", "powerstone"].includes(s.consumableType) || PSIONIC_NAME.test(enOf(e)) || marked("psionic", enOf(e));
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
  /** An item's "Treasure weight: n" tag (version 9.994): how likely it is among the compendium items it is rolled with (default 1; 0: never at random). */
  function treasureWeight(tags) {
    for (const tg of Array.isArray(tags) ? tags : []) {
      const m = String(Array.isArray(tg) ? tg[0] : tg ?? "").trim().match(/^treasure\s+weight\s*:?\s*(\d+(?:[.,]\d+)?)$/i);
      if (m) return Math.max(0, Number(m[1].replace(",", ".")) || 0);
    }
    return 1;
  }
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
    if (!pack) throw new Error(t("Compendium {pack} not found.", { pack: packId }));
    const label = pack.metadata?.label ?? packId;
    const magicPack = /magic|wondrous|enchant/i.test(labelEn(pack)) || packId === "D35E.magicitems";
    const index = await enIndex(pack, { fields: INDEX_FIELDS });
    const rows = [];
    for (const e of index) {
      if (e.type === "Folder") continue;
      const primary = classifyItem(e, magicPack);
      const folder = folderPathOf(pack, e.folder);
      const current = readShopTags(e.system?.tags);
      // Epic items stay out of shops: no suggestions (a hand-written tag still counts)
      const epic = e.system?.epic === true || /\bepic\b/i.test(e.name ?? "");
      const suggested = epic ? { cats: [], hints: [] } : suggestShopTags(e.name, `${folder} ${magicPack ? "magic" : ""}`.trim(), primary);
      rows.push({ id: e._id, name: e.display ?? e.name, folder, primary, current, suggested });
    }
    return rows.sort((a, b) => a.folder.localeCompare(b.folder) || a.name.localeCompare(b.name));
  }

  /** Write Shop tags. rows: [{ id, cats, hints }]. Unlocks a locked compendium for the update and locks it again. */
  async function applyShopTags(packId, rows) {
    const pack = game.packs.get(packId);
    if (!pack) throw new Error(t("Compendium {pack} not found.", { pack: packId }));
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
    const c = correctionFor(packId, enOf(data, packId));
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
      try { index = pack ? await enIndex(pack, { fields: ["system.price"] }) : []; } catch (e) { /* unreadable */ }
      for (const c of list) {
        const e = index.find((x) => normName(x.name) === normName(c.name));
        if (!e && !c.pack) continue; // an "any compendium" row only reports where the item exists
        const current = e ? Number(e.system?.price) || 0 : null;
        rows.push({ pack: id, packLabel: pack?.metadata?.label ?? id, name: e?.display ?? e?.name ?? c.name, found: !!e, current, corrected: c.price,
          needed: !!e && current !== c.price, note: c.note ?? "", source: c.source === "gm" ? "GM" : (game.modules.get(c.module)?.title ?? c.module) });
      }
    }
    return rows.sort((a, b) => a.packLabel.localeCompare(b.packLabel) || a.name.localeCompare(b.name));
  }
  /** Download the Price Check as CSV (to send to a compendium's maintainer). */
  async function exportPriceCheck() {
    const rows = await priceCheck();
    const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [[/*t*/"Compendium", /*t*/"Compendium id", /*t*/"Item", /*t*/"Current price (gp)", /*t*/"Corrected price (gp)", /*t*/"Needs fixing", /*t*/"Note", /*t*/"From"].map((h) => q(t(h))).join(","),
      ...rows.map((r) => [r.packLabel, r.pack, r.name, r.found ? r.current : t("not found"), r.corrected, r.needed ? t("yes") : t("no"), r.note, r.source === "GM" ? t("GM") : r.source].map(q).join(","))].join("\n");
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
   *     group: (e) => e.system.enhancementType,        // optional (version 9.99): Item Sources counts the items by this ("12 weapon, 8 armor")
   *     hint: "Special abilities for magic arms" });
   *   T.kindStats("axeclefts-armory.enhancements")    // { [pack id]: { total, by: { weapon: 12, armor: 8 } } } once read
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
  const kindStatMap = new Map(); // kind id -> { [pack id]: { total, by } } (version 9.99: shown on the Item Sources tab)
  const kindStats = (kindId) => kindStatMap.get(kindId) ?? null;
  const sourceKinds = () => [...registry.sourceKinds.values()].filter(isActive);
  // Compendium labels are matched in English (Babele translates the labels; metadata.originalLabel keeps the English one)
  const kindMatches = (k, p) => [...new Set([p.en ?? p.label, p.label])].some((l) => (typeof k.match === "function" ? !!k.match(l, p.id) : k.match instanceof RegExp ? k.match.test(l) : false));
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
      const out = [], stats = {};
      for (const id of kindSources(kindId).packs) {
        const pack = game.packs.get(id);
        if (!pack) continue;
        let index;
        try { index = await enIndex(pack, { fields: [...new Set([...INDEX_FIELDS, ...(k.fields ?? [])])] }); } catch (err) { console.warn(`AxecleftTreasure | could not read ${id}`, err); continue; }
        const st = stats[id] = { total: 0, by: {} };
        for (const e of index) {
          if (e.type === "Folder") continue;
          try { if (k.accept && !k.accept(e)) continue; } catch (err) { continue; }
          out.push({ pack: id, packLabel: pack.metadata?.label ?? id, id: e._id, name: e.name, display: e.display ?? e.name, entry: e });
          st.total++;
          let g = null;
          try { g = typeof k.group === "function" ? k.group(e) : null; } catch (err) { /* no group */ }
          if (g) st.by[g] = (st.by[g] ?? 0) + 1;
        }
      }
      kindStatMap.set(kindId, stats);
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
        const magicPack = /magic|wondrous|enchant/i.test(labelEn(pack)) || id === "D35E.magicitems";
        let index;
        try { index = await enIndex(pack, { fields: INDEX_FIELDS }); } catch (err) { console.warn(`AxecleftTreasure | could not read ${id}`, err); continue; }
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
          const entry = { pack: id, id: e._id, name: e.name, display: e.display ?? e.name, price, ranged: e.system?.weaponSubtype === "ranged" || e.system?.subType === "ammo", label, hints: tags.hints, epic: isEpicItem(e), psionic: isPsionicItem(e), weight: treasureWeight(e.system?.tags) };
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
      // Extra source kinds are read again too, so the Item Sources tab can show what each compendium supplies (version 9.99)
      await Promise.all(sourceKinds().map((k) => kindItems(k.id, { force: true }).catch(() => [])));
      api.refresh?.();
      globalThis.AxecleftMerchants?.refresh?.();
      return stats;
    })();
    try { return await compScanning; } finally { compScanning = null; }
  }

  const gradeOf = (price) => (price <= MINOR_MAX ? "minor" : price <= MEDIUM_MAX ? "medium" : "major");
  /** The compendium items a roll can pick from (Treasure weight 0 left out). strictGrade: no other grade when none fits. */
  function compPool(category, { grade, tags = [], hints = {}, epic = false } = {}, strictGrade = false) {
    let pool = allowedByRules(compPools[category] ?? [], { epic }).filter((x) => (x.weight ?? 1) > 0).map((x) => (x.weight === undefined ? { ...x, weight: 1 } : x));
    // A specialty shop's limit for this category (e.g. a bookseller's wondrous items: only those tagged Book)
    const want = hints?.[category];
    if (want?.length) pool = pool.filter((x) => x.hints?.some((h) => want.includes(h)));
    if (tags.includes("ranged") && /weapon$/.test(category)) pool = pool.filter((x) => x.ranged); // a bowyer sells no swords
    if (tags.includes("psionic")) pool = pool.filter((x) => x.psionic); // a psionic shop sells only psionic items (version 9.5)
    if (grade && category.startsWith("magic:")) { const g = pool.filter((x) => gradeOf(x.price) === grade); if (g.length || strictGrade) pool = g; }
    return pool;
  }
  registry.providers.set("axecleft-treasure.compendiums", {
    module: null, name: "compendiums", label: /*t*/"Item compendiums", builtin: true, compendium: true, hints: true,
    categories: Object.keys(CATEGORIES).filter((c) => c !== "gem" && c !== "art"),
    available: (category, hints) => allowedByRules(compPools[category] ?? []).some((x) => !hints?.length || x.hints?.some((h) => hints.includes(h))),
    async roll({ category, grade, tags = [], merchant, hints = {}, epic = false }) {
      const pool = compPool(category, { grade, tags, hints, epic });
      if (!pool.length) return [placeholder(category, grade)];
      // Version 9.994: "Treasure weight: n" tags make an item more (or less) likely than the others
      let r = Math.random() * pool.reduce((a, x) => a + x.weight, 0), pick = pool[pool.length - 1];
      for (const x of pool) { r -= x.weight; if (r < 0) { pick = x; break; } }
      const doc = await game.packs.get(pick.pack)?.getDocument(pick.id);
      if (!doc) return [placeholder(category, grade)];
      const data = doc.toObject();
      delete data._id; delete data.folder; delete data.sort;
      const fix = applyPriceCorrection(pick.pack, data);
      let qty = Number(data.system?.quantity) || 1;
      if (category === "standard:ammo" && merchant) qty = /\(\d+\)/.test(pick.name) ? Math.max(1, Math.round(rollDice("1d4"))) : Math.round(rollDice("2d4*10"));
      foundry.utils.setProperty(data, "system.quantity", qty);
      const sum = t(qty > 1 ? "{category}, {gp} each; from {source}" : "{category}, {gp}; from {source}", { category: catLabel(category), gp: gp(pick.price), source: pick.label });
      return [{ name: qty > 1 ? `${data.name} (${qty})` : data.name, data, summary: `${sum}${fix ? ` ${t("(price corrected)")}` : ""}` }];
    },
  });

  /* ------------------------------------------ */
  /*  Rolling the Treasure table                */
  /* ------------------------------------------ */

  /*t*/"Minor"; /*t*/"Medium"; /*t*/"Major"; /*t*/"Epic"; /*t*/"minor"; /*t*/"medium"; /*t*/"major"; // grades in names and notes
  const placeholder = (category, grade) => {
    const c = CATEGORIES[category] ?? { label: category, module: "another module" };
    const G = grade ? t(`${grade[0].toUpperCase()}${grade.slice(1)}`) : "";
    const item = t(c.label);
    const name = c.magic ? (G ? t("{grade} magic {item}", { grade: G, item }) : t("magic {item}", { item })) : c.graded && G ? t("{grade} {item}", { grade: G, item }) : item;
    return { name, placeholder: true, summary: t("needs {module}", { module: t(c.module) }) };
  };

  /** ctx.mix: pick at random among every source for the category (merchants), instead of the preferred one. */
  async function fromCategory(category, ctx) {
    const hints = ctx.hints?.[category] ?? null;
    const all = providersFor(category, hints);
    let p = providerFor(category, hints);
    // Version 9.994: the GM's share from Item compendiums (Generation settings) where a module also supplies the category
    const comp = all.find((x) => x.compendium), others = all.filter((x) => !x.compendium);
    const src = generation().sources ?? {};
    if (ctx.mix && all.length) {
      if (comp && others.length) p = src.enabled !== false && Math.random() * 100 < (Number(src.merchants) || 0) ? comp : others[Math.floor(Math.random() * others.length)];
      else p = all[Math.floor(Math.random() * all.length)];
    } else if (comp && p && p !== comp && src.enabled !== false && Number(src.treasure) > 0 && Math.random() * 100 < Number(src.treasure)
      && compPool(category, { ...ctx, hints: ctx.hints ?? {} }, true).length) p = comp;
    if (!p) return [placeholder(category, ctx.grade)];
    try {
      const out = await p.roll({ ...ctx, category });
      const rolled = (out ?? []).map((e) => ({ provider: `${p.module}.${p.name}`, ...e }));
      // Version 9.96: a random magic item can be cursed (Generation settings)
      if (ctx.curse === false || !curseChance(category, ctx)) return rolled;
      const cursed = [];
      for (const e of rolled) { try { cursed.push(await maybeCurse(e, category, ctx)); } catch (err) { console.error("AxecleftTreasure | curse failed", err); cursed.push(e); } }
      return cursed;
    } catch (err) {
      console.error(`AxecleftTreasure | ${p.module}.${p.name} failed for ${category}`, err);
      return [{ ...placeholder(category, ctx.grade), summary: t("{source} failed: {error}", { source: t(p.label), error: err.message }) }];
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
      if (type === "nothing") notes.push(t("Coins d% {roll}: none", { roll: r }));
      else {
        const amount = Math.round(rollDice(dice));
        const nm = currencies().name(type);
        const shown = nm === type ? type : `${nm} (${type})`;
        notes.push(t("Coins d% {roll}: {dice} {coin} → {amount} {coin}", { roll: r, dice: diceText(dice), coin: shown, amount: num(amount) }));
        entries.push({ coins: { [type]: amount }, name: `${num(amount)} ${shown}` });
      }
    }
    if (goods) {
      const r = d100(); const [, , type, dice] = inRange(row.goods, r);
      if (type === "nothing") notes.push(t("Goods d% {roll}: none", { roll: r }));
      else {
        const n = Math.max(1, Math.round(rollDice(dice)));
        notes.push(t(type === "gems" ? "Goods d% {roll}: {dice} gems → {n}" : "Goods d% {roll}: {dice} art objects → {n}", { roll: r, dice: diceText(dice), n }));
        for (let i = 0; i < n; i++) entries.push(...await fromCategory(type === "gems" ? "gem" : "art", { level: row.level, ...ctx }));
      }
    }
    if (items) {
      const r = d100(); const [, , type, dice] = inRange(row.items, r);
      if (type === "nothing") notes.push(t("Items d% {roll}: none", { roll: r }));
      else {
        const n = Math.max(1, Math.round(rollDice(dice)));
        const what = type === "mundane" ? (n > 1 ? t("mundane items") : t("mundane item")) : t(n > 1 ? "{grade} magic items" : "{grade} magic item", { grade: t(type) });
        notes.push(t("Items d% {roll}: {dice} {what} → {n}", { roll: r, dice: diceText(dice), what, n }));
        for (let i = 0; i < n; i++) {
          if (type === "mundane") {
            // House rule (Generation settings): a share of mundane rolls are a poison, when an item source has poisons
            if (genChance("poison") && providerFor("mundane:poison")) {
              notes.push(t("Mundane item: a poison (Generation settings)"));
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
              entries.push(...got.map((e) => ({ ...e, summary: e.summary ? `${e.summary}` : t("epic item") })));
              epicCount++;
              continue;
            }
          }
          entries.push(...await fromCategory(majorCat(), { level: 20, grade: "major", ...ctx }));
        }
        notes.push(t(n > 1 ? "EL {lv} (DMG): EL 20 row plus {n} extra major items" : "EL {lv} (DMG): EL 20 row plus {n} extra major item", { lv, n }) + (share ? t("; {count} of them epic ({share}% share)", { count: epicCount, share }) : ""));
      }
    }
    return { entries, notes };
  }
  const normKey = (s) => String(s ?? "").toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9']+/g, " ").trim();

  /* ------------------------------------------ */
  /*  Where items go                            */
  /* ------------------------------------------ */

  /** The "Generated Treasure" Items folder (named in the world's language; one made under its English name is still used). */
  async function itemFolder() {
    const names = [ITEM_FOLDER, t(ITEM_FOLDER)];
    return game.folders.find((f) => f.type === "Item" && names.includes(f.name))
      ?? Folder.create({ name: t(ITEM_FOLDER), type: "Item", color: "#3b24f0" });
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
        ui.notifications.warn(t("No token is selected, so the treasure went to the Items sidebar. Select tokens, or choose an actor under \"Put items in\"."));
        return { mode: "items" };
      }
      return { mode: "actors", targets };
    }
    if (d.mode === "actor") {
      const doc = await fromUuid(d.uuid);
      const actor = doc?.documentName === "Actor" ? doc : doc?.actor ?? null;
      if (!actor) { ui.notifications.warn(t("That actor or token no longer exists, so the treasure went to the Items sidebar.")); return { mode: "items" }; }
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
        coinNote = t(stdAny && cfg.purse === "altCurrency" ? "Coins added: {coins} (standard coins as weightless coins)." : "Coins added: {coins}.", { coins: paid.text });
      } else coinNote = t("Coins (hand out yourself): {coins}.", { coins: paid.text });
    }
    for (const r of rows) { if (typeof r.describe === "function") r.summary = r.describe(r.price); delete r.describe; }
    return { rows, coinNote, paid };
  }

  const rowSummary = (r) => [r.summary, !r.describe && r.price != null && !/value|valeur|valor/i.test(r.summary) ? t("value {gp}", { gp: gp(r.price) }) : ""].filter(Boolean).join("; ");

  function chatContent(title, rows, note = "") {
    const li = rows.map((r, i) => {
      if (r.placeholder) return `<li><em>${esc(r.name)}</em><br><small>${esc(r.summary)}</small></li>`;
      const link = r.uuid ? `@UUID[${r.uuid}]{${esc(r.name)}}` : `<strong>${esc(r.name)}</strong>`;
      const btn = r.uuid ? "" : `<br><button type="button" class="atg-create" data-index="${i}"><i class="fas fa-plus"></i> ${esc(t("Create Item"))}</button>`;
      return `<li>${link}<br><small>${esc(rowSummary(r))}</small>${btn}</li>`;
    }).join("");
    return `<h3>${esc(title)}</h3>${note ? `<p>${note}</p>` : ""}${rows.length ? `<ol>${li}</ol>` : ""}`;
  }

  async function postChat(title, rows, note) {
    return ChatMessage.create({
      content: chatContent(title, rows, note),
      whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id),
      speaker: { alias: t("Treasure Generator") },
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
          if (!data) throw new Error(t("The module that made \"{name}\" is not active.", { name: rows[i].name }));
          const folder = await itemFolder();
          const doc = await CONFIG.Item.documentClass.create({ ...data, folder: folder.id });
          rows[i].uuid = doc.uuid;
          await message.update({ content: chatContent(flags.title, rows, flags.note), [`flags.${FLAG}.${FLAG_KEY}.rows`]: rows });
        } catch (err) {
          btn.disabled = false;
          console.error("AxecleftTreasure | Create Item failed", err);
          ui.notifications.error(t("Could not create the item: {error}", { error: err.message }));
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
      const where = g ? esc(t("Placed on {name}; values rolled.", { name: g.label })) : target.mode === "items" && rows.some((r) => !r.placeholder) ? esc(t("Created in the \"{folder}\" Items folder.", { folder: t(ITEM_FOLDER) })) : "";
      const missing = rows.some((r) => r.placeholder) ? t("Items in <em>italics</em> need a module that isn't active; roll or pick them yourself.") : "";
      await postChat(g ? `${title}: ${g.label}` : title, rows, [note, coinNote && esc(coinNote), where && `<small>${where}</small>`, missing && `<small>${missing}</small>`].filter(Boolean).join("<br>"));
      out.push({ actor: g?.actor ?? null, rows });
    }
    return out;
  }

  /** Roll the SRD Treasure table `times` times for each target and place the results. */
  async function generateTreasure({ level = 1, times = 1, dest = "items", coins = true, goods = true, items = true, form = null } = {}) {
    const n = Math.min(10, Math.max(1, Number(times) || 1));
    const parts = [coins && "coins", goods && "goods", items && "items"].filter(Boolean).join(", ");
    return runGeneration({ title: t("Treasure, EL {level}", { level }), dest, rollFor: async (actor) => {
      const entries = [], notes = [];
      for (let i = 0; i < n; i++) {
        const r = await rollTreasure(level, { coins, goods, items }, { actor, form });
        entries.push(...r.entries);
        notes.push((n > 1 ? `<strong>${esc(t("Roll {n}:", { n: i + 1 }))}</strong> ` : "") + r.notes.map(esc).join("; "));
      }
      return { entries, note: notes.join("<br>") || esc(t("Nothing rolled ({parts}).", { parts: parts ? [coins && t("coins"), goods && t("goods"), items && t("items")].filter(Boolean).join(", ") : t("no parts ticked") })) };
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
  /*t*/"Coins"; /*t*/"Goods"; /*t*/"Items"; // parts in loot notes
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
    if (!actor) return t("has no actor");
    // Traps (version 9.8): incidental loot, by hand only, at the Trap loot share of a creature's treasure
    if (actor.type === "trap") { if (auto) return t("is a trap (trap loot is rolled by hand)"); }
    else if (actor.type !== "npc") return t("is a {type}, not an NPC", { type: actor.type });
    if (actor.hasPlayerOwner) return t("belongs to a player");
    if (auto && tokenDoc.actorLink) return t("is linked to its actor");
    if (auto && tokenDoc.hidden && !lootSettings().hidden) return t("is hidden");
    if (auto && lootRecord(tokenDoc)) return t("already has loot");
    const p = treasurePct(actor);
    if (!p.coins && !p.goods && !p.items) return t("has Treasure: None");
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
      if (!n) notes.push(t("{part}: no roll ({pct}% chance)", { part: t(`${part[0].toUpperCase()}${part.slice(1)}`), pct: Math.round(pct[part] * scale) }));
    }
    const mark = { at: Date.now() };
    const { rows, coinNote, paid } = await place(entries, "actors", actor, { mark });
    await lootHolder(tokenDoc).setFlag(FLAG, LOOT_KEY, { at: mark.at, cr, level, paid: paid ? { std: paid.std, custom: paid.custom, purse: paid.purse } : null });
    const crText = cr > 0 && cr < 1 ? `CR 1/${Math.round(1 / cr)}` : `CR ${cr}`;
    const std = { 100: /*t*/"standard", 200: /*t*/"double", 300: /*t*/"triple" }[pct.coins];
    const pctText = pct.coins === pct.goods && pct.goods === pct.items ? (std ? t(std) : `${pct.coins}%`) : t("coins {c}%, goods {g}%, items {i}%", { c: pct.coins, g: pct.goods, i: pct.items });
    const shareText = trapShare < 1 ? t("; trap loot ×{share}", { share: { 0.25: "¼", 0.5: "½", 0.75: "¾" }[trapShare] ?? trapShare }) : actor.type === "trap" ? t("; trap loot ×{share}", { share: 1 }) : "";
    const note = [esc(t(cr > 30 ? "{cr} → EL {level} (the table stops at 30); treasure {treasure}{share}." : "{cr} → EL {level}; treasure {treasure}{share}.", { cr: crText, level, treasure: pctText, share: shareText })), notes.map(esc).join("; "), coinNote && esc(coinNote),
      rows.some((r) => r.placeholder) ? `<small>${t("Items in <em>italics</em> need a module that isn't active; roll or pick them yourself.")}</small>` : ""].filter(Boolean).join("<br>");
    if (s.chat !== false) await postChat(t("Loot: {name}", { name: tokenDoc.name }), rows, note);
    return { token: tokenDoc, rows, note };
  }

  /** Loot for several tokens (default: the selected ones), one after another. */
  async function lootTokens(tokens = null, opts = {}) {
    const list = (tokens ?? canvas?.tokens?.controlled ?? []).map((t) => t?.document ?? t).filter(Boolean);
    if (!list.length) { ui.notifications.warn(t("Select one or more NPC tokens first.")); return []; }
    const out = [];
    for (const tok of list) {
      try { out.push(await lootToken(tok, opts)); }
      catch (err) { console.error(`AxecleftTreasure | loot for ${tok.name} failed`, err); out.push({ token: tok, skipped: t("failed: {error}", { error: err.message }) }); }
    }
    const done = out.filter((o) => !o.skipped).length, skipped = out.filter((o) => o.skipped);
    if (!opts.auto) {
      if (done) ui.notifications.info(t(done > 1 ? "Loot rolled for {n} tokens." : "Loot rolled for {n} token.", { n: done }));
      if (skipped.length) ui.notifications.warn(t("No loot for {list}.", { list: skipped.map((o) => `${o.token.name} (${o.skipped})`).join(", ") }));
    }
    return out;
  }
  async function clearLootTokens(tokens = null) {
    const list = (tokens ?? canvas?.tokens?.controlled ?? []).map((t) => t?.document ?? t).filter(Boolean);
    if (!list.length) return ui.notifications.warn(t("Select one or more tokens first."));
    let n = 0;
    for (const t of list) if (await clearLoot(t)) n++;
    ui.notifications.info(n ? t(n > 1 ? "Loot cleared from {n} tokens." : "Loot cleared from {n} token.", { n }) : t("None of the selected tokens has loot from the Treasure Generator."));
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
    const tool = { name: "axecleft-loot", title: t("Roll Loot for Selected Tokens (Treasure Generator, by CR)"), icon: "fas fa-sack-dollar", button: true, visible: true };
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
   *                    help?, note?, example?, normalize?, format?, builtin?, names?, scopes?, prepare?, order? })
   *   help: { field: "what goes in this column" } (version 9.991: a line per column on the page);
   *   note: a closing sentence, or a function returning HTML blocks (version 9.992); example: { field: value } (an example row, shown in a table that isn't read)
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
  const disableTargets = (m) => [...activeLists().filter((s) => s.module === m).flatMap((s) => [[s.key, s.label], ...(s.scopes ?? [])]), ["any", /*t*/"Any list"]];
  function disabledSpec(m) {
    return {
      module: m, key: DISABLED, id: `${m}|${DISABLED}`, page: t("Disabled Entries ({module})", { module: t(modTitle(m)) }), label: /*t*/"Disabled entry",
      cols: [{ field: "name", header: /*t*/"Name" }, { field: "list", header: /*t*/"List" }],
      intro: t("Built-in entries of {module} that should never be used.", { module: esc(t(modTitle(m))) }),
      help: { name: t("the built-in entry's name, as the module lists it."), list: t("which list it is switched off in: {lists}.", { lists: disableTargets(m).map(([v]) => esc(v)).join(", ") }) },
      example: { name: "Example entry", list: "any" },
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
  // Version 9.991: the page text in the world's language, a line per column (its heading as written in the table, and translated),
  // a warning to keep the headings, and an example row in a second table (only the first table is read)
  const TEXT_VERSION = 3;
  /** A list's closing note as HTML blocks: a function's own HTML, or a sentence in a paragraph. */
  const noteHtml = (spec) => { try { return typeof spec.note === "function" ? String(spec.note() ?? "") : spec.note ? `<p>${t(spec.note)}</p>` : ""; } catch (e) { return ""; } };
  const helpText = (spec, field) => (spec.help?.[field] ? decodeCell(t(spec.help[field])) : "");
  const textStamp = () => `${game.i18n?.lang ?? "en"}|${TEXT_VERSION}`;
  const headerShown = (h) => { const tr = t(h); return tr !== h ? `<strong>${esc(h)}</strong> (${esc(tr)})` : `<strong>${esc(h)}</strong>`; };
  function tableHtml(spec, rows) {
    const head = spec.cols.map((c) => `<th>${esc(c.header)}</th>`).join("");
    const body = [...rows].sort((a, b) => a.name.localeCompare(b.name)).map((r) => `<tr>${spec.cols.map((c) => `<td>${esc(cellText(spec, c.field, r))}</td>`).join("")}</tr>`).join("");
    const blank = `<tr>${spec.cols.map(() => "<td></td>").join("")}</tr>`;
    const help = spec.cols.filter((c) => spec.help?.[c.field]).map((c) => `<li>${headerShown(c.header)}: ${t(spec.help[c.field])}</li>`).join("");
    let out = `<p>${spec.intro ? t(spec.intro) : ""}</p>${help ? `<ul>${help}</ul>` : ""}${noteHtml(spec)}`
      + `<p><em>${esc(t("Add a row to the table (or use the Lists tab of the Treasure Generator). Rows without a name are ignored."))}</em></p>`
      + `<p><strong>${esc(t("Keep the column headings exactly as they are (in English), even in a translated world: the modules find the columns by them."))}</strong></p>`
      + `<table><thead><tr>${head}</tr></thead><tbody>${body}${blank}</tbody></table>`;
    if (spec.example) {
      const ex = normalizeRow(spec, spec.example) ?? spec.example;
      out += `<h3>${esc(t("Example"))}</h3><p><em>${esc(t("A filled-in row, for reference. This table is never read: add your rows to the table above."))}</em></p>`
        + `<table><thead><tr>${head}</tr></thead><tbody><tr>${spec.cols.map((c) => `<td>${esc(cellText(spec, c.field, ex))}</td>`).join("")}</tr></tbody></table>`;
    }
    return out;
  }
  /** Add rows from extra that base doesn't have (by name). Returns { rows, added }. */
  function mergeRows(spec, base = [], extra = []) {
    const have = new Map(base.map((r) => [rowKey(r), r]));
    let added = 0;
    for (const r0 of extra ?? []) { const r = normalizeRow(spec, r0); if (r && !have.has(rowKey(r))) { have.set(rowKey(r), r); added++; } }
    return { rows: [...have.values()], added };
  }

  /* ---- the journal ---- */
  // Column headers and page names stay in English: they are how the tables are read back
  const HOW_TO = () => `<h2>${JOURNAL_NAME}</h2>
<p>${t("These pages hold <strong>your own additions</strong> to Axecleft's modules ({modules}), plus any built-in entries you want switched off.", { modules: listModules().map((m) => esc(modTitle(m))).join(", ") || esc(t("none active")) })}</p>
<ul>
<li>${t("Edit the tables on the other pages like any journal table, or use the <strong>Lists</strong> tab of the Treasure Generator (Axecleft's Tools on the left toolbar).")}</li>
<li>${esc(t("Changes take effect at once."))}</li>
<li>${t("<strong>Shared library:</strong> every change is also saved to <code>Data/{path}</code> on your Foundry server. Module updates never touch that file, and every world on this Foundry install loads it, so your lists follow you from world to world. Loading only adds missing rows; it never deletes rows from a world.", { path: esc(libraryPath()) })}</li>
<li>${esc(t("Pages of a module that isn't active are kept as they are."))}</li>
<li>${t("To move the lists to a different Foundry install, use <strong>Export</strong> and <strong>Import</strong> on the Lists tab.")}</li>
<li>${esc(t("Keep the column headings in English: they are how the modules read the tables."))}</li>
</ul>
<p>${esc(t("Deleting this journal is safe: it is rebuilt from the shared library the next time the world loads."))}</p>`;
  let suppressSave = 0;
  const pageId = (p) => p?.flags?.world?.[P_FLAG] ?? null;
  function findJournal() {
    const all = game.journal ?? [];
    return all.find((j) => j.flags?.world?.[J_FLAG]) ?? all.find((j) => j.flags?.[LEGACY_MOD]?.lists) ?? null;
  }
  const pageFor = (j, spec) => j?.pages?.find((p) => pageId(p) === spec.id) ?? null;
  const T_FLAG = "axecleftListText"; // the language and text version a page was written in (version 9.991)
  const newPage = (spec, rows, sort) => ({ name: t(spec.page), type: "text", text: { content: tableHtml(spec, rows) }, sort, flags: { world: { [P_FLAG]: spec.id, [T_FLAG]: textStamp() } } });
  /** Pages written in another language or an older text version are written again in the world's language (their rows are kept). */
  async function refreshTexts(j) {
    const stamp = textStamp(), updates = [];
    for (const p of j.pages ?? []) {
      if (p.flags?.world?.[T_FLAG] === stamp) continue;
      const id = pageId(p);
      if (id === "howto") { updates.push({ _id: p.id, name: t("How to Use"), "text.content": HOW_TO(), [`flags.world.${T_FLAG}`]: stamp }); continue; }
      const [m, k] = String(id ?? "").split("|");
      const spec = m && k ? listSpec(m, k) : null;
      if (!spec || !isActive(spec)) continue; // pages of inactive modules stay as they are
      const html = p.text?.content ?? "", rows = parseTable(spec, html);
      // A table the modules can't fully read (a heading renamed by hand) is left alone, so no row is lost
      const table = String(html).match(/<table[\s\S]*?<\/table>/i)?.[0] ?? "";
      const heads = [...(table.match(/<tr[\s\S]*?<\/tr>/i)?.[0] ?? "").matchAll(/<t([hd])[^>]*>([\s\S]*?)<\/t\1>/gi)].map((c) => headKey(c[2]));
      if (table && spec.cols.some((c) => !heads.includes(headKey(c.header)))) { console.warn(`AxecleftTreasure | Treasure Lists: "${p.name}" has rows the modules can't read (a column heading changed?); its text was not updated.`); continue; }
      updates.push({ _id: p.id, name: t(spec.page), "text.content": tableHtml(spec, rows), [`flags.world.${T_FLAG}`]: stamp });
    }
    if (updates.length) await j.updateEmbeddedDocuments("JournalEntryPage", updates);
  }
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
          pages: [{ name: t("How to Use"), type: "text", text: { content: HOW_TO() }, sort: 0, flags: { world: { [P_FLAG]: "howto", [T_FLAG]: textStamp() } } },
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
      await refreshTexts(j);
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
          if (page) await page.update({ name: t(s.page), "text.content": content, [`flags.world.${T_FLAG}`]: textStamp() });
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
    if (!spec) throw new Error(t("There is no list \"{list}\" for {module}.", { list: k, module: m }));
    const r = normalizeRow(spec, row);
    if (!r) throw new Error(t("It needs a name."));
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
        reg("librarySync", { name: /*t*/"Shared treasure lists library", hint: /*t*/"Automatic: your Treasure Lists (custom gems, art objects, materials, curses, price corrections and so on, for every Axecleft module) are saved to a file in the Foundry Data folder whenever you change them, and every world loads them at start-up, so they survive module updates and follow you between worlds. Manual: only when you press Save / Load on the Treasure Generator's Lists tab.", type: String, default: "auto", choices: { auto: /*t*/"Automatic", manual: /*t*/"Manual" } });
        reg("libraryFolder", { name: /*t*/"Shared library folder", hint: /*t*/"Folder inside your Foundry Data folder that holds treasure-lists.json.", type: String, default: "axecleft-treasure" });
        libNs = ns;
        return;
      } catch (e) { console.warn(`AxecleftTreasure | could not register the library settings under "${ns}"`, e); }
    }
  }
  const libSetting = (k, d) => { try { return libNs ? game.settings.get(libNs, k) ?? d : d; } catch (e) { return d; } };
  const librarySync = () => libSetting("librarySync", "auto");
  const libraryFolder = () => String(libSetting("libraryFolder", "") || "axecleft-treasure").replace(/^\/+|\/+$/g, "");
  const libraryPath = () => `${libraryFolder()}/${LIBRARY_FILE}`;
  const FPi = () => foundry.applications?.apps?.FilePicker?.implementation ?? (typeof FilePicker !== "undefined" ? FilePicker : globalThis.FilePicker);
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
      ui.notifications.warn(t("Treasure Lists: could not save the shared library ({error}). Your lists are still saved in this world.", { error: err.message }));
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
    if (!lib) { if (notify) ui.notifications.info(t("No shared treasure library yet. It is created the first time you save a list.")); return 0; }
    const added = await mergeIn(lib);
    if (notify) ui.notifications.info(added ? t(added === 1 ? "Treasure Lists: added {n} entry from the shared library." : "Treasure Lists: added {n} entries from the shared library.", { n: added }) : t("Treasure Lists: this world already has everything in the shared library."));
    return added;
  }
  function exportLists() {
    const data = { format: 2, saved: new Date().toISOString(), modules: readAll() };
    const save = foundry.utils.saveDataToFile ?? globalThis.saveDataToFile;
    save(JSON.stringify(data, null, 1), "application/json", "axecleft-treasure-lists.json");
  }
  async function importLists(file) {
    const modules = fileModules(JSON.parse(await file.text()));
    if (!modules) throw new Error(t("That file has no treasure lists in it."));
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
      if (added) ui.notifications.info(t(added === 1 ? "Treasure Lists: loaded {n} custom entry from the shared library." : "Treasure Lists: loaded {n} custom entries from the shared library.", { n: added }));
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
    if (game.user?.isGM && (pageId(page) === `${CORR_MOD}|prices` || /price corrections/i.test(page?.name ?? ""))) { clearTimeout(rescanTimer); rescanTimer = setTimeout(() => scanCompendiums(), 1500); }
    api.refresh();
    if (suppressSave || userId !== game.user?.id || !game.user?.isGM || librarySync() !== "auto") return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveLibrary(), 1500);
  }

  /* ---- the Lists tab ---- */
  function listInput(spec, c, name) {
    const i = c.input ?? {};
    const options = typeof i.options === "function" ? i.options() : i.options ?? [];
    if (i.type === "select") return `<select name="${name}">${options.map(([v, l]) => opt(v, t(l), i.value)).join("")}</select>`;
    if (i.type === "checks") return `<div class="atg-checks">${options.map(([v, l]) => `<label><input type="checkbox" name="${name}" value="${esc(v)}"> ${esc(t(l))}</label>`).join("")}</div>`;
    if (i.type === "number") return `<input type="number" name="${name}" value="${esc(i.value ?? "")}"${i.min !== undefined ? ` min="${i.min}"` : ""}${i.max !== undefined ? ` max="${i.max}"` : ""} step="${i.step ?? 1}">`;
    return `<input type="text" name="${name}" placeholder="${esc(i.placeholder ? t(i.placeholder) : "")}">`;
  }
  const chips = (rows, m, k, label) => (rows.length
    ? `<div class="atg-chips">${rows.slice(0, 200).map((r) => `<span class="atg-chip">${esc(label(r))}<a data-remove="${esc(JSON.stringify([m, k, r.name, r.list]))}" title="${esc(t("Remove"))}">✕</a></span>`).join("")}${rows.length > 200 ? ` <em>${esc(t("…and {n} more (see the journal)", { n: rows.length - 200 }))}</em>` : ""}</div>`
    : `<p class="hint">${esc(t("None."))}</p>`);

  const LISTS_TAB = {
    module: "axecleft-treasure", name: "lists", id: "t-axecleft-treasure-lists", title: /*t*/"Lists", icon: "fas fa-list", order: 1000,
    async prepare() { for (const s of activeLists()) { try { await s.prepare?.(); } catch (e) { console.warn(`AxecleftTreasure | ${s.id} prepare failed`, e); } } },
    content(app) {
      const specs = activeLists(), mods = listModules(), all = readAll();
      const sel = specs.find((s) => s.id === app.listSel) ?? specs.find((s) => s.id === recall("lists.sel", "")) ?? specs[0];
      app.listSel = sel?.id;
      const sync = librarySync() === "auto";
      const counts = mods.map((m) => `${mods.length > 1 ? `<tr><th colspan="3" style="text-align:left;padding-top:4px">${esc(modTitle(m))}</th></tr>` : ""}`
        + specs.filter((s) => s.module === m).map((s) => {
          const off = (all[m]?.[DISABLED] ?? []).filter((d) => [s.key, ...(s.scopes ?? []).map((x) => x[0])].includes(d.list)).length;
          return `<tr><td>${esc(t(s.page))}</td><td>${esc(t("{n} added", { n: all[m]?.[s.key]?.length ?? 0 }))}</td><td>${off ? esc(t("{n} switched off", { n: off })) : ""}</td></tr>`;
        }).join("")
        + `${(all[m]?.[DISABLED] ?? []).some((d) => d.list === "any") ? `<tr><td>${esc(t("Any list"))}</td><td></td><td>${esc(t("{n} switched off", { n: all[m][DISABLED].filter((d) => d.list === "any").length }))}</td></tr>` : ""}`).join("");
      const listOpts = mods.map((m) => `<optgroup label="${esc(modTitle(m))}">${specs.filter((s) => s.module === m).map((s) => opt(s.id, t(s.label), sel?.id)).join("")}</optgroup>`).join("");
      const forms = specs.map((s, i) => {
        const mine = all[s.module]?.[s.key] ?? [];
        const targets = [[s.key, t("This list")], ...(s.scopes ?? []).map(([v, l]) => [v, t(l)]), ["any", t("Every {module} list", { module: modTitle(s.module) })]];
        const offRows = (all[s.module]?.[DISABLED] ?? []).filter((d) => targets.some(([v]) => v === d.list));
        let names = [];
        try { names = s.names?.() ?? (typeof s.builtin === "function" ? s.builtin() : s.builtin ?? []).map((r) => r.name); } catch (e) { /* none */ }
        return `<div data-list-form="${esc(s.id)}" data-i="${i}">
          <fieldset><legend>${esc(t("Add to {list}", { list: t(s.page) }))}</legend>
            ${s.cols.map((c) => `<div class="form-group"><label${helpText(s, c.field) ? ` title="${esc(helpText(s, c.field))}"` : ""}>${esc(t(c.header))}</label>${listInput(s, c, `ladd.${i}.${c.field}`)}</div>`).join("")}
            ${noteHtml(s) ? `<div class="hint">${noteHtml(s)}</div>` : ""}
            <div class="atg-footer"><button type="button" data-lists="addRow" data-i="${i}"><i class="fas fa-plus"></i> ${esc(t("Add to List"))}</button></div>
            <details class="atg-sec" data-sec="mine"><summary>${esc(t("Your entries"))} <small>(${mine.length})</small></summary>${chips(mine, s.module, s.key, (r) => r.name)}</details>
          </fieldset>
          <fieldset><legend>${esc(t("Switch off built-in entries"))}</legend>
            <p class="hint">${esc(t("Switched-off entries are never used. They go on the \"{page}\" page.", { page: disabledSpec(s.module).page }))}</p>
            <div class="form-group"><label>${esc(t("Name"))}</label><input type="text" name="loff.${i}.name" list="atg-names-${i}"><datalist id="atg-names-${i}">${[...new Set(names)].sort().map((n) => `<option value="${esc(n)}">`).join("")}</datalist></div>
            <div class="form-group"><label>${esc(t("Where"))}</label><select name="loff.${i}.list">${targets.map(([v, l]) => opt(v, l)).join("")}</select></div>
            <div class="atg-footer"><button type="button" data-lists="disable" data-i="${i}"><i class="fas fa-ban"></i> ${esc(t("Switch Off"))}</button></div>
            ${chips(offRows, s.module, DISABLED, (r) => (r.list === s.key ? r.name : `${r.name} (${targets.find(([v]) => v === r.list)?.[1] ?? r.list})`))}
          </fieldset></div>`;
      }).join("");
      return `
        <p class="hint">${t("Your own entries for Axecleft's modules live in the <strong>{journal}</strong> journal (edit its tables directly, or use this tab).", { journal: esc(JOURNAL_NAME) })} ${sync
          ? t("Every change is also saved to the shared library <code>Data/{path}</code>, which module updates never touch and every world on this server loads.", { path: esc(libraryPath()) })
          : esc(t("Automatic library sync is off (module settings); use the buttons below."))}</p>
        <table class="atg-counts">${counts}</table>
        <div class="atg-footer">
          <button type="button" data-lists="openJournal"><i class="fas fa-book-open"></i> ${esc(t("Open Lists Journal"))}</button>
          <button type="button" data-lists="saveLibrary"><i class="fas fa-cloud-arrow-up"></i> ${esc(t("Save to Library"))}</button>
          <button type="button" data-lists="loadLibrary"><i class="fas fa-cloud-arrow-down"></i> ${esc(t("Load from Library"))}</button>
        </div>
        <div class="form-group" style="margin-top:8px"><label>${esc(t("List"))}</label><select name="lists.sel">${listOpts}</select></div>
        ${forms}
        <fieldset><legend>${esc(t("Another Foundry server"))}</legend>
          <p class="hint">${esc(t("Export downloads your lists (every active module's) as a file; Import merges such a file in (it only adds entries). Files exported by Gemstones 1.14 work too."))}</p>
          <div class="atg-footer">
            <button type="button" data-lists="export"><i class="fas fa-file-export"></i> ${esc(t("Export"))}</button>
            <button type="button" data-lists="import"><i class="fas fa-file-import"></i> ${esc(t("Import"))}</button>
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
        try { const added = await importLists(file); ui.notifications.info(t(added === 1 ? "Imported {n} new entry." : "Imported {n} new entries.", { n: added })); app.render(); }
        catch (err) { ui.notifications.error(t("Import failed: {error}", { error: err.message })); }
        ev.target.value = "";
      });
      section.querySelectorAll("[data-remove]").forEach((a) => a.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const [m, k, name, list] = JSON.parse(a.dataset.remove);
        try { await removeRow(m, k, name, list ?? undefined); ui.notifications.info(t("Removed \"{name}\".", { name })); app.render(); }
        catch (err) { ui.notifications.error(err.message); }
      }));
      section.querySelectorAll("[data-lists]").forEach((b) => b.addEventListener("click", async (ev) => {
        ev.preventDefault();
        b.disabled = true;
        try {
          const i = Number(b.dataset.i), s = specs[i];
          switch (b.dataset.lists) {
            case "openJournal": (await getJournal()).sheet.render(true); break;
            case "saveLibrary": if (await saveLibrary()) ui.notifications.info(t("Saved your lists to Data/{path}.", { path: libraryPath() })); break;
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
              ui.notifications.info(t("Added \"{name}\" to {list}.", { name: r.name, list: t(s.page) }));
              app.render();
              break;
            }
            case "disable": {
              const name = el(`loff.${i}.name`).value.trim();
              if (!name) throw new Error(t("Type the name of the entry to switch off."));
              await addRow(s.module, DISABLED, { name, list: el(`loff.${i}.list`).value });
              el(`loff.${i}.name`).value = "";
              ui.notifications.info(t("Switched off \"{name}\".", { name }));
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
    .atg input[type=number] { text-align: right; }
    .atg input[type=number].atg-ft { text-align: start; }
    .atg .atg-checks { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
    .atg .atg-checks label { display: flex; gap: 4px; align-items: center; flex: none; }
    .atg .atg-checks .hint { margin: 0; }
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
      const std = cur.std.map((c) => opt(c.key, `${c.name}${c.name !== c.id ? ` (${c.id})` : ""}${c.key === `std:${k}` ? ` ${t("(as rolled)")}` : ` (${gp(c.value)})`}`, cfg.map[k])).join("");
      const groups = [...new Set(cur.custom.map((c) => c.group))];
      const custom = groups.map((g) => `<optgroup label="${esc(g || t("Custom currencies"))}">${cur.custom.filter((c) => c.group === g)
        .map((c) => opt(c.key, `${c.name} (${c.value > 0 ? gp(c.value) : t("no gp value set")})`, cfg.map[k])).join("")}</optgroup>`).join("");
      return `<optgroup label="${esc(t("Standard coins"))}">${std}</optgroup>${custom}`;
    };
    const rows = STD.slice().reverse().map((k) => `<div class="form-group"><label>${esc(t("Pay {coin} as", { coin: `${cur.name(k)}${cur.name(k) !== k ? ` (${k})` : ""}` }))}</label><select name="coin.${k}" data-coin="${k}">${choices(k)}</select></div>`).join("");
    const changed = STD.filter((k) => cfg.map[k] !== `std:${k}`).map((k) => t("{coin} as {other}", { coin: cur.name(k), other: cur.byKey(cfg.map[k])?.name ?? "?" }));
    const note = [changed.length ? changed.join(", ") : t("paid as rolled"), cfg.purse === "altCurrency" ? t("weightless") : ""].filter(Boolean).join("; ");
    return `<details class="atg-sec atg-coins" data-sec="coins" ${recall("sec.coins", "0") === "1" ? "open" : ""}><summary>${esc(t("Coins"))} <small>(${esc(note)})</small></summary>
      <p class="hint">${esc(t("The SRD rolls copper, silver, gold and platinum. Pay each as itself or as any other currency, including D35E custom currencies{custom}. Amounts convert by gp value; anything that doesn't make a whole coin is paid as change in standard coins. These choices are saved for this world.", { custom: cur.custom.length ? t(" ({n} set up in this world)", { n: cur.custom.length }) : t(" (none set up in this world; add them in D35E's Currency Configuration)") }))}</p>
      ${rows}
      <div class="form-group"><label>${esc(t("Standard coins go"))}</label><select name="coin.purse">${opt("currency", t("In the carried purse"), cfg.purse)}${opt("altCurrency", t("In the weightless coins"), cfg.purse)}</select></div>
      <div class="atg-preview" data-preview="coins"></div></details>`;
  }

  const LEVEL_TAB = {
    module: null, name: "treasure", title: /*t*/"Treasure by Level", icon: "fas fa-sack-dollar", order: 500, id: "t-treasure-level",
    content() {
      const status = (cats) => {
        const ps = [...new Set(cats.map((c) => providerFor(c)?.label).filter(Boolean))];
        const missing = cats.filter((c) => !providerFor(c));
        const names = esc(ps.map((x) => t(x)).join(", "));
        return ps.length && !missing.length ? `<span class="atg-ok">✔ ${names}</span>`
          : ps.length ? `<span class="atg-ok">✔ ${names}</span> <span class="atg-no">${esc(t("(rest listed in chat)"))}</span>`
          : `<span class="atg-no">✘ ${esc(t("needs {module}; listed in chat", { module: t(CATEGORIES[cats[0]].module) }))}</span>`;
      };
      const groups = [
        [/*t*/"Coins", null], [/*t*/"Gems and art objects", ["gem", "art"]], [/*t*/"Alchemical items, tools and gear", ["mundane:alchemical", "mundane:gear"]], [/*t*/"Poisons (Generation settings)", ["mundane:poison"]],
        [/*t*/"Weapons, armor and shields", ["mundane:weapon", "mundane:armor", "magic:weapon", "magic:armor"]],
        [/*t*/"Potions, rings, rods, scrolls, staffs, wands, wondrous items", ["magic:potion", "magic:ring", "magic:rod", "magic:scroll", "magic:staff", "magic:wand", "magic:wondrous"]],
      ];
      return `<p class="hint">${esc(t("Rolls the SRD Treasure table for an encounter level: coins, goods (gems, art) and items (mundane, minor, medium, major). Each part comes from the module that makes it; anything without its module is listed in the chat card for you to handle."))}</p>
        <div class="form-group"><label>${esc(t("Encounter Level"))}</label><select name="lvl.level">${Array.from({ length: 30 }, (_, i) => opt(i + 1, i < 20 ? t("EL {n}", { n: i + 1 }) : t(i > 20 ? "EL {n} (EL 20 + {m} major items)" : "EL {n} (EL 20 + {m} major item)", { n: i + 1, m: EXTRA_MAJOR[i - 20] }))).join("")}</select></div>
        <div class="form-group"><label>${esc(t("Roll"))}</label><div class="atg-checks">
          <label><input type="checkbox" name="lvl.coins" checked> ${esc(t("Coins"))}</label><label><input type="checkbox" name="lvl.goods" checked> ${esc(t("Goods"))}</label><label><input type="checkbox" name="lvl.items" checked> ${esc(t("Items"))}</label></div></div>
        <div class="form-group"><label>${esc(t("Treasure rolls"))}</label><input type="number" name="lvl.count" value="1" min="1" max="10" step="1"><span class="hint" style="flex:1">${esc(t("for each target"))}</span></div>
        <div class="atg-preview" data-preview="lvl"></div>
        <table class="atg-sources">${groups.map(([l, cats]) => `<tr><td>${esc(t(l))}</td><td>${cats ? status(cats) : `<span class="atg-ok">✔ ${esc(t("built in (paid as set below)"))}</span>`}</td></tr>`).join("")}</table>
        ${coinSection()}
        ${generationSection()}`;
    },
    wire(section) {
      const form = section.closest("form");
      const show = () => {
        const lvSel = Number(form.elements["lvl.level"].value) || 1;
        const row = LEVELS[Math.min(20, lvSel) - 1];
        /*t*/"cp"; /*t*/"sp"; /*t*/"gp"; /*t*/"pp"; /*t*/"gems"; /*t*/"art"; /*t*/"mundane"; // table words in the preview
        const fmt = (rows) => rows.filter((r) => r[2] !== "nothing").map((r) => `${r[0]}–${r[1]} ${diceText(r[3])} ${t(r[2])}`).join(", ");
        const ru = rules();
        const extra = lvSel > 20 ? ` ${t(lvSel > 21 ? "Plus {n} extra major items (DMG, EL 21+)" : "Plus {n} extra major item (DMG, EL 21+)", { n: EXTRA_MAJOR[lvSel - 21] })}${ru.epic ? t(", {share}% of them epic", { share: ru.epicShare ?? 25 }) : ` ${t("(turn on Epic items for epic ones)")}`}.` : "";
        section.querySelector("[data-preview=lvl]").innerHTML = esc(`${lvSel > 20 ? `${t("EL 20 row.")} ` : ""}${t("Coins: {c}. Goods: {g}. Items: {i}.", { c: fmt(row.coins), g: fmt(row.goods), i: fmt(row.items) })}${extra}`);
      };
      form.elements["lvl.level"].addEventListener("change", show);
      show();
      const coinPreview = () => {
        const cfg = { map: Object.fromEntries(STD.map((k) => [k, form.elements[`coin.${k}`]?.value || `std:${k}`])), purse: form.elements["coin.purse"]?.value || "currency" };
        const ex = convertCoins({ gp: 1234, sp: 56, cp: 78 }, cfg);
        const p = section.querySelector("[data-preview=coins]");
        if (p) p.textContent = t("Example: {example} is paid as {coins}.", { example: `${num(1234)} ${t("gp")} + 56 ${t("sp")} + 78 ${t("cp")}`, coins: ex.text });
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
        // Cursed items: show the flat rate or the rates by grade
        const curseMethod = () => { const m = gen.querySelector("[name='gen.curse.method']")?.value ?? "flat"; gen.querySelectorAll("[data-curse]").forEach((x) => { x.style.display = x.dataset.curse === m ? "" : "none"; }); };
        gen.querySelector("[name='gen.curse.method']")?.addEventListener("change", curseMethod);
        curseMethod();
        gen.querySelector("[data-curse-pack]")?.addEventListener("click", async (ev) => {
          ev.preventDefault(); const btn = ev.currentTarget; btn.disabled = true;
          try { (await buildCurseCompendium())?.render?.(true); } catch (err) { console.error("AxecleftTreasure | curse compendium failed", err); ui.notifications.error(err.message); }
          finally { btn.disabled = false; }
        });
        gen.querySelector("[data-gen-reset]")?.addEventListener("click", async (ev) => {
          ev.preventDefault();
          clearTimeout(tmo); pendingGen = null;
          await resetGeneration();
          ui.notifications.info(t("Generation settings reset to the defaults."));
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
    module: null, name: "loot", title: /*t*/"Token Loot", icon: "fas fa-sack-dollar", order: 510, id: "t-token-loot",
    content() {
      const s = lootSettings();
      const cb = (k, label) => `<label class="atg-cb"><input type="checkbox" name="loot.${k}" ${s[k] ? "checked" : ""}> ${esc(t(label))}</label>`;
      const H = (s) => `<p class="hint">${t(s)}</p>`;
      const sel = (canvas?.tokens?.controlled ?? []).map((tk) => tk.document);
      const pctText = (a) => { const p = treasurePct(a); const w = { 0: /*t*/"none", 100: "standard", 200: "double", 300: "triple" }[p.coins]; return p.coins === p.goods && p.goods === p.items ? (w ? t(w) : `${p.coins}%`) : t("coins {c}%, goods {g}%, items {i}%", { c: p.coins, g: p.goods, i: p.items }); };
      const crText = (cr) => (cr > 0 && cr < 1 ? `1/${Math.round(1 / cr)}` : String(cr));
      const rows = sel.map((tk) => {
        const why = lootProblem(tk);
        const rec = lootRecord(tk);
        return `<tr><td>${esc(tk.name)}${tk.actorLink ? "" : ` <small>${esc(t("(unlinked)"))}</small>`}</td><td>${["npc", "trap"].includes(tk.actor?.type) ? esc(t("CR {cr}", { cr: crText(crOf(tk.actor)) })) : "—"}</td><td>${tk.actor?.type === "npc" ? esc(pctText(tk.actor)) : tk.actor?.type === "trap" ? esc(t("trap, ×{share}", { share: { 0.25: "¼", 0.5: "½", 0.75: "¾", 1: "1" }[s.trapShare] ?? s.trapShare })) : "—"}</td>
          <td>${why ? `<span class="atg-no">${esc(why)}</span>` : rec ? `<span class="atg-ok">${esc(t("has loot"))}</span>` : ""}</td></tr>`;
      }).join("");
      return `${H("Each token gets its own roll on the SRD Treasure table, at its Challenge Rating (SRD: a lone creature's treasure uses its CR as the encounter level), scaled by the <strong>Treasure</strong> setting on its NPC sheet (D35E: None, Standard, Double, Triple or a % for coins, goods and items). Items go into that token's inventory with their value rolled, and coins into its purse, ready to loot. An unlinked token keeps its loot on that one creature; a linked token's loot goes on its actor.")}
        <fieldset><legend>${esc(t("Selected tokens"))}</legend>
          ${sel.length ? `<table class="atg-sources"><thead><tr><th>${esc(t("Token"))}</th><th>${esc(t("CR"))}</th><th>${esc(t("Treasure"))}</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : H("No tokens selected. Select NPC tokens on the scene, then press <em>Refresh</em> or the buttons below.")}
          <div class="atg-footer"><button type="button" data-loot="refresh"><i class="fas fa-rotate"></i> ${esc(t("Refresh"))}</button><button type="button" data-loot="clear"><i class="fas fa-eraser"></i> ${esc(t("Clear Loot"))}</button><button type="button" data-loot="roll" class="bright"><i class="fas fa-dice-d20"></i> ${esc(t("Roll Loot for Selected Tokens"))}</button></div>
          <div class="form-group"><label>${esc(t("Roll"))}</label><div class="atg-checks">${cb("coins", /*t*/"Coins")}${cb("goods", /*t*/"Goods")}${cb("items", /*t*/"Items")}</div></div>
          <div class="atg-checks">${cb("replace", /*t*/"Replace loot rolled before (its items and coins are taken back first)")}</div>
          <div class="form-group"><label>${esc(t("Trap loot"))}</label><select name="loot.trapShare">${[[0.25, /*t*/"¼ of a creature's treasure"], [0.5, "½"], [0.75, "¾"], [1, /*t*/"The full treasure for its CR"]].map(([v, l]) => opt(v, t(l), s.trapShare)).join("")}</select></div>
          ${H("Traps can get incidental loot too (bones and belongings of earlier victims): select trap tokens and roll. Rolled at the trap's CR, scaled by this share; never automatic.")}
          ${H("Clear Loot removes only what the Treasure Generator put on the token: its marked items and the coins it added. The same roll is on the token toolbar ({icon}).").replace("{icon}", '<i class="fas fa-sack-dollar"></i>')}
        </fieldset>
        <fieldset><legend>${esc(t("Automatic loot"))}</legend>
          <div class="atg-checks">${cb("auto", /*t*/"Roll loot when an unlinked NPC token is placed on a scene")}</div>
          <div class="atg-checks">${cb("chat", /*t*/"Post a chat card (GM only) for each token's loot")}${cb("hidden", /*t*/"Hidden tokens too")}</div>
          ${H("Only unlinked NPC tokens (never traps), never characters or tokens a player owns, and never a token that already has loot (a copied token keeps the loot it was copied with). Saved for this world.")}
        </fieldset>
        ${H("CR below 1: EL 1, with each part's chance scaled by the CR (CR 1/2 rolls half the time). CR 21–30: EL 21–30 (the EL 20 row plus extra major items, some of them epic while Epic items is on); above 30, EL 30. NPCs with class levels carry NPC gear in the SRD instead of treasure; set their Treasure to None if you equip them by hand. Parts and sources follow the Treasure by Level tab (coins paid as set there, Generation settings for light, poisons and the rest).")}`;
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

  class TreasureGenerator extends (globalThis.AxecleftTools?.AppV2 ?? foundry.applications.api.ApplicationV2) {
    static DEFAULT_OPTIONS = {
      id: "axecleft-treasure-generator",
      classes: ["axecleft-treasure-generator"],
      window: { title: "Treasure Generator", icon: "fas fa-gem", resizable: true },
      position: { width: 600, height: "auto" },
    };
    get title() { return t("Treasure Generator"); }

    tab = recall("tab", null);
    values = null;

    tabs() {
      return [...[...registry.tabs.values()].filter(isActive), LEVEL_TAB, LOOT_TAB, ...(activeLists().length ? [LISTS_TAB] : [])].sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
    }

    async _renderHTML() {
      const tabs = this.tabs();
      for (const tb of tabs) { try { await tb.prepare?.(this); } catch (err) { console.error(`AxecleftTreasure | ${tb.module}.${tb.name} prepare failed`, err); } }
      const sections = tabs.map((tb) => {
        let body;
        try { body = tb.content(this) ?? ""; } catch (err) { body = `<p class="hint">${esc(t("This tab failed to load: {error}", { error: err.message }))}</p>`; console.error(`AxecleftTreasure | ${tb.module}.${tb.name}`, err); }
        return `<section data-tab="${tb.id}">${body}</section>`;
      }).join("");
      const nav = `<nav class="atg-tabs">${tabs.map((tb) => `<button type="button" data-tab-btn="${tb.id}"><i class="${esc(tb.icon)}"></i> ${esc(t(tb.title))}</button>`).join("")}</nav>`;
      const buttons = [...registry.buttons.values()].filter(isActive);
      const extButtons = buttons.length ? `<div class="atg-ext-buttons">${buttons.map((b) => `<button type="button" data-ext-button="${esc(`${b.module}.${b.name}`)}" title="${esc(b.hint ? t(b.hint) : "")}"><i class="${esc(b.icon)}"></i> ${esc(t(b.title))}</button>`).join("")}</div>` : "";

      const mode = recall("dest", "selected");
      const tokens = (canvas?.scene?.tokens?.contents ?? []).filter((tk) => tk.actor).sort((a, b) => a.name.localeCompare(b.name));
      const actors = [...(game.actors ?? [])].sort((a, b) => a.name.localeCompare(b.name));
      const actorOpts = opt("", t("Choose an actor or token…"))
        + (tokens.length ? `<optgroup label="${esc(t("Tokens on this scene"))}">${tokens.map((tk) => opt(tk.uuid, `${tk.name}${tk.actorLink ? "" : ` ${t("(unlinked token)")}`}`)).join("")}</optgroup>` : "")
        + (actors.length ? `<optgroup label="${esc(t("Actors"))}">${actors.map((a) => opt(a.uuid, `${a.name} (${a.type})`)).join("")}</optgroup>` : "");
      const footer = `<fieldset class="atg-dest" data-gen><legend>${esc(t("Put items in"))}</legend>
          <div class="form-group"><label>${esc(t("Destination"))}</label><select name="dest.mode">
            ${opt("selected", t("Selected tokens (each gets its own roll)"), mode)}${opt("actor", t("A chosen actor or token"), mode)}
            ${opt("items", t("Items sidebar (\"{folder}\" folder)", { folder: t(ITEM_FOLDER) }), mode)}${opt("chat", t("Chat card only (create items later)"), mode)}</select></div>
          <div class="form-group" data-dest="actor"><label>${esc(t("Actor or token"))}</label><select name="dest.uuid">${actorOpts}</select></div>
          <div class="atg-drop" data-dest="actor"><i class="fas fa-hand-pointer"></i> ${esc(t("Or drag an actor here from the Actors sidebar"))}</div>
          <p class="hint" data-dest="selected actor">${esc(t("Items go straight into the inventory with their true value already rolled, ready for a loot sheet; coins go into the purse. An unlinked token keeps its loot on that one creature."))}</p>
          <p class="hint" data-dest="items chat">${esc(t("Items start unappraised; their true value is rolled when they are dropped onto a character."))}</p>
        </fieldset>
        <div class="atg-footer sticky" data-gen><button type="button" data-action="generate" class="bright"><i class="fas fa-dice-d20"></i> ${esc(t("Generate"))}</button></div>`;
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
        const tb = tabs.find((x) => x.id === id) ?? tabs[0];
        this.tab = tb.id; remember("tab", tb.id);
        form.querySelectorAll("[data-tab-btn]").forEach((b) => b.classList.toggle("active", b.dataset.tabBtn === tb.id));
        form.querySelectorAll("section[data-tab]").forEach((s) => s.classList.toggle("active", s.dataset.tab === tb.id));
        const gen = tb === LEVEL_TAB || typeof tb.generate === "function";
        form.querySelectorAll("[data-gen]").forEach((g) => { g.style.display = gen ? "" : "none"; });
        this.#fitHeight();
      };
      form.querySelectorAll("[data-tab-btn]").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tabBtn)));

      for (const tb of tabs) {
        const sec = form.querySelector(`section[data-tab="${tb.id}"]`);
        try { tb.wire?.(sec, this); } catch (err) { console.error(`AxecleftTreasure | ${tb.module}.${tb.name} wire failed`, err); }
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
        if (!data?.uuid || !["Actor", "Token"].includes(data.type)) return ui.notifications.warn(t("Drop an actor from the Actors sidebar."));
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
        try { await def?.onClick?.(this); } catch (err) { console.error(`AxecleftTreasure | ${b.dataset.extButton} failed`, err); ui.notifications.error(t("{tool} failed: {error}", { tool: t(def.title), error: err.message })); }
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
      if (mode === "actor" && !v("dest.uuid")) throw new Error(t("Choose an actor or token (or drag one onto the window)."));
      const dest = mode === "actor" ? { mode, uuid: v("dest.uuid") } : mode;
      const tab = this.tabs().find((x) => x.id === this.tab);
      if (tab === LEVEL_TAB) {
        const cb = (n) => !!form.elements[n]?.checked;
        return generateTreasure({ level: Number(v("lvl.level")), times: v("lvl.count"), dest, coins: cb("lvl.coins"), goods: cb("lvl.goods"), items: cb("lvl.items"), form });
      }
      if (typeof tab?.generate !== "function") return;
      const section = form.querySelector(`section[data-tab="${tab.id}"]`);
      const title = tab.generateTitle?.(form) ?? t(tab.title);
      return runGeneration({ title, dest, rollFor: (actor) => tab.generate(form, { actor, section, app: this }) });
    }
  }

  let APP = existing?._app ?? null;
  function open(tab = null) {
    if (!game.user.isGM) return ui.notifications.warn(t("Only the GM can generate treasure."));
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
    registerSourceKind, sourceKinds, kindSources, setKindSources, kindItems, kindStats,
    registerPriceCorrections, priceCorrections, correctionFor, correctedPrice, applyPriceCorrection, priceCheck, exportPriceCheck,
    generation, saveGeneration, resetGeneration, genChance, GEN_DEFAULTS, GEN_CATS,
    // Version 9.96: cursed items (SRD tables); curse({ name, data, summary }, category, ctx, { force: "random" | type }) for the Forge and Workshop
    curse: maybeCurse, rollCurse, curseData, curseChance, curseSettings, CURSE_LABELS, CURSE_TYPES: ["delusion", "reversed", "intermittent", "requirement", "drawback", "different", "specific"],
    curseBuffData, allCurseBuffs, buildCurseCompendium, curseField, curseEntries, curseCategoryOf, curseRows, parsePenalties, builtinCurseRows, _onItemSheetCurse: onItemSheetCurse, _onItemUpdateCurse: onItemUpdateCurse, _onItemDeleteCurse: onItemDeleteCurse,
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
        module: CORR_MOD, key: "prices", page: /*t*/"Price Corrections", label: /*t*/"Price correction", order: 900,
        intro: /*t*/"Fix the price of compendium items without editing the compendium. Corrections apply to generated treasure and merchant stock; an item whose compendium price already matches is left alone.",
        help: { name: /*t*/"the item's name, as in its compendium.", pack: /*t*/"the compendium id (for example D35E.magicitems); leave it blank for any compendium.", price: /*t*/"the right price, in gp.", note: /*t*/"optional: where the price comes from." },
        note: /*t*/"Built-in corrections come from Axecleft's modules (switch one off on the Disabled Entries page).",
        example: { name: "Flame Tongue", pack: "D35E.magicitems", price: 20715, note: "SRD price" },
        cols: [["name", /*t*/"Item"], ["pack", /*t*/"Compendium", { type: "text", placeholder: /*t*/"blank: any compendium" }], ["price", /*t*/"Price (gp)", { type: "number", value: 0, min: 0, step: 0.01 }], ["note", /*t*/"Note"]],
        builtin: () => [...registry.corrections.values()].flat().map((c) => ({ name: c.name, pack: c.pack ?? "", price: c.price, note: c.note ?? "" })),
      });
      // Version 9.97: custom curses (the SRD tables are its built-in rows)
      registerList({
        module: CORR_MOD, key: "curses", page: /*t*/"Custom Curses", label: /*t*/"Curse", order: 910,
        intro: /*t*/"Your own curses for random and crafted cursed items, rolled with the SRD's.",
        help: {
          name: /*t*/"the curse's name (for a specific cursed item: the item's name, from your item compendiums or the Items sidebar).",
          table: /*t*/"a curse of its own (rolled among delusion, opposite effect and the other common curses), a drawback, a dependent situation for intermittent functioning, a cursed psionic item's curse, or a specific cursed item.",
          weight: /*t*/"its share of the d% table, as the SRD's rows have (01–05 = 5).",
          kinds: /*t*/"which magic items can get it, separated by commas (blank: any).",
          text: /*t*/"what the curse does, in a sentence. It goes in the cursed item's description and on its curse buff.",
          penalties: /*t*/"optional: what the curse buff applies while the curse is active, separated by semicolons: -2 attack; -2 saves; -1 str; -4 spot; -5 hp (also melee, ranged, damage, ac, fort, ref, will, checks, skills, init, speed, or a skill's English name).",
        },
        note: /*t*/"The SRD's own curses are listed as built-in rows; switch one off on the Disabled Entries page.",
        example: { name: "Leaden Hands", table: "drawback", weight: 5, kinds: ["arms", "wondrous"], text: "The bearer's hands feel heavy and clumsy.", penalties: "-2 attack; -2 sleight of hand" },
        cols: [["name", /*t*/"Curse"], ["table", /*t*/"Table", { type: "select", options: CURSE_TABLES }], ["weight", /*t*/"Weight", { type: "number", value: 5, min: 0, step: 1 }],
          ["kinds", /*t*/"Items", { type: "checks", options: CURSE_KINDS }], ["text", /*t*/"What it does"], ["penalties", /*t*/"Penalties (buff)", { placeholder: /*t*/"-2 attack; -2 saves" }]],
        normalize: (r) => ({ name: String(r.name ?? "").trim(), table: optionKey(CURSE_TABLES, r.table) ?? "common", weight: Math.max(0, Number(r.weight) || 0),
          kinds: [...new Set((Array.isArray(r.kinds) ? r.kinds : String(r.kinds ?? "").split(/[,;/]/)).map((x) => optionKey(CURSE_KINDS, x)).filter(Boolean))],
          text: String(r.text ?? "").trim(), penalties: String(r.penalties ?? "").trim() }),
        format: (f, r) => (f === "table" ? t(CURSE_TABLES.find(([k]) => k === r.table)?.[1] ?? r.table) : f === "kinds" ? (r.kinds?.length ? r.kinds.map((k) => t(CURSE_KINDS.find(([x]) => x === k)?.[1] ?? k)).join(", ") : t("any")) : undefined),
        builtin: () => builtinCurseRows(),
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
      let tmr = null;
      const changed = (doc) => {
        if (!game.user.isGM || !doc?.pack || !itemSources().packs.includes(doc.pack)) return;
        clearTimeout(tmr); tmr = setTimeout(() => globalThis.AxecleftTreasure.scanCompendiums?.(), 2000);
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
        module: h ?? "axecleft-treasure", name: "treasure-generator", title: /*t*/"Treasure Generator", icon: "fas fa-gem",
        hint: /*t*/"Generate treasure: coins, gems, art, jewelry and items", gmOnly: true, onClick: () => globalThis.AxecleftTreasure.open(),
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
      btn.innerHTML = `<i class="fas fa-gem"></i> ${esc(t("Treasure"))}`;
      btn.addEventListener("click", (ev) => { ev.preventDefault(); globalThis.AxecleftTreasure.open(); });
      target.append(btn);
    },
  };
  globalThis.AxecleftTreasure = api;

  // Hooks are added once (by the first copy) and always call the newest copy.
  if (!existing && globalThis.Hooks) {
    Hooks.once("init", () => globalThis.AxecleftTreasure._onInit());
    globalThis.AxecleftTools?.onChatRender ? globalThis.AxecleftTools.onChatRender((m, h) => globalThis.AxecleftTreasure._onChat(m, h)) : Hooks.on("renderChatMessageHTML", (m, h) => globalThis.AxecleftTreasure._onChat(m, h));
    Hooks.on("renderItemDirectory", (a, h) => globalThis.AxecleftTreasure._onItemDirectory(a, h));
    // Version 9.96: the curse on the item sheet (GM only), and in the description once the GM ticks "Curse Identified"
    for (const h of ["renderItemSheet", "renderItemSheetV2"]) Hooks.on(h, (app, html) => globalThis.AxecleftTreasure._onItemSheetCurse?.(app, html));
    Hooks.on("updateItem", (item, changes) => globalThis.AxecleftTreasure._onItemUpdateCurse?.(item, changes));
    Hooks.on("deleteItem", (item) => globalThis.AxecleftTreasure._onItemDeleteCurse?.(item));
  }
})();
