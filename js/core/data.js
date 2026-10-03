/* PocketPal - game data & tuning numbers (pure). All balance lives here. */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};

  var SPECIES = ['croc', 'lion', 'eagle', 'elephant', 'bear', 'wolf'];

  var SPECIES_INFO = {
    croc:     { label: 'Croc',     flavour: 'Swamp',  blurb: 'Tough jaws, thick hide. Wears foes down.', base: { hp: 57, atk: 15, def: 13, spd: 9 },  moves: ['chomp', 'tail_whip'] },
    lion:     { label: 'Lion',     flavour: 'Pride',  blurb: 'Hard hitter with big crits and roars.',   base: { hp: 56, atk: 15, def: 11, spd: 11 }, moves: ['claw_swipe', 'roar'] },
    eagle:    { label: 'Eagle',    flavour: 'Sky',    blurb: 'Fastest pal. Dodges and dives.',          base: { hp: 55, atk: 15, def: 10, spd: 15 }, moves: ['peck', 'gust'] },
    elephant: { label: 'Elephant', flavour: 'Earth',  blurb: 'Huge HP and defence. Stuns with stomps.', base: { hp: 70, atk: 13, def: 14, spd: 6 },  moves: ['trunk_slam', 'stomp'] },
    bear:     { label: 'Bear',     flavour: 'Forest', blurb: 'Strong and self-healing.',                base: { hp: 64, atk: 16, def: 12, spd: 8 },  moves: ['maul', 'bear_hug'] },
    wolf:     { label: 'Wolf',     flavour: 'Pack',   blurb: 'Quick, bleeding bites and howls.',        base: { hp: 50, atk: 17, def: 10, spd: 15 }, moves: ['bite', 'howl'] }
  };

  var STAGES = ['egg', 'baby', 'child', 'teen', 'adult'];
  /* Minutes spent in each stage (simulated time, sleep included). */
  var STAGE_MIN = { egg: 5, baby: 120, child: 36 * 60, teen: 60 * 60 };

  var FORMS = ['bad', 'good', 'perfect', 'secret'];
  var FORM_INFO = {
    bad:     { label: 'Scrappy',  mult: 0.88, growth: 0.030, cap: 20 },
    good:    { label: 'Solid',    mult: 1.00, growth: 0.035, cap: 30 },
    perfect: { label: 'Champion', mult: 1.12, growth: 0.040, cap: 40 },
    secret:  { label: 'Secret',   mult: 1.12, growth: 0.040, cap: 40 }    // 1.9.7: Champion power, a different stat spread (never stronger)
  };
  var NAMES = {
    croc:     { egg: 'Croc Egg',     baby: 'Snip',   child: 'Nipper',   teen: 'Gatorling', bad: 'Muckjaw',   good: 'Snaptail',   perfect: 'Kingmaw',    secret: 'Abyssmaw' },
    lion:     { egg: 'Lion Egg',     baby: 'Purrl',  child: 'Cubby',    teen: 'Lionel',    bad: 'Scruffpaw', good: 'Maneguard',  perfect: 'Solarion',   secret: 'Eclipsar' },
    eagle:    { egg: 'Eagle Egg',    baby: 'Peep',   child: 'Fledgy',   teen: 'Hawklet',   bad: 'Ragwing',   good: 'Skyhawk',    perfect: 'Stormtalon', secret: 'Aurorawing' },
    elephant: { egg: 'Elephant Egg', baby: 'Tootle', child: 'Trunklet', teen: 'Tuskling',  bad: 'Dustrunk',  good: 'Tuskard',    perfect: 'Mammodon',   secret: 'Glaciodon' },
    bear:     { egg: 'Bear Egg',     baby: 'Bumble', child: 'Cubbin',   teen: 'Ursling',   bad: 'Grubbear',  good: 'Grizzmore',  perfect: 'Ursalord',   secret: 'Starfur' },
    wolf:     { egg: 'Wolf Egg',     baby: 'Yip',    child: 'Pupper',   teen: 'Wolfling',  bad: 'Mangefang', good: 'Howlrunner', perfect: 'Lunaris',    secret: 'Nightveil' }
  };

  /* Care tuning per stage. Rates are "minutes per heart lost while awake". */
  var CARE = {
    baby:  { hungerMin: 30, happyMin: 35,  poopMin: 50,  sleep: [19, 7], weight: 5 },
    child: { hungerMin: 55, happyMin: 60,  poopMin: 100, sleep: [20, 7], weight: 12 },
    teen:  { hungerMin: 75, happyMin: 80,  poopMin: 130, sleep: [21, 8], weight: 22 },
    adult: { hungerMin: 90, happyMin: 100, poopMin: 160, sleep: [22, 8], weight: 35 }
  };
  var RULES = {
    maxHearts: 4, maxPoop: 4,
    firstDayGraceMin: 1440,  // 1.9.0: for this long after hatching (normal mode) every need window is doubled
    callGraceMin: 30,        // a real need (hungry/unhappy/sick call) left this long = 1 care mistake
    neglectRepeatMin: 180,   // ...and another every 3 h it stays unanswered
    poopGraceMin: 120,       // poop left 2 h = mistake
    sickGraceMin: 180,       // sickness untreated 3 h = mistake
    lightsGraceMin: 60,      // lights left on 1 h after falling asleep = mistake (once a night)
    snackWindowMin: 180, snackLimit: 3,   // 4th snack within 3 h = overfeeding mistake
    fakeCallPerHour: 0.10, fakeCallMin: 15,
    energyAwakeMin: 10,      // -1 energy every 10 min awake
    energySleepMin: 2,       // 1.8.2: +1 every 2 min asleep with lights off - naps AND night sleep (was 4)
    energySleepLitMin: 8,    // +1 every 8 min asleep with the lights left on (unchanged)
    napEnergy: 60,           // lights off in the day and energy under this = nap
    healthDrain: { hunger: 0.08, sick: 0.06, poop: 0.03, happy: 0.02 },  // per minute
    healthRegen: 0.12, healthRegenSleep: 0.2,
    runawayMin: 24 * 60,     // 24 h of being miserable (happy 0, discipline < 40) = runs away
    offlineMaxMistakes: 3,   // mercy: at most 3 mistakes per offline catch-up
    offlineHealthFloor: 20,  // mercy: absences under 24 h cannot take health below 20
    offlineMercyMin: 24 * 60,
    offlineMaxSimMin: 14 * 24 * 60,
    medicineDoses: { baby: 1, child: 1, teen: 2, adult: 2 },
    costs: { train: 12, game: 6, battle: 20 },   // 1.8.2: training 15 -> 12, play games 8 -> 6
    tiredEnergy: 30,         // 1.8.3: under this the pal LOOKS tired (droopy eyes, yawns, nodding, Zz in the status strip)
    trainDayFull: 8,         // 1.8.2 anti-farm: the first 8 trainings per pet-day pay in full; after that only 1 XP, no discipline/happy
    energyFood: { meal: 10, snack: 4 },
    praise: { earned: 12, spoil: 8, deedMin: 30, refuseEveryMin: 60, spoilHappyMin: 60 },  // 1.8.0: praise windows / caps (sim minutes)
    breedCooldownMin: 24 * 60,
    slots: 4
  };

  /* Evolution thresholds for the teen -> adult decision. */
  var EVO = {
    mistakePenalty: 5,
    perfect: { maxMistakes: 2, minScore: 90, minDiscipline: 50 },
    good: { minScore: 60 }
  };
  /* 1.9.7 secret adult forms: one per species. Each needs Champion-level care at the moment the
   * teen grows up (<= 2 mistakes, score >= 90, discipline >= 50) PLUS its own special condition
   * (checked in PP.Evolution.secretMet, fully deterministic). tilt = base stat points moved
   * between two stats, so the BP never beats the Champion form. hint = the Paldex silhouette text. */
  var SECRET = {
    croc:     { rule: 'hard',    tilt: { atk: 1, def: -1 }, hint: 'Raised in hard mode with Champion care.' },
    lion:     { rule: 'myth',    tilt: { spd: 1, def: -1 }, hint: 'Hatched after its keeper won the Myth Cup.' },
    eagle:    { rule: 'streak',  tilt: { def: 1, atk: -1 }, hint: 'Trained 6+ times a day, 4 pet-days in a row, while young.', days: 4, perDay: 6 },
    elephant: { rule: 'gen',     tilt: { def: 1, atk: -1 }, hint: 'A Champion of generation 3 or later.', gen: 3 },
    bear:     { rule: 'parents', tilt: { spd: 1, atk: -1 }, hint: 'Both parents were Champion or secret forms.' },
    wolf:     { rule: 'flawless', tilt: { def: 1, atk: -1 }, hint: 'A flawless life: 0 mistakes, discipline 90%+, score 95+.', discipline: 90, score: 95 }
  };

  var LEVEL = {
    xpNeed: function (lv) { return 20 + 15 * lv; },            // XP to go from lv to lv+1
    winXp: function (myLv, oppLv) { return 15 + 4 * oppLv + Math.max(0, oppLv - myLv) * 5; },
    lossXp: function (myLv, oppLv) { return 3 + oppLv; },
    trainXp: function (lv) { return 5 + lv; },
    ultimateLevel: 25
  };

  /* ---------------------------------------------------------------- moves
   * power: base damage, acc: %, cd: turns before re-use, pri: priority (goes first)
   * fx: list of effects {t:'stun'|'bleed'|'buff'|'debuff'|'heal'|'recoil'|'evade'|'skip', ...}
   */
  var MOVES = {
    // croc
    chomp:        { name: 'Chomp', power: 48, acc: 95 },
    tail_whip:    { name: 'Tail Whip', power: 25, acc: 100, cd: 2, fx: [{ t: 'debuff', stat: 'def', mult: 0.85, turns: 3 }] },   // 1.8.0 balance
    ambush_bite:  { name: 'Ambush Bite', power: 50, acc: 95, pri: 1, cd: 1 },   // 1.8.0 balance
    death_roll:   { name: 'Death Roll', power: 78, acc: 85, cd: 2, fx: [{ t: 'stun', chance: 0.3 }] },   // 1.8.0 balance
    swamp_soak:   { name: 'Swamp Soak', power: 0, acc: 100, cd: 3, uses: 2, fx: [{ t: 'heal', pct: 18 }] },   // 1.8.0 balance
    frenzy_bite:  { name: 'Frenzy Bite', power: 53, acc: 90, cd: 2, fx: [{ t: 'bleed', turns: 3 }] },   // 1.8.0 balance
    leviathan:    { name: 'Leviathan Crush', power: 100, acc: 80, cd: 4 },   // 1.8.0 balance
    claw_swipe:   { name: 'Claw Swipe', power: 45, acc: 95 },
    roar:         { name: 'Roar', power: 36, acc: 100, cd: 3, fx: [{ t: 'debuff', stat: 'atk', mult: 0.88, turns: 3 }] },   // a hit + smaller ATK debuff, so the AI actually uses it (like Howl)
    pounce:       { name: 'Pounce', power: 50, acc: 90, pri: 1, cd: 1 },
    kings_roar:   { name: "King's Roar", power: 34, acc: 100, cd: 3, fx: [{ t: 'buff', stat: 'atk', mult: 1.3, turns: 3 }] },   // 1.8.0 balance
    savage_maul:  { name: 'Savage Maul', power: 87, acc: 85, cd: 2 },   // 1.8.0 balance
    rending_fury: { name: 'Rending Fury', power: 28, acc: 90, cd: 2, hits: [2, 3] },
    sun_king:     { name: 'Sun King Strike', power: 58, acc: 90, cd: 4, crit: 1 },   // 1.8.0 balance
    peck:         { name: 'Peck', power: 43, acc: 100 },
    gust:         { name: 'Gust', power: 35, acc: 95, cd: 2, fx: [{ t: 'stun', chance: 0.2 }] },   // 1.8.0 balance
    dive_bomb:    { name: 'Dive Bomb', power: 68, acc: 85, cd: 2 },   // 1.8.0 balance
    feather_veil: { name: 'Feather Veil', power: 0, acc: 100, cd: 4, fx: [{ t: 'evade', add: 0.35, turns: 3 }] },   // 1.8.0 balance
    talon_rake:   { name: 'Talon Rake', power: 34, acc: 95, cd: 1, fx: [{ t: 'bleed', turns: 3 }] },   // 1.8.0 balance
    cyclone:      { name: 'Cyclone', power: 30, acc: 95, cd: 2, hits: [2, 2], fx: [{ t: 'debuff', stat: 'spd', mult: 0.8, turns: 3 }] },
    meteor_dive:  { name: 'Meteor Dive', power: 129, acc: 80, cd: 4, fx: [{ t: 'recoil', pct: 10 }] },
    // elephant
    trunk_slam:   { name: 'Trunk Slam', power: 45, acc: 95 },
    stomp:        { name: 'Stomp', power: 35, acc: 90, cd: 2, fx: [{ t: 'stun', chance: 0.25 }] },
    tusk_charge:  { name: 'Tusk Charge', power: 71, acc: 90, cd: 2 },   // 1.8.0 balance
    trumpet:      { name: 'Trumpet', power: 22, acc: 100, cd: 3, fx: [{ t: 'debuff', stat: 'def', mult: 0.75, turns: 3 }] },
    mud_bath:     { name: 'Mud Bath', power: 0, acc: 100, cd: 3, uses: 2, fx: [{ t: 'heal', pct: 25 }] },
    earthquake:   { name: 'Earthquake', power: 62, acc: 90, cd: 3, fx: [{ t: 'stun', chance: 0.3 }] },
    mammoth_quake:{ name: 'Mammoth Quake', power: 88, acc: 85, cd: 4, fx: [{ t: 'stun', chance: 0.3 }] },   // 1.8.0 balance
    maul:         { name: 'Maul', power: 44, acc: 95 },   // 1.8.0 balance
    bear_hug:     { name: 'Bear Hug', power: 35, acc: 95, cd: 2, fx: [{ t: 'debuff', stat: 'spd', mult: 0.75, turns: 3 }] },
    honey_snack:  { name: 'Honey Snack', power: 0, acc: 100, cd: 3, uses: 2, fx: [{ t: 'heal', pct: 25 }] },   // 1.8.0 balance
    hibernate:    { name: 'Hibernate', power: 0, acc: 100, cd: 4, uses: 1, fx: [{ t: 'heal', pct: 55 }, { t: 'skip' }] },
    rage:         { name: 'Rage', power: 0, acc: 100, cd: 3, fx: [{ t: 'buff', stat: 'atk', mult: 1.5, turns: 3 }, { t: 'buff', stat: 'def', mult: 0.9, turns: 3 }] },   // 1.8.0 balance
    crush_swipe:  { name: 'Crushing Swipe', power: 84, acc: 90, cd: 2 },   // 1.8.0 balance
    berserk_roar: { name: 'Berserk Roar', power: 64, acc: 90, cd: 3, fx: [{ t: 'buff', stat: 'atk', mult: 1.2, turns: 2, self: true }] },
    grizzly:      { name: 'Grizzly Rampage', power: 33, acc: 90, cd: 4, hits: [3, 3] },   // 1.8.0 balance
    bite:         { name: 'Bite', power: 46, acc: 95 },   // 1.8.0 balance
    howl:         { name: 'Howl', power: 36, acc: 100, cd: 3, fx: [{ t: 'buff', stat: 'atk', mult: 1.1, turns: 3 }] },   // a hit + small ATK buff, so the AI actually uses it (1.8.0: 30 -> 36)
    fang_bleed:   { name: 'Fang Bleed', power: 28, acc: 95, cd: 1, fx: [{ t: 'bleed', turns: 3 }] },
    lunge:        { name: 'Lunge', power: 60, acc: 95, pri: 1, cd: 1 },   // 1.8.0 balance
    moon_howl:    { name: 'Moon Howl', power: 32, acc: 100, cd: 3, fx: [{ t: 'buff', stat: 'atk', mult: 1.22, turns: 3 }, { t: 'buff', stat: 'spd', mult: 1.12, turns: 3 }] },
    frost_fang:   { name: 'Frost Fang', power: 76, acc: 90, cd: 2, fx: [{ t: 'debuff', stat: 'spd', mult: 0.8, turns: 3 }] },   // 1.8.0 balance
    lunar_hunt:   { name: 'Lunar Hunt', power: 64, acc: 95, cd: 4, fx: [{ t: 'bleed', turns: 3 }] }
  };

  /* ---------------------------------------------------------------- skill trees
   * tier 1: lv 1 (1 SP) - tier 2: lv 5 (2 SP) - tier 3: lv 12 (3 SP) - ultimate: lv 25 (4 SP)
   * req: learn ANY one of these first. kind: 'move' (adds a battle move) or 'passive'.
   */
  function T(id, name, tier, kind, val, req, desc) {
    var lv = [0, 1, 5, 12, 25][tier], cost = [0, 1, 2, 3, 4][tier];
    var s = { id: id, name: name, tier: tier, level: lv, cost: cost, kind: kind, req: req || [], desc: desc };
    if (kind === 'move') s.move = val; else s.passive = val;
    return s;
  }
  var SKILLS = {
    croc: [
      T('thick_hide', 'Thick Hide', 1, 'passive', { defPct: 6 }, null, 'DEF +6%'),
      T('ambush', 'Ambush Bite', 1, 'move', 'ambush_bite', null, 'Fast bite that strikes first'),
      T('death_roll', 'Death Roll', 2, 'move', 'death_roll', ['ambush'], 'Big spin: 30% stun'),
      T('swamp_soak', 'Swamp Soak', 2, 'move', 'swamp_soak', ['thick_hide'], 'Heal 18% HP (2x per battle)'),
      T('iron_jaw', 'Iron Jaw', 2, 'passive', { atkPct: 16 }, ['thick_hide', 'ambush'], 'ATK +16%'),
      T('ancient_scales', 'Ancient Scales', 3, 'passive', { lowHpGuard: 12 }, ['swamp_soak', 'iron_jaw'], 'Under 50% HP: take 12% less damage'),
      T('frenzy_bite', 'Frenzy Bite', 3, 'move', 'frenzy_bite', ['death_roll', 'iron_jaw'], 'Bite that causes bleeding'),
      T('leviathan', 'Leviathan Crush', 4, 'move', 'leviathan', ['ancient_scales', 'frenzy_bite'], 'Ultimate: crushing power')
    ],
    lion: [
      T('keen_claws', 'Keen Claws', 1, 'passive', { critAdd: 6 }, null, 'Crit chance +6%'),
      T('pounce', 'Pounce', 1, 'move', 'pounce', null, 'Leap that strikes first'),
      T('mane_guard', 'Mane Guard', 2, 'passive', { hpPct: 8 }, ['keen_claws', 'pounce'], 'HP +8%'),
      T('kings_roar', "King's Roar", 2, 'move', 'kings_roar', ['keen_claws'], 'Hit + ATK +30% for 3 turns'),
      T('savage_maul', 'Savage Maul', 2, 'move', 'savage_maul', ['pounce'], 'Heavy strike'),
      T('pride_heart', 'Pride Heart', 3, 'passive', { lowHpAtk: 55 }, ['mane_guard', 'kings_roar'], 'Under 30% HP: ATK +55%'),
      T('rending_fury', 'Rending Fury', 3, 'move', 'rending_fury', ['savage_maul', 'kings_roar'], 'Hits 2-3 times'),
      T('sun_king', 'Sun King Strike', 4, 'move', 'sun_king', ['pride_heart', 'rending_fury'], 'Ultimate: always a critical hit')
    ],
    eagle: [
      T('sharp_eyes', 'Sharp Eyes', 1, 'passive', { accAdd: 10, critAdd: 12 }, null, 'Accuracy +10%, crit +12%'),
      T('wind_riding', 'Wind Riding', 1, 'passive', { spdPct: 6 }, null, 'SPD +6%'),
      T('dive_bomb', 'Dive Bomb', 2, 'move', 'dive_bomb', ['wind_riding', 'sharp_eyes'], 'Steep power dive'),
      T('feather_veil', 'Feather Veil', 2, 'move', 'feather_veil', ['wind_riding'], '+35% dodge for 3 turns'),
      T('talon_rake', 'Talon Rake', 2, 'move', 'talon_rake', ['sharp_eyes'], 'Slash that causes bleeding'),
      T('sky_lord', 'Sky Lord', 3, 'passive', { dodgeAdd: 6 }, ['feather_veil', 'dive_bomb'], 'Always +6% dodge'),
      T('cyclone', 'Cyclone', 3, 'move', 'cyclone', ['talon_rake', 'dive_bomb'], 'Hits twice, slows foe'),
      T('meteor_dive', 'Meteor Dive', 4, 'move', 'meteor_dive', ['sky_lord', 'cyclone'], 'Ultimate: huge dive, small recoil')
    ],
    elephant: [
      T('thick_skin', 'Thick Skin', 1, 'passive', { defPct: 12 }, null, 'DEF +12%'),
      T('big_heart', 'Big Heart', 1, 'passive', { hpPct: 10 }, null, 'HP +10%'),
      T('tusk_charge', 'Tusk Charge', 2, 'move', 'tusk_charge', ['thick_skin', 'big_heart'], 'Charging tusk hit'),
      T('trumpet', 'Trumpet', 2, 'move', 'trumpet', ['thick_skin'], 'Foe DEF -25% for 3 turns'),
      T('mud_bath', 'Mud Bath', 2, 'move', 'mud_bath', ['big_heart'], 'Heal 25% HP (2x per battle)'),
      T('unshakable', 'Unshakable', 3, 'passive', { stunImmune: 1, dmgRed: 6 }, ['trumpet', 'mud_bath'], 'Cannot be stunned, -6% damage taken'),
      T('earthquake', 'Earthquake', 3, 'move', 'earthquake', ['tusk_charge', 'trumpet'], 'Quake: 30% stun'),
      T('mammoth_quake', 'Mammoth Quake', 4, 'move', 'mammoth_quake', ['unshakable', 'earthquake'], 'Ultimate: giant quake, 30% stun')
    ],
    bear: [
      T('honey_snack', 'Honey Snack', 1, 'move', 'honey_snack', null, 'Heal 25% HP (2x per battle)'),
      T('heavy_paws', 'Heavy Paws', 1, 'passive', { atkPct: 8 }, null, 'ATK +8%'),
      T('hibernate', 'Hibernate', 2, 'move', 'hibernate', ['honey_snack'], 'Heal 55%, then rest a turn (1x per battle)'),
      T('rage', 'Rage', 2, 'move', 'rage', ['heavy_paws'], 'ATK +50%, DEF -10% for 3 turns'),
      T('crush_swipe', 'Crushing Swipe', 2, 'move', 'crush_swipe', ['heavy_paws', 'honey_snack'], 'Heavy swipe'),
      T('iron_fur', 'Iron Fur', 3, 'passive', { defPct: 18 }, ['hibernate', 'crush_swipe'], 'DEF +18%'),
      T('berserk_roar', 'Berserk Roar', 3, 'move', 'berserk_roar', ['rage', 'crush_swipe'], 'Hit and raise own ATK'),
      T('grizzly', 'Grizzly Rampage', 4, 'move', 'grizzly', ['iron_fur', 'berserk_roar'], 'Ultimate: three brutal hits')
    ],
    wolf: [
      T('swift_paws', 'Swift Paws', 1, 'passive', { spdPct: 16 }, null, 'SPD +16%'),
      T('fang_bleed', 'Fang Bleed', 1, 'move', 'fang_bleed', null, 'Bite that causes bleeding'),
      T('pack_tactics', 'Pack Tactics', 2, 'passive', { fasterDmg: 17 }, ['swift_paws'], '+17% damage when faster than foe'),
      T('lunge', 'Lunge', 2, 'move', 'lunge', ['swift_paws', 'fang_bleed'], 'Quick lunge, strikes first'),
      T('moon_howl', 'Moon Howl', 2, 'move', 'moon_howl', ['fang_bleed'], 'Hit + ATK +22%, SPD +12% for 3 turns'),
      T('alpha', 'Alpha Instinct', 3, 'passive', { critAdd: 10 }, ['pack_tactics', 'moon_howl'], 'Crit chance +10%'),
      T('frost_fang', 'Frost Fang', 3, 'move', 'frost_fang', ['lunge', 'moon_howl'], 'Chilling bite, slows foe'),
      T('lunar_hunt', 'Lunar Hunt', 4, 'move', 'lunar_hunt', ['alpha', 'frost_fang'], 'Ultimate: savage hunt, bleeding')
    ]
  };

  /* Arena ladder: 12 ranks. Opponent level and form per rank. */
  /* Arena (1.8.4): every cup is a RUN of 3 foes - a challenger, a rival trainer and the cup boss -
   * beaten in a row (a loss or a forfeit ends the run). Clearing a cup earns its star, opens the
   * next cup and pays the cup-clear bonus once. foes: [species, form, level, role, name].
   * lv = the level your pal should have. Challengers use the form tier below at about that level,
   * rivals the cup form 2 levels lower, bosses the cup form 1 level lower with better genes (see
   * Arena.foe). Balance (tools: tests/battle.test.js 'arena balance'): an average Solid / Champion pal
   * at the cup level beats the challenger ~65-99%, the rival ~55-95%, the boss ~45-58% - a cup is
   * cleared in about 1 run out of 3. Winning the 12 main cups = Arena Champion, which opens the
   * post-game Myth Cup (4 Champion-form foes at the level cap). */
  var ARENA = [
    { name: 'Sprout Cup',   lv: 1,  form: 'bad', foes: [['wolf', 'bad', 1, 'challenger'], ['eagle', 'bad', 1, 'rival', 'Rex'], ['bear', 'bad', 1, 'boss', 'Chief Moss']] },
    { name: 'Pebble Cup',   lv: 3,  form: 'bad', foes: [['croc', 'bad', 1, 'challenger'], ['lion', 'bad', 1, 'rival', 'Juno'], ['elephant', 'bad', 2, 'boss', 'Chief Flint']] },
    { name: 'Puddle Cup',   lv: 6,  form: 'bad', foes: [['eagle', 'bad', 4, 'challenger'], ['wolf', 'bad', 4, 'rival', 'Kit'], ['croc', 'bad', 5, 'boss', 'Chief Marsh']] },
    { name: 'Meadow Cup',   lv: 9,  form: 'good', foes: [['bear', 'bad', 9, 'challenger'], ['elephant', 'good', 7, 'rival', 'Bram'], ['lion', 'good', 8, 'boss', 'Chief Clover']] },
    { name: 'River Cup',    lv: 12, form: 'good', foes: [['croc', 'bad', 12, 'challenger'], ['eagle', 'good', 10, 'rival', 'Nova'], ['wolf', 'good', 11, 'boss', 'Chief Brook']] },
    { name: 'Canyon Cup',   lv: 15, form: 'good', foes: [['lion', 'bad', 15, 'challenger'], ['bear', 'good', 13, 'rival', 'Pike'], ['elephant', 'good', 14, 'boss', 'Chief Mesa']] },
    { name: 'Forest Cup',   lv: 18, form: 'good', foes: [['wolf', 'bad', 18, 'challenger'], ['croc', 'good', 16, 'rival', 'Wren'], ['eagle', 'good', 17, 'boss', 'Chief Alder']] },
    { name: 'Summit Cup',   lv: 22, form: 'good', foes: [['elephant', 'bad', 20, 'challenger'], ['lion', 'good', 20, 'rival', 'Ash'], ['bear', 'good', 21, 'boss', 'Chief Crag']] },
    { name: 'Storm Cup',    lv: 26, form: 'good', foes: [['eagle', 'bad', 20, 'challenger'], ['wolf', 'good', 24, 'rival', 'Vale'], ['croc', 'good', 25, 'boss', 'Chief Gale']] },
    { name: 'Thunder Cup',  lv: 28, form: 'perfect', foes: [['bear', 'good', 28, 'challenger'], ['elephant', 'perfect', 26, 'rival', 'Onyx'], ['lion', 'perfect', 27, 'boss', 'Chief Volt']] },
    { name: 'Titan Cup',    lv: 33, form: 'perfect', foes: [['croc', 'good', 30, 'challenger'], ['eagle', 'perfect', 31, 'rival', 'Zed'], ['wolf', 'perfect', 32, 'boss', 'Chief Atlas']] },
    { name: 'Legend Cup',   lv: 38, form: 'perfect', foes: [['lion', 'perfect', 36, 'challenger'], ['bear', 'perfect', 36, 'rival', 'Sol'], ['elephant', 'perfect', 37, 'boss', 'Chief Aurum']] },
    { name: 'Myth Cup',     lv: 40, form: 'perfect', post: true, foes: [['wolf', 'perfect', 40, 'challenger'], ['eagle', 'perfect', 40, 'rival', 'Myra'], ['croc', 'perfect', 40, 'rival', 'Rex'], ['lion', 'perfect', 40, 'boss', 'The Myth']] }
  ];
  var ARENA_MAIN = 12;   // cups 1-12 make the ladder; the Myth Cup (13) is post-game

  /* Handheld shell colours. Free ones are available from the start; specials unlock.
   * unlock: { cup: n } = win arena cup number n (1-based), { champion: true } = win every cup,
   *         { dex: n } = n different adult forms raised (Paldex).
   * Colours: base/dark/lite = shell gradient, ring = outer rim, label = text printed on the shell. */
  var SHELLS = [
    { id: 'pink',   name: 'Bubblegum', base: '#e85a71', dark: '#c43c55', lite: '#f2788c', ring: '#b83550', rim: '#f9b4c0', label: 'light' },
    { id: 'red',    name: 'Cherry',    base: '#d63a3a', dark: '#a82222', lite: '#ec5c5c', ring: '#8e1b1b', rim: '#f5a3a3', label: 'light' },
    { id: 'orange', name: 'Tangerine', base: '#f07b25', dark: '#c85c10', lite: '#fa9a4c', ring: '#a84c0c', rim: '#fdc99a', label: 'light' },
    { id: 'yellow', name: 'Sunshine',  base: '#f4c93a', dark: '#d6a514', lite: '#fbe06e', ring: '#b08410', rim: '#fff0b0', label: 'dark' },
    { id: 'lime',   name: 'Lime Pop',  base: '#9ccc3c', dark: '#76a41e', lite: '#bce26a', ring: '#5c8416', rim: '#dcf2a8', label: 'dark' },
    { id: 'teal',   name: 'Lagoon',    base: '#1fa39a', dark: '#12776f', lite: '#45c2b8', ring: '#0c5f58', rim: '#9fe3dd', label: 'light' },
    { id: 'blue',   name: 'Ocean',     base: '#3a6fd8', dark: '#2450a8', lite: '#5d8ff0', ring: '#1b3f8a', rim: '#a9c3f7', label: 'light' },
    { id: 'purple', name: 'Grape',     base: '#8a4fd0', dark: '#6533a6', lite: '#a674ea', ring: '#4f2685', rim: '#d2b5f5', label: 'light' },
    { id: 'black',  name: 'Midnight',  base: '#34343f', dark: '#1d1d26', lite: '#4b4b5a', ring: '#101016', rim: '#6a6a7c', label: 'light' },
    { id: 'white',  name: 'Snow',      base: '#eceae4', dark: '#cfccc2', lite: '#faf9f5', ring: '#a9a699', rim: '#ffffff', label: 'dark' },
    { id: 'silver', name: 'Silver',    base: '#c3c9d0', dark: '#8d959e', lite: '#eef1f4', ring: '#6d757e', rim: '#f5f7f9', label: 'dark', finish: 'silver', unlock: { cup: 4 } },
    { id: 'clear',  name: 'Crystal',   base: '#a9d8f0', dark: '#6fb0d4', lite: '#dff3fc', ring: '#5d9cc0', rim: '#e8f8ff', label: 'dark', finish: 'clear', unlock: { dex: 6 } },
    { id: 'glitter',name: 'Glitter',   base: '#c052b8', dark: '#8e2f8a', lite: '#e07ad8', ring: '#6e2170', rim: '#f4c2f0', label: 'light', finish: 'glitter', unlock: { dex: 12 } },
    { id: 'gold',   name: 'Gold',      base: '#e3b62e', dark: '#b08312', lite: '#fbe27a', ring: '#8a6508', rim: '#fff1b8', label: 'dark', finish: 'gold', unlock: { champion: true } },
    // 1.9.0: seasonal shells (all 3 daily goals on 3 days in the season) and the golden-egg shell
    { id: 'spooky',  name: 'Spooky',    base: '#f08a24', dark: '#b85a0c', lite: '#ffb066', ring: '#2a1f2e', rim: '#ffd9a8', label: 'dark', finish: 'spooky', unlock: { season: 'spooky' } },
    { id: 'frost',   name: 'Frost',     base: '#bfe3f5', dark: '#86bcd8', lite: '#eef9ff', ring: '#5d95b5', rim: '#ffffff', label: 'dark', finish: 'frost', unlock: { season: 'frost' } },
    { id: 'blossom', name: 'Blossom',   base: '#f6b8cf', dark: '#de86a8', lite: '#fde0ea', ring: '#b85c82', rim: '#fff3f7', label: 'dark', finish: 'blossom', unlock: { season: 'blossom' } },
    { id: 'gilded',  name: 'Gilded',    base: '#d9a521', dark: '#946b0a', lite: '#f7d873', ring: '#5e4305', rim: '#fff0b8', label: 'dark', finish: 'gilded', unlock: { golden: true } },
    // extra plain colours sold in the Pal Store (special finishes above are earn-only)
    { id: 'mint',     name: 'Mint',      base: '#6fd3a8', dark: '#44ad82', lite: '#98e6c4', ring: '#2f8c66', rim: '#d0f5e4', label: 'dark',  price: 60 },
    { id: 'coral',    name: 'Coral',     base: '#f47c6a', dark: '#d35846', lite: '#fb9d8f', ring: '#b04234', rim: '#fdd0c8', label: 'light', price: 60 },
    { id: 'navy',     name: 'Navy',      base: '#27406e', dark: '#172a4d', lite: '#3a5a92', ring: '#0e1b33', rim: '#6c86b6', label: 'light', price: 80 },
    { id: 'lavender', name: 'Lavender',  base: '#b9a2e8', dark: '#9479cf', lite: '#d3c3f5', ring: '#7258b0', rim: '#ece4fc', label: 'dark',  price: 80 }
  ];

  /* ---------------------------------------------------------------- Pal Store
   * Coins: earned by playing, spent on extras. Basic care (meal, snack, medicine,
   * clean) always stays FREE, so a pal can never suffer for lack of coins. */
  var ECONOMY = {
    startCoins: 30,
    battleWin: function (oppLv) { return 4 + Math.floor(oppLv / 3); },   // Lv1: 4, Lv15: 9, Lv38: 16
    battleLoss: 1,
    arenaBonus: function (rank) { return 2 + rank; },                     // extra per arena win (cup 1: +2 ... cup 12: +13)
    cupClear: function (rank) { return 15 + rank * 5; },                  // first time you beat cup n (1-based rank: 20..75)
    champion: 100,                                                         // winning all 12 main cups (Arena Champion)
    myth: 120,                                                             // first Myth Cup clear (post-game)
    trainWin: 3, trainLoss: 1,                                             // any training / mini-game
    dailyCap: 150,                                                         // battle + training coins per game day (bonuses excluded)
    daily: function (streak) { return 10 + Math.min(4, Math.max(0, streak - 1)) * 2; },  // 10 .. 18 for a 5-day streak
    careBonus: 5,                                                          // daily: no new care mistakes since yesterday's bonus
    maxCoins: 99999, maxStack: 99
  };
  /* kind: food (Feed menu), med (Medicine), energy, boost (permanent, capped), */
  var ITEMS = {
    cake:    { name: 'Berry Cake',     price: 8,  kind: 'food',   desc: 'Happy +2, weight +3. Counts as a snack (overfeeding rule!)' },
    feast:   { name: 'Deluxe Feast',   price: 12, kind: 'food',   desc: 'Hunger +2, happy +1, energy +15, weight +2' },
    tonic:   { name: 'Energy Tonic',   price: 10, kind: 'energy', desc: 'Energy +50 (not while asleep)' },
    remedy:  { name: 'Super Medicine', price: 15, kind: 'med',    desc: 'Cures sickness in ONE dose, health +20. Only when sick' },
    protein: { name: 'Protein',        price: 40, kind: 'boost', stat: 'atk', desc: 'ATK +2% for good (max 2 per stat, 4 in total per pal)' },
    iron:    { name: 'Iron Tonic',     price: 40, kind: 'boost', stat: 'def', desc: 'DEF +2% for good (max 2 per stat, 4 in total per pal)' },
    feather: { name: 'Swift Feather',  price: 40, kind: 'boost', stat: 'spd', desc: 'SPD +2% for good (max 2 per stat, 4 in total per pal)' },
    vitamin: { name: 'Vitamins',       price: 40, kind: 'boost', stat: 'hp',  desc: 'HP +2% for good (max 2 per stat, 4 in total per pal)' }
  };
  var BOOST = { pct: 2, perStat: 2, total: 4 };
  /* Pal Box: start with 4 slots, buy one more at a time up to 12. */
  var BOX = { start: 4, max: 12, prices: [100, 150, 200, 275, 350, 450, 575, 700] };  // price of slot 5, 6, ... 12

  var NAME_BITS = {
    a: ['Bo', 'Ki', 'Ru', 'Mo', 'Pip', 'Zu', 'Ta', 'Lu', 'Fen', 'Gri', 'Sa', 'No', 'Ja', 'Wi', 'Du', 'Ro'],
    b: ['ko', 'bo', 'ri', 'la', 'mi', 'zo', 'nu', 'x', 'ka', 'po', 'de', 'wy', 'lo', 'ti', 'ga', 'm']
  };

  PP.DATA = {
    VERSION: '1.9.8',          // 1.9.2: the optional cloudflare-worker.js reports this same version again (no separate WORKER_VERSION)
    SPECIES: SPECIES, SPECIES_INFO: SPECIES_INFO, STAGES: STAGES, STAGE_MIN: STAGE_MIN,
    FORMS: FORMS, FORM_INFO: FORM_INFO, NAMES: NAMES, CARE: CARE, RULES: RULES, EVO: EVO, SECRET: SECRET,
    LEVEL: LEVEL, MOVES: MOVES, SKILLS: SKILLS, ARENA: ARENA, ARENA_MAIN: ARENA_MAIN, NAME_BITS: NAME_BITS, SHELLS: SHELLS,
    ECONOMY: ECONOMY, ITEMS: ITEMS, BOOST: BOOST, BOX: BOX
  };
})(typeof window !== 'undefined' ? window : globalThis);
