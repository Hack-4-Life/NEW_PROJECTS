/* ============================================================================
   Waypoint Budget Studio — Engine
   All money math lives here: recurrence, safe-to-spend, forecasting,
   envelope pacing, debt payoff simulation, subscription detection, scoring.
   ========================================================================== */
'use strict';

/* --------------------------------------------------------- recurrence core */
var _expandMemo = {};
function expand(item, from, to) {
  var out = [];
  if (!item || !item.nextDate || item.active === false) return out;
  var seed = parseYMD(item.nextDate);
  if (isNaN(seed.getTime())) return out;
  var f = item.freq || 'monthly';
  var f0 = dayStart(from), t0 = dayStart(to);
  if (t0 < f0) return out;

  if (f === 'semimonthly') {
    /* two hits per month: day X and day X+15 of the seed date, clamped */
    var d1 = Math.min(seed.getDate(), 28);
    var d2 = Math.min(d1 + 15, 31);
    var cur = startOfMonth(f0);
    var guard = 0;
    while (cur <= t0 && guard++ < 240) {
      var y = cur.getFullYear(), m = cur.getMonth(), last = daysInMonth(y, m);
      [d1, d2].forEach(function (dd) {
        var day = Math.min(dd, last);
        var dt = new Date(y, m, day);
        if (dt >= f0 && dt <= t0) out.push(dt);
      });
      cur = addMonths(cur, 1);
    }
    return out;
  }

  var steps = { weekly: 7, biweekly: 14 };
  if (steps[f]) {
    var step = steps[f];
    var diff = diffDays(seed, f0);
    var k = Math.ceil(diff / step);
    var d = addDays(seed, k * step);
    var g2 = 0;
    while (d <= t0 && g2++ < 2000) { if (d >= f0) out.push(d); d = addDays(d, step); }
    return out;
  }

  var monthStep = { monthly: 1, bimonthly: 2, quarterly: 3, semiannual: 6, annual: 12 }[f] || 1;
  /* the series conceptually extends backwards and forwards from the seed date,
     so walk back to the last occurrence at or before the window, then forward */
  var cursor = dayStart(seed), g3 = 0;
  while (cursor > f0 && g3++ < 600) cursor = addMonths(cursor, -monthStep);
  while (cursor < f0 && g3++ < 900) cursor = addMonths(cursor, monthStep);
  while (cursor <= t0 && g3++ < 900) { out.push(dayStart(cursor)); cursor = addMonths(cursor, monthStep); }
  return out;
}

function occurrenceKey(itemId, date) { return itemId + ':' + monthKey(date); }
function isPaid(billId, date) { return !!DB.paid[occurrenceKey(billId, date)]; }

function billOccurrences(from, to, opts) {
  var o = opts || {}, out = [];
  DB.bills.forEach(function (b) {
    if (o.activeOnly !== false && b.active === false) return;
    expand(b, from, to).forEach(function (d) {
      out.push({ bill: b, date: d, amount: b.amount, key: occurrenceKey(b.id, d), paid: isPaid(b.id, d) });
    });
  });
  return sortBy(out, function (x) { return x.date.getTime(); });
}
function incomeOccurrences(from, to) {
  var out = [];
  DB.income.forEach(function (i) {
    if (i.active === false) return;
    expand(i, from, to).forEach(function (d) {
      out.push({ item: i, date: d, amount: i.amount });
    });
  });
  return sortBy(out, function (x) { return x.date.getTime(); });
}

/* --------------------------------------------------------------- accounts */
function accountCash() {
  var s = DB.settings, total = 0;
  DB.accounts.forEach(function (a) {
    if (a.includeInSafe === false) return;
    if (a.kind === 'credit' || a.kind === 'loan') return;
    if (a.kind === 'savings' && !s.includeSavingsInSafe) return;
    total += Number(a.balance) || 0;
  });
  return total;
}
function allCash() {
  return sum(DB.accounts.filter(function (a) {
    return a.kind !== 'credit' && a.kind !== 'loan';
  }), function (a) { return Number(a.balance) || 0; });
}
/* checking + cash + savings: what a cash-flow forecast should actually move */
function spendableCash() {
  return sum(DB.accounts.filter(function (a) {
    return a.kind === 'checking' || a.kind === 'cash' || a.kind === 'savings';
  }), function (a) { return Number(a.balance) || 0; });
}
function netWorth() {
  var assets = 0, liab = 0;
  DB.accounts.forEach(function (a) {
    var b = Number(a.balance) || 0;
    if (a.kind === 'credit' || a.kind === 'loan') liab += Math.max(0, -b);
    else assets += b;
  });
  DB.debts.forEach(function (d) { liab += Math.max(0, Number(d.balance) || 0); });
  return r2(assets - liab);
}

