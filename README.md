# PocketPal

A pocket virtual pet in the style of Tamagotchi and Digimon. You raise a little pixel animal inside a pink handheld with a green LCD screen. Hatch it, feed it, clean up after it, put it to bed and teach it some manners. How well you look after it decides which of three adult forms it grows into. Adults battle, level up, learn skills and have eggs of their own.

This is **version 1.9.0**. It brings an **easier start**: a pal's first day is twice as forgiving, and short tips guide new players. There are **music jingles**, and the home screen has a **background that changes from dawn to night**, with rain and snow on some days. You get **3 daily goals** with coin rewards and streaks, rare **lucky days, visitors and golden eggs**, and **seasonal shells**. **Hard mode** is optional and for experts (no revives). **Backups** come with a gentle reminder, and an optional **end-to-end encrypted cloud save** runs on your own worker. The lion is redesigned, the eyes are round and the dotted lines are gone from the sprites. 1.8.4: lions have a **round eye** with a proper pupil, and every eye passes an automated check. Lifted and moving legs are complete in every pose; the wolf now scratches like a dog, with a hind leg. The home **status strip** has two rows: energy pips, discipline, weight, and icons for sick, poop, calls and sleep. Battles have **Run** (quick battles) and **Forfeit** (arena and friends). Each arena cup is now a run of 3 foes (a challenger, a rival and a boss), and there is a post-game **Myth Cup**. A cup gets a star only when you have really won it. Friend battle codes were tested end to end on two profiles. 1.8.3: a tired pal now **shows** it instead of opening a menu. Under 30 energy it gets droopy eyes, yawns and nods off, and a **Zz** shows in the top strip; if you pick a game, training or a battle without enough energy it shakes its head and yawns ("TOO TIRED..."). Lion heads are shorter and rounder, like a real big cat. **Match** cards show clear open-eyed poses at full pixel size. Stray pixels are gone from every sprite. Deploying is explained step by step in `DEPLOY.md`. 1.8.2: baby, child and teen faces now look forward (the eye sits toward the snout or beak, with clearer mouths), **Match** is a real memory game (8 cards shown for 1.8 s, then find the 4 pairs), naps recover energy twice as fast and training is cheaper. 1.8.1 made **Memory** a look-left / look-right sequence game and turned maned lions' faces forward. 1.8.0 was a full end-to-end audit of 1.7.6: side-view eyes fit every head again, the Memory game can be finished, well-fed pals no longer slowly turn "Heavy", praise can't be farmed, the battle AI uses every move, all six animals are balanced, and the admin password is no longer stored as plain text (see `CHANGELOG.md`). `DESIGN.md` explains every system and every number.

- 6 animals: croc, lion, eagle, elephant, bear, wolf
- 5 life stages: egg → baby → child → teen → adult (about 4 days)
- 18 adults, each with its own name and look: a Scrappy, a Solid and a Champion form per animal
- Turn-based battles on the LCD, with each animal's own moves, a 12-cup computer arena (3 foes a cup: challenger, rival, boss) plus a post-game Myth Cup, friend battles through a shareable code, and Run / Forfeit
- A skill tree for each animal, and breeding with a family tree (grandparents included)
- 14 shell colours, a Paldex of all 36 stages and forms, and a Pal Store with coins, treats, boosts and extra Pal Box slots
- **New in 1.0:**
  - **All-new pixel art.** Every animal has its own body plan at every stage: a slender, maned lion (spotted cubs), a heavy humped bear, a lean long-snouted wolf, a low toothy croc, a hook-beaked eagle and a trunked, tusked elephant. Their eyes look around, blink properly and show how they feel: happy, sad, angry, sick, sleepy or surprised. Each species has its own habit, too: the lion shakes its mane, the wolf howls, the bear sits and scratches, the croc snaps, the eagle stretches and preens, and the elephant swings its trunk and sprays.
  - **Sleep schedules.** Each pal has its own bedtime and wake time, which you can change within healthy limits for its age.
  - **12- or 24-hour clock**, picked from your browser's language and switchable in Settings.
  - **Status strip** on the home screen, in two rows: hunger and happiness hearts, energy pips, the stage and age; then discipline, weight and only the icons that apply right now (sick, poop count, a call, asleep or night, tired).
