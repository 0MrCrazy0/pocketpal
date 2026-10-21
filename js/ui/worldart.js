/* PocketPal 2.4.0 - LCD pixel art for the wider world: hats, toys and garden decorations (PP.World.THINGS), the
 * seasonal touches on the home screen, and the trip / visit scenes. Every picture is a tiny map of LCD pixels in the
 * four screen greens (k ink, d dark, m mid, l lite, . clear), drawn with fillRect so it stays crisp at any size.
 * Hats sit on the head-top anchors the sprite generator logs for every frame (PP.ATLAS.hat). */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};

  /* facing right; mirrored when the pal faces left. Hats: bottom-centre on the anchor. Toys / decos: bottom-left. */
  var ART = {
    bow: ['kk.....kk', 'kdkk.kkdk', 'kddkkkddk', 'kdkk.kkdk', 'kk.....kk'],
    cap: ['..kkkkk....', '.kdddddk...', 'kdlldddk...', 'kddddddkkkk', 'kkkkkkkkkkk'],
    sunhat: ['....kkkkk....', '...kmllmmk...', '...kdddddk...', '.kkkkkkkkkkk.', 'kmmmmmmmmmmmk', 'kkkkkkkkkkkkk'],
    leafcrown: ['.k...k...k.', 'kmk.kmk.kmk', 'kmmkmmmkmmk', 'kddddddddk.', '.kkkkkkkk..'],
    crown: ['k...k...k', 'kk.klk.kk', 'klkklkklk', 'klllllllk', 'kdlldlldk', 'kkkkkkkkk'],
    witch: ['.......kk....', '......kdk....', '.....kddk....', '.....kddk....', '....kdddk....', '....kddddk...', '...kkkkkkk...', '...klllllk...', 'kkkkkkkkkkkkk', '.kkkkkkkkkkk.'],
    santa: ['.......kk..', '......kllk.', '....kkkllk.', '...kddkkk..', '..kddddk...', '.kdddddk...', 'kllllllllk.', 'kkkkkkkkkk.'],
    bunny: ['.kk...kk.', 'klk..klk.', 'klk..klk.', 'kdk..kdk.', 'kdk..kdk.', 'klk..klk.', '.kk..kk..'],
    heirloom: ['kk.....kk', 'klkkkkklk', 'kllkdkllk', 'klk.k.klk', 'kk.k.k.kk'],
    ball: ['..kkkk..', '.kllmmk.', 'klllmmmk', 'kllkkmdk', 'kmkmmkdk', 'kmmmmddk', '.kmdddk.', '..kkkk..'],
    blocks: ['...kkkkk...', '...klllk...', '...klklk...', '...kkkkk...', 'kkkkkkkkkkk', 'kmmmkkdddk.', 'kmkmkkdkdk.', 'kmmmkkdddk.', 'kkkkkkkkkk.'],
    shell: ['....k....', '..kkmkk..', '.kmklkmk.', 'kmlkmklmk', 'kmlkmklmk', '.kkkkkkk.'],
    pinecone: ['..kk..', '.kddk.', 'kdmmdk', 'kmddmk', 'kdmmdk', 'kmddmk', '.kdmk.', '..kk..'],
    robot: ['...k....', '..kkk...', '.kkkkkk.', '.klkklk.', '.kkkkkk.', 'kkmmmmkk', 'kkmddmkk', '.kmmmmk.', '.kk..kk.', '.kk..kk.'],
    pumpkin: ['....kk....', '..kkkkkk..', '.kmmmmmmk.', 'kmllmmllmk', 'kmmmmmmmmk', 'kmllllllmk', '.kmlmmlmk.', '..kkkkkk..'],   // a lit face (it glows at night)
    snowman: ['..kkk..', '.klllk.', '.klklk.', '.klllk.', '..kkk..', '.klllk.', 'klldllk', 'klllllk', 'kllldlk', 'klllllk', '.kkkkk.'],
    basket: ['..kkkkkk..', '.k......k.', 'k.kl..lk.k', 'kkkkkkkkkk', 'kdmdmdmdmk', 'kmdmdmdmdk', '.kdmdmdmk.', '..kkkkkk..'],
    flowers: ['.k....k...', 'klk..klk..', '.k.kk.k...', '.k.klk.k..', '..k.k.k...', '...kkk....', '.kkkkkkk..', '.kdddddk..', '..kdddk...', '..kdddk...', '..kkkkk...'],
    sign: ['.kkkkkkkkkk.', 'klllllllllkk', 'klkkllkklllk', 'klllllllllkk', '.kkkkkkkkkk.', '.....kk.....', '.....kk.....', '.....kk.....', '.....kk.....', '....kkkk....'],
    sandcastle: ['..k.......k.....', '.kkk.....kkk....', '.kmk.k.k.kmk....', '.kmkkkkkkkmk....', '.kmmmmmmmmmk....', '.kmmkkkkmmmk....', '.kmmk..kmmmk....', 'kkkkkkkkkkkkk...'],
    mushroom: ['...kkkkk......', '..klldllk.....', '.kldllldlk....', '.kkkkkkkkk.kk.', '....klk...kdlk', '....klk..kkkkk', '....klk....kk.', '...kkkkk...kk.'],
    lamp: ['.kkkkk.', 'klllllk', 'klllllk', '.kkkkk.', '...k...', '...k...', '...k...', '...k...', '...k...', '...k...', '...k...', '...k...', '...k...', '...k...', '..kkk..', '.kkkkk.'],
    forestgem: ['....kkkk......', '..kkmmmmkk....', '.kmdmmmdmmk...', 'kmmmmdmmmmk...', 'kdmmmmmmdmk.k.', 'kkkkkkkkkkkkdk', '..........kkkk'],
    ghost: ['...kkkkk...', '..klllllk..', '.klllllllk.', '.klklllklk.', '.klllllllk.', '.kllkkkllk.', '.klllllllk.', '.klllllllk.', '.klklklklk.', '.k.k.k.k.k.'],
    gifts: ['...k..k.........', '....kk..........', '.kkkkkkkk.......', '.kddldddk..kkkkk', '.kkkkkkkk..klmlk', '.kddldddk..kkkkk', '.kddldddk..klmlk', 'kkkkkkkkkkkkkkkk'],
    // 2.5.0 (approved art-2500/new-items-sheet.png): tophat took the bowtie's place
    tophat: ['..kkkkkkk..', '..kdddddk..', '..kdddddk..', '..kdddddk..', '..kmmmmmk..', '..kdddddk..', 'kkkkkkkkkkk', '.kkkkkkkkk.'],
    pirate: ['.....kkk.....', '...kkdddkk...', '..kddlklddk..', '.kddddlddddk.', 'kkdddddddddkk', 'kmkkkkkkkkkmk', 'kk.........kk'],
    flowercrown: ['.k...k...k.', 'klk.klk.klk', 'kdkmkdkmkdk', '.kkkkkkkkk.'],
    party: ['...kkk...', '...klk...', '...kkk...', '...kdk...', '..kmmmk..', '..kdddk..', '.kmmmmmk.', '.kdddddk.', 'kmmmmmmmk', 'kkkkkkkkk'],
    wizard: ['........kk...', '.......kdk...', '......kddk...', '.....kdldk...', '.....kddddk..', '....kdlddddk.', '....kddddldk.', '...kdddddddk.', 'kkkkkkkkkkkkk', '.kmmmmmmmmmk.', '..kkkkkkkkk..'],
    kite: ['....k....', '...kdk...', '..kdklk..', '.kddkllk.', 'kkkkkkkkk', '.kllkddk.', '..klkdk..', '...kdk...', '....k....', '....k....', '...kk....', '....k.k..', '......k..'],
    teddy: ['.kk...kk.', 'kmmkkkmmk', '.kmmmmmk.', '.kmkmkmk.', '.kmmkmmk.', '..kkkkk..', '.kmmlmmk.', 'kmmlllmmk', 'kmmmlmmmk', '.kkk.kkk.'],
    yoyo: ['...k...', '...k...', '...k...', '.kkkkk.', 'kdmlmdk', 'kmlklmk', 'kdmlmdk', '.kkkkk.'],
    drum: ['k.........k', '.k.......k.', '..kkkkkkk..', '.klllllllk.', '.kkkkkkkkk.', '.kmdmdmdmk.', '.kdmdmdmdk.', '.kmdmdmdmk.', '..kkkkkkk..'],
    duck: ['.kkkk.....', 'kllllk....', 'kllkllkdd.', 'kllllkddd.', '.kllllkk..', 'kllllllllk', 'kllllllllk', '.kkkkkkkk.'],
    bench: ['kkkkkkkkkkkkkkkk', 'kddddddddddddddk', 'kkkkkkkkkkkkkkkk', 'kddddddddddddddk', 'kkkkkkkkkkkkkkkk', '.kk..........kk.', '.kk..........kk.', '.kk..........kk.'],
    pond: ['....kkkkkkkkkk....', '..kkddllddddddkk..', '.kddddddddkmmkddk.', 'kddlddddddkmmkdddk', '.kkddddddddddddkk.', '...kkkkkkkkkkkk...'],
    swing: ['kkkkkkkkkkkkkk', '.k..k....k..k.', '.k..k....k..k.', '.k..k....k..k.', '.k..k....k..k.', '.k..k....k..k.', '.k..k....k..k.', '.k..k....k..k.', '.k..k....k..k.', '.k..kkkkkk..k.', '.k..kddddk..k.', '.k..kkkkkk..k.', '.k..........k.', 'kkk........kkk'],
    birdhouse: ['....k....', '...kdk...', '..kdddk..', '.kdddddk.', 'kkkkkkkkk', '.klllllk.', '.kllkllk.', '.klllllk.', '.kkkkkkk.', '....k....', '....k....', '....k....', '....k....', '....k....', '....k....', '...kkk...'],
    tent: ['.......kk.......', '......kmmk......', '.....kmmmmk.....', '....kmmkkmmk....', '...kmmkddkmmk...', '..kmmkddddkmmk..', '.kmmkddddddkmmk.', 'kmmkddddddddkmmk', 'kkkkkkkkkkkkkkkk'],
    flag: ['k.......', 'kkkkkk..', 'kllllkk.', 'klllllk.', 'kllllkk.', 'kkkkkk..', 'k.......', 'k.......', 'k.......', 'k.......', 'k.......', 'k.......', 'kk......', 'kkk.....'],
    snowflake: ['.l.l.', '..l..', 'lllll', '..l..', '.l.l.'],
    blossom: ['.l.', 'lkl', '.l.'],
    eggs: ['..kk.....kk...', '.kdlk...kmmk..', 'kllllk.klkklk.', 'kdddlk.kmmmmk.', 'kllllk.kkllkk.', '.kkkk...kkkk..']
  };
  var COL = function () { return PP.Render.C; };
  function pix(ch, night, glow) {
    var C = COL();
    if (night) return ch === '.' ? null : glow && ch === 'l' ? C.lite : C.ink;   // a silhouette at night (a lamp, a jack-o-lantern and the ghost still glow)
    return ch === 'k' ? C.ink : ch === 'd' ? C.dark : ch === 'm' ? C.mid : ch === 'l' ? C.lite : null;
  }
  function size(id) { var a = ART[id]; return a ? [a[0].length, a.length] : [0, 0]; }
  /* x, y = top-left in LCD px; s = scale (whole LCD px per art pixel) */
  var GLOW = { lamp: 1, pumpkin: 1, ghost: 1 };   // things whose light pixels still show at night
  function drawArt(ctx, id, x, y, s, flip, night) {
    var a = ART[id]; if (!a) return;
    s = s || 1; x = Math.round(x * 5) / 5; y = Math.round(y * 5) / 5;   // on the x5 backing grid: crisp at 1.2 / 1.4 / 1.6 / 2 too
    var w = a[0].length;
    for (var r = 0; r < a.length; r++) for (var c = 0; c < w; c++) {
      var col = pix(a[r][c], night, GLOW[id]); if (!col) continue;
      ctx.fillStyle = col; ctx.fillRect(x + (flip ? w - 1 - c : c) * s, y + r * s, s, s);
    }
  }

  /* ---------------------------------------------------------------- hats on the pal */
  var cache = {};
  function anchor(species, stageKey, pose, frame) {
    var A = PP.ATLAS, H = A && A.hat; if (!H || !H.data[species]) return null;
    var si = A.stages.indexOf(stageKey), pi = A.poses.indexOf(pose); if (si < 0 || pi < 0) return null;
    var i = ((si * A.poses.length + pi) * A.framesPerPose + PP.Sprites.frameIndex(frame || 0)) * 2;
    var k = species + i; if (k in cache) return cache[k];
    var s = H.data[species].slice(i, i + 2), x = H.abc.indexOf(s[0]), y = H.abc.indexOf(s[1]);
    return (cache[k] = s.length === 2 && x >= 0 && y >= 0 ? [x, y] : null);
  }
  var HAT_SINK = 2;   // LCD px the brim overlaps the head
  var HAT_SCALE = { baby: 1.8, child: 1.8, teen: 1.8, adult: 2 };   // LCD px per art pixel (2.5.0: young pals 1.8 - their big heads made 1.2-1.6 hats tiny)
  /* px, y = the pal's top-left on screen (96 px cell = 80 sheet px x 1.2). Hidden in poses without a head-top anchor. */
  function drawHat(ctx, hatId, species, stageKey, pose, frame, px, y, flip, night, petScale) {
    if (!hatId || !ART[hatId] || stageKey === 'egg') return false;
    var a = anchor(species, stageKey, PP.Sprites.shownPose(pose), frame); if (!a) return false;
    var r = petScale ? petScale / PP.Render.PET : 1;              // 2.4.93: a pal drawn smaller (young pal in battle) gets a smaller hat
    var k = PP.Render.PS * r / PP.ATLAS.frame, sz = size(hatId);
    var s = (HAT_SCALE[stageKey.split('_')[0]] || 2) * r;
    var ax = px + (flip ? PP.ATLAS.frame - a[0] : a[0]) * k, ay = y + a[1] * k + HAT_SINK;
    drawArt(ctx, hatId, ax - sz[0] * s / 2, ay - sz[1] * s, s, flip, night);
    return true;
  }

  /* 2.5.0: a hat on an HTML thumbnail (menus): a small canvas picture of the hat (cached data URL), placed over the CSS
   * sprite cell at the same head-top anchor and scale the LCD uses, sized in LCD px (n = the thumbnail size) */
  var hurls = {};
  function hatURL(id) {
    var C = PP.Render && PP.Render.C, key = id + (C ? C.ink + C.lite : '');
    if (hurls[key] !== undefined) return hurls[key];
    var a = ART[id], doc = root.document; if (!a || !doc || !C) return null;
    var c = doc.createElement('canvas'); c.width = a[0].length; c.height = a.length;
    var g = c.getContext && c.getContext('2d'); if (!g) return (hurls[key] = null);
    drawArt(g, id, 0, 0, 1, false, false);
    return (hurls[key] = c.toDataURL());
  }
  function hatCss(species, stageKey, pose, hatId, n) {
    if (!hatId || !ART[hatId] || !stageKey || stageKey === 'egg') return '';
    var an = anchor(species, stageKey, PP.Sprites.shownPose(pose || 'idle'), 0), url = an && hatURL(hatId); if (!url) return '';
    var k = n / PP.ATLAS.frame, sz = size(hatId), s = (HAT_SCALE[stageKey.split('_')[0]] || 2) * n / PP.Render.PS;
    var u = function (v) { return 'calc(' + (Math.round(v * 100) / 100) + ' * var(--u))'; };
    return '<i class="thumb-hat" aria-hidden="true" style="background-image:url(' + url + ');left:' + u(an[0] * k - sz[0] * s / 2) + ';top:' + u(an[1] * k + HAT_SINK * n / PP.Render.PS - sz[1] * s) +
      ';width:' + u(sz[0] * s) + ';height:' + u(sz[1] * s) + '"></i>';
  }

  /* ---------------------------------------------------------------- the room: toy + decoration (behind the pal) */
  /* the decoration stands far left (left of the left tree's trunk), the toy on the grass between the trees; both behind
   * the pal, under the tree tops and well clear of the poop pile (right) */
  var SPOT = { deco: { x: 55, bottom: 137, s: 2.2 }, toy: { x: 90, bottom: 138, s: 1.6 } };
  /* 2.5.0: every placed thing (shown.placed = [{ id, x }]), garden items first so toys stand in front; the bottom on the
   * grass line. wob = { id: 0..1 } a toy being played with (ball bounce, kite rises, duck squeaks...). ghost = the item
   * being placed (a dotted frame round it). */
  function kindOf(id) { var T = PP.World && PP.World.thing(id); return T ? T.kind : 'toy'; }
  function spotOf(id) { return SPOT[kindOf(id) === 'deco' ? 'deco' : 'toy']; }
  function widthOf(id) { return Math.ceil(size(id)[0] * spotOf(id).s); }
  function itemBox(id, x) { var sp = spotOf(id), z = size(id); return { x: x, y: sp.bottom - z[1] * sp.s, w: z[0] * sp.s, h: z[1] * sp.s }; }
  function drawItem(ctx, id, x, night, t, wob) {
    var sp = spotOf(id), z = size(id), dy = 0, dx = 0;
    if (id === 'ghost' && t) dy = Math.round(Math.sin(t / 500)) - 2;
    if (wob != null) {
      var w = Math.sin(wob * Math.PI);
      if (id === 'ball') dy -= Math.round(10 * Math.abs(Math.sin(wob * Math.PI * 3)));
      else if (id === 'kite') dy -= Math.round(14 * w);
      else if (id === 'yoyo') dy += Math.round(4 * Math.sin(wob * Math.PI * 4));
      else dx = Math.round(Math.sin(wob * Math.PI * 6) * 1.5);
    }
    drawArt(ctx, id, x + dx, sp.bottom - z[1] * sp.s + dy, sp.s, false, night);
  }
  function drawRoom(ctx, shown, night, t, wobs, ghost) {
    if (!shown) return;
    var list = (shown.placed || []).slice().sort(function (a, b) { return (kindOf(a.id) === 'deco' ? 0 : 1) - (kindOf(b.id) === 'deco' ? 0 : 1); });
    list.forEach(function (e) { if (!ghost || ghost.id !== e.id) drawItem(ctx, e.id, e.x, night, t, wobs && wobs[e.id]); });
    if (ghost && ART[ghost.id]) {
      drawItem(ctx, ghost.id, ghost.x, night, t);
      var b = itemBox(ghost.id, ghost.x), C = COL(), on = !t || Math.floor(t / 300) % 2 === 0;
      ctx.fillStyle = C.ink;
      for (var q = -2; q < b.w + 2; q += 2) { if (on) { ctx.fillRect(b.x + q, b.y - 2, 1, 0.6); ctx.fillRect(b.x + q, b.y + b.h + 1, 1, 0.6); } }
      for (var r = -2; r < b.h + 2; r += 2) { if (on) { ctx.fillRect(b.x - 2, b.y + r, 0.6, 1); ctx.fillRect(b.x + b.w + 1, b.y + r, 0.6, 1); } }
    }
  }

  /* ---------------------------------------------------------------- seasonal touches on the home screen */
  function drawEvent(ctx, ev, phase, t, still) {
    if (!ev) return;
    var C = COL(), R = PP.Render, top = R.LAYOUT.stripEnd, tt = still ? 0 : t, night = phase === 'night';
    if (ev === 'winter') {                                      // 2.5.0 season: drifting snowflakes + snow on the grass and tree tops
      for (var sf = 0; sf < 9; sf++) {
        var sx = Math.round((sf * 37 + Math.sin(tt / 900 + sf) * 6) % R.W), sy2 = Math.round(top + 4 + ((tt / 60 + sf * 23) % (R.FLOOR_TOP - top - 8)));
        drawArt(ctx, 'snowflake', sx, sy2, sf % 3 === 0 ? 1.4 : 1, false, false);
      }
      ctx.fillStyle = C.lite; ctx.fillRect(0, R.FLOOR_TOP, R.W, 2);
      R.TREES.forEach(function (q) { var cy = R.FLOOR_TOP - q.h + q.r; R.fshape(ctx, q.x - q.r, cy - q.r - 1, q.x + q.r, cy - q.r * 0.3, function (u, v) { return R.inDisc(u, v, q.x, cy, q.r) && v < cy - q.r * 0.35; }); });
      return;
    }
    if (ev === 'spring') {                                      // 2.5.0 season: blossoms on both trees + petals drifting down
      R.TREES.forEach(function (q) {
        var cy = R.FLOOR_TOP - q.h + q.r;
        [[-0.6, -0.4], [0.2, -0.75], [0.65, -0.1], [-0.2, 0.25], [0.5, 0.5], [-0.75, 0.35]].forEach(function (o) { drawArt(ctx, 'blossom', Math.round(q.x + o[0] * q.r) - 1, Math.round(cy + o[1] * q.r) - 1, 1, false, night); });
      });
      for (var pt = 0; pt < 6; pt++) { var ppx = Math.round((pt * 41 + tt / 45) % R.W), ppy = Math.round(top + 10 + ((pt * 29 + tt / 30) % (R.FLOOR_TOP - top - 14))); ctx.fillStyle = night ? C.ink : C.lite; ctx.fillRect(ppx, ppy, 1, 1); ctx.fillStyle = C.ink; ctx.fillRect(ppx + 1, ppy, 1, 1); }
      return;
    }
    if (ev === 'halloween') {
      // 2.6.0: the two flapping bats are gone (they read as birds drifting like clouds)
      drawArt(ctx, 'pumpkin', 152, R.FLOOR_TOP + 6 - 8 * 1.6, 1.6, false, night);   // a jack-o-lantern by the right tree
    } else if (ev === 'christmas') {
      ctx.fillStyle = C.lite;                                      // gentle snow
      for (var f = 0; f < 14; f++) {
        var fx = Math.round((f * 29 + Math.sin(tt / 900 + f) * 4) % R.W), fy = Math.round(top + ((tt / 40 + f * 17) % (R.FLOOR_TOP - top)));
        ctx.fillRect(fx, fy, 1, 1);
      }
      var tr = R.TREES[0], sy = R.FLOOR_TOP - tr.h - 4;              // a star on the left tree, baubles on both
      ctx.fillStyle = C.ink; ctx.fillRect(tr.x - 1, sy, 3, 3); ctx.fillRect(tr.x, sy - 1, 1, 5); ctx.fillRect(tr.x - 2, sy + 1, 5, 1);
      ctx.fillStyle = night ? C.dark : C.lite; ctx.fillRect(tr.x, sy + 1, 1, 1);
      R.TREES.forEach(function (q, i) {
        var cy = R.FLOOR_TOP - q.h + q.r;
        [[-q.r * 0.6, 2], [q.r * 0.5, -2], [0, q.r * 0.5], [q.r * 0.9, q.r * 0.6], [-q.r, q.r * 0.6]].forEach(function (o, j) {
          ctx.fillStyle = (j + i) % 2 ? C.lite : C.ink; ctx.fillRect(Math.round(q.x + o[0]), Math.round(cy + o[1]), 2, 2);
        });
      });
    } else if (ev === 'easter') {
      for (var x = 60; x < 130; x += 13) {                         // little flowers along the ground (between the trees)
        var fy2 = R.FLOOR_TOP - 3;
        ctx.fillStyle = C.ink; ctx.fillRect(x, fy2 + 1, 1, 2);
        ctx.fillStyle = night ? C.ink : C.lite; ctx.fillRect(x - 1, fy2 - 1, 3, 1); ctx.fillRect(x, fy2 - 2, 1, 3);
        ctx.fillStyle = C.ink; ctx.fillRect(x, fy2 - 1, 1, 1);
      }
      drawArt(ctx, 'eggs', 150, R.FLOOR_TOP + 6 - 6 * 1.6, 1.6, false, night);
    }
  }

  /* ---------------------------------------------------------------- trip scenes (full screen, like a cut-scene) */
  function tree(ctx, cx, base, h, r, col, edge) {
    var R = PP.Render, cy = base - h + r;
    ctx.fillStyle = edge; R.fshape(ctx, cx - r - 2, cy - r - 2, cx + r + 2, base, function (u, v) { return R.inDisc(u, v, cx, cy, r + 1) || (u > cx - 2.5 && u < cx + 2.5 && v > cy && v < base); });
    ctx.fillStyle = col; R.fshape(ctx, cx - r, cy - r, cx + r, base, function (u, v) { return R.inDisc(u, v, cx, cy, r) || (u > cx - 1.5 && u < cx + 1.5 && v > cy && v < base - 0.5); });
  }
  function backdrop(ctx, where, t) {
    var R = PP.Render, C = R.C, W = R.W, x, gy = 128;
    R.clear(ctx);
    if (where === 'beach') {
      ctx.fillStyle = C.lite; R.fshape(ctx, 168, 18, 200, 50, function (u, v) { return R.inDisc(u, v, 184, 34, 11); });
      ctx.fillStyle = C.ink; R.fshape(ctx, 168, 18, 200, 50, function (u, v) { return R.inDisc(u, v, 184, 34, 12) && !R.inDisc(u, v, 184, 34, 11); });
      ctx.fillStyle = C.dark; ctx.fillRect(0, 84, W, 26);                       // the sea
      ctx.fillStyle = C.ink; ctx.fillRect(0, 84, W, 1);
      ctx.fillStyle = C.lite;
      for (x = 0; x < W; x += 12) { var o = Math.floor(t / 160 + x) % 12; ctx.fillRect((x + o) % W, 90 + (x % 3) * 6, 4, 1); }
      ctx.fillStyle = C.lite; ctx.fillRect(0, 110, W, 30);                      // sand
      ctx.fillStyle = C.ink; ctx.fillRect(0, 110, W, 1);
      ctx.fillStyle = C.mid; for (x = 2; x < W; x += 7) ctx.fillRect(x, 116 + (x * 3) % 20, 1, 1);
      // a palm tree on the left
      ctx.fillStyle = C.ink;
      for (var y = 60; y < 128; y++) ctx.fillRect(Math.round(20 + Math.sin((y - 60) / 24) * 5), y, 3, 1);
      [[-14, 6], [-12, -2], [12, -2], [14, 6], [0, -6]].forEach(function (f) {
        R.fshape(ctx, 0, 40, 60, 80, function (u, v) { return R.inCap(u, v, 23, 60, 23 + f[0], 60 + f[1], 2); });
      });
      drawArt(ctx, 'shell', 180, 124, 1);
    } else if (where === 'forest') {
      for (x = -6; x < W + 10; x += 20) tree(ctx, x, 120, 50 + (x * 7) % 14, 13, C.dark, C.ink);   // far trees
      ctx.fillStyle = C.mid; ctx.fillRect(0, 120, W, 20); ctx.fillStyle = C.ink; ctx.fillRect(0, 120, W, 1);
      tree(ctx, 18, 134, 70, 18, C.mid, C.ink); tree(ctx, 196, 134, 64, 16, C.mid, C.ink);
      drawArt(ctx, 'mushroom', 44, 124, 1); drawArt(ctx, 'pinecone', 168, 126, 1);
      ctx.fillStyle = C.lite; for (x = 0; x < 6; x++) { var lx = Math.round((x * 41 + t / 30) % W), ly = Math.round(40 + ((x * 19 + t / 25) % 70)); ctx.fillRect(lx, ly, 2, 1); }   // falling leaves
    } else if (where === 'mountain') {                            // 2.5.0: three snow-capped peaks, pines and the summit flag
      ctx.fillStyle = C.lite; R.fshape(ctx, 160, 16, 196, 48, function (u, v) { return R.inDisc(u, v, 178, 30, 9); });
      [[60, 30, 70, C.dark], [150, 42, 64, C.mid], [16, 58, 46, C.mid]].forEach(function (m) {
        var cx = m[0], top = m[1], hw = m[2];
        ctx.fillStyle = C.ink; R.fshape(ctx, cx - hw - 1, top - 1, cx + hw + 1, gy, function (u, v) { return v >= top + Math.abs(u - cx) * (gy - top) / hw - 1; });
        ctx.fillStyle = m[3]; R.fshape(ctx, cx - hw, top, cx + hw, gy, function (u, v) { return v >= top + 1 + Math.abs(u - cx) * (gy - top) / hw; });
        ctx.fillStyle = C.lite; R.fshape(ctx, cx - hw, top, cx + hw, top + 16, function (u, v) { return v >= top + 1 + Math.abs(u - cx) * (gy - top) / hw && v < top + 9 + Math.sin(u * 0.9) * 2; });
      });
      for (x = 4; x < W; x += 22) { var ph = 16 + (x * 7) % 9; (function (x, h) { ctx.fillStyle = C.ink; R.fshape(ctx, x - 6, gy - h, x + 6, gy, function (u, v) { return Math.abs(u - x) <= (v - (gy - h)) * 0.42 && (Math.floor((v - (gy - h)) / 4) % 2 === 0 || Math.abs(u - x) <= (v - (gy - h)) * 0.3); }); ctx.fillRect(x - 0.5, gy - 2, 1.4, 3); })(x, ph); }
      ctx.fillStyle = C.mid; ctx.fillRect(0, gy, W, 12); ctx.fillStyle = C.ink; ctx.fillRect(0, gy, W, 1);
      ctx.fillStyle = C.dark; for (x = 3; x < W; x += 9) ctx.fillRect(x, gy + 3 + (x * 5) % 6, 2, 1);
      ctx.fillStyle = C.ink; ctx.fillRect(176, gy - 22, 1, 22); ctx.fillRect(177, gy - 22, 8, 5); ctx.fillStyle = C.lite; ctx.fillRect(178, gy - 21, 6, 3);
    } else if (where === 'lake') {                                // 2.5.0: far shore, the water, reeds, lily pads and a little dock
      ctx.fillStyle = C.lite; R.fshape(ctx, 20, 14, 56, 46, function (u, v) { return R.inDisc(u, v, 38, 28, 9); });
      for (x = -4; x < W + 8; x += 14) { var th = 14 + (x * 11) % 8; (function (x, th) { ctx.fillStyle = C.dark; R.fshape(ctx, x - 7, 82 - th, x + 7, 82, function (u, v) { return R.inDisc(u, v, x, 82 - th + 6, 6) || v > 82 - th + 6; }); })(x, th); }
      ctx.fillStyle = C.ink; ctx.fillRect(0, 82, W, 1);
      ctx.fillStyle = C.dark; ctx.fillRect(0, 83, W, 34);
      ctx.fillStyle = C.lite; for (x = 0; x < W; x += 7) { var lo = Math.floor(t / 260 + x) % 7, ry = 87 + ((x * 13) % 27); if (ry < 112) ctx.fillRect((x * 3 + lo) % W, ry, 2 + (x % 3), 1); }
      drawArt(ctx, 'pond', 150, 104, 1);
      ctx.fillStyle = C.ink; ctx.fillRect(0, 117, W, 1); ctx.fillStyle = C.mid; ctx.fillRect(0, 118, W, 22);
      ctx.fillStyle = C.ink; for (x = 6; x < 40; x += 5) { ctx.fillRect(x, 108 - (x % 3) * 2, 1, 10 + (x % 3) * 2); ctx.fillRect(x - 1, 108 - (x % 3) * 2, 3, 2); }
      ctx.fillStyle = C.ink; ctx.fillRect(170, 112, 46, 6); ctx.fillStyle = C.dark; for (x = 171; x < 216; x += 5) ctx.fillRect(x, 113, 4, 4);
      ctx.fillStyle = C.ink; ctx.fillRect(174, 118, 2, 8); ctx.fillRect(208, 118, 2, 8);
      drawArt(ctx, 'duck', 120, 96, 1);
    } else {
      [[4, 46, 40], [48, 58, 30], [92, 40, 44], [140, 54, 34], [178, 44, 40]].forEach(function (hh, i) {   // a row of houses
        var bx = hh[0], top = gy - hh[1], w = hh[2] - 4;
        ctx.fillStyle = C.ink; ctx.fillRect(bx - 1, top - 1, w + 2, hh[1] + 1);
        ctx.fillStyle = i % 2 ? C.mid : C.lite; ctx.fillRect(bx, top, w, hh[1]);
        ctx.fillStyle = C.ink; R.fshape(ctx, bx - 3, top - 14, bx + w + 3, top, function (u, v) { return v > top - 12 + Math.abs(u - (bx + w / 2)) * 12 / (w / 2 + 3); });
        ctx.fillStyle = C.dark;
        for (var wy = top + 6; wy < gy - 14; wy += 12) for (var wx = bx + 4; wx < bx + w - 6; wx += 10) ctx.fillRect(wx, wy, 5, 6);
        ctx.fillStyle = C.ink; ctx.fillRect(bx + Math.floor(w / 2) - 3, gy - 12, 7, 12);
      });
      ctx.fillStyle = C.dark; ctx.fillRect(0, gy, W, 12); ctx.fillStyle = C.lite; for (x = 4; x < W; x += 16) ctx.fillRect(x, gy + 6, 8, 1);   // the road
      drawArt(ctx, 'lamp', 120, gy - 16, 1);
    }
  }
  var TRIP_MS = 4600;
  function drawTrip(ctx, c, t) {
    var R = PP.Render, F = PP.Font, C = R.C, k = t - c.t0, S = PP.Sprites;
    backdrop(ctx, c.where, k);
    var P = PP.World.PLACES[c.where], walkIn = Math.min(1, k / 1600), cx = (R.W - R.PS) / 2, x = Math.round(-R.PS + (cx + R.PS) * walkIn), y = R.GROUND - R.PS - 2;
    var pose = walkIn < 1 ? 'walk' : k < 3000 ? 'happy' : 'idle';
    if (k > 2000 && k < 3000) y -= Math.round(6 * Math.abs(Math.sin((k - 2000) / 250 * Math.PI)));
    S.draw(ctx, c.species, c.key, pose, Math.floor(k / 220), x, y, R.PET, false);
    drawHat(ctx, c.hat, c.species, c.key, pose, Math.floor(k / 220), x, y, false, false);
    var title = P.name.toUpperCase() + ' TRIP!', mw = F.width(title) + 8;
    ctx.fillStyle = C.ink; ctx.fillRect((R.W - mw) / 2 - 1, 3, mw + 2, 11); ctx.fillStyle = C.lite; ctx.fillRect((R.W - mw) / 2, 4, mw, 9);
    F.draw(ctx, title, R.W / 2, 5, C.ink, 1, 'center');
    if (k > 2400 && c.found) {
      var fz = size(c.found), s = 2, fx = cx + R.PS - 6, fy = y + 8 - Math.min(10, (k - 2400) / 40);
      drawArt(ctx, c.found, Math.min(R.W - fz[0] * s - 2, fx), fy, s);
    }
    if (k > 3000) {
      var line = c.found ? 'FOUND: ' + PP.World.THINGS[c.found].name.toUpperCase() : c.met ? 'MET A WILD ' + c.met.name.toUpperCase() : '+' + c.coins + ' COINS  HAPPY +1';
      var lw = F.width(line) + 8;
      ctx.fillStyle = C.ink; ctx.fillRect((R.W - lw) / 2 - 1, R.LAYOUT.bottomText - 2, lw + 2, 11); ctx.fillStyle = C.lite; ctx.fillRect((R.W - lw) / 2, R.LAYOUT.bottomText - 1, lw, 9);
      F.draw(ctx, line, R.W / 2, R.LAYOUT.bottomText, C.ink, 1, 'center');
    }
  }
  /* a friend's pal visits: both in the garden (the home scene), a little play, hearts */
  var VISIT_MS = 4200;
  function drawVisit(ctx, c, t, app) {
    var R = PP.Render, F = PP.Font, C = R.C, S = PP.Sprites, k = t - c.t0;
    R.clear(ctx);
    if (app && app.state) R.drawScene(ctx, app.state, t);
    // the two pals end up close but fully on screen so the hearts rise in the gap, never over a face
    var y = R.GROUND - R.PS, me = Math.round(-16 + Math.min(1, k / 1200) * 16), fr = Math.round(R.W - R.PS + 16 - Math.min(1, k / 1200) * 16);   // 2.4.94: both pals fully on screen at rest
    var hop = function (ph) { return k > 1400 && k < 3400 ? Math.round(5 * Math.abs(Math.sin((k + ph) / 260 * Math.PI))) : 0; };
    var pose = k < 1200 ? 'walk' : k < 3400 ? 'happy' : 'idle';
    S.draw(ctx, c.species, c.key, pose, Math.floor(k / 230), me, y - hop(0), R.PET, false);
    drawHat(ctx, c.hat, c.species, c.key, pose, Math.floor(k / 230), me, y - hop(0), false, false);
    S.draw(ctx, c.fSpecies, c.fKey, pose, Math.floor(k / 230) + 1, fr, y - hop(130), R.PET, true);
    drawHat(ctx, c.fHat, c.fSpecies, c.fKey, pose, Math.floor(k / 230) + 1, fr, y - hop(130), true, false);   // 2.5.0: the friend's hat (from its code)
    if (k > 1400) for (var i = 0; i < 3; i++) { var hk = ((k - 1400) / 1600 + i / 3) % 1; S.drawFx(ctx, i === 1 ? 'note' : 'heart', R.W / 2 - 8 + (i - 1) * 15, 100 - hk * 60, 1); }
    var title = (c.fName || 'FRIEND').toUpperCase() + ' CAME TO PLAY!', mw = F.width(title) + 8;
    ctx.fillStyle = C.ink; ctx.fillRect((R.W - mw) / 2 - 1, R.LAYOUT.stripEnd - 15, mw + 2, 11); ctx.fillStyle = C.lite; ctx.fillRect((R.W - mw) / 2, R.LAYOUT.stripEnd - 14, mw, 9);
    F.draw(ctx, title, R.W / 2, R.LAYOUT.stripEnd - 13, C.ink, 1, 'center');
  }
  /* a thing for the menus: a small canvas data URL (cached), drawn at s px per art pixel on the lite LCD green */
  var urls = {};
  function thumbUrl(id, s) {
    s = s || 3; var key = id + s; if (urls[key]) return urls[key];
    if (typeof document === 'undefined' || !ART[id]) return '';
    var z = size(id), cv = document.createElement('canvas'), n = 20;
    cv.width = n * s; cv.height = n * s;
    var ctx = cv.getContext('2d');
    drawArt(ctx, id, Math.floor((n - z[0]) / 2) * s, Math.floor((n - z[1]) / 2) * s, s);
    return (urls[key] = cv.toDataURL());
  }
  PP.WorldArt = { widthOf: widthOf, itemBox: itemBox, drawItem: drawItem, HAT_SCALE: HAT_SCALE, hatCss: hatCss, hatURL: hatURL, ART: ART, size: size, drawArt: drawArt, anchor: anchor, drawHat: drawHat, drawRoom: drawRoom, SPOT: SPOT, drawEvent: drawEvent,
    drawTrip: drawTrip, drawVisit: drawVisit, TRIP_MS: TRIP_MS, VISIT_MS: VISIT_MS, thumbUrl: thumbUrl, backdrop: backdrop };
})(typeof window !== 'undefined' ? window : globalThis);
