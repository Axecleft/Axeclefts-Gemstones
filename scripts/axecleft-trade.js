/**
 * Axecleft's Trade — shared script: Axecleft's Shop, its own actor sheet for NPC actors in three kinds (mode): a
 * merchant (buy, sell, a basket, haggling, pickpocketing and shoplifting, security, a log), a loot pile and party
 * storage (take, put in, split the coins, sneak things out, locks and traps, a log). Tours of each (players and GM).
 *
 * Copy this same file into every Axecleft module that has the Merchant Generator, and list it in module.json
 * "esmodules" AFTER scripts/axecleft-tools.js, scripts/axecleft-treasure.js and scripts/axecleft-merchants.js, BEFORE
 * the module's own scripts. The module also needs "socket": true. Whichever copy has the highest version runs.
 *
 * The sheet is an ordinary actor sheet for NPC actors ("Axecleft's Shop" in the sheet list), opened by double-clicking
 * the token. The Merchant Generator puts its merchants on it; the Actors sidebar's right-click menu makes an NPC actor a
 * loot container or party storage (GM). Players need only Limited or Observer (never Owner): every trade, take and
 * lock attempt is sent to the GM's game, which checks it (the player owns the character, the item is there and not
 * hidden, the money is there) and moves the coins and items. Without a GM in the game, nothing happens.
 *
 * Pickpocketing and shoplifting: a player picks a character's pockets (the token layer's hand button, on the token they
 * target) or a shop's (its sheet), or shoplifts from its stock. Their Sleight of Hand goes to the GM's game, which rolls
 * the target's Spot and whispers the GM a card to decide on (with a time-out for the player, a lock-out from the shop, and
 * a box for the target's reaction). Characters a player owns can't be robbed. User flag: flags.world.axecleftTimeout (ms).
 *
 * Saved on the actor: flags.world.axecleftShop = { mode: "merchant" | "loot" | "storage", sell, buy (percent), tradeSell,
 *   tradeBuy (percent for trade goods; empty: the world's house rule), haggle (bool), skills: { dip, int, blf } (haggling
 *   skills), haggles: { <actor id>: { pct, total, name, skill } }, chat: "public" | "gm" | "none", steal (bool),
 *   security: [keys], locked: { <actor id>: name } (lock-outs), and for loot and storage (lootOf): split (bool),
 *   opened (bool), lock: { locked, quality, dc, arcane, key, box, hardness, hp, breakDc, broken }, trap: { armed, actor,
 *   name, searchDc, disableDc, save, saveDc, damage, half, poison, found: [actor ids] }, log: [{ t, text, secret }] }
 * and on its items: flags.world.axecleftHidden (not shown to players).
 * The Merchant Generator's saved settings (flags.world.axecleftMerchant) and D35E's loot sheet flags are read as a
 * fallback, so merchants made before this sheet work as they are.
 */
