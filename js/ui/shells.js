/* PocketPal 2 - paints the handheld in the chosen shell colour (CSS variables +
 * a finish class for the special shells). Pure presentation; unlocks live in core/collection.js. */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};
  var current = null;

  function vars(s) {
    var dark = s.label === 'dark';
    return {
      '--shell': s.base, '--shell-dark': s.dark, '--shell-lite': s.lite, '--ring': s.ring, '--rim': s.rim,
      // printed text + little shell buttons: dark ink on light shells, light ink on dark shells
      '--label': dark ? 'rgba(0,0,0,.42)' : 'rgba(255,255,255,.38)',
      '--label-strong': dark ? 'rgba(0,0,0,.65)' : 'rgba(255,255,255,.65)',
      '--sbtn-bg': dark ? 'rgba(20,20,30,.72)' : 'rgba(0,0,0,.28)',
      '--sbtn-bd': dark ? 'rgba(0,0,0,.25)' : 'rgba(255,255,255,.3)',
      '--sbtn-fg': '#fff'
    };
  }
  /* Show a shell (used for the live preview too). */
  function apply(id) {
    var s = PP.Collection.shell(id) || PP.Collection.shell('pink');
    var v = vars(s), de = document.documentElement;
    for (var k in v) de.style.setProperty(k, v[k]);
    var b = document.body;
    b.className = b.className.replace(/\bfinish-\w+\b/g, '').trim();
    if (s.finish) b.classList.add('finish-' + s.finish);
    var meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.setAttribute('content', s.base);
    current = s.id;
    return s;
  }
  function swatchStyle(s) {
    if (s.finish === 'gold') return 'background:linear-gradient(135deg,#fff4b8,#e3b62e 45%,#b08312 70%,#fbe27a)';
    if (s.finish === 'silver') return 'background:linear-gradient(135deg,#fff,#c3c9d0 45%,#8d959e 70%,#eef1f4)';
    if (s.finish === 'glitter') return 'background:radial-gradient(circle at 30% 30%,#fff 0 1px,transparent 2px) 0 0/6px 6px,linear-gradient(135deg,' + s.lite + ',' + s.base + ',' + s.dark + ')';
    if (s.finish === 'clear') return 'background:repeating-linear-gradient(90deg,rgba(40,90,120,.25) 0 1px,transparent 1px 5px),linear-gradient(135deg,rgba(223,243,252,.7),rgba(111,176,212,.6))';
    return 'background:linear-gradient(135deg,' + s.lite + ',' + s.base + ' 55%,' + s.dark + ')';
  }
  PP.Shells = { apply: apply, swatchStyle: swatchStyle, current: function () { return current; } };
})(typeof window !== 'undefined' ? window : globalThis);
