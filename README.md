# PocketPal

A tiny handheld pet you raise in your browser.

Feed it. Play with it. Watch it grow for about 15 days. Train it. Battle friends with a share link.

---

## Start

Open the game. **Pick one of six eggs** (A cycle, B confirm). Each egg is a **soft bias** (look family + a lifelong personality seed) — not a locked evolution path. Care still decides growth and adult form. The egg takes **about 5 minutes**. You can close the app — turn the bell on so you get a hatch ping.

On your phone use **Add to Home Screen**.

Save stays on that phone, that browser.

Pet Memory has **5 slots**. Parked pals are frozen. Only the active pal needs care or ages.

They do not leave from old age. Neglect still can.

---

## Buttons

| Button | What it does |
| --- | --- |
| **A** | Cycle icons. Guard in battle. Status: bump bedtime. |
| **B** | Confirm. Attack. Hold B to pause. Status: bump wake time. |
| **C** | Back. |

Shell: bell (alerts), speaker, palette.

---

## Care

- Food hearts low → feed
- Happy hearts low → play
- A pile on the screen → clean
- Sick → medicine
- Their night (Status sets bed/wake) → lights off. Lights are yours — the game will not flip them back on during the day. Lights off at night = good sleep. Lights left on at night = miss. Lights off while they are awake in the day = dark room, no miss (babies may nap). Waking them at night with lights on = miss.
- Naughty call (**!** on the LCD) → Discipline, or spoil them
- Real needs show **FD** feed, **PL** play, **CL** clean, **MD** medicine, **LT** lights

Open on screen = toast only. Closed / minimized = phone ping if the bell is on.

---

## 15 days

| Age | Stage |
| --- | --- |
| 5 min egg | Hatch |
| 0–1 | Baby — big eyes; growthPhase sprouts ear/tail buds + feet |
| 2–4 | Child — real ears/tail variants; arms wave mid-stage |
| 5–9 | Teen (Lumi or Grub) — fuller kit |
| 10–14 | Kit fills in |
| 15 | Adult — full kit + one of 10 bodies |
| 20+ trained | Elder |

Same species the whole life. Care changes size, timing, and which body. Growth phases make each stage visibly fill out.

---

## Train and battle

Teen+. Train XP, Training Battle, Battle Friend. Breed adults.

Connect → **Share battle link** packs the pal on screen (look, stats, age). Friend opens the link to add them. Send a fresh link later to refresh that row. Too young (egg / baby / child) cannot share.

Paldex = 256 looks you have met. Family = forms you raised (and neglect returns).

---

That’s the whole toy.

---






## Final player build

**v5.31** is the current public player build (clean zip, no QA / live-test hooks).

| | |
| --- | --- |
| Version | **5.31** |
| SW cache | `pocketpal-v531` (register `service-worker.js?v=5.31`) |
| Zip | flat player files only — unzip at site root, hard-refresh so the new cache name wins |
| Economy | No IAP. No free revive. Coins / CHIP / TONIC / REVIVE persist across pets |
| Hatch | ~5 minutes real-time after egg confirm; cinema in the last ~30s |
| Memory | 5 slots; parked pals frozen |
| Revive | Shop **USE REVIVE** restores Family returned/neglect **as they were** when a `snap` exists; MEMORY FULL does not consume the charm |
| Care push | Worker cron + public routes + VAPID secret required for closed-phone pings |

Built on v5.30. v5.31 fixes closed-phone care Web Push (stale focused skip, aes128gcm `rs`, Access toast, dashboard cron, push status). Verdict: SHIP WITH NOTES (Worker deploy steps required).

---

## Closed-phone care push (v5.31)

When the **phone is locked** and the **PWA is killed**, local SW timers / periodicsync are unreliable. Pings only arrive via:

**Worker cron → FCM/APNs → SW `push` → `showNotification`**

That needs all of:
1. Notifications allowed + bell on
2. `pushManager.subscribe` with the VAPID **public** key
3. Successful POST `/care` storing subscription + care snapshot
4. Worker **Cron Trigger** in the Cloudflare dashboard: `*/5 * * * *` (Triggers → Cron Triggers). Required — `scheduled()` in `cloudflare-worker.js` does not self-schedule.
5. Worker **public** (no Cloudflare Access) on `/care`, `/push`, `/subscribe`, `/vapid-public`, `/health`
6. Secret `VAPID_PRIVATE_KEY` in Worker Settings → Variables (JWK `d` base64url, same keypair as the public in `index.html`). Bind KV `SUBSCRIPTIONS`.
7. FCM returns 201

**iOS:** Web Push only works if the game is **Add to Home Screen**. Safari-tab alone will not get reliable pushes — we do not fake it.