/* ------------------------------------------------------------ payday core */
function nextPayday(from) {
  var f = dayStart(from || today());
  var horizon = addDays(f, 70);
  var inc = incomeOccurrences(f, horizon);
  if (inc.length) return inc[0].date;
  /* fallback to the configured schedule */
  return nextScheduledPayday(f);
}
function nextScheduledPayday(from) {
  var s = DB.settings, seed = parseYMD(s.anchor);
  var mode = s.payMode;
  if (mode === 'weekly') {
    var diff = diffDays(seed, from);
    var k = Math.ceil(diff / 7);
    return addDays(seed, Math.max(0, k) * 7);
  }
  if (mode === 'semimonthly') {
    var list = expand({ nextDate: s.anchor, freq: 'semimonthly', active: true }, from, addDays(from, 70));
    return list.length ? list[0] : addDays(from, 15);
  }
  if (mode === 'monthly') {
    var l2 = expand({ nextDate: s.anchor, freq: 'monthly', active: true }, from, addDays(from, 70));
    return l2.length ? l2[0] : addDays(from, 30);
  }
  var l3 = expand({ nextDate: s.anchor, freq: 'biweekly', active: true }, from, addDays(from, 70));
  return l3.length ? l3[0] : addDays(from, 14);
}
function paydaysIn(from, to) {
  var inc = incomeOccurrences(from, to);
  if (inc.length) return inc.map(function (x) { return x.date; });
  return expand({ nextDate: DB.settings.anchor, freq: DB.settings.payMode === 'custom' ? 'biweekly' : DB.settings.payMode, active: true }, from, to);
}

/* ------------------------------------------------------------ fast index
   One pass over every transaction, rebuilt only when the data changes.
   Keeps the dashboard (which asks a lot of questions) instant.            */
var _idx = null;
function isScheduled(t) {
  if (!t.tags || !t.tags.length) return false;
  for (var i = 0; i < t.tags.length; i++) if (t.tags[i] === 'bill' || t.tags[i] === 'goal') return true;
  return false;
}
function txIndex() {
  if (_idx && _idx.stamp === DB.updatedAt) return _idx;
  var ix = { stamp: DB.updatedAt, month: {}, day: {} };
  DB.tx.forEach(function (t) {
    var d = parseYMD(t.date);
    var mk = monthKey(d), dk = ymd(d);
    var m = ix.month[mk] || (ix.month[mk] = { cat: {}, income: 0, expense: 0, count: 0 });
    var rec = ix.day[dk] || (ix.day[dk] = { spend: 0, income: 0, count: 0, cat: {}, scheduled: 0 });
    var amt = Math.abs(Number(t.amount) || 0);
    m.count++; rec.count++;
    if (t.amount >= 0) { m.income += amt; rec.income += amt; }
    else {
      m.expense += amt; rec.spend += amt;
      m.cat[t.catId] = (m.cat[t.catId] || 0) + amt;
      rec.cat[t.catId] = (rec.cat[t.catId] || 0) + amt;
      if (isScheduled(t)) rec.scheduled += amt;          /* bills + goal deposits */
    }
  });
  _idx = ix;
  return ix;
}
function isWholeMonth(from, to) {
  return from.getDate() === 1 &&
    to.getMonth() === from.getMonth() && to.getFullYear() === from.getFullYear() &&
    to.getDate() === daysInMonth(from.getFullYear(), from.getMonth());
}

/* --------------------------------------------------------- average spend */
function dailyDiscretionary(days) {
  var n = days || 45;
  var to = today(), from = addDays(to, -n);
  var ix = txIndex();
  var tot = 0;
  for (var i = 0; i <= n; i++) {
    var d = addDays(from, i);
    var rec = ix.day[ymd(d)];
    if (!rec) continue;
    /* strips out bills and goal deposits: those are already scheduled elsewhere */
    tot += Math.max(0, rec.spend - rec.scheduled);
  }
  if (tot <= 0) {
    var cap = sum(DB.cats.filter(function (c) { return c.cap > 0; }), function (c) { return c.cap; });
    var dim = daysInMonth(to.getFullYear(), to.getMonth());
    return cap ? cap / dim : 0;
  }
  return tot / Math.max(14, n);
}

