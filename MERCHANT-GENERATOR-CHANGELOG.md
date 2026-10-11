# Axecleft's Merchant Generator (shared script) — changelog

File: scripts/axecleft-merchants.js. Ship the same copy in every Axecleft module, listed in module.json "esmodules" after axecleft-tools.js and axecleft-treasure.js (version 9 or later for this version). The highest version runs.

## Version 7.5

- **Epic stock** in Epic campaign settlements: about 1 magic item in 10 is an epic item from the SRD epic tables (Axecleft's Armory and Curios, Treasure Generator 9.9 or later), in any settlement size: an epic shopkeeper can be anywhere, and that epic stock ignores the settlement's gp limit. Categories without epic items (potions, wands, gems) get ordinary items. An epic item isn't stocked twice in one shop. Merchants still have no levels.

## Version 7.4

- New settlement character **Epic campaign**, shown only while the world's **Epic items** switch is on: epic items may be stocked, every grade, gp limit ×10.
- Shop types can declare `needs: "psionics"` or `needs: "epic"` to show only while that switch is on (Curios' Psionic emporium uses this).

## Version 7.3

- The tab buttons stay at the top of the window while its contents scroll.

## Version 7.2

- The tab buttons size to their labels and never wrap, so "Item Sources" stays on one line when selected (bold).

## Version 7.1

- Item Sources tab: the compendium list, each extra source kind (Enhancements, Special materials) and the Price Check results are collapsible sections. Closed, they show what's set (for example "6 of 40 used, automatic"). Open or closed is remembered.

## Version 7

- New shop type **Black market**: poisons first, with some gems, art, gear, masterwork arms, potions and wondrous items.
- The **Fence / pawnbroker** also sells poisons. Alchemists do not.
- Settlement character **Lawless / thieves' haven** doubles the share of poisons (as well as unappraised goods).
- Poison is a category in the Shop Types editor and a Shop tag.
- **Item Sources tab**:
  - Sections for the extra source kinds other modules register (Axecleft's Armory: Enhancements, Special materials), each with automatic matching or your own choice. Save and Rescan saves them all.
  - Poison Consumables compendiums are matched automatically; the help text says so.
  - Each compendium's line shows how many prices were corrected.
  - New **Price corrections** section: how many corrections are in force, **Price Check** (each corrected item, the compendium's current price and the corrected one) and **Export CSV**.
- Requires the Treasure Generator script version 9.

## Version 6

- Merchants now have a sex. The Merchant tab has a Sex choice (Random, Male, Female) next to Race. The biography and chat card read "female dwarf", and the merchant's saved shop settings keep it.
- Built-in first names are now split by race and sex (dwarf, elf, gnome, halfling and half-orc lists were extended so each has 9 to 16 per sex). Surnames stay by race.
- A rolled name (dice button) keeps the race and sex it was rolled for, even if Race or Sex is changed afterward.
- The Names tab is now **People**:
  - "Names for": Any race, or one race. Each has Male first names, Female first names, First names (either), and Surnames. Any race names are used for every race; a race's names only for that race. The list shows how many names each race has. Shop names stay shared by all shops.
  - Edits are kept while you switch between races; Save Names saves them all.
  - Show Examples uses the race picked under "Names for" (or the Merchant tab's race), and the Merchant tab's sex.
  - Names saved by earlier versions keep working (they become Any race names).
- Portraits: set a portrait folder (People tab, Browse or type the path, then Save and Scan Folder). A new merchant with no image chosen gets a random portrait from the folder and its subfolders that fits its race and sex, as its actor and token image.
  - Race and sex are read from folder and file names below the portrait folder: "dwarf/female/smith-01.webp", "elf_male_3.png", "Half-Elf Women/lia.webp". Plurals (dwarves, elves, women, men) and m or f work; words must be separate ("elf_female", not "femaleelf").
  - Best fit first: race and sex; then that race with no sex given; then that sex with no race given; then images with neither. An image named for another race or sex is never used. With no fitting image, the merchant keeps the default image.
  - After scanning, a table shows how many images there are for each race and sex.
  - An image picked in the Image field always wins; converted or restocked actors keep their images.
  - Saved per world.
- API: randomMerchant(type, { race, sex, names }) returns raceKey and sex too; pickPortrait(raceKey, sex), portraitFiles(force), portraitTags(path), SEXES. generateMerchant takes sex, and portrait: false to skip the random portrait.

## Version 5

- New Shop Tags tab (also on the Axecleft's Tools menu as "Shop Tags"): sort the items in any Item compendium, yours or a module's, into the shops that sell them.
  - Choose a compendium and press Scan. Each item is listed with its folder, what it already sells as, and its Shop tags: what it has now plus suggestions from its name and folder names (a "Books" folder or "Libram" in the name suggests Scroll and Book; "Clothing" suggests Clothing; "Gems and Jewelry", amulets and brooches suggest Jewelry; elixirs and oils suggest Potion).
  - Edit any row's tags (separated by commas; unknown words are flagged and block the write), or tick rows and Add, Remove or Clear one tag on all ticked rows the filter shows. Reset goes back to the current tags plus suggestions.
  - Show rows with new suggestions, all items, tagged, untagged or ticked items, and filter by name, folder or tag. Long lists show 600 rows at a time; filter to see the rest.
  - Write Tags to Ticked Items asks for confirmation, then writes. Only Shop tags change; an item's other tags are kept. Locked compendiums are unlocked for the write and locked again.
  - If the compendium isn't one of your item sources, the tab says so and offers Add to Item Sources.
  - The tags are ordinary D35E item tags ("Shop: Scroll", "Shop: Book"), so they can be added or removed by hand on an item too. Tag items in your own compendiums: system and module compendiums are replaced when they update.
- Booksellers, clothiers and jewelers now also sell magic wondrous items, limited to those tagged Book, Clothing or Jewelry; jewelers sell magic rings too. Until items are tagged, the shop line says "none in your item sources yet (see Shop Tags)" and the rest of the shop stocks as before.
- Shop Types editor: new "Wondrous items" choice (Any, or only those tagged Book, Clothing or Jewelry) for your own shop types.
- The chat card's "Not stocked" note names limited categories ("Wondrous item tagged Book").
- AxecleftMerchants.open(tab) opens on a tab: "merchant", "types", "names", "sources" or "tags". Shop types take hints: { category: [tags] }.
- Requires the Treasure Generator script version 7.

## Version 4

- Merchants now draw from item compendiums as well as the SRD lists and Axecleft's modules, mixing all sources: a general store sells SRD-table goods and everything in your Gear compendiums, a weaponsmith your custom weapons alongside D35E's.
- Standard weapons, armor, shields and ammunition are in the rotation, not only masterwork and magic. Ammunition is stocked by the dozen (2d4 × 10 pieces; bundles 1d4).
  - New mixes: General store, Outfitter, Trading post, Blacksmith, Weaponsmith, Armorer, Bowyer and Fence now sell standard arms; the Bowyer only ranged weapons and ammunition.
  - The Shop Types editor has the four new categories.
- New Item Sources tab: every Item compendium (system, world and modules), what each holds after scanning (for example "77 items: 72 weapon, 5 ammunition"), and the choice between automatic matching and your own selection. Save and Rescan, or Rescan after editing a compendium.
- Requires the Treasure Generator script version 6.

## Version 3

- Fixed: the window could grow taller than the screen, leaving the Generate button out of reach. The window now never goes past the screen edge; its contents scroll, and the Generate Merchant button stays pinned at the bottom.
- "Settlement character" and "Prices and purse" are collapsible sections. Closed, they show what's set (for example "(Port, Wealthy)" or "(sells 100%, buys 50%, purse settlement's)"). Open or closed is remembered.

## Version 2

- Fixed: new merchants are created with ownership None (D35E's merchant sheet needs it); set player permissions on the merchant sheet. The "Players can open" toggle is gone.
- More shop types (22): General store, Adventurer's outfitter, Trading post, Blacksmith, Weaponsmith, Armorer, Bowyer / fletcher, Alchemist, Herbalist / apothecary, Jeweler, Gem cutter, Gold- and silversmith, Carver / sculptor, Clothier / furrier, Art dealer / curio shop, Bookseller, Scribe, Temple, Wandwright / staff maker, Magic shop, Exotic goods, Fence / pawnbroker.
  - Shop types can filter Gemstones goods (jewelry only, cloth and fur only, books only, cast metal, carvings). The Bowyer passes a "ranged" hint to the item provider, which Axecleft's Armory can use.
- Custom shop types (Shop Types tab): name, a share for each of the 15 item categories, and optional gems/art filters. Start from any existing type. Saved in the world; they appear under "Your shop types".
- Names: random merchant names by race (human, dwarf, elf, gnome, halfling, half-elf, half-orc) and shop names that suit the trade ("The Rusty Loom", "Thatcher's Bows & Arrows"). Roll a name with the dice button, or type your own.
  - Names tab: add your own first names, surnames and shop names; random names use built-in and yours, only yours, or only built-in. Saved in the world.
  - Actor name: "Merchant (Shop)", "Merchant" or "Shop". The token uses the merchant's name; the biography says who they are and what they sell.
  - Image: an optional portrait or token image (file browser button). No portraits are bundled.
- Restock: for selected tokens or a chosen actor, "Replace the old stock and purse" (as before) or "Restock: keep the stock, add more" (about half a new stock, stacked onto matching pieces, and half a purse added).
  - Every merchant remembers its shop type, settlement, traits and prices. A restock uses the merchant's own saved settings unless you untick "Use each merchant's own saved shop, settlement and traits".
- Settlement character (optional, combine any): Port / harbor, Mining town, Frontier / outpost, Trade hub / crossroads, Holy site / temple city, Arcane center, Wealthy, Poor / war-torn, Remote / isolated, Lawless / thieves' haven. They shift what's stocked, how much, the gp limit, prices and the share of unappraised goods. The chat card lists them.
- API: randomMerchant(type, { race, names }), saveCustomType(def), deleteCustomType(key), TRAITS, RACES.

## Version 1

First version. Open it from "Axecleft's Tools" (store icon) or a macro: AxecleftMerchants.open();

- Builds D35E merchants: an NPC on D35E's loot sheet in Merchant mode (sheet D35E.ActorSheetPFNPCLoot, flag lootsheettype "Merchant").
- Shop types: General store, Blacksmith / weaponsmith, Armorer, Alchemist, Jeweler, Art dealer / curio shop, Temple, Scribe / bookseller, Magic shop, Fence / pawnbroker. Each sells a weighted mix of Treasure categories; the window shows which are available and which need another module.
- Stock comes from the same providers as the Treasure Generator: Gemstones (gems, art, jewelry), the D35E items compendium (alchemical items, tools and gear), and later Axecleft's Armory (weapons, armor, shields) and Axecleft's Curios (magic items). Categories without their module are left out and listed in the chat card.
- Settlement: SRD community sizes from Thorp (40 gp limit) to Metropolis (100,000 gp). With "GP limit" ticked, nothing is priced above the limit; untick it for no cap. Magic items are minor in small settlements, minor or medium in towns and small cities, and up to major in large cities and metropolises.
- Different items: a dice formula (blank uses the settlement's, from 1d4+1 for a thorp to 6d6+8 for a metropolis). Identical pieces are stacked.
- Gems, art and jewelry: every piece has its true appraised value set. Most are identified (sold at that value); "Unappraised goods" (default 10%) are left unidentified, which D35E sells at the base value: a bargain or an overpay for the buyer.
- Prices: "Sells at" and "Buys at" set D35E's merchant price modifiers (defaults 100% and 50%, the SRD half price for selling).
- Purse: a dice formula in gp (blank uses the settlement's), paid in the world's coins as set on the Treasure Generator's Coins section (renamed and custom currencies).
- Make: a new merchant (in the "Merchants" Actors folder, linked token, players can browse as Observer), selected tokens, or a chosen actor or token (list or drag and drop). "Replace the current stock and purse" removes weapons, equipment, consumables and loot only; feats, classes and other items are kept.
- A GM chat card lists the stock with prices (and the true value of unappraised pieces).
- API: AxecleftMerchants.open(), generateMerchant(opts), rollStock(opts), registerMerchantType({ key, label, categories, artKind, module }) for other modules to add shop types (for example the Armory adding a Bowyer).