If `/care` or `/vapid-public` returns HTML / Access login, the client toasts once: `Push Worker blocked — check Cloudflare Access`.

### Deploy Worker (operator)
Dashboard path (no CLI):
1. Paste `cloudflare-worker.js` into a Worker → Deploy
2. Bind KV `SUBSCRIPTIONS`
3. Add secret `VAPID_PRIVATE_KEY`
4. Add Cron Trigger `*/5 * * * *`
5. Confirm Cron Trigger is attached in the Cloudflare dashboard. **Remove Cloudflare Access** (or bypass) for the routes above — Access cannot be disabled from game code.
Confirm Cron Trigger is attached in the Cloudflare dashboard. **Remove Cloudflare Access** (or bypass) for the routes above — Access cannot be disabled from game code.

### What v5.31 changed in push code
- Hide / pagehide / beforeunload always publish care (`focused:false`), bypassing the 20s save throttle; tab still freezes drain (`frozen:true`) so cron does not invent hunger.
- Cron treats `focused` as true only if `rec.updated` is &lt; 90 seconds old.
- aes128gcm `rs` = ciphertext length (not 4096); tiny JSON `{title,body,type}`; no 4KB padding; Topic header omitted.
- `lastPushStatus` stored; 404/410 deletes the subscription.

---

## v5.31 FINAL Public Release

Closed-phone care push reliability + small sleep guards on med/tonic. Prior v5.30 fairness / Family / Connect fixes retained. No QA / live-test code in the clean player zip.

### Changelog path
**v5.21** → **v5.22** (shop) → **v5.23** (revive-as-was / pickers) → **v5.24** (arrow / INV / hearts) → **v5.25** (richer Memory cards) → **v5.26** (clean player deploy) → **v5.27** (menu highlight sync) → **v5.28** (revive/memory highlight + egg toasts) → **v5.29** (A-cycle direction) → **v5.30** (audit High fixes FINAL) → **v5.31** (closed-phone care push).

Version **5.31** / SW cache `pocketpal-v531`.

## v5.30 FINAL Public Release

Main-menu A now cycles icons forward from left to right, matching the existing egg, shop, feedpick, and medpick A-cycles. The v5.28 live menu-highlight fix is retained and marked PASS in sign-off. No QA / live-test code is included in the clean player zip.

### A-cycle direction
- Main-menu A uses `selectIcon(1)` — Status → Feed, continuing left-to-right through the icon strip.
- Egg select, shop, feedpick, and medpick continue to cycle forward with `+1`.

Version **5.30** / SW cache `pocketpal-v530` (superseded by v5.31).

## v5.28 Public Release

Residual menu-highlight call sites + egg toast polish on v5.27. No IAP. No free revive. Coins / inventory still persist across pets. PWA offline cache bumped to `pocketpal-v528`.

### Highlight after life-swap
- v5.27 synced highlight after `restart` / egg pick / hatch / load. **Revive Charm** and **Pet Memory → USE PET** still applied a new `S.sel` without touching the DOM `.on` class (same Connect-vs-Status desync, different door).
- `updateIconHighlight()` now also runs after `confirmReviveFamily`, `applyPetCard`, and `useStoredPet`.
- `confirm()` / `selectIcon` use `ICONS[S.sel|0]` so a stale/NaN sel cannot no-op B.

### Egg-stage toasts
- Load / B on a warming egg no longer says `Egg warming · 0 min` when the timer is already due.
- Ready or last-30s cinema → `Hatching!` / `Egg is hatching...`; otherwise remaining minutes or the pick prompt.

### Connect INV labels
- Connect overlay footer uses `CHIP n TON n REV n` (same as shop LCD). Was leftover `Inv C n T n R n`.

### Changelog path
**v5.21** → **v5.22** (shop) → **v5.23** (revive-as-was / pickers) → **v5.24** (arrow / INV / hearts) → **v5.25** (richer Memory cards) → **v5.26** (clean player deploy) → **v5.27** (menu highlight sync) → **v5.28** (revive/memory highlight + egg toasts).

Version **5.28** / SW cache `pocketpal-v528`.

## v5.27 Public Release

Menu highlight stays in sync after a new pet / egg pick. Built on v5.26. No IAP. No free revive. Coins / inventory still persist across pets. PWA offline cache bumped to `pocketpal-v527`.

### Menu highlight desync fix
- After `restart()` / new egg life, `S.sel` is Status (0) but the shell icon highlight could stay on the previous icon (e.g. Connect). B opened Status while the player saw Connect on.
- `updateIconHighlight()` now clamps `S.sel` (`null`/`NaN` → 0) and matches `#icons .icon` by `data-a === ICONS[S.sel]` so DOM order cannot drift.
- Highlight is refreshed after `restart()`, `beginEggSelect()`, `confirmEggSelect()`, hatch complete, and `init()` / load.
- `S.sel = 0` is set explicitly in `restart()` and `beginEggSelect()` (not only via `petDefaults`).
- Care-need blink on the LCD mode strip is an outline/underline only; the selected mode stays a filled invert so FD/PL/CL cannot be mistaken for the current icon.

