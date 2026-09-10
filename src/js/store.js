/* ============================================================================
   Waypoint Budget Studio — Store (state, persistence, demo data)
   No dependencies. Runs from file:// . Data never leaves the device.
   ========================================================================== */
'use strict';

var DB = null;
var STORAGE_KEY = 'waypoint.db.v1';
var BACKUP_KEY = 'waypoint.backup.v1';

/* ---------------------------------------------------------------- utilities */
function uid(prefix) {
  return (prefix || 'id') + '_' + Date.now().toString(36).slice(-5) +
    Math.random().toString(36).slice(2, 7);
}
function r2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }
function sum(arr, fn) {
  var t = 0;
  for (var i = 0; i < arr.length; i++) t += fn ? fn(arr[i], i) : arr[i];
  return t;
}
function byId(list, id) {
  for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return null;
}
function sortBy(list, fn, dir) {
  var d = dir === 'desc' ? -1 : 1;
  return list.slice().sort(function (a, b) {
    var x = fn(a), y = fn(b);
    if (x === y) return 0;
    return (x > y ? 1 : -1) * d;
  });
}

/* ------------------------------------------------------------------- money */
var CURRENCIES = [
  { code: 'USD', label: 'US Dollar' }, { code: 'EUR', label: 'Euro' },
  { code: 'GBP', label: 'British Pound' }, { code: 'CAD', label: 'Canadian Dollar' },
  { code: 'AUD', label: 'Australian Dollar' }, { code: 'NZD', label: 'New Zealand Dollar' },
  { code: 'INR', label: 'Indian Rupee' }, { code: 'ZAR', label: 'South African Rand' },
  { code: 'SEK', label: 'Swedish Krona' }, { code: 'NOK', label: 'Norwegian Krone' },
  { code: 'DKK', label: 'Danish Krone' }, { code: 'CHF', label: 'Swiss Franc' },
  { code: 'PLN', label: 'Polish Zloty' }, { code: 'BRL', label: 'Brazilian Real' },
  { code: 'MXN', label: 'Mexican Peso' }, { code: 'JPY', label: 'Japanese Yen' },
  { code: 'SGD', label: 'Singapore Dollar' }, { code: 'HKD', label: 'Hong Kong Dollar' },
  { code: 'PHP', label: 'Philippine Peso' }, { code: 'MYR', label: 'Malaysian Ringgit' },
  { code: 'THB', label: 'Thai Baht' }, { code: 'IDR', label: 'Indonesian Rupiah' },
  { code: 'AED', label: 'UAE Dirham' }, { code: 'ILS', label: 'Israeli Shekel' },
  { code: 'TRY', label: 'Turkish Lira' }, { code: 'NGN', label: 'Nigerian Naira' }
];

var _moneyFmt = {}, _symCache = {};
function currencySymbol(code, locale) {
  var k = code + '|' + locale;
  if (_symCache[k]) return _symCache[k];
  var out = code;
  try {
    var parts = new Intl.NumberFormat(locale, { style: 'currency', currency: code })
      .formatToParts(1234.56);
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].type === 'currency') { out = parts[i].value; break; }
    }
  } catch (e) { out = code; }
  _symCache[k] = out;
  return out;
}
function fmt(n, decimals) {
  var s = DB.settings;
  var d = decimals === undefined ? 2 : decimals;
  var k = s.currency + '|' + s.locale + '|' + d;
  var f = _moneyFmt[k];
  if (!f) {
    try {
      f = new Intl.NumberFormat(s.locale, {
        style: 'currency', currency: s.currency,
        minimumFractionDigits: d, maximumFractionDigits: d
      });
    } catch (e) { f = null; }
    _moneyFmt[k] = f;
  }
  var v = Number(n) || 0;
  if (f) { try { return f.format(v); } catch (e) { /* fall through */ } }
  return currencySymbol(s.currency, s.locale) + v.toFixed(d);
}
function money(n) { return fmt(n, 2); }
function money0(n) { return fmt(n, 0); }
function moneyShort(n) {
  var a = Math.abs(n), sign = n < 0 ? '-' : '';
  var sym = currencySymbol(DB.settings.currency, DB.settings.locale);
  if (a >= 1000000) return sign + sym + (a / 1000000).toFixed(a >= 10000000 ? 0 : 1) + 'M';
  if (a >= 1000) return sign + sym + (a / 1000).toFixed(a >= 10000 ? 0 : 1) + 'k';
  return sign + sym + Math.round(a);
}
/* Positive amounts print as +$x, negatives as -$x (for deltas). */
function signed(n) { return (n > 0 ? '+' : n < 0 ? '\u2212' : '') + fmt(Math.abs(n), 2).replace('-', ''); }
function pct(n, d) { return clamp(d ? (n / d) * 100 : 0, 0, 9999); }

