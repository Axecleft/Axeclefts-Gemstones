# Axecleft's Merchant Generator (shared script) — changelog

File: scripts/axecleft-merchants.js. Ship the same copy in every Axecleft module, listed in module.json "esmodules" after axecleft-tools.js and axecleft-treasure.js (version 9 or later for this version). The highest version runs.

## Axecleft's Shop 1.39

- **GM settings and the item list in a short window** (spotted by Gilgalad). Open, the GM's shop settings take at most half of the sheet and scroll inside their own box, so every setting can be reached without making the window taller, and the item list below stays visible (at least a few rows) without closing the settings first. The settings keep their scroll position when the sheet redraws.

## Axecleft's Shop 1.38

- **Basket: how many?** Shift+click the cart beside an item to choose how many to add to the basket (up to what's in stock), and Shift+click − in the basket to choose how many to take off: a stack of arrows or crossbow bolts in one go. A plain click still adds or takes off one.

## Axecleft's Shop 1.37

- Foundry v11: the shop sheet registers again, so a generated merchant opens on it (and Axecleft's Shop shows in the actor's Sheet choices). Item descriptions on the sheet show their links and rolls on v11 too.

## Axecleft's Shop 1.36

- Tours point at the sheet they opened (not another shop sheet open behind it), and start on the Buy list.
- While a tour runs, its sheet shows an example of the parts it points at that aren't there yet: the haggling buttons and Pick a pocket (when the shop doesn't allow them), a basket, a closed container's lock buttons (on an open one) and an empty log. Their buttons don't work, and they go when the tour ends.

## Axecleft's Shop 1.35