/* --------------------------------------------------------- safe to spend */
function safeToSpend() {
  var s = DB.settings;
  var t = today();
  var pay = nextPayday(t);
  var scopeEnd, mode = s.safeMode;
  if (mode === 'restOfMonth') scopeEnd = endOfMonth(t);
  else if (mode === 'next30') scopeEnd = addDays(t, 30);
  else scopeEnd = pay;
  if (scopeEnd < t) scopeEnd = t;

  var cash = accountCash();
  var bills = billOccurrences(t, scopeEnd).filter(function (o) { return !o.paid; });
  var billTotal = sum(bills, function (o) { return o.amount; });

  /* debt minimums falling inside the scope */
  var dm = 0, debtHits = [];
  DB.debts.forEach(function (d) {
    if (!(d.minPayment > 0)) return;
    var due = Number(d.dueDay) || 1;
    var cursor = startOfMonth(t); var guard = 0;
    while (cursor <= scopeEnd && guard++ < 6) {
      var last = daysInMonth(cursor.getFullYear(), cursor.getMonth());
      var dt = new Date(cursor.getFullYear(), cursor.getMonth(), Math.min(due, last));
      if (dt >= t && dt <= scopeEnd) { dm += d.minPayment; debtHits.push({ debt: d, date: dt, amount: d.minPayment }); }
      cursor = addMonths(cursor, 1);
    }
  });

  /* goal contributions due before the next payday */
  var goalReserve = 0;
  if (s.goalReserveInSafe) {
    var spanDays = Math.max(1, diffDays(t, scopeEnd) + 1);
    var perDay = sum(DB.goals, function (g) { return (Number(g.monthly) || 0) * 12 / 365; });
    goalReserve = r2(perDay * spanDays);
  }

  /* realistic mode: also hold back expected everyday spending */
  var paceReserve = 0;
  if (s.spendPaceInSafe) {
    var span = Math.max(1, diffDays(t, scopeEnd) + 1);
    paceReserve = r2(dailyDiscretionary() * span);
  }

  var buffer = Number(s.safetyBuffer) || 0;
  var safe = cash - billTotal - dm - goalReserve - paceReserve - buffer;
  var daysLeft = Math.max(1, diffDays(t, pay));

  return {
    safe: r2(safe),
    perDay: r2(safe / daysLeft),
    cash: r2(cash),
    bills: r2(billTotal),
    billCount: bills.length,
    debtMin: r2(dm),
    goalReserve: r2(goalReserve),
    paceReserve: r2(paceReserve),
    buffer: r2(buffer),
    scopeEnd: scopeEnd,
    payday: pay,
    daysLeft: daysLeft,
    billsList: bills,
    debtList: debtHits.sort(function (a, b) { return a.date - b.date; })
  };
}

/* ------------------------------------------------------------- forecasting */
function forecast(days) {
  var n = days || 60;
  var t = today();
  var s = DB.settings;
  var start = spendableCash();
  var end = addDays(t, n);
  var bills = billOccurrences(t, end).filter(function (o) { return !o.paid || o.date >= t; });
  var inc = incomeOccurrences(t, end);
  var pace = dailyDiscretionary();
  var dm = [];
  DB.debts.forEach(function (d) {
    if (!(d.minPayment > 0)) return;
    var due = Number(d.dueDay) || 1;
    var cursor = startOfMonth(t); var guard = 0;
    while (cursor <= end && guard++ < 8) {
      var last = daysInMonth(cursor.getFullYear(), cursor.getMonth());
      var dt = new Date(cursor.getFullYear(), cursor.getMonth(), Math.min(due, last));
      if (dt >= t && dt <= end) dm.push({ date: dt, amount: d.minPayment, name: d.name + ' payment', kind: 'debt' });
      cursor = addMonths(cursor, 1);
    }
  });

  var events = {};
  function push(d, ev) {
    var k = ymd(d);
    if (!events[k]) events[k] = [];
    events[k].push(ev);
  }
  bills.forEach(function (o) { push(o.date, { kind: 'bill', name: o.bill.name, amount: -o.amount, icon: o.bill.icon, catId: o.bill.catId }); });
  inc.forEach(function (o) { push(o.date, { kind: 'income', name: o.item.name, amount: o.amount, icon: '\uD83D\uDCB0' }); });
  dm.forEach(function (o) { push(o.date, { kind: 'debt', name: o.name, amount: -o.amount, icon: '\uD83C\uDFE6' }); });

  var out = [], bal = start, low = start, lowDate = t;
  for (var i = 0; i <= n; i++) {
    var d = addDays(t, i);
    var list = events[ymd(d)] || [];
    var delta = 0;
    list.forEach(function (e) { delta += e.amount; });
    if (i > 0) { delta -= pace; bal += delta; }
    if (bal < low) { low = bal; lowDate = d; }
    out.push({ date: d, balance: r2(bal), delta: r2(i > 0 ? delta : 0), events: list, pace: r2(pace) });
  }
  var risk = out.filter(function (p) { return p.balance < (Number(s.safetyBuffer) || 0); });
  return {
    points: out, start: r2(start), end: out[out.length - 1].balance,
    low: r2(low), lowDate: lowDate, pace: r2(pace),
    riskDays: risk.length, firstRisk: risk.length ? risk[0] : null, days: n
  };
}