### Changelog path
**v5.21** → **v5.22** (shop) → **v5.23** (revive-as-was / pickers) → **v5.24** (arrow / INV / hearts) → **v5.25** (richer Memory cards) → **v5.26** (clean player deploy) → **v5.27** (menu highlight sync).

Version **5.27** / SW cache `pocketpal-v527`.

## v5.26 Public Release

Clean player deploy after live retest PASS. Same features as v5.25; all QA / live-test hooks removed. No IAP. No free revive. Coins / inventory still persist across pets. PWA offline cache bumped to `pocketpal-v526`.

### Live retest (PASS — no FAILs)
- Shop arrow RIGHT, INV CHIP/TON/REV, buy → inventory
- Feed / Med pickers, revive-as-was, MEMORY FULL no consume
- Rich Pet Memory cards, meter hearts, floating heart FX

### QA stripped for players
- Removed entire QA live-test helpers panel (QA query flag)
- Removed `window.S` / state-expose hooks
- No QA overlay panel in player builds

### Carried forward
- Shop/feed/med `>` arrow RIGHT (MSB-left FONT)
- INV labels; Chip via Feed, Tonic via Med, Revive via Shop USE REVIVE
- Richer Memory cards (v5.25); revive-as-was / MEMORY FULL (v5.23+)
- Happy heart FX shapes; coins persist

### Changelog path
**v5.21** → **v5.22** (shop) → **v5.23** (revive-as-was / pickers) → **v5.24** (arrow / INV / hearts) → **v5.25** (richer Memory cards) → **v5.26** (clean player deploy).

Version **5.26** / SW cache `pocketpal-v526`.

## v5.25 Public Release

Richer Pet Memory cards so owners can tell parked pals apart. Built on v5.24 polish. No IAP. No free revive. Coins / inventory still persist across pets. PWA offline cache bumped to `pocketpal-v525`.

### Richer Pet Memory cards
- Each occupied slot shows **Name** + **ACTIVE** vs **PARKED · FROZEN**.
- **AWAKE** / **ASLEEP** from `sleep` (live `S` for the active slot). Eggs show **EGG** / hatch countdown / READY / HATCHING instead.
- Care meters: `H♥♥♡♡  Y♥♥♥♡` plus `n/4` counts.
- Alert chips when true: **SICK**, **DIRTY**, **INJURED**, **LOW** (hunger or happy ≤1).
- Stage · Age · Gen · species/morph look · `BED xx:00 · WAKE yy:00` · battle `nW-nL` · short **TEMP**.
- Overlay blurb notes parked pals are frozen — status is as-parked / as-restored.
- `memorySnapshot` still stores sleep, hunger, happy, sick, poop, injury, bed/wake, personality seed for parked cards.
- Same card HTML used by `showPetMemory` and `offerPetsAfterReturn`.

### Carried forward from v5.24
- Shop/feed/med `>` arrow points RIGHT (MSB-left FONT).
- INV `CHIP` / `TON` / `REV` labels; Chip via Feed picker, Tonic via Med picker, Revive via Shop USE REVIVE (as-was; MEMORY FULL no consume).
- Happy heart FX shapes; coins persist.

### Changelog path
**v5.21** → **v5.22** (shop) → **v5.23** (revive-as-was / pickers) → **v5.24** (arrow / INV / hearts) → **v5.25** (richer Memory cards).

Version **5.25** / SW cache `pocketpal-v525`.

## v5.24 Public Release

Owner feedback polish on v5.23. No IAP. No free revive. Coins / inventory still persist across pets. PWA offline cache bumped to `pocketpal-v524`.

### Shop / picker arrow points RIGHT
- Bitmap FONT `>` was mirrored under MSB-left `drawText` (`ch[row] & (0x10 >> col)`), so the selection caret looked like `<`.
- Fixed: `'>':[0x10,0x08,0x04,0x02,0x04,0x08,0x10]` (classic right-pointing). `'<'` mirrored. ASCII-verified MSB-left.

### Inventory labels readable
- Shop LCD shows `CHIP n  TON n  REV n` (not cryptic `INV C0 T0 R0`).
- Status line uses `CHIP` / `TON` / `REV` abbreviations.
- Shop footer tip: `FEED/MED USE INV`.

