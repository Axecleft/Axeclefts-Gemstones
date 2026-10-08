# Axecleft's Treasure Generator (shared script) — changelog

File: scripts/axecleft-treasure.js. Ship the same copy in every Axecleft treasure module; the highest version runs.


## Version 9.91

- Epic scrolls (Axecleft's Curios 1.14.7) join the epic extra items at EL 21+. (Version numbers compare as numbers, so 9.91 follows 9.9.)

## Version 9.9

- **Encounter levels 21–30** (Treasure by Level and Token Loot): the DMG rule, the EL 20 row plus 1, 2, 4, 6, 9, 12, 17, 23, 31 or 42 extra major magic items. Token Loot rolls CR 21–30 creatures at their own CR (above 30, EL 30).
- **Epic extra items** (house rule): while **Epic items** is on, a share of those extra items are epic items from the SRD epic tables (new box in Generation settings → Campaign, **Epic share of the extra items at EL 21+**, default 25%). The category is rolled on the major item table among those with SRD epic items (armor and shields, weapons, rings, rods, staffs, wondrous items); the item comes from the module that makes it (Armory, Curios). An epic item already in that treasure isn't rolled again, so the short epic lists repeat less.
- Providers get grade `"epic"` and `exclude` (a Set of item names already in the treasure); a provider with nothing epic for the category returns nothing and a normal major item is rolled instead.

## Version 9.8

- **Trap loot** (Token Loot tab): trap tokens can get incidental loot too (the belongings of earlier victims). Select trap tokens and roll: it's rolled at the trap's CR, scaled by the new **Trap loot** setting (¼, ½, ¾ or the full treasure for its CR; default ¼). Never automatic: traps placed on a scene (or set from trap kits) get no loot unless you roll it.
- Fixed: with Automatic loot on, rolling loot by hand (toolbar button, `T.lootTokens()`) was treated as automatic, so linked tokens and tokens that already had loot were skipped.

## Version 9.7

- **Token loot** (new tab **Token Loot**, and a <i>sack of coins</i> button on the token toolbar): each selected NPC token gets its own roll on the SRD Treasure table at its **Challenge Rating**, scaled by the **Treasure** setting on its D35E NPC sheet (None, Standard, Double, Triple, or a % for coins, goods and items; each full 100% is one roll, the rest is the chance of one more).
  - Items go into that token's inventory with their value rolled, coins into its purse (paid as set under Coins). An unlinked token keeps the loot on that one creature; a linked token's goes on its actor.
  - **Clear Loot** takes back only what the generator added (its marked items and the coins it paid). **Replace loot rolled before** (on by default) clears first when you roll again.
  - CR below 1: EL 1 with each part's chance scaled by the CR (CR 1/2 rolls half the time). CR above 20: EL 20 for now (epic treasure comes later).
  - Characters, tokens a player owns and NPCs with Treasure: None get nothing; the tab lists the selected tokens with their CR, treasure and why any are skipped.
- **Automatic loot** (Token Loot tab, off by default): when an unlinked NPC token is placed on a scene, the GM's client rolls its loot. Options: post a GM chat card for each, include hidden tokens. A token that already has loot (for example a copy of a looted token) is left alone.
- `T.lootToken(token, opts)`, `T.lootTokens(tokens?, opts)`, `T.clearLoot(token)`, `T.clearLootTokens(tokens?)` for macros.

## Version 9.6

- **Searchable lists that scroll.** Text boxes with suggestions (the Curios tab's item box, the Lists tab's names, and the Crafting window's item boxes) used the browser's own popup, which in Foundry didn't scroll and ran off the bottom of the screen. They now open Axecleft's own list: it scrolls, opens above the box when there's no room below, filters as you type (matches underlined), shows everything on a double-click or ↓, and works with ↑ ↓ Enter and Esc. Long lists show the first 400; type to narrow them.
- `T.enhanceDatalists(root)` does this for any `<input list>` in a window; the Treasure Generator and the Crafting window (engine 1.4) call it after wiring their tabs.

## Version 9.5

- **Campaign switches** in Generation settings, shared by every Axecleft module: **Psionics** (on by default) and **Epic items** (off by default). `T.rules()` returns `{ psionics, epic }`.
- Epic and psionic compendium items are now marked instead of dropped: `T.registerItemMarks({ module, epic: [names], psionic: [names] })` (Curios ships the SRD lists), plus D35E's own epic/psionic fields when filled and names that say so. Item compendium stock leaves psionic items out while Psionics is off, and epic items out unless Epic items is on **and** the roll asks for them (`epic: true`, sent by Epic campaign merchants).
- Psionic consumables are sorted like their magic equivalents: psionic tattoos as potions, power stones as scrolls, dorjes as wands.
- A shop type with the tag `psionic` only stocks psionic items from the item compendiums.
- New API: `rules`, `registerItemMarks`, `isEpicItem`, `isPsionicItem`, `allowedByRules`. `classifyItem(e, magicPack, { allowEpic })`.

## Version 9.4

- Generation settings: **sizes of arms**. Random armor and weapons are Small 30%, Medium 60% and Large 10% (SRD: "any other size"). Untick for all Medium.

## Version 9.3

- Generation settings: **special purpose** for intelligent items. The default is always for items with greater powers, plus 0% of the others; either part can be switched off or changed. The SRD lists special purposes and dedicated powers but doesn't say how often they occur.

## Version 9.2

- The tab buttons stay at the top of the window while its contents scroll.

## Version 9.1

- Fixed: Generation settings typed into a number field were lost if the window was closed before leaving the field. They now save as you type, and a pending change is saved when the window closes.
- Fixed: after Reset to Defaults, or on reopening the window, the Generation settings and Coins sections showed the values typed earlier instead of the saved ones.

## Version 9

Price corrections, extra compendium sources, Generation settings and poisons.

- **Price corrections.** Some compendium items carry wrong prices (D35E 3.1.0's specific magic arms, for example Mithral Full Plate of Speed at 1,500 gp instead of 26,500). Modules ship corrections (`registerPriceCorrections`), and GMs add their own on the new "Price Corrections" page of the Treasure Lists journal (Item, Compendium, Price, Note; a blank Compendium means any).
  - Matched by compendium id and item name, not item id, so one table serves every system version.
  - Applied in memory only: to the compendium scan (grading minor/medium/major, gp limits, stock) and to the copy made when an item is generated. Compendiums are never edited.
  - A correction does nothing once the compendium's price already matches, so fixes in a system update win automatically. Switch off a built-in correction on "Disabled Entries (Treasure Generator)".
  - Price Check (Merchant Generator, Item Sources tab) lists every correction with the compendium's current price; Export CSV downloads it to send to a compendium's maintainer.
  - Items whose price was 0 but have a correction (D35E's Sleep Arrow, Screaming Bolt, Arrow of Death, Greater Slaying Arrow) now count as stock.
- **Extra source kinds.** Modules can read other item kinds from compendiums the GM chooses (`registerSourceKind`), for example Axecleft's Armory's Enhancements and Special materials. Each kind gets its own section on the Item Sources tab, with automatic matching or the GM's own choice, saved per world with the item sources. Read with `kindItems(id)`.
- **Poisons.** New category Poison: any D35E consumable of type "poison" (as made by Axecleft's Traps, Poisons, and Diseases), found in any item source.
  - Compendiums named "Poison Consumables" are automatic item sources.
  - Disease consumables from the Poison and Disease generator (which share the type; "Vial" before identification) and items named like SRD diseases are left out, unless tagged "Shop: Poison".
  - Shop tag "Shop: Poison" added.
- **Generation settings** (Treasure by Level tab, collapsible, saved per world): extras for randomly generated items, read by Axecleft's Armory and Curios with `generation()` and `genChance(kind, category)`.
  - Light: on/off, chance and bright/dim radii for magic melee weapons (SRD 30%, 20/40 ft), ranged weapons (SRD: none), armor and shields (5%, 10/20 ft) and other permanent items (1%, 5/10 ft); colors and animation from the item's abilities; stronger items brighter; optional farther reach for stronger items.
  - Intelligence: on/off and chance per category (default 1%: the SRD's "fewer than 1%"); never potions, scrolls, wands or ammunition.
  - Inscription hints: melee and ranged weapons, 15% (SRD).
  - Poisons: 1% of mundane item rolls on the Treasure table become a poison from the item sources (house rule; 0 turns it off).
  - Reset to Defaults.
- Treasure by Level shows whether poisons are available.
- API: `registerPriceCorrections`, `priceCorrections`, `correctionFor`, `correctedPrice`, `applyPriceCorrection`, `priceCheck`, `exportPriceCheck`, `registerSourceKind`, `sourceKinds`, `kindSources`, `setKindSources`, `kindItems`, `generation`, `saveGeneration`, `resetGeneration`, `genChance`, `GEN_DEFAULTS`, `GEN_CATS`, `isDisease`. `compendiumStats[pack].corrected` counts corrected prices.
- Saving the item sources keeps the source-kind choices.

## Version 8

Shared custom lists. The Treasure Lists journal and library file now belong to the shared script, so every Axecleft module keeps its user-made lists in the same place. (Gemstones 1.14 kept them in scripts/treasure-lists.js; that file is no longer used and can be deleted.)

- One journal, "Axecleft's Treasure Lists", and one library file, Data/axecleft-treasure/treasure-lists.json, for all modules. Each list is a journal page with a plain table, editable by hand or from the Lists tab.
- Modules declare their lists with `registerList()`. Nothing gem-specific is left in the shared script: Gemstones registers its gems, art objects, materials and embellishment gems like any other module.
- The library file keeps each module's lists separate (module, then list), so two modules can both have a "materials" list without colliding. File layout: `{ format: 2, modules: { "<module id>": { "<list>": [rows], "disabled": [rows] } } }`. A copy of Gemstones' lists is also written in the old layout, so Gemstones 1.14 can still read the file.
- Each module gets its own Disabled Entries page, "Disabled Entries (<module title>)", for built-in entries to switch off. The List column takes one of that module's lists, a list's extra scopes (Gemstones: srd, homebrew), or "any".
- Pages of a module that isn't active stay in the journal untouched, and their rows stay in the library file whenever another module saves it.
- The Lists tab is generic and appears once any active module has a list:
  - A count of your entries and switched-off entries per list, grouped by module.
  - Pick a list to add an entry; the form is built from the list's columns: text, number, dropdown or tick boxes.
  - Your entries, with ✕ to remove one.
  - Switch off built-in entries for that list (name suggestions from the list's built-in entries), with ✕ to switch one back on.
  - Open Lists Journal, Save to Library, Load from Library, Export and Import, as before.
- Kept from Gemstones 1.14:
  - Merging only adds rows, matched by name.
  - Changes save to the library automatically, and every world loads it at start-up.
  - Editing a page by hand saves too.
  - Deleting the journal is safe: it is rebuilt from the library.
  - Export and Import work as before; Gemstones 1.14 export files import too.
- Settings: "Shared treasure lists library" (Automatic / Manual) and "Shared library folder" are now registered by the shared script, under the first Axecleft module that loads it. With Gemstones active they keep their existing values.
- Migration on first load (GM):
  - The Gemstones 1.14 journal is taken over: its pages keep their names and rows, "Disabled Entries" becomes "Disabled Entries (Axecleft's Gemstones)", and "How to Use" is rewritten.
  - The old library file is read and merged.
  - The file is saved back in the new layout.
  - Rows found only in the world or only in the library end up in both.
- API (`globalThis.AxecleftTreasure`):
  - `registerList({ module, key, page, label, cols, intro, normalize?, format?, builtin?, names?, scopes?, prepare?, order? })`
    - `cols`: `[[field, header, input?], ...]`; must include "name".
    - `input`: `{ type: "text" | "number" | "select" | "checks", options: [[value, label]] | () => [...], value, min, max, step, placeholder }`.
    - `normalize(row)` cleans a row; `format(field, row)` gives a cell's text.
    - `builtin`: the module's own rows (an array or a function).
    - `names()`: name suggestions for switching entries off.
    - `scopes`: extra values for a disabled entry's List column, e.g. `[["srd", "SRD gems only"]]`; built-in rows carry `scope`.
  - `customList(module, key)`: the built-in rows minus the switched-off ones, plus your rows (which replace built-in rows of the same name); each row has `source` "builtin" or "custom".
  - `listRows(module, key)`: your rows only. `disabledEntries(module)`: `[{ name, list }]`.
  - `lists.addRow(module, key, row)`, `lists.removeRow(module, key, name, list?)`, `lists.readModule(module)`, `lists.saveLibrary()`, `lists.loadLibrary()`, `lists.exportLists()`, `lists.importLists(file)`, `lists.getJournal()`.
  - The hook `axecleftTreasure.listsChanged` fires after any list changes.

## Version 7

- Shop tags: an item can now belong to more than one category. A D35E item tag written as "Shop: Scroll", "Shop: Potion", "Shop: Ring" and so on adds the item to that category as well as the one its data gives it. A magic tome stays a wondrous item and, tagged "Shop: Scroll", is also stocked by scribes. Every category has a tag: Gem, Art object, Tools and gear, Alchemical item, Weapon, Armor, Shield, Ammunition, Masterwork weapon, Masterwork armor, Magic weapon, Magic armor, Potion, Scroll, Wand, Ring, Rod, Staff, Wondrous item. Plurals and any capitalization work.
- Specialty tags "Shop: Book", "Shop: Clothing" and "Shop: Jewelry" let a shop limit a category to matching items (a bookseller's wondrous items are only those tagged Book). Only the item compendium source honors these limits; a shop asking for one never gets an untagged item from another source.
- Tags are read on every compendium scan. An item with no category of its own (an unusual item type) is stocked through its category tags, as long as it has a price.
- Fixed: the Staff of Passage was left out as if it were a service (ship's passage).
- API: tagSuggestions(packId) returns every item with its sorted category, current Shop tags and suggested tags (from the item's name and its compendium folder names: a "Books" folder suggests Scroll and Book). applyShopTags(packId, [{ id, cats, hints }]) writes them (a locked compendium is unlocked for the write and locked again; other tags are kept) and rescans. Also readShopTags(), writeShopTags(), TAG_LABELS, SHOP_HINTS. hasProvider(category, hints) and rollCategory(category, { hints: { category: [tags] } }) take the specialty limits; a provider that can honor them declares hints: true.

## Version 6

- New built-in item source: Item compendiums. By default D35E's Items, Weapons and Ammo, Armor and Shields and Magic Items, plus any world or module Item compendium whose name matches (Gear, Equipment, Goods, Supplies, Weapons, Ammo, Armor, Shields, Magic Items, Wondrous). The choice is made on the Merchant Generator's Item Sources tab and saved per world.
- Every item is sorted by its own data, whatever compendium it's in: weapons (standard, masterwork, magic; ranged noted), armor and shields (standard, masterwork, magic), ammunition, tools and gear, alchemical items, potions, scrolls, wands, rings, rods, staffs and wondrous items. In a magic item compendium, unenhanced arms are magic unless made of a special material (mithral, adamantine, darkwood, cold iron, silver). Magic items are graded by price: minor up to 4,000 gp, medium up to 25,000 gp, major above.
- Left out: items with no price, magic weapons and armor priced under 1,000 gp (their price is missing), epic items, gems and art (Gemstones handles those), and mounts, animals and services.
- Compendiums are rescanned when the world loads and shortly after items in a chosen compendium change.
- New categories for merchant stock: standard weapons, armor, shields and ammunition (not on the SRD Treasure table).
- Treasure by Level: the item compendiums are used for any category no module covers, after the SRD lists. Until Axecleft's Curios exists, minor/medium/major rings, rods, staffs and wondrous items (and magic arms until the Armory) come out as real items from the Magic Items compendium.
- The SRD alchemical items and gear use the SRD price when the D35E compendium item has none (D35E's Thunderstone is priced 0).
- API: rollCategory(category, { mix: true }) picks among all sources for a category (used by merchants); sourcesFor(category), listItemPacks(), itemSources(), setItemSources(cfg), scanCompendiums(), classifyItem(), compendiumStats.

## Version 5

- The window never goes past the screen edge; its contents scroll and the Generate button stays pinned at the bottom.
- The Coins section on Treasure by Level is collapsible. Closed, it shows what's set (for example "(Crowns as Trade Bar; weightless)"). Open or closed is remembered.

## Version 4

- For the Merchant Generator: AxecleftTreasure.rollCategory(category, ctx) rolls one item of a category from whichever module supplies it, and hasProvider(category) says whether one is active. rollDice is exposed too.

## Version 3

- The Coins choices (what each SRD coin is paid as, and carried or weightless coins) are now saved for each world instead of each GM. A GM running two campaign worlds (say Dark Sun and Dragonlance) keeps a separate currency setup in each, and any GM of a world gets that world's setup.
- Choices saved by version 2 (per GM) are used until the world's own choices are saved, so nothing needs redoing.
- The setting is stored under the "world" namespace, not under a module, so it stays put whichever Axecleft modules are active.

## Version 2

Coins on the Treasure by Level tab now follow the world's D35E currency setup.

- Renamed coins: the names from D35E's "Currency names" setting are used everywhere (rolls, chat cards, the Coins section), for example "1,200 Crowns (gp)".
- Custom currencies: a new Coins section lets you pay each SRD coin (cp, sp, gp, pp) as itself, as another standard coin, or as any custom currency from D35E's Currency Configuration (grouped as in D35E). For example, pay gold as Trade Bars worth 50 gp each.
  - Amounts convert by gp value. A currency only takes whole coins; what's left is paid as change in standard coins (gold, silver, copper), so no value is lost. Example: 1,234 gp paid as Trade Bars is 24 Trade Bars and 34 gp.
  - A custom currency with no gp value set can't be converted to, so that coin is paid as rolled.
- Standard coins can go into the carried purse or D35E's weightless coins. Custom currencies always go into the actor's custom currency fields.
- With the Items sidebar or Chat card destination, the chat card lists the converted coins to hand out yourself.
- The Coins choices are remembered for each GM (stored on the GM's user). Changed to per world in version 3.
- API: AxecleftTreasure.currencies(), convertCoins(coins, settings), coinSettings().

## Version 1

First release (in Axecleft's Gemstones 1.14.4): shared window, "Put items in" destinations, chat cards, Treasure by Level (SRD coins, goods and items), providers, tabs and buttons for other modules.