/* ------------------------------------------------------------------ dates */
function ymd(d) {
  var y = d.getFullYear(), m = d.getMonth() + 1, dd = d.getDate();
  return y + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' : '') + dd;
}
function parseYMD(s) {
  if (!s) return new Date();
  if (s instanceof Date) return new Date(s.getFullYear(), s.getMonth(), s.getDate());
  var p = String(s).slice(0, 10).split('-');
  return new Date(+p[0], (+p[1]) - 1, +p[2]);
}
function dayStart(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function today() { return dayStart(new Date()); }
function addDays(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return dayStart(x); }
function addMonths(d, n) {
  var x = new Date(d.getFullYear(), d.getMonth() + n, 1);
  var last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
  x.setDate(Math.min(d.getDate(), last));
  return dayStart(x);
}
function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function startOfWeek(d, weekStart) {
  var ws = weekStart === undefined ? DB.settings.weekStart : weekStart;
  var diff = (d.getDay() - ws + 7) % 7;
  return addDays(d, -diff);
}
function diffDays(a, b) {
  return Math.round((dayStart(b) - dayStart(a)) / 86400000);
}
function monthKey(d) {
  return d.getFullYear() + '-' + (d.getMonth() + 1 < 10 ? '0' : '') + (d.getMonth() + 1);
}
function parseMonthKey(k) { var p = k.split('-'); return new Date(+p[0], +p[1] - 1, 1); }
function fmtDate(d, style) {
  var dt = parseYMD(d);
  var s = DB.settings;
  try {
    if (style === 'short') return dt.toLocaleDateString(s.locale, { month: 'short', day: 'numeric' });
    if (style === 'medium') return dt.toLocaleDateString(s.locale, { month: 'short', day: 'numeric', year: 'numeric' });
    if (style === 'month') return dt.toLocaleDateString(s.locale, { month: 'long', year: 'numeric' });
    if (style === 'weekday') return dt.toLocaleDateString(s.locale, { weekday: 'short', month: 'short', day: 'numeric' });
    if (style === 'day') return dt.toLocaleDateString(s.locale, { weekday: 'long', month: 'long', day: 'numeric' });
    return dt.toLocaleDateString(s.locale, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (e) { return ymd(dt); }
}
function relDay(d) {
  var n = diffDays(today(), d);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  if (n > 1 && n < 7) return 'In ' + n + ' days';
  if (n < -1 && n > -7) return Math.abs(n) + ' days ago';
  return fmtDate(d, 'short');
}
var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

/* --------------------------------------------------------------- categories */
function defaultCategories() {
  return [
    { id: 'groceries', name: 'Groceries', icon: '\uD83D\uDED2', color: '#38bdf8', cap: 600, rollover: true },
    { id: 'dining', name: 'Dining Out', icon: '\uD83C\uDF5C', color: '#fb923c', cap: 220, rollover: false },
    { id: 'transport', name: 'Transport & Fuel', icon: '\uD83D\uDE97', color: '#a78bfa', cap: 260, rollover: true },
    { id: 'shopping', name: 'Shopping', icon: '\uD83D\uDECD\uFE0F', color: '#f472b6', cap: 180, rollover: false },
    { id: 'fun', name: 'Fun & Hobbies', icon: '\uD83C\uDFAC', color: '#4ade80', cap: 150, rollover: false },
    { id: 'health', name: 'Health', icon: '\uD83D\uDC8A', color: '#22d3ee', cap: 120, rollover: false },
    { id: 'home', name: 'Home & Bills', icon: '\uD83C\uDFE0', color: '#818cf8', cap: 0, rollover: false },
    { id: 'pets', name: 'Pets', icon: '\uD83D\uDC3E', color: '#fdba74', cap: 80, rollover: false },
    { id: 'kids', name: 'Kids', icon: '\uD83E\uDDF8', color: '#c084fc', cap: 0, rollover: false },
    { id: 'subs', name: 'Subscriptions', icon: '\uD83D\uDD01', color: '#facc15', cap: 90, rollover: false },
    { id: 'personal', name: 'Personal Care', icon: '\u2728', color: '#f0abfc', cap: 70, rollover: false },
    { id: 'gifts', name: 'Gifts & Giving', icon: '\uD83C\uDF81', color: '#f87171', cap: 60, rollover: true },
    { id: 'fees', name: 'Fees & Interest', icon: '\uD83C\uDFE6', color: '#94a3b8', cap: 0, rollover: false },
    { id: 'other', name: 'Other', icon: '\uD83D\uDCE6', color: '#64748b', cap: 100, rollover: false }
  ];
}

/* ------------------------------------------------------------------ schema */
var FREQ = [
  { id: 'weekly', label: 'Every week', days: 7 },
  { id: 'biweekly', label: 'Every 2 weeks', days: 14 },
  { id: 'semimonthly', label: 'Twice a month', days: 15 },
  { id: 'monthly', label: 'Monthly', days: 30 },
  { id: 'bimonthly', label: 'Every 2 months', days: 61 },
  { id: 'quarterly', label: 'Every 3 months', days: 91 },
  { id: 'semiannual', label: 'Every 6 months', days: 182 },
  { id: 'annual', label: 'Once a year', days: 365 }
];
var FREQ_LABEL = {}; FREQ.forEach(function (f) { FREQ_LABEL[f.id] = f.label; });
function freqPerMonth(id) {
  switch (id) {
    case 'weekly': return 52 / 12;
    case 'biweekly': return 26 / 12;
    case 'semimonthly': return 2;
    case 'monthly': return 1;
    case 'bimonthly': return 0.5;
    case 'quarterly': return 1 / 3;
    case 'semiannual': return 1 / 6;
    case 'annual': return 1 / 12;
    default: return 1;
  }
}
function freqPerYear(id) { return freqPerMonth(id) * 12; }

function blankDB() {
  var t = today();
  return {
    v: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    settings: {
      name: '',
      currency: 'USD',
      locale: (function () {
        try { return navigator.language || 'en-US'; } catch (e) { return 'en-US'; }
      })(),
      theme: 'midnight',
      accent: '',
      privacy: false,
      rollover: true,
      safeMode: 'untilPayday',
      weekStart: 0,
      includeSavingsInSafe: false,
      goalReserveInSafe: true,
      spendPaceInSafe: false,
      payMode: 'biweekly',
      anchor: ymd(addDays(t, -3)),
      safetyBuffer: 100,
      dismiss: {},
      lastBackup: null
    },
    accounts: [
      { id: 'chk', name: 'Everyday Checking', kind: 'checking', balance: 0, includeInSafe: true },
      { id: 'sav', name: 'Savings', kind: 'savings', balance: 0, includeInSafe: false }
    ],
    income: [],
    bills: [],
    cats: defaultCategories(),
    tx: [],
    debts: [],
    goals: [],
    paid: {},
    snaps: [],
    done: { welcome: false, tour: false }
  };
}

/* --------------------------------------------------------------- persistence */
var _saveTimer = null, _quotaWarned = false;
function save(immediate) {
  if (!DB) return;
  DB.updatedAt = new Date().toISOString();
  var write = function () {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DB));
    } catch (e) {
      if (!_quotaWarned) {
        _quotaWarned = true;
        if (window.App && App.toast) App.toast('Storage is full or blocked — export a backup now.', 'warn', 9000);
      }
    }
    _saveTimer = null;
  };
  if (immediate) { if (_saveTimer) clearTimeout(_saveTimer); write(); }
  else { if (_saveTimer) clearTimeout(_saveTimer); _saveTimer = setTimeout(write, 250); }
}