/* -------------------------------------------------------------- envelopes */
function envelopeWindow() {
  var t = today();
  var s = DB.settings;
  /* envelopes run on the calendar month (simplest mental model) */
  return { from: startOfMonth(t), to: endOfMonth(t), key: monthKey(t) };
}
/* one source of truth for "what is budgeted this month" so the dashboard,
   the spend screen and the envelope cards can never disagree */
function envelopeTotals() {
  var env = envelopes();
  var caps = r2(sum(env, function (e) { return e.cap; }));
  var effective = r2(sum(env, function (e) { return e.effectiveCap; }));
  var rollover = r2(sum(env, function (e) { return e.rollover; }));
  var spent = r2(sum(env, function (e) { return e.spent; }));
  return {
    env: env, caps: caps, effective: effective, rollover: rollover, spent: spent,
    left: r2(effective - spent),
    flexibleLeft: r2(sum(env, function (e) { return e.cap > 0 ? Math.max(0, e.left) : 0; })),
    capped: env.filter(function (e) { return e.cap > 0; }).length
  };
}

function catSpend(from, to) {
  if (isWholeMonth(from, to)) {
    var m = txIndex().month[monthKey(from)];
    return m ? m.cat : {};
  }
  var map = {};
  DB.tx.forEach(function (x) {
    if (x.amount >= 0) return;
    var d = parseYMD(x.date);
    if (d < from || d > to) return;
    map[x.catId] = (map[x.catId] || 0) + Math.abs(x.amount);
  });
  return map;
}
function billedByCat(from, to) {
  var map = {};
  billOccurrences(from, to).forEach(function (o) {
    map[o.bill.catId] = (map[o.bill.catId] || 0) + o.amount;
  });
  return map;
}
function envelopes() {
  var w = envelopeWindow();
  var spent = catSpend(w.from, w.to);
  var billed = billedByCat(w.from, w.to);
  var dayOf = today().getDate();
  var dim = daysInMonth(today().getFullYear(), today().getMonth());
  var elapsed = clamp(dayOf / dim, 0, 1);
  var carryOn = !!DB.settings.rollover;
  return DB.cats.map(function (c) {
    var s = r2(spent[c.id] || 0);
    var cap = Number(c.cap) || 0;
    var roll = 0;
    if (carryOn && c.rollover && cap > 0) {
      /* look back up to 3 closed months, newest first, and bank what was unused */
      for (var back = 1; back <= 3; back++) {
        var m = addMonths(today(), -back);
        var f = startOfMonth(m), t2 = endOfMonth(m);
        var past = catSpend(f, t2)[c.id] || 0;
        var leftover = cap - past;
        if (leftover <= 0) break;
        roll += leftover;
        cap = Number(c.cap) || 0; /* base cap stays the cap; rollover is additive */
      }
    }
    var effective = cap + roll;
    /* what should have left this envelope by today: the fixed bills for the
       month plus a straight-line share of whatever is left of the cap */
    var sched = r2(billed[c.id] || 0);
    var flexible = Math.max(0, effective - sched);
    var expected = r2(sched + flexible * elapsed);
    var delta = r2(s - expected);
    var tol = Math.max(15, effective * 0.12);
    return {
      cat: c, spent: s, cap: cap, rollover: r2(roll), effectiveCap: r2(effective), left: r2(effective - s),
      pct: effective > 0 ? clamp((s / effective) * 100, 0, 999) : 0,
      over: effective > 0 && s > effective,
      scheduled: sched, flexible: r2(flexible), expected: expected, paceDelta: delta,
      mostlyBills: effective > 0 && sched >= effective * 0.6,
      hot: effective > 0 && delta > tol && s <= effective,
      ahead: effective > 0 && delta < -tol
    };
  });
}

function monthSummary(key) {
  var d = parseMonthKey(key || monthKey(today()));
  var from = startOfMonth(d), to = endOfMonth(d);
  var rec = txIndex().month[monthKey(d)] || { cat: {}, income: 0, expense: 0, count: 0 };
  var income = rec.income, expense = rec.expense, byCat = rec.cat, count = rec.count;
  var expected = sum(incomeOccurrences(today() > to ? addDays(to, 1) : today(), to), function (o) { return o.amount; });
  return { key: monthKey(d), from: from, to: to, income: r2(income), expense: r2(expense), net: r2(income - expense), byCat: byCat, count: count, expectedMore: r2(expected) };
}

