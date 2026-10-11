# Axecleft's Gemstones
3.5 SRD gemstones for the D35E system, plus a Treasure Generator for gems, art objects and jewelry.

Changelog:

v1.14.6

- Added module update support.

v1.14.5.5:

- Ships the Treasure Generator 9.92: in worlds with Babele-translated compendiums, items are sorted and priced by their English names.
- Axecleft's Tools 8: in a world not in English, naming or renaming an item asks for its English name (optional; Skip / Don't ask again), and item sheets get an "English name" button, so items made in your language are recognized by the treasure, merchant and crafting tools.

v1.14.5.4:

- Ships the Merchant Generator 7.5: epic stock in Epic campaign settlements of any size (about 1 magic item in 10, past the gp limit).

v1.14.5.3:

- Ships the Treasure Generator 9.91 (epic scrolls among the epic extra items at EL 21+).

v1.14.5.2:

- Ships the Treasure Generator 9.9: encounter levels 21–30 (the EL 20 row plus extra major items, DMG), and a share of epic items among them while Epic items is on (house rule, default 25%).

v1.14.5.1:

- Ships the Treasure Generator 9.8: trap loot (incidental loot for trap tokens, ¼ to 1× by CR) and a fix for rolling loot by hand while Automatic loot is on.

v1.14.5:

Brings Gemstones up to date with Axecleft's shared tools (Treasure Generator 9.7, Merchant Generator 7.4, Axecleft's Tools 7), the same copies Axecleft's Armory and Curios ship. The newest copy of each runs, so every module now runs the same version.