function load() {
  var raw = null;
  try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { raw = null; }
  if (!raw) { DB = blankDB(); return { fresh: true }; }
  try {
    var parsed = JSON.parse(raw);
    DB = migrate(parsed);
    return { fresh: false };
  } catch (e) {
    try { localStorage.setItem(BACKUP_KEY, raw); } catch (e2) { }
    DB = blankDB();
    return { fresh: true, corrupt: true };
  }
}

function migrate(db) {
  var base = blankDB();
  /* shallow-merge unknown keys forward so upgrades never wipe data */
  var out = {};
  for (var k in base) if (base.hasOwnProperty(k)) out[k] = base[k];
  for (var k2 in db) if (db.hasOwnProperty(k2)) out[k2] = db[k2];
  var s = {}; for (var k3 in base.settings) s[k3] = base.settings[k3];
  for (var k4 in (db.settings || {})) s[k4] = db.settings[k4];
  out.settings = s;
  out.cats = (db.cats && db.cats.length) ? db.cats : defaultCategories();
  out.tx = db.tx || []; out.bills = db.bills || []; out.income = db.income || [];
  out.debts = db.debts || []; out.goals = db.goals || []; out.accounts = db.accounts || base.accounts;
  out.paid = db.paid || {}; out.snaps = db.snaps || [];
  out.done = db.done || { welcome: false, tour: false };
  out.v = 1;
  return out;
}