### How to use shop items (end-to-end)
- **Chip:** Feed → feedpick (when you own chips) → select **CHIP** → **B** runs `useChip` (consumes 1). No chip → classic **A=Meal B=Snack**.
- **Tonic:** Med → medpick (when you own tonics) → select **TONIC** → **B** runs `useTonic`. No tonic → one-tap medicine.
- **Revive:** Connect → Pal Shop → buy **REVIVE** (80c) → **USE REVIVE** → Family picker → restore as-was into an empty Memory slot. **MEMORY FULL** blocks without consuming.

### Hearts
- Meter `drawHeart`, floating `spawnFx('heart')`, CHEERY / care-cinema hearts audited: cleft top, pointed bottom; happy/content paths still spawn hearts.

### Changelog path
**v5.21** → **v5.22** (shop) → **v5.23** (revive-as-was / pickers) → **v5.24** (arrow direction, INV labels, item-use clarity, hearts audit).

Version **5.24** / SW cache `pocketpal-v524`. *(Superseded by v5.25 for Memory card detail.)*

## v5.23 Public Release

Owner polish on the v5.22 shop build. No IAP. No free revive. Coins / inventory save migration unchanged. PWA offline kept (`pocketpal-v523` cache).

### Revive Charm — restore as they were
- **Use Revive** (Family returned / neglect only) restores the pal **as at return-home/death**: growth/age, stage/form, stats, morph/look, name, TEMP seed, bed/wake schedule, traits — not a weakened baby.
- Family album now stores a full `snap` at death/return for continuity. Legacy album rows (pre-5.23) rebuild best-effort from saved summary fields (still not a baby).
- Marks the Family entry **revived**. Consumes **1** `invRevive`. Does **not** invent Gen+1.
- Revived pal goes into an **empty** Pet Memory slot. If memory is full → toast + LCD **`MEMORY FULL`** (free a slot first). Never overwrites.

### Med / Feed pickers
- **Med:** if `invTonic > 0`, opens medpick LCD — Medicine / Tonic with `>` arrow; **A** cycles, **B** uses, **C** cancels. No tonic → one-tap medicine (unchanged). `useTonic` kept.
- **Feed:** if `invChip > 0`, opens feedpick LCD — Meal / Snack / Chip with `>` arrow; **A** cycles, **B** uses, **C** cancels. No chip → classic **A=Meal B=Snack** toast flow.

### Shop LCD arrow
- Selected shop line shows a visible **`>`** in front of the item name (bitmap FONT now includes `>`). **A** moves the arrow immediately (redraw). **B** buys / Use Revive. **C** closes.

### Changelog path
**v5.21** (hatch name plate, no shop) → **v5.22** (coins & Pal Shop; revive was weakened baby) → **v5.23** (revive-as-was, memory-full block, Med/Food LCD pickers, shop arrow glyph).

Version **5.23** / SW cache `pocketpal-v523`. *(Superseded by v5.24 for arrow / INV labels / use tips.)*

## v5.22 Coins & Pal Shop

Account coins (`S.coins`) and shop inventory persist across pets like friends/memory. No IAP. No free revive.

### Economy

| Action | Coins | Notes |
| --- | --- | --- |
| Care streak day tick | **+2** | Once/day when streak increments; living pet only; not while Pause/Away |
| Win Look or Memory | **+1** | Soft daily cap **6** from minigames |
| Train XP success | **+2** | `endTraining` win |
| Training battle win | **+3** | |
| Friend / share-link battle win | **+5** | Includes P2P |
| Morning age-up | **+1** | Natural wake `age++` only |
| Losses / neglect / idle / offline catch-up / shop buy | **0** | No earn |

Toast `+N COINS` when N≥2 (or pending coalesces to ≥2). Shown on Status + shell meter.

### Pal Shop (Connect → Pal Shop)

LCD list — **A** cycle / **B** buy / **C** back:

| Item | Price | Effect |
| --- | --- | --- |
| **Chip** | 8 | Inventory; Feed menu offers Chip (happy+1, weight like snack, stomachache risk) |
| **Tonic** | 12 | Inventory; Med menu offers Tonic (clears sick/injured; careMiss−1 if >0) |
| **Revive Charm** | 80 | Inventory; **Use Revive** → Family picker for returned/neglect only. *(v5.22: weakened baby. **v5.23:** restore as they were; MEMORY FULL if no free slot.)* |

Keeps v5.15–5.21 (grace, face fit, hatch plate, TEMP, visual growth, fresh-life reset).

Version **5.22** / SW cache `pocketpal-v522`. *(Superseded by v5.23 for revive / pickers / shop arrow.)*

## v5.21 Hatch Name Plate

Hatch / evo / grow LCD name plates no longer clip the second line into the border. Hatch plate holds longer so you can read TEMP + name.