function paceForCurrentMonth() {
  var t = today();
  var key = monthKey(t);
  var sum0 = monthSummary(key);
  var dim = daysInMonth(t.getFullYear(), t.getMonth());
  var dayOf = t.getDate();
  var daysLeft = Math.max(0, dim - dayOf);
  var from = addDays(t, 1), to = endOfMonth(t);

  /* what is still scheduled to leave before the month ends */
  var upcomingBills = billOccurrences(from, to).filter(function (o) { return !o.paid; });
  var billsLeft = sum(upcomingBills, function (o) { return o.amount; });
  var debtLeft = 0;
  DB.debts.forEach(function (d) {
    if (!(d.minPayment > 0)) return;
    var due = Number(d.dueDay) || 1;
    var dt = new Date(t.getFullYear(), t.getMonth(), Math.min(due, dim));
    if (dt >= from && dt <= to) debtLeft += d.minPayment;
  });

  var pace = dailyDiscretionary();
  var everydayLeft = r2(pace * daysLeft);
  var projected = r2(sum0.expense + billsLeft + debtLeft + everydayLeft);
  var totals = envelopeTotals();
  var caps = totals.effective;                     /* includes money carried over */
  var leftInEnvelopes = r2(sum(envelopes(), function (e) { return e.cap > 0 ? e.left : 0; }));

  return {
    month: sum0, daily: r2(pace), projected: projected, daysLeft: daysLeft,
    dayOf: dayOf, daysIn: dim, caps: caps, capsBase: totals.caps, rollover: totals.rollover,
    scheduledLeft: r2(billsLeft + debtLeft), billsLeft: r2(billsLeft), debtLeft: r2(debtLeft),
    everydayLeft: everydayLeft, everydayAverage: r2(pace),
    remainingEnvelope: leftInEnvelopes,
    safeDaily: daysLeft > 0 ? r2(Math.max(0, leftInEnvelopes) / daysLeft) : 0,
    upcomingBills: upcomingBills
  };
}

/* ---------------------------------------------------------------- goals */
function goalInfo(g) {
  var target = Number(g.target) || 0, saved = Number(g.saved) || 0;
  var pctDone = target > 0 ? clamp((saved / target) * 100, 0, 100) : 0;
  var monthly = Number(g.monthly) || 0;
  var remaining = Math.max(0, target - saved);
  var monthsLeft = monthly > 0 ? Math.ceil(remaining / monthly) : Infinity;
  var eta = isFinite(monthsLeft) ? addMonths(today(), monthsLeft) : null;
  var targetDate = g.date ? parseYMD(g.date) : null;
  var monthsToTarget = targetDate ? Math.max(1, Math.round(diffDays(today(), targetDate) / 30.44)) : null;
  var needed = monthsToTarget ? r2(remaining / monthsToTarget) : 0;
  return {
    goal: g, target: target, saved: saved, pct: pctDone, remaining: r2(remaining),
    monthly: monthly, monthsLeft: monthsLeft, eta: eta, targetDate: targetDate,
    needed: needed, onTrack: targetDate ? (eta && eta <= targetDate) : null,
    complete: remaining <= 0.005
  };
}

/* ---------------------------------------------------------------- debts */
function debtPlan(strategy, extraPerMonth, targetId) {
  var strat = strategy || 'snowball';
  var extra = Number(extraPerMonth) || 0;
  var debts = DB.debts.filter(function (d) { return (Number(d.balance) || 0) > 0.005; })
    .map(function (d) {
      return {
        id: d.id, name: d.name, bal: Number(d.balance) || 0, apr: Number(d.apr) || 0,
        min: Math.max(0, Number(d.minPayment) || 0), icon: d.icon
      };
    });
  if (!debts.length) return { months: 0, empty: true, order: [], schedule: [], totalInterest: 0, totalPaid: 0, payoffDate: today() };

  var totalMin = sum(debts, function (d) { return d.min; });
  var budget = Math.max(totalMin, totalMin + extra);
  var months = 0, totalInterest = 0, totalPaid = 0;
  var schedule = [], order = [], guard = 0;

  /* remember starting balances so minimum-only baseline can reuse them */
  while (guard++ < 900) {
    var active = debts.filter(function (d) { return d.bal > 0.005; });
    if (!active.length) break;
    months++;
    var mKey = monthKey(addMonths(today(), months));
    /* interest */
    active.forEach(function (d) {
      var int = d.bal * (d.apr / 100 / 12);
      d.bal += int; totalInterest += int;
    });
    /* minimum payments */
    var pot = budget;
    active.forEach(function (d) {
      if (d.bal <= 0.005) return;
      var pay = Math.min(d.bal, d.min, pot);
      d.bal -= pay; pot -= pay; totalPaid += pay;
    });
    /* can a freed-up payment cascade? yes — pot already holds leftover */
    var guard2 = 0;
    while (pot > 0.005 && guard2++ < 60) {
      var list = debts.filter(function (d) { return d.bal > 0.005; });
      if (!list.length) break;
      var pick = null;   /* must be reset every pass: var is function-scoped */
      if (targetId) { pick = byId(list, targetId) || null; }
      if (!pick) {
        if (strat === 'avalanche') { pick = sortBy(list, function (d) { return d.apr; }, 'desc')[0]; }
        else if (strat === 'custom' && targetId) { pick = byId(list, targetId); }
        else { pick = sortBy(list, function (d) { return d.bal; })[0]; }
      }
      if (!pick) break;
      var p2 = Math.min(pick.bal, pot);
      pick.bal -= p2; pot -= p2; totalPaid += p2;
    }
    /* record payoffs */
    debts.forEach(function (d) {
      if (d.bal <= 0.005 && !d._done) { d._done = true; order.push({ name: d.name, id: d.id, month: months, date: addMonths(today(), months) }); }
    });
    schedule.push({
      month: months, key: mKey, remaining: r2(sum(debts, function (d) { return Math.max(0, d.bal); })),
      paid: r2(totalPaid), interest: r2(totalInterest)
    });
    if (months > 720) break;
  }
  return {
    months: months, order: order, schedule: schedule,
    totalInterest: r2(totalInterest), totalPaid: r2(totalPaid),
    payoffDate: addMonths(today(), months), budget: r2(budget),
    totalMin: r2(totalMin), extra: extra, strategy: strat,
    balances: debts.map(function (d) { return { id: d.id, name: d.name, start: byId(DB.debts, d.id).balance, apr: d.apr, min: d.min, icon: d.icon }; })
  };
}