- **Tours** of the shop sheet (Axecleft's Tools 9.7, Foundry 13+). Players: **Axecleft's Shop: buying and selling** (trading as, haggling, Buy and Sell, item descriptions, the basket, sleight of hand) and **Axecleft's Shop: loot and party storage** (locks and traps, coins and splitting, taking items, sneaking things out, the log). GM: **the merchant (GM)** (prices and trade goods, who can trade, haggling, pickpocketing and security, purse, restock, log, the stock, character sheet) and **loot and party storage (GM)** (who opens it, coins, lock, container, trap, opening and closing it). The sheet's ⋮ menu has **Tour of this window**: the GM's tour for a GM, the players' for players, for the kind of sheet open. A tour opens a sheet of its kind when none is open.
- The script's header describes the merchant, loot and party storage sheets and all their saved settings.

## Axecleft's Shop 1.34

- Texts the language files had missed: the eye that hides an item from players (*Hide from players* / *Hidden from players: show*) and a decided pickpocketing card's fallback (*Decided*).

## Axecleft's Shop 1.31: the merchant's log and a basket

- **Item descriptions** (1.32): rest the pointer on an item's name for a pop-up of its description; click the name to keep it open under the item (click again to close). An unidentified item shows players its unidentified description; the GM sees both. On the Buy and Sell lists and in loot.
- The item list keeps its place when the sheet redraws (opening a description, the basket, a trade) instead of jumping back to the top (1.33).
- **Log** (in the shop sheet's GM settings): every sale and purchase, haggle, pickpocketing and shoplifting attempt (rolls and outcome) and lock-out, with the date and time, newest first. Clear it there. Loot piles keep the same log; players see party storage's (not what was sneaked out).
- **Basket**: the cart beside **Buy** adds one at a time (up to what's in stock); the basket above the list shows the total (red when the character can't afford it), takes one off with −, and **Buy all** pays for everything in one go.

## Axecleft's Shop 1.3: loot, party storage, locks and traps

Ships with Merchant Generator 7.96 (same file, `scripts/axecleft-trade.js`).

- **Loot and Party storage**: the same sheet for loot piles and the party's stash. Right-click an NPC actor in the Actors sidebar: **Make it a loot container** or **Make it party storage** (or pick the sheet in its GM settings). Players with Limited or Observer take items and coins, put things in (drop an item on the sheet), and split the coins equally among the party (the GM, or players if allowed); what can't be shared stays. Takes are in chat (everyone, GM only or not shown) and in a log (players see party storage's log).
- **Sneaking things out**: the hand beside **Take** slips an item or coins away without the others knowing. Sleight of Hand against the Spot of the other players' characters; only the GM is told, on a card that can tell those who noticed.
- **Locks** (unlocked unless the GM sets one): lock quality and Open Lock DC (SRD: very simple 20, average 25, good 30, amazing 40), a key (an item by name), *arcane lock* (+10), the container's hardness, hit points and Break DC (SRD small chest 5/1/17, treasure chest 5/15/23). Players use the key, pick the lock (roll, take 10 or 20; thieves' tools −2 without, +2 masterwork), cast *knock* or ring a chime of opening, force it (Strength against the Break DC) or break it (damage less hardness).
- **Traps** (none unless the GM arms one): a simple trap (Search DC, Disable Device DC, a Reflex, Fortitude or Will save and DC, damage, half or none on a save, poison text), or a trap actor from Axecleft's Traps, Poisons, and Diseases (its DCs; its card opens the trap's sheet with the victim targeted). Search finds it (over DC 20 only with trapfinding); Disable Device disarms it, failing by 5 or more sets it off; opening it unaware sets it off. When it goes off, the victim's save and the damage are rolled and the GM applies them.
- **What needs the GM**: keys, picking the lock, *knock*, opening, searching and disabling go ahead on their own, and the GM is told. Forcing, breaking (noise, damage) and a trap going off come to the GM on a card.
- D35E's **valuable** items are sold, bought and looted like goods.

## Version 7.96

- **Items by Shop tag** (Shop Types tab; suggested by Gilgalad): a shop type can sell the items in your item sources that carry a Shop tag, whatever kind of item they are, each tag with its own share of the stock like a category. Tags of your own work too: tag your statues `Shop: Statue` on the Shop Tags tab and make a statue carver that sells them. The tags found in your item sources are listed. A shop type can now sell only by tag.
- **Only gems named / Only art objects named** (Shop Types tab): keep a shop's gems or art objects to those whose names contain one of your words (in English or the world's language): *diamond* for a diamond merchant (every diamond, in every size and quality), *statue, idol* for a sculptor. Gems and art come from Axecleft's Gemstones.
- The Shop Tags help explains tags of your own, and the Shop Types tour has steps for the new rows.
- **Security** (a new section on the Merchant tab, under Settlement character; needs Axecleft's Shop 1.21): how well the shop is protected against pickpocketing and shoplifting. Tick any that fit; their changes add up:
  - Careless / distracted: the merchant's Spot −4, DCs −2. Crowded / busy: Spot −2.
  - Watchful owner: Spot +4. Guards on duty: Spot +5. Guard animal: Spot +3.
  - Goods locked away: shoplifting DC +10. Coin kept secure: pickpocketing DC +5.
  - Magically warded: Spot +10 against shoplifting.
- Saved with the merchant (a restock with its saved settings keeps it), shown in the generator's chat summary, and editable on the shop sheet's GM settings. The GM's pickpocketing card shows the DC and Spot with the security's share and lists what applied.
- The new-merchant hint describes Axecleft's Shop sheet when it's loaded.
- **Character sheet** (GM, top right of the shop sheet): opens the merchant on D35E's own NPC sheet (stats, skills, saves, attacks) beside the shop, which stays its sheet.

## Version 7.95

- **Axecleft's Shop sheet** (new shared script `scripts/axecleft-trade.js`, version 1.3, listed after this one; the module needs `"socket": true`). New and converted merchants get Axecleft's own merchant sheet instead of D35E's loot sheet:
  - Players need only **Limited** or **Observer** on the merchant (never Owner). Every purchase and sale goes to the GM's game, which checks it and moves the coins and items; without a GM connected, nothing can be traded.
  - A player trades as their assigned character, or any character they own (chosen on the sheet).
  - **Buying**: the price is the item's value × the shop's sell % (unappraised goods at their base value); the character pays with the biggest coins that fit and gets change; the merchant's purse gets the money. Partial stacks work.
  - **Trade goods** (gems, art and jewelry with D35E's Full Resale Price) have their own sell and buy %: the world's house rule in the module settings (**Trade goods: merchants sell at / buy at**, SRD 100%), or a shop's own on its sheet.
  - **Selling**: the shop's buy % (trade goods at the trade goods %), paid from the merchant's purse: a merchant can't buy what it can't afford. Drop an item from your character onto the sheet to sell it.
  - **Haggling** (a GM toggle, with the skills the GM allows: Diplomacy, Intimidate, Bluff): the player rolls; the GM approves, changes or refuses the suggested price change (2% for every 5 points over 10, up to 10%), which lasts for that character until reset or a restock.
  - The GM's settings on the sheet: sell and buy %, open to all players or those set in Ownership, trades in chat (everyone, GM only, not shown), the purse, hidden items, quantities, Restock and the Merchant Generator.
  - **Pickpocketing and shoplifting** (world setting **Pickpocketing and shoplifting**, on by default; each shop can turn it off): a player picks a merchant's pockets from its sheet, shoplifts an item from its stock (the hand beside **Buy**), or picks anyone's pockets from the token controls (the hand button, on the token they target). They roll Sleight of Hand (SRD: DC 20 to lift something from a person; shoplifting DC 10 for 1 lb or less, 20 for more); the target's Spot is rolled against it. Nobody else sees anything: the GM gets a card in chat with the rolls and a suggested outcome, picks what's taken (a handful of coins or a small item, suggested), and decides. The card also has a **time-out** for the player (no more attempts for 10 minutes to a day), a **lock-out** from the shop (it won't trade with that character until the GM lets them back, also on the sheet) and a box to post the target's reaction (to everyone, or to the player only). Characters a player owns can't be robbed; unowned character actors (an NPC with a familiar, say) can.
  - The sheet uses D35E's parchment, like its own actor sheets.
  - A haggle that goes against the character reads "worse prices".
  - Merchants made before keep working: the sheet reads their saved sell and buy %. Pick **Axecleft's Shop** in an actor's sheet settings to switch one by hand.

## Version 7.94

- **Tours** (Axecleft's Tools 9.7, Foundry 13+): the Merchant, Shop Types, People, Item Sources and Shop Tags tabs each have a tour in Configure Settings → Tour Management and in the window's ⋮ menu (**Tour of this tab**).

## Version 7.93

- Item Sources: the explanation says merchants and treasure take items from your Item compendiums where no module covers a kind, and otherwise by the share set in Generation settings (Your item compendiums). Needs the Treasure Generator 9.994.

## Version 7.92

- Number boxes in the Merchant Generator show their value against the right edge.

## Version 7.91

- **Item Sources**: each source list (Enhancements, Special materials, Spells, Psionic powers…) shows the items found in every compendium it uses, next to the compendium, as the Item compendiums list does. Its heading reads "n of m used", like the Item compendiums heading.

## Version 7.9

- **Foundry v11**: the Merchant Generator window and its dialogs work on Foundry v11 (with Axecleft's Tools 9).

## Version 7.8

- **Shop words have their own lines** in the word files (Shop: Anvil, Shop: Shadow…): a translator can give a shop word a different form from the same English word in item names ("Shadow" is an armor ability and a shop noun). Older word files without those lines still work (the plain word is used). English shop names are unchanged.

## Version 7.7

- **Shop names in the world's language** (Axecleft's Tools 8.4): the name patterns ("The {adj} {noun}", "{last}'s {trade}"…) are translated in lang/<code>.json, and the adjectives, nouns and trades in lang/<code>.words.json with their genders, so they agree ("L'Enclume dorée", "Le Marteau doré"). English shop names are unchanged.

## Version 7.6

- **Text in the world's language** (Axecleft's Tools 8.2 language files): the Merchant Generator's tabs, chat cards and messages, settlement, shop-type, settlement-character, race and sex labels, and the merchant's biography line. Shop names and personal names still come from the English lists until the per-language word files. Shop tags are still written in English (Shop: Scroll) so every world reads them. Item Sources' automatic choices for extra kinds (enhancements, materials) also match English compendium labels.

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