### Bugs
1. **Glyph clip:** `drawLcdNamePlate` used outer h=22 / inner h=18 with line2 at y+14. 7-row FONT glyphs ran into the bottom ink frame.
2. **Hatch too short:** Post-hatch plate + `animTimer` were ~2200ms — easy to miss TEMP / name.

### Fix
- **Plate geometry:** `LCD_NAME_PLATE_Y = 114`, outer **h=28** (bottom ≤ 142, still above mode strip ~166). Inner BG h=24 with **~2–3px clear margin** inside the ink frame. Line1 at y+5, line2 at y+16 — both fully inside BG. Still ≤22 chars; TEMP + name unchanged.
- **Hatch duration:** `_hatchCut` / `animTimer` use **`HATCH_PLATE_MS = 5000`** (~5s). A or B dismisses early via `dismissHatchPlate`. Evo (~2.8s) and grow (~2.2–2.8s) keep their timings; they share the taller plate helper only.
- No Pal Shop.

Keeps v5.15–5.20 (grace, TEMP, visual growth, fresh-life reset, face fit).

Version **5.21** / SW cache `pocketpal-v521`.

## v5.20 Face Fit

Baby eyes no longer spill off the head. Face sockets, pupils, and mouth scale to the body.

### Bug
Baby g0 body is `r = 8 + g*2` (cy=2). Face used fixed baby sockets ~7×6 with `eyeL = -sockW-2` (~−9) and `eyeR = 3` (to ~10) — **outside** the circle. Pupils looked detached.

### Fix
- **`faceSocketLayout(met, eyeKind)`** derives sockW/sockH from `met.r` (baby g0 ≈4×4, grows with phase); gap from center; eyeL/eyeR from half-gap — not hard-coded −9/3
- Socket corners clamped with a 2px rim inset (`onFaceInset`); shrink gap → width → height, or pull `ey` down until they fit
- Pupils keep look-around / care / look+memory games / battle faces; **2×2 clamped inside the socket** (tiny eyes use pupBase 1 so L/R lock still reads)
- Mouth sits below eyes with a clear gap; chew crumbs scale to mouth, not fixed x=12
- Blink/wink/sleep lines use the same socket width/position on all stages

Keeps v5.15–5.19 (grace, plates, TEMP, visual growth, fresh-life reset). Look minigame L/R, memory show, BRAVE TDZ, kit growth unchanged.

Version **5.20** / SW cache `pocketpal-v520`.

## v5.19 Fresh Life Reset

New egg / restart no longer inherits the previous pal’s schedule or leftover pet fields.

### Bug
`restart()` did `bedHour: clampHour(S.bedHour, 20), wakeHour: clampHour(S.wakeHour, 8)` and a **partial** `Object.assign` — so a new pet kept pet A’s bedtime, and unlisted fields (`growthPhase`, `injured`, `sickSince`, cinema flags, …) could bleed across lives. `applyPetCard` had the same partial-assign risk when a parked card was missing keys.

### Fix
- **`PET_DEFAULTS` + wipe** of non-account keys on `restart()` and `applyPetCard`
- New life: **bed 20 / wake 8**, lights ON, sleep false, growthPhase 0, timers/menus/battle/away cleared
- **Account globals KEEP:** friends, petFamily, petMemory, speciesSeen, deaths, sound, notifications, difficulty, shellTheme, myCode, careStreak, lastCareDay (Gen+1 only on fromDeath; else Gen 1)
- **`memorySnapshot`** always stores bedHour / wakeHour / growthPhase so USE PET restores that pal’s own schedule

Keeps v5.15–5.18 (grace shift, plates, TEMP, visual growth).

Version **5.19** / SW cache `pocketpal-v519`.

## v5.18 Visual Growth

Lifelong visible growth + early baby identity. Save-compatible; 15-day evo thresholds unchanged.

### Kit unlock (was: babies stuck at 0)
- **Old:** `kitLevelFor` returned **0 for all babies** → forced round ears + stub tail for everyone; no morph identity until child+.
- **New curve:**
  - Baby g0: face-only cute + **1px** ear/tail nubs if morph ears/tail ≠ 0
  - Baby g1–2: kit 1 — ear stubs / short tail (tall ear variants collapsed to stubs)
  - Baby g3: clearer buds (still kit 1; arms wait for child)
  - Child: kit 1 → **2** from g1 (real variants + waving arms)
  - Teen: kit 2–3 (fuller); Adult / secret: **4**
- Care miss ≥8 / ≥16 still delays kit by 1 each.

### growthPhase readability
- Baby/child body radius steps **+2 per phase** (was +1); cheeks + feet sprout clearly.
- Mid-day ticks: ~70 min if well-cared, ~90 default, ~115 if neglected.
- Offline catch-up that raises `growthPhase` plays a short **grow cinema** (flash + GREW plate + stars) — not toast-only.