function debtSummary() {
  var total = sum(DB.debts, function (d) { return Number(d.balance) || 0; });
  var minPay = sum(DB.debts, function (d) { return Number(d.minPayment) || 0; });
  var wApr = total > 0 ? sum(DB.debts, function (d) { return (Number(d.apr) || 0) * (Number(d.balance) || 0); }) / total : 0;
  var minOnly = debtPlan('avalanche', 0);
  return { total: r2(total), minPay: r2(minPay), avgApr: r2(wApr), count: DB.debts.length, minOnly: minOnly };
}

/* -------------------------------------------------- subscription detection */
function normalize(name) {
  return String(name || '').toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}
function detectSubscriptions() {
  var groups = {};
  var from = addDays(today(), -200);
  DB.tx.forEach(function (x) {
    if (x.type !== 'expense' || x.amount >= 0) return;
    var d = parseYMD(x.date);
    if (d < from) return;
    var key = normalize(x.note);
    if (key.length < 3) return;
    if (!groups[key]) groups[key] = { name: x.note, catId: x.catId, dates: [], amounts: [] };
    groups[key].dates.push(d);
    groups[key].amounts.push(Math.abs(x.amount));
  });
  var out = [];
  Object.keys(groups).forEach(function (k) {
    var g = groups[k];
    if (g.dates.length < 2) return;
    g.dates.sort(function (a, b) { return a - b; });
    var gaps = [];
    for (var i = 1; i < g.dates.length; i++) gaps.push(diffDays(g.dates[i - 1], g.dates[i]));
    var avgGap = sum(gaps) / gaps.length;
    var amts = g.amounts;
    var avgAmt = sum(amts) / amts.length;
    var amtSpread = avgAmt ? (Math.max.apply(null, amts) - Math.min.apply(null, amts)) / avgAmt : 1;
    var cadence = null, perMonth = 0;
    var tol = Math.max(3, avgGap * 0.25);
    var gapSpread = Math.max.apply(null, gaps) - Math.min.apply(null, gaps);
    var steady = gapSpread <= Math.max(4, tol);
    var enoughEvidence = false;
    if (amts.length >= 4 && avgGap <= 20) enoughEvidence = true;          /* weekly / fortnightly */
    else if (amts.length >= 3 && avgGap <= 45) enoughEvidence = true;     /* monthly */
    else if (amts.length >= 2 && avgGap > 45) enoughEvidence = true;      /* quarterly / annual */
    if (enoughEvidence && amtSpread < 0.05 && steady) {
      if (Math.abs(avgGap - 7) <= 3) { cadence = 'weekly'; perMonth = 52 / 12; }
      else if (Math.abs(avgGap - 14) <= 4) { cadence = 'biweekly'; perMonth = 26 / 12; }
      else if (Math.abs(avgGap - 30) <= 8) { cadence = 'monthly'; perMonth = 1; }
      else if (Math.abs(avgGap - 91) <= 20) { cadence = 'quarterly'; perMonth = 1 / 3; }
      else if (Math.abs(avgGap - 365) <= 45) { cadence = 'annual'; perMonth = 1 / 12; }
    }
    if (!cadence) return;
    var already = DB.bills.some(function (b) {
      return normalize(b.name).indexOf(k.split(' ')[0]) === 0 || k.indexOf(normalize(b.name).split(' ')[0]) === 0;
    });
    out.push({
      name: g.name, key: k, cadence: cadence, avg: r2(avgAmt),
      monthly: r2(avgAmt * perMonth), last: g.dates[g.dates.length - 1],
      count: g.dates.length, catId: g.catId, alreadyTracked: already
    });
  });
  return out.sort(function (a, b) {
    if (a.alreadyTracked !== b.alreadyTracked) return a.alreadyTracked ? 1 : -1;
    return b.monthly - a.monthly;
  });
}