const AXECLEFT_TRADE_VERSION = 1.37; // 1.37: the shop sheet registers on Foundry v11 (its Actors and TextEditor aren't properties of globalThis), so merchants open on it; 1.36: tours point at the sheet they opened, and show an example of the parts that aren't there yet (haggling, the basket, the lock, the log); 1.35: tours of the merchant, loot and party storage sheets (players and GM); 1.34: texts the language files missed (hide or show an item, a decided pickpocketing card); 1.33: the item list keeps its place when the sheet is redrawn (opening a description, adding to the basket, a trade); 1.32: an item's description pops up when the pointer rests on its name, and stays open under it when clicked (the unidentified one for an unidentified item); 1.31: a merchant's log (sales, purchases, haggling, pickpocketing, shoplifting, lock-outs) on the GM settings; a basket to buy several things at once; 1.3: Loot and Party storage sheets (take, put in, split coins, sneak things out), locks (keys, Open Lock, force, break, knock) and traps (simple, or a Traps module trap actor); D35E "valuable" items; 1.24: long buttons on the GM's pickpocketing card wrap instead of being cut off; 1.23: the GM opens the merchant's character sheet (D35E's NPC sheet: stats, skills, attacks) from the shop sheet; 1.22: the item list on the parchment too (Foundry's dark table rows made the items look greyed out); 1.21: a shop's security (guards, wards, locked goods…) changes the DCs and its Spot; 1.2: pickpocketing and shoplifting (the GM decides each one on a card in chat: time-outs, lock-outs, the target's reaction); the sheet on D35E's parchment; 1.13: 1.13: a haggle that goes against the buyer reads "worse prices" (not "-5% better"); 1.12: stock shows (D35E marks loose items with container "none"); players can use the sheet's tabs and buttons (Foundry disabled them on a sheet they don't own); the window's title is the merchant's name; 1.1: trade goods at their own sell and buy % (world house rule, or per shop); haggling with Diplomacy, Intimidate or Bluff
const AXECLEFT_TRADE_HOST = (() => {
  try { return decodeURIComponent(new URL(import.meta.url).pathname).match(/\/modules\/([^/]+)\//)?.[1] ?? null; } catch (e) { return null; }
})();

(() => {
  const existing = globalThis.AxecleftTrade;
  if (existing && existing.version >= AXECLEFT_TRADE_VERSION) { existing.hosts?.add(AXECLEFT_TRADE_HOST); return; }
  const hosts = existing?.hosts ?? new Set();
  if (AXECLEFT_TRADE_HOST) hosts.add(AXECLEFT_TRADE_HOST);

  const A = () => globalThis.AxecleftTools;
  const T = () => globalThis.AxecleftTreasure;
  const t = (s, d) => A()?.t?.(s, d) ?? (d ? String(s).replace(/\{(\w+)\}/g, (m, k) => d[k] ?? m) : String(s));
  const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const H = (s, d) => esc(t(s, d));
  const host = () => [...hosts].find((h) => game.modules.get(h)?.active) ?? [...hosts][0] ?? null;
  const SCOPE = "axecleft", SHEET_NAME = "AxecleftShopSheet";
  const SHEET = `${SCOPE}.${SHEET_NAME}`;
  const FLAG = "world", KEY = "axecleftShop", HIDDEN = "axecleftHidden";
  const TRADE_TYPES = ["weapon", "equipment", "consumable", "loot", "valuable"];
  const OWN = () => CONST.DOCUMENT_OWNERSHIP_LEVELS ?? CONST.DOCUMENT_PERMISSION_LEVELS;
  const getP = (o, p) => foundry.utils.getProperty(o, p);

  /* ------------------------------------------ */
  /*  Shop settings                             */
  /* ------------------------------------------ */

  /** The world's house rule for trade goods (percent; 100 by the SRD). */
  function worldPct(key) {
    try { const v = game.settings.get(settingNs, key); if (Number.isFinite(Number(v)) && v !== "" && v !== null) return Number(v); } catch (e) { /* not registered */ }
    return 100;
  }
  let settingNs = null;
  /** A merchant's settings, with the Merchant Generator's and D35E's as fallbacks. */
  function shopOf(actor) {
    const own = actor?.flags?.[FLAG]?.[KEY] ?? {};
    const gen = actor?.flags?.[FLAG]?.axecleftMerchant ?? {};
    const d35 = actor?.flags?.D35E ?? {};
    const pct = (v, d) => (Number.isFinite(Number(v)) && v !== null && v !== "" ? Number(v) : d);
    return {
      mode: own.mode ?? "merchant",
      sell: pct(own.sell, d35.priceModifier != null ? Math.round(Number(d35.priceModifier) * 100) : pct(gen.sell, 100)),
      buy: pct(own.buy, d35.priceModifierBuy != null ? Math.round(Number(d35.priceModifierBuy) * 100) : pct(gen.buy, 50)),
      // Trade goods (D35E's Full Resale Price: gems, art, jewelry): the shop's own %, else the world's house rule (100%)
      tradeSell: pct(own.tradeSell, worldPct("tradeGoodsSell")), tradeBuy: pct(own.tradeBuy, worldPct("tradeGoodsBuy")),
      tradeOwn: own.tradeSell != null && own.tradeSell !== "" || own.tradeBuy != null && own.tradeBuy !== "",
      haggle: !!own.haggle,
      skills: { dip: own.skills?.dip !== false, int: own.skills?.int !== false, blf: !!own.skills?.blf },
      haggles: own.haggles ?? {},
      steal: own.steal !== false, locked: own.locked ?? {},
      security: Array.isArray(own.security) ? own.security : Array.isArray(gen.security) ? gen.security : [],
      chat: own.chat ?? "public",
      shopName: gen.shop ?? "",
    };
  }

  /* ------------------------------------------ */
  /*  Money (in copper pieces)                  */
  /* ------------------------------------------ */

  const STD = [["pp", 1000], ["gp", 100], ["sp", 10], ["cp", 1]];
  const coinName = (k) => { try { return T()?.currencies?.().name(k) ?? k; } catch (e) { return k; } };
  const customs = () => { try { return (T()?.currencies?.().custom ?? []).filter((c) => c.value > 0); } catch (e) { return []; } };
  /** "12 gp 5 sp" for an amount in copper. */
  function money(cp) {
    cp = Math.round(Number(cp) || 0);
    if (!cp) return `0 ${coinName("gp")}`;
    const out = [];
    for (const [k, v] of STD.slice(1)) { const n = Math.floor(cp / v); if (n) { out.push(`${n.toLocaleString()} ${coinName(k)}`); cp -= n * v; } }
    return out.join(" ");
  }
  /** Every coin an actor has, as stacks from the smallest: [{ path, value (cp), count }] (carried coins before weightless ones). */
  function stacks(actor) {
    const s = actor?.system ?? {}, out = [];
    STD.forEach(([k, v]) => {
      out.push({ path: `system.currency.${k}`, value: v, count: Math.max(0, Math.floor(Number(s.currency?.[k]) || 0)), order: 0 });
      out.push({ path: `system.altCurrency.${k}`, value: v, count: Math.max(0, Math.floor(Number(s.altCurrency?.[k]) || 0)), order: 1 });
    });
    for (const c of customs()) out.push({ path: `system.customCurrency.${c.id}`, value: Math.round(c.value * 100), count: Math.max(0, Math.floor(Number(s.customCurrency?.[c.id]) || 0)), order: 2 });
    return out.filter((x) => x.value > 0).sort((a, b) => a.value - b.value || a.order - b.order);
  }
  const wealth = (actor) => stacks(actor).reduce((n, x) => n + x.value * x.count, 0);
  /**
   * The coins an actor hands over for a price: the biggest coins that fit, then smaller ones, then one coin big enough for
   * the rest, with the change given back in gold, silver and copper. → an actor update, or null when it can't pay.
   */
  function payment(actor, cost) {
    cost = Math.round(cost);
    if (cost <= 0) return {};
    const list = stacks(actor);
    if (list.reduce((n, x) => n + x.value * x.count, 0) < cost) return null;
    let left = cost;
    // The biggest coins that fit first (few coins, no change when it comes out even), then smaller ones for the rest
    for (const x of [...list].sort((p, q) => q.value - p.value || p.order - q.order)) { const n = Math.min(x.count, Math.floor(left / x.value)); x.take = n; left -= n * x.value; }
    for (const x of list) { const n = Math.min(x.count - x.take, Math.floor(left / x.value)); x.take += n; left -= n * x.value; }
    let change = 0;
    if (left > 0) {
      const x = list.find((y) => y.count - y.take > 0 && y.value >= left) ?? list.find((y) => y.count - y.take > 0);
      if (!x) return null;
      x.take += 1; change = x.value - left; left = 0;
    }
    const upd = {};
    for (const x of list) if (x.take) upd[x.path] = x.count - x.take;
    if (change > 0) addCoins(actor, change, upd);
    return upd;
  }
  /** Coins added to an actor (in the world's coins: the Treasure Generator's currency settings), into an update. */
  function addCoins(actor, cp, upd = {}) {
    cp = Math.round(cp);
    if (cp <= 0) return upd;
    const split = { gp: Math.floor(cp / 100), sp: Math.floor((cp % 100) / 10), cp: cp % 10 };
    let paid = { std: split, custom: {} }, purse = "currency";
    try { if (T()?.convertCoins) paid = T().convertCoins(split); purse = T()?.coinSettings?.().purse ?? "currency"; } catch (e) { /* plain coins */ }
    for (const [k, n] of Object.entries(paid.std ?? {})) if (n) { const p = `system.${purse}.${k}`; upd[p] = (upd[p] ?? (Number(getP(actor, p)) || 0)) + n; }
    for (const [id, n] of Object.entries(paid.custom ?? {})) if (n) { const p = `system.customCurrency.${id}`; upd[p] = (upd[p] ?? (Number(getP(actor, p)) || 0)) + n; }
    return upd;
  }

  /* ------------------------------------------ */
  /*  Items and prices                          */
  /* ------------------------------------------ */

  const qtyOf = (i) => { const q = getP(i, "system.quantity"); return q == null || q === "" ? 1 : Math.max(0, Number(q) || 0); };
  const unidentified = (i) => getP(i, "system.identified") === false;
  /** What a piece is worth (D35E's rule: an unidentified item at its unidentified price), in copper. */
  function valueOf(i) {
    const s = i?.system ?? {};
    const gpv = unidentified(i) && s.unidentified && s.unidentified.price != null && s.unidentified.price !== "" ? s.unidentified.price : s.price;
    return Math.round((Number(gpv) || 0) * 100);
  }
  /** The name a player sees (an unidentified item's unidentified name). */
  const shownName = (i) => (unidentified(i) && getP(i, "system.unidentified.name") ? i.system.unidentified.name : i.name);
  const isHidden = (i) => !!i?.flags?.[FLAG]?.[HIDDEN];
  /** In a container? D35E marks loose items with containerId "none" (or leaves it empty). */
  const inContainer = (i) => { const c = getP(i, "system.containerId"); return !!c && c !== "none"; };
  /** Items a shop shows (players don't see hidden ones). */
  const stockOf = (shop, user = game.user) => shop.items.filter((i) => TRADE_TYPES.includes(i.type) && !inContainer(i) && (user.isGM || !isHidden(i)));
  /** Items a character can sell: arms, gear, consumables and loot not inside a container. */
  const sellable = (actor) => actor.items.filter((i) => TRADE_TYPES.includes(i.type) && !inContainer(i) && qtyOf(i) > 0);
  const haggleOf = (shop, buyer) => Number(shopOf(shop).haggles?.[buyer?.id]?.pct) || 0;
  const isTradeGoods = (item) => !!getP(item, "system.fullResalePrice");
  /** What the shop asks for one piece (sell %, or the trade goods %), less the buyer's haggling. */
  function askPrice(shop, item, buyer) {
    const s = shopOf(shop);
    return Math.max(0, Math.round(valueOf(item) * (isTradeGoods(item) ? s.tradeSell : s.sell) / 100 * (1 - haggleOf(shop, buyer) / 100)));
  }
  /**
   * What the shop pays for one piece: trade goods (D35E's Full Resale Price: gems, art, jewelry) at the trade goods %
   * (100% by the SRD), the rest at buy %, plus haggling, never more than the item's value (or the trade goods % when that's above it).
   */
  function offerPrice(shop, item, seller) {
    const s = shopOf(shop), v = valueOf(item);
    const pct = isTradeGoods(item) ? s.tradeBuy : s.buy;
    const cap = v * Math.max(100, isTradeGoods(item) ? s.tradeBuy : 0) / 100;
    return Math.max(0, Math.min(Math.round(cap), Math.round(v * pct / 100 * (1 + haggleOf(shop, seller) / 100))));
  }

  /** The same item (to stack onto): same type and name, and the same data apart from quantity and where it is. */
  function sameItem(a, data) {
    if (a.type !== data.type || a.name !== data.name) return false;
    const strip = (s) => { const c = foundry.utils.deepClone(s ?? {}); for (const k of ["quantity", "equipped", "carried", "containerId", "sort"]) delete c[k]; return JSON.stringify(c); };
    return strip(a.system) === strip(data.system) && !isHidden(a);
  }
  /** Move qty pieces of an item from one actor to another (stacked onto the same item there). */
  async function moveItem(from, to, itemId, qty, patch = {}) {
    const it = from.items.get(itemId);
    if (!it) throw fail(/*t*/"That item isn't there any more.");
    const have = qtyOf(it);
    qty = Math.min(have, Math.max(1, Math.floor(qty)));
    const data = it.toObject();
    delete data._id;
    foundry.utils.setProperty(data, "system.quantity", qty);
    for (const [k, v] of Object.entries(patch)) foundry.utils.setProperty(data, k, v);
    if (data.flags?.[FLAG]?.[HIDDEN]) delete data.flags[FLAG][HIDDEN];
    const onto = to.items.find((i) => !inContainer(i) && sameItem(i, data));
    if (onto) await onto.update({ "system.quantity": qtyOf(onto) + qty });
    else await to.createEmbeddedDocuments("Item", [data]);
    if (have - qty <= 0) await from.deleteEmbeddedDocuments("Item", [itemId]);
    else await it.update({ "system.quantity": have - qty });
    return { qty, name: shownName(it) };
  }

  /* ------------------------------------------ */
  /*  Requests to the GM's game                 */
  /* ------------------------------------------ */

  /** An error with words translated where it's shown (the player's language). */
  const fail = (text, data = {}) => Object.assign(new Error(text), { trade: { text, data } });
  const channel = () => `module.${host()}`;
  const activeGM = () => game.users?.activeGM ?? [...(game.users ?? [])].filter((u) => u.isGM && u.active).sort((a, b) => a.id.localeCompare(b.id))[0] ?? null;
  const pending = new Map();
  let queue = Promise.resolve();
  /** Trades one at a time (two players can't buy the last piece); haggling waits for the GM, so it doesn't hold the others up. */
  function enqueue(action, data, userId) {
    if (action === "haggle") return perform(action, data, userId);
    const run = queue.then(() => perform(action, data, userId));
    queue = run.catch(() => null);
    return run;
  }
  /** Ask the GM's game to do something (done here when this is the GM). → its answer { text, data } */
  async function call(action, data, wait = 20000) {
    if (game.user.isGM) {
      const run = enqueue(action, data, game.user.id);
      try { return await run; } catch (err) { throw err.trade ? new Error(t(err.trade.text, err.trade.data)) : err; }
    }
    const gm = activeGM();
    if (!gm) throw new Error(t("No GM is in the game: buying and selling need a GM connected."));
    const id = foundry.utils.randomID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(t("The GM's game didn't answer. Try again."))); }, wait);
      pending.set(id, { resolve, reject, timer });
      game.socket.emit(channel(), { axecleftTrade: "request", id, to: gm.id, from: game.user.id, action, data });
    });
  }
  function onSocket(msg) {
    if (!msg?.axecleftTrade || msg.to !== game.user.id) return;
    if (msg.axecleftTrade === "request" && game.user.isGM) {
      const run = enqueue(msg.action, msg.data, msg.from);
      run.then((res) => game.socket.emit(channel(), { axecleftTrade: "reply", id: msg.id, to: msg.from, ok: true, res }))
        .catch((err) => {
          if (!err.trade) console.error("AxecleftTrade |", err);
          game.socket.emit(channel(), { axecleftTrade: "reply", id: msg.id, to: msg.from, ok: false, error: err.trade ?? { text: /*t*/"The trade failed: {error}", data: { error: err.message } } });
        });
    } else if (msg.axecleftTrade === "reply") {
      const p = pending.get(msg.id);
      if (!p) return;
      clearTimeout(p.timer); pending.delete(msg.id);
      if (msg.ok) p.resolve(msg.res); else p.reject(new Error(t(msg.error?.text ?? "The trade failed.", msg.error?.data)));
    }
  }

  /* ------------------------------------------ */
  /*  What the GM's game does                   */
  /* ------------------------------------------ */

  async function docFrom(uuid) {
    const d = uuid ? await fromUuid(uuid) : null;
    return d?.documentName === "Actor" ? d : d?.actor ?? null;
  }
  /** The two actors of a trade, checked: the shop is open to the user, the character is theirs. */
  async function parties(data, userId, who) {
    const user = game.users.get(userId);
    const shop = await docFrom(data.shop), actor = await docFrom(data[who]);
    if (!user || !shop || !actor) throw fail(/*t*/"The merchant or the character couldn't be found.");
    if (!user.isGM && !shop.testUserPermission(user, OWN().LIMITED)) throw fail(/*t*/"{name} isn't open to you.", { name: shop.name });
    if (!user.isGM && !actor.testUserPermission(user, OWN().OWNER)) throw fail(/*t*/"{name} isn't your character.", { name: actor.name });
    if (!user.isGM && shopOf(shop).locked[actor.id]) throw fail(/*t*/"{shop} won't deal with {name}.", { shop: shop.name, name: actor.name });
    return { user, shop, actor };
  }
  /** Tell the table (by the shop's chat setting). */
  async function announce(shop, html) {
    const how = shopOf(shop).chat;
    if (how === "none") return;
    const data = { speaker: { alias: shop.name }, content: `<div class="axecleft-trade-chat">${html}</div>` };
    if (how === "gm") data.whisper = (ChatMessage.getWhisperRecipients?.("GM") ?? []).map((u) => u.id);
    try { await ChatMessage.create(data); } catch (e) { /* chat isn't essential */ }
  }

  async function perform(action, data, userId) {
    if (action === "buy") {
      const { shop, actor: buyer } = await parties(data, userId, "buyer");
      const item = shop.items.get(data.item);
      const user = game.users.get(userId);
      if (!item || (!user.isGM && isHidden(item))) throw fail(/*t*/"That item isn't for sale any more.");
      const qty = Math.floor(Number(data.qty) || 0);
      if (qty < 1) throw fail(/*t*/"Choose how many.");
      if (qty > qtyOf(item)) throw fail(/*t*/"{shop} has only {n}.", { shop: shop.name, n: qtyOf(item) });
      const cost = askPrice(shop, item, buyer) * qty;
      const pay = payment(buyer, cost);
      if (!pay) throw fail(/*t*/"{name} doesn't have {price} (has {has}).", { name: buyer.name, price: money(cost), has: money(wealth(buyer)) });
      if (Object.keys(pay).length) await buyer.update(pay);
      if (cost > 0) await shop.update(addCoins(shop, cost));
      const moved = await moveItem(shop, buyer, item.id, qty, { "system.equipped": false, "system.carried": true });
      await announce(shop, t("<b>{buyer}</b> buys {qty} × {item} for {price}.", { buyer: esc(buyer.name), qty: moved.qty, item: esc(moved.name), price: esc(money(cost)) }));
      await logLoot(shop, t("{name} bought {qty} × {item} for {price}.", { name: buyer.name, qty: moved.qty, item: moved.name, price: money(cost) }));
      return { text: /*t*/"{name} bought {qty} × {item} for {price}.", data: { name: buyer.name, qty: moved.qty, item: moved.name, price: money(cost) } };
    }
    if (action === "buyMany") {
      const { shop, actor: buyer, user } = await parties(data, userId, "buyer");
      const list = [];
      for (const { id, qty: q } of data.items ?? []) {
        const item = shop.items.get(id), qty = Math.floor(Number(q) || 0);
        if (!item || (!user.isGM && isHidden(item))) throw fail(/*t*/"That item isn't for sale any more.");
        if (qty < 1) continue;
        if (qty > qtyOf(item)) throw fail(/*t*/"{shop} has only {n} × {item}.", { shop: shop.name, n: qtyOf(item), item: shownName(item) });
        list.push({ item, qty, cost: askPrice(shop, item, buyer) * qty });
      }
      if (!list.length) throw fail(/*t*/"The basket is empty.");
      const cost = list.reduce((n, x) => n + x.cost, 0);
      const pay = payment(buyer, cost);
      if (!pay) throw fail(/*t*/"{name} doesn't have {price} (has {has}).", { name: buyer.name, price: money(cost), has: money(wealth(buyer)) });
      if (Object.keys(pay).length) await buyer.update(pay);
      if (cost > 0) await shop.update(addCoins(shop, cost));
      const got = [];
      for (const x of list) { const moved = await moveItem(shop, buyer, x.item.id, x.qty, { "system.equipped": false, "system.carried": true }); got.push(`${moved.qty} × ${moved.name}`); }
      const what = got.join(", ");
      await announce(shop, t("<b>{buyer}</b> buys {what} for {price}.", { buyer: esc(buyer.name), what: esc(what), price: esc(money(cost)) }));
      await logLoot(shop, t("{name} bought {what} for {price}.", { name: buyer.name, what, price: money(cost) }));
      return { text: /*t*/"{name} bought {what} for {price}.", data: { name: buyer.name, what, price: money(cost) } };
    }
    if (action === "sell") {
      const { shop, actor: seller } = await parties(data, userId, "seller");
      const item = seller.items.get(data.item);
      if (!item) throw fail(/*t*/"That item isn't there any more.");
      if (!TRADE_TYPES.includes(item.type) || inContainer(item)) throw fail(/*t*/"{shop} doesn't buy that.", { shop: shop.name });
      const qty = Math.floor(Number(data.qty) || 0);
      if (qty < 1 || qty > qtyOf(item)) throw fail(/*t*/"Choose how many.");
      const price = offerPrice(shop, item, seller) * qty;
      if (price <= 0) throw fail(/*t*/"{shop} won't pay anything for that.", { shop: shop.name });
      const pay = payment(shop, price);
      if (!pay) throw fail(/*t*/"{shop} can't pay {price} (has {has}).", { shop: shop.name, price: money(price), has: money(wealth(shop)) });
      if (Object.keys(pay).length) await shop.update(pay);
      await seller.update(addCoins(seller, price));
      const moved = await moveItem(seller, shop, item.id, qty, { "system.equipped": false });
      await announce(shop, t("<b>{seller}</b> sells {qty} × {item} for {price}.", { seller: esc(seller.name), qty: moved.qty, item: esc(moved.name), price: esc(money(price)) }));
      await logLoot(shop, t("{name} sold {qty} × {item} for {price}.", { name: seller.name, qty: moved.qty, item: moved.name, price: money(price) }));
      return { text: /*t*/"{name} sold {qty} × {item} for {price}.", data: { name: seller.name, qty: moved.qty, item: moved.name, price: money(price) } };
    }
    if (action === "haggle") {
      const { shop, actor: buyer, user } = await parties(data, userId, "buyer");
      const s = shopOf(shop);
      if (!s.haggle) throw fail(/*t*/"{shop} doesn't haggle.", { shop: shop.name });
      if (s.haggles[buyer.id] && !user.isGM) throw fail(/*t*/"{name} has already haggled here.", { name: buyer.name });
      const total = Math.round(Number(data.total) || 0);
      const skill = HAGGLE_SKILLS.find(([k]) => k === data.skill) ?? HAGGLE_SKILLS[0];
      if (!s.skills[skill[0]] && !user.isGM) throw fail(/*t*/"{shop} can't be haggled with that way.", { shop: shop.name });
      const suggested = haggleFor(total);
      // The GM decides (and can change the figure)
      const DV = A()?.DialogV2 ?? foundry.applications.api.DialogV2;
      let pct = null;
      const answer = await DV.wait({
        window: { title: t("Haggling") }, rejectClose: false,
        content: `<p>${H("{name} ({user}) haggles with {shop}: {skill} {total}.", { name: buyer.name, user: user.name, shop: shop.name, skill: t(skill[1]), total })}</p>
          ${skill[0] === "int" ? `<p class="hint" style="font-size:0.9em;opacity:0.85">${H("SRD: an intimidated merchant cooperates for 1d6 × 10 minutes, then turns unfriendly. You can reset this later and refuse more haggling, or raise the prices.")}</p>` : ""}
          ${skill[0] === "blf" ? `<p class="hint" style="font-size:0.9em;opacity:0.85">${H("Bluff: if the merchant later learns the truth, you can reset this and refuse more haggling.")}</p>` : ""}
          <div class="form-group"><label>${H("Better prices by")}</label><input type="number" name="pct" value="${suggested}" min="-50" max="50" step="1" style="width:5em"> %</div>
          <p class="hint" style="font-size:0.9em;opacity:0.85">${H("Suggested: 2% for every 5 points over 10 (2% worse for every 5 under), up to 10%. Applies to what {name} buys and sells here until you reset it.", { name: buyer.name })}</p>`,
        buttons: [
          { action: "ok", label: t("Approve"), icon: "fas fa-check", default: true, callback: (ev, button) => { pct = Number(button.form?.elements?.pct?.value ?? button.form?.querySelector?.("[name=pct]")?.value); return "ok"; } },
          { action: "no", label: t("Refuse"), icon: "fas fa-xmark", callback: () => "no" },
        ],
      });
      const ok = answer === "ok" && Number.isFinite(pct);
      const final = ok ? Math.max(-50, Math.min(50, Math.round(pct))) : 0;
      await shop.update({ [`flags.${FLAG}.${KEY}.haggles.${buyer.id}`]: { pct: final, total, name: buyer.name, refused: !ok, skill: skill[0] } });
      await logLoot(shop, ok ? t("{name} haggled ({skill} {total}): prices {pct}%.", { name: buyer.name, skill: t(skill[1]), total, pct: `${final > 0 ? "−" : final < 0 ? "+" : "±"}${Math.abs(final)}` }) : t("{name} haggled ({skill} {total}): refused.", { name: buyer.name, skill: t(skill[1]), total }));
      await announce(shop, ok ? t(final > 0 ? "<b>{name}</b> haggles with {shop} ({skill}): prices {pct}% better for them." : final < 0 ? "<b>{name}</b> haggles with {shop} ({skill}): prices {pct}% worse for them." : "<b>{name}</b> haggles with {shop} ({skill}): prices unchanged.", { name: esc(buyer.name), shop: esc(shop.name), skill: esc(t(skill[1])), pct: Math.abs(final) }) : t("<b>{name}</b> haggles with {shop} ({skill}), without success.", { name: esc(buyer.name), shop: esc(shop.name), skill: esc(t(skill[1])) }));
      return ok ? { text: final > 0 ? /*t*/"The GM approved: prices {pct}% better for {name} here." : final < 0 ? /*t*/"The GM decided: prices {pct}% worse for {name} here." : /*t*/"The GM decided: prices unchanged for {name} here.", data: { pct: Math.abs(final), name: buyer.name } } : { text: /*t*/"The GM refused the haggling.", data: {} };
    }
    if (action === "steal") return stealRequest(data, userId);
    if (action === "loot") return lootRequest(data, userId);
    throw fail(/*t*/"Unknown trade.");
  }
  const HAGGLE_SKILLS = [["dip", /*t*/"Diplomacy", "fa-comments-dollar"], ["int", /*t*/"Intimidate", "fa-hand-fist"], ["blf", /*t*/"Bluff", "fa-masks-theater"]];
  /** A haggling result's price change (%): 2% for every 5 points over 10, 2% worse for every 5 under, up to 10%. */
  const haggleFor = (total) => Math.max(-10, Math.min(10, Math.trunc((Number(total) - 10) / 5) * 2));

  /* ------------------------------------------ */
  /*  Pickpocketing and shoplifting             */
  /* ------------------------------------------ */

  const THEFT = "axecleftTheft", TIMEOUT = "axecleftTimeout";
  /**
   * A shop's security (the Merchant Generator's Security section, or the sheet's GM settings): changes to the DC to get
   * away with something (dc) and to the shop's Spot (spot), for picking pockets (pocket) and shoplifting (shop).
   */
  const SECURITY = [
    { key: "careless", label: /*t*/"Careless / distracted", hint: /*t*/"Spot −4, DCs −2", dc: { pocket: -2, shop: -2 }, spot: { pocket: -4, shop: -4 } },
    { key: "crowded", label: /*t*/"Crowded / busy", hint: /*t*/"Spot −2", spot: { pocket: -2, shop: -2 } },
    { key: "watchful", label: /*t*/"Watchful owner", hint: /*t*/"Spot +4", spot: { pocket: 4, shop: 4 } },
    { key: "guards", label: /*t*/"Guards on duty", hint: /*t*/"Spot +5", spot: { pocket: 5, shop: 5 } },
    { key: "animal", label: /*t*/"Guard animal", hint: /*t*/"Spot +3", spot: { pocket: 3, shop: 3 } },
    { key: "locked", label: /*t*/"Goods locked away", hint: /*t*/"shoplifting DC +10 (cases, chains, behind the counter)", dc: { shop: 10 } },
    { key: "strongbox", label: /*t*/"Coin kept secure", hint: /*t*/"pickpocketing DC +5 (most coin in a strongbox)", dc: { pocket: 5 } },
    { key: "warded", label: /*t*/"Magically warded", hint: /*t*/"shoplifting: Spot +10 (alarm wards on the stock)", spot: { shop: 10 } },
  ];
  /** The security's total changes for one kind of attempt ("pocket" or "shop"). */
  function securityFx(keys = [], kind = "pocket") {
    const on = SECURITY.filter((x) => keys.includes(x.key) && (x.dc?.[kind] || x.spot?.[kind]));
    return { dc: on.reduce((n, x) => n + (x.dc?.[kind] ?? 0), 0), spot: on.reduce((n, x) => n + (x.spot?.[kind] ?? 0), 0), labels: on.map((x) => t(x.label)) };
  }
  const signed = (n) => `${n >= 0 ? "+" : "−"}${Math.abs(n)}`;
  /** The world's setting (the module settings of the module hosting this script). */
  const theftOn = () => { try { return settingNs ? game.settings.get(settingNs, "theft") !== false : true; } catch (e) { return true; } };
  /** Owned by a player? Their characters can't be robbed (an unowned character actor played as an NPC can). */
  const playerOwned = (actor) => [...(game.users ?? [])].some((u) => !u.isGM && actor.testUserPermission(u, OWN().OWNER));
  /** A player's time-out, set by the GM (ms left). */
  const timeoutLeft = (user) => Math.max(0, (Number(user?.flags?.[FLAG]?.[TIMEOUT]) || 0) - Date.now());
  const minutes = (ms) => Math.max(1, Math.ceil(ms / 60000));
  const weightOf = (i) => Number(getP(i, "system.weight")) || 0;
  const isShop = (actor) => !!actor?.flags?.[FLAG]?.[KEY] || actor?.flags?.core?.sheetClass === SHEET;
  /** What can be lifted: things the target isn't wearing or wielding. */
  const pocketItems = (actor) => actor.items.filter((i) => TRADE_TYPES.includes(i.type) && !getP(i, "system.equipped") && !inContainer(i) && qtyOf(i) > 0 && !isHidden(i));
  const COINS = ["pp", "gp", "sp", "cp"];
  const coinsOf = (actor, k) => Math.max(0, Math.floor(Number(getP(actor, `system.currency.${k}`)) || 0));
  const d = (n) => 1 + Math.floor(Math.random() * n);
  /** What the thief would come away with: a handful (1d10) of one kind of coin, or one small thing (1 lb or less). */
  function suggestTake(target, aim) {
    const coins = COINS.filter((k) => coinsOf(target, k) > 0);
    const small = pocketItems(target).filter((i) => weightOf(i) <= 1);
    const coin = () => { if (!coins.length) return null; const k = coins[d(coins.length) - 1]; return { what: `c:${k}`, n: Math.min(coinsOf(target, k), d(10)) }; };
    const item = () => (small.length ? { what: `i:${small[d(small.length) - 1].id}`, n: 1 } : null);
    return (aim === "item" ? item() ?? coin() : coin() ?? item()) ?? { what: "", n: 0 };
  }
  const OUTCOMES = [["clean", /*t*/"Got it, unnoticed"], ["seen", /*t*/"Got it, but noticed"], ["miss", /*t*/"Missed, unnoticed"], ["caught", /*t*/"Missed and caught"]];
  const gmIds = () => [...(game.users ?? [])].filter((u) => u.isGM).map((u) => u.id);

  /** The player's side: choose the character (and what to go for), roll Sleight of Hand, send it to the GM. */
  async function stealFlow({ kind = "pocket", target, itemId = null, thief = null } = {}) {
    if (!theftOn()) return ui.notifications.warn(t("Pickpocketing and shoplifting are turned off in this world."));
    if (!target) return ui.notifications.warn(t("Target one token (T) to pick its pockets."));
    const left = timeoutLeft(game.user);
    if (left && !game.user.isGM) return ui.notifications.warn(t("The GM has put your attempts on hold: {n} more minutes.", { n: minutes(left) }));
    if (playerOwned(target)) return ui.notifications.warn(t("{name} is a player's character: they can't be robbed.", { name: target.name }));
    if (isShop(target) && !shopOf(target).steal) return ui.notifications.warn(t("Pickpocketing and shoplifting are turned off for {name}.", { name: target.name }));
    const chars = charactersFor().filter((a) => a.id !== target.id);
    if (!chars.length) return ui.notifications.warn(t("You have no character to do it with."));
    const item = itemId ? target.items.get(itemId) : null;
    const first = thief && chars.includes(thief) ? thief : chars[0];
    const DV = A()?.DialogV2 ?? foundry.applications.api.DialogV2;
    let got = null;
    const val = (form, n) => form?.elements?.[n]?.value ?? form?.querySelector?.(`[name=${n}]`)?.value;
    await DV.wait({
      window: { title: kind === "shoplift" ? t("Shoplift") : t("Pick a pocket") }, rejectClose: false,
      content: `<p>${kind === "shoplift" ? H("Try to slip {item} out of {shop} without paying?", { item: shownName(item), shop: target.name }) : H("Try to pick {name}'s pockets?", { name: target.name })}</p>
        <div class="form-group"><label>${H("Character")}</label><select name="thief">${chars.map((a) => `<option value="${a.id}"${a === first ? " selected" : ""}>${esc(a.name)} (${H("Sleight of Hand")} ${Number(getP(a, "system.skills.slt.mod")) >= 0 ? "+" : ""}${Number(getP(a, "system.skills.slt.mod")) || 0})</option>`).join("")}</select></div>
        ${kind === "pocket" ? `<div class="form-group"><label>${H("Go for")}</label><select name="aim"><option value="coins">${H("Coins")}</option><option value="item">${H("Something small")}</option></select></div>` : ""}
        <div class="form-group"><label>${H("Note for the GM")}</label><input type="text" name="note" placeholder="${H("e.g. the purse on his belt")}"></div>
        <p class="hint" style="font-size:0.9em;opacity:0.85">${kind === "shoplift" ? H("Sleight of Hand: DC 10 for something of 1 lb or less, DC 20 for more; the merchant's Spot against your result. The GM decides what happens.") : H("Sleight of Hand against DC 20; their Spot against your result. The GM decides what happens.")}</p>`,
      buttons: [
        { action: "ok", label: t("Try it"), icon: "fas fa-hand-sparkles", default: true, callback: (ev, button) => { const f = button.form; got = { thief: val(f, "thief"), aim: val(f, "aim") ?? "coins", note: val(f, "note") ?? "" }; return "ok"; } },
        { action: "no", label: t("Cancel"), icon: "fas fa-xmark" },
      ],
    });
    if (!got) return;
    const who = game.actors.get(got.thief) ?? first;
    try {
      const mod = Number(getP(who, "system.skills.slt.mod")) || 0;
      const roll = new Roll(`1d20 + ${mod}`);
      await roll.evaluate();
      const die = roll.dice?.[0]?.total ?? roll.terms?.[0]?.total ?? null;
      const res = await call("steal", { kind, target: target.uuid, item: item?.id ?? null, thief: who.uuid, aim: got.aim, note: String(got.note).slice(0, 200), total: roll.total, die, mod });
      ui.notifications.info(`${t("Sleight of Hand: {total}.", { total: roll.total })} ${res?.text ? t(res.text, res.data) : ""}`);
    } catch (err) { ui.notifications.warn(err.message); }
  }

  /** The GM's game: check the attempt, roll the target's Spot, whisper the GM the card. */
  async function stealRequest(data, userId) {
    const user = game.users.get(userId);
    const thief = await docFrom(data.thief), target = await docFrom(data.target);
    if (!user || !thief || !target) throw fail(/*t*/"The character or the target couldn't be found.");
    if (!theftOn()) throw fail(/*t*/"Pickpocketing and shoplifting are turned off in this world.");
    if (!user.isGM) {
      if (!thief.testUserPermission(user, OWN().OWNER)) throw fail(/*t*/"{name} isn't your character.", { name: thief.name });
      const left = timeoutLeft(user);
      if (left) throw fail(/*t*/"The GM has put your attempts on hold: {n} more minutes.", { n: minutes(left) });
    }
    if (playerOwned(target)) throw fail(/*t*/"{name} is a player's character: they can't be robbed.", { name: target.name });
    const shop = isShop(target), s = shopOf(target);
    if (shop && !s.steal) throw fail(/*t*/"Pickpocketing and shoplifting are turned off for {name}.", { name: target.name });
    if (shop && s.locked[thief.id] && !user.isGM) throw fail(/*t*/"{shop} won't deal with {name}.", { shop: target.name, name: thief.name });
    const kind = data.kind === "shoplift" ? "shoplift" : "pocket";
    let item = null;
    if (kind === "shoplift") {
      item = target.items.get(data.item);
      if (!item || (isHidden(item) && !user.isGM) || qtyOf(item) < 1) throw fail(/*t*/"That item isn't for sale any more.");
    }
    const total = Math.round(Number(data.total) || 0);
    const sec = shop ? securityFx(s.security, kind === "shoplift" ? "shop" : "pocket") : { dc: 0, spot: 0, labels: [] };
    const spotMod = (Number(getP(target, "system.skills.spt.mod")) || 0) + sec.spot;
    const spot = new Roll(`1d20 + ${spotMod}`);
    await spot.evaluate();
    const dc = Math.max(1, (kind === "shoplift" && weightOf(item) <= 1 ? 10 : 20) + sec.dc);
    const got = total >= dc, seen = spot.total >= total;
    const take = kind === "shoplift" ? { what: `i:${item.id}`, n: 1 } : suggestTake(target, data.aim);
    const card = {
      state: "open", kind, user: user.id, userName: user.name, thief: thief.uuid, thiefId: thief.id, thiefName: thief.name,
      target: target.uuid, targetName: target.name, shop, item: item?.id ?? null, itemName: item ? item.name : null,
      aim: data.aim === "item" ? "item" : "coins", note: String(data.note ?? "").slice(0, 200),
      total, die: data.die ?? null, mod: data.mod ?? null, spot: spot.total, spotMod, dc, secDc: sec.dc, secSpot: sec.spot, secLabels: sec.labels,
      outcome: got ? (seen ? "seen" : "clean") : (seen ? "caught" : "miss"), take,
      choices: [...COINS.filter((k) => coinsOf(target, k) > 0).map((k) => [`c:${k}`, `${coinName(k)} (${coinsOf(target, k).toLocaleString()})`]),
        ...pocketItems(target).map((i) => [`i:${i.id}`, `${i.name}${qtyOf(i) > 1 ? ` (${qtyOf(i)})` : ""}${weightOf(i) ? `, ${weightOf(i)} lb` : ""}`])],
    };
    await ChatMessage.create({ speaker: { alias: kind === "shoplift" ? t("Shoplifting") : t("Pickpocketing") }, whisper: gmIds(), content: cardHTML(card), flags: { [FLAG]: { [THEFT]: card } } });
    return { text: /*t*/"The GM decides what happens.", data: {} };
  }

  /** The GM's card in chat. */
  function cardHTML(c) {
    const out = OUTCOMES.find(([k]) => k === c.outcome) ?? OUTCOMES[0];
    const roll = c.die != null ? ` <small class="muted">(${c.die} ${c.mod >= 0 ? "+" : "−"} ${Math.abs(c.mod)})</small>` : "";
    const head = c.kind === "shoplift"
      ? H("{thief} ({user}) tries to shoplift {item} from {target}.", { thief: c.thiefName, user: c.userName, item: c.itemName, target: c.targetName })
      : H("{thief} ({user}) tries to pick {target}'s pockets ({aim}).", { thief: c.thiefName, user: c.userName, target: c.targetName, aim: c.aim === "item" ? t("something small") : t("coins") });
    const sel = (name, list, cur) => `<select name="${name}">${list.map(([k, l]) => `<option value="${esc(k)}"${k === cur ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
    const open = c.state === "open";
    const ROW = "display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:3px 0", BTN = "width:auto;flex:0 1 auto;max-width:100%;height:auto;min-height:1.8em;white-space:normal;text-align:left;line-height:1.3;padding:2px 8px";
    const timed = c.timeout && c.timeout > Date.now();
    return `<div class="axecleft-theft" style="font-size:0.95em">
      <p style="margin:2px 0">${head}</p>
      ${c.note ? `<p style="margin:2px 0"><i>“${esc(c.note)}”</i></p>` : ""}
      <p style="margin:2px 0">${H("Sleight of Hand")} <b>${c.total}</b>${roll} ${H("vs DC {dc}", { dc: c.dc })}${c.secDc ? ` <small class="muted">(${H("security {n}", { n: signed(c.secDc) })})</small>` : ""} · ${H("{target}'s Spot", { target: c.targetName })} <b>${c.spot}</b> <small class="muted">(${signed(c.spotMod)}${c.secSpot ? `, ${H("security {n}", { n: signed(c.secSpot) })}` : ""})</small></p>
      ${c.secLabels?.length ? `<p style="margin:2px 0"><small>${H("Security: {list}.", { list: c.secLabels.join(", ") })}</small></p>` : ""}
      ${open ? `<p style="margin:2px 0">${H("Suggested: {outcome}.", { outcome: t(out[1]) })}</p>
        <div class="ath-row" style="${ROW}"><label>${H("Outcome")}</label> ${sel("outcome", OUTCOMES.map(([k, l]) => [k, t(l)]), c.outcome)}</div>
        <div class="ath-row" style="${ROW}"><label>${H("Takes")}</label> ${c.kind === "shoplift" ? `<b>${esc(c.itemName)}</b> × <input type="number" name="n" value="1" min="1" style="width:4em">`
          : `${sel("what", [["", t("Nothing")], ...c.choices], c.take?.what ?? "")} × <input type="number" name="n" value="${Number(c.take?.n) || 1}" min="1" style="width:5em">`}</div>
        <button type="button" style="${BTN}" data-ath="resolve"><i class="fas fa-gavel"></i> ${H("Decide")}</button>`
      : `<p style="margin:4px 0"><b>${H(OUTCOMES.find(([k]) => k === c.result?.outcome)?.[1] ?? /*t*/"Decided")}</b>${c.result?.what ? ` — ${esc(c.result.what)}` : ""}</p>`}
      <hr style="margin:4px 0">
      <div class="ath-row" style="${ROW}">${sel("mins", [["10", t("10 minutes")], ["30", t("30 minutes")], ["60", t("1 hour")], ["240", t("4 hours")], ["1440", t("1 day")]], "30")}
        <button type="button" style="${BTN}" data-ath="timeout"><i class="fas fa-hourglass-half"></i> ${H("Time out {user}", { user: c.userName })}</button>
        ${timed ? `<button type="button" style="${BTN}" data-ath="untimeout">${H("Lift the time-out")}</button>` : ""}</div>
      ${c.shop ? `<div class="ath-row" style="${ROW}"><button type="button" style="${BTN}" data-ath="lock"><i class="fas ${c.locked ? "fa-lock-open" : "fa-lock"}"></i> ${c.locked ? H("Let {thief} trade at {shop} again", { thief: c.thiefName, shop: c.targetName }) : H("Lock {thief} out of {shop}", { thief: c.thiefName, shop: c.targetName })}</button></div>` : ""}
      <textarea name="say" rows="2" style="width:100%;margin-top:4px" placeholder="${H("{target}'s reaction…", { target: c.targetName })}"></textarea>
      <div class="ath-row" style="${ROW}"><label><input type="checkbox" name="private"> ${H("Only to {user}", { user: c.userName })}</label>
        <button type="button" style="${BTN}" data-ath="say"><i class="fas fa-comment"></i> ${H("Post as {target}", { target: c.targetName })}</button></div>
    </div>`;
  }

  async function saveCard(msg, c) { await msg.update({ content: cardHTML(c), [`flags.${FLAG}.${THEFT}`]: c }); }
  const tell = (userId, html, speaker) => ChatMessage.create({ speaker: speaker ?? { alias: t("Game Master") }, whisper: [...new Set([userId, ...gmIds()])], content: html });

  /** The GM's buttons on the card. */
  async function onCard(msg, act, box) {
    const c = foundry.utils.deepClone(msg.flags?.[FLAG]?.[THEFT] ?? {});
    const val = (n) => box.querySelector(`[name=${n}]`);
    const thief = await fromUuid(c.thief).catch(() => null), target = await fromUuid(c.target).catch(() => null);
    const user = game.users.get(c.user);
    if (act === "resolve") {
      if (c.state !== "open") return;
      if (!thief || !target) return ui.notifications.warn(t("The character or the target couldn't be found."));
      const outcome = val("outcome")?.value ?? c.outcome;
      let what = "";
      if (outcome === "clean" || outcome === "seen") {
        const pick = c.kind === "shoplift" ? `i:${c.item}` : (val("what")?.value ?? "");
        const n = Math.max(1, Math.floor(Number(val("n")?.value) || 1));
        if (pick.startsWith("c:")) {
          const k = pick.slice(2), take = Math.min(coinsOf(target, k), n);
          if (take > 0) {
            await target.update({ [`system.currency.${k}`]: coinsOf(target, k) - take });
            await thief.update({ [`system.currency.${k}`]: coinsOf(thief, k) + take });
            what = `${take.toLocaleString()} ${coinName(k)}`;
          }
        } else if (pick.startsWith("i:") && target.items.get(pick.slice(2))) {
          const moved = await moveItem(target, thief, pick.slice(2), n, { "system.equipped": false, "system.carried": true });
          what = `${moved.qty} × ${moved.name}`;
        }
      }
      c.state = "done"; c.result = { outcome, what };
      await saveCard(msg, c);
      if (target && isShop(target)) {
        const res = t(OUTCOMES.find(([k]) => k === outcome)?.[1] ?? "");
        await logLoot(target, c.kind === "shoplift"
          ? t("{name} tried to shoplift {item} (Sleight of Hand {total} vs DC {dc}, Spot {spot}): {result}{what}.", { name: c.thiefName, item: c.itemName, total: c.total, dc: c.dc, spot: c.spot, result: res, what: what ? ` — ${what}` : "" })
          : t("{name} tried to pick the pockets (Sleight of Hand {total} vs DC {dc}, Spot {spot}): {result}{what}.", { name: c.thiefName, total: c.total, dc: c.dc, spot: c.spot, result: res, what: what ? ` — ${what}` : "" }));
      }
      const p = { thief: esc(c.thiefName), target: esc(c.targetName), what: esc(what) };
      const html = outcome === "caught" ? t("<b>{target}</b> catches <b>{thief}</b> in the act!", p)
        : outcome === "miss" ? t("<b>{thief}</b> doesn't manage it. No one seems to have noticed.", p)
        : what ? t("<b>{thief}</b> comes away with {what}.", p) : t("<b>{thief}</b> comes away with nothing.", p);
      return tell(c.user, html);
    }
    if (act === "timeout") {
      if (!user) return;
      const mins = Math.max(1, Number(val("mins")?.value) || 30);
      c.timeout = Date.now() + mins * 60000;
      await user.update({ [`flags.${FLAG}.${TIMEOUT}`]: c.timeout });
      await saveCard(msg, c);
      return tell(c.user, t("The GM has put your pickpocketing and shoplifting on hold for {n} minutes.", { n: mins }));
    }
    if (act === "untimeout") {
      if (user) await user.update({ [`flags.${FLAG}.-=${TIMEOUT}`]: null });
      c.timeout = null; await saveCard(msg, c);
      return tell(c.user, t("You can try pickpocketing and shoplifting again."));
    }
    if (act === "lock") {
      if (!target) return;
      c.locked = !c.locked;
      await target.update(c.locked ? { [`flags.${FLAG}.${KEY}.locked.${c.thiefId}`]: c.thiefName } : { [`flags.${FLAG}.${KEY}.locked.-=${c.thiefId}`]: null });
      await logLoot(target, c.locked ? t("{name} was locked out.", { name: c.thiefName }) : t("{name} may trade again.", { name: c.thiefName }));
      await saveCard(msg, c);
      return tell(c.user, c.locked ? t("{shop} won't deal with {thief} any more.", { shop: esc(c.targetName), thief: esc(c.thiefName) }) : t("{shop} will deal with {thief} again.", { shop: esc(c.targetName), thief: esc(c.thiefName) }));
    }
    if (act === "say") {
      const text = String(val("say")?.value ?? "").trim();
      if (!text) return;
      const speaker = target ? ChatMessage.getSpeaker({ actor: target }) : { alias: c.targetName };
      const data = { speaker, content: esc(text).replace(/\n/g, "<br>") };
      if (val("private")?.checked) data.whisper = [...new Set([c.user, ...gmIds()])];
      await ChatMessage.create(data);
      val("say").value = "";
    }
  }
  /** The card's buttons work for the GM (players never get the card). */
  function bindCard(msg, html) {
    const el = html instanceof HTMLElement ? html : html?.[0];
    const isLoot = !!msg?.flags?.[FLAG]?.[LOOTCARD];
    if (!el || (!msg?.flags?.[FLAG]?.[THEFT] && !isLoot)) return;
    if (!game.user.isGM) { el.querySelectorAll(".axecleft-theft button, .axecleft-theft select, .axecleft-theft textarea, .axecleft-theft input, .axecleft-lootcard button").forEach((e) => { e.disabled = true; }); return; }
    if (isLoot) {
      if (el._alcBound) return;
      el._alcBound = true;
      el.addEventListener("click", async (ev) => {
        const b = ev.target.closest("[data-alc]");
        if (!b) return;
        ev.preventDefault(); b.disabled = true;
        try { await onLootCard(msg, b.dataset.alc); } catch (err) { console.error("AxecleftTrade |", err); ui.notifications.error(err.message); } finally { b.disabled = false; }
      });
      return;
    }
    if (el._athBound) return;
    el._athBound = true;
    el.addEventListener("click", async (ev) => {
      const b = ev.target.closest("[data-ath]");
      if (!b) return;
      ev.preventDefault();
      b.disabled = true;
      try { await onCard(msg, b.dataset.ath, b.closest(".axecleft-theft")); } catch (err) { console.error("AxecleftTrade |", err); ui.notifications.error(err.message); } finally { b.disabled = false; }
    });
  }

  /** The token layer's button: pick the pockets of the targeted token. */
  function pickTargeted() {
    const tg = [...(game.user.targets ?? [])];
    if (tg.length !== 1) return ui.notifications.warn(t("Target one token (T) to pick its pockets."));
    const own = (canvas?.tokens?.controlled ?? []).map((x) => x.actor).find((a) => a?.isOwner && a.type === "character");
    return stealFlow({ kind: "pocket", target: tg[0].actor, thief: own ?? game.user.character ?? null });
  }
  function sceneControl(controls) {
    if (!theftOn()) return;
    const tool = { name: "axecleftPickpocket", title: t("Pick a pocket (target the token first)"), icon: "fas fa-hand-sparkles", button: true };
    if (Array.isArray(controls)) controls.find((c) => c.name === "token")?.tools?.push({ ...tool, onClick: pickTargeted });
    else if (controls?.tokens?.tools) controls.tokens.tools[tool.name] = { ...tool, order: 90, visible: true, onChange: () => pickTargeted() };
  }

  /* ------------------------------------------ */
  /*  The sheet                                 */
  /* ------------------------------------------ */

  const STYLE = `<style>
    .axecleft-shop .ash { display: flex; flex-direction: column; gap: 6px; height: 100%; font-size: var(--font-size-14, 14px); }
    .axecleft-shop .ash-head { display: flex; gap: 10px; align-items: center; }
    .axecleft-shop .ash-head img { width: 72px; height: 72px; object-fit: cover; border: 1px solid var(--color-border-light-tertiary, #888); border-radius: 4px; }
    .axecleft-shop .ash-head h2 { margin: 0; border: none; } .axecleft-shop .ash-head .sub { opacity: 0.8; font-size: 0.9em; }
    .axecleft-shop .ash-who { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; padding: 4px 6px; border: 1px solid var(--color-border-light-tertiary, #888); border-radius: 4px; }
    .axecleft-shop .ash-who select { flex: 0 1 16em; } .axecleft-shop .ash-who .purse { margin-left: auto; }
    .axecleft-shop nav.ash-tabs { display: flex; gap: 2px; border-bottom: 1px solid var(--color-border-light-tertiary, #999); }
    .axecleft-shop nav.ash-tabs button { flex: 0 0 auto; border-radius: 4px 4px 0 0; margin: 0; padding: 3px 12px; line-height: 1.4; width: auto; }
    .axecleft-shop nav.ash-tabs button.active { font-weight: bold; box-shadow: inset 0 -3px 0 var(--color-warm-1, #c9593f); }
    .axecleft-shop .ash-list { flex: 1; overflow-y: auto; min-height: 120px; }
    .axecleft-shop table.ash-t { width: 100%; border-collapse: collapse; margin: 0; }
    .axecleft-shop table.ash-t th { text-align: left; position: sticky; top: 0; background: var(--background, var(--color-cool-5, #1b1d24)); z-index: 1; padding: 3px 4px; font-size: 0.9em; }
    .axecleft-shop table.ash-t td { padding: 2px 4px; vertical-align: middle; border-top: 1px solid rgba(128,128,128,0.25); }
    .axecleft-shop table.ash-t td.n, .axecleft-shop table.ash-t th.n { text-align: right; white-space: nowrap; }
    .axecleft-shop table.ash-t td.name { display: flex; gap: 6px; align-items: center; }
    .axecleft-shop table.ash-t td.name img { width: 26px; height: 26px; border: none; flex: 0 0 26px; }
    .axecleft-shop tr.group td { font-weight: bold; padding-top: 6px; opacity: 0.85; border-top: none; }
    .axecleft-shop tr.hidden-item { opacity: 0.5; } .axecleft-shop .muted { opacity: 0.7; } .axecleft-shop .warn { color: var(--color-level-warning, #c08a00); }
    .axecleft-shop button.ash-act { width: auto; padding: 1px 10px; line-height: 1.6; margin: 0; }
    .axecleft-shop a.ash-ctl { padding: 0 3px; cursor: pointer; }
    .axecleft-shop details.ash-gm { border: 1px solid var(--color-border-light-tertiary, #888); border-radius: 4px; padding: 2px 8px 6px; }
    .axecleft-shop details.ash-gm > summary { cursor: pointer; font-weight: bold; }
    .axecleft-shop .ash-grid { display: grid; grid-template-columns: auto 1fr auto 1fr; gap: 3px 8px; align-items: center; margin-top: 4px; }
    .axecleft-shop .ash-grid input[type=number] { width: 5.5em; } .axecleft-shop .ash-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin-top: 4px; }
    .axecleft-shop .ash-drop { border: 2px dashed var(--color-border-light-tertiary, #888); border-radius: 6px; padding: 4px; text-align: center; font-size: 0.85em; opacity: 0.8; }
    .axecleft-shop .ash-closed { padding: 2em; text-align: center; opacity: 0.85; }
    .axecleft-shop .ash-name { cursor: pointer; } .axecleft-shop .ash-name:hover { text-decoration: underline; }
    .axecleft-shop tr.ash-desc td { border-top: none; padding: 0 8px 6px 36px; }
    .axecleft-shop .ash-desc-body { font-size: 0.9em; max-height: 16em; overflow-y: auto; padding: 4px 8px; border-left: 3px solid #c9593f; background: rgba(255,255,255,0.3); }
    .axecleft-shop .ash-desc-body p { margin: 0.3em 0; }
    .axecleft-shop .ash-demo { outline: 1px dashed #7a7971; outline-offset: 2px; opacity: 0.8; }
    .axecleft-shop .ash-demo-tag { font-size: 0.8em; font-style: italic; opacity: 0.75; margin-left: 4px; }
    .axecleft-shop fieldset.ash-demo-box { border: 0; padding: 0; margin: 0; min-width: 0; }
  </style>`;

  /** D35E's parchment, like its own actor sheets: cream background, dark text, fields and buttons to match. */
  function skin() {
    let url = "systems/D35E/ui/parchment.jpg";
    try { url = (foundry.utils.getRoute ?? globalThis.getRoute)?.(url) ?? `/${url}`; } catch (e) { url = `/${url}`; }
    return `<style>
    .axecleft-shop .window-content { background: #e9dfc6 url("${url}") repeat; color: #191813; }
    .axecleft-shop .ash, .axecleft-shop .ash h2, .axecleft-shop .ash label, .axecleft-shop .ash summary, .axecleft-shop .ash b { color: #191813; }
    .axecleft-shop .ash input, .axecleft-shop .ash select { background: rgba(255,255,255,0.55); color: #191813; border: 1px solid #7a7971; }
    .axecleft-shop .ash select option { background: #f3ecd9; color: #191813; }
    .axecleft-shop .ash button { background: rgba(255,255,240,0.6); color: #191813; border: 1px solid #7a7971; }
    .axecleft-shop .ash button:hover { background: rgba(255,255,240,0.9); box-shadow: 0 0 4px #c9593f; }
    .axecleft-shop .ash a.ash-ctl { color: #3b3a33; } .axecleft-shop .ash a.ash-ctl:hover { color: #c9593f; text-shadow: none; }
    .axecleft-shop .ash { --table-background-color: transparent; --table-row-color-odd: transparent; --table-row-color-even: rgba(120, 90, 40, 0.07); --table-row-color-highlight: rgba(201, 89, 63, 0.12); --table-header-bg-color: #ddd0b0; --table-header-text-color: #191813; --table-header-border-color: #7a7971; }
    .axecleft-shop table.ash-t { background: transparent; color: #191813; }
    .axecleft-shop .ash table.ash-t tr, .axecleft-shop .ash table.ash-t tr:nth-child(odd), .axecleft-shop .ash table.ash-t tr:nth-child(even), .axecleft-shop table.ash-t td { background: transparent; color: #191813; }
    .axecleft-shop table.ash-t tr:nth-child(even) td { background: rgba(120, 90, 40, 0.07); }
    .axecleft-shop table.ash-t tr:hover td { background: rgba(201, 89, 63, 0.10); }
    .axecleft-shop table.ash-t tr.group td { background: rgba(120, 90, 40, 0.12); }
    .axecleft-shop table.ash-t th { background: #ddd0b0; color: #191813; border-bottom: 1px solid #7a7971; }
    .axecleft-shop table.ash-t td { border-top-color: rgba(25,24,19,0.18); }
    .axecleft-shop .ash-who, .axecleft-shop details.ash-gm, .axecleft-shop .ash-drop { border-color: #7a7971; background: rgba(255,255,255,0.18); }
    .axecleft-shop nav.ash-tabs { border-bottom-color: #7a7971; }
    .axecleft-shop .ash .warn { color: #8b2500; }
  </style>`;
  }

  const GROUPS = [["weapon", /*t*/"Weapons"], ["equipment", /*t*/"Armor and gear"], ["consumable", /*t*/"Consumables"], ["loot", /*t*/"Goods and loot"]];

  /** The characters a user can trade with: owned characters, their own assigned one first. */
  function charactersFor(user = game.user) {
    const list = [...(game.actors ?? [])].filter((a) => a.type === "character" && (user.isGM || a.testUserPermission(user, OWN().OWNER)));
    const mine = user.character;
    return list.sort((a, b) => (a === mine ? -1 : b === mine ? 1 : a.name.localeCompare(b.name)));
  }
  const openSheets = new Set();
  /** While one of the sheet's tours runs: the sheet it opened ("merchant" or "loot"), which shows examples of the parts it points at. */
  let tourDemo = null, tourSheet = null;
  const demoOn = (sheet) => !!tourDemo && sheet === tourSheet;
  const demoTag = () => `<span class="ash-demo-tag">${H("(example)")}</span>`;
  const demoAttr = (sheet, kind) => (demoOn(sheet) ? ` data-ash-tour="${kind}"` : "");

  /** The sheet's state for this user (who's trading, which tab). */
  function stateOf(sheet) {
    sheet._ash ??= { tab: "buy", buyer: null };
    const list = charactersFor();
    if (!list.some((a) => a.id === sheet._ash.buyer)) sheet._ash.buyer = list[0]?.id ?? null;
    return sheet._ash;
  }

  /** The sheet being drawn (its open descriptions). */
  let rendering = null;
  /**
   * An item's description as this user may see it: an unidentified item shows its unidentified description to players
   * (the GM sees both). Enriched (links, rolls), cached on the sheet until closed again.
   */
  async function describe(item) {
    const TE = foundry.applications?.ux?.TextEditor?.implementation ?? (typeof TextEditor !== "undefined" ? TextEditor : globalThis.TextEditor);
    const enrich = async (h) => { try { return TE?.enrichHTML ? await TE.enrichHTML(h ?? "", { async: true, secrets: game.user.isGM, relativeTo: item }) : (h ?? ""); } catch (e) { return h ?? ""; } };
    const ident = getP(item, "system.description.value") ?? "", unid = getP(item, "system.description.unidentified") ?? "";
    const none = `<p class="muted">${H("No description.")}</p>`;
    if (!unidentified(item)) return (await enrich(ident)) || none;
    if (!game.user.isGM) return (await enrich(unid)) || none;
    return `<p class="muted"><b>${H("Players see (unidentified):")}</b></p>${(await enrich(unid)) || none}<hr><p class="muted"><b>${H("Identified:")}</b></p>${(await enrich(ident)) || none}`;
  }

  function shopHTML(sheet) {
    rendering = sheet;
    const shop = sheet.actor ?? sheet.document;
    const gm = game.user.isGM;
    const s = shopOf(shop), st = stateOf(sheet);
    if (isLootMode(s)) return lootHTML(sheet);
    const chars = charactersFor();
    const buyer = st.buyer ? game.actors.get(st.buyer) : null;
    const limited = !gm && !shop.testUserPermission(game.user, OWN().LIMITED);
    const head = `<header class="ash-head"><img src="${esc(shop.img)}" alt="">
      ${gm ? `<button type="button" class="ash-act" data-ash="charsheet" style="order:9;margin-left:auto;align-self:flex-start" title="${H("The merchant's stats, skills and attacks on D35E's sheet (the shop stays its sheet)")}"><i class="fas fa-user"></i> ${H("Character sheet")}</button>` : ""}
      <div><h2>${esc(shop.name)}</h2><div class="sub">${s.shopName && !shop.name.includes(s.shopName) ? `${esc(s.shopName)} · ` : ""}${H("Sells at {sell}%, buys at {buy}%", { sell: s.sell, buy: s.buy })}${s.haggle ? ` · ${H("haggles")}` : ""}</div></div></header>`;
    if (limited) return `${STYLE}${skin()}<div class="ash">${head}<div class="ash-closed">${H("This shop isn't open to you.")}</div></div>`;
    const hag = buyer ? s.haggles?.[buyer.id] : null;
    const locked = !!(buyer && s.locked[buyer.id]);
    const steal = s.steal && theftOn() && buyer && !locked && !playerOwned(shop);
    sheet._ashLocked = locked && !gm; sheet._ashSteal = steal;
    const who = `<div class="ash-who"><b>${H("Trading as")}</b>
      ${chars.length ? `<select data-ash="buyer">${chars.map((a) => `<option value="${a.id}"${a.id === st.buyer ? " selected" : ""}>${esc(a.name)}</option>`).join("")}</select>` : `<span class="warn">${H("You have no character to trade with.")}</span>`}
      ${locked ? `<span class="warn"><i class="fas fa-lock"></i> ${H("{shop} won't deal with {name}.", { shop: shop.name, name: buyer.name })}</span>` : ""}
      ${steal ? `<button type="button" class="ash-act" data-ash="pickpocket" title="${H("Sleight of Hand; the GM decides")}"><i class="fas fa-hand-sparkles"></i> ${H("Pick a pocket")}</button>` : demoOn(sheet) ? `<span class="ash-demo"><button type="button" class="ash-act" data-ash="pickpocket" disabled><i class="fas fa-hand-sparkles"></i> ${H("Pick a pocket")}</button>${demoTag()}</span>` : ""}
      ${s.haggle && buyer && !locked ? (hag ? `<span class="muted">${hag.refused ? H("Haggled without success.") : (hag.pct > 0 ? H("Haggled: prices {pct}% better.", { pct: hag.pct }) : hag.pct < 0 ? H("Haggled: prices {pct}% worse.", { pct: -hag.pct }) : H("Haggled: prices unchanged."))}</span>`
        : HAGGLE_SKILLS.filter(([k]) => s.skills[k]).map(([k, label, icon]) => `<button type="button" class="ash-act" data-ash="haggle" data-skill="${k}" title="${H("Haggle: roll {skill}; the GM decides", { skill: t(label) })}"><i class="fas ${icon}"></i> ${H(label)}</button>`).join(""))
        : demoOn(sheet) ? `<span class="ash-demo">${HAGGLE_SKILLS.map(([k, label, icon]) => `<button type="button" class="ash-act" data-ash="haggle" data-skill="${k}" disabled><i class="fas ${icon}"></i> ${H(label)}</button>`).join("")}${demoTag()}</span>` : ""}
      ${buyer ? `<span class="purse">${H("Purse")}: <b>${esc(money(wealth(buyer)))}</b></span>` : ""}</div>`;
    const tabs = `<nav class="ash-tabs"><button type="button" data-ash-tab="buy" class="${st.tab === "buy" ? "active" : ""}"><i class="fas fa-store"></i> ${H("Buy")}</button>
      <button type="button" data-ash-tab="sell" class="${st.tab === "sell" ? "active" : ""}"><i class="fas fa-hand-holding-dollar"></i> ${H("Sell")}</button></nav>`;
    st.cart ??= {};
    const list = st.tab === "sell" ? sellHTML(shop, sheet._ashLocked ? null : buyer) : buyHTML(shop, sheet._ashLocked ? null : buyer, steal, st.cart);
    let basket = st.tab === "buy" && !sheet._ashLocked ? basketHTML(shop, buyer, st) : "";
    if (!basket && demoOn(sheet) && st.tab === "buy") {
      const first = stockOf(shop)[0];
      basket = `<fieldset class="ash-demo-box" disabled><div class="ash-row ash-basket ash-demo" style="padding:4px 6px;border:1px solid #7a7971;border-radius:4px;background:rgba(255,255,255,0.25)"><b><i class="fas fa-basket-shopping"></i> ${H("Basket")}</b>${demoTag()}
        ${first ? `<span>1 × ${esc(shownName(first))}<a class="ash-ctl"><i class="fas fa-minus"></i></a></span><span style="margin-left:auto">${H("Total")}: <b>${esc(money(askPrice(shop, first, buyer)))}</b></span>` : `<span style="margin-left:auto"></span>`}
        <button type="button" class="ash-act"><i class="fas fa-cash-register"></i> ${H("Buy all")}</button><button type="button" class="ash-act"><i class="fas fa-xmark"></i> ${H("Empty")}</button></div></fieldset>`;
    }
    return `${STYLE}${skin()}<div class="ash"${demoAttr(sheet, "merchant")}>${head}${gm ? gmHTML(shop, s, !!st.gmOpen, !!st.logOpen, demoOn(sheet)) : ""}${who}${tabs}${basket}<div class="ash-list">${list}</div>
      <div class="ash-drop">${gm ? H("Drop items here to add them to the stock.") : H("Drop an item from your character here to sell it.")}</div></div>`;
  }

  function rowsByGroup(items, row) {
    return GROUPS.map(([type, label]) => {
      const here = items.filter((i) => i.type === type || (type === "loot" && i.type === "valuable")).sort((a, b) => shownName(a).localeCompare(shownName(b)));
      const desc = (i) => { const d = rendering?._ash?.desc?.[i.uuid]; return d == null ? "" : `<tr class="ash-desc"><td colspan="5"><div class="ash-desc-body">${d}</div></td></tr>`; };
      return here.length ? `<tr class="group"><td colspan="5">${H(label)}</td></tr>${here.map((i) => row(i) + desc(i)).join("")}` : "";
    }).join("");
  }

  function buyHTML(shop, buyer, steal = false, cart = null) {
    const gm = game.user.isGM;
    const items = stockOf(shop);
    if (!items.length) return `<p class="muted" style="padding:1em">${H("Nothing for sale.")}</p>`;
    const row = (i) => {
      const price = askPrice(shop, i, buyer), q = qtyOf(i);
      const name = gm && unidentified(i) ? `${esc(i.name)} <small class="muted">(${H("shown as {name}", { name: shownName(i) })})</small>` : esc(shownName(i));
      const ctl = gm ? `<a class="ash-ctl" data-ash="hide" data-id="${i.id}" title="${H(isHidden(i) ? "Hidden from players: show" : "Hide from players")}"><i class="fas ${isHidden(i) ? "fa-eye-slash" : "fa-eye"}"></i></a>
        <a class="ash-ctl" data-ash="qty" data-d="-1" data-id="${i.id}" title="${H("One fewer")}"><i class="fas fa-minus"></i></a><a class="ash-ctl" data-ash="qty" data-d="1" data-id="${i.id}" title="${H("One more")}"><i class="fas fa-plus"></i></a>
        <a class="ash-ctl" data-ash="edit" data-id="${i.id}" title="${H("Edit")}"><i class="fas fa-pen"></i></a><a class="ash-ctl" data-ash="delete" data-id="${i.id}" title="${H("Remove")}"><i class="fas fa-trash"></i></a>` : "";
      return `<tr class="${isHidden(i) ? "hidden-item" : ""}"><td class="name"><img src="${esc(i.img)}" alt=""><span class="ash-name" data-ash="desc" data-uuid="${i.uuid}">${name}</span></td><td class="n">${q}</td>
        <td class="n">${esc(money(price))}</td><td class="n">${steal && q > 0 ? `<a class="ash-ctl" data-ash="shoplift" data-id="${i.id}" title="${H("Shoplift: Sleight of Hand; the GM decides")}"><i class="fas fa-hand-sparkles"></i></a> ` : ""}${buyer && q > 0 && cart ? `<a class="ash-ctl" data-ash="cart" data-id="${i.id}" title="${H("Add one to the basket")}"><i class="fas fa-cart-plus"></i>${cart[i.id] ? `<small>${cart[i.id]}</small>` : ""}</a> ` : ""}${buyer && q > 0 ? `<button type="button" class="ash-act" data-ash="buy" data-id="${i.id}">${H("Buy")}</button>` : ""}</td><td class="n">${ctl}</td></tr>`;
    };
    return `<table class="ash-t"><tr><th>${H("Item")}</th><th class="n">${H("Qty")}</th><th class="n">${H("Price each")}</th><th></th><th></th></tr>${rowsByGroup(items, row)}</table>`;
  }
  /** The basket: what's in it (kept to what the shop still has), its total, Buy all. */
  function basketHTML(shop, buyer, st) {
    const cart = st.cart ?? {};
    for (const [id, n] of Object.entries(cart)) { const it = shop.items.get(id); const max = it && (game.user.isGM || !isHidden(it)) ? qtyOf(it) : 0; if (n > max) { if (max > 0) cart[id] = max; else delete cart[id]; } }
    const lines = Object.entries(cart).map(([id, n]) => ({ it: shop.items.get(id), n })).filter((x) => x.it);
    if (!lines.length || !buyer) return "";
    const total = lines.reduce((s, x) => s + askPrice(shop, x.it, buyer) * x.n, 0);
    const short = total > wealth(buyer);
    return `<div class="ash-row ash-basket" style="padding:4px 6px;border:1px solid #7a7971;border-radius:4px;background:rgba(255,255,255,0.25)"><b><i class="fas fa-basket-shopping"></i> ${H("Basket")}</b>
      ${lines.map((x) => `<span>${x.n} × ${esc(shownName(x.it))}<a class="ash-ctl" data-ash="uncart" data-id="${x.it.id}" title="${H("One fewer")}"><i class="fas fa-minus"></i></a></span>`).join(" ")}
      <span style="margin-left:auto">${H("Total")}: <b class="${short ? "warn" : ""}">${esc(money(total))}</b></span>
      <button type="button" class="ash-act" data-ash="buyAll"${short ? ` title="${H("{name} has {has}", { name: buyer.name, has: money(wealth(buyer)) })}"` : ""}><i class="fas fa-cash-register"></i> ${H("Buy all")}</button>
      <button type="button" class="ash-act" data-ash="clearCart"><i class="fas fa-xmark"></i> ${H("Empty")}</button></div>`;
  }

  function sellHTML(shop, seller) {
    if (!seller) return `<p class="muted" style="padding:1em">${H("Choose a character to sell from.")}</p>`;
    const items = sellable(seller);
    if (!items.length) return `<p class="muted" style="padding:1em">${H("{name} has nothing this shop buys.", { name: seller.name })}</p>`;
    const row = (i) => {
      const offer = offerPrice(shop, i, seller), q = qtyOf(i);
      const notes = [getP(i, "system.equipped") ? t("equipped") : "", isTradeGoods(i) ? t("trade goods at {pct}%", { pct: shopOf(shop).tradeBuy }) : ""].filter(Boolean).join(", ");
      return `<tr><td class="name"><img src="${esc(i.img)}" alt=""><span class="ash-name" data-ash="desc" data-uuid="${i.uuid}">${esc(i.name)}${notes ? ` <small class="muted">(${esc(notes)})</small>` : ""}</span></td><td class="n">${q}</td>
        <td class="n">${offer > 0 ? esc(money(offer)) : `<span class="muted">${H("no offer")}</span>`}</td><td class="n">${offer > 0 ? `<button type="button" class="ash-act" data-ash="sell" data-id="${i.id}">${H("Sell")}</button>` : ""}</td><td></td></tr>`;
    };
    return `<table class="ash-t"><tr><th>${H("{name}'s items", { name: seller.name })}</th><th class="n">${H("Qty")}</th><th class="n">${H("Offer each")}</th><th></th><th></th></tr>${rowsByGroup(items, row)}</table>`;
  }

  function gmHTML(shop, s, gmOpen = false, logOpen = false, demo = false) {
    const own = shop.flags?.[FLAG]?.[KEY] ?? {};
    const cur = shop.system?.currency ?? {};
    const open = (shop.ownership?.default ?? 0) >= OWN().LIMITED;
    const hag = Object.entries(s.haggles ?? {});
    return `<details class="ash-gm"${gmOpen ? " open" : ""}><summary><i class="fas fa-user-shield"></i> ${H("GM: shop settings")} <small class="muted">${H("(players don't see this)")}</small></summary>
      <div class="ash-grid">
        <label>${H("Sheet")}</label><span>${modeSelect(s.mode)}</span><span></span><span></span>
        <label>${H("Sells at")}</label><span><input type="number" data-ash-set="sell" value="${s.sell}" min="0" max="1000"> %</span>
        <label>${H("Buys at")}</label><span><input type="number" data-ash-set="buy" value="${s.buy}" min="0" max="1000"> %</span>
        <label>${H("Trade goods: sells at")}</label><span><input type="number" data-ash-set="tradeSell" value="${own.tradeSell ?? ""}" placeholder="${worldPct("tradeGoodsSell")}" min="0" max="1000"> %</span>
        <label>${H("Trade goods: buys at")}</label><span><input type="number" data-ash-set="tradeBuy" value="${own.tradeBuy ?? ""}" placeholder="${worldPct("tradeGoodsBuy")}" min="0" max="1000"> %</span>
        <label>${H("Open to")}</label><span><select data-ash-set="open"><option value="0"${open ? "" : " selected"}>${H("Players set in Ownership")}</option><option value="1"${open ? " selected" : ""}>${H("All players")}</option></select></span>
        <label>${H("Trades in chat")}</label><span><select data-ash-set="chat">${[["public", /*t*/"For everyone"], ["gm", /*t*/"GM only"], ["none", /*t*/"Not shown"]].map(([k, l]) => `<option value="${k}"${s.chat === k ? " selected" : ""}>${H(l)}</option>`).join("")}</select></span>
      </div>
      <p class="muted" style="margin:2px 0;font-size:0.85em">${H("Trade goods are gems, art and jewelry (D35E's Full Resale Price). Empty: the world's house rule, set in the module settings ({sell}% / {buy}%).", { sell: worldPct("tradeGoodsSell"), buy: worldPct("tradeGoodsBuy") })}</p>
      <div class="ash-row"><label><input type="checkbox" data-ash-set="haggle"${s.haggle ? " checked" : ""}> ${H("Players can haggle (you approve each one), with:")}</label>
        ${HAGGLE_SKILLS.map(([k, label]) => `<label><input type="checkbox" data-ash-skill="${k}"${s.skills[k] ? " checked" : ""}${s.haggle ? "" : " disabled"}> ${H(label)}</label>`).join("")}</div>
      <div class="ash-row">
        ${hag.length ? `<span class="muted">${hag.map(([, h]) => esc(`${h.name ?? "?"} ${h.refused ? "×" : `${h.pct >= 0 ? "+" : ""}${h.pct}%`}`)).join(", ")}</span> <button type="button" class="ash-act" data-ash="resetHaggles"><i class="fas fa-rotate-left"></i> ${H("Reset haggling")}</button>` : ""}</div>
      <div class="ash-row"><label><input type="checkbox" data-ash-set="steal"${s.steal ? " checked" : ""}> ${H("Players can try pickpocketing and shoplifting here (you decide each one)")}</label>
        <span style="flex-basis:100%"><b>${H("Security")}</b> ${SECURITY.map((x) => `<label title="${H(x.hint)}" style="white-space:nowrap"><input type="checkbox" data-ash-sec="${x.key}"${s.security.includes(x.key) ? " checked" : ""}> ${H(x.label)}</label>`).join(" ")}</span>
        ${Object.keys(s.locked).length ? `<span>${H("Locked out:")} ${Object.entries(s.locked).map(([id, n]) => `${esc(n)} <a class="ash-ctl" data-ash="unlock" data-id="${esc(id)}" title="${H("Let them trade again")}"><i class="fas fa-lock-open"></i></a>`).join(" ")}</span>` : ""}</div>
      <div class="ash-row"><b>${H("Purse")}</b>${STD.map(([k]) => `<label>${esc(coinName(k))} <input type="number" data-ash-coin="${k}" value="${Number(cur[k]) || 0}" min="0" style="width:6em"></label>`).join("")}<span class="muted">${H("Total {money}", { money: money(wealth(shop)) })}</span></div>
      <div class="ash-row">${globalThis.AxecleftMerchants?.generateMerchant ? `<button type="button" class="ash-act" data-ash="restock"><i class="fas fa-boxes-stacked"></i> ${H("Restock")}</button>
        <button type="button" class="ash-act" data-ash="generator"><i class="fas fa-store"></i> ${H("Merchant Generator")}</button>` : ""}
        <span class="muted">${H("Players need Limited or Observer on this actor to trade (never Owner).")}</span></div>
      ${logHTML(lootOf(shop), true, logOpen, demo)}
    </details>`;
  }

  /** How many: a small dialog (1 when there's only one). */
  async function askQty(title, label, max, priceEach) {
    if (max <= 1) return 1;
    const DV = A()?.DialogV2 ?? foundry.applications.api.DialogV2;
    let n = null;
    await DV.wait({
      window: { title }, rejectClose: false,
      content: `<div class="form-group"><label>${esc(label)}</label><input type="number" name="qty" value="1" min="1" max="${max}" style="width:6em"> <small>/ ${max}</small></div>
        ${priceEach == null ? "" : `<p class="hint" style="font-size:0.9em;opacity:0.85">${H("{price} each", { price: money(priceEach) })}</p>`}`,
      buttons: [
        { action: "ok", label: t("OK"), icon: "fas fa-check", default: true, callback: (ev, button) => { n = Number(button.form?.elements?.qty?.value ?? button.form?.querySelector?.("[name=qty]")?.value); return "ok"; } },
        { action: "no", label: t("Cancel"), icon: "fas fa-xmark" },
      ],
    });
    return Number.isFinite(n) && n >= 1 ? Math.min(max, Math.floor(n)) : null;
  }

  async function askNumber(title, label) {
    const DV = A()?.DialogV2 ?? foundry.applications.api.DialogV2;
    let n = null;
    await DV.wait({
      window: { title }, rejectClose: false,
      content: `<div class="form-group"><label>${esc(label)}</label><input type="number" name="n" value="" min="0" style="width:6em" autofocus></div>`,
      buttons: [
        { action: "ok", label: t("OK"), icon: "fas fa-check", default: true, callback: (ev, button) => { n = Number(button.form?.elements?.n?.value ?? button.form?.querySelector?.("[name=n]")?.value); return "ok"; } },
        { action: "no", label: t("Cancel"), icon: "fas fa-xmark" },
      ],
    });
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
  }

  async function confirmTrade(title, text) {
    const DV = A()?.DialogV2 ?? foundry.applications.api.DialogV2;
    return DV.confirm({ window: { title }, content: `<p>${text}</p>` });
  }

  const rerender = (sheet) => { try { if (sheet.rendered) sheet.render(); } catch (e) { /* closed */ } };

  /** The sheet's buttons and fields (one listener on the content). */
  function bindShop(sheet, root) {
    if (!root) return;
    openSheets.add(sheet);
    // Back to where the lists were scrolled before the redraw
    const keep = stateOf(sheet).scroll ?? {};
    const restore = () => { for (const [sel, y] of Object.entries(keep)) { const el = sel === "content" ? root : root.querySelector(sel); if (el && y && el.scrollTop !== y) el.scrollTop = y; } };
    restore(); requestAnimationFrame?.(restore);
    // The content element can outlive a redraw (Foundry 13+): its listeners are added once
    if (root._ashBound === sheet) return;
    root._ashBound = sheet;
    const shop = sheet.actor ?? sheet.document;
    const st = stateOf(sheet);
    const notify = (res) => { if (res?.text) ui.notifications.info(t(res.text, res.data)); };
    const run = async (fn) => { try { notify(await fn()); } catch (err) { ui.notifications.warn(err.message); } finally { rerender(sheet); } };
    // Descriptions: a pop-up while the pointer rests on an item's name (cached for this sheet)
    let tipTimer = null, tip = null, tipFor = null;
    const hideTip = () => { clearTimeout(tipTimer); tipTimer = null; tipFor = null; tip?.remove(); tip = null; };
    root.addEventListener("mouseover", (ev) => {
      const dn = ev.target.closest?.('[data-ash="desc"]');
      if (!dn) { if (tip || tipTimer) hideTip(); return; }
      if (dn === tipFor) return;
      hideTip(); tipFor = dn;
      const u = dn.dataset.uuid;
      if (st.desc?.[u] != null) return; // already open under the item
      tipTimer = setTimeout(async () => {
        st.tips ??= {};
        if (st.tips[u] == null) { const it = await fromUuid(u).catch(() => null); if (!it) return; st.tips[u] = await describe(it); }
        if (tipFor !== dn || !dn.isConnected) return;
        tip = document.createElement("div");
        tip.className = "axecleft-shop-tip";
        tip.innerHTML = st.tips[u];
        Object.assign(tip.style, { position: "fixed", zIndex: 10000, maxWidth: "420px", maxHeight: "50vh", overflowY: "auto", padding: "6px 10px", fontSize: "13px", lineHeight: "1.35",
          background: "#f3ecd9", color: "#191813", border: "1px solid #7a7971", borderLeft: "3px solid #c9593f", borderRadius: "4px", boxShadow: "0 3px 10px rgba(0,0,0,0.45)", pointerEvents: "none" });
        document.body.append(tip);
        const r = dn.getBoundingClientRect(), h = tip.offsetHeight, w = tip.offsetWidth;
        tip.style.left = `${Math.max(4, Math.min(r.left, window.innerWidth - w - 8))}px`;
        tip.style.top = `${r.bottom + 6 + h > window.innerHeight ? Math.max(4, r.top - h - 6) : r.bottom + 6}px`;
      }, 400);
    });
    root.addEventListener("mouseout", (ev) => { const dn = ev.target.closest?.('[data-ash="desc"]'); if (dn && !dn.contains(ev.relatedTarget)) hideTip(); });
    root.addEventListener("click", hideTip, true);
    root.addEventListener("mouseleave", hideTip);
    root.addEventListener("scroll", (ev) => {
      const el = ev.target, s2 = (st.scroll ??= {});
      if (el === root) s2.content = el.scrollTop;
      else if (el.classList?.contains("ash-list")) s2[".ash-list"] = el.scrollTop;
    }, true);
    root.addEventListener("toggle", (ev) => { const c = ev.target.classList; if (c?.contains("ash-log")) st.logOpen = ev.target.open; else if (c?.contains("ash-gm")) st.gmOpen = ev.target.open; }, true);
    root.addEventListener("click", async (ev) => {
      const tab = ev.target.closest("[data-ash-tab]");
      if (tab) { st.tab = tab.dataset.ashTab; return rerender(sheet); }
      const dn = ev.target.closest('[data-ash="desc"]');
      if (dn) {
        ev.preventDefault();
        st.desc ??= {};
        const u = dn.dataset.uuid;
        if (st.desc[u] != null) delete st.desc[u];
        else if (st.tips?.[u] != null) st.desc[u] = st.tips[u];
        else { const it = await fromUuid(u).catch(() => null); if (!it) return; st.desc[u] = await describe(it); }
        return rerender(sheet);
      }
      const el = ev.target.closest("[data-ash]");
      if (!el || el.tagName === "SELECT" || el.tagName === "INPUT") return;
      ev.preventDefault();
      const act = el.dataset.ash, id = el.dataset.id;
      const buyer = st.buyer ? game.actors.get(st.buyer) : null;
      if (act === "buy") {
        const item = shop.items.get(id); if (!item || !buyer) return;
        const each = askPrice(shop, item, buyer);
        const qty = await askQty(t("Buy {item}", { item: shownName(item) }), t("How many?"), qtyOf(item), each);
        if (!qty) return;
        if (!(await confirmTrade(t("Buy"), H("{name} buys {qty} × {item} for {price}?", { name: buyer.name, qty, item: shownName(item), price: money(each * qty) })))) return;
        return run(() => call("buy", { shop: shop.uuid, item: id, qty, buyer: buyer.uuid }));
      }
      if (act === "sell") return sellFlow(sheet, shop, buyer, id, run);
      if (act === "pickpocket") return stealFlow({ kind: "pocket", target: shop, thief: buyer });
      if (act === "shoplift") return stealFlow({ kind: "shoplift", target: shop, itemId: id, thief: buyer });
      if (act === "cart") { const it = shop.items.get(id); if (!it) return; st.cart ??= {}; st.cart[id] = Math.min(qtyOf(it), (st.cart[id] ?? 0) + 1); return rerender(sheet); }
      if (act === "uncart") { if (st.cart?.[id]) { st.cart[id] -= 1; if (st.cart[id] <= 0) delete st.cart[id]; } return rerender(sheet); }
      if (act === "clearCart") { st.cart = {}; return rerender(sheet); }
      if (act === "buyAll") {
        if (!buyer) return;
        const lines = Object.entries(st.cart ?? {}).map(([cid, n]) => ({ it: shop.items.get(cid), n })).filter((x) => x.it && x.n > 0);
        if (!lines.length) return;
        const total = lines.reduce((sum, x) => sum + askPrice(shop, x.it, buyer) * x.n, 0);
        if (!(await confirmTrade(t("Buy"), H("{name} buys {what} for {price}?", { name: buyer.name, what: lines.map((x) => `${x.n} × ${shownName(x.it)}`).join(", "), price: money(total) })))) return;
        return run(async () => { const r = await call("buyMany", { shop: shop.uuid, buyer: buyer.uuid, items: lines.map((x) => ({ id: x.it.id, qty: x.n })) }); st.cart = {}; return r; });
      }
      if (act === "haggle") {
        if (!buyer) return;
        return run(async () => {
          const skill = HAGGLE_SKILLS.find(([k]) => k === el.dataset.skill) ?? HAGGLE_SKILLS[0];
          const mod = Number(getP(buyer, `system.skills.${skill[0]}.mod`)) || 0;
          const roll = new Roll(`1d20 + ${mod}`);
          await roll.evaluate();
          try { await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: buyer }), flavor: t("{skill}: haggling with {shop}", { skill: t(skill[1]), shop: shop.name }) }); } catch (e) { /* the roll still counts */ }
          ui.notifications.info(t("Asking the GM…"));
          return call("haggle", { shop: shop.uuid, buyer: buyer.uuid, total: roll.total, skill: skill[0] }, 300000);
        });
      }
      // Loot and party storage
      if (["take", "sneak", "takeCoins", "sneakCoins", "putCoins", "split", "lk"].includes(act)) {
        if (!buyer) return ui.notifications.warn(t("Choose a character."));
        const lcall = (op, extra = {}) => run(() => call("loot", { box: shop.uuid, by: buyer.uuid, op, ...extra }));
        const slight = async () => { const r = await d20(skillMod(buyer, "slt")); ui.notifications.info(t("Sleight of Hand: {total}.", { total: r })); return r; };
        if (act === "take" || act === "sneak") {
          const item = shop.items.get(id); if (!item) return;
          const qty = await askQty((act === "take" ? t("Take {item}", { item: shownName(item) }) : t("Slip {item} away", { item: shownName(item) })), t("How many?"), qtyOf(item), null);
          if (!qty) return;
          return lcall(act, { item: id, qty, total: act === "sneak" ? await slight() : null });
        }
        if (act === "takeCoins" || act === "sneakCoins") {
          const coins = await askCoins((act === "takeCoins" ? t("Take coins") : t("Slip coins away")), Object.fromEntries(COINS.map((k) => [k, coinsOf(shop, k)])));
          if (!coins) return;
          return lcall(act === "takeCoins" ? "take" : "sneak", { coins, total: act === "sneakCoins" ? await slight() : null });
        }
        if (act === "putCoins") {
          const coins = await askCoins(t("Put coins in"), Object.fromEntries(COINS.map((k) => [k, coinsOf(buyer, k)])));
          return coins ? lcall("putCoins", { coins }) : null;
        }
        if (act === "split") { const chars = await askSplit(shop); return chars ? lcall("split", { chars }) : null; }
        const op = el.dataset.op;
        const take = root.querySelector("[data-ash-take]")?.value ?? "roll", tools = Number(root.querySelector("[data-ash-tools]")?.value) || 0;
        const check = async (label, mod) => {
          const tot = take === "10" ? 10 + mod : take === "20" ? 20 + mod : await d20(mod);
          ui.notifications.info(t("{skill}: {total}.", { skill: label, total: tot }));
          return tot;
        };
        if (op === "pick") return lcall("pick", { total: await check(t("Open Lock"), skillMod(buyer, "opl") + tools) });
        if (op === "force") return lcall("force", { total: await d20(Number(getP(buyer, "system.abilities.str.mod")) || 0) });
        if (op === "break") { const dmg = await askNumber(t("Break it"), t("Damage dealt (rolled on the character's sheet)")); return dmg == null ? null : lcall("break", { damage: dmg }); }
        if (op === "search") return lcall("search", { total: await d20(skillMod(buyer, "src")) });
        if (op === "disable") return lcall("disable", { total: await d20(skillMod(buyer, "dev") + tools) });
        return lcall(op);
      }
      // GM controls
      if (!game.user.isGM) return;
      if (act === "hide") { const it = shop.items.get(id); if (it) await it.update({ [`flags.${FLAG}.${HIDDEN}`]: !isHidden(it) }); return; }
      if (act === "qty") { const it = shop.items.get(id); if (!it) return; const n = qtyOf(it) + Number(el.dataset.d); if (n <= 0) await it.delete(); else await it.update({ "system.quantity": n }); return; }
      if (act === "edit") return shop.items.get(id)?.sheet?.render(true);
      if (act === "delete") { const it = shop.items.get(id); if (it && (await confirmTrade(t("Remove"), H("Remove {item} from the stock?", { item: it.name })))) await it.delete(); return; }
      if (act === "unlock") { await shop.update({ [`flags.${FLAG}.${KEY}.locked.-=${id}`]: null }); return; }
      if (act === "resetHaggles") { await shop.update({ [`flags.${FLAG}.${KEY}.-=haggles`]: null }); return; }
      if (act === "restock") {
        if (!(await confirmTrade(t("Restock"), H("Restock {name} with its saved shop settings (half a new stock, half a purse)?", { name: shop.name })))) return;
        try { await globalThis.AxecleftMerchants.generateMerchant({ mode: "actor", uuid: shop.uuid, stockMode: "restock", useSaved: true }); await shop.update({ [`flags.${FLAG}.${KEY}.-=haggles`]: null }); } catch (err) { ui.notifications.error(err.message); }
        return;
      }
      if (act === "charsheet") return statSheet(shop);
      if (game.user.isGM && act === "close") return shop.update({ [`flags.${FLAG}.${KEY}.opened`]: false });
      if (game.user.isGM && act === "gmOpen") return shop.update({ [`flags.${FLAG}.${KEY}.opened`]: true });
      if (game.user.isGM && act === "clearLog") return shop.update({ [`flags.${FLAG}.${KEY}.log`]: [] });
      if (act === "generator") return globalThis.AxecleftMerchants?.open?.("merchant");
    });
    root.addEventListener("change", async (ev) => {
      const el = ev.target;
      if (el.dataset.ash === "buyer") { st.buyer = el.value; return rerender(sheet); }
      if (!game.user.isGM) return;
      const set = el.dataset.ashSet, coin = el.dataset.ashCoin;
      if (coin) return shop.update({ [`system.currency.${coin}`]: Math.max(0, Math.floor(Number(el.value) || 0)) });
      if (set === "sell" || set === "buy") {
        const v = Math.max(0, Math.round(Number(el.value) || 0));
        return shop.update({ [`flags.${FLAG}.${KEY}.${set}`]: v, [`flags.D35E.${set === "sell" ? "priceModifier" : "priceModifierBuy"}`]: v / 100 });
      }
      if (el.dataset.ashSec) {
        const cur = new Set(shopOf(shop).security);
        if (el.checked) cur.add(el.dataset.ashSec); else cur.delete(el.dataset.ashSec);
        const list = SECURITY.map((x) => x.key).filter((k) => cur.has(k));
        // Kept with the Merchant Generator's saved settings too, so a restock keeps it
        const u = { [`flags.${FLAG}.${KEY}.security`]: list };
        if (shop.flags?.[FLAG]?.axecleftMerchant) u[`flags.${FLAG}.axecleftMerchant.security`] = list;
        return shop.update(u);
      }
      if (set === "mode") return shop.update({ [`flags.${FLAG}.${KEY}.mode`]: el.value });
      if (el.dataset.ashL) {
        const k = el.dataset.ashL, F = `flags.${FLAG}.${KEY}`;
        let v = el.dataset.bool !== undefined ? el.checked : el.type === "number" ? (el.value === "" ? null : Number(el.value)) : el.value;
        const u = { [`${F}.${k}`]: v };
        if (k === "lock.quality") { const q = LOCKS.find(([x]) => x === v); if (q) u[`${F}.lock.dc`] = q[2]; }
        if (k === "lock.box") { const b = BOXES.find(([x]) => x === v); if (b?.[2] != null) Object.assign(u, { [`${F}.lock.hardness`]: b[2], [`${F}.lock.hp`]: b[3], [`${F}.lock.hpMax`]: b[3], [`${F}.lock.breakDc`]: b[4], [`${F}.lock.broken`]: false }); }
        if (k === "lock.dc") u[`${F}.lock.quality`] = LOCKS.find(([, , dc]) => dc === v)?.[0] ?? "custom";
        if (k === "lock.hp") { u[`${F}.lock.hpMax`] = v; if (v > 0) u[`${F}.lock.broken`] = false; }
        if ((k === "lock.locked" || k === "trap.armed") && v) u[`${F}.opened`] = false;
        if (k === "trap.armed" && v) u[`${F}.trap.found`] = [];
        return shop.update(u);
      }
      if (set === "steal") return shop.update({ [`flags.${FLAG}.${KEY}.steal`]: el.checked });
      if (set === "haggle") return shop.update({ [`flags.${FLAG}.${KEY}.haggle`]: el.checked });
      if (set === "tradeSell" || set === "tradeBuy") return shop.update({ [`flags.${FLAG}.${KEY}.${set}`]: el.value === "" ? null : Math.max(0, Math.round(Number(el.value) || 0)) });
      if (el.dataset.ashSkill) return shop.update({ [`flags.${FLAG}.${KEY}.skills.${el.dataset.ashSkill}`]: el.checked });
      if (set === "chat") return shop.update({ [`flags.${FLAG}.${KEY}.chat`]: el.value });
      if (set === "open") return shop.update({ "ownership.default": el.value === "1" ? OWN().LIMITED : OWN().NONE });
    });
    // Drops: a GM adds stock; a player sells an item of theirs
    root.addEventListener("dragover", (ev) => ev.preventDefault());
    root.addEventListener("drop", async (ev) => {
      let data = null;
      try { data = JSON.parse(ev.dataTransfer?.getData("text/plain") || "null"); } catch (e) { return; }
      if (data?.type !== "Item" || !data.uuid) return;
      ev.preventDefault(); ev.stopPropagation();
      const item = await fromUuid(data.uuid);
      if (!item) return;
      if (item.parent?.uuid === shop.uuid) return;
      if (isLootMode(shopOf(shop)) && item.parent?.documentName === "Actor" && item.parent.isOwner && item.parent.type === "character") {
        const L = lootOf(shop);
        if ((L.lock.locked || !L.opened) && !game.user.isGM) return ui.notifications.warn(t("{box} is closed.", { box: shop.name }));
        const qty = await askQty(t("Put {item} in", { item: item.name }), t("How many?"), qtyOf(item), null);
        if (!qty) return;
        return run(() => call("loot", { box: shop.uuid, by: item.parent.uuid, op: "put", item: item.id, qty }));
      }
      if (item.parent?.documentName === "Actor" && item.parent.isOwner && !game.user.isGM) {
        if (shopOf(shop).locked[item.parent.id]) return ui.notifications.warn(t("{shop} won't deal with {name}.", { shop: shop.name, name: item.parent.name }));
        st.buyer = item.parent.id; st.tab = "sell";
        return sellFlow(sheet, shop, item.parent, item.id, run);
      }
      if (!game.user.isGM) return ui.notifications.warn(t("Drop an item from your own character to sell it."));
      if (!TRADE_TYPES.includes(item.type)) return ui.notifications.warn(t("A shop stocks weapons, armor and gear, consumables and goods."));
      const d = item.toObject(); delete d._id;
      if (item.pack) foundry.utils.setProperty(d, "_stats.compendiumSource", item.uuid);
      foundry.utils.setProperty(d, "system.equipped", false);
      await shop.createEmbeddedDocuments("Item", [d]);
    }, true);
  }

  async function sellFlow(sheet, shop, seller, id, run) {
    const item = seller?.items.get(id); if (!item) return;
    const each = offerPrice(shop, item, seller);
    if (each <= 0) return ui.notifications.warn(t("{shop} won't pay anything for that.", { shop: shop.name }));
    const qty = await askQty(t("Sell {item}", { item: item.name }), t("How many?"), qtyOf(item), each);
    if (!qty) return;
    const eq = getP(item, "system.equipped") ? ` ${H("(it's equipped)")}` : "";
    if (!(await confirmTrade(t("Sell"), H("{name} sells {qty} × {item} for {price}?", { name: seller.name, qty, item: item.name, price: money(each * qty) }) + eq))) return;
    return run(() => call("sell", { shop: shop.uuid, item: id, qty, seller: seller.uuid }));
  }


  /* ------------------------------------------ */
  /*  Loot and party storage; locks and traps    */
  /* ------------------------------------------ */

  const LOOTCARD = "axecleftLootCard";
  /** Lock quality and its Open Lock DC (SRD). */
  const LOCKS = [["simple", /*t*/"Very simple lock", 20], ["average", /*t*/"Average lock", 25], ["good", /*t*/"Good lock", 30], ["amazing", /*t*/"Amazing lock", 40]];
  /** Containers: hardness, hit points, Break DC (SRD). */
  const BOXES = [["small", /*t*/"Small chest", 5, 1, 17], ["treasure", /*t*/"Treasure chest", 5, 15, 23], ["custom", /*t*/"Other (set below)", null, null, null]];
  const SAVES = [["ref", /*t*/"Reflex"], ["fort", /*t*/"Fortitude"], ["will", /*t*/"Will"], ["none", /*t*/"No save"]];
  const isLootMode = (s) => s.mode === "loot" || s.mode === "storage";
  /** A container's lock, trap and state. Unlocked, untrapped and open unless the GM sets them. */
  function lootOf(actor) {
    const o = actor?.flags?.[FLAG]?.[KEY] ?? {};
    const lock = { locked: false, quality: "average", dc: 25, key: "", arcane: false, box: "treasure", hardness: 5, hp: 15, hpMax: 15, breakDc: 23, broken: false, ...(o.lock ?? {}) };
    const trap = { armed: false, actor: "", name: "", searchDc: 20, disableDc: 20, save: "ref", saveDc: 15, damage: "", half: true, poison: "", found: [], ...(o.trap ?? {}) };
    return { lock, trap, opened: o.opened !== false, split: !!o.split, log: Array.isArray(o.log) ? o.log : [] };
  }
  /** A trap actor from the Traps module (or any D35E trap actor) behind the container's trap. */
  const trapActor = (tr) => (tr.actor ? game.actors?.get(tr.actor) ?? null : null);
  const trapDcs = (tr) => { const a = trapActor(tr); return a ? { search: Number(getP(a, "system.details.findDC")) || tr.searchDc, disable: Number(getP(a, "system.details.disarmDC")) || tr.disableDc, name: a.name } : { search: tr.searchDc, disable: tr.disableDc, name: tr.name || t("Trap") }; };
  const lootKinds = ["weapon", "equipment", "consumable", "loot", "valuable"];
  const contentsOf = (box, user = game.user) => box.items.filter((i) => lootKinds.includes(i.type) && !inContainer(i) && (user.isGM || !isHidden(i)));
  const coinText = (c) => COINS.filter((k) => c[k] > 0).map((k) => `${Number(c[k]).toLocaleString()} ${coinName(k)}`).join(", ");
  const skillMod = (a, k) => Number(getP(a, `system.skills.${k}.mod`)) || 0;
  /** Trapfinding (SRD: only characters with it find traps above DC 20, or disable magic ones). */
  const trapfinding = (a) => a.items.some((i) => /trapfinding/i.test(i.name) || (i.type === "class" && /\brogue\b/i.test(i.name)));
  /** The player characters who might notice: assigned characters of the other active players the container is open to. */
  function watchersOf(box, notUserId) {
    const out = [];
    for (const u of game.users ?? []) {
      if (u.isGM || !u.active || u.id === notUserId || !box.testUserPermission(u, OWN().LIMITED)) continue;
      const c = u.character ?? [...(game.actors ?? [])].find((a) => a.type === "character" && a.testUserPermission(u, OWN().OWNER));
      if (c && !out.some((x) => x.actor === c)) out.push({ actor: c, user: u });
    }
    return out;
  }
  async function logLoot(box, text, secret = false) {
    const log = [...lootOf(box).log, { t: Date.now(), text, secret }].slice(-60);
    await box.update({ [`flags.${FLAG}.${KEY}.log`]: log });
  }
  const gmNote = (box, html) => ChatMessage.create({ speaker: { alias: box.name }, whisper: gmIds(), content: `<div class="axecleft-trade-chat">${html}</div>` }).catch(() => null);
  async function d20(mod) { const r = new Roll(`1d20 + ${Number(mod) || 0}`); await r.evaluate(); return r.total; }
  async function rollFormula(f) { try { const r = new Roll(String(f)); await r.evaluate(); return Number.isFinite(r.total) ? r.total : 0; } catch (e) { return 0; } }
  async function hurt(actor, n) {
    n = Math.max(0, Math.round(n)); if (!n) return;
    const hp = getP(actor, "system.attributes.hp") ?? {};
    let temp = Number(hp.temp) || 0, val = Number(hp.value) || 0;
    const fromTemp = Math.min(temp, n); temp -= fromTemp; val -= n - fromTemp;
    await actor.update({ "system.attributes.hp.temp": temp, "system.attributes.hp.value": val });
  }

  /** The trap goes off on a character: the GM's card (rolls made, nothing applied until the GM decides). */
  async function springTrap(box, victim, user, why) {
    const L = lootOf(box), tr = L.trap, ta = trapActor(tr);
    const c = { type: "trap", state: "open", box: box.uuid, boxName: box.name, victim: victim.uuid, victimName: victim.name, user: user.id, userName: user.name, why,
      trapName: ta?.name ?? (tr.name || t("Trap")), trapActor: ta?.uuid ?? null, poison: tr.poison, save: tr.save, saveDc: tr.saveDc };
    if (!ta) {
      const full = tr.damage ? await rollFormula(tr.damage) : 0;
      let saved = false, saveTotal = null;
      if (tr.save !== "none" && tr.saveDc) { saveTotal = await d20(getP(victim, `system.attributes.savingThrows.${tr.save}.total`)); saved = saveTotal >= tr.saveDc; }
      Object.assign(c, { full, saveTotal, saved, dmg: saved ? (tr.half ? Math.floor(full / 2) : 0) : full });
    }
    await box.update({ [`flags.${FLAG}.${KEY}.trap.armed`]: false, [`flags.${FLAG}.${KEY}.opened`]: true });
    await logLoot(box, t("{trap} went off on {name}.", { trap: c.trapName, name: victim.name }));
    await ChatMessage.create({ speaker: { alias: c.trapName }, whisper: gmIds(), content: lootCardHTML(c), flags: { [FLAG]: { [LOOTCARD]: c } } });
  }

  /** The GM's game: one thing done to a container. */
  async function lootRequest(data, userId) {
    const user = game.users.get(userId);
    const box = await docFrom(data.box), who = await docFrom(data.by);
    if (!user || !box || !who) throw fail(/*t*/"The container or the character couldn't be found.");
    if (!user.isGM && !box.testUserPermission(user, OWN().LIMITED)) throw fail(/*t*/"{name} isn't open to you.", { name: box.name });
    if (!user.isGM && !who.testUserPermission(user, OWN().OWNER)) throw fail(/*t*/"{name} isn't your character.", { name: who.name });
    const L = lootOf(box), op = data.op, F = `flags.${FLAG}.${KEY}`;
    const P = { name: who.name, box: box.name };
    const pe = { name: esc(who.name), box: esc(box.name) };
    if (["take", "sneak", "takeCoins", "put", "putCoins", "split"].includes(op) && (L.lock.locked || !L.opened) && !user.isGM) throw fail(/*t*/"{box} is closed.", P);
    // Taking and putting
    if (op === "take" || op === "sneak") {
      const qty = Math.floor(Number(data.qty) || 0);
      let what = "";
      if (data.item) {
        const item = box.items.get(data.item);
        if (!item || (isHidden(item) && !user.isGM)) throw fail(/*t*/"That item isn't there any more.");
        if (qty < 1 || qty > qtyOf(item)) throw fail(/*t*/"Choose how many.");
        const moved = await moveItem(box, who, item.id, qty, { "system.equipped": false, "system.carried": true });
        what = `${moved.qty} × ${moved.name}`;
      } else {
        const c = {}, u1 = {}, u2 = {};
        for (const k of COINS) {
          const n = Math.max(0, Math.floor(Number(data.coins?.[k]) || 0));
          if (!n) continue;
          if (n > coinsOf(box, k)) throw fail(/*t*/"{box} has only {n} {coin}.", { box: box.name, n: coinsOf(box, k), coin: coinName(k) });
          c[k] = n; u1[`system.currency.${k}`] = coinsOf(box, k) - n; u2[`system.currency.${k}`] = coinsOf(who, k) + n;
        }
        if (!Object.keys(c).length) throw fail(/*t*/"Choose how many.");
        await box.update(u1); await who.update(u2);
        what = coinText(c);
      }
      if (op === "take") {
        await announce(box, t("<b>{name}</b> takes {what} from {box}.", { ...pe, what: esc(what) }));
        await logLoot(box, t("{name} took {what}.", { name: who.name, what }));
        return { text: /*t*/"{name} took {what}.", data: { name: who.name, what } };
      }
      // Sneaking it out: nobody is told but the GM, with the others' Spot against the Sleight of Hand
      const total = Math.round(Number(data.total) || 0);
      const watch = [];
      for (const w of watchersOf(box, user.id)) { const s = await d20(skillMod(w.actor, "spt")); watch.push({ name: w.actor.name, user: w.user.id, spot: s, saw: s >= total }); }
      await logLoot(box, t("{name} took {what}.", { name: who.name, what }), true);
      const c = { type: "sneak", state: "open", box: box.uuid, boxName: box.name, thiefName: who.name, user: user.id, userName: user.name, what, total, watch };
      await ChatMessage.create({ speaker: { alias: box.name }, whisper: gmIds(), content: lootCardHTML(c), flags: { [FLAG]: { [LOOTCARD]: c } } });
      return { text: /*t*/"{name} slipped {what} away.", data: { name: who.name, what } };
    }
    if (op === "put") {
      const item = who.items.get(data.item);
      const qty = Math.floor(Number(data.qty) || 0);
      if (!item) throw fail(/*t*/"That item isn't there any more.");
      if (qty < 1 || qty > qtyOf(item)) throw fail(/*t*/"Choose how many.");
      const moved = await moveItem(who, box, item.id, qty, { "system.equipped": false });
      const what = `${moved.qty} × ${moved.name}`;
      await announce(box, t("<b>{name}</b> puts {what} in {box}.", { ...pe, what: esc(what) }));
      await logLoot(box, t("{name} put in {what}.", { name: who.name, what }));
      return { text: /*t*/"{name} put {what} in {box}.", data: { ...P, what } };
    }
    if (op === "putCoins") {
      const c = {}, u1 = {}, u2 = {};
      for (const k of COINS) {
        const n = Math.max(0, Math.floor(Number(data.coins?.[k]) || 0));
        if (!n) continue;
        if (n > coinsOf(who, k)) throw fail(/*t*/"{name} has only {n} {coin}.", { name: who.name, n: coinsOf(who, k), coin: coinName(k) });
        c[k] = n; u1[`system.currency.${k}`] = coinsOf(who, k) - n; u2[`system.currency.${k}`] = coinsOf(box, k) + n;
      }
      if (!Object.keys(c).length) throw fail(/*t*/"Choose how many.");
      await who.update(u1); await box.update(u2);
      const what = coinText(c);
      await announce(box, t("<b>{name}</b> puts {what} in {box}.", { ...pe, what: esc(what) }));
      await logLoot(box, t("{name} put in {what}.", { name: who.name, what }));
      return { text: /*t*/"{name} put {what} in {box}.", data: { ...P, what } };
    }
    if (op === "split") {
      if (!user.isGM && !L.split) throw fail(/*t*/"Only the GM splits the coins here.");
      const chars = [...new Set(data.chars ?? [])].map((id) => game.actors.get(id)).filter((a) => a && a.type === "character");
      if (!chars.length) throw fail(/*t*/"Choose who shares the coins.");
      const each = {}, boxUpd = {};
      for (const k of COINS) { const n = Math.floor(coinsOf(box, k) / chars.length); if (n) { each[k] = n; boxUpd[`system.currency.${k}`] = coinsOf(box, k) - n * chars.length; } }
      if (!Object.keys(each).length) throw fail(/*t*/"There aren't enough coins to split.");
      await box.update(boxUpd);
      for (const a of chars) { const u = {}; for (const [k, n] of Object.entries(each)) u[`system.currency.${k}`] = coinsOf(a, k) + n; await a.update(u); }
      const what = coinText(each), list = chars.map((a) => a.name).join(", ");
      await announce(box, t("The coins in {box} are split: {list} each get {what}.", { box: esc(box.name), list: esc(list), what: esc(what) }));
      await logLoot(box, t("Coins split: {list} each got {what}.", { list, what }));
      return { text: /*t*/"Split: each gets {what}.", data: { what } };
    }
    // The lock
    const lk = L.lock, arc = lk.arcane ? 10 : 0;
    const unlock = (extra = {}) => box.update({ [`${F}.lock.locked`]: false, ...extra });
    if (["key", "pick", "knock", "force", "break"].includes(op) && !lk.locked) throw fail(/*t*/"{box} isn't locked.", P);
    if (op === "key") {
      const norm = (s) => String(s ?? "").trim().toLowerCase();
      if (!lk.key || !who.items.some((i) => norm(i.name) === norm(lk.key))) throw fail(/*t*/"{name} has no key that fits.", P);
      await unlock(); await gmNote(box, t("<b>{name}</b> unlocks {box} with the key.", pe));
      return { text: /*t*/"{name} unlocks {box} with the key.", data: P };
    }
    if (op === "knock") {
      await unlock(); await gmNote(box, t("<b>{name}</b> opens the lock of {box} by magic (<i>knock</i>, a chime of opening…).", pe));
      return { text: /*t*/"{name} opens the lock of {box} by magic.", data: P };
    }
    if (op === "pick") {
      const total = Math.round(Number(data.total) || 0), dc = (Number(lk.dc) || 25) + arc;
      const ok = total >= dc;
      if (ok) await unlock();
      await gmNote(box, t(ok ? "<b>{name}</b> picks the lock of {box} (Open Lock {total} vs DC {dc})." : "<b>{name}</b> fails to pick the lock of {box} (Open Lock {total} vs DC {dc}).", { ...pe, total, dc }));
      return { text: ok ? /*t*/"{name} picks the lock." : /*t*/"{name} can't pick the lock.", data: P };
    }
    if (op === "force" || op === "break") {
      // Noisy (and damaging): the GM decides
      const c = { type: op, state: "open", box: box.uuid, boxName: box.name, by: who.uuid, name: who.name, user: user.id, userName: user.name };
      if (op === "force") { c.total = Math.round(Number(data.total) || 0); c.dc = (Number(lk.breakDc) || 23) + arc; c.ok = c.total >= c.dc; }
      else { c.damage = Math.max(0, Math.round(Number(data.damage) || 0)); c.net = Math.max(0, c.damage - (Number(lk.hardness) || 0)); c.hp = Number(lk.hp) || 0; c.left = Math.max(0, c.hp - c.net); c.hardness = Number(lk.hardness) || 0; }
      await ChatMessage.create({ speaker: { alias: box.name }, whisper: gmIds(), content: lootCardHTML(c), flags: { [FLAG]: { [LOOTCARD]: c } } });
      return { text: /*t*/"That makes some noise: the GM decides what happens.", data: {} };
    }
    // Opening, and the trap
    const tr = L.trap, dcs = trapDcs(tr);
    if (op === "open") {
      if (lk.locked && !user.isGM) throw fail(/*t*/"{box} is locked.", P);
      if (L.opened && !tr.armed) return { text: /*t*/"{box} is open.", data: P };
      if (tr.armed) { await springTrap(box, who, user, t("opening it")); return { text: /*t*/"Something happens… the GM decides.", data: {} }; }
      await box.update({ [`${F}.opened`]: true });
      await gmNote(box, t("<b>{name}</b> opens {box}.", pe));
      return { text: /*t*/"{name} opens {box}.", data: P };
    }
    if (op === "search") {
      const total = Math.round(Number(data.total) || 0);
      const can = dcs.search <= 20 || trapfinding(who);
      const found = tr.armed && total >= dcs.search && can;
      if (found && !tr.found.includes(who.id)) await box.update({ [`${F}.trap.found`]: [...tr.found, who.id] });
      await gmNote(box, tr.armed
        ? t(found ? "<b>{name}</b> finds the trap on {box} (Search {total} vs DC {dc})." : "<b>{name}</b> doesn't find the trap on {box} (Search {total} vs DC {dc}{why}).", { ...pe, total, dc: dcs.search, why: !can && total >= dcs.search ? `; ${esc(t("only characters with trapfinding find traps over DC 20"))}` : "" })
        : t("<b>{name}</b> searches {box} for traps (Search {total}): there are none.", { ...pe, total }));
      return found ? { text: /*t*/"{name} finds a trap: {trap}.", data: { ...P, trap: dcs.name } } : { text: /*t*/"{name} finds no traps.", data: P };
    }
    if (op === "disable") {
      if (!tr.armed || !tr.found.includes(who.id)) throw fail(/*t*/"{name} hasn't found a trap to disable.", P);
      const total = Math.round(Number(data.total) || 0);
      if (total >= dcs.disable) {
        await box.update({ [`${F}.trap.armed`]: false });
        await gmNote(box, t("<b>{name}</b> disables the trap on {box} (Disable Device {total} vs DC {dc}).", { ...pe, total, dc: dcs.disable }));
        await logLoot(box, t("{name} disabled the trap.", { name: who.name }));
        return { text: /*t*/"{name} disables the trap.", data: P };
      }
      if (total <= dcs.disable - 5) { await springTrap(box, who, user, t("a failed attempt to disable it")); return { text: /*t*/"Something goes wrong… the GM decides.", data: {} }; }
      await gmNote(box, t("<b>{name}</b> fails to disable the trap on {box} (Disable Device {total} vs DC {dc}).", { ...pe, total, dc: dcs.disable }));
      return { text: /*t*/"{name} can't disable the trap.", data: P };
    }
    throw fail(/*t*/"Unknown trade.");
  }

  /** The GM's cards for noisy attempts, traps and sneaking. */
  function lootCardHTML(c) {
    const ROW = "display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:3px 0", BTN = "width:auto;flex:0 1 auto;max-width:100%;height:auto;min-height:1.8em;white-space:normal;text-align:left;line-height:1.3;padding:2px 8px";
    const btn = (act, icon, label) => `<button type="button" style="${BTN}" data-alc="${act}"><i class="fas ${icon}"></i> ${label}</button>`;
    const open = c.state === "open";
    let body = "";
    if (c.type === "force") body = `<p style="margin:2px 0">${H("{name} ({user}) tries to force {box} open: Strength {total} vs DC {dc}. It's noisy.", { name: c.name, user: c.userName, box: c.boxName, total: c.total, dc: c.dc })}</p>
      <p style="margin:2px 0">${H(c.ok ? "Suggested: it opens." : "Suggested: it holds.")}</p>
      ${open ? `<div style="${ROW}">${btn("open", "fa-lock-open", H("It opens"))}${btn("hold", "fa-lock", H("It holds"))}</div>` : `<p style="margin:2px 0"><b>${esc(c.result ?? "")}</b></p>`}`;
    else if (c.type === "break") body = `<p style="margin:2px 0">${H("{name} ({user}) tries to break {box}: {damage} damage, less hardness {hardness} = {net}. Hit points {hp} → {left}. It's noisy.", { name: c.name, user: c.userName, box: c.boxName, damage: c.damage, hardness: c.hardness, net: c.net, hp: c.hp, left: c.left })}</p>
      ${open ? `<div style="${ROW}">${btn("apply", "fa-hammer", H(c.left <= 0 ? "Apply: it breaks open" : "Apply the damage"))}${btn("hold", "fa-xmark", H("No effect"))}</div>` : `<p style="margin:2px 0"><b>${esc(c.result ?? "")}</b></p>`}`;
    else if (c.type === "trap") {
      const saveName = t(SAVES.find(([k]) => k === c.save)?.[1] ?? "");
      body = `<p style="margin:2px 0">${H("{trap} on {box} goes off on {name} ({user}), from {why}.", { trap: c.trapName, box: c.boxName, name: c.victimName, user: c.userName, why: c.why })}</p>
        ${c.trapActor ? `<p style="margin:2px 0">${H("Roll its attacks from its sheet, with {name} targeted.", { name: c.victimName })}</p>${open ? `<div style="${ROW}">${btn("trapSheet", "fa-skull-crossbones", H("Open {trap} and target {name}", { trap: c.trapName, name: c.victimName }))}${btn("done", "fa-check", H("Done"))}</div>` : ""}`
        : `<p style="margin:2px 0">${c.saveTotal != null ? H("{save} save {total} vs DC {dc}: {result}.", { save: saveName, total: c.saveTotal, dc: c.saveDc, result: t(c.saved ? "saved" : "failed") }) : ""} ${c.full ? H("Damage {full}; taken {dmg}.", { full: c.full, dmg: c.dmg }) : ""}</p>
        ${c.poison ? `<p style="margin:2px 0"><b>${H("Poison")}:</b> ${esc(c.poison)}</p>` : ""}
        ${open ? `<div style="${ROW}">${c.full ? `${btn("hurt", "fa-heart-crack", H("Apply {n} damage", { n: c.dmg }))}${c.dmg !== c.full ? btn("hurtFull", "fa-heart-crack", H("Apply {n} (full)", { n: c.full })) : ""}` : ""}${btn("done", c.full ? "fa-xmark" : "fa-check", H(c.full ? "No damage" : "Done"))}</div>` : ""}`}
        ${!open ? `<p style="margin:2px 0"><b>${esc(c.result ?? "")}</b></p>` : ""}`;
    } else if (c.type === "sneak") {
      const saw = c.watch.filter((w) => w.saw);
      body = `<p style="margin:2px 0">${H("{name} ({user}) slips {what} out of {box} without the others knowing: Sleight of Hand {total}.", { name: c.thiefName, user: c.userName, what: c.what, box: c.boxName, total: c.total })}</p>
        <p style="margin:2px 0">${c.watch.length ? H("Spot: {list}.", { list: c.watch.map((w) => `${w.name} ${w.spot}${w.saw ? ` (${t("notices")})` : ""}`).join(", ") }) : H("No one else is about.")}</p>
        ${open && saw.length ? `<div style="${ROW}">${btn("tell", "fa-eye", H("Tell {list}", { list: saw.map((w) => w.name).join(", ") }))}${btn("done", "fa-check", H("Keep it secret"))}</div>` : !open ? `<p style="margin:2px 0"><b>${esc(c.result ?? "")}</b></p>` : ""}`;
    }
    return `<div class="axecleft-lootcard" style="font-size:0.95em">${body}</div>`;
  }
  async function onLootCard(msg, act) {
    const c = foundry.utils.deepClone(msg.flags?.[FLAG]?.[LOOTCARD] ?? {});
    if (c.state !== "open") return;
    const box = await fromUuid(c.box).catch(() => null);
    const F = `flags.${FLAG}.${KEY}`;
    const tellUser = (ids, html, alias) => ChatMessage.create({ speaker: { alias: alias ?? c.boxName }, whisper: [...new Set([...ids, ...gmIds()])], content: `<div class="axecleft-trade-chat">${html}</div>` });
    const done = async (result) => { c.state = "done"; c.result = result; await msg.update({ content: lootCardHTML(c), [`flags.${FLAG}.${LOOTCARD}`]: c }); };
    const pe = { name: esc(c.name ?? c.victimName ?? c.thiefName ?? ""), box: esc(c.boxName) };
    if (c.type === "force") {
      if (act === "open" && box) { await box.update({ [`${F}.lock.locked`]: false }); await logLoot(box, t("{name} forced it open.", { name: c.name })); await tellUser([c.user], t("<b>{name}</b> forces {box} open.", pe)); return done(t("It opens.")); }
      await tellUser([c.user], t("<b>{box}</b> holds.", pe)); return done(t("It holds."));
    }
    if (c.type === "break") {
      if (act === "apply" && box) {
        const broke = c.left <= 0;
        await box.update(broke ? { [`${F}.lock.hp`]: 0, [`${F}.lock.locked`]: false, [`${F}.lock.broken`]: true, [`${F}.opened`]: true } : { [`${F}.lock.hp`]: c.left });
        if (broke) await logLoot(box, t("{name} broke it open.", { name: c.name }));
        await tellUser([c.user], t(broke ? "<b>{name}</b> breaks {box} open." : "<b>{name}</b> damages {box}, but it holds.", pe));
        return done(t(broke ? "It breaks open." : "Damaged; it holds."));
      }
      await tellUser([c.user], t("<b>{box}</b> holds.", pe)); return done(t("No effect."));
    }
    if (c.type === "trap") {
      if (act === "trapSheet") {
        const ta = await fromUuid(c.trapActor).catch(() => null), victim = await fromUuid(c.victim).catch(() => null);
        const tok = victim?.getActiveTokens?.()?.[0];
        try { if (tok) tok.setTarget(true, { releaseOthers: true }); } catch (e) { /* targeting is a help only */ }
        ta?.sheet?.render(true);
        return;
      }
      const victim = await fromUuid(c.victim).catch(() => null);
      const n = act === "hurt" ? c.dmg : act === "hurtFull" ? c.full : 0;
      if (n && victim) await hurt(victim, n);
      const html = `${t(n ? "<b>{trap}</b> goes off: {name} takes {n} damage." : "<b>{trap}</b> goes off on {name}.", { trap: esc(c.trapName), name: esc(c.victimName), n })}${c.poison ? ` ${esc(t("Poison"))}: ${esc(c.poison)}` : ""}`;
      await tellUser([c.user], html, c.trapName);
      return done(n ? t("{n} damage applied.", { n }) : t("Done."));
    }
    if (c.type === "sneak") {
      const saw = c.watch.filter((w) => w.saw);
      if (act === "tell" && saw.length) {
        for (const w of saw) await tellUser([w.user], t("<b>{watcher}</b> notices {name} slipping {what} out of {box}.", { watcher: esc(w.name), name: esc(c.thiefName), what: esc(c.what), box: esc(c.boxName) }));
        return done(t("Told {list}.", { list: saw.map((w) => w.name).join(", ") }));
      }
      return done(t("Kept secret."));
    }
  }

  /* The loot sheet */

  function lootHTML(sheet) {
    rendering = sheet;
    const box = sheet.actor ?? sheet.document, gm = game.user.isGM, s = shopOf(box), L = lootOf(box), st = stateOf(sheet);
    const chars = charactersFor(), who = st.buyer ? game.actors.get(st.buyer) : null;
    const storage = s.mode === "storage";
    const closed = L.lock.locked || !L.opened;
    const status = L.lock.broken ? t("broken open") : L.lock.locked ? t("locked") : !L.opened ? t("closed") : t("open");
    const head = `<header class="ash-head"><img src="${esc(box.img)}" alt="">
      ${gm ? `<button type="button" class="ash-act" data-ash="charsheet" style="order:9;margin-left:auto;align-self:flex-start"><i class="fas fa-user"></i> ${H("Character sheet")}</button>` : ""}
      <div><h2>${esc(box.name)}</h2><div class="sub">${H(storage ? "Party storage" : "Loot")} · ${esc(status)}${gm && L.trap.armed ? ` · <span class="warn">${H("trapped")}</span>` : ""}</div></div></header>`;
    if (!gm && !box.testUserPermission(game.user, OWN().LIMITED)) return `${STYLE}${skin()}<div class="ash">${head}<div class="ash-closed">${H("This isn't open to you.")}</div></div>`;
    const whoBar = `<div class="ash-who"><b>${H("Character")}</b>
      ${chars.length ? `<select data-ash="buyer">${chars.map((a) => `<option value="${a.id}"${a.id === st.buyer ? " selected" : ""}>${esc(a.name)}</option>`).join("")}</select>` : `<span class="warn">${H("You have no character.")}</span>`}
      ${who ? `<span class="purse">${H("Purse")}: <b>${esc(money(wealth(who)))}</b></span>` : ""}</div>`;
    const closedPanel = who ? lockPanel(box, L, who) : "";
    // A tour of an open container shows what a closed one offers (an example, its buttons off)
    const demoLock = demoOn(sheet) && !closed && who ? `<fieldset class="ash-demo-box ash-demo" disabled>${lockPanel(box, { ...L, opened: false, lock: { ...L.lock, locked: true, key: L.lock.key || "-" } }, who)}${demoTag()}</fieldset>` : "";
    let body;
    if (closed && !gm) body = closedPanel;
    else {
      const coins = COINS.filter((k) => coinsOf(box, k) > 0);
      const coinRow = `<div class="ash-row"><b>${H("Coins")}</b> <span>${coins.length ? esc(coinText(Object.fromEntries(coins.map((k) => [k, coinsOf(box, k)])))) : `<span class="muted">${H("none")}</span>`}</span>
        ${who ? `${coins.length ? `<button type="button" class="ash-act" data-ash="takeCoins"><i class="fas fa-coins"></i> ${H("Take")}</button><a class="ash-ctl" data-ash="sneakCoins" title="${H("Take coins without the others knowing (Sleight of Hand; the GM is told)")}"><i class="fas fa-hand-sparkles"></i></a>` : ""}<button type="button" class="ash-act" data-ash="putCoins"><i class="fas fa-piggy-bank"></i> ${H("Put in")}</button>` : ""}
        ${coins.length && (gm || L.split) ? `<button type="button" class="ash-act" data-ash="split"><i class="fas fa-scale-balanced"></i> ${H("Split among the party")}</button>` : ""}</div>`;
      const items = contentsOf(box);
      const row = (i) => `<tr class="${isHidden(i) ? "hidden-item" : ""}"><td class="name"><img src="${esc(i.img)}" alt=""><span class="ash-name" data-ash="desc" data-uuid="${i.uuid}">${gm && unidentified(i) ? `${esc(i.name)} <small class="muted">(${H("shown as {name}", { name: shownName(i) })})</small>` : esc(shownName(i))}</span></td><td class="n">${qtyOf(i)}</td><td class="n"></td>
        <td class="n">${who ? `<a class="ash-ctl" data-ash="sneak" data-id="${i.id}" title="${H("Take it without the others knowing (Sleight of Hand; the GM is told)")}"><i class="fas fa-hand-sparkles"></i></a> <button type="button" class="ash-act" data-ash="take" data-id="${i.id}">${H("Take")}</button>` : ""}</td>
        <td class="n">${gm ? `<a class="ash-ctl" data-ash="hide" data-id="${i.id}" title="${H(isHidden(i) ? "Hidden from players: show" : "Hide from players")}"><i class="fas ${isHidden(i) ? "fa-eye-slash" : "fa-eye"}"></i></a><a class="ash-ctl" data-ash="edit" data-id="${i.id}" title="${H("Edit")}"><i class="fas fa-pen"></i></a><a class="ash-ctl" data-ash="delete" data-id="${i.id}" title="${H("Remove")}"><i class="fas fa-trash"></i></a>` : ""}</td></tr>`;
      const list = items.length ? `<table class="ash-t"><tr><th>${H("Item")}</th><th class="n">${H("Qty")}</th><th></th><th></th><th></th></tr>${rowsByGroup(items, row)}</table>` : `<p class="muted" style="padding:1em">${H("It's empty.")}</p>`;
      const log = gm || storage ? logHTML(L, gm, !!st.logOpen, demoOn(sheet)) : "";
      body = `${gm && closed ? `<div class="ash-row warn"><i class="fas fa-lock"></i> ${H("Players see it {status}; you see inside.", { status })}</div>${closedPanel}` : demoLock}${coinRow}<div class="ash-list">${list}</div>
        ${log}
        <div class="ash-drop">${H("Drop an item here to put it in.")}</div>`;
    }
    return `${STYLE}${skin()}<div class="ash"${demoAttr(sheet, "loot")}>${head}${gm ? lootGmHTML(box, s, L, !!st.gmOpen) : ""}${whoBar}${body}</div>`;
  }

  /** What a character can do to a closed container. */
  function lockPanel(box, L, who) {
    const lk = L.lock, tr = L.trap, dcs = trapDcs(tr);
    const found = tr.armed && tr.found.includes(who.id);
    const b = (op, icon, label, title = "") => `<button type="button" class="ash-act" data-ash="lk" data-op="${op}"${title ? ` title="${esc(title)}"` : ""}><i class="fas ${icon}"></i> ${label}</button>`;
    return `<div class="ash-closed" style="padding:10px">
      <p><i class="fas ${lk.locked ? "fa-lock" : "fa-box"}"></i> ${H(lk.locked ? "{box} is locked." : !L.opened ? "{box} is closed." : "{box} is open.", { box: box.name })}</p>
      ${found ? `<p class="warn"><i class="fas fa-triangle-exclamation"></i> ${H("{name} found a trap: {trap}.", { name: who.name, trap: dcs.name })}</p>` : ""}
      <div class="ash-row" style="justify-content:center">
        ${lk.locked ? `${lk.key ? b("key", "fa-key", H("Use the key")) : ""}
          ${b("pick", "fa-unlock-keyhole", H("Pick the lock"), t("Open Lock (thieves' tools: −2 without them, +2 masterwork)"))}
          <select data-ash-take title="${H("Roll, or take 10 or 20 when there's time")}"><option value="roll">${H("Roll")}</option><option value="10">${H("Take 10")}</option><option value="20">${H("Take 20")}</option></select>
          <select data-ash-tools><option value="0">${H("Thieves' tools")}</option><option value="2">${H("Masterwork tools (+2)")}</option><option value="-2">${H("No tools (−2)")}</option></select>
          ${b("force", "fa-hand-fist", H("Force it open"), t("Strength check against its Break DC. Noisy."))}
          ${b("break", "fa-hammer", H("Break it"), t("Deal damage to it (less its hardness). Noisy."))}
          ${b("knock", "fa-wand-sparkles", H("Knock / chime of opening"))}` : b("open", "fa-box-open", H("Open it"))}
      </div>
      <div class="ash-row" style="justify-content:center">${b("search", "fa-magnifying-glass", H("Search for traps"))}${found ? b("disable", "fa-screwdriver-wrench", H("Disable the trap")) : ""}</div>
    </div>`;
  }

  function lootGmHTML(box, s, L, gmOpen) {
    const lk = L.lock, tr = L.trap, open = (box.ownership?.default ?? 0) >= OWN().LIMITED;
    const traps = [...(game.actors ?? [])].filter((a) => a.type === "trap").sort((a, b) => a.name.localeCompare(b.name));
    const sel = (attr, list, cur) => `<select ${attr}>${list.map(([k, l]) => `<option value="${esc(k)}"${String(k) === String(cur) ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
    const num = (path, v, w = "4.5em") => `<input type="number" data-ash-l="${path}" value="${esc(v ?? "")}" style="width:${w}">`;
    return `<details class="ash-gm"${gmOpen ? " open" : ""}><summary><i class="fas fa-user-shield"></i> ${H("GM: settings")} <small class="muted">${H("(players don't see this)")}</small></summary>
      <div class="ash-grid">
        <label>${H("Sheet")}</label><span>${modeSelect(s.mode)}</span>
        <label>${H("Open to")}</label><span><select data-ash-set="open"><option value="0"${open ? "" : " selected"}>${H("Players set in Ownership")}</option><option value="1"${open ? " selected" : ""}>${H("All players")}</option></select></span>
        <label>${H("Taken and put in, in chat")}</label><span><select data-ash-set="chat">${[["public", /*t*/"For everyone"], ["gm", /*t*/"GM only"], ["none", /*t*/"Not shown"]].map(([k, l]) => `<option value="${k}"${s.chat === k ? " selected" : ""}>${H(l)}</option>`).join("")}</select></span>
        <label></label><span><label><input type="checkbox" data-ash-l="split" data-bool${L.split ? " checked" : ""}> ${H("Players can split the coins")}</label></span>
      </div>
      <div class="ash-row"><b>${H("Coins")}</b>${STD.map(([k]) => `<label>${esc(coinName(k))} <input type="number" data-ash-coin="${k}" value="${coinsOf(box, k)}" min="0" style="width:6em"></label>`).join("")}</div>
      <div class="ash-row"><b><i class="fas fa-lock"></i> ${H("Lock")}</b>
        <label><input type="checkbox" data-ash-l="lock.locked" data-bool${lk.locked ? " checked" : ""}> ${H("Locked")}</label>
        ${sel('data-ash-l="lock.quality"', [...LOCKS.map(([k, l, dc]) => [k, `${t(l)} (DC ${dc})`]), ["custom", t("Other DC")]], lk.quality)} ${H("Open Lock DC")} ${num("lock.dc", lk.dc)}
        <label><input type="checkbox" data-ash-l="lock.arcane" data-bool${lk.arcane ? " checked" : ""}> ${H("Arcane lock (+10)")}</label>
        <label>${H("Key")} <input type="text" data-ash-l="lock.key" value="${esc(lk.key)}" placeholder="${H("the key item's name")}" style="width:11em"></label></div>
      <div class="ash-row"><b><i class="fas fa-box"></i> ${H("Container")}</b> ${sel('data-ash-l="lock.box"', BOXES.map(([k, l, h, hp, dc]) => [k, dc ? `${t(l)} (${t("hardness {h}, {hp} hp, Break DC {dc}", { h, hp, dc })})` : t(l)]), lk.box)}
        ${H("Hardness")} ${num("lock.hardness", lk.hardness)} ${H("Hit points")} ${num("lock.hp", lk.hp)} ${H("Break DC")} ${num("lock.breakDc", lk.breakDc)}${lk.broken ? ` <span class="warn">${H("broken")}</span>` : ""}</div>
      <div class="ash-row"><b><i class="fas fa-skull-crossbones"></i> ${H("Trap")}</b>
        <label><input type="checkbox" data-ash-l="trap.armed" data-bool${tr.armed ? " checked" : ""}> ${H("Armed")}</label>
        ${sel('data-ash-l="trap.actor"', [["", t("Simple trap (set below)")], ...traps.map((a) => [a.id, t("Trap actor: {name}", { name: a.name })])], tr.actor)}
        ${tr.found.length ? `<span class="muted">${H("Found by {list}", { list: tr.found.map((id) => game.actors.get(id)?.name ?? "?").join(", ") })}</span>` : ""}</div>
      ${tr.actor ? `<p class="muted" style="margin:2px 0;font-size:0.85em">${H("Search and Disable Device DCs come from the trap actor; when it goes off, its card opens the trap's sheet with the victim targeted, to roll its attacks.")}</p>` : `<div class="ash-row">
        <label>${H("Name")} <input type="text" data-ash-l="trap.name" value="${esc(tr.name)}" placeholder="${H("e.g. Poison needle")}" style="width:10em"></label>
        ${H("Search DC")} ${num("trap.searchDc", tr.searchDc)} ${H("Disable DC")} ${num("trap.disableDc", tr.disableDc)}
        ${sel('data-ash-l="trap.save"', SAVES.map(([k, l]) => [k, t(l)]), tr.save)} ${H("DC")} ${num("trap.saveDc", tr.saveDc)}
        <label>${H("Damage")} <input type="text" data-ash-l="trap.damage" value="${esc(tr.damage)}" placeholder="2d6" style="width:5em"></label>
        <label><input type="checkbox" data-ash-l="trap.half" data-bool${tr.half ? " checked" : ""}> ${H("Half on a save (else none)")}</label>
        <label>${H("Poison")} <input type="text" data-ash-l="trap.poison" value="${esc(tr.poison)}" placeholder="${H("e.g. Greenblood oil, Fort DC 13, 1 Con / 1d2 Con")}" style="width:16em"></label></div>`}
      <div class="ash-row">${L.opened ? `<button type="button" class="ash-act" data-ash="close"><i class="fas fa-box"></i> ${H("Close it (players must open it again)")}</button>` : `<button type="button" class="ash-act" data-ash="gmOpen"><i class="fas fa-box-open"></i> ${H("Open it for the players")}</button>`}
</div>
      <p class="muted" style="margin:2px 0;font-size:0.85em">${H("Locking it or arming a trap closes it. Picking the lock, keys, knock and finding or disabling a trap go ahead on their own (you're told); forcing it, breaking it and a trap going off come to you on a card.")}</p>
    </details>`;
  }
  /** The log, newest first (GM: everything; players: what isn't secret). */
  function logHTML(L, gm, open = false, demo = false) {
    const log = L.log.filter((e) => gm || !e.secret).slice(-40).reverse();
    if (!log.length) return demo ? `<details class="ash-gm ash-log"${open ? " open" : ""}><summary><i class="fas fa-scroll"></i> ${H("Log")} <small class="muted">(0)</small>${demoTag()}</summary><div class="muted" style="font-size:0.85em">${H("Nothing yet.")}</div></details>` : "";
    const when = (ms) => { try { return new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } };
    return `<details class="ash-gm ash-log"${open ? " open" : ""}><summary><i class="fas fa-scroll"></i> ${H("Log")} <small class="muted">(${log.length})</small></summary><div style="font-size:0.85em;max-height:12em;overflow-y:auto">${log.map((e) => `<div>${e.secret ? `<i class="fas fa-user-secret" title="${H("secret")}"></i> ` : ""}<span class="muted">${esc(when(e.t))}</span> ${esc(e.text)}</div>`).join("")}</div>
      ${gm ? `<button type="button" class="ash-act" data-ash="clearLog" style="margin-top:3px"><i class="fas fa-eraser"></i> ${H("Clear the log")}</button>` : ""}</details>`;
  }
  const modeSelect = (mode) => `<select data-ash-set="mode">${[["merchant", /*t*/"Merchant"], ["loot", /*t*/"Loot"], ["storage", /*t*/"Party storage"]].map(([k, l]) => `<option value="${k}"${mode === k ? " selected" : ""}>${H(l)}</option>`).join("")}</select>`;

  /** A coins dialog (how many of each). */
  async function askCoins(title, max) {
    const DV = A()?.DialogV2 ?? foundry.applications.api.DialogV2;
    let got = null;
    await DV.wait({
      window: { title }, rejectClose: false,
      content: `<div style="display:grid;grid-template-columns:auto 1fr auto;gap:4px 8px;align-items:center">${COINS.map((k) => `<label>${esc(coinName(k))}</label><input type="number" name="c_${k}" value="0" min="0" max="${max[k] ?? 0}"><small>/ ${(max[k] ?? 0).toLocaleString()}</small>`).join("")}</div>`,
      buttons: [
        { action: "all", label: t("All"), icon: "fas fa-coins", callback: () => { got = { ...max }; return "all"; } },
        { action: "ok", label: t("OK"), icon: "fas fa-check", default: true, callback: (ev, button) => { const f = button.form; got = Object.fromEntries(COINS.map((k) => [k, Math.min(max[k] ?? 0, Math.max(0, Math.floor(Number(f?.elements?.[`c_${k}`]?.value ?? f?.querySelector?.(`[name=c_${k}]`)?.value) || 0)))])); return "ok"; } },
        { action: "no", label: t("Cancel"), icon: "fas fa-xmark" },
      ],
    });
    return got && COINS.some((k) => got[k] > 0) ? got : null;
  }
  /** Who shares the coins: the player characters the container is open to (all player characters for the GM to choose from). */
  async function askSplit(box) {
    const owned = [...(game.actors ?? [])].filter((a) => a.type === "character" && [...game.users].some((u) => !u.isGM && a.testUserPermission(u, OWN().OWNER)));
    const def = new Set(watchersOf(box, null).map((w) => w.actor.id));
    if (!owned.length) { ui.notifications.warn(t("No player characters to share with.")); return null; }
    const DV = A()?.DialogV2 ?? foundry.applications.api.DialogV2;
    let got = null;
    await DV.wait({
      window: { title: t("Split the coins") }, rejectClose: false,
      content: `<p>${H("Each gets an equal share of each kind of coin; what can't be shared stays in {box}.", { box: box.name })}</p>${owned.map((a) => `<label style="display:block"><input type="checkbox" name="ch" value="${a.id}"${def.size ? (def.has(a.id) ? " checked" : "") : " checked"}> ${esc(a.name)}</label>`).join("")}`,
      buttons: [
        { action: "ok", label: t("Split"), icon: "fas fa-scale-balanced", default: true, callback: (ev, button) => { got = [...(button.form?.querySelectorAll?.("[name=ch]") ?? [])].filter((x) => x.checked).map((x) => x.value); return "ok"; } },
        { action: "no", label: t("Cancel"), icon: "fas fa-xmark" },
      ],
    });
    return got?.length ? got : null;
  }

  /**
   * The merchant's character sheet: the system's own sheet for its type (D35E's NPC sheet) opened beside the shop, so the
   * GM can roll its skills, saves and attacks. The shop stays the actor's sheet.
   */
  const statSheets = new Map();
  function statSheet(actor) {
    const open = statSheets.get(actor.uuid);
    if (open?.rendered) { open.bringToFront?.() ?? open.bringToTop?.(); return open; }
    const list = Object.values(CONFIG.Actor?.sheetClasses?.[actor.type] ?? {}).filter((e) => e.id !== SHEET && e.cls);
    const pick = list.find((e) => e.id?.startsWith?.(`${game.system.id}.`) && e.default) ?? list.find((e) => e.id?.startsWith?.(`${game.system.id}.`)) ?? list.find((e) => e.default) ?? list[0];
    if (!pick) return ui.notifications.warn(t("No other sheet is registered for this actor."));
    const AppV2 = foundry.applications?.api?.ApplicationV2;
    const id = `axecleft-stats-${actor.id}`;
    let app;
    try {
      if (AppV2 && pick.cls.prototype instanceof AppV2) { app = new pick.cls({ document: actor, id }); app.render({ force: true }); }
      else { app = new pick.cls(actor, { id }); app.render(true); }
    } catch (err) { console.error("AxecleftTrade | character sheet", err); return ui.notifications.error(err.message); }
    statSheets.set(actor.uuid, app);
    return app;
  }

  /** The sheet class: Foundry's ActorSheetV2 (v13+), or the classic ActorSheet (v11). */
  function makeSheet() {
    const V2 = foundry.applications?.sheets?.ActorSheetV2;
    if (V2) {
      return class AxecleftShopSheet extends V2 {
        static DEFAULT_OPTIONS = { classes: ["axecleft-shop"], position: { width: 720, height: 720 }, window: { resizable: true, icon: "fas fa-store" }, form: { submitOnChange: false } };
        get title() { return this.document?.name ?? super.title; }
        /** Which tour the ⋮ menu's "Tour of this window" starts: the merchant's or the loot sheet's. */
        get tab() { return isLootMode(shopOf(this.document)) ? "loot" : "merchant"; }
        /** Foundry disables every field of a sheet the user can't edit: players trade on it, so ours stay usable. */
        _toggleDisabled() {}
        async _renderHTML() { return shopHTML(this); }
        _replaceHTML(result, content) { content.innerHTML = result; bindShop(this, content); }
        _onClose(options) { openSheets.delete(this); return super._onClose?.(options); }
      };
    }
    const V1 = typeof ActorSheet !== "undefined" ? ActorSheet : globalThis.ActorSheet;
    return class AxecleftShopSheet extends V1 {
      static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, { classes: ["axecleft-shop", "sheet", "actor"], width: 720, height: 720, resizable: true, submitOnChange: false, submitOnClose: false, closeOnSubmit: false, dragDrop: [] });
      }
      get title() { return this.actor?.name ?? super.title; }
      get tab() { return isLootMode(shopOf(this.actor)) ? "loot" : "merchant"; }
      get template() { return null; }
      /** Players trade on a sheet they don't own: keep its fields usable. */
      _disableFields() {}
      async getData() { return {}; }
      async _renderInner() { const div = document.createElement("div"); div.style.height = "100%"; div.innerHTML = shopHTML(this); return $(div); }
      activateListeners(html) { bindShop(this, html?.[0] ?? html); }
      async close(options) { openSheets.delete(this); return super.close(options); }
    };
  }

  /* ------------------------------------------ */
  /*  Setting up                                */
  /* ------------------------------------------ */

  function registerSheet() {
    const Cls = makeSheet();
    const opts = { types: ["npc"], makeDefault: false, label: "Axecleft's Shop" };
    const DSC = foundry.applications?.apps?.DocumentSheetConfig;
    try {
      if (DSC?.registerSheet) DSC.registerSheet(Actor, SCOPE, Cls, opts);
      else (foundry.documents?.collections?.Actors ?? (typeof Actors !== "undefined" ? Actors : globalThis.Actors)).registerSheet(SCOPE, Cls, opts);
    } catch (err) { console.error("AxecleftTrade | couldn't register the shop sheet", err); }
    api.SheetClass = Cls;
  }

  /** The world's house rule for trade goods, in the module settings of the module hosting this script. */
  function registerSettings() {
    const ns = host();
    if (!ns) return;
    const reg = (key, name, hint) => { try { if (!game.settings.settings?.has?.(`${ns}.${key}`)) game.settings.register(ns, key, { name, hint, scope: "world", config: true, type: Number, default: 100 }); } catch (e) { console.warn("AxecleftTrade | setting", e); } };
    reg("tradeGoodsSell", t("Trade goods: merchants sell at (%)"), t("Gems, art and jewelry (D35E's Full Resale Price): what Axecleft's Shop merchants charge, as a % of their value. SRD: 100. A shop can set its own on its sheet."));
    reg("tradeGoodsBuy", t("Trade goods: merchants buy at (%)"), t("Gems, art and jewelry (D35E's Full Resale Price): what Axecleft's Shop merchants pay, as a % of their value. SRD: 100. A shop can set its own on its sheet."));
    try {
      if (!game.settings.settings?.has?.(`${ns}.theft`)) game.settings.register(ns, "theft", { name: t("Pickpocketing and shoplifting"), hint: t("Players can try to pick pockets (the hand button on the token controls, on a targeted token) and shoplift at Axecleft's Shop merchants; you decide each attempt on a card in chat. Characters players own can't be robbed."), scope: "world", config: true, type: Boolean, default: true });
    } catch (e) { console.warn("AxecleftTrade | setting", e); }
    settingNs = ns;
  }
  /** A character's coins or items changed: redraw the shop sheets trading with it. */
  function refreshFor(actor) {
    if (!actor) return;
    for (const sheet of openSheets) if (sheet._ash?.buyer === actor.id || (sheet.actor ?? sheet.document) === actor) rerender(sheet);
  }

  /** Make an actor a shop (the Merchant Generator calls this): our sheet and the shop settings. */
  function shopUpdate({ sell, buy, security } = {}) {
    const u = { "flags.core.sheetClass": SHEET, [`flags.${FLAG}.${KEY}.mode`]: "merchant" };
    if (sell != null) u[`flags.${FLAG}.${KEY}.sell`] = Number(sell);
    if (buy != null) u[`flags.${FLAG}.${KEY}.buy`] = Number(buy);
    if (Array.isArray(security)) u[`flags.${FLAG}.${KEY}.security`] = security.filter((k) => SECURITY.some((x) => x.key === k));
    return u;
  }

  /* ------------------------------------------ */
  /*  Tours                                     */
  /* ------------------------------------------ */

  /**
   * Tours of the sheet (Axecleft's Tools 9.7): the merchant's and the loot sheet's, for players and for the GM. A tour
   * opens a sheet of its kind (one already open, else the first the user can see); with none, its steps show in the middle.
   */
  function registerTours() {
    const R = globalThis.AxecleftTools?.registerTour;
    if (!R) return;
    const want = (kind) => (a) => a?.flags?.core?.sheetClass === SHEET && (kind === "loot" ? isLootMode(shopOf(a)) : !isLootMode(shopOf(a)));
    const TourClass = () => globalThis.foundry?.nue?.Tour ?? (typeof Tour !== "undefined" ? Tour : null);
    const IDS = ["shop", "shop-gm", "loot", "loot-gm"];
    const ours = () => { const a = TourClass()?.activeTour; const ns = a?.namespace ?? a?.config?.namespace, id = a?.id ?? a?.config?.id; return !!a && ns === host() && IDS.includes(id); };
    let watch = null;
    /** The tour is over (finished, closed, or another started): the examples go. */
    const watchEnd = () => {
      clearInterval(watch);
      setTimeout(() => { watch = setInterval(() => { if (ours()) return; clearInterval(watch); watch = null; const was = tourSheet; tourDemo = null; tourSheet = null; if (was) rerender(was); }, 500); }, 2000);
    };
    const open = (kind) => async () => {
      const ok = want(kind);
      let sheet = (tourSheet && tourDemo === kind && tourSheet.rendered && ok(tourSheet.actor ?? tourSheet.document)) ? tourSheet : [...openSheets].find((x) => ok(x.actor ?? x.document) && x.rendered);
      if (!sheet) {
        const a = [...(game.actors ?? [])].find((x) => ok(x) && (game.user.isGM || x.testUserPermission(game.user, OWN().LIMITED)));
        if (!a) { ui.notifications.info(t(kind === "loot" ? "Open a loot pile's or party storage's sheet first: this tour points at its parts." : "Open a merchant's sheet first (double-click its token): this tour points at its parts.")); return; }
        a.sheet?.render(true);
        for (let i = 0; i < 30 && !(sheet = [...openSheets].find((x) => (x.actor ?? x.document) === a && x.rendered)); i++) await new Promise((r) => setTimeout(r, 100));
        if (!sheet) return;
      }
      try { sheet.bringToFront?.() ?? sheet.bringToTop?.(); } catch (e) { /* fine */ }
      if (tourSheet !== sheet || tourDemo !== kind) {
        const was = tourSheet;
        tourDemo = kind; tourSheet = sheet;
        if (kind === "merchant") stateOf(sheet).tab = "buy"; // the tour shows the Buy list and the basket
        if (was && was !== sheet) rerender(was);
        rerender(sheet);
        await new Promise((r) => setTimeout(r, 300));
        watchEnd();
      }
    };
    /** A step's element, inside the sheet the tour opened. */
    const scope = (kind, steps) => steps.map((x) => (x.sel ? { ...x, sel: x.sel.split(",").map((p) => `.ash[data-ash-tour="${kind}"] ${p.trim()}`).join(", ") } : x));
    const tour = (id, tab, gm, title, description, next, steps) => R({ module: host, id, cls: "axecleft-shop", tab, gm, open: open(tab), title, description, next: next ? [() => `${host()}.${next}`] : [], steps: scope(tab, steps) });
    // The GM's tours first: the ⋮ menu starts the first tour the user may take
    tour("shop-gm", "merchant", true, /*t*/"Axecleft's Shop: the merchant (GM)", /*t*/"The shop settings on a merchant's sheet: prices, haggling, security, the purse, restocking and the log.", "shop", [
      { id: "intro", title: /*t*/"Axecleft's Shop", content: /*t*/"The Merchant Generator puts its merchants on this sheet. Players need only Limited or Observer on the merchant: every purchase and sale goes through your game, which checks it and moves the coins and items. Without a GM connected, nothing can be traded." },
      { id: "gm", sel: "details.ash-gm:not(.ash-log) > summary", title: /*t*/"GM: shop settings", content: /*t*/"Only you see this. Click to open or close it." },
      { id: "prices", sel: "[data-ash-set='sell']", title: /*t*/"Prices", content: /*t*/"What the shop charges and pays, as a % of an item's value, and its own % for trade goods (gems, art, jewelry; empty: the world's house rule in the module settings). Sheet changes it to a loot pile or party storage." },
      { id: "open", sel: "[data-ash-set='open']", title: /*t*/"Who can trade", content: /*t*/"All players, or only those you set in the actor's Ownership; and whether trades show in chat for everyone, for you only or not at all." },
      { id: "haggle", sel: "[data-ash-set='haggle']", title: /*t*/"Haggling", content: /*t*/"Players can roll Diplomacy, Intimidate or Bluff (the ones ticked) for better prices; you approve, change or refuse each on a card in chat. A haggle lasts for that character until you reset it or restock." },
      { id: "steal", sel: "[data-ash-set='steal']", title: /*t*/"Pickpocketing, shoplifting and security", content: /*t*/"Whether players can try to rob this shop (you decide each attempt on a card: a time-out, a lock-out from the shop, the merchant's reaction). Security (guards, a watchful owner, locked cases, wards…) raises the DCs and the merchant's Spot. Locked-out characters are listed here, to let them back." },
      { id: "purse", sel: "[data-ash-coin='gp']", title: /*t*/"Purse", content: /*t*/"The merchant's coins. It pays for what it buys from them: a merchant can't buy what it can't afford." },
      { id: "restock", sel: "[data-ash='restock']", title: /*t*/"Restock", content: /*t*/"New stock by the merchant's saved Merchant Generator settings, or open the Merchant Generator. Players need Limited or Observer on this actor, never Owner." },
      { id: "log", sel: "details.ash-log > summary", title: /*t*/"Log", content: /*t*/"Every sale and purchase, haggle, pickpocketing and shoplifting attempt and lock-out, newest first. Clear it here." },
      { id: "stock", sel: ".ash-list a.ash-ctl[data-ash='hide']", title: /*t*/"The stock", content: /*t*/"Beside each item: hide it from players, one more or one fewer, edit it, remove it. Drop items on the sheet to add them to the stock." },
      { id: "charsheet", sel: "[data-ash='charsheet']", title: /*t*/"Character sheet", content: /*t*/"The merchant's stats, skills and attacks on D35E's own NPC sheet, beside the shop (it stays the shop's sheet)." },
    ]);
    tour("shop", "merchant", false, /*t*/"Axecleft's Shop: buying and selling", /*t*/"Trade with a merchant: buy, sell, the basket, haggling and sleight of hand.", "loot", [
      { id: "intro", title: /*t*/"A merchant's shop", content: /*t*/"Double-click a merchant's token to open its shop. You trade as one of your characters; the GM's game carries out each trade, so a GM must be connected." },
      { id: "who", sel: ".ash-who select[data-ash='buyer']", title: /*t*/"Trading as", content: /*t*/"The character who buys and sells, and the coins in their purse." },
      { id: "haggle", sel: ".ash-who [data-ash='haggle']", title: /*t*/"Haggle", content: /*t*/"When the shop allows it: roll Diplomacy, Intimidate or Bluff for better prices. The GM decides how much (or worse prices, if it goes badly); it lasts for this character." },
      { id: "tabs", sel: "nav.ash-tabs", title: /*t*/"Buy and Sell", content: /*t*/"Buy: what the shop has, at its prices. Sell: your character's items the shop would buy, with its offer for each. You can also drop an item from your character on the sheet to sell it." },
      { id: "list", sel: ".ash-list table.ash-t tr:first-child", title: /*t*/"Items", content: /*t*/"By kind, with how many and the price. Rest the pointer on a name to read the item; click it to keep the description open. The cart adds one to the basket." },
      { id: "basket", sel: ".ash-basket", title: /*t*/"Basket", content: /*t*/"What you're about to buy and its total (red when the character can't afford it). − takes one off; Buy all pays for everything at once, with change." },
      { id: "steal", sel: ".ash-who [data-ash='pickpocket']", title: /*t*/"Sleight of hand", content: /*t*/"When the GM allows it: pick the merchant's pocket here, or shoplift an item with the hand beside it. You roll Sleight of Hand; only the GM sees the result and decides. The hand button in the token controls picks the pocket of a token you target." },
    ]);
    tour("loot-gm", "loot", true, /*t*/"Axecleft's Shop: loot and party storage (GM)", /*t*/"Setting up a loot pile or party storage: who opens it, its coins, a lock and a trap.", "loot", [
      { id: "intro", title: /*t*/"Loot and party storage", content: /*t*/"Right-click an NPC actor in the Actors sidebar: Make it a loot container, or Make it party storage. Players with Limited or Observer take things out and put things in; the party's stash keeps a log they can read." },
      { id: "gm", sel: "details.ash-gm:not(.ash-log) > summary", title: /*t*/"GM: settings", content: /*t*/"Only you see this. Click to open or close it." },
      { id: "open", sel: "[data-ash-set='open']", title: /*t*/"Who can open it", content: /*t*/"All players, or only those you set in Ownership; whether takes show in chat; and whether players can split the coins among the party (you always can)." },
      { id: "coins", sel: "[data-ash-coin='gp']", title: /*t*/"Coins", content: /*t*/"What's inside, by coin." },
      { id: "lock", sel: "[data-ash-l='lock.locked']", title: /*t*/"Lock", content: /*t*/"Locked or not, the lock's quality and Open Lock DC (SRD: very simple 20 to amazing 40), arcane lock (+10), and a key (an item by name) that opens it." },
      { id: "box", sel: "[data-ash-l='lock.box']", title: /*t*/"Container", content: /*t*/"What it is (a small chest, a treasure chest…): its hardness, hit points and Break DC, for forcing or breaking it open." },
      { id: "trap", sel: "[data-ash-l='trap.armed']", title: /*t*/"Trap", content: /*t*/"Arm a simple trap (its Search and Disable DCs, a save, damage, poison) or pick a trap actor from Axecleft's Traps, Poisons, and Diseases. Search finds it; Disable Device disarms it; opening it unaware sets it off." },
      { id: "openclose", sel: "[data-ash='close'], [data-ash='gmOpen']", title: /*t*/"Open or close it", content: /*t*/"Locking it or arming a trap closes it. Picking the lock, keys, knock and traps found or disabled go ahead on their own (you're told); forcing it, breaking it and a trap going off come to you on a card." },
    ]);
    tour("loot", "loot", false, /*t*/"Axecleft's Shop: loot and party storage", /*t*/"Take things, put things in, split the coins, and get past a lock or a trap.", null, [
      { id: "intro", title: /*t*/"Loot and party storage", content: /*t*/"A chest, a body to search or the party's stash. Choose your character, then take what you want; the GM's game moves it, so a GM must be connected." },
      { id: "who", sel: ".ash-who select[data-ash='buyer']", title: /*t*/"Character", content: /*t*/"The character who takes things and puts them in." },
      { id: "closed", sel: ".ash-closed", title: /*t*/"Closed or locked", content: /*t*/"Open it, use the key, pick the lock (roll, take 10 or take 20; thieves' tools), force it or break it (noisy), or cast knock. Search for traps first: a trap you find can be disabled; one you don't find goes off when you open it." },
      { id: "coins", sel: "[data-ash='takeCoins'], [data-ash='putCoins']", title: /*t*/"Coins", content: /*t*/"Take coins or put some in. Split among the party shares them equally among the characters (when the GM allows it); what can't be shared stays." },
      { id: "items", sel: ".ash-list table.ash-t tr:first-child", title: /*t*/"Items", content: /*t*/"Take an item (part of a stack too). Rest the pointer on a name to read it. Drop an item from your character on the sheet to put it in." },
      { id: "sneak", sel: "a.ash-ctl[data-ash='sneak'], a.ash-ctl[data-ash='sneakCoins']", title: /*t*/"Sneak it out", content: /*t*/"The hand takes an item or coins without the others knowing: your Sleight of Hand against their characters' Spot. Only the GM is told." },
      { id: "log", sel: "details.ash-log > summary", title: /*t*/"Log", content: /*t*/"Party storage keeps a log of what was taken and put in, for everyone to read (not what was sneaked out)." },
    ]);
  }

  const api = {
    version: AXECLEFT_TRADE_VERSION, hosts, SHEET, SheetClass: existing?.SheetClass ?? null,
    shopOf, shopUpdate, money, wealth, payment, addCoins, valueOf, askPrice, offerPrice, call, haggleFor, stacks, moveItem,
    stealFlow, pickTargeted, SECURITY, securityFx, statSheet, lootOf,
    /** Make an actor a loot pile or party storage on Axecleft's sheet. */
    lootUpdate: (mode = "loot") => ({ "flags.core.sheetClass": SHEET, [`flags.${FLAG}.${KEY}.mode`]: mode === "storage" ? "storage" : "loot" }),
    _onInit() {
      registerSheet(); registerSettings();
      Hooks.on("getSceneControlButtons", (c) => globalThis.AxecleftTrade?.version === AXECLEFT_TRADE_VERSION && sceneControl(c));
      const v2chat = !!foundry.applications?.api?.ApplicationV2 && (game.release?.generation ?? 11) >= 13;
      Hooks.on(v2chat ? "renderChatMessageHTML" : "renderChatMessage", (msg, html) => bindCard(msg, html));
      // The Actors sidebar's right-click menu: make an NPC actor a loot pile or party storage (GM)
      const idOf = (li) => (li?.dataset ?? li?.[0]?.dataset)?.entryId ?? (li?.dataset ?? li?.[0]?.dataset)?.documentId;
      const entries = () => [["loot", /*t*/"Make it a loot container", "fa-sack-dollar"], ["storage", /*t*/"Make it party storage", "fa-box-archive"]].map(([mode, label, icon]) => ({
        name: t(label), icon: `<i class="fas ${icon}"></i>`,
        condition: (li) => { const a = game.actors?.get(idOf(li)); return game.user.isGM && a?.type === "npc" && (shopOf(a).mode !== mode || a.flags?.core?.sheetClass !== SHEET); },
        callback: async (li) => { const a = game.actors.get(idOf(li)); if (!a) return; await a.update(api.lootUpdate(mode)); ui.notifications.info(mode === "storage" ? t("{name} is now party storage: open its sheet to set it up.", { name: a.name }) : t("{name} is now a loot container: open its sheet to set it up (lock, trap, who can open it).", { name: a.name })); },
      }));
      Hooks.on("getActorContextOptions", (app, options) => { if (Array.isArray(options)) options.push(...entries()); });
      Hooks.on("getActorDirectoryEntryContext", (html, options) => { if (Array.isArray(options)) options.push(...entries()); });
    },
    _onReady() {
      if (globalThis.AxecleftTrade?.version === AXECLEFT_TRADE_VERSION) { try { registerTours(); } catch (err) { console.warn("AxecleftTrade | tours", err); } }
      try { game.socket.on(channel(), onSocket); } catch (err) { console.error("AxecleftTrade | socket", err); }
      for (const h of ["updateActor"]) Hooks.on(h, (a) => refreshFor(a));
      for (const h of ["createItem", "updateItem", "deleteItem"]) Hooks.on(h, (i) => refreshFor(i.parent));
    },
  };
  globalThis.AxecleftTrade = api;
  if (!globalThis.__axecleftTrade && globalThis.Hooks) {
    globalThis.__axecleftTrade = true;
    Hooks.once("init", () => globalThis.AxecleftTrade._onInit());
    Hooks.once("ready", () => globalThis.AxecleftTrade._onReady());
  }
})();
