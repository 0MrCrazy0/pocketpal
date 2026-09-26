/* PocketPal 2 - clock formatting (pure). 12-hour (9:05 pm) or 24-hour (21:05).
 * The default comes from the browser locale: regions that normally use a
 * 12-hour clock (en-US, en-AU, en-CA, en-NZ, en-IN, ...) start on 12h. */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};

  var TWELVE_REGIONS = /[-_](US|AU|NZ|CA|IN|PH|PK|BD|EG|SA|MY|CO|MX|SV|HN|NI|KR|TW|JO|IQ|SY|LB|YE|OM|QA|KW|BH|AE|LY|SD|DZ|TN|MA)\b/i;
  function browserLocale() {
    try { if (typeof navigator !== 'undefined' && navigator.language) return navigator.language; } catch (e) { /* no navigator */ }
    try { return Intl.DateTimeFormat().resolvedOptions().locale; } catch (e) { return 'en-US'; }
  }
  /* '12' or '24' for a locale tag such as 'en-AU'. */
  function defaultClock(locale) {
    locale = locale || browserLocale();
    try {
      var hc = new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions();
      if (hc.hourCycle) return hc.hourCycle === 'h12' || hc.hourCycle === 'h11' ? '12' : '24';
      if (typeof hc.hour12 === 'boolean') return hc.hour12 ? '12' : '24';
    } catch (e) { /* old engine: fall through to the region list */ }
    if (TWELVE_REGIONS.test(locale)) return '12';
    return /^en$/i.test(locale) ? '12' : '24';
  }
  function mode(m) { return m === '24' ? '24' : '12'; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /* Minute of the day (0..1439) -> "9:05 pm" / "21:05". opts.lcd -> "9:05PM" (LCD font). */
  function hm(minOfDay, m, opts) {
    var t = ((Math.round(minOfDay) % 1440) + 1440) % 1440, h = Math.floor(t / 60), mi = t % 60;
    if (mode(m) === '24') return pad2(h) + ':' + pad2(mi);
    var h12 = h % 12 === 0 ? 12 : h % 12, ap = h < 12 ? 'am' : 'pm';
    return opts && opts.lcd ? h12 + ':' + pad2(mi) + ap.toUpperCase() : h12 + ':' + pad2(mi) + ' ' + ap;
  }
  function minuteOfDay(ms) { var d = new Date(ms); return d.getHours() * 60 + d.getMinutes(); }
  function clock(ms, m, opts) { return hm(minuteOfDay(ms), m, opts); }
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  /* "Sat 26 Sep, 9:05 pm" (or "today 9:05 pm" / "yesterday ..." when refMs is given). */
  function dateTime(ms, m, refMs) {
    var d = new Date(ms), t = clock(ms, m);
    if (refMs != null) {
      var a = new Date(refMs); a.setHours(0, 0, 0, 0);
      var b = new Date(ms); b.setHours(0, 0, 0, 0);
      var days = Math.round((a - b) / 86400000);
      if (days === 0) return 'today ' + t;
      if (days === 1) return 'yesterday ' + t;
    }
    return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ', ' + t;
  }
  /* 1234 -> "20h 34m", 45 -> "45m", 3000 -> "2d 2h". */
  function duration(min) {
    min = Math.max(0, Math.round(min));
    var d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), mi = min % 60;
    if (d) return d + 'd' + (h ? ' ' + h + 'h' : '');
    if (h) return h + 'h' + (mi ? ' ' + mi + 'm' : '');
    return mi + 'm';
  }

  PP.Time = { defaultClock: defaultClock, browserLocale: browserLocale, hm: hm, clock: clock, dateTime: dateTime, duration: duration, minuteOfDay: minuteOfDay };
})(typeof window !== 'undefined' ? window : globalThis);