/* ------------------------------------------------------------- money score */
function moneyScore() {
  var parts = [];
  var s = DB.settings;

  /* 1. Savings rate over the trailing 3 months */
  var months = [];
  for (var i = 0; i < 3; i++) months.push(monthSummary(monthKey(addMonths(today(), -i))));
  var inc = sum(months, function (m) { return m.income; });
  var exp = sum(months, function (m) { return m.expense; });
  var rate = inc > 0 ? (inc - exp) / inc : 0;
  parts.push({
    key: 'Savings rate', value: clamp((rate / 0.2) * 100, 0, 100),
    detail: inc > 0 ? Math.round(rate * 100) + '% of income kept (target 20%)' : 'Log income to unlock',
    weight: 30
  });

  /* 2. Envelope discipline this month */
  var env = envelopes().filter(function (e) { return e.cap > 0; });
  var okCount = env.filter(function (e) { return !e.over; }).length;
  parts.push({
    key: 'Envelope discipline', value: env.length ? (okCount / env.length) * 100 : 60,
    detail: env.length ? okCount + ' of ' + env.length + ' envelopes inside their cap' : 'Set envelope caps to unlock',
    weight: 20
  });

  /* 3. Bill coverage — can cash cover bills before the next payday? */
  var sts = safeToSpend();
  var cov = sts.cash > 0 ? clamp((sts.cash - sts.bills) / Math.max(1, sts.bills) * 100, 0, 100) : 0;
  parts.push({
    key: 'Bill coverage', value: cov,
    detail: sts.bills > 0 ? 'Bills due before payday: ' + money0(sts.bills) : 'No bills due before payday',
    weight: 20
  });

  /* 4. Emergency runway (months of expenses covered by savings) */
  var avgExp = 0;
  var mm = months.filter(function (m) { return m.expense > 0; });
  if (mm.length) avgExp = sum(mm, function (m) { return m.expense; }) / mm.length;
  var savings = sum(DB.accounts.filter(function (a) { return a.kind === 'savings'; }), function (a) { return Math.max(0, Number(a.balance) || 0); });
  var runway = avgExp > 0 ? savings / avgExp : 0;
  parts.push({
    key: 'Emergency runway', value: clamp((runway / 6) * 100, 0, 100),
    detail: (avgExp > 0 ? runway.toFixed(1) : '0') + ' months covered (target 6)',
    weight: 20
  });

  /* 5. Debt pressure — minimums as a share of income */
  var ds = debtSummary();
  var monthlyIncome = inc > 0 ? inc / 3 : 0;
  var ratio = monthlyIncome > 0 ? ds.minPay / monthlyIncome : (ds.minPay > 0 ? 1 : 0);
  parts.push({
    key: 'Debt pressure', value: clamp((1 - ratio / 0.35) * 100, 0, 100),
    detail: monthlyIncome > 0 ? 'Debt payments are ' + Math.round(ratio * 100) + '% of income (keep under 35%)' : (ds.count ? 'Log income to unlock' : 'No debts tracked — nice'),
    weight: 10
  });

  var score = 0;
  parts.forEach(function (p) { score += (p.value / 100) * p.weight; });
  score = Math.round(score);
  var grade = score >= 90 ? 'Excellent' : score >= 75 ? 'Strong' : score >= 60 ? 'Steady' : score >= 40 ? 'Building' : 'Starting out';
  return { score: score, grade: grade, parts: parts };
}

/* -------------------------------------------------------------- quick add
   Parses "12.50 coffee #dining @card yesterday" into a transaction draft. */
