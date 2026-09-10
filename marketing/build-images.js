/* ============================================================================
   Waypoint Budget Studio — Etsy listing image generator
   Renders 2000×2000 listing images using the app's *real* demo numbers, read
   out of the actual dashboard code, so every figure on every image is true.

   Usage:  node marketing/build-images.js
   Deps:   @resvg/resvg-js + jsdom, resolved from WAYPOINT_DEPS
           (default /home/user/_dev/node_modules so the product repo stays
           dependency-free).
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'marketing', 'listing-images');
fs.mkdirSync(OUT, { recursive: true });

const DEP_DIR = process.env.WAYPOINT_DEPS || '/home/user/_dev/node_modules';
const req = (m) => require(require.resolve(m, { paths: [DEP_DIR] }));
const { JSDOM } = req('jsdom');
const { Resvg } = req('@resvg/resvg-js');

const FONT_DIR = path.join(DEP_DIR, '@expo-google-fonts/inter');
const fontFiles = ['400Regular', '500Medium', '600SemiBold', '700Bold', '800ExtraBold']
  .map((f) => path.join(FONT_DIR, f, `Inter_${f}.ttf`))
  .filter((f) => fs.existsSync(f));
if (!fontFiles.length) throw new Error('Inter fonts not found in ' + FONT_DIR);

/* ============================================================ read the app */
const EXTRACT = `(function () {
  var s = safeToSpend(), p = paceForCurrentMonth(), f = forecast(45);
  var env = envelopes().filter(function (e) { return e.cap > 0; })
    .sort(function (a, b) { return b.pct - a.pct; });
  var d = debtSummary();
  var subs = detectSubscriptions();
  return JSON.stringify({
    name: DB.settings.name,
    safe: s.safe, perDay: s.perDay, daysLeft: s.daysLeft, payday: fmtDate(s.payday, 'medium'),
    cash: s.cash, billsTotal: s.bills, billCount: s.billCount, debtMin: s.debtMin,
    goalReserve: s.goalReserve, buffer: s.buffer,
    monthSpent: p.month.expense, monthBudget: p.caps, monthProjected: p.projected,
    daysInMonthLeft: p.daysLeft, rollover: p.rollover, scheduledLeft: p.scheduledLeft,
    everydayPace: p.everydayAverage, envelopeLeft: p.remainingEnvelope,
    forecast: {
      start: f.start, end: f.end, low: f.low, lowDate: fmtDate(f.lowDate, 'medium'), pace: f.pace,
      committed: r2(sum(f.points, function (pt) {
        return sum(pt.events.filter(function (e) { return e.amount < 0; }), function (e) { return Math.abs(e.amount); });
      }))
    },
    forecastPoints: f.points.map(function (pt) { return { d: fmtDate(pt.date, 'short'), v: pt.balance, e: pt.events.length }; }),
    envelopes: env.map(function (e) {
      return { name: e.cat.name, color: e.cat.color, cap: e.effectiveCap, spent: e.spent, left: e.left,
               pct: e.pct, over: e.over, hot: e.hot, bills: e.mostlyBills };
    }),
    billRows: billOccurrences(today(), addDays(today(), 30)).slice(0, 6).map(function (o) {
      return { name: o.bill.name, amount: o.amount, date: fmtDate(o.date, 'short'), rel: relDay(o.date),
               paid: !!o.paid, autopay: !!o.bill.autopay, color: (byId(DB.cats, o.bill.catId) || {}).color || '#7dd3fc' };
    }),
    billStats: (function () {
      var m = billOccurrences(startOfMonth(today()), endOfMonth(today()));
      var paid = m.filter(function (o) { return o.paid; });
      var unpaid = m.filter(function (o) { return !o.paid; });
      var auto = DB.bills.filter(function (b) { return b.autopay && b.active !== false; });
      return {
        count: DB.bills.length,
        due: r2(sum(unpaid, function (o) { return o.amount; })), dueCount: unpaid.length,
        paid: r2(sum(paid, function (o) { return o.amount; })), paidCount: paid.length,
        monthly: r2(sum(DB.bills.filter(function (b) { return b.active !== false; }),
                       function (b) { return b.amount * freqPerMonth(b.freq); })),
        autoCount: auto.length
      };
    })(),
    debts: DB.debts.map(function (x) {
      return { name: x.name, bal: x.balance, apr: x.apr, min: x.minPayment };
    }),
    debtTotal: d.total, debtMinTotal: d.minPay, avgApr: d.avgApr,
    plans: [
      { label: 'Minimums only', extra: 0, p: debtPlan('snowball', 0) },
      { label: 'Extra +' + money0(150) + ' a month', extra: 150, p: debtPlan('avalanche', 150) },
      { label: 'Extra +' + money0(300) + ' a month', extra: 300, p: debtPlan('avalanche', 300) }
    ].map(function (x) {
      return { label: x.label, extra: x.extra, months: x.p.months, interest: x.p.totalInterest, free: fmtDate(x.p.payoffDate, 'medium') };
    }),
    subs: subs.filter(function (x) { return !x.alreadyTracked; }).slice(0, 4).map(function (x) {
      return { name: x.name, monthly: x.monthly, yearly: r2(x.monthly * 12), avg: x.avg, cadence: x.cadence, last: fmtDate(x.last, 'short') };
    }),
    subsTotal: r2(sum(subs.filter(function (x) { return !x.alreadyTracked; }), function (x) { return x.monthly; })),
    netWorth: netWorth(), score: moneyScore().score
  });
})()`;