### Morph / eyes / anim
- All 8×8×4 ears/tails/patterns show once kit allows; accents (whiskers/tuft/horn/…) at kit ≥2 (flashier ≥3).
- Baby eyes larger, high-contrast sockets.
- Idle: stub tails wag; ear nubs flick; arms wave when present. BRAVE roll TDZ-safe kept.

Version **5.18** / SW cache `pocketpal-v518`.

## v5.17 Public Release

Status / temperament wording cleanup. Keeps v5.15–5.16 fixes (Critical grace shift, LCD name-plate Y).

### Why Curious + BRATTY appeared
Status line 1 used `formTrait(S.form)` → stage flavours like **Curious** (baby) from `FORM_TRAITS`. Line 3 showed `personalityOf(S)` → lifelong egg seed e.g. **BRATTY**. Two temperament-like words on one screen.

### New Status layout (≤38 chars/line)
1. `NAME #xxx` — no formTrait  
2. `BABY PIP GEN1` — stage + form name + gen  
3. `AGE n  WT nG  LV n`  
4. `TEMP BRATTY` — personality seed only, labeled  
5. `HUN n/4  HAP n/4  DISC n%`  
6. PALS/FAMILY · STREAK/BATTLE W-L · NEXT evo · FRIENDS · TIME/state · BED/WAKE · ALERTS/LT (+ SICK/DIRTY/…) · A/B/C  

Main HUD mood (HUNGRY/SAD/…) stays care-state, not personality. Line spacing 13px so all 13 rows fit the 178px LCD (was clipping).

### Wording / meter fixes
- **Removed `FORM_TRAITS` / `formTrait` from UI** — Curious/Playful/Bright/etc. never shown beside TEMP.
- **Family album:** `recordFamilyMember` stores personality seed (else Pip/Nib/Lumi…); display maps legacy Curious-style traits → form name via `familyTraitLabel`.
- **Egg / hatch:** confirm, cycle, hatch toast + hatch name plate use `TEMP <seed>` so seed is labeled.
- **Feed / Play toasts:** `FEED  A=Meal  B=Snack` · `PLAY  A=Look  B=Memory`.
- **Status open toast:** `STATUS  A=Bed  B=Wake  C=Back`.
- **HTML chrome:** initial stage-line `Egg • Hatching...` (was Waiting); hearts/wt/disc/friends clamped to real ranges.
- **FONT:** added `/` `%` `+` so HUN/HAP/DISC, HP, STA meters render (were blank glyphs).
- **Icon strip** ST/FD/PL/CL/MD/LT/CN/DS unchanged; battle inspect/order/charge help left accurate (ATK uses STA, GRD +2, mash B spends STA).
- Connect stays share-link only (no friend-code leftovers). Death/return overlay copy unchanged (Returned home).

Version **5.17** / SW cache `pocketpal-v517`.

## v5.16 Public Release

LCD name-plate layout fix for hatch / evo / grow reveals. Keeps v5.15 Critical grace fairness.

- **Name plate overlap:** Hatch / evo / grow intro plates used `fillRect` y=148 (22px tall → bottom ~170), which covered the bottom mode strip (`drawModeStrip` at H−12=166). Plates now share `LCD_NAME_PLATE_Y = 116` via `drawLcdNamePlate` (outer bottom ≤ 138) — under the pet, clearly above the icon row (~y 164–175). Mode strip stays visible and unobscured.
- **Hatch banner clarity:** Line 1 = personality seed (CALM / BRAVE / …) plus optional short species tag (`CALM #012`); line 2 = pet name. Still two lines in the box; 6px font / ~23-char inner width.
- Version **5.16** / SW cache `pocketpal-v516`.

## v5.15 Public Release

Deep audit + simulated playtest release. Feature freeze — correctness and fairness only.

- **Critical grace fairness:** Pause / Away / short-hidden timer-shift now also extends `loadGraceUntil`, `_critGraceUntil`, and `sickSince`. Leaving the pet paused or Away mid-crisis no longer burns the ~2.5 min last chance (or load grace) on the wall clock.
- **Regression keepers:** BRAVE roll TDZ-safe, no `resetHomePose` on draw error, `frame++` in battle, egg name UI, frozen care alerts (SW + worker), 6 egg→personality seeds, Away 20m / hidden freeze, share-link battles, P2P still off.
- Version **5.15** / SW cache `pocketpal-v515`.

## v5.14 Personality Pack

Six temperaments, one soft seed per egg. Not Digimon evo trees — care still decides growth / adult. Keeps v5.07–5.13 intact (care cinema, 6 eggs UI, arena, Away, alert freeze, etc.).

