/* PocketPal 2 - computer arena ladder (pure). 12 cups; beat a cup to unlock the next. */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};
  var U = PP.util, D = PP.DATA;

  function opponent(rank, attempt, seed) {
    rank = U.clamp(rank | 0, 0, D.ARENA.length - 1);
    var cup = D.ARENA[rank];
    var rng = U.makeRng(U.hash('arena', rank, attempt | 0, seed | 0));
    var species = rng.pick(D.SPECIES);
    var level = Math.min(PP.Stats.levelCap(cup.form), Math.max(1, cup.lv + rng.int(-1, 1)));
    var genes = PP.Pet.randomGenes(rng);
    var card = { id: 'cpu' + rank + (attempt | 0), name: PP.Pet.randomName(rng), species: species, sex: rng.chance(0.5) ? 'M' : 'F',
      form: cup.form, level: level, genes: { hp: genes.hp, atk: genes.atk, def: genes.def, spd: genes.spd },
      skills: [], innate: [], gen: 1, stage: 'adult', sp: PP.Stats.totalSpForLevel(level) };
    PP.Skills.autoLearn(card, rng);
    delete card.sp;
    card.cup = cup.name; card.rank = rank;
    return card;
  }

  PP.Arena = { opponent: opponent, cups: D.ARENA };
})(typeof window !== 'undefined' ? window : globalThis);