function exportJSON() {
  var payload = { app: BRAND.name + ' ' + BRAND.tag, kind: 'backup', v: DB.v, exportedAt: new Date().toISOString(), data: DB };
  return JSON.stringify(payload);
}
function importJSON(text) {
  var obj = JSON.parse(text);
  var data = obj && obj.data ? obj.data : obj;
  if (!data || !data.settings) throw new Error('Not a Waypoint backup file.');
  DB = migrate(data);
  save(true);
}

/* -------------------------------------------------------- undo + snapshots */
var _undo = null;
function snapshot(label) {
  _undo = { label: label, json: JSON.stringify(DB), at: Date.now() };
}
function undo() {
  if (!_undo) return false;
  DB = JSON.parse(_undo.json);
  var lbl = _undo.label; _undo = null;
  save(true);
  if (window.App) { App.render(); App.toast('Undid ' + lbl, 'ok'); }
  return true;
}

/* --------------------------------------------------------------- demo data */
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function seedDemo() {
  var rnd = mulberry32(20260910);
  var t = today();
  var db = blankDB();

  db.settings.name = 'Sam';
  /* caps sized to the demo's real cost of living, housing included, so the
     envelope screen, the month card and the bills screen all reconcile */
  var demoCaps = { home: 1950, transport: 380, health: 190, subs: 70, fees: 60, groceries: 600, dining: 150, fun: 110, shopping: 180, pets: 80, personal: 70, gifts: 60, other: 100 };
  db.settings.payMode = 'biweekly';
  db.settings.anchor = ymd(addDays(t, -2));

  db.accounts = [
    { id: 'chk', name: 'Everyday Checking', kind: 'checking', balance: 1842.65, includeInSafe: true },
    { id: 'sav', name: 'High-Yield Savings', kind: 'savings', balance: 6120.00, includeInSafe: false },
    { id: 'ret', name: 'Retirement', kind: 'investment', balance: 22000.00, includeInSafe: false }
  ];

  db.cats.forEach(function (c) { if (demoCaps[c.id] !== undefined) c.cap = demoCaps[c.id]; });

  db.income = [
    { id: uid('inc'), name: 'Paycheck \u2014 Day Job', amount: 2480.00, freq: 'biweekly', nextDate: ymd(addDays(t, 12)), accountId: 'chk', active: true, variable: false },
    { id: uid('inc'), name: 'Freelance Design', amount: 620.00, freq: 'monthly', nextDate: ymd(addDays(t, 22)), accountId: 'chk', active: true, variable: true }
  ];

  /* monthly bills are anchored to a day of the month so the demo lands in a
     realistic mid-month state: early bills already paid, later ones upcoming */
  function nextDom(dom) {
    var y = t.getFullYear(), m = t.getMonth();
    var cand = new Date(y, m, Math.min(dom, daysInMonth(y, m)));
    if (cand < t) {
      var nm = addMonths(startOfMonth(t), 1);
      cand = new Date(nm.getFullYear(), nm.getMonth(), Math.min(dom, daysInMonth(nm.getFullYear(), nm.getMonth())));
    }
    return cand;
  }
  function bill(name, amount, freq, when, catId, opts) {
    var o = opts || {};
    var anchor = (freq === 'monthly' || freq === 'semimonthly') ? nextDom(when) : addDays(t, when);
    return {
      id: uid('bill'), name: name, amount: amount, freq: freq,
      nextDate: ymd(anchor), catId: catId, accountId: o.acct || 'chk',
      icon: o.icon || '', autopay: !!o.autopay, active: true, variable: !!o.variable,
      notes: o.notes || '', reminder: o.reminder === undefined ? 3 : o.reminder
    };
  }
  db.bills = [
    bill('Rent', 1650, 'monthly', 1, 'home', { autopay: true, icon: '\uD83C\uDFE0' }),
    bill('Electric', 128, 'monthly', 5, 'home', { autopay: true, variable: true, icon: '\u26A1' }),
    bill('Internet', 65, 'monthly', 15, 'home', { autopay: true, icon: '\uD83D\uDCF6' }),
    bill('Phone', 48, 'monthly', 19, 'home', { autopay: true, icon: '\uD83D\uDCF1' }),
    bill('Car Insurance', 142, 'monthly', 21, 'transport', { autopay: true, icon: '\uD83D\uDE97' }),
    bill('Gym', 39, 'monthly', 25, 'health', { autopay: true, icon: '\uD83C\uDFCB\uFE0F' }),
    bill('Water & Sewer', 54, 'bimonthly', 26, 'home', { variable: true, icon: '\uD83D\uDCA7' }),
    bill('Renters Insurance', 186, 'annual', 63, 'home', { icon: '\uD83D\uDEE1\uFE0F' }),
    bill('Car Registration', 132, 'annual', 148, 'transport', { icon: '\uD83D\uDCC4' }),
    bill('Vet Checkup', 95, 'semiannual', 41, 'pets', { icon: '\uD83D\uDC3E' })
  ];

  db.debts = [
    { id: uid('dbt'), name: 'Rewards Card', balance: 3180, apr: 24.9, minPayment: 95, extra: 0, dueDay: 18, icon: '\uD83D\uDCB3' },
    { id: uid('dbt'), name: 'Student Loan', balance: 11480, apr: 5.4, minPayment: 148, extra: 0, dueDay: 5, icon: '\uD83C\uDF93' },
    { id: uid('dbt'), name: 'Car Loan', balance: 9260, apr: 6.9, minPayment: 315, extra: 0, dueDay: 11, icon: '\uD83D\uDE97' },
    { id: uid('dbt'), name: 'Store Card', balance: 640, apr: 9.9, minPayment: 25, extra: 0, dueDay: 24, icon: '\uD83D\uDECD\uFE0F' }
  ];

  db.goals = [
    { id: uid('goal'), name: 'Emergency Fund', target: 9000, saved: 5760, date: ymd(addMonths(t, 10)), icon: '\uD83D\uDEE1\uFE0F', color: '#38bdf8', monthly: 325, accountId: 'sav' },
    { id: uid('goal'), name: 'Japan Trip', target: 4200, saved: 1180, date: ymd(addMonths(t, 16)), icon: '\u2708\uFE0F', color: '#f472b6', monthly: 190, accountId: 'sav' },
    { id: uid('goal'), name: 'New Laptop', target: 1800, saved: 640, date: ymd(addMonths(t, 7)), icon: '\uD83D\uDCBB', color: '#a78bfa', monthly: 165, accountId: 'sav' },
    { id: uid('goal'), name: 'Car Maintenance Fund', target: 1200, saved: 470, date: ymd(addMonths(t, 9)), icon: '\uD83D\uDD27', color: '#4ade80', monthly: 80, accountId: 'sav' },
    { id: uid('goal'), name: 'Holiday Gifts', target: 750, saved: 210, date: ymd(new Date(t.getFullYear(), 11, 15)), icon: '\uD83C\uDF81', color: '#facc15', monthly: 90, accountId: 'sav' }
  ];

  /* ---- ~5 months of transactions ---- */
  var merchants = {
    groceries: [['Whole Foods', 42, 130], ['Trader Joe\'s', 28, 78], ['Kroger', 34, 96], ['Costco', 78, 210], ['Corner Market', 8, 32]],
    dining: [['Chipotle', 11, 22], ['Blue Bottle Coffee', 4, 9], ['Thai Garden', 24, 62], ['Pizza Night', 18, 44], ['Taco Truck', 9, 21], ['Brunch Cafe', 22, 48]],
    transport: [['Shell Fuel', 32, 68], ['Uber', 9, 34], ['Parking Garage', 4, 18], ['Car Wash', 12, 22]],
    shopping: [['Amazon', 14, 88], ['Target', 22, 130], ['Old Navy', 28, 95], ['Etsy', 12, 54]],
    fun: [['AMC Theatres', 14, 38], ['Steam', 8, 40], ['Bookshop', 12, 34], ['Concert Tickets', 45, 140], ['Mini Golf', 16, 34]],
    health: [['Pharmacy', 9, 42], ['Dentist Co-pay', 40, 120], ['Vitamins', 18, 46]],
    home: [['Hardware Store', 15, 90], ['Cleaning Supplies', 12, 38], ['IKEA', 30, 160]],
    pets: [['PetSmart', 18, 72], ['Vet Visit', 60, 180]],
    kids: [['School Supplies', 12, 48], ['Toy Store', 15, 60]],
    subs: [['Netflix', 22.99, 22.99], ['Spotify', 11.99, 11.99], ['iCloud', 9.99, 9.99], ['Adobe Creative', 22.99, 22.99]],
    personal: [['Haircut', 32, 55], ['Sephora', 18, 66], ['Barber', 25, 35]],
    gifts: [['Birthday Gift', 20, 70], ['Flowers', 18, 52], ['Donation', 10, 45]],
    fees: [['Card Interest', 12, 48], ['ATM Fee', 3, 3], ['Bank Fee', 4, 12]],
    other: [['Misc', 6, 40]]
  };
  var catIds = ['groceries', 'dining', 'transport', 'shopping', 'fun', 'health', 'pets', 'kids', 'personal', 'gifts', 'other'];
  var tx = [];
  var start = addMonths(t, -5);
  start = new Date(start.getFullYear(), start.getMonth(), 1);
  var totalDays = diffDays(start, t);
  for (var d = 0; d <= totalDays; d++) {
    var day = addDays(start, d);
    var dow = day.getDay();
    var weekendBoost = (dow === 0 || dow === 6) ? 1.75 : 1;
    var n = rnd() < 0.44 * weekendBoost ? Math.ceil(rnd() * 2.2) : 0;
    if (dow === 2 || dow === 5) n += 1;               /* grocery days */
    for (var i = 0; i < n; i++) {
      var isGroceryDay = (dow === 2 || dow === 5) && i === 0;
      var cat = isGroceryDay ? 'groceries' : catIds[Math.floor(rnd() * catIds.length)];
      var m = merchants[cat];
      var pick = m[Math.floor(rnd() * m.length)];
      var amt = pick[1] + rnd() * (pick[2] - pick[1]);
      var acct = rnd() < 0.88 ? 'chk' : 'sav';
      tx.push({
        id: uid('tx'), date: ymd(day), amount: -r2(amt), catId: cat,
        accountId: acct, note: pick[0], tags: [], type: 'expense', cleared: true
      });
    }
  }
  /* untracked subscriptions: identical amounts on the same day each month, so
     the app's detector can find them and offer one-tap tracking */
  var subs = [
    ['Netflix', 22.99, 13], ['Spotify Premium', 11.99, 17],
    ['iCloud Storage', 9.99, 8], ['Adobe Creative Cloud', 22.99, 22]
  ];
  for (var sm = -5; sm <= 0; sm++) {
    subs.forEach(function (sb) {
      var m3 = addMonths(t, sm);
      var day = new Date(m3.getFullYear(), m3.getMonth(), sb[2]);
      if (day > t) return;
      tx.push({
        id: uid('tx'), date: ymd(day), amount: -sb[1], catId: 'subs', accountId: 'chk',
        note: sb[0], tags: [], type: 'expense', cleared: true
      });
    });
  }

  /* paychecks every two weeks for the whole window */
  for (var pd = addDays(t, -3); pd >= start; pd = addDays(pd, -14)) {
    tx.push({
      id: uid('tx'), date: ymd(pd), amount: 2480, catId: 'income', accountId: 'chk',
      note: 'Paycheck \u2014 Day Job', tags: [], type: 'income', cleared: true
    });
  }
  tx.push({ id: uid('tx'), date: ymd(addDays(t, -9)), amount: 620, catId: 'income', accountId: 'chk', note: 'Freelance \u2014 brand refresh', tags: ['freelance'], type: 'income', cleared: true });
  tx.push({ id: uid('tx'), date: ymd(addDays(t, -22)), amount: 480, catId: 'income', accountId: 'chk', note: 'Freelance \u2014 landing page', tags: ['freelance'], type: 'income', cleared: true });

  db.tx = tx;

  /* mark bills paid and record the real outflow in the log, so rent and the
     subscriptions show up exactly like they would for a real user */
  db.paid = {};
  db.bills.forEach(function (b) {
    var history = expand({ nextDate: b.nextDate, freq: b.freq, active: true }, addMonths(t, -5), t);
    history.forEach(function (dd) {
      db.paid[b.id + ':' + monthKey(dd)] = ymd(dd);
      var drift = b.variable ? (0.82 + rnd() * 0.36) : 1;
      tx.push({
        id: uid('tx'), date: ymd(dd), amount: -r2(b.amount * drift), catId: b.catId,
        accountId: b.accountId || 'chk', note: b.name, tags: ['bill'], type: 'expense', cleared: true
      });
    });
  });

  /* net-worth snapshot history */
  db.snaps = [];
  for (var s = -5; s <= 0; s++) {
    var m2 = addMonths(t, s);
    var progress = (s + 5) / 5;                       /* 0 → 5 months ago, 1 → today */
    var wiggle = (rnd() - 0.5) * 420;
    db.snaps.push({ date: ymd(endOfMonth(m2)), netWorth: r2(-2400 + progress * 8200 + wiggle) });
  }
  db.snaps[db.snaps.length - 1].netWorth = 5400;

  /* keep the log in chronological order after every generator has run */
  db.tx.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  db.done = { welcome: true, tour: false };
  DB = db;
  save(true);
}

function resetBlank() {
  var s = JSON.parse(JSON.stringify(DB.settings));
  DB = blankDB();
  DB.settings = s;
  DB.done = { welcome: false, tour: false };
  save(true);
}