- **1:1 egg → personality seed:** DOT→CALM, BAND→BRAVE, AURA→BRATTY, WAVE→CHEERY, CROSS→SHY, STAR→CLEVER. `eggTraits()` no longer duplicates CALM/BRAVE/BRATTY on WAVE/CROSS/STAR.
- **`personalityOf`:** returns the egg seed for life (Status + hatch). Earned stats may still nudge *intensity* / idle flourishes; they do not erase the seed name. `MELLOW` only for legacy saves with no egg seed.
- **Signature idles:** CALM lay/stretch · BRAVE roll · BRATTY jump · CHEERY wave/hop · SHY peek (sit-back + eye peek) · CLEVER spark/look.
- **Light flavour:** BRATTY sooner naughty test (still 1/day quota) · CALM fewer daytime bored calls + softer wake · BRAVE peppier train/battle bob (visual) · CHEERY extra hearts when happy/fed/play-win · SHY less wander + flinch on call · CLEVER sharper GO spark/beep (win/STA rules unchanged).
- **UX:** egg confirm / cycle / hatch toast + name plate can show personality; Status line shows the 6 seed names.
- Version **5.14** / SW cache `pocketpal-v514`.

## v5.13 Release Candidate

Care-alert correctness + egg-select LCD polish. Keeps v5.07–5.12 intact.

- **Egg bias (clarify):** Choosing an egg still only soft-biases morph family (ear band + preferred pattern) and an early personality lean (CALM / BRAVE / BRATTY). It is **not** a locked evo path — care still decides growth. Confirm toast now says `soft look bias`.
- **Egg select UI:** Selection frame wraps the **egg sprite only** (thin padded box). Names (DOT / BAND / AURA / WAVE / CROSS / STAR) draw **below** the frame with an underline on the selected name — never clipped or covered. 2×3 grid, A cycle / B OK, hint + GEN lines unchanged on 240×178.
- **Care push alerts (Away Safeguard follow-up):** While the tab is **hidden**, live care freezes. Snapshots now set `paused`/`frozen` when `S.paused || S._away || visibilityState==='hidden'`. SW `dueAlarms` / worker `pickDue` **do not project** hunger/happy drain while frozen (stops false pings). Already-due needs + wall-clock egg hatch still alert. `careNotify` and `countDueCares` treat `_away` like pause. Visibility show / Away / Pause still push snapshots (after catchup on return). 15-min notify dedupe unchanged.
- Version **5.13** / SW cache `pocketpal-v513`.

## v5.12 Release Candidate

Public polish build — correctness and feel over new systems. Keeps v5.07–5.11 intact.

- **Six eggs:** LCD select now has **DOT · BAND · AURA · WAVE · CROSS · STAR** (A cycle, B confirm). Each biases morph family (ear band + preferred pattern) and a soft early personality lean — see table below. Old saves with `eggId` 0–2 still work; new ids 3–5; missing `eggChoice` hashes into 0–5. Mid-pick saves no longer get forced into a hashed egg.
- **Care cinema toasts:** Feed / snack / med / clean result text fires on the **result** beat, not the button press — no more toast racing the walk.
- **Care walk vs poop:** Food and medicine spawn clear of piles; approach steps around mess so the item is reachable.
- **Toast priority:** Egg / hatch / critical toasts outrank on-screen care-alert nags so they stop fighting each other.
- **Training coach:** Metronome beeps are quieter and ~3× less frequent; still silent when sound is off.
- **startFreshLife:** Slot toast includes the Pick-an-egg prompt (no overwrite of the select hint).
- **Friend-code wording:** Comments / worker copy lean on battle links / device ids (share-link flow unchanged).
- Version **5.12** / SW cache `pocketpal-v512`. Does **not** change combat economy, 15-day rules, or Away/hidden neglect fairness.

### Egg bias table

| Egg | Look | Morph lean (ears / pattern) | Personality seed |
| --- | --- | --- | --- |
| **DOT** | Scattered spots | ears 0–2 / pattern 0 | CALM |
| **BAND** | Horizontal stripes | ears 3–5 / pattern 1 | BRAVE |
| **AURA** | Diamond + sparkles | ears 6–7 / pattern 3 | BRATTY |
| **WAVE** | Wavy bands | ears 0–3 / pattern 2 | CHEERY |
| **CROSS** | Bold X marks | ears 2–5 / pattern 0 | SHY |
| **STAR** | Star cluster | ears 4–7 / pattern 3 | CLEVER |

Care still decides growth — egg bias is a light lifelong seed only (**not** a locked evolution path).

## v5.11 Away Safeguard

Fairness for unattended open tabs — neglect death rules unchanged; AFK and hidden tabs no longer full-speed live-drain.