- **New in 1.9.0:**
  - **First-day grace and tips.** A pal's first 24 hours are twice as forgiving, and a small hint bar teaches the basics to eggs, babies and children. Settings ▸ Tips turns it off; **Show tips again** brings it back.
  - **Music.** Chiptune jingles for hatching, growing up, wins, cups, goals and rare events. Turn them off in Settings ▸ Music.
  - **Home scene.** Dawn, day, dusk and night follow the game clock, with hills, clouds, stars, the moon, and some rainy or snowy days. It stays still with "reduced motion".
  - **Daily goals** (Main menu ▸ Daily goals). You get 3 goals a day, +5 coins each, and +10 for all three plus a streak bonus. There are rare **Lucky coin days** (double coins), **Visitors** to battle once for +25 coins, and very rarely a **Golden egg** (which unlocks the Gilded shell). **Seasonal shells:** Spooky (Oct), Frost (Dec–Jan) and Blossom (Mar–May, Sep–Nov). Finish all three goals on 3 days of the season to earn one. Turning the clock back can't farm them.
  - **Hard mode** (optional, new eggs only, with a warning first). A hard-mode pal dies after 12 awake hours starving or 24 hours sick, and runs away after 6 mistakes in a day. It has no first-day grace and **can't be revived**. It earns 25 % more coins. Lost hard-mode pals are remembered in the Album, the family tree and the Paldex.
  - **Backups.** After 7 days without a backup, the game offers a .json download or a save code. **Cloud save** (Settings ▸ Cloud save) is opt-in. Your save is encrypted on your device with a recovery code (and an optional passphrase) before it goes to the worker, so the server never sees your pals.
- Works offline, installs to your phone, and has no build step

## Play it

**Double-click `index.html`.** That's it. The game runs straight from the file (`file://`) in any modern browser, and there is nothing to install or build.

To install it on a phone as an app, put the folder on any static web host (https). Open it in the phone's browser and choose *Add to Home Screen* / *Install app*. When served over http(s), the service worker caches everything so it keeps working offline.

### Hosting it yourself

The release zip holds only the files players need. Unzip it and upload the folder as-is to any static host. There is no build step and no server code. The source zip (`pocketpal-1.9.0-source.zip`) also has `DESIGN.md`, the tests, the tools and the sprite generator.

- **GitHub Pages:** push the folder to a repo, then turn on *Settings → Pages* for the branch.
- **Netlify / Cloudflare Pages / Vercel:** drag and drop the folder, or point the site at the repo with no build command and the folder as the output directory.
- **Any web server:** copy the files into a directory. It works under a sub-path (for example `https://example.com/games/pocketpal2/`) because every path is relative.

**Link previews (og:image).** Chat apps and social sites (Discord, iMessage, Slack, X, Facebook) only show the preview picture if `og:image` is a full URL. The shipped `index.html` uses a relative `icon-512.png`, because the real address isn't known until you host it. Once you know it, make it absolute in one of two ways:

- From the source zip: `node tools/set-site-url.js https://example.com/games/pocketpal2/ path/to/unzipped/release`. This sets `og:image` and `twitter:image` to `https://example.com/games/pocketpal2/icon-512.png` and adds `og:url`. You can run it again with a new address.
- By hand: in `index.html`, change `content="icon-512.png"` in the `og:image` and `twitter:image` lines to the full address of `icon-512.png` on your site.

The game itself works either way.

Serve it over **https** so the offline cache and *Install app* work (plain `http://localhost` is fine for testing). When you upload a new version, players see a **"New version ready — tap to update"** button. The game only switches when they tap it, so nobody is swapped out mid-game. The optional `cloudflare-worker.js` is not needed for any of this (see *Optional server* below).

### Controls

| | Button | Keyboard |
|---|---|---|
| Next icon / next menu item | **A** | `A`, `→`, `↓` (`←` `↑` go back one) |
| Choose | **B** | `S`, `Enter`, `Space` |
| Back / cancel | **C** | `D`, `Esc` |

You can also just **tap** the icons, the menu items and the battle moves. **MENU** (top right of the shell) opens the main menu, and **♪** turns the sound on or off.

### The eight icons