function parseQuickAdd(text) {
  var raw = String(text || '').trim();
  var out = { amount: null, note: '', catId: null, accountId: null, date: ymd(today()), type: 'expense' };
  if (!raw) return out;
  var m = raw.match(/(?:^|\s)(-?)([$£€¥]?)(\d+(?:[.,]\d{1,2})?)(?:\s|$)/);
  if (m) {
    var amt = parseFloat(m[3].replace(',', '.'));
    if (!isNaN(amt)) {
      out.amount = Math.abs(amt);
      out.type = m[1] === '-' ? 'expense' : (m[2] && m[2] !== '$' ? 'expense' : 'expense');
      raw = raw.replace(m[0], ' ');
    }
  }
  var cat = raw.match(/#([a-z0-9_\-]+)/i);
  if (cat) {
    var key = cat[1].toLowerCase();
    var found = DB.cats.filter(function (c) {
      return c.id.toLowerCase() === key || normalize(c.name).indexOf(key) === 0 || normalize(c.name).split(' ')[0] === key;
    })[0];
    if (found) out.catId = found.id;
    raw = raw.replace(cat[0], ' ');
  }
  var acct = raw.match(/@([a-z0-9_\-]+)/i);
  if (acct) {
    var key2 = acct[1].toLowerCase();
    var fa = DB.accounts.filter(function (a) {
      return a.id.toLowerCase() === key2 || normalize(a.name).indexOf(key2) === 0;
    })[0];
    if (fa) out.accountId = fa.id;
    raw = raw.replace(acct[0], ' ');
  }
  if (/\btoday\b/i.test(raw)) out.date = ymd(today());
  else if (/\byesterday\b/i.test(raw)) out.date = ymd(addDays(today(), -1));
  else if (/\b(\d{1,2})\/(\d{1,2})\b/.test(raw)) {
    var dm2 = raw.match(/\b(\d{1,2})\/(\d{1,2})\b/);
    var mm2 = parseInt(dm2[1], 10), dd2 = parseInt(dm2[2], 10);
    var yy = today().getFullYear();
    if (mm2 >= 1 && mm2 <= 12 && dd2 >= 1 && dd2 <= 31) {
      var cand = new Date(yy, mm2 - 1, dd2);
      if (cand > addDays(today(), 1)) cand = new Date(yy - 1, mm2 - 1, dd2);
      out.date = ymd(cand);
      raw = raw.replace(dm2[0], ' ');
    }
  }
  if (/\bincome\b|\bpaycheck\b|\bsalary\b/i.test(raw)) out.type = 'income';
  else if (/\brefund\b|\bcashback\b/i.test(raw)) out.type = 'income';
  out.note = raw.replace(/\s+/g, ' ').trim();
  return out;
}

/* ------------------------------------------------------------ breakdowns */
function upcoming(limit, days) {
  var t = today(), end = addDays(t, days || 30);
  var list = [];
  billOccurrences(t, end).forEach(function (o) {
    list.push({ kind: 'bill', date: o.date, name: o.bill.name, amount: -o.amount, icon: o.bill.icon, catId: o.bill.catId, paid: o.paid, id: o.bill.id, autopay: o.bill.autopay });
  });
  incomeOccurrences(t, end).forEach(function (o) {
    list.push({ kind: 'income', date: o.date, name: o.item.name, amount: o.amount, icon: '\uD83D\uDCB0', catId: 'income', paid: o.date < t });
  });
  DB.debts.forEach(function (d) {
    if (!(d.minPayment > 0)) return;
    var due = Number(d.dueDay) || 1;
    var cursor = startOfMonth(t); var guard = 0;
    while (cursor <= end && guard++ < 4) {
      var last = daysInMonth(cursor.getFullYear(), cursor.getMonth());
      var dt = new Date(cursor.getFullYear(), cursor.getMonth(), Math.min(due, last));
      if (dt >= t && dt <= end) { list.push({ kind: 'debt', date: dt, name: d.name + ' \u2014 minimum', amount: -d.minPayment, icon: d.icon || '\uD83C\uDFE6', catId: 'debt' }); }
      cursor = addMonths(cursor, 1);
    }
  });
  var sorted = sortBy(list, function (x) { return x.date.getTime(); });
  return limit ? sorted.slice(0, limit) : sorted;
}

function monthlyTrend(n) {
  var out = [];
  for (var i = n - 1; i >= 0; i--) {
    var m = addMonths(today(), -i);
    var s = monthSummary(monthKey(m));
    out.push({ key: s.key, label: MONTHS[m.getMonth()].slice(0, 3), income: s.income, expense: s.expense, net: s.net, from: s.from });
  }
  return out;
}

function netWorthSeries() {
  var snaps = DB.snaps.slice();
  snaps.push({ date: ymd(today()), netWorth: netWorth() });
  return sortBy(snaps, function (s) { return s.date; });
}

function streaks() {
  /* consecutive days with at least one transaction logged (engagement, not guilt) */
  var days = {};
  DB.tx.forEach(function (x) { days[x.date] = 1; });
  var n = 0, d = today();
  if (!days[ymd(d)]) d = addDays(d, -1);
  var guard = 0;
  while (days[ymd(d)] && guard++ < 400) { n++; d = addDays(d, -1); }
  return n;
}