- **Hidden tab:** While `document.visibilityState === 'hidden'`, live care sim (hunger / happy / poop / filth / tantrum / death / miss stacks) does not run. Clock sync and save-on-hide still work. On return, existing `applyOfflineCatchup` (≥2 min, capped) or a short timer-shift (<2 min) applies — never both a background drip and catchup.
- **Away mode (visible AFK):** After **20 minutes** with no pointer / key / touch / A·B·C / shell input (and not paused, not egg/dead, not in battle/minigame), care freezes like Hold-B pause. Toast once: `Away — care paused. Press any button to resume`. Any input clears Away and **shifts care timers forward** (no huge catchup). Hold-B pause still wins; Away folds into Pause without double-shifting.
- **Critical grace:** When neglect thresholds would call `die()`, the pet gets **one** last chance per crisis: toast + notify `Critical — feed & play NOW` and ~2.5 min grace. After grace, existing thresholds apply. Saving them (hearts recover) resets the last-chance for a future crisis. Load/offline still use the 3 min `loadGraceUntil`.
- Version **5.11** / SW cache `pocketpal-v511`. Keeps v5.08–5.10 (care cinema, egg select, arena pass). Does **not** remove neglect death for active play.

## v5.10 Arena Pass

Battle and training spectacle — choreography on top of the same STA / Guard / Attack / charge / timing-GO rules.

- **Battle choreography:** Wind-up pose → dash-in → hit frames → knockback → victory dance / defeat sulk. Charge mash shows glow + shake on your pal; rival mirrors the same visual language. Phases (`inspect`, `order`, `charge`, `clash`, `enemy`, `result`, `end`) and damage math unchanged — staging only in `drawBattle` / fighters.
- **HIT / POW / BLOCK:** Still short readable pops, now synced to contact / knockback motion.
- **Training workout scene:** Timing GO stays the core. Between cues the pet does push-ups / spar / hop drills with sweat drops and coach-style beeps. Success → pumped pose; fail → stumble; then home anim as before.
- **Post beat (B3):** Brief praise or tough-love plate after battle/train showing existing Happy / XP / Disc / Weight feedback — no new economies.
- Version **5.10** / SW cache `pocketpal-v510`. Save-compat with 5.09. Keeps v5.08 care cinema + idle/evo and v5.09 egg select / hatch cinema.

## v5.09 Origin Pass

First bond — pick your egg, then watch it hatch.

- **Egg select:** New life / empty start / restart after death (Gen+1) showed **3 eggs** on the LCD (DOT / BAND / AURA). **A** cycles, **B** locks in. **C** does not back out once select has started (choice is the bond). *(v5.12 expands to 6 — see above.)*
- **Bias (light):** `eggId + petId` seeds morph family (ear-band + preferred pattern) and a soft early personality lean — DOT→CALM, BAND→BRAVE, AURA→BRATTY. Not a Digimon evolution tree; care still decides growth.
- **Hatch cinema:** Idle egg (chosen look) → shake → crack + shell bits → baby pop with short melody and name/species tag. Still ~5 minutes total; cinema fills the last ~30s. Bell notifies on hatch when alerts are on.
- **Save-compat:** Old saves without `eggChoice` get a default egg from `petId` hash — no wipe. Mid-warm eggs skip the select UI.
- Version **5.09** / SW cache `pocketpal-v509`. Keeps v5.08 care cinema + idle/evo cutscenes.

## v5.08 Life Pass

Everyday care and idle feel more alive — theatre on top of the same hunger / happy / weight / sick rules.

- **Care cinema:** Feed shows a meal or snack on the LCD; the pal walks over, chews/gulps in a few frames, then yum/joy or stomachache as before. Medicine shows a bottle (shiver → better). Clean adds soap/bubbles and a walk to the mess.
- **Denser idle:** New beats — look-at-you, stretch, spark-chase, mad-near-poop, tired lean when hearts are low — plus personality flourishes (CALM/BRAVE/BRATTY) a bit more often. BRAVE roll stays TDZ-safe (`let shift` first; no pose reset on draw errors).
- **Evo / morning drama:** Evolution and morning age-up play a short ~2–3s cutscene (flash, silhouette/form swap, melody, name plate). Evo rules unchanged.
- Version **5.08** / SW cache `pocketpal-v508`. Save-compatible with v5.07.

## v5.07 polish

- Fixed idle screen flicker and pet teleports: BRAVE “roll” idle assigned `shift` before it was declared (TDZ throw → blank frame + `resetHomePose` snap to center). Idle flourishes now apply cleanly after the breathe cycle.
- Draw-loop errors no longer reset pose (that was amplifying teleports). Canvas transform / battle draw flags only.
- Animation frame advances on battle and minigame screens too (was frozen outside the home LCD).
- Removed duplicate sleep “Z” text (pixel Zzz by the pet stays).
- Share-link copy left in a few metas/toasts; version bump to 5.07 / SW cache `pocketpal-v507`.