| Icon | What it does |
|---|---|
| 📊 Status | Main menu: Status, Skills, Paldex, Shell colour, Pal Store, Bag, Pal Box, Breeding, Album, Settings, Guide, How to play |
| 🍖 Feed | **Meal** (hunger +1) or **Snack** (happy +1, but more than 3 in 3 hours is a care mistake). Food you bought in the store shows up here too |
| 🏋 Train | **Power Training** (stop the marker in the zone: discipline, happiness, and XP for adults), **Left or Right?** (watch which way your pal's eyes look), **Memory** (your pal looks left or right in a sequence; repeat it with A = ◀ left and B = ▶ right, or tap the left / right half of the screen, or the arrow keys; 3, then 4, then 5 looks; one wrong look ends it), **Match** (all 8 cards show for 1.8 s, then find the 4 pose pairs before the 3rd miss) or **Training dummy** (Power Training that shows off every move your adult has unlocked). A tired pal (droopy eyes, **Zz** in the top strip) shakes its head when it does not have enough energy: switch the lights off for a quick nap, or feed it |
| 🧹 Clean | Cleans up the poop |
| ➕ Medicine | Cures sickness. Babies and children need 1 dose; teens and adults need 2. A bought Super Medicine cures in one dose |
| 💡 Lights | Turn them off when your pal falls asleep |
| ⚔ Battle | Arena, friend battles, your battle code, adding friend codes |
| 📢 Discipline | **Scold** a **tantrum** (a call for no reason), or **Praise** a good deed: a won training, or politely refusing food when full (praise within 30 minutes; a refusal counts once an hour). Empty praise spoils it a little |

### The home screen

- **Top bar:** the time (12- or 24-hour) and the pal's name.
- **Status strip** just below it, in two rows:
  - Row 1: 4 hearts for hunger and 4 for happiness; a **bolt and 4 pips** for energy (25 energy each, blinking when your pal is tired); the stage and age on the right, for example `Teen 2d`
  - Row 2: a **flag and bar** for discipline (0-100 %); the **weight** mark: a thin bar when underweight, a ring when fine, a full ball when heavy
  - Then only what applies right now: a **skull** when sick, a **poop** and count (flashing at 2 or more), a flashing **!** when your pal calls, **ZZ** while it sleeps (or a moon at night), **Zz** when tired
- **Bottom line:** hints and short messages, kept clear of the rounded screen edge on every phone size.

### Sleep schedule and clock

Every pal has a **sleep schedule**. When it hatches it gets the default for its age, for example 21:00–08:00 for a teen. Change it in **Settings → Sleep schedule** or **Status → Sleep schedule**: move the bedtime and wake time in 30-minute steps (switch **Step** to 15 minutes for finer changes). You can't pick an unhealthy schedule:

| Stage | Sleep length allowed |
|---|---|
| Baby | 11–15 hours |
| Child | 10–14 hours |
| Teen | 9–13 hours |
| Adult | 8–12 hours |

- **Overnight schedules** such as 22:00–07:00 work as you'd expect.
- **When your pal grows up**, its schedule is nudged into the new stage's limits, and you're told the new times.
- **Grace period:** changing the schedule restarts the lights-off grace period. Moving bedtime earlier, so your pal falls asleep straight away, never causes an instant care mistake.
- **Clock changes:** if the device clock jumps back (daylight saving or a manual change), your pal re-syncs instead of getting care mistakes.

**Settings → Clock** switches between 12-hour (`9:30 pm`) and 24-hour (`21:30`) time. The first time you play it follows your browser's language. The choice is used everywhere: the top bar, schedules, the care report and "While you were away".

### When your pal calls

- A flashing **!** appears in the status strip (row 2) on the LCD.
- A little speech bubble shows **what** your pal wants (food, play, medicine, lights, cleaning or a scolding).
- The matching icon glows.
- The handheld beeps when a new need appears (if sound is on), then again every 5 minutes while it's still waiting.
- **Daily goals:** Main menu ▸ **Daily goals** shows today's 3 goals, your streak, any rare event (lucky day, visitor, golden egg) and your progress towards the seasonal shells. Goals start once your egg has hatched.
- **Hard mode:** pick it in the egg picker (**Mode: Normal / HARD**) or in Settings. It only affects new eggs. A **HARD** badge shows on the screen.
- **Backups and cloud save:** Settings ▸ **Backup** downloads a .json file or copies a save code (**Load from a file** / **Paste a code** reads it back). Settings ▸ **Cloud save** turns on an encrypted copy on the worker. Write down the recovery code it shows: you need it to **Restore** on another device. Without it, nobody can open the copy.
- **Care alerts (optional):** the **bell** next to MENU (or **Settings → Care alerts**) turns on closed-app pings. They need the game on https and the owner's Cloudflare worker (see `DEPLOY.md`). It's off until you turn it on, and it asks your browser for permission first. Without the worker, the game still beeps while it is open.

### Battles and the arena

Adults battle from the **⚔** icon. Pick a move each turn, or press **C** / AUTO to let your pal fight on its own.

- **Run / Forfeit:** the last button in the move menu.
  - In a quick (sparring) battle it says **Run** with your chance: always 100% when your pal is faster, otherwise 50–75%. A failed run loses the turn.
  - In the arena or a friend battle it says **Forfeit**. It asks first, and it counts as a loss. In the arena it also ends your cup run, but your pal is never hurt.
  - Either way: no XP or coins, and half the battle energy comes back.
- **Arena:** 12 cups, from Sprout (Lv 1) to Legend (Lv 38), plus the post-game **Myth Cup** once you are Arena Champion. Each cup is a **run of 3 foes**: a challenger, a rival trainer and the cup boss. Beat them in a row; you can rest between fights. A loss or a forfeit ends the run.
  - The arena list shows each cup as LOCK, OPEN, your place in a run, or ★ when cleared, with your best run and your wins and losses.
  - The cup screen lists its foes with a ✓ for each one you've beaten, plus their animal, form and level.
  - Clearing a cup for the first time opens the next one, pays a coin bonus, and your pal does a victory dance.
- **Friend battles:** **My battle code** gives you a code to send. A friend adds it with **Add friend code** and can then battle (or breed with) your pal on their own device, offline. Edited codes are rejected, and so are codes from a newer version of the game.

### Your first visit

A short guide pops up the first time you play: what the three buttons do, what each icon means and what you're aiming for. Skip it any time, and reopen it later from **MENU → Guide**.

### Shell colours

Open **MENU → Shell colour** to repaint the handheld. You see a live preview as you move through the list, and your choice is saved.

- **10 colours are free** from the start: Bubblegum, Cherry, Tangerine, Sunshine, Lime Pop, Lagoon, Ocean, Grape, Midnight, Snow.
- **4 plain colours can be bought** in the Pal Store: Mint, Coral, Navy, Lavender.
- **4 special finishes are earned, never sold:**
  - **Silver:** win arena cup 4
  - **Crystal:** raise 6 different adult forms
  - **Glitter:** raise 12 different adult forms
  - **Gold:** become Arena Champion

### Paldex

**MENU → Paldex** keeps a record of every stage and adult form you have raised: 6 animals × (baby, child, teen, Scrappy, Solid, Champion) = 36 entries. Adults you have only *seen*, for example on a friend's battle card, show as "seen". Undiscovered entries are "???" but still tell you how to get them.

### Coins and the Pal Store

You earn coins by playing:

| How | Coins |
|---|---|
| Win a battle | 4 + opponent level ÷ 3 (Lv1: 4, Lv15: 9, Lv38: 16), plus an arena bonus (+2 for cup 1 up to +13 for cup 12, +14 in the Myth Cup) for every foe |
| Lose a battle | 1 |
| Win or lose a training game | 3 or 1 |
| First visit each day | 10, growing to 18 with a 5-day streak, +5 if there were no new care mistakes |
| First clear of an arena cup (beating its boss) | 20 for cup 1, up to 75 for cup 12. Becoming Champion (all 12 cups) adds another 100. The Myth Cup pays 80 + 120 |
| Run away / forfeit | Nothing (no XP either); half the battle energy comes back |

Battle and training coins are capped at 150 per game day. The bonuses above don't count toward the cap.

**MENU → Pal Store** sells:

- **Food & care:**
  - Berry Cake (8c): counts as a snack, so watch the overfeeding rule
  - Deluxe Feast (12c)
  - Energy Tonic (10c)
  - Super Medicine (15c): a one-dose cure
- **Boosts (40c each):**
  - Protein (ATK), Iron Tonic (DEF), Swift Feather (SPD), Vitamins (HP): each gives +2% to that stat for good
  - A pal can take at most 2 of each and 4 in total, so a pal can gain at most +4% on a stat
  - Boosts never change which adult form a pal becomes
- **Shell colours:** Mint, Coral (60c), Navy, Lavender (80c).
- **Pal Box slots:** you start with 4 slots and can buy one more at a time, up to 12. Prices go up with each one: 100, 150, 200, 275, 350, 450, 575, 700 coins.

What you buy goes into your **Bag**. Food shows up in the Feed menu, Super Medicine in the Medicine menu, and you can use anything from **MENU → Bag**. **Basic care (meals, snacks, medicine, cleaning) is always free**, so a pal can never suffer because you're short on coins.

### Moving your save to another device

**Settings → Save transfer → Export save code** gives you a single line of text (`PP2SAVE-1-…`) holding your whole game. Copy it however you like (message, email, notes). On the other device, choose **Import save code** and paste it in. The game checks the code for damage and shows what's inside before replacing anything. It also keeps a backup of the old save.

### How to raise a Champion

- Answer calls within **30 minutes**. An ignored call is a *care mistake*.
- Clean poop within 2 hours, and treat sickness within 3 hours.
- Switch the lights off within 1 hour of bedtime.
- Keep hunger and happiness up. Your pal's average mood while growing up counts towards its adult form.
- Scold tantrums (+25% discipline), and do Power Training (+3% discipline when you win). Praise a won training or a polite "I'm full" (+12%).
- Champion needs **2 or fewer care mistakes**, a care score of 90 or more, and discipline of 50% or more. Solid needs a score of 60 or more. Anything worse gives the Scrappy form.

You can check **Status → page 2** at any time to see the care score and which form your pal is on track for.

Your pal keeps living while the app is closed. When you come back you get a "While you were away" summary. It's forgiving: a single night or a day at work can never kill a pal (see *Offline catch-up* in DESIGN.md).

## Test mode (play a whole life in minutes)

Test mode is for developers and is **hidden from players**. On the home screen (menus included) tap **C ten times within 3.5 seconds**, then type the admin password into the box on the LCD. The TEST button then appears on the shell until the page is reloaded; **A + C held for 3 seconds** also toggles the panel. Five wrong passwords lock the box for 30 seconds.

The password itself is not stored anywhere in the game: `js/ui/admin.js` holds only a salted SHA-256 hash. To change it, run `node tools/set-admin-password.js "new password"` (from the source folder) and upload the new `js/ui/admin.js`.

| Row | Buttons |
|---|---|
| Speed | 1x, 60x, 600x (at 600x a whole day passes in 2.4 minutes) |
| Time | +10m, +1h, +6h, +1 day (runs the real simulation, so needs and mistakes happen) |
| Stage | Egg, Baby, Child, Teen |
| Adult | Scrappy, Solid, Champion (with the evolution cut-scene) |
| Needs | Fill all, Hungry, Poop, Sick, Tantrum |
| Battle | +100 XP, +1 Lv, Max Lv, +5 SP |
| Extra | Spawn mate (an opposite-sex adult of the same species goes into your Pal Box), Quick battle (a sparring opponent at your level; you can Run from it), Unlock arena (opens every cup, no stars), Full energy, Revive RIP (free revive of the active pal) |
| Unlock | Champion (all cups, unlocks the Gold shell), Fill Paldex, +500 coins |

On a phone the panel opens compact, and the **–** button shrinks it to a small tab so it never covers the game.

The panel also shows live debug info: stage, care mistakes, care score, the forecast form, every meter, and level/XP/BP.

## Tests

```bash
# Logic tests (Node 18+; no dependencies)
node --test tests/          # or: npm test

# Browser play-through + release audit (needs Playwright + Chromium installed somewhere)
NODE_PATH=/path/to/node_modules node tests/e2e.js [--shots out-dir]
QUICK=1 NODE_PATH=... node tests/e2e.js          # file:// pass only (about 1.5 minutes)
PP_ROOT=/path/to/unzipped/release NODE_PATH=... node tests/e2e.js   # test a release folder

# Clipped-text + home-screen margin audit at 8 screen sizes
NODE_PATH=/path/to/node_modules node tests/layout.js [--shots out-dir] [--only small]

# Sprite / face check: every species x stage x pose x frame, drawn in a real browser
NODE_PATH=/path/to/node_modules node tests/sprites.js
```

- **Node tests (141).** These cover:
  - whole lives under perfect, good, bad and neglectful care, checking the right adult forms and deaths
  - multi-day life simulations with nine care styles (`tests/lifesim.js`, run it directly for a report), metabolism, praise rules and revive edge cases
  - the admin password hash, lockout numbers and the password tool
  - growth timing, care mistakes and the offline catch-up mercy rules
  - sleep schedules: stage limits, overnight schedules, the grace period, growing up, and clock changes including daylight saving
  - 12/24-hour time formatting and the locale default
  - the death and run-away rules
  - battle determinism and species balance, and that the computer really uses each animal's second move (Roar, Howl, Gust, ...)
  - Run / Forfeit (escape chance by speed, a lost turn, no XP or coins, half the energy back, no injury in the arena)
  - arena cup runs: fixed legal foes, a rising level curve, simulated balance, stars only for won cups, Arena Champion and the Myth Cup
  - stat growth and caps per form
  - skill-tree rules
  - breeding rules and inheritance
  - battle-code validation, including codes made by v1.7.6, newer-version codes and tampering
  - save round-trip, corruption recovery, save migrations (schema 1 → 5, including the arena star migration), a full storage, and transfer codes
  - the Paldex and shell unlocks
  - the coin economy, store prices, boost caps and Pal Box slots
  - blink timing, idle behaviour choice, and that every pose the code uses exists in the sprite atlas
  - that the offline cache lists every file the game loads, that the version is the same everywhere, the service-worker update rules, and the `og:image` URL tool
  - the optional server
- **E2E.** Plays through at 390×844 (phone, from `file://`), 844×390 (landscape) and 1280×800 (desktop) over http, plus quick layout and boot checks on `file://` and a 320×568 phone. The run:
  - hatches, feeds, cleans and cures
  - plays the mini-game and evolves the pal
  - fights an arena battle and learns a skill
  - breeds and checks the family tree
  - checks the battle code and reload persistence
  - runs the first-run guide, shell picker, Paldex, attention call and save export/import
  - buys from the store, feeds a bought item and buys a Pal Box slot
  - release checks: test mode stays hidden (`?test=1` does nothing), the admin unlock (10 × C + password, wrong password refused), the clock setting and the sleep-schedule screen
  - all five training games, including winning and losing Memory and finishing Match, Scold and Praise
  - friend battles with **two separate browser profiles** (1.8.4): export a code, import it on the other profile, battle offline, see the result, forfeit; tampered, newer-version and save codes are refused. Also Run from a quick battle, a full arena cup run with the foe list, the star and the celebration, an arena forfeit, and an old save that must not get false stars. Runs at 390×844 over http and 320×568 from `file://`
  - audit checks, over both `file://` and http:
    - two tabs open at once
    - storage blocked or full
    - the About screen
    - 400 mashed buttons
    - reloading mid-battle
    - 6× CPU throttling
    - accessible names
    - the service-worker "new version" flow
  - fails on **any** console error or warning
- **Layout audit.** Opens every screen, menu, toast and the battle menu at 390×844, 360×640, 320×568, 430×932, 844×390, 820×1180, 1280×800 and 1920×1080. It fails if any text overflows its box or the LCD, if the "more" arrow covers text, or if the home screen's bottom line gets closer than 6 LCD pixels to the screen edge.
- **Sprite check.** Draws all 3,864 frames from the real sprite sheets. It fails if:
  - a frame is empty
  - a frame uses a colour outside the 4 LCD tones
  - an open eye has no white
  - any eye contains a solid dark block (the old "dark square" blink bug)
  - the blink frames aren't real eyelids
  - an eye box, or the 1-pixel ring around it, touches transparency (the eye must be fully enclosed by the head)
  - an eye doesn't keep the same offset from the head anchor in every frame (eyes must move with the head)

  It checks 3,312 eye boxes and runs a self-test with deliberately misplaced eyes to prove the check can fail. `python3 tools/gen_sprites.py` runs the same eye-fit checks while drawing and exits with an error if any eye leaves the head.

## Files

```
index.html            the handheld (classic <script> tags, so it runs from file://)
css/style.css         shell, LCD, menus, test panel, responsive layouts
js/config.js          care-alert worker URL + VAPID public key (empty = fully offline)
js/core/*.js          PURE game logic, no DOM: util, data (all tuning numbers), time, sleep, pet, care,
                      evolution, stats, skills, battle, breeding, cards, arena, collection
                      (Paldex + shell unlocks), shop (coins, items, slots), behaviour
                      (blinking + idle choices), daily (goals, rare events, seasons),
                      hints (beginner tips), cloud (recovery code + encryption), save, game
js/data/atlas.js      sprite sheet layout (generated)
js/ui/*.js            screen + input: font, sprites, audio, render, battleview, minigames,
                      menus, input, testpanel, admin (hashed test-panel unlock), net (care alerts),
                      cloudsync (cloud save uploads / restore),
                      shells (paints the handheld), main
sprites/*.png         6 species sheets + fx sheet + icon strip (generated)
tools/gen_sprites.py  draws every sprite from code (python3 + Pillow): python3 tools/gen_sprites.py
tools/spritelib/      the sprite rig: body plans (quad.py, bird.py), faces, poses, effects
tools/grid.py         quick sprite line-up preview for art review
tools/set-admin-password.js  changes the admin (test panel) password hash
tools/gen_icons.py    menu icons + app icons
tools/set-site-url.js makes og:image / twitter:image absolute for your host
tools/gen-vapid.js    makes a new push (VAPID) key pair on your computer: node tools/gen-vapid.js
service-worker.js     offline cache (versioned; http/https only)
manifest.json         install-to-phone (with maskable icon)
cloudflare-worker.js  OPTIONAL server: care-alert pushes + encrypted cloud saves. One file, paste it into
                      the Cloudflare dashboard (DEPLOY.md). wrangler.toml (source zip only) is optional
tests/                Node tests, Playwright play-through + audit (e2e.js), layout audit (layout.js),
                      sprite/face check (sprites.js, uses tests/fixtures/sprite-faces.json)
```

## Privacy

- **Your game stays on your device.** It is saved in your browser's local storage and never sent anywhere.
- **No accounts, ads, analytics, tracking or cookies.** The game makes no network requests of its own, apart from loading its own files.
- **Save transfer codes** are text you copy yourself. They contain your pals and settings, and nothing about you or your device.
- **Care alerts** are off until you switch them on, and your browser asks for permission first.
- **Cloud save** is off until you turn it on. Your save is encrypted **on your device** (AES-GCM, with a key made from your recovery code and optional passphrase) before upload. The server stores only that encrypted blob under a hashed ID, plus a hash of an access token. It can't read your pals, and it can't tell who you are. Copies not used for 400 days are deleted, and **Delete cloud copy** removes yours at once.
- **The optional server** is only contacted when you turn Care alerts or Cloud save on. It stores only a push subscription and the time of your pal's next need (deleted when you turn alerts off, after 24 h of unanswered pings, or when the push service says the subscription is gone). Friend battle codes never leave your device.
- If your browser blocks storage (some private modes), the game still runs and tells you that progress will be lost when the tab closes.

## Optional server

The game never needs a server. If you want phone reminders while the app is closed, or cloud saves, deploy `cloudflare-worker.js` to your own Cloudflare account. Everything can be done in the **Cloudflare dashboard**, with no tools to install (step by step in `DEPLOY.md`):

1. Paste `cloudflare-worker.js` into the worker's **Edit code** and **Deploy**. It's one file, with no imports or build step.
2. **Settings ▸ Bindings:** bind KV namespaces as `CODES` (care alerts) and `SAVES` (cloud save).
3. **Settings ▸ Variables and Secrets:** add `ALLOWED_ORIGIN` (your game's origin, for example `https://you.github.io`). For reminders, also add `VAPID_PUBLIC_KEY` and `VAPID_SUBJECT` (Text) and `VAPID_PRIVATE_KEY` (type **Secret**).
4. **Settings ▸ Triggers:** add a cron trigger that runs once an hour (`0 * * * *`).

Then put the worker URL (and the VAPID public key) in `js/config.js`. Care alerts use the worker. No secrets are stored in the code: the VAPID **private** key only ever goes into the worker's encrypted Secret.

## Licence

MIT. See `LICENSE`.