const data = (() => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/<script[^>]*><\/script>/g, '');
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true });
  const win = dom.window;
  win.scrollTo = () => { };
  for (const f of ['store', 'engine', 'charts', 'app', 'views']) {
    const el = win.document.createElement('script');
    el.textContent = fs.readFileSync(path.join(ROOT, 'src/js', f + '.js'), 'utf8');
    win.document.head.appendChild(el);
  }
  win.eval('seedDemo()');
  return JSON.parse(win.eval(EXTRACT));
})();

/* ================================================================ SVG kit */
const W = 2000, H = 2000;
const C = {
  bg: '#080c11', surface: '#121a23', text: '#e9f0f8', muted: '#93a6ba', dim: '#647689',
  gold: '#f5c451', cyan: '#7dd3fc', good: '#4ade80', warn: '#fbbf24', danger: '#f87171',
  pink: '#f472b6', green: '#34d399', violet: '#a78bfa', rose: '#fb7185'
};
function esc(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function txt(x, y, s, o = {}) {
  const size = o.size || 30, weight = o.weight || 500, fill = o.fill || C.text;
  return `<text x="${x}" y="${y}" font-family="Inter" font-size="${size}" font-weight="${weight}" fill="${fill}"` +
    (o.ls ? ` letter-spacing="${o.ls}"` : '') + (o.anchor ? ` text-anchor="${o.anchor}"` : '') +
    (o.opacity !== undefined ? ` opacity="${o.opacity}"` : '') + `>${esc(s)}</text>`;
}
function rect(x, y, w, h, o = {}) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.rx === undefined ? 24 : o.rx}" fill="${o.fill || C.surface}"` +
    (o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw || 2}"` : '') +
    (o.opacity !== undefined ? ` opacity="${o.opacity}"` : '') + '/>';
}
function circle(cx, cy, r, o = {}) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${o.fill || 'none'}"` +
    (o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw || 2}"` : '') + '/>';
}
function bar(x, y, w, h, pct, color, track = 'rgba(255,255,255,0.10)') {
  const fill = Math.max(0, Math.min(100, pct));
  return rect(x, y, w, h, { rx: h / 2, fill: track }) +
    rect(x, y, Math.max(h, (w * fill) / 100), h, { rx: h / 2, fill: color });
}
function polar(cx, cy, r, deg) {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
function arc(cx, cy, rOut, rIn, a0, a1) {
  const large = a1 - a0 > 180 ? 1 : 0;
  const p0 = polar(cx, cy, rOut, a0), p1 = polar(cx, cy, rOut, a1);
  const p2 = polar(cx, cy, rIn, a1), p3 = polar(cx, cy, rIn, a0);
  return `M${p0.x.toFixed(1)} ${p0.y.toFixed(1)} A${rOut} ${rOut} 0 ${large} 1 ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} ` +
    `L${p2.x.toFixed(1)} ${p2.y.toFixed(1)} A${rIn} ${rIn} 0 ${large} 0 ${p3.x.toFixed(1)} ${p3.y.toFixed(1)} Z`;
}
function donut(cx, cy, rOut, rIn, segs, gap = 2.5) {
  const total = segs.reduce((a, s) => a + Math.max(0, s.v), 0) || 1;
  let a = 0;
  let out = circle(cx, cy, (rOut + rIn) / 2, { stroke: 'rgba(255,255,255,0.09)', sw: rOut - rIn });
  segs.forEach((s) => {
    const sweep = (Math.max(0, s.v) / total) * 360;
    if (sweep <= 0.5) return;
    out += `<path d="${arc(cx, cy, rOut, rIn, a + gap / 2, a + sweep - gap / 2)}" fill="${s.c}"/>`;
    a += sweep;
  });
  return out;
}
function trend(x, y, w, h, values) {
  const max = Math.max(...values), min = Math.min(...values);
  const span = Math.max(1, max - min);
  const pts = values.map((v, i) => [x + (w * i) / Math.max(1, values.length - 1), y + h - (h * (v - min)) / span]);
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2, t = 0.18;
    d += ` C${(p1[0] + (p2[0] - p0[0]) * t).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) * t).toFixed(1)} ` +
      `${(p2[0] - (p3[0] - p1[0]) * t).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) * t).toFixed(1)} ` +
      `${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return {
    line: d, first: pts[0], last: pts[pts.length - 1],
    area: `${d} L${pts[pts.length - 1][0].toFixed(1)} ${y + h} L${pts[0][0].toFixed(1)} ${y + h} Z`
  };
}
/* wrap on word boundaries so marketing copy never breaks mid-word */
function wrap(text, max) {
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  words.forEach((w) => {
    if ((line + ' ' + w).trim().length <= max) line = (line ? line + ' ' : '') + w;
    else { if (line) lines.push(line); line = w; }
  });
  if (line) lines.push(line);
  return lines;
}
function wrapped(x, y, text, o = {}) {
  const max = o.max || 41, lh = o.lh || 36, size = o.size || 27;
  return wrap(text, max).slice(0, 3)
    .map((l, i) => txt(x, y + i * lh, l, { size, weight: o.weight || 500, fill: o.fill || C.muted })).join('');
}
function mark(x, y, size, color) {
  return rect(x, y, size, size, { rx: size * 0.3, fill: color, opacity: 0.18 }) +
    circle(x + size / 2, y + size / 2, size * 0.2, { fill: color });
}
function check(x, y, color = C.good) {
  return `<path d="M${x} ${y} l13 15 l24 -30" fill="none" stroke="${color}" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>`;
}
function cross(x, y) {
  return circle(x + 18, y - 10, 20, { fill: 'none', stroke: C.danger, sw: 5 }) +
    `<line x1="${x + 6}" y1="${y - 22}" x2="${x + 30}" y2="${y + 2}" stroke="${C.danger}" stroke-width="5" stroke-linecap="round"/>`;
}
function logo(x, y) {
  return `<g>
    <rect x="${x}" y="${y - 58}" width="76" height="76" rx="24" fill="#f5c451"/>
    <circle cx="${x + 38}" cy="${y - 20}" r="19" fill="none" stroke="#1a1305" stroke-width="6"/>
    <path d="M${x + 38} ${y - 39} v-8 M${x + 38} ${y - 1} v8 M${x + 19} ${y - 20} h-8 M${x + 57} ${y - 20} h8" stroke="#1a1305" stroke-width="6" stroke-linecap="round"/>
    <text x="${x + 100}" y="${y - 8}" font-family="Inter" font-size="40" font-weight="800" fill="${C.text}">Waypoint</text>
    <text x="${x + 336}" y="${y - 8}" font-family="Inter" font-size="40" font-weight="400" fill="${C.dim}">· Budget Studio</text>
  </g>`;
}
function bg(id) {
  return `<defs>
    <radialGradient id="g${id}" cx="12%" cy="-6%" r="78%">
      <stop offset="0%" stop-color="#f5c451" stop-opacity="0.17"/><stop offset="60%" stop-color="#f5c451" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="h${id}" cx="104%" cy="8%" r="70%">
      <stop offset="0%" stop-color="#7dd3fc" stop-opacity="0.13"/><stop offset="60%" stop-color="#7dd3fc" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="c${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#182231"/><stop offset="100%" stop-color="#0f1720"/>
    </linearGradient>
    <linearGradient id="f${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#7dd3fc" stop-opacity="0.30"/><stop offset="100%" stop-color="#7dd3fc" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${C.bg}"/>
  <rect width="${W}" height="${H}" fill="url(#g${id})"/>
  <rect width="${W}" height="${H}" fill="url(#h${id})"/>`;
}
function panel(id, o = {}) {
  return rect(o.x || 110, o.y || 560, o.w || 1780, o.h || 1080, { rx: 36, fill: `url(#c${id})`, stroke: C.line, sw: 2 }) +
    (o.glow ? rect(o.x || 110, o.y || 560, o.w || 1780, o.h || 1080, { rx: 36, fill: 'none', stroke: o.glow, sw: 3, opacity: 0.5 }) : '');
}
function bullets(y, items, o = {}) {
  return items.map((it, i) => {
    const yy = y + i * 64;
    return check(190, yy, o.color || C.good) + txt(242, yy - 2, it, { size: 30, weight: 500, fill: C.muted });
  }).join('');
}
/* page frame: brand, eyebrow, headline, optional sub-line, panel, bullets */
function frame(id, eyebrow, headline, sub, body, bulletItems, glow) {
  const hl = headline.map((l, i) => txt(110, 348 + i * 88, l, { size: 76, weight: 800 })).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${bg(id)}
  ${logo(110, 150)}
  ${txt(112, 258, eyebrow, { size: 27, weight: 700, fill: C.gold, ls: 4 })}
  ${hl}
  ${sub ? txt(112, 348 + headline.length * 88 + 26, sub, { size: 33, weight: 400, fill: C.muted }) : ''}
  ${panel(id, { glow })}
  ${body}
  ${bulletItems && bulletItems.length ? bullets(1790, bulletItems) : ''}
</svg>`;
}

/* ================================================================ numbers */
const money = (n, d = 2) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const money0 = (n) => '$' + Math.round(Number(n)).toLocaleString('en-US');

/* ================================================================= images */
const images = [];
const d = data;

/* -------- 1. hero: the one number -------- */
(() => {
  const cx = 1512, cy = 1112, rOut = 232, rIn = 186;
  const frac = Math.max(0, Math.min(1, d.safe / d.cash));
  const start = 135, sweep = 270;
  let ticks = '';
  for (let i = 0; i <= 24; i++) {
    const a = start + (sweep * i) / 24;
    const p1 = polar(cx, cy, rOut + 24, a), p2 = polar(cx, cy, rOut + (i % 6 === 0 ? 46 : 34), a);
    ticks += `<line x1="${p1.x.toFixed(1)}" y1="${p1.y.toFixed(1)}" x2="${p2.x.toFixed(1)}" y2="${p2.y.toFixed(1)}" stroke="rgba(255,255,255,0.18)" stroke-width="${i % 6 === 0 ? 4 : 3}" stroke-linecap="round"/>`;
  }
  const rows = [
    ['Cash you can spend', money(d.cash), C.muted],
    [`Bills due before payday (${d.billCount})`, '\u2212 ' + money(d.billsTotal), C.muted],
    ['Debt minimums in the same window', '\u2212 ' + money(d.debtMin), C.muted],
    ['Goal deposits for this window', '\u2212 ' + money(d.goalReserve), C.muted],
    ['Your safety buffer', '\u2212 ' + money(d.buffer), C.muted]
  ].map((r, i) => txt(190, 1010 + i * 58, r[0], { size: 31, weight: 500, fill: r[2] }) +
    txt(950, 1010 + i * 58, r[1], { size: 31, weight: 600, fill: C.text, anchor: 'end' })).join('');

  const body = `
  ${txt(190, 655, 'SAFE TO SPEND', { size: 30, weight: 700, fill: C.dim, ls: 5 })}
  ${txt(186, 800, money(d.safe), { size: 152, weight: 800, fill: C.gold })}
  ${txt(190, 872, `With every bill already taken out · next payday ${d.payday}`, { size: 32, weight: 400, fill: C.muted })}
  ${txt(190, 950, 'How the number is built', { size: 28, weight: 700, fill: C.dim, ls: 3 })}
  ${rows}
  <line x1="190" y1="1325" x2="950" y2="1325" stroke="${C.line}" stroke-width="2"/>
  ${txt(190, 1388, 'Safe to spend', { size: 36, weight: 700 })}
  ${txt(950, 1388, money(d.safe), { size: 36, weight: 800, fill: C.gold, anchor: 'end' })}
  ${rect(190, 1430, 760, 150, { rx: 24, fill: 'rgba(74,222,128,0.07)', stroke: 'rgba(74,222,128,0.3)' })}
  ${check(222, 1500)}
  ${txt(276, 1508, `${money0(d.perDay)} a day for the next ${d.daysLeft} days`, { size: 33, weight: 600, fill: C.text })}
  <circle cx="${cx}" cy="${cy}" r="${(rOut + rIn) / 2}" fill="none" stroke="rgba(255,255,255,0.09)" stroke-width="${rOut - rIn}"/>
  <path d="${arc(cx, cy, rOut, rIn, start, start + Math.max(1, sweep * frac))}" fill="${C.gold}"/>
  ${ticks}
  ${circle(cx, cy, 144, { fill: 'rgba(255,255,255,0.035)' })}
  ${txt(cx, cy - 22, money0(d.perDay), { size: 74, weight: 800, anchor: 'middle' })}
  ${txt(cx, cy + 30, 'per day', { size: 32, weight: 500, fill: C.muted, anchor: 'middle' })}
  ${txt(cx, cy + 86, `${d.daysLeft} days to payday`, { size: 27, weight: 600, fill: C.dim, anchor: 'middle' })}`;
  images.push({
    name: '01-one-number.png',
    svg: frame('1', 'INTERACTIVE BUDGET DASHBOARD', ['One number tells you', 'what you can spend.'], 'Safe-to-spend, built from your own bills, paydays and goals — not a guess.',
      body, ['No formulas to write', 'No account and no monthly fee', 'Works with the internet switched off'], 'rgba(245,196,81,0.28)')
  });
})();

/* -------- 2. cash forecast -------- */
(() => {
  const vals = d.forecastPoints.map((p) => p.v);
  const t = trend(210, 730, 1600, 400, vals);
  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const y = 730 + 400 * (1 - f);
    const v = Math.min(...vals) + (Math.max(...vals) - Math.min(...vals)) * f;
    return `<line x1="210" y1="${y}" x2="1810" y2="${y}" stroke="rgba(255,255,255,0.06)" stroke-width="2"/>` +
      txt(178, y + 10, money0(v), { size: 25, weight: 500, fill: C.dim, anchor: 'end' });
  }).join('');
  const payLines = d.forecastPoints.map((p, i) => ({ i, e: p.e })).filter((p) => p.e >= 2).slice(0, 9)
    .map((p) => {
      const x = 210 + (1600 * p.i) / (vals.length - 1);
      return `<line x1="${x.toFixed(0)}" y1="730" x2="${x.toFixed(0)}" y2="1130" stroke="rgba(74,222,128,0.4)" stroke-width="2" stroke-dasharray="8 8"/>`;
    }).join('');
  const cards = [
    [190, 'Biggest balance', money(d.forecast.end), C.good, 'after the next two paydays'],
    [735, 'Lowest point', money(d.forecast.low), C.warn, d.forecast.lowDate],
    [1280, 'Everything scheduled', money0(d.forecast.committed), C.cyan, 'bills and debt payments']
  ].map((c) => rect(c[0], 1240, 520, 190, { rx: 26, fill: 'rgba(255,255,255,0.035)', stroke: C.line }) +
    txt(c[0] + 34, 1300, c[1], { size: 26, weight: 600, fill: C.dim }) +
    txt(c[0] + 34, 1372, c[3], { size: 48, weight: 800, fill: c[2] }) +
    txt(c[0] + 34, 1412, c[4], { size: 25, weight: 500, fill: C.dim })).join('');

  const body = `
  ${txt(190, 655, 'PROJECTED CASH — NEXT 45 DAYS', { size: 30, weight: 700, fill: C.dim, ls: 4 })}
  ${grid}
  <path d="${t.area}" fill="url(#f2)"/>
  <path d="${t.line}" fill="none" stroke="${C.cyan}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
  ${payLines}
  ${circle(t.first[0], t.first[1], 12, { fill: C.cyan, stroke: C.surface, sw: 5 })}
  ${circle(t.last[0], t.last[1], 12, { fill: C.good, stroke: C.surface, sw: 5 })}
  ${txt(210, 1190, 'today', { size: 26, weight: 600, fill: C.dim })}
  ${txt(1810, 1190, '45 days out', { size: 26, weight: 600, fill: C.dim, anchor: 'end' })}
  ${cards}
  ${txt(190, 1520, `Green dashes are paydays. Everyday spending is projected at ${money(d.forecast.pace)} a day, based on your own history.`, { size: 27, weight: 500, fill: C.dim })}`;
  images.push({
    name: '02-cash-forecast.png',
    svg: frame('2', 'SEE IT BEFORE YOU SPEND IT', ['The next 45 days of', 'your bank balance.'],
      '', body, ['A tight week is visible months ahead — move one payment', 'Every bill, debt minimum and payday is already included'], 'rgba(125,211,252,0.22)')
  });
})();

/* -------- 3. bills -------- */
(() => {
  const rows = d.billRows.map((b, i) => {
    const y = 700 + i * 118;
    return rect(190, y, 1620, 104, { rx: 24, fill: i % 2 ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.045)' }) +
      mark(232, y + 26, 52, b.color) +
      txt(308, y + 52, b.name, { size: 35, weight: 600 }) +
      txt(308, y + 88, `${b.rel} · ${b.date}${b.autopay ? ' · autopay' : ''}`, { size: 26, weight: 500, fill: C.dim }) +
      txt(1500, y + 66, money(b.amount), { size: 37, weight: 700, anchor: 'end' }) +
      (b.paid
        ? rect(1550, y + 28, 200, 48, { rx: 24, fill: 'rgba(74,222,128,0.15)' }) + txt(1650, y + 60, 'paid', { size: 25, weight: 700, fill: C.good, anchor: 'middle' })
        : rect(1550, y + 28, 200, 48, { rx: 24, fill: 'rgba(245,196,81,0.16)' }) + txt(1650, y + 60, 'pay', { size: 25, weight: 700, fill: C.gold, anchor: 'middle' }));
  }).join('');
  const stats = [
    [190, 'Due this month', money(d.billStats.due), `${d.billStats.dueCount} still to pay`, C.text],
    [735, 'Paid so far', money(d.billStats.paid), `${d.billStats.paidCount} marked paid`, C.good],
    [1280, 'Monthly load', money(d.billStats.monthly), `${d.billStats.count} recurring items`, C.text]
  ].map((c) => rect(c[0], 1440, 520, 160, { rx: 26, fill: 'rgba(255,255,255,0.035)', stroke: C.line }) +
    txt(c[0] + 34, 1498, c[1], { size: 26, weight: 600, fill: C.dim }) +
    txt(c[0] + 34, 1562, c[2], { size: 46, weight: 800, fill: c[4] }) +
    txt(c[0] + 34, 1596, c[3], { size: 24, weight: 500, fill: C.dim })).join('');
  const body = `
  ${txt(190, 655, 'UP NEXT', { size: 30, weight: 700, fill: C.dim, ls: 5 })}
  ${rows}
  ${stats}`;
  images.push({
    name: '03-bills-on-time.png',
    svg: frame('3', 'NEVER MISS WHAT\u2019S COMING UP', ['Every bill on one list,', 'nothing sneaks past.'],
      '', body, ['One tap marks a cycle paid and logs the expense', 'Pause a bill for a month, or skip a single cycle'], 'rgba(125,211,252,0.18)')
  });
})();

/* -------- 4. envelopes -------- */
(() => {
  const envs = d.envelopes.slice(0, 6);
  const cards = envs.map((e, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 190 + col * 810, y = 690 + row * 300;
    const accent = e.over ? C.danger : e.hot ? C.warn : e.color;
    const badge = e.over ? 'over by ' + money0(Math.abs(e.left)) : e.hot ? 'running hot' : e.bills ? 'fixed bills' : 'on pace';
    const badgeCol = e.over ? C.danger : e.hot ? C.warn : e.bills ? C.muted : C.good;
    return rect(x, y, 770, 270, { rx: 28, fill: 'rgba(255,255,255,0.04)', stroke: C.line }) +
      mark(x + 40, y + 42, 60, e.color) +
      txt(x + 122, y + 74, e.name, { size: 34, weight: 700 }) +
      txt(x + 122, y + 112, money0(Math.max(0, e.left)) + ' left of ' + money0(e.cap), { size: 27, weight: 500, fill: C.dim }) +
      txt(x + 730, y + 80, money0(e.spent), { size: 42, weight: 800, anchor: 'end' }) +
      bar(x + 40, y + 156, 690, 20, e.pct, accent) +
      txt(x + 40, y + 232, badge, { size: 27, weight: 700, fill: badgeCol }) +
      txt(x + 730, y + 232, Math.round(e.pct) + '% used', { size: 27, weight: 600, fill: C.dim, anchor: 'end' });
  }).join('');
  const body = `
  ${txt(190, 655, `THIS MONTH · ${money0(d.monthSpent)} SPENT OF ${money0(d.monthBudget)} BUDGETED`, { size: 29, weight: 700, fill: C.dim, ls: 3 })}
  ${cards}
  ${txt(190, 1610, `${money0(d.envelopeLeft)} of budget still unspent · projected month end ${money0(d.monthProjected)}`, { size: 28, weight: 500, fill: C.dim })}`;
  images.push({
    name: '04-envelope-pacing.png',
    svg: frame('4', 'BUDGETS THAT PACE THEMSELVES', ['Your money, divided', 'before you spend it.'],
      '', body, ['A cap per category, paced across the whole month', 'Fixed bills stop rent from looking like overspending'], 'rgba(74,222,128,0.20)')
  });
})();

/* -------- 5. debt planner -------- */
(() => {
  const segs = d.debts.map((x, i) => ({ v: x.bal, c: [C.gold, C.cyan, C.pink, C.violet][i % 4] }));
  const legend = d.debts.map((x, i) => {
    const y = 1150 + i * 58;
    return circle(1218, y - 10, 13, { fill: [C.gold, C.cyan, C.pink, C.violet][i % 4] }) +
      txt(1256, y, x.name, { size: 28, weight: 500, fill: C.muted }) +
      txt(1790, y, money0(x.bal), { size: 28, weight: 700, anchor: 'end' });
  }).join('');
  const plans = d.plans.map((p, i) => {
    const y = 960 + i * 168;
    const accent = i === 0 ? C.muted : i === 1 ? C.warn : C.good;
    return rect(190, y, 940, 148, { rx: 26, fill: i === 2 ? 'rgba(74,222,128,0.08)' : 'rgba(255,255,255,0.035)', stroke: i === 2 ? 'rgba(74,222,128,0.4)' : C.line }) +
      txt(226, y + 56, p.label, { size: 32, weight: 700 }) +
      txt(226, y + 106, 'debt-free ' + p.free, { size: 27, weight: 500, fill: C.dim }) +
      txt(1096, y + 56, p.months + ' months', { size: 38, weight: 800, fill: accent, anchor: 'end' }) +
      txt(1096, y + 106, money0(p.interest) + ' interest', { size: 27, weight: 500, fill: C.dim, anchor: 'end' });
  }).join('');
  const body = `
  ${txt(190, 655, 'TOTAL DEBT', { size: 30, weight: 700, fill: C.dim, ls: 5 })}
  ${txt(186, 785, money(d.debtTotal), { size: 108, weight: 800 })}
  ${txt(190, 845, `${d.debts.length} accounts · ${money0(d.debtMinTotal)} a month in minimums · ${d.avgApr.toFixed(1)}% average rate`, { size: 30, weight: 500, fill: C.muted })}
  ${txt(190, 920, 'CHANGE THE PLAN, WATCH THE DATE MOVE', { size: 28, weight: 700, fill: C.dim, ls: 3 })}
  ${plans}
  ${donut(1480, 830, 168, 116, segs)}
  ${txt(1480, 838, money0(d.debtTotal), { size: 40, weight: 800, anchor: 'middle' })}
  ${txt(1480, 872, 'owed', { size: 26, weight: 500, fill: C.dim, anchor: 'middle' })}
  ${legend}
  ${rect(1160, 1420, 630, 180, { rx: 26, fill: 'rgba(74,222,128,0.07)', stroke: 'rgba(74,222,128,0.32)' })}
  ${txt(1198, 1482, 'Interest avoided', { size: 26, weight: 600, fill: C.dim })}
  ${txt(1198, 1548, money0(d.plans[0].interest - d.plans[2].interest), { size: 50, weight: 800, fill: C.good })}
  ${txt(1198, 1586, `${d.plans[0].months - d.plans[2].months} months sooner than minimums`, { size: 25, weight: 500, fill: C.dim })}`;
  images.push({
    name: '05-debt-payoff.png',
    svg: frame('5', 'DEBT PAYOFF PLANNER', ['Your debt-free date,', 'down to the month.'],
      '', body, ['Snowball, avalanche or the order you actually want', 'See the interest you avoid, not just the balance you owe'], 'rgba(248,113,113,0.20)')
  });
})();

/* -------- 6. subscriptions found -------- */
(() => {
  const rows = d.subs.map((s, i) => {
    const y = 730 + i * 178;
    return rect(190, y, 1620, 150, { rx: 26, fill: 'rgba(255,255,255,0.04)', stroke: C.line }) +
      mark(232, y + 44, 62, C.gold) +
      txt(318, y + 66, s.name, { size: 38, weight: 700 }) +
      txt(318, y + 110, `found in your history · charged monthly · last ${s.last}`, { size: 26, weight: 500, fill: C.dim }) +
      txt(1300, y + 66, money(s.monthly) + ' / mo', { size: 36, weight: 700, anchor: 'end' }) +
      txt(1300, y + 110, money0(s.yearly) + ' a year', { size: 27, weight: 600, fill: C.warn, anchor: 'end' }) +
      rect(1480, y + 51, 270, 56, { rx: 28, fill: 'rgba(245,196,81,0.16)', stroke: 'rgba(245,196,81,0.4)' }) +
      txt(1615, y + 90, 'Track it', { size: 27, weight: 700, fill: C.gold, anchor: 'middle' });
  }).join('');
  const body = `
  ${txt(190, 655, 'RECURRING CHARGES FOUND ON YOUR OWN HISTORY', { size: 28, weight: 700, fill: C.dim, ls: 3 })}
  ${txt(190, 705, `${money0(d.subsTotal * 12)} a year currently leaving the account`, { size: 32, weight: 600, fill: C.muted })}
  ${rows}
  ${rect(190, 1470, 1620, 150, { rx: 26, fill: 'rgba(245,196,81,0.07)', stroke: 'rgba(245,196,81,0.3)' })}
  ${txt(226, 1530, 'Detected locally', { size: 26, weight: 700, fill: C.gold })}
  ${txt(226, 1578, 'Same merchant, same amount, steady interval. One tap turns a pattern into a proper recurring bill.', { size: 29, weight: 500, fill: C.muted })}`;
  images.push({
    name: '06-subscriptions-found.png',
    svg: frame('6', 'THE MONEY YOU FORGOT ABOUT', ['It finds your', 'subscriptions for you.'],
      '', body, ['Detected from your own spending history', 'Nothing is uploaded to work any of this out'], 'rgba(245,196,81,0.22)')
  });
})();

/* -------- 7. privacy / offline -------- */
(() => {
  const tiles = [
    ['No account. Ever.', 'Nothing to sign up for, nobody to log in as. It opens instantly.', C.gold],
    ['Works with Wi-Fi off', 'One self-contained file. Aeroplane mode, a USB stick, a cabin — all fine.', C.cyan],
    ['No subscription', 'Buy it once. No monthly fee, no premium tier, no ads, no export paywall.', C.green],
    ['Yours for good', 'Five themes, any currency, CSV export and a full backup file.', C.pink]
  ];
  const cards = tiles.map((t, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 190 + col * 810, y = 660 + row * 330;
    return rect(x, y, 770, 300, { rx: 30, fill: 'rgba(255,255,255,0.04)', stroke: C.line }) +
      mark(x + 44, y + 42, 64, t[2]) +
      txt(x + 44, y + 168, t[0], { size: 40, weight: 800 }) +
      wrapped(x + 44, y + 218, t[1], { max: 41, lh: 36 });
  }).join('');
  const themes = [['Midnight', '#f5c451', '#0a0e13', '#e9f0f8'], ['Vault', '#34d399', '#06110e', '#e6f5ef'],
  ['Blush', '#f472b6', '#140d12', '#fbeef5'], ['Daylight', '#4f46e5', '#f4f6fa', '#101a2b'], ['Paper', '#b45309', '#f6f1e7', '#2b2115']];
  const themeRow = themes.map((t, i) => {
    const x = 190 + i * 326;
    return rect(x, 1370, 306, 230, { rx: 26, fill: t[2], stroke: C.line }) +
      rect(x + 30, 1402, 76, 76, { rx: 24, fill: t[1] }) +
      bar(x + 30, 1508, 246, 16, 62, t[1], 'rgba(255,255,255,0.16)') +
      bar(x + 30, 1536, 246, 16, 34, t[1], 'rgba(255,255,255,0.16)') +
      txt(x + 30, 1578, t[0], { size: 30, weight: 700, fill: t[3] });
  }).join('');
  const body = `
  ${txt(190, 655, 'BUILT TO BE TRUSTED', { size: 30, weight: 700, fill: C.dim, ls: 5 })}
  ${cards}
  ${txt(190, 1330, 'FIVE THEMES INCLUDED', { size: 28, weight: 700, fill: C.dim, ls: 4 })}
  ${themeRow}`;
  images.push({
    name: '07-private-offline.png',
    svg: frame('7', 'YOUR MONEY, YOUR BUSINESS', ['No account. No cloud.', 'No monthly fee.'],
      '', body, ['Stored in your own browser, on your own device', 'Export or back up everything any time you like'], 'rgba(74,222,128,0.18)')
  });
})();

/* -------- 8. what is included -------- */
(() => {
  const items = [
    ['Today', 'Safe-to-spend, alerts, the math shown on demand'],
    ['Spend', 'Envelopes, daily pace, merchant history, search, CSV'],
    ['Bills', 'Any schedule, one-tap pay, calendar, duplicates'],
    ['Debts', 'Snowball vs avalanche, payoff dates, interest saved'],
    ['Goals', 'Progress, finish dates, funding check'],
    ['Calendar', 'Bills, income and spending on one month'],
    ['Reports', 'Income vs spending, net worth, money score'],
    ['Settings', 'Any currency, pay cycle, buffer, themes, privacy']
  ];
  const rows = items.map((it, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 190 + col * 810, y = 660 + row * 150;
    return rect(x, y, 770, 126, { rx: 24, fill: 'rgba(255,255,255,0.04)', stroke: C.line }) +
      check(x + 36, y + 74) +
      txt(x + 96, y + 56, it[0], { size: 34, weight: 700 }) +
      txt(x + 96, y + 96, it[1], { size: 25, weight: 500, fill: C.dim });
  }).join('');
  const body = `
  ${txt(190, 655, 'EIGHT SCREENS, ONE FILE', { size: 30, weight: 700, fill: C.dim, ls: 5 })}
  ${rows}
  ${rect(190, 1290, 1620, 330, { rx: 30, fill: 'rgba(245,196,81,0.07)', stroke: 'rgba(245,196,81,0.34)' })}
  ${txt(230, 1358, 'WHAT ARRIVES INSTANTLY', { size: 28, weight: 700, fill: C.gold, ls: 4 })}
  ${txt(230, 1416, 'Waypoint-Budget-Studio.html · Getting-Started-Guide.html · READ-ME-FIRST.txt · LICENSE.txt', { size: 27, weight: 500, fill: C.muted })}
  ${txt(230, 1478, 'A guided welcome, a built-in tour and an illustrated guide — nothing to configure before it works.', { size: 27, weight: 500, fill: C.muted })}
  ${txt(230, 1544, 'Mac · Windows · Linux · iPad · Android tablet — anything with a browser, online or off.', { size: 29, weight: 600 })}`;
  images.push({
    name: '08-whats-included.png',
    svg: frame('8', 'EVERYTHING IN ONE BUDGET', ['Eight screens,', 'one dashboard.'],
      '', body, ['Manual included, plus free updates for life', 'Works on desktop, tablet and phone'], 'rgba(245,196,81,0.22)')
  });
})();

/* -------- 9. comparison -------- */
(() => {
  const oldWay = ['Formulas that break when you add a row', 'A new spreadsheet tab every month', 'A subscription to keep it working', 'Your numbers sitting in someone\u2019s cloud', 'A blank grid and no idea where to start'];
  const newWay = ['Opens already knowing your payday', 'One dashboard, updated as you type', 'Buy once, use it for years', 'Stays on your device, offline if you like', 'Guided setup and an illustrated manual'];
  const col = (x, title, items, accent, good) => {
    let s = rect(x, 560, 860, 1080, { rx: 32, fill: good ? 'rgba(74,222,128,0.05)' : 'rgba(255,255,255,0.028)', stroke: good ? 'rgba(74,222,128,0.34)' : C.line, sw: 3 });
    s += txt(x + 52, 660, title, { size: 42, weight: 800, fill: accent });
    items.forEach((it, i) => {
      const y = 770 + i * 168;
      s += good ? check(x + 52, y) : cross(x + 52, y);
      s += wrapped(x + 112, y, it, { max: 33, lh: 44, size: 31, weight: 500, fill: good ? C.text : C.muted });
    });
    return s;
  };
  const body = `${col(110, 'The spreadsheet way', oldWay, C.danger, false)}${col(1030, 'Waypoint', newWay, C.good, true)}`;
  images.push({
    name: '09-old-way-vs-this.png',
    svg: frame('9', 'WHY PEOPLE SWITCH', ['The old way, or the', 'way it should be.'],
      '', body, ['Same price as a takeaway coffee and a sandwich', 'Free updates, no subscription, ever'], null)
  });
})();

/* ================================================================ render */
let failed = 0;
for (const img of images) {
  try {
    fs.writeFileSync(path.join(OUT, img.name.replace(/\.png$/, '.svg')), img.svg);
    const r = new Resvg(img.svg, {
      font: { loadSystemFonts: true, fontFiles, defaultFontFamily: 'Inter', sansSerifFamily: 'Inter' },
      fitTo: { mode: 'width', value: W }
    });
    const png = r.render().asPng();
    fs.writeFileSync(path.join(OUT, img.name), png);
    console.log(`✓ ${img.name}  (${(png.length / 1024).toFixed(0)} KB)`);
  } catch (e) {
    failed++;
    console.error(`✗ ${img.name}: ${e.message}`);
  }
}
console.log(failed ? `\n${failed} image(s) failed.` : `\nAll ${images.length} listing images rendered to marketing/listing-images/`);
if (failed) process.exitCode = 1;
