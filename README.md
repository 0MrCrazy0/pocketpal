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