- Your own lists moved to the shared Treasure Generator: the four Gemstones lists (Custom Gems, Custom Art & Jewelry, Custom Materials, Custom Embellishment Gems) keep their page names and columns in the "Axecleft's Treasure Lists" journal and library file, alongside every other Axecleft module's lists. Existing journals and library files are migrated by the GM on first load. The Disabled Entries page is now "Disabled Entries (Axecleft's Gemstones)".
- Macro API: game.modules.get("axecleft-gemstones").api.lists has customList(key), rows(key), disabled(), addRow(key, row) and removeRow(key, name).
- Token Loot tab (and a sack-of-coins button on the token toolbar): each selected NPC token gets its own SRD treasure at its Challenge Rating, scaled by the Treasure setting on its NPC sheet, straight into its inventory and purse. Clear Loot takes it back out. Optional: roll loot automatically when an unlinked NPC token is placed on a scene.
- Merchant Generator (Axecleft's Tools group): shops for any settlement size, stocked by the SRD and by every active Axecleft module. Gem and art goods come from Gemstones.
- Item Sources tab: choose which item compendiums treasure and merchants draw from; price corrections for compendium items with wrong prices.
- Generation settings (Treasure by Level tab): light, intelligence, inscriptions, sizes of arms and poisons for generated items, and the campaign switches Psionics and Epic items shared by every Axecleft module.
- Lists with suggestions (gem names, list names) now scroll and stay on screen.
- Weapons, armor and shields now come from Axecleft's Armory and potions, rings, rods, scrolls, staffs, wands and wondrous items from Axecleft's Curios when those are active.
- scripts/treasure-lists.js is no longer used (the shared script keeps the lists). Delete it, and the backup-v8 folder, from an existing install.
- Full details: TREASURE-GENERATOR-CHANGELOG.md and MERCHANT-GENERATOR-CHANGELOG.md.

v1.14.4:

Added the Treasure Generator (GM only): gems, art objects, jewelry and the full SRD Treasure table by encounter level.

- The Treasure Generator is shared by all of Axecleft's treasure modules (Gemstones now; Armory and Curios to come). Each module ships a copy (scripts/axecleft-treasure.js) and the newest copy runs, so the generator works as long as any one of them is active. Each module adds its own tabs.

- Open it from the "Axecleft's Tools" group (gem icon) on the left toolbar, the "Treasure" button at the top of the Items sidebar, or a macro:
  game.modules.get("axecleft-gemstones").api.open();
- Nothing is stored as finished items. Each piece is built when you generate it from small lists, so the module can offer far more combinations than it could ever hold as compendium items.
- Every choice is a dropdown with a "Random" option. Set the ones you care about and the rest are rolled.
- Generated items work like the compendium gems: they start unidentified at their base value, and the true value is a creation change that D35E rolls when the item is added to a character. Players see the base value until the item is appraised (identified).
- A GM-only chat card always lists what was made, with links.

Put items in (shared by every tab)

- Selected tokens: each selected token gets its own roll, straight into its inventory. Load an encounter with loot, then convert a defeated creature to a D35E loot sheet so the players can loot it. An unlinked token keeps its loot on that one creature.
- A chosen actor or token: pick any actor, or any token on the current scene, from the list, or drag an actor from the Actors sidebar onto the window (a treasure chest, a merchant, a loot pile).
- Items placed on an actor or token have their true (homebrew) value rolled at once, since there is no drag and drop to trigger the creation change. Players still see only the base value until the item is identified.
- Items sidebar: the "Generated Treasure" folder. These keep the creation change, so the value is rolled when the item is dropped on a character.
- Chat card only: a GM chat card with a "Create Item" button for each piece.

Gems tab

- 505 gem types: the 67 SRD gems and the 438 homebrew gems, with the same descriptions and images as the compendiums, plus any gems you add yourself.
- Choose the lists (SRD, Homebrew, Custom), the base value (or Random at SRD odds), the gem, the size (Tiny to Huge) and the quality (Flawed to Exceptional).
- Sizes and qualities use the same multipliers and 5/15/60/15/5 odds as the roll tables. Identified gems show the multiplier table with their own size and quality marked.
- A checkbox (and a module setting) turns the homebrew size and quality variations off for plain SRD-value gems.

Art Objects and Jewelry tabs

- Built from your art object list: 221 objects (186 art objects, 35 jewelry pieces), 120 materials (metals, woods, non-woods, cloth and hide), and 30 embellishment gems.
- Value uses the 12 SRD art object values (1d10 x 10 gp up to 2d6 x 1,000 gp), Random at SRD odds.
- Each object is Molded, Carved, Clothing or Book, which decides its materials: a chalice is cast in metal, a statuette is carved from wood or bone, a cloak is made of cloth or fur, a book is bound in leather or silk.
- Every material has a value range, so random rolls keep lead and pine at low values and mithral, dragon scale and unicorn hide at high ones. You can still pick any material yourself.
- Gem embellishments ("set with ruby", "inlaid with jade") become more likely at higher values and are more common on jewelry.
- New homebrew workmanship qualities: Junk (x0.25), Common (x0.5), Average (x1), Fine (x2.5), Masterpiece (x5), with the same 5/15/60/15/5 odds. A checkbox (and a module setting) turns them off.
- Example: "Fine, Hammered Gold Chalice set with Garnet". Before appraisal it reads "Hammered Gold Chalice set with Garnet" at the SRD base value.

Treasure by Level tab

- Rolls the SRD Treasure table for encounter levels 1 to 20: coins, goods (gems and art) and items (mundane, minor, medium and major), as many times as you like. Tick Coins, Goods and Items to choose which parts to roll.
- Coins go straight into the purse of the selected tokens or chosen actor (or are listed in the chat card otherwise).
- Gems and art come from this module, using the options on the Gems and Art Objects tabs.
- Mundane alchemical items and tools and gear come from the D35E items compendium, with the SRD quantities (for example 1d4 flasks of alchemist's fire).
- Weapons, armor and shields (masterwork and magic) will come from Axecleft's Armory, and potions, rings, rods, scrolls, staffs, wands and wondrous items from Axecleft's Curios. Until those are installed, those results are listed in the chat card in italics (for example "Minor potion, needs Axecleft's Curios") so you can roll or pick them yourself.
- The tab shows which module supplies each part.

Your own lists (Lists tab)

- Add gem types, art and jewelry objects, materials and embellishment gems, or switch off built-in entries you don't want (Disabled Entries).
- They live in a world journal, "Axecleft's Treasure Lists", as plain tables you can edit like any journal page. The Lists tab can also add entries for you.
- Every change is also saved to a shared library file in your Foundry Data folder, Data/axecleft-treasure/treasure-lists.json. Module updates never touch it, and every world on your Foundry server loads it at start-up, so your lists survive updates and follow you from world to world. Loading only adds missing entries; it never deletes anything from a world.
- Export and Import move the lists to a different Foundry server.
- Module settings: turn the automatic library sync off, or change the library folder.

Other changes

- Added the shared "Axecleft's Tools" toolbar group (scripts/axecleft-tools.js), shared with Axecleft's other modules.
- The module now declares that it requires the D35E system.
- Fixed spelling in the art lists: Altar Slab, Choker, Flagon, Salt Cellar, Shawl, Dowsing Rod, Adamantine, Cinnabar Steel, Orichalcum, Mithral, Turquoise, Poplar Wood, Cypress Wood, Rosewood, Ironwood, Cockatrice Feathers, Gorgon Horn, Abyssal Chromium, Woven Frog's Hair, Cuttlebone, Spider Silk.
- Removed the 25 pre-generated homebrew compendiums (10,950 items) and the 335 homebrew roll tables that rolled them. The Treasure Generator builds any of those gems, in any size and quality, on demand. The module download shrinks from about 78 MB to 13 MB. Items already in your worlds are not affected.
- Kept the 6 SRD gem compendiums and the 80 SRD roll tables (SRD Generation, gems by base value, and Goods by encounter level).
- Updated the Documentation journal: a new Treasure Generator page; the generation pages now link only the SRD tables and point to the generator for homebrew gems.
- The size and quality multiplier table in gem descriptions now has the Average and Standard labels the right way round.
- Other Axecleft modules can add their own tabs and buttons to the Treasure Generator, use its "Put items in" choices, and supply items for the Treasure by Level tab. See "For module authors" below.

For module authors (other Axecleft modules)

1. Copy scripts/axecleft-tools.js and scripts/axecleft-treasure.js into your module's scripts folder.
2. In module.json, list them first, in this order:

       "esmodules": [
         "scripts/axecleft-tools.js",
         "scripts/axecleft-treasure.js",
         "scripts/your-module.js"
       ]

3. In your script, register at load time:

       const T = globalThis.AxecleftTreasure;

       // A tab in the generator (shown while your module is active)
       T.registerTab({
         module: "axecleft-armory", name: "weapons", title: "Weapons", icon: "fas fa-khanda",
         order: 40,                                               // Gems 10, Art 20, Jewelry 30, Treasure by Level 500, Token Loot 510, Lists 1000
         prepare: async (app) => {},                              // optional: load data before the tab is drawn
         content: (app) => `<div class="form-group">...</div>`,   // the tab's form fields (HTML)
         wire: (section, app) => {},                              // optional: add listeners
         generate: async (form, { actor }) => ({                  // called once per target actor; leave out for a tab with no Generate button
           entries: [{ name, data, summary }],                    // data = D35E Item data
           note: "",                                              // optional chat text
         }),
       });

       // A button above the tabs
       T.registerButton({ module: "axecleft-armory", name: "forge", title: "Weapon Forge", icon: "fas fa-hammer", hint: "", onClick: () => {} });

       // Items for the Treasure by Level tab
       T.registerProvider({
         module: "axecleft-armory", name: "arms", label: "Axecleft's Armory",
         categories: ["mundane:weapon", "mundane:armor", "magic:weapon", "magic:armor"],
         roll: async ({ category, grade, level, actor, form }) => [{ name, data, summary }],   // grade: "minor" | "medium" | "major" | null
       });

   Categories: gem, art, mundane:alchemical, mundane:armor, mundane:weapon, mundane:gear, magic:armor, magic:weapon, magic:potion, magic:ring, magic:rod, magic:scroll, magic:staff, magic:wand, magic:wondrous. A module's provider replaces the built-in one for the same category.

The generator places the entries where the GM chose. Creation changes in the item data are rolled when the item goes on an actor or token, and left for D35E otherwise. When you change axecleft-treasure.js, raise AXECLEFT_TREASURE_VERSION and ship the new copy in every module; keep the _onInit, _onChat and _onItemDirectory method names, because older copies' hooks call them.

v1.14.3 and earlier:

I have gathered a collection of the gemstones included with the Dungeons and Dragons 3.5 SRD system.

This collection contains the original SRD gemstones in the original form included in the SRD compendiums, separated by their base value.
These gemstones are created to be generic, un-appraised versions in the compendium. When you add them to a character/NPC sheet they will be randomly assigned a appraised value based on the SRD rules with the ID tag turned off. This will display the true value to the GM but leave the base value and description displayed on character sheets until they are appraised.

V1.14.2 provides a major upgrade.
I added a separate, homebrewed system for gemstones. This includes new types, fossil specimines, color variations of most SRD types, metal nuggets, and non-SRD minerals.
Also supported is a homebrew system that creates 5 size categories as well as 5 size variations per type. These variations alter the value of the stone based on size and quality during the generation process. As with the SRD gemstone set, the gems remain un-appraised in the inventory until the players deal with it.

The new homebrew gemstones include AI generated descriptions for the base types and Appraised/IDed specimens. There are also homebrew versions of all the original SRD gems, with size/quality variations and AI descriptions.

With the homebrew rules expanding the base list from 150=/- gemstones to almost 11,0000 types and variations, I included a set of roll tables to help with generating random examples from the compendiums.

*Also of note for anyone not wanting to use the size and quality feature I created a roll table that will only generate using the Standard(size)/Average(quality) specimens, This will allow you to generate from the full list without the value variations, This does still include the AI generated descriptions and the expanded specimens. 
I intentionally removed the the Average and Standard tags from the name of identified gemstones to support the generation of gemstones without the expanded values
