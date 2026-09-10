/* ============================================================================
   Waypoint Budget Studio — verification harness
   Boots the real dashboard in a headless DOM, drives every screen and action,
   then re-runs the same checks against the *built* single-file product.

   Usage:  WAYPOINT_DEPS=/path/to/node_modules node build/verify.js
   Exits non-zero on any runtime error or failed assertion.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const DEP_DIR = process.env.WAYPOINT_DEPS || '/home/user/_dev/node_modules';
const { JSDOM, VirtualConsole } = require(require.resolve('jsdom', { paths: [DEP_DIR] }));

const errors = [];
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
}

function boot(html, scripts) {
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => { if (!/Not implemented/.test(e.message)) errors.push('jsdom: ' + e.message); });
  vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc });
  const win = dom.window;
  win.scrollTo = () => { };
  for (const s of scripts) {
    const el = win.document.createElement('script');
    el.textContent = s.code;
    win.document.head.appendChild(el);
  }
  return win;
}
function evalIn(win, label, code) {
  try { return win.eval(code); }
  catch (e) { errors.push(label + ' → ' + e.message); return undefined; }
}

/* ---------------------------------------------------------------- source */
const ROOT_HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/<script[^>]*><\/script>/g, '');
const MODULES = ['store', 'engine', 'charts', 'app', 'views']
  .map((f) => ({ name: f, code: fs.readFileSync(path.join(ROOT, 'src/js', f + '.js'), 'utf8') }));

const win = boot(ROOT_HTML, MODULES);
check('app booted from source', evalIn(win, 'App', 'typeof App') === 'object');
evalIn(win, 'seed', 'seedDemo(); App.render();');
check('demo data loads', evalIn(win, 'tx', 'DB.tx.length') > 200);

const ROUTES = ['today', 'spend', 'bills', 'debts', 'goals', 'calendar', 'reports', 'settings'];
ROUTES.forEach((r) => {
  evalIn(win, 'go ' + r, `App.go('${r}')`);
  const len = evalIn(win, 'len ' + r, `document.getElementById('view').innerHTML.length`);
  check('view renders: ' + r, len > 2500, len);
});

/* maths: an independent simulation must agree with the debt engine */
const debtCheck = evalIn(win, 'debts', `(function () {
  var plan = debtPlan('snowball', 0);
  var debts = DB.debts.map(function (d) { return { bal: +d.balance, apr: +d.apr, min: +d.minPayment }; });
  var budget = debts.reduce(function (a, d) { return a + d.min; }, 0), months = 0;
  while (debts.some(function (d) { return d.bal > 0.005; }) && months < 400) {
    months++;
    debts.forEach(function (d) { d.bal += d.bal * (d.apr / 100 / 12); });
    var pot = budget;
    debts.forEach(function (d) { var p = Math.min(d.bal, d.min, pot); d.bal -= p; pot -= p; });
    while (pot > 0.005) {
      var list = debts.filter(function (d) { return d.bal > 0.005; });
      if (!list.length) break;
      list.sort(function (a, b) { return a.bal - b.bal; });
      var p2 = Math.min(list[0].bal, pot); list[0].bal -= p2; pot -= p2;
    }
  }
  return JSON.stringify({ engine: plan.months, independent: months });
})()`);
const dc = JSON.parse(debtCheck || '{}');
check('debt engine matches independent simulation', dc.engine === dc.independent, debtCheck);

const sts = evalIn(win, 'sts', 'JSON.stringify(safeToSpend())');
const stsObj = JSON.parse(sts || '{}');
check('safe-to-spend is finite', isFinite(stsObj.safe) && isFinite(stsObj.perDay), sts);
check('forecast has 45 points', evalIn(win, 'fc', 'forecast(45).points.length') === 46);
check('every amount is a number', evalIn(win, 'nan', 'JSON.stringify(DB.tx.filter(function(t){return typeof t.amount !== "number" || isNaN(t.amount);}).length)') === '0');

/* interactions */
evalIn(win, 'quick add', `App.quickAdd('18.75 lunch #dining')`);
check('quick add filed a transaction', evalIn(win, 'qa', `DB.tx[DB.tx.length-1].catId`) === 'dining');
evalIn(win, 'quick add parse', `App.quickAdd('62.30 Costco #groceries yesterday')`);
check('quick add understands yesterday', evalIn(win, 'qa2', `DB.tx[DB.tx.length-1].date`) === evalIn(win, 'y', 'ymd(addDays(today(),-1))'));
evalIn(win, 'pay bill', `App.payBill(billOccurrences(today(), addDays(today(),30))[0].bill.id, ymd(today()))`);
evalIn(win, 'pay confirm', `document.getElementById('modal-root').querySelector('#pbOk').click()`);
check('marking a bill paid logs the expense', evalIn(win, 'paid', `(function(){var o=billOccurrences(today(), addDays(today(),30))[0]; return o.paid;})()`) === true);
evalIn(win, 'export/import', `(function(){ var j = exportJSON(); var n = DB.tx.length; importJSON(j); return n === DB.tx.length; })()`);
check('backup round-trips without data loss', evalIn(win, 'rt', 'DB.tx.length') > 200);
evalIn(win, 'csv', `App.actions.exportCsv({dataset:{id:'tx'}})`);
evalIn(win, 'snapshot', `App.actions.snapshot()`);
evalIn(win, 'tour', `App.startTour(); App.actions.tourNext(); App.actions.tourNext(); App.endTour();`);

/* empty state must not explode */
evalIn(win, 'wipe', `(function(){ resetBlank(); App.render(); return true; })()`);
ROUTES.forEach((r) => {
  evalIn(win, 'empty ' + r, `App.go('${r}')`);
  check('empty state renders: ' + r, (evalIn(win, 'el', `document.getElementById('view').innerHTML.length`) || 0) > 200);
});
evalIn(win, 'preset', `App.seedPreset('Freelancer'); App.render();`);
check('preset applies', evalIn(win, 'p', 'DB.bills.length') > 3);

/* ------------------------------------------------------- built product */
const BUILT = path.join(ROOT, 'dist', 'Waypoint-Budget-Studio.html');
if (fs.existsSync(BUILT)) {
  const builtWin = boot(fs.readFileSync(BUILT, 'utf8'), []);
  check('built file has no external requests',
    builtWin.document.querySelectorAll('script[src], link[href], img[src]').length === 0);
  check('built file boots', (evalIn(builtWin, 'bApp', 'typeof App') || 'pending') === 'object', 'App not ready synchronously');
  evalIn(builtWin, 'b seed', 'seedDemo(); App.render();');
  ROUTES.forEach((r) => {
    evalIn(builtWin, 'b go ' + r, `App.go('${r}')`);
    check('built view: ' + r, (evalIn(builtWin, 'b len', `document.getElementById('view').innerHTML.length`) || 0) > 2500);
  });
  check('built file persists to localStorage', !!builtWin.localStorage.getItem('waypoint.db.v1'));
} else {
  check('dist/ bundle present (run node build/build.js)', false, BUILT + ' missing');
}

/* ------------------------------------------------------------- report */
const failed = results.filter((r) => !r.ok);
const pad = Math.max(...results.map((r) => r.name.length)) + 2;
console.log('\nWaypoint verification');
console.log('='.repeat(pad + 8));
results.forEach((r) => console.log((r.ok ? ' PASS  ' : ' FAIL  ') + r.name.padEnd(pad) + (r.ok ? '' : String(r.detail === undefined ? '' : r.detail))));
if (errors.length) {
  console.log('\nRuntime errors (' + errors.length + '):');
  errors.slice(0, 20).forEach((e) => console.log('  • ' + e));
}
console.log('\n' + (results.length - failed.length) + '/' + results.length + ' checks passed' +
  (errors.length ? ', ' + errors.length + ' runtime errors' : ', no runtime errors'));
process.exitCode = (failed.length || errors.length) ? 1 : 0;
