/* ============================================================================
   Waypoint Budget Studio — Views
   Spend, Bills, Debts, Goals, Calendar, Reports, Settings
   ========================================================================== */
'use strict';

/* view-local (non-persisted) UI state */
var V = {
  spendMonth: null,
  txSearch: '',
  txCat: '',
  txType: '',
  txLimit: 60,
  calMonth: null,
  reportWindow: 6,
  debtStrategy: null,
  debtExtra: 0,
  debtTarget: '',
  goalSort: 'pct'
};
function spendMonth() { if (!V.spendMonth) V.spendMonth = startOfMonth(today()); return V.spendMonth; }
function calMonth() { if (!V.calMonth) V.calMonth = startOfMonth(today()); return V.calMonth; }

/* ==========================================================================
   SPEND
   ========================================================================== */
App.views.spend = {
  title: 'Spend',
  crumb: function () {
    var m = spendMonth();
    return MONTHS[m.getMonth()] + ' ' + m.getFullYear() + ' · envelope pacing and every transaction';
  },
  html: function () {
    var m = spendMonth();
    var from = startOfMonth(m), to = endOfMonth(m);
    var sum0 = monthSummary(monthKey(m));
    var prev = monthSummary(monthKey(addMonths(m, -1)));
    var totals = envelopeTotals();
    var env = totals.env;
    var budgeted = totals.effective;
    var isCurrent = monthKey(m) === monthKey(today());
    var dayOf = isCurrent ? today().getDate() : daysInMonth(m.getFullYear(), m.getMonth());
    var dim = daysInMonth(m.getFullYear(), m.getMonth());
    var spentCats = sortBy(env.filter(function (e) { return e.spent > 0; }), function (e) { return e.spent; }, 'desc');
    var pc = paceForCurrentMonth();

    /* daily bars */
    var spentMap = {};
    DB.tx.forEach(function (t) {
      var d = parseYMD(t.date);
      if (d < from || d > to) return;
      if (t.amount >= 0) return;
      spentMap[d.getDate()] = (spentMap[d.getDate()] || 0) + Math.abs(t.amount);
    });
    var dayVals = [], dayLabels = [];
    for (var i = 1; i <= dim; i++) {
      dayVals.push(r2(spentMap[i] || 0));
      dayLabels.push(i % 5 === 0 || i === 1 ? String(i) : '');
    }
    var targetDaily = budgeted / dim;

    /* filters */
    var list = DB.tx.filter(function (t) {
      var d = parseYMD(t.date);
      if (d < from || d > to) return false;
      if (V.txType && (V.txType === 'expense' ? t.amount >= 0 : t.amount < 0)) return false;
      if (V.txCat && t.catId !== V.txCat) return false;
      if (V.txSearch) {
        var q = V.txSearch.toLowerCase();
        if (String(t.note || '').toLowerCase().indexOf(q) < 0 && String(t.catId).toLowerCase().indexOf(q) < 0) return false;
      }
      return true;
    });
    list = sortBy(list, function (t) { return parseYMD(t.date).getTime(); }, 'desc');
    var shown = list.slice(0, V.txLimit);

    /* group by day */
    var groups = [], lastKey = null;
    shown.forEach(function (t) {
      if (t.date !== lastKey) { groups.push({ date: t.date, items: [] }); lastKey = t.date; }
      groups[groups.length - 1].items.push(t);
    });

    var subs = detectSubscriptions();
    var subsMonthly = sum(subs, function (s) { return s.monthly; });

    /* merchants */
    var merchants = {};
    DB.tx.forEach(function (t) {
      if (t.amount >= 0) return;
      var d = parseYMD(t.date);
      if (d < from || d > to) return;
      var k = t.note || '(no note)';
      merchants[k] = merchants[k] || { name: k, total: 0, count: 0, catId: t.catId };
      merchants[k].total += Math.abs(t.amount);
      merchants[k].count++;
    });
    var topMerchants = sortBy(Object.keys(merchants).map(function (k) { return merchants[k]; }), function (x) { return x.total; }, 'desc').slice(0, 8);

    var catOpts = DB.cats.map(function (c) {
      return '<option value="' + c.id + '"' + (V.txCat === c.id ? ' selected' : '') + '>' + c.icon + ' ' + esc(c.name) + '</option>';
    }).join('');

    return '' +
      /* month nav + KPIs */
      '<div class="row between wrap" style="gap:12px;margin-bottom:16px">' +
      '<div class="row" style="gap:8px">' +
      '<button class="btn icon" data-act="shiftMonth" data-id="spend" data-dir="-1">' + svgIcon('chevL') + '</button>' +
      '<div style="min-width:170px;text-align:center"><b style="font-size:16px">' + MONTHS[m.getMonth()] + ' ' + m.getFullYear() + '</b>' +
      (isCurrent ? '<div class="tiny dim">current month</div>' : '<div class="tiny dim"><button class="btn link tiny" data-act="thisMonth" data-id="spend">jump to today</button></div>') + '</div>' +
      '<button class="btn icon" data-act="shiftMonth" data-id="spend" data-dir="1">' + svgIcon('chevR') + '</button>' +
      '</div>' +
      '<div class="row wrap" style="gap:8px">' +
      '<button class="btn sm" data-act="addTx">' + svgIcon('plus', 14) + ' Add</button>' +
      '<button class="btn sm" data-act="exportCsv" data-id="tx">' + svgIcon('down', 14) + ' Export CSV</button>' +
      '<button class="btn sm" data-act="editCats">Envelope caps</button>' +
      '</div></div>' +

      '<div class="grid g-4">' +
      metricCard('Spent this month', money(sum0.expense), deltaLine(sum0.expense, prev.expense, 'vs last month', true), sum0.expense > budgeted && budgeted > 0 ? 'danger' : '') +
      metricCard('Income logged', money(sum0.income), (prev.income ? deltaLine(sum0.income, prev.income, 'vs last month') : 'expected ' + money0(sum0.expectedMore) + ' more'), '') +
      metricCard('Net', (sum0.net >= 0 ? '+' : '\u2212') + money(Math.abs(sum0.net)).replace('-', ''), sum0.income ? Math.round((sum0.net / sum0.income) * 100) + '% of income kept' : 'log income to see the rate', sum0.net >= 0 ? 'good' : 'danger') +
      metricCard('Everyday pace', money(pc.everydayAverage) + ' / day', 'projected month end ' + money0(pc.projected), pc.projected > pc.caps && pc.caps > 0 ? 'warn' : 'good') +
      '</div>' +

      /* charts */
      '<div class="grid g-32" style="margin-top:16px">' +
      '<section class="card">' + App.head('Daily spending', 'Bar height is what you logged that day · dashed line is your ' + money(targetDaily) + ' target') +
      Chart.bars([{ label: 'Spend', color: 'var(--accent-2)', values: dayVals, labels: dayLabels }], { height: 230 }) +
      '<div class="row between tiny dim" style="margin-top:6px"><span>' + money(catSpendTotal(spentMap)) + ' across ' + list.length + ' transactions</span>' +
      '<span>' + dayOf + ' of ' + dim + ' days</span></div>' +
      '</section>' +
      '<section class="card">' + App.head('Category split', 'This month') +
      (spentCats.length ? '<div class="row" style="gap:16px;align-items:center;flex-wrap:wrap">' +
        '<div style="width:160px;flex:0 0 auto">' + Chart.donut(spentCats.slice(0, 7).map(function (e) {
          return { value: e.spent, color: e.cat.color, label: e.cat.name, display: money(e.spent) };
        }), { size: 160, stroke: 19 }) + '</div>' +
        '<div class="legend" style="flex:1;min-width:140px">' + spentCats.slice(0, 7).map(function (e) {
          return '<div class="legend-item"><span class="sw" style="background:' + e.cat.color + '"></span><span class="nm">' + e.cat.icon + ' ' + esc(e.cat.name) + '</span><span class="vl num">' + money0(e.spent) + '</span></div>';
        }).join('') + '</div></div>'
        : App.empty('\uD83D\uDCCA', 'Nothing logged in this month', 'Pick another month or add a transaction.')) +
      '</section></div>' +

      /* envelopes */
      '<section class="card" style="margin-top:16px" data-tour="envelopes">' +
      App.head('Envelopes', 'Caps keep a category from eating the month',
        '<button class="btn xs ghost" data-act="editCats">Edit caps</button>' +
        '<span class="chip ' + (sum(env, function (e) { return e.left; }) < 0 ? 'danger' : 'good') + '">' + (sum(env, function (e) { return e.left; }) < 0 ? 'over by ' : 'room left ') + money0(Math.abs(sum(env, function (e) { return e.left; }))) + '</span>') +
      '<div class="grid g-3">' + env.map(envCardFull).join('') + '</div>' +
      '</section>' +

      /* transactions + side panels */
      '<div class="grid g-32" style="margin-top:16px">' +
      '<section class="card">' +
      App.head('Transactions', list.length + ' in ' + MONTHS[m.getMonth()],
        '<div class="row" style="gap:6px;flex-wrap:wrap">' +
        '<input type="search" data-view-field="txSearch" value="' + esc(V.txSearch) + '" placeholder="Search notes…" style="width:150px;height:31px;font-size:12.5px">' +
        '<select data-view-field="txCat" style="width:130px;height:31px;font-size:12.5px"><option value="">All categories</option>' + catOpts + '</select>' +
        '<select data-view-field="txType" style="width:110px;height:31px;font-size:12.5px">' +
        '<option value="">All types</option><option value="expense"' + (V.txType === 'expense' ? ' selected' : '') + '>Expenses</option>' +
        '<option value="income"' + (V.txType === 'income' ? ' selected' : '') + '>Income</option></select>' +
        (V.txSearch || V.txCat || V.txType ? '<button class="btn xs ghost" data-act="clearFilters">Clear</button>' : '') +
        '</div>') +
      (groups.length ? groups.map(function (g) {
        var dayTotal = sum(g.items, function (t) { return t.amount; });
        return '<div class="day-sep">' + fmtDate(g.date, 'weekday') + '<span style="margin-left:auto;text-transform:none;letter-spacing:0" class="num ' + (dayTotal >= 0 ? 'good' : '') + '">' + (dayTotal >= 0 ? '+' : '\u2212') + money(Math.abs(dayTotal)).replace('-', '') + '</span></div>' +
          '<div class="list">' + g.items.map(txRow).join('') + '</div>';
      }).join('') : App.empty('\uD83D\uDD0D', 'No transactions match', 'Try clearing the search or picking another month.')) +
      (list.length > V.txLimit ? '<div class="center" style="margin-top:14px"><button class="btn sm" data-act="moreTx">Show ' + Math.min(60, list.length - V.txLimit) + ' more</button></div>' : '') +
      '</section>' +

      '<div class="stack">' +
      '<section class="card">' + App.head('Recurring found', subsMonthly ? money(subsMonthly) + ' / month' : 'scanning…',
        '<button class="btn xs ghost" data-act="go" data-view="bills">Bills ' + svgIcon('chevR', 11) + '</button>') +
      (subs.length ? '<div class="list">' + subs.slice(0, 6).map(function (s) {
        return '<div class="li"><div class="ic">' + svgIcon('bills', 16) + '</div>' +
          '<div class="tx"><b>' + esc(s.name) + '</b><span>' + FREQ_LABEL[s.cadence] + ' · ' + money(s.avg) + ' · last ' + fmtDate(s.last, 'short') + (s.alreadyTracked ? ' · tracked' : '') + '</span></div>' +
          '<div class="va num">' + money0(s.monthly) + '</div>' +
          (s.alreadyTracked ? '' : '<button class="btn xs" data-act="subToBill" data-id="' + esc(s.key) + '">Track</button>') + '</div>';
      }).join('') + '</div>' +
        '<p class="tiny dim" style="margin-top:10px">Detected from your own history — two or more similar charges at a steady interval. Nothing leaves your device to do this.</p>'
        : '<p class="small muted">Log a few months of subscriptions and they will show up here automatically, with the yearly cost of each one.</p>') +
      '</section>' +
      '<section class="card">' + App.head('Top merchants', MONTHS[m.getMonth()] + ' ' + m.getFullYear()) +
      (topMerchants.length ? '<div class="list">' + topMerchants.map(function (x) {
        var bar = spentCats.length ? (x.total / Math.max(1, topMerchants[0].total)) * 100 : 0;
        return '<div style="flex:1;min-width:0"><div class="row between"><span class="small" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(x.name) + '</span>' +
          '<b class="num small" style="margin-left:10px">' + money0(x.total) + '</b></div>' +
          '<div style="margin-top:5px">' + Chart.progress(bar, { thin: true, color: App.cat(x.catId).color }) + '</div>' +
          '<div class="tiny dim" style="margin-top:3px">' + x.count + ' visit' + (x.count === 1 ? '' : 's') + ' · avg ' + money0(x.total / x.count) + '</div></div>';
      }).join('</div><div class="stack" style="gap:12px">') + '</div>' : '<div class="small muted">No spending yet this month.</div>') +
      '</section>' +
      '</div></div>';
  },
  after: function () { }
};

function catSpendTotal(map) { return sum(Object.keys(map).map(function (k) { return map[k]; })); }
function metricCard(label, value, detail, tone) {
  return '<section class="card metric" style="padding:16px 17px"><div class="l">' + label + '</div>' +
    '<div class="v ' + (tone || '') + '">' + value + '</div><div class="d">' + detail + '</div></section>';
}
function deltaLine(now, before, label, invert) {
  if (!before) return 'no comparison for last month';
  var diff = now - before;
  var p = Math.abs(diff / before) * 100;
  var up = diff > 0;
  var good = invert ? !up : up;
  return '<span class="' + (good ? 'good' : 'warn') + '">' + (up ? '\u25B2' : '\u25BC') + ' ' + p.toFixed(0) + '%</span> ' + label;
}
function txRow(t) {
  var c = App.cat(t.catId);
  var a = byId(DB.accounts, t.accountId);
  return '<div class="li"><div class="ic" style="color:' + c.color + '">' + (c.icon || '\uD83D\uDCE6') + '</div>' +
    '<div class="tx"><b>' + esc(t.note || c.name) + '</b><span>' + esc(c.name) + (a ? ' · ' + esc(a.name) : '') + (t.tags && t.tags.length ? ' · ' + esc(t.tags.join(', ')) : '') + '</span></div>' +
    '<div class="va num ' + (t.amount >= 0 ? 'good' : '') + '">' + (t.amount >= 0 ? '+' : '\u2212') + money(Math.abs(t.amount)).replace('-', '') + '</div>' +
    '<div class="acts"><button class="btn xs ghost" data-act="editTx" data-id="' + t.id + '" aria-label="Edit">' + svgIcon('pencil', 13) + '</button></div></div>';
}
function envCardFull(e) {
  var dim = daysInMonth(today().getFullYear(), today().getMonth());
  var dayOf = today().getDate();
  var flexibleLeft = Math.max(0, e.left);
  var safeDaily = dim > dayOf ? flexibleLeft / (dim - dayOf) : 0;
  var status = !e.cap ? '<span class="chip">no cap</span>' : e.over ? '<span class="chip danger">over by ' + money0(Math.abs(e.left)) + '</span>'
    : e.hot ? '<span class="chip warn">running hot</span>'
      : e.ahead ? '<span class="chip good">ahead of pace</span>'
        : e.mostlyBills ? '<span class="chip">fixed bills</span>' : '<span class="chip good">on track</span>';
  return '<div class="card pad-sm env-card"><div class="env-head"><div class="ic">' + e.cat.icon + '</div>' +
    '<div><div class="nm">' + esc(e.cat.name) + '</div><div class="tiny dim">' + (e.cap ? money0(e.left) + ' left' : 'tracked only') + '</div></div>' +
    '<div class="amt">' + money0(e.spent) + '</div></div>' +
    Chart.progress(e.cap ? e.pct : 0, { color: e.over ? 'var(--danger)' : e.cat.color }) +
    '<div class="env-foot">' + status + '<span>' + (e.cap ? (safeDaily > 0 ? money(safeDaily) + '/day left' : Math.round(e.pct) + '% used') : '') + '</span></div></div>';
}

/* ==========================================================================
   BILLS
   ========================================================================== */
App.views.bills = {
  title: 'Bills',
  crumb: function () {
    var b = billOccurrences(today(), endOfMonth(today()));
    return b.length + ' bill' + (b.length === 1 ? '' : 's') + ' this month · ' + money(sum(b, function (o) { return o.amount; })) + ' committed';
  },
  html: function () {
    if (!DB.bills.length) return App.empty('\uD83E\uDDFE', 'No bills yet', 'Add rent, utilities, subscriptions, insurance — anything that repeats. The app handles the scheduling math.', '<button class="btn primary" data-act="addBill" style="margin-top:12px">' + svgIcon('plus', 14) + ' Add your first bill</button>');

    var t = today();
    var monthBills = billOccurrences(startOfMonth(t), endOfMonth(t));
    var paidBills = monthBills.filter(function (o) { return o.paid; });
    var unpaid = monthBills.filter(function (o) { return !o.paid; });
    var monthlyLoad = sum(DB.bills.filter(function (b) { return b.active !== false; }), function (b) { return b.amount * freqPerMonth(b.freq); });
    var yearlyLoad = sum(DB.bills.filter(function (b) { return b.active !== false; }), function (b) { return b.amount * freqPerYear(b.freq); });
    var autopay = DB.bills.filter(function (b) { return b.autopay && b.active !== false; });
    var up60 = billOccurrences(t, addDays(t, 60));

    /* calendar for the selected month */
    var calM = calMonth();
    var y = calM.getFullYear(), mm = calM.getMonth();
    var first = new Date(y, mm, 1), last = new Date(y, mm + 1, 0);
    var startPad = (first.getDay() - DB.settings.weekStart + 7) % 7;
    var paydays = {};
    paydaysIn(first, last).forEach(function (d) { paydays[ymd(d)] = 1; });
    var occByDay = {};
    billOccurrences(first, last).forEach(function (o) { var k = ymd(o.date); (occByDay[k] = occByDay[k] || []).push(o); });
    var dows = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var dowHtml = '';
    for (var w = 0; w < 7; w++) dowHtml += '<div class="dow">' + dows[(DB.settings.weekStart + w) % 7] + '</div>';
    var cells = '';
    for (var p = 0; p < startPad; p++) cells += '<div></div>';
    for (var d = 1; d <= last.getDate(); d++) {
      var dt = new Date(y, mm, d), key = ymd(dt);
      var occ = occByDay[key] || [];
      var isToday = key === ymd(t);
      var overdue = occ.some(function (o) { return !o.paid && dt < t; });
      cells += '<div class="day' + (isToday ? ' today' : '') + '">' +
        '<div class="row between"><span class="d">' + d + '</span>' + (paydays[key] ? '<span class="tiny good">payday</span>' : '') + '</div>' +
        occ.slice(0, 3).map(function (o) {
          return '<div class="ev ' + (o.paid ? 'bill' : overdue ? 'danger' : 'bill') + '">' + (o.paid ? '\u2713 ' : '') + esc(shortName(o.bill.name)) + ' · ' + money0(o.amount) + '</div>';
        }).join('') +
        (occ.length > 3 ? '<div class="ev dim">+' + (occ.length - 3) + ' more</div>' : '') +
        '</div>';
    }

    /* upcoming timeline grouped by week */
    var weeks = [];
    up60.forEach(function (o) {
      var wi = Math.floor(diffDays(t, o.date) / 7);
      if (!weeks[wi]) weeks[wi] = [];
      weeks[wi].push(o);
    });

    return '' +
      '<div class="grid g-4">' +
      metricCard('Due this month', money(sum(unpaid, function (o) { return o.amount; })), unpaid.length + ' still to pay', unpaid.length ? '' : 'good') +
      metricCard('Paid so far', money(sum(paidBills, function (o) { return o.amount; })), paidBills.length + ' marked paid', 'good') +
      metricCard('Monthly load', money(monthlyLoad), money0(yearlyLoad) + ' across the year', '') +
      metricCard('On autopay', autopay.length + ' of ' + DB.bills.length, money0(sum(autopay, function (b) { return b.amount * freqPerMonth(b.freq); })) + ' / month auto', autopay.length === DB.bills.length ? 'good' : 'warn') +
      '</div>' +

      '<div class="grid g-32" style="margin-top:16px">' +
      '<section class="card">' + App.head('Bill calendar', MONTHS[mm] + ' ' + y,
        '<div class="row" style="gap:6px"><button class="btn xs ghost" data-act="shiftMonth" data-id="cal" data-dir="-1">' + svgIcon('chevL', 12) + '</button>' +
        '<button class="btn xs ghost" data-act="thisMonth" data-id="cal">today</button>' +
        '<button class="btn xs ghost" data-act="shiftMonth" data-id="cal" data-dir="1">' + svgIcon('chevR', 12) + '</button></div>') +
      '<div class="cal">' + dowHtml + cells + '</div>' +
      '</section>' +
      '<section class="card">' + App.head('Next 60 days', 'Largest first',
        '<button class="btn xs ghost" data-act="addBill">' + svgIcon('plus', 12) + ' Add</button>') +
      '<div style="max-height:430px;overflow:auto">' + weeks.map(function (wk, i) {
        if (!wk) return '';
        return '<div class="day-sep">' + (i === 0 ? 'This week' : i === 1 ? 'Next week' : 'In ' + i + ' weeks') +
          '<span style="margin-left:auto;text-transform:none;letter-spacing:0">' + money(sum(wk, function (o) { return o.amount; })) + '</span></div>' +
          '<div class="list">' + wk.map(function (o) {
            return '<div class="li"><div class="ic">' + (o.bill.icon || '\uD83D\uDCC5') + '</div>' +
              '<div class="tx"><b>' + esc(o.bill.name) + '</b><span>' + fmtDate(o.date, 'short') + ' · ' + relDay(o.date) + (o.bill.autopay ? ' · autopay' : '') + '</span></div>' +
              '<div class="va num">' + money(o.amount) + '</div>' +
              (!o.paid ? '<button class="btn xs" data-act="pay" data-id="' + o.bill.id + '" data-date="' + ymd(o.date) + '">Pay</button>' :
                '<button class="btn xs ghost" data-act="unpair" data-key="' + o.key + '" title="Unmark">\u2713</button>') + '</div>';
          }).join('') + '</div>';
      }).join('') + '</div>' +
      '</section></div>' +

      '<section class="card" style="margin-top:16px" data-tour="billlist">' +
      App.head('All bills', DB.bills.length + ' recurring items · ' + money(monthlyLoad) + ' per month',
        '<button class="btn sm primary" data-act="addBill">' + svgIcon('plus', 14) + ' New bill</button>') +
      '<div style="overflow-x:auto"><table><thead><tr>' +
      '<th>Bill</th><th class="hide-xs">Every</th><th class="r">Amount</th><th class="hide-xs r">Monthly</th><th class="hide-xs">Next due</th><th class="hide-xs r">Yearly</th><th></th>' +
      '</tr></thead><tbody>' +
      sortBy(DB.bills, function (b) { return parseYMD(b.nextDate).getTime(); }).map(function (b) {
        var next = expand(b, today(), addDays(today(), 400))[0];
        return '<tr' + (b.active === false ? ' style="opacity:.5"' : '') + '>' +
          '<td><div class="row" style="gap:9px"><span style="font-size:16px">' + (b.icon || '\uD83D\uDCC5') + '</span>' +
          '<span><b style="font-weight:600">' + esc(b.name) + '</b>' + (b.autopay ? ' <span class="chip good" style="padding:0 6px">auto</span>' : '') +
          (b.active === false ? ' <span class="chip">paused</span>' : '') +
          '<div class="tiny dim">' + esc(App.cat(b.catId).name) + ' · ' + esc((byId(DB.accounts, b.accountId) || {}).name || '\u2014') + '</div></span></div></td>' +
          '<td class="hide-xs">' + FREQ_LABEL[b.freq] + '</td>' +
          '<td class="r num">' + money(b.amount) + '</td>' +
          '<td class="hide-xs r num dim">' + money(b.amount * freqPerMonth(b.freq)) + '</td>' +
          '<td class="hide-xs">' + (next ? fmtDate(next, 'medium') : '\u2014') + '<div class="tiny dim">' + (next ? relDay(next) : '') + '</div></td>' +
          '<td class="hide-xs r num dim">' + money(b.amount * freqPerYear(b.freq)) + '</td>' +
          '<td class="r"><div class="row" style="justify-content:flex-end;gap:4px">' +
          '<button class="btn xs ghost" data-act="editBill" data-id="' + b.id + '" title="Edit">' + svgIcon('pencil', 13) + '</button>' +
          '<button class="btn xs ghost" data-act="toggleBillActive" data-id="' + b.id + '" title="Pause / resume">' + (b.active === false ? '\u25B6' : '\u23F8') + '</button>' +
          '<button class="btn xs ghost danger" data-act="delBill" data-id="' + b.id + '" title="Delete">' + svgIcon('trash', 13) + '</button>' +
          '</div></td></tr>';
      }).join('') + '</tbody></table></div>' +
      '</section>' +
      (function () {
        var dupes = findDuplicates();
        return dupes.length ? '<section class="card" style="margin-top:16px">' + App.head('Possible double-ups', 'These look like they might overlap') +
          dupes.map(function (d) { return '<div class="alert warn" style="margin-bottom:8px"><span class="em">\uD83D\uDC40</span><span>' + d + '</span></div>'; }).join('') + '</section>' : '';
      })();
  }
};
function shortName(n) { n = String(n); return n.length > 13 ? n.slice(0, 12) + '\u2026' : n; }
function findDuplicates() {
  var out = [], seen = {};
  DB.bills.forEach(function (b) {
    var k = normalize(b.name).split(' ')[0];
    if (!k) return;
    seen[k] = seen[k] || [];
    seen[k].push(b);
  });
  Object.keys(seen).forEach(function (k) {
    if (seen[k].length > 1) out.push('<b>' + seen[k].map(function (b) { return esc(b.name); }).join('</b> and <b>') + '</b> share a name. Check you are not paying twice.');
  });
  return out;
}

/* ==========================================================================
   DEBTS
   ========================================================================== */
App.views.debts = {
  title: 'Debts',
  crumb: function () {
    var s = debtSummary();
    return s.count ? s.count + ' debts · ' + money(s.total) + ' owed · ' + money(s.minPay) + '/month in minimums' : 'Debt payoff planner';
  },
  html: function () {
    if (!DB.debts.length) return App.empty('\uD83C\uDFE6', 'No debts tracked', 'Add a card, loan or IOU and the planner will show the fastest way out — and the interest you avoid.', '<button class="btn primary" data-act="addDebt" style="margin-top:12px">' + svgIcon('plus', 14) + ' Add a debt</button>');

    var s = debtSummary();
    var strat = V.debtStrategy || 'snowball';
    var plan = debtPlan(strat, V.debtExtra);
    var baseline = debtPlan('avalanche', 0);
    var other = debtPlan(strat === 'snowball' ? 'avalanche' : 'snowball', V.debtExtra);
    var savedVsMin = baseline.totalInterest - plan.totalInterest;
    var monthsSaved = baseline.months - plan.months;
    var schedule = plan.schedule.map(function (r) { return r.remaining; });
    var baseSchedule = baseline.schedule.map(function (r) { return r.remaining; });
    var labels = plan.schedule.map(function (r) { return r.month % 6 === 0 || r.month === 1 ? 'm' + r.month : ''; });

    return '' +
      '<div class="grid g-4">' +
      metricCard('Total owed', money(s.total), s.count + ' accounts', s.total > 0 ? 'warn' : 'good') +
      metricCard('Minimums', money(s.minPay), 'per month, before extra', '') +
      metricCard('Average rate', s.avgApr.toFixed(1) + '%', 'weighted by balance', s.avgApr > 18 ? 'danger' : s.avgApr > 10 ? 'warn' : 'good') +
      metricCard('Debt-free', plan.months ? fmtDate(plan.payoffDate, 'medium') : '\u2014', plan.months + ' months on this plan', 'good') +
      '</div>' +

      '<div class="grid g-32" style="margin-top:16px" data-tour="debtplan">' +
      '<section class="card">' + App.head('Payoff plan', 'Change the plan and watch the date move') +
      '<div class="row wrap between" style="gap:12px">' +
      '<div class="pill-group">' +
      '<button class="' + (strat === 'snowball' ? 'on' : '') + '" data-act="setStrategy" data-id="snowball">Snowball</button>' +
      '<button class="' + (strat === 'avalanche' ? 'on' : '') + '" data-act="setStrategy" data-id="avalanche">Avalanche</button>' +
      '<button class="' + (strat === 'custom' ? 'on' : '') + '" data-act="setStrategy" data-id="custom">My order</button>' +
      '</div>' +
      '<div class="small dim" style="max-width:38ch">' + (strat === 'snowball' ? 'Smallest balance first — quick wins that keep you motivated.'
        : strat === 'avalanche' ? 'Highest rate first — mathematically the cheapest route.'
          : 'Pick the account you want to hit first below.') + '</div>' +
      '</div>' +
      '<hr class="sep">' +
      '<div class="row wrap" style="gap:16px">' +
      '<div style="flex:1;min-width:220px"><label class="field"><span class="lb">Extra per month: <b id="extraOut">' + money(V.debtExtra) + '</b></span>' +
      '<input type="range" min="0" max="1000" step="25" value="' + V.debtExtra + '" data-live="extraOut" data-live-fmt="money" data-act="setExtraLive" id="extraRange"></label></div>' +
      '<div class="row" style="gap:8px;align-items:flex-end">' +
      [50, 100, 250].map(function (v) { return '<button class="btn sm" data-act="bumpExtra" data-id="' + v + '">+' + money0(v) + '</button>'; }).join('') +
      '<button class="btn sm ghost" data-act="setExtra" data-id="0">reset</button>' +
      '</div></div>' +
      '<div style="margin-top:14px">' + Chart.line(labels.map(function (l, i) { return { y: schedule[i], label: l }; }), {
        height: 220, color: 'var(--good)', gid: 'debt', xTicks: Math.min(8, Math.max(2, Math.round(schedule.length / 6))), zeroFloor: true
      }) + '</div>' +
      '<div class="grid g-3" style="margin-top:14px">' +
      '<div class="metric"><div class="l">Payoff date</div><div class="v">' + fmtDate(plan.payoffDate, 'medium') + '</div><div class="d">' + plan.months + ' months at ' + money(plan.budget) + '/month</div></div>' +
      '<div class="metric"><div class="l">Interest you will pay</div><div class="v">' + money(plan.totalInterest) + '</div><div class="d">' + (savedVsMin > 1 ? money(savedVsMin) + ' less than minimums only' : 'add extra to cut this') + '</div></div>' +
      '<div class="metric"><div class="l">Time saved</div><div class="v ' + (monthsSaved > 0 ? 'good' : '') + '">' + (monthsSaved > 0 ? monthsSaved + ' months' : '\u2014') + '</div><div class="d">versus paying minimums only (' + baseline.months + ' months)</div></div>' +
      '</div>' +
      '</section>' +

      '<div class="stack">' +
      '<section class="card">' + App.head('Snowball vs avalanche', 'Same money, different order') +
      '<table><tbody>' +
      '<tr><td>Snowball</td><td class="r num">' + (function () { var p = debtPlan('snowball', V.debtExtra); return fmtDate(p.payoffDate, 'medium'); })() + '</td><td class="r num dim">' + money(debtPlan('snowball', V.debtExtra).totalInterest) + ' interest</td></tr>' +
      '<tr><td>Avalanche</td><td class="r num">' + (function () { var p = debtPlan('avalanche', V.debtExtra); return fmtDate(p.payoffDate, 'medium'); })() + '</td><td class="r num dim">' + money(debtPlan('avalanche', V.debtExtra).totalInterest) + ' interest</td></tr>' +
      '</tbody></table>' +
      '<p class="tiny dim" style="margin-top:10px">' + (function () {
        var a = debtPlan('avalanche', V.debtExtra).totalInterest, b = debtPlan('snowball', V.debtExtra).totalInterest;
        if (Math.abs(a - b) < 1) return 'Both orders cost about the same here — pick whichever keeps you going.';
        return a < b ? 'Avalanche saves you ' + money(b - a) + ' in interest. Snowball if you need the morale win.' : 'Snowball happens to be cheaper here.';
      })() + '</p>' +
      '</section>' +
      '<section class="card">' + App.head('Payoff order', strat === 'custom' ? 'Drag-free custom order' : 'What gets cleared, and when') +
      '<div class="list">' + plan.order.map(function (o, i) {
        return '<div class="li"><div class="ic">' + (i + 1) + '</div><div class="tx"><b>' + esc(o.name) + '</b><span>cleared ' + fmtDate(o.date, 'medium') + '</span></div>' +
          '<div class="va num dim">' + o.month + ' mo</div></div>';
      }).join('') + '</div>' +
      (strat === 'custom' ? '<div style="margin-top:12px"><label class="field"><span class="lb">Focus first on</span><select data-field="setting" data-key="dismiss">' +
        '<option value="">—</option>' + DB.debts.map(function (d) { return '<option>' + esc(d.name) + '</option>'; }).join('') + '</select></label></div>' : '') +
      '</section>' +
      '</div></div>' +

      '<section class="card" style="margin-top:16px">' +
      App.head('Accounts', 'Balances come straight from you — update them whenever you check in',
        '<button class="btn sm primary" data-act="addDebt">' + svgIcon('plus', 14) + ' Add debt</button>') +
      '<div class="grid g-2">' + DB.debts.map(function (d) {
        var planD = plan.balances.filter(function (b) { return b.id === d.id; })[0] || {};
        var orderIdx = -1;
        plan.order.forEach(function (o, i) { if (o.id === d.id) orderIdx = i; });
        return '<div class="card pad-sm">' +
          '<div class="row between"><div class="row" style="gap:10px"><span style="font-size:19px">' + (d.icon || '\uD83D\uDCB3') + '</span>' +
          '<div><b>' + esc(d.name) + '</b><div class="tiny dim">' + (d.apr || 0) + '% APR · min ' + money(d.minPayment) + '</div></div></div>' +
          '<b class="num" style="font-size:17px">' + money(d.balance) + '</b></div>' +
          '<div style="margin-top:11px"><div class="row between tiny dim"><span>payoff position ' + (orderIdx >= 0 ? '#' + (orderIdx + 1) : '\u2014') + '</span>' +
          '<span>' + money((Number(d.minPayment) || 0) * (Number(d.apr) || 0) / 1200) + '/mo interest</span></div></div>' +
          '<div class="row" style="gap:10px;margin-top:12px;flex-wrap:wrap">' +
          '<label class="field" style="flex:1;min-width:96px"><span class="lb">Balance</span><input type="number" step="0.01" data-field="debt" data-key="balance" data-id="' + d.id + '" value="' + d.balance + '" style="height:34px"></label>' +
          '<label class="field" style="flex:1;min-width:80px"><span class="lb">APR %</span><input type="number" step="0.1" data-field="debt" data-key="apr" data-id="' + d.id + '" value="' + (d.apr || 0) + '" style="height:34px"></label>' +
          '<label class="field" style="flex:1;min-width:80px"><span class="lb">Minimum</span><input type="number" step="1" data-field="debt" data-key="minPayment" data-id="' + d.id + '" value="' + d.minPayment + '" style="height:34px"></label>' +
          '</div>' +
          '<div class="row" style="gap:6px;margin-top:10px">' +
          '<button class="btn xs" data-act="focusDebt" data-id="' + d.id + '">Focus extra here</button>' +
          '<span style="flex:1"></span>' +
          '<button class="btn xs danger" data-act="delDebt" data-id="' + d.id + '">' + svgIcon('trash', 13) + ' Remove</button>' +
          '</div></div>';
      }).join('') + '</div></section>';
  },
  after: function () {
    var r = document.getElementById('extraRange');
    if (r) {
      r.addEventListener('change', function () { V.debtExtra = Number(r.value) || 0; App.render(); });
    }
  }
};

/* ==========================================================================
   GOALS
   ========================================================================== */
App.views.goals = {
  title: 'Goals',
  crumb: function () {
    var saved = sum(DB.goals, function (g) { return Number(g.saved) || 0; });
    var target = sum(DB.goals, function (g) { return Number(g.target) || 0; });
    return DB.goals.length ? money(saved) + ' of ' + money(target) + ' funded' : 'Give your spare money a job';
  },
  html: function () {
    if (!DB.goals.length) return App.empty('\uD83C\uDFAF', 'No goals yet', 'An emergency fund, a trip, a new laptop — name it, set a monthly amount, and watch the finish line move closer.', '<button class="btn primary" data-act="addGoal" style="margin-top:12px">' + svgIcon('plus', 14) + ' Create a goal</button>');

    var infos = DB.goals.map(goalInfo);
    var saved = sum(infos, function (i) { return i.saved; });
    var target = sum(infos, function (i) { return i.target; });
    var monthly = sum(infos, function (i) { return i.monthly; });
    var needed = sum(infos.filter(function (i) { return !i.complete && i.needed; }), function (i) { return i.needed; });
    var surplus = monthlySurplus();
    var totalSavings = sum(DB.accounts.filter(function (a) { return a.kind === 'savings'; }), function (a) { return Number(a.balance) || 0; });

    var chartLabels = [], chartVals = [];
    for (var m = 0; m <= 24; m++) {
      var tot = 0;
      infos.forEach(function (i) {
        tot += Math.min(i.saved + i.monthly * m, i.target);
      });
      chartLabels.push('m' + m);
      chartVals.push(r2(tot));
    }
    var lastTarget = sum(infos, function (i) { return i.target; });

    return '' +
      '<div class="grid g-4">' +
      metricCard('Total saved', money(saved), Math.round(target ? (saved / target) * 100 : 0) + '% of ' + money0(target) + ' target', 'good') +
      metricCard('Monthly deposits', money(monthly), monthly > surplus ? money0(monthly - surplus) + ' more than your surplus' : money0(surplus - monthly) + ' of surplus spare', monthly > surplus ? 'warn' : 'good') +
      metricCard('Needed to hit dates', money(needed), needed > monthly ? 'you are ' + money0(needed - monthly) + ' / month short' : 'your current pace covers it', needed > monthly ? 'warn' : 'good') +
      metricCard('In savings accounts', money(totalSavings), 'earmarked across ' + DB.goals.length + ' goals', '') +
      '</div>' +

      '<div class="grid g-32" style="margin-top:16px">' +
      '<section class="card" data-tour="goals">' +
      App.head('Goals', 'Sorted by ' + (V.goalSort === 'pct' ? 'progress' : V.goalSort === 'eta' ? 'finish date' : 'size'),
        '<div class="pill-group"><button class="' + (V.goalSort === 'pct' ? 'on' : '') + '" data-act="goalSort" data-id="pct">Progress</button>' +
        '<button class="' + (V.goalSort === 'eta' ? 'on' : '') + '" data-act="goalSort" data-id="eta">Finish</button>' +
        '<button class="' + (V.goalSort === 'size' ? 'on' : '') + '" data-act="goalSort" data-id="size">Size</button></div>' +
        '<button class="btn sm primary" data-act="addGoal">' + svgIcon('plus', 14) + ' New</button>') +
      '<div class="grid g-2">' + sortBy(infos, function (i) {
        if (V.goalSort === 'eta') return i.monthsLeft;
        if (V.goalSort === 'size') return -i.target;
        return -i.pct;
      }).map(function (i) { return goalCard(i); }).join('') + '</div>' +
      '</section>' +

      '<div class="stack">' +
      '<section class="card">' + App.head('Projection', 'If you keep every deposit') +
      Chart.line(chartVals.map(function (v, k) { return { y: v, label: k % 6 === 0 ? 'm' + k : '' }; }), { height: 190, color: 'var(--accent-2)', gid: 'goals', xTicks: 5 }) +
      '<p class="tiny dim" style="margin-top:8px">Fully funded in <b>' + (function () {
        for (var k = 0; k < chartVals.length; k++) if (chartVals[k] >= lastTarget - 1) return k + ' months';
        return 'more than 2 years at this pace';
      })() + '</b> · target total ' + money(lastTarget) + '</p>' +
      '</section>' +
      '<section class="card">' + App.head('Funding check', 'Does the plan fit the budget?') +
      '<div class="stack">' +
      '<div class="row between"><span class="small muted">Monthly surplus</span><b class="num">' + money(surplus) + '</b></div>' +
      '<div class="row between"><span class="small muted">Goal deposits planned</span><b class="num">' + money(monthly) + '</b></div>' +
      '<div class="row between"><span class="small muted">Difference</span><b class="num ' + (surplus - monthly >= 0 ? 'good' : 'danger') + '">' + money(surplus - monthly) + '</b></div>' +
      '<div style="margin-top:6px">' + Chart.progress(monthly && surplus ? (monthly / Math.max(surplus, monthly)) * 100 : 0, { color: surplus >= monthly ? 'var(--good)' : 'var(--danger)' }) + '</div>' +
      '<p class="tiny dim">' + (surplus >= monthly
        ? 'Comfortable. Your deposits fit inside what you are not already spending.'
        : 'Trim ' + money(monthly - surplus) + ' a month from envelopes, or push a target date out.') + '</p>' +
      '</div></section>' +
      '<section class="card">' + App.head('Starter goals', 'Tap to add — rename later') +
      '<div class="row wrap" style="gap:8px">' +
      [['\uD83D\uDEE1\uFE0F', 'Emergency Fund', '3 months of expenses'], ['\uD83C\uDFE0', 'Home Deposit', '10% down'], ['\u2708\uFE0F', 'Trip', 'flights + hotel'],
      ['\uD83D\uDE97', 'Car Replacement', 'drive it till it dies'], ['\uD83C\uDF93', 'Education', 'tuition pot'], ['\uD83C\uDF81', 'Holidays', 'no January regret']]
        .map(function (p) {
          return '<button class="btn sm" data-act="quickGoal" data-id="' + p[1] + '">' + p[0] + ' ' + p[1] + '</button>';
        }).join('') + '</div></section>' +
      '</div></div>';
  }
};
function monthlySurplus() {
  var inc = 0, exp = 0;
  for (var i = 0; i < 3; i++) { var m = monthSummary(monthKey(addMonths(today(), -i))); inc += m.income; exp += m.expense; }
  var avgInc = inc / 3;
  var billLoad = sum(DB.bills.filter(function (b) { return b.active !== false; }), function (b) { return b.amount * freqPerMonth(b.freq); });
  var debtMin = sum(DB.debts, function (d) { return Number(d.minPayment) || 0; });
  var avgDiscretionary = exp > 0 ? exp / 3 : (averageEnvelopeTotal() - billLoad - 0);
  return r2(avgInc - billLoad - debtMin - Math.max(0, avgDiscretionary));
}
function averageEnvelopeTotal() { return sum(DB.cats, function (c) { return Number(c.cap) || 0; }); }
function goalCard(i) {
  var g = i.goal;
  return '<div class="card pad-sm">' +
    '<div class="row between"><div class="row" style="gap:10px;min-width:0">' +
    '<div class="goal-ring">' + Chart.ring(i.pct, { size: 62, stroke: 7, color: g.color }) + '<div class="pc" style="font-size:12px">' + Math.round(i.pct) + '%</div></div>' +
    '<div style="min-width:0"><b style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (g.icon || '\uD83C\uDFAF') + ' ' + esc(g.name) + '</b>' +
    '<div class="tiny dim">' + money(i.saved) + ' of ' + money(i.target) + '</div></div></div>' +
    '<div style="text-align:right">' + (i.complete ? '<span class="chip good">funded</span>' :
      i.onTrack === false ? '<span class="chip warn">behind</span>' : i.onTrack ? '<span class="chip good">on track</span>' : '') +
    '<div class="tiny dim" style="margin-top:4px">' + (i.monthly ? money0(i.monthly) + '/mo' : 'no deposit') + '</div></div></div>' +
    '<div style="margin-top:11px">' + Chart.progress(i.pct, { thin: true, color: g.color }) + '</div>' +
    '<div class="row between tiny dim" style="margin-top:7px">' +
    '<span>' + (i.eta ? 'done ' + fmtDate(i.eta, 'short') : 'add a monthly amount') + '</span>' +
    '<span>' + (i.targetDate ? 'target ' + fmtDate(i.targetDate, 'short') : '') + '</span></div>' +
    '<div class="row" style="gap:6px;margin-top:11px">' +
    '<button class="btn xs primary" data-act="contribute" data-id="' + g.id + '">Add money</button>' +
    '<button class="btn xs" data-act="editGoal" data-id="' + g.id + '">Edit</button>' +
    '<span style="flex:1"></span>' +
    '<button class="btn xs ghost danger" data-act="delGoal" data-id="' + g.id + '">' + svgIcon('trash', 12) + '</button>' +
    '</div></div>';
}

/* ==========================================================================
   CALENDAR
   ========================================================================== */
App.views.calendar = {
  title: 'Calendar',
  crumb: function () { var m = calMonth(); return MONTHS[m.getMonth()] + ' ' + m.getFullYear() + ' · tap any day for the detail'; },
  html: function () {
    var m = calMonth();
    var y = m.getFullYear(), mm = m.getMonth();
    var first = new Date(y, mm, 1), last = new Date(y, mm + 1, 0);
    var pad = (first.getDay() - DB.settings.weekStart + 7) % 7;
    var occ = billOccurrences(first, last);
    var inc = incomeOccurrences(first, last);
    var byDay = {};
    occ.forEach(function (o) { var k = ymd(o.date); (byDay[k] = byDay[k] || {}).bills = (byDay[k].bills || []).concat([o]); });
    inc.forEach(function (o) { var k = ymd(o.date); (byDay[k] = byDay[k] || {}).income = (byDay[k].income || []).concat([o]); });
    DB.tx.forEach(function (t) {
      var d = parseYMD(t.date);
      if (d < first || d > last) return;
      var k = ymd(d);
      byDay[k] = byDay[k] || {};
      byDay[k].spent = (byDay[k].spent || 0) + (t.amount < 0 ? Math.abs(t.amount) : 0);
      byDay[k].earned = (byDay[k].earned || 0) + (t.amount > 0 ? t.amount : 0);
      byDay[k].count = (byDay[k].count || 0) + 1;
    });

    var dows = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var dowHtml = '';
    for (var w = 0; w < 7; w++) dowHtml += '<div class="dow">' + dows[(DB.settings.weekStart + w) % 7] + '</div>';
    var cells = '';
    for (var p = 0; p < pad; p++) cells += '<div></div>';
    for (var d = 1; d <= last.getDate(); d++) {
      var dt = new Date(y, mm, d), k = ymd(dt), data = byDay[k] || {};
      var billTotal = sum(data.bills || [], function (o) { return o.amount; });
      var incTotal = sum(data.income || [], function (o) { return o.amount; });
      var net = incTotal - billTotal - (data.spent || 0);
      var maxDay = 0;
      Object.keys(byDay).forEach(function (kk) { maxDay = Math.max(maxDay, byDay[kk].spent || 0); });
      var intensity = maxDay ? (data.spent || 0) / maxDay : 0;
      cells += '<button class="day' + (k === ymd(today()) ? ' today' : '') + '" data-act="dayDetail" data-id="' + k + '"' +
        (intensity > 0.04 ? ' style="background:color-mix(in srgb, var(--accent) ' + Math.round(intensity * 26) + '%, var(--surface-2))"' : '') + '>' +
        '<div class="row between"><span class="d">' + d + '</span>' +
        ((data.income || []).length ? '<span class="tiny good">\u2193 in</span>' : (data.bills || []).length && billTotal >= 100 ? '<span class="tiny dim">due</span>' : '') + '</div>' +
        '<div class="dots">' + (data.income || []).map(function () { return '<i class="pay"></i>'; }).join('') +
        (data.bills || []).slice(0, 4).map(function (o) { return '<i style="background:' + (o.paid ? 'var(--good)' : 'var(--muted)') + '"></i>'; }).join('') + '</div>' +
        (data.spent ? '<div class="ev dim">' + money0(data.spent) + ' out</div>' : '') +
        (billTotal ? '<div class="ev">' + money0(billTotal) + ' bills</div>' : '') +
        '<div class="tot ' + (net >= 0 ? 'good' : 'dim') + '">' + (net ? (net > 0 ? '+' : '\u2212') + money0(Math.abs(net)).replace('-', '') : '') + '</div>' +
        '</button>';
    }

    var monthBillsTotal = sum(occ, function (o) { return o.amount; });
    var monthIncomeTotal = sum(inc, function (o) { return o.amount; });

    return '' +
      '<div class="row between wrap" style="gap:12px;margin-bottom:16px">' +
      '<div class="row" style="gap:8px">' +
      '<button class="btn icon" data-act="shiftMonth" data-id="cal" data-dir="-1">' + svgIcon('chevL') + '</button>' +
      '<b style="font-size:16px;min-width:160px;text-align:center">' + MONTHS[mm] + ' ' + y + '</b>' +
      '<button class="btn icon" data-act="shiftMonth" data-id="cal" data-dir="1">' + svgIcon('chevR') + '</button>' +
      '<button class="btn sm ghost" data-act="thisMonth" data-id="cal">Today</button>' +
      '</div>' +
      '<div class="row wrap" style="gap:8px">' +
      '<span class="chip">' + svgIcon('down', 12) + ' bills ' + money0(monthBillsTotal) + '</span>' +
      '<span class="chip good">income ' + money0(monthIncomeTotal) + '</span>' +
      '<span class="chip">net ' + money0(monthIncomeTotal - monthBillsTotal) + '</span>' +
      '</div></div>' +
      '<div class="grid g-32">' +
      '<section class="card"><div class="cal">' + dowHtml + cells + '</div></section>' +
      '<div class="stack">' +
      '<section class="card">' + App.head('Due this month', occ.length + ' payments') +
      '<div style="max-height:360px;overflow:auto"><div class="list">' + occ.map(function (o) {
        return '<div class="li' + (o.paid ? ' dim-row' : '') + '"><div class="ic">' + (o.bill.icon || '\uD83D\uDCC5') + '</div>' +
          '<div class="tx"><b>' + esc(o.bill.name) + '</b><span>' + fmtDate(o.date, 'short') + ' · ' + relDay(o.date) + '</span></div>' +
          '<div class="va num">' + money(o.amount) + '</div>' +
          (o.paid ? '<span class="chip good">paid</span>' : '<button class="btn xs" data-act="pay" data-id="' + o.bill.id + '" data-date="' + ymd(o.date) + '">Pay</button>') + '</div>';
      }).join('') + '</div></div></section>' +
      '<section class="card">' + App.head('Upcoming income', inc.length + ' deposits') +
      (inc.length ? '<div class="list">' + inc.map(function (o) {
        return '<div class="li"><div class="ic">\uD83D\uDCB0</div><div class="tx"><b>' + esc(o.item.name) + '</b><span>' + fmtDate(o.date, 'weekday') + '</span></div>' +
          '<div class="va num good">+' + money(o.amount).replace('-', '') + '</div></div>';
      }).join('') + '</div>' : '<p class="small dim">No income scheduled. Add a source in Settings \u2192 Income.</p>') +
      '</section></div></div>';
  }
};

/* ==========================================================================
   REPORTS
   ========================================================================== */
App.views.reports = {
  title: 'Reports',
  crumb: 'Trends, net worth, merchants and your money score over time',
  html: function () {
    var n = V.reportWindow;
    var trend = monthlyTrend(n);
    var nw = netWorthSeries();
    /* one pass over transactions, bucketed by month + category */
    var bucket = {};
    trend.forEach(function (m) { bucket[m.key] = {}; });
    DB.tx.forEach(function (t) {
      if (t.amount >= 0) return;
      var k = String(t.date).slice(0, 7);
      if (!bucket[k]) return;
      bucket[k][t.catId] = (bucket[k][t.catId] || 0) + Math.abs(t.amount);
    });
    var cats = DB.cats.map(function (c) {
      var total = 0, months = 0;
      var series = trend.map(function (m) {
        var v = r2((bucket[m.key] || {})[c.id] || 0);
        if (v) { total += v; months++; }
        return v;
      });
      return { cat: c, total: r2(total), avg: r2(total / Math.max(1, n)), series: series, months: months };
    });
    var activeCats = sortBy(cats.filter(function (c) { return c.total > 0; }), function (c) { return c.total; }, 'desc');
    var income = sum(trend, function (m) { return m.income; });
    var expense = sum(trend, function (m) { return m.expense; });
    var rate = income > 0 ? ((income - expense) / income) * 100 : 0;
    var score = moneyScore();

    var merchants = {};
    DB.tx.forEach(function (t) {
      if (t.amount >= 0) return;
      var k = t.note || '(no note)';
      merchants[k] = merchants[k] || { name: k, total: 0, count: 0, first: t.date, last: t.date };
      merchants[k].total += Math.abs(t.amount);
      merchants[k].count++;
      if (t.date < merchants[k].first) merchants[k].first = t.date;
      if (t.date > merchants[k].last) merchants[k].last = t.date;
    });
    var topM = sortBy(Object.keys(merchants).map(function (k) { return merchants[k]; }), function (x) { return x.total; }, 'desc').slice(0, 12);

    var best = trend.length ? sortBy(trend, function (m) { return m.net; }, 'desc')[0] : null;
    var worst = trend.length ? sortBy(trend, function (m) { return m.net; })[0] : null;
    var biggestCat = activeCats[0];

    return '' +
      '<div class="row between wrap" style="gap:12px;margin-bottom:16px">' +
      '<div class="pill-group">' + [3, 6, 12].map(function (k) {
        return '<button class="' + (n === k ? 'on' : '') + '" data-act="reportWindow" data-id="' + k + '">' + k + ' months</button>';
      }).join('') + '</div>' +
      '<div class="row wrap" style="gap:8px">' +
      '<button class="btn sm" data-act="exportCsv" data-id="tx">' + svgIcon('down', 14) + ' All transactions</button>' +
      '<button class="btn sm" data-act="exportCsv" data-id="summary">' + svgIcon('down', 14) + ' Monthly summary</button>' +
      '<button class="btn sm" data-act="exportJson">' + svgIcon('down', 14) + ' Backup file</button>' +
      '<button class="btn sm ghost" data-act="printReport">' + svgIcon('reports', 14) + ' Print</button>' +
      '</div></div>' +

      '<div class="grid g-4">' +
      metricCard('Income (period)', money(income), n + ' months logged', 'good') +
      metricCard('Spending (period)', money(expense), money(expense / n) + ' per month', '') +
      metricCard('Kept', money(income - expense), rate.toFixed(1) + '% savings rate', rate >= 15 ? 'good' : rate >= 0 ? 'warn' : 'danger') +
      metricCard('Money score', score.score + ' / 100', score.grade + ' — ' + score.parts[1].detail, '') +
      '</div>' +

      '<section class="card" style="margin-top:16px" data-tour="reports">' +
      App.head('Income vs spending', 'Last ' + n + ' months', '') +
      Chart.bars([
        { label: 'Income', color: 'var(--good)', values: trend.map(function (m) { return m.income; }), labels: trend.map(function (m) { return m.label; }) },
        { label: 'Spending', color: 'var(--accent-2)', values: trend.map(function (m) { return m.expense; }), labels: trend.map(function (m) { return m.label; }) }
      ], { height: 260 }) +
      '<div class="row wrap" style="gap:18px;margin-top:8px">' +
      '<span class="tiny dim"><span class="chip good" style="padding:1px 8px">\u25A0</span> income</span>' +
      '<span class="tiny dim"><span class="chip" style="padding:1px 8px;color:var(--accent-2)">\u25A0</span> spending</span>' +
      (best ? '<span class="tiny dim">Best month: <b>' + best.label + '</b> (' + (best.net >= 0 ? '+' : '\u2212') + money0(Math.abs(best.net)).replace('-', '') + ')</span>' : '') +
      (worst && worst.net < 0 ? '<span class="tiny dim">Toughest: <b>' + worst.label + '</b> (' + '\u2212' + money0(Math.abs(worst.net)) + ')</span>' : '') +
      '</div></section>' +

      '<div class="grid g-2" style="margin-top:16px">' +
      '<section class="card">' + App.head('Net worth', 'Your snapshots plus today') +
      (nw.length > 1 ? Chart.line(sortBy(nw, function (s) { return s.date; }).map(function (s) {
        return { y: s.netWorth, label: fmtDate(s.date, 'short') };
      }), { height: 210, color: 'var(--good)', gid: 'nw', xTicks: Math.min(6, nw.length), zeroFloor: false }) +
        '<div class="row between" style="margin-top:8px"><span class="tiny dim">' + fmtDate(nw[0].date, 'medium') + '</span>' +
        '<span class="small">Now <b class="num">' + money(netWorth()) + '</b> ' +
        (netWorth() - nw[0].netWorth >= 0 ? '<span class="chip good">+' + money0(netWorth() - nw[0].netWorth).replace('+', '') + '</span>' : '<span class="chip danger">' + money0(netWorth() - nw[0].netWorth) + '</span>') + '</span></div>'
        : '<p class="small muted">Take a snapshot each month from Settings and this fills in with a real trend line.</p>') +
      '</section>' +
      '<section class="card">' + App.head('Category averages', 'Per month over ' + n + ' months') +
      (activeCats.length ? '<div style="max-height:280px;overflow:auto"><table><tbody>' + activeCats.map(function (c) {
        return '<tr><td><span style="color:' + c.cat.color + '">' + c.cat.icon + '</span> ' + esc(c.cat.name) + '</td>' +
          '<td class="r num">' + money(c.avg) + '</td>' +
          '<td class="r num dim" style="width:90px">' + money0(c.total) + '</td>' +
          '<td class="r" style="width:80px">' + Chart.spark(c.series, { color: c.cat.color, height: 26 }) + '</td></tr>';
      }).join('') + '</tbody></table></div>' : App.empty('\uD83D\uDCC8', 'Not enough history', 'Log a few weeks of spending and averages appear here.')) +
      '</section></div>' +

      '<div class="grid g-2" style="margin-top:16px">' +
      '<section class="card">' + App.head('Where the money actually goes', 'Top merchants across the period') +
      (topM.length ? '<div style="max-height:330px;overflow:auto"><table><tbody>' + topM.map(function (x) {
        return '<tr><td><b style="font-weight:600">' + esc(x.name) + '</b><div class="tiny dim">' + x.count + ' charges · first ' + fmtDate(x.first, 'short') + '</div></td>' +
          '<td class="r num">' + money(x.total) + '</td><td class="r num dim">' + money0(x.total / Math.max(1, n)) + '/mo</td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="small muted">Nothing logged yet.</p>') +
      '</section>' +
      '<section class="card">' + App.head('Monthly digest', 'A paragraph you can act on') +
      '<div class="stack">' + digest(score, trend, activeCats, topM) + '</div>' +
      '</section></div>';
  }
};
function digest(score, trend, cats, merchants) {
  var out = [];
  var last = trend[trend.length - 1];
  var prev = trend[trend.length - 2];
  if (last) {
    out.push('<p class="small">In <b>' + last.label + '</b> you brought in <b>' + money(last.income) + '</b> and spent <b>' + money(last.expense) + '</b>' +
      (prev ? ', which is ' + (last.expense > prev.expense ? 'up' : 'down') + ' ' + money0(Math.abs(last.expense - prev.expense)) + ' on the month before' : '') + '.</p>');
  }
  if (cats[0]) out.push('<p class="small">Your biggest category is <b>' + esc(cats[0].cat.name) + '</b> at ' + money(cats[0].avg) + ' a month — about ' + Math.round(cats[0].total / Math.max(1, sum(cats, function (c) { return c.total; })) * 100) + '% of everything you spend.</p>');
  if (merchants[0]) out.push('<p class="small">The single merchant you pay most is <b>' + esc(merchants[0].name) + '</b> (' + money(merchants[0].total) + ' over the period).</p>');
  out.push('<p class="small">Money score sits at <b>' + score.score + '</b> — ' + score.grade.toLowerCase() + '. ' +
    (score.parts[0].value < 60 ? 'The fastest lever is savings rate: keep 20% of what comes in and this jumps.' :
      score.parts[3].value < 60 ? 'The fastest lever is your emergency runway: get to three months of expenses.' :
        'Nothing urgent to fix. Keep the deposits automatic.') + '</p>');
  return out.join('');
}

/* ==========================================================================
   SETTINGS
   ========================================================================== */
App.views.settings = {
  title: 'Settings',
  crumb: 'Everything lives in this browser — nothing is uploaded, ever',
  html: function () {
    var s = DB.settings;
    var sts = safeToSpend();
    return '' +
      '<div class="grid g-2">' +

      '<section class="card">' + App.head('You', 'Used for greetings and reports only') +
      '<div class="grid g-2" style="gap:12px">' +
      '<label class="field"><span class="lb">Name</span><input type="text" data-field="setting" data-key="name" value="' + esc(s.name) + '" placeholder="Your name"></label>' +
      '<label class="field"><span class="lb">Currency</span><select data-field="setting" data-key="currency" data-after="afterCurrency">' +
      CURRENCIES.map(function (c) { return '<option value="' + c.code + '"' + (c.code === s.currency ? ' selected' : '') + '>' + c.code + ' · ' + c.label + '</option>'; }).join('') +
      '</select></label>' +
      '<label class="field"><span class="lb">Number format</span><select data-field="setting" data-key="locale">' +
      [['en-US', 'English (US) — $1,234.56'], ['en-GB', 'English (UK) — £1,234.56'], ['de-DE', 'Deutsch — 1.234,56 €'], ['fr-FR', 'Français — 1 234,56 €'],
      ['es-ES', 'Español — 1.234,56 €'], ['pt-BR', 'Português — R$ 1.234,56'], ['nl-NL', 'Nederlands — € 1.234,56'], ['it-IT', 'Italiano — 1.234,56 €'],
      ['sv-SE', 'Svenska — 1 234,56 kr'], ['pl-PL', 'Polski — 1 234,56 zł'], ['ja-JP', '日本語 — ¥1,235'], ['en-IN', 'English (IN) — ₹1,234.56']]
        .map(function (l) { return '<option value="' + l[0] + '"' + (l[0] === s.locale ? ' selected' : '') + '>' + l[1] + '</option>'; }).join('') +
      '</select></label>' +
      '<label class="field"><span class="lb">Week starts on</span><select data-field="setting" data-key="weekStart" data-num>' +
      ['Sunday', 'Monday', 'Saturday'].map(function (d, i) {
        var v = i === 2 ? 6 : i;
        return '<option value="' + v + '"' + (Number(s.weekStart) === v ? ' selected' : '') + '>' + d + '</option>';
      }).join('') + '</select></label>' +
      '</div>' +
      '<hr class="sep">' +
      '<div class="lb" style="font-size:11.5px;font-weight:650;letter-spacing:.04em;text-transform:uppercase;color:var(--dim);margin-bottom:8px">Theme</div>' +
      '<div class="row wrap" style="gap:8px">' + THEMES.map(function (t) {
        return '<button class="btn sm' + (s.theme === t.id ? ' primary' : '') + '" data-act="setTheme" data-id="' + t.id + '">' +
          '<span style="width:10px;height:10px;border-radius:3px;background:' + t.swatch + ';display:inline-block"></span> ' + t.label + '</button>';
      }).join('') + '</div>' +
      '<div class="row between" style="margin-top:14px"><span class="small">Privacy goggles</span>' +
      '<label class="switch"><input type="checkbox" data-field="setting" data-key="privacy"' + (s.privacy ? ' checked' : '') + '><span class="slider"></span>' +
      '<span class="txt">Blur every amount — safe in public</span></label></div>' +
      '</section>' +

      '<section class="card">' + App.head('Pay schedule', 'Drives the countdown and the safe-to-spend window') +
      '<div class="grid g-2" style="gap:12px">' +
      '<label class="field"><span class="lb">Cycle</span><select data-field="setting" data-key="payMode">' +
      [['weekly', 'Weekly'], ['biweekly', 'Every 2 weeks'], ['semimonthly', 'Twice a month'], ['monthly', 'Monthly']]
        .map(function (p) { return '<option value="' + p[0] + '"' + (p[0] === s.payMode ? ' selected' : '') + '>' + p[1] + '</option>'; }).join('') +
      '</select></label>' +
      '<label class="field"><span class="lb">Next payday</span><input type="date" data-field="setting" data-key="anchor" value="' + String(s.anchor).slice(0, 10) + '"></label>' +
      '</div>' +
      '<div class="metric" style="margin-top:12px"><div class="l">Next payday</div><div class="v">' + fmtDate(nextScheduledPayday(today()), 'medium') + '</div>' +
      '<div class="d">' + relDay(nextScheduledPayday(today())) + ' · used when you have no income sources set up</div></div>' +
      '<hr class="sep">' +
      App.head('Income sources', DB.income.length ? money(sum(DB.income.filter(function (i) { return i.active !== false; }), function (i) { return i.amount * freqPerMonth(i.freq); })) + ' / month' : 'none yet',
        '<button class="btn xs" data-act="addIncome">' + svgIcon('plus', 12) + ' Add</button>') +
      (DB.income.length ? '<div class="list">' + DB.income.map(function (i) {
        return '<div class="li"><div class="ic">\uD83D\uDCB0</div>' +
          '<div class="tx"><b>' + esc(i.name) + '</b><span>' + FREQ_LABEL[i.freq] + ' · next ' + fmtDate(i.nextDate, 'short') + '</span></div>' +
          '<div class="va num good">+' + money(i.amount).replace('-', '') + '</div>' +
          '<div class="acts"><button class="btn xs ghost" data-act="editIncome" data-id="' + i.id + '">' + svgIcon('pencil', 13) + '</button>' +
          '<button class="btn xs ghost danger" data-act="delIncome" data-id="' + i.id + '">' + svgIcon('trash', 13) + '</button></div></div>';
      }).join('') + '</div>' : '<p class="small dim">Add what lands in your account — the forecast and payday countdown get sharper.</p>') +
      '</section>' +

      '<section class="card">' + App.head('Safe-to-spend rules', 'The most important settings in the app') +
      '<label class="field"><span class="lb">Count down until</span><select data-field="setting" data-key="safeMode">' +
      [['untilPayday', 'My next payday'], ['restOfMonth', 'The end of this month'], ['next30', 'A rolling 30 days']]
        .map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === s.safeMode ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
      '</select></label>' +
      '<div style="height:12px"></div>' +
      '<label class="field"><span class="lb">Safety buffer: <b id="bufOut">' + money(s.safetyBuffer) + '</b></span>' +
      '<input type="range" min="0" max="2000" step="25" value="' + s.safetyBuffer + '" data-live="bufOut" data-live-fmt="money" data-act="bufferLive" data-id="buffer"></label>' +
      '<div class="stack" style="margin-top:6px">' +
      settingSwitch('Count savings accounts too', 'Off keeps savings untouched — the usual choice.', 'includeSavingsInSafe') +
      settingSwitch('Hold back goal deposits', 'Reserve each goal’s monthly amount before showing what is free.', 'goalReserveInSafe') +
      settingSwitch('Realistic mode', 'Also hold back everyday spending you have not logged yet, based on your own average.', 'spendPaceInSafe') +
      settingSwitch('Roll unspent envelope money forward', 'Unused category money carries into next month instead of vanishing.', 'rollover') +
      '</div>' +
      '<hr class="sep">' +
      '<div class="metric"><div class="l">Right now</div><div class="v">' + money(sts.safe) + '</div>' +
      '<div class="d">' + money(sts.bills) + ' of bills + ' + money(sts.debtMin) + ' debt minimums + ' + money(sts.buffer) + ' buffer, subtracted from ' + money(sts.cash) + ' cash</div></div>' +
      '</section>' +

      '<section class="card">' + App.head('Accounts', 'What “cash on hand” means',
        '<button class="btn xs" data-act="addAccount">' + svgIcon('plus', 12) + ' Add</button>') +
      '<div class="list">' + DB.accounts.map(function (a) {
        return '<div class="li" style="flex-wrap:wrap"><div class="ic">' + (a.kind === 'savings' ? '\uD83C\uDFE6' : a.kind === 'credit' ? '\uD83D\uDCB3' : a.kind === 'investment' ? '\uD83D\uDCC8' : '\uD83C\uDFE7') + '</div>' +
          '<div class="tx"><input type="text" data-field="account" data-key="name" data-id="' + a.id + '" value="' + esc(a.name) + '" style="height:32px;font-weight:600;font-size:13px">' +
          '<span>' + a.kind + (a.includeInSafe === false ? ' · excluded from safe-to-spend' : ' · counts toward safe-to-spend') + '</span></div>' +
          '<input type="number" step="0.01" data-field="account" data-key="balance" data-id="' + a.id + '" value="' + a.balance + '" style="width:120px;height:34px;text-align:right">' +
          '<div class="acts"><label class="switch" style="gap:0" title="Include in safe-to-spend"><input type="checkbox" data-field="account" data-key="includeInSafe" data-id="' + a.id + '"' + (a.includeInSafe !== false ? ' checked' : '') + '><span class="slider"></span></label>' +
          '<button class="btn xs ghost danger" data-act="delAccount" data-id="' + a.id + '">' + svgIcon('trash', 13) + '</button></div></div>';
      }).join('') + '</div>' +
      '<p class="tiny dim" style="margin-top:10px">Balances are yours to maintain — update them when you check your bank. The app never connects to anything.</p>' +
      '</section>' +

      '<section class="card">' + App.head('Budgets & goals', 'Jump to the editors',
        '<button class="btn xs" data-act="addGoal">' + svgIcon('plus', 12) + ' Goal</button>') +
      '<div class="row wrap" style="gap:8px">' +
      '<button class="btn sm" data-act="editCats">Envelope caps (' + DB.cats.length + ' categories)</button>' +
      '<button class="btn sm" data-act="addDebt">Debts (' + DB.debts.length + ')</button>' +
      '<button class="btn sm" data-act="snapshot">Save net-worth snapshot</button>' +
      '</div>' +
      '<hr class="sep">' +
      App.head('Net-worth snapshots', DB.snaps.length + ' saved') +
      (DB.snaps.length ? '<div class="list" style="max-height:150px;overflow:auto">' + sortBy(DB.snaps, function (x) { return x.date; }, 'desc').slice(0, 8).map(function (sn) {
        return '<div class="li"><div class="ic">\uD83D\uDCC5</div><div class="tx"><b>' + fmtDate(sn.date, 'medium') + '</b></div>' +
          '<div class="va num">' + money(sn.netWorth) + '</div></div>';
      }).join('') + '</div>' : '<p class="small dim">Snapshots build the net-worth line in Reports. Take one on the first of each month.</p>') +
      '</section>' +

      '<section class="card">' + App.head('Your data', 'Portable, inspectable, yours') +
      '<div class="stack">' +
      '<div class="alert good"><span class="em">\uD83D\uDD12</span><span>Everything lives in this browser’s local storage. No account, no cloud, no tracking, works with Wi-Fi off.</span></div>' +
      '<div class="row wrap" style="gap:8px">' +
      '<button class="btn" data-act="exportJson">' + svgIcon('down', 15) + ' Download backup (.json)</button>' +
      '<button class="btn" data-act="exportCsv" data-id="tx">' + svgIcon('down', 15) + ' Transactions (.csv)</button>' +
      '<button class="btn" data-act="exportCsv" data-id="summary">' + svgIcon('down', 15) + ' Monthly summary (.csv)</button>' +
      '<button class="btn" data-act="importJson">' + svgIcon('up', 15) + ' Restore from backup</button>' +
      '</div>' +
      '<div class="row wrap" style="gap:8px">' +
      '<button class="btn sm" data-act="startTour">Replay the tour</button>' +
      '<button class="btn sm" data-act="loadDemo">Load sample data</button>' +
      '<button class="btn sm danger" data-act="wipe">Erase everything</button>' +
      '</div>' +
      '<p class="tiny dim">Tip: keep the downloaded backup next to your budget file. Restoring it on another computer brings every bill, goal and transaction with you.</p>' +
      '</div></section>' +

      '<section class="card">' + App.head('About', BRAND.name + ' ' + BRAND.tag + ' v1.0') +
      '<p class="small muted">A single self-contained file. Copy the folder anywhere — a USB stick, an external drive, a shared folder — and it still works. Built for people who want to see the whole picture without handing their data to an app store.</p>' +
      '<hr class="sep">' +
      '<div class="row between"><span class="small muted">Transactions stored</span><b class="num">' + DB.tx.length + '</b></div>' +
      '<div class="row between" style="margin-top:7px"><span class="small muted">Bills & income rules</span><b class="num">' + (DB.bills.length + DB.income.length) + '</b></div>' +
      '<div class="row between" style="margin-top:7px"><span class="small muted">Last updated</span><b class="num">' + (DB.updatedAt ? fmtDate(DB.updatedAt.slice(0, 10), 'medium') : '\u2014') + '</b></div>' +
      '<div class="row between" style="margin-top:7px"><span class="small muted">Current streak</span><b class="num">' + streaks() + ' days logging</b></div>' +
      '</section>' +

      '</div>';
  }
};
function settingSwitch(label, hint, key) {
  return '<div class="row between" style="gap:14px;padding:9px 0;border-top:1px solid var(--line-soft)">' +
    '<div style="min-width:0"><div class="small" style="font-weight:600">' + label + '</div><div class="tiny dim">' + hint + '</div></div>' +
    '<label class="switch"><input type="checkbox" data-field="setting" data-key="' + key + '"' + (DB.settings[key] ? ' checked' : '') + '><span class="slider"></span></label></div>';
}

/* ==========================================================================
   Shared actions for the views above
   ========================================================================== */
App.actions = Object.assign(App.actions, {

  /* --- view state --- */
  shiftMonth: function (el) {
    var dir = Number(el.dataset.dir) || 1;
    var which = el.dataset.id;
    if (which === 'cal') V.calMonth = addMonths(calMonth(), dir);
    else { V.spendMonth = addMonths(spendMonth(), dir); V.txLimit = 60; }
    App.render();
  },
  thisMonth: function (el) {
    if (el.dataset.id === 'cal') V.calMonth = startOfMonth(today());
    else { V.spendMonth = startOfMonth(today()); V.txLimit = 60; }
    App.render();
  },
  moreTx: function () { V.txLimit += 60; App.render(); },
  clearFilters: function () { V.txSearch = ''; V.txCat = ''; V.txType = ''; App.render(); },
  reportWindow: function (el) { V.reportWindow = Number(el.dataset.id) || 6; App.render(); },
  goalSort: function (el) { V.goalSort = el.dataset.id; App.render(); },
  dayDetail: function (el) {
    var key = el.dataset.id;
    var d = parseYMD(key);
    var tx = DB.tx.filter(function (t) { return String(t.date).slice(0, 10) === key; });
    var bills = billOccurrences(d, d);
    var inc = incomeOccurrences(d, d);
    var spent = sum(tx.filter(function (t) { return t.amount < 0; }), function (t) { return Math.abs(t.amount); });
    App.modal({
      title: fmtDate(d, 'day'),
      sub: (spent ? money(spent) + ' out · ' : '') + tx.length + ' transaction' + (tx.length === 1 ? '' : 's'),
      body:
        (bills.length ? '<div class="stack" style="margin-bottom:14px">' + bills.map(function (o) {
          return '<div class="alert ' + (o.paid ? 'good' : 'info') + '"><span class="em">' + (o.bill.icon || '\uD83D\uDCC5') + '</span>' +
            '<span><b>' + esc(o.bill.name) + '</b> ' + money(o.amount) + ' due' + (o.paid ? ' — paid' : '') + '</span>' +
            (o.paid ? '' : '<span style="margin-left:auto"><button class="btn xs primary" data-act="pay" data-id="' + o.bill.id + '" data-date="' + key + '">Pay</button></span>') + '</div>';
        }).join('') + '</div>' : '') +
        (inc.length ? '<div class="stack" style="margin-bottom:14px">' + inc.map(function (o) {
          return '<div class="alert good"><span class="em">\uD83D\uDCB0</span><span><b>' + esc(o.item.name) + '</b> +' + money(o.amount).replace('-', '') + ' expected</span></div>';
        }).join('') + '</div>' : '') +
        (tx.length ? '<div class="list">' + sortBy(tx, function (t) { return t.amount; }, 'desc').map(txRow).join('') + '</div>'
          : '<p class="small dim">Nothing logged on this day yet.</p>') +
        '<hr class="sep">' +
        '<div class="row wrap" style="gap:8px">' +
        '<button class="btn sm" data-act="addTx" data-id="' + key + '">' + svgIcon('plus', 14) + ' Add for this day</button>' +
        '</div>',
      foot: '<button class="btn" data-close>Close</button>'
    });
  },

  /* --- transactions --- */
  editTx: function (el) { App.editTx(el.dataset.id); },

  /* --- bills / subs --- */
  subToBill: function (el) {
    var s = detectSubscriptions().filter(function (x) { return x.key === el.dataset.id; })[0];
    if (!s) return;
    snapshot('track subscription');
    DB.bills.push({
      id: uid('bill'), name: s.name, amount: s.avg, freq: s.cadence, nextDate: ymd(addDays(today(), 3)),
      catId: 'subs', accountId: (DB.accounts[0] || {}).id || 'chk', icon: '\uD83D\uDD01', autopay: true, active: true, reminder: 3
    });
    save(); App.render();
    App.toast('Now tracking ' + esc(s.name) + ' — ' + money0(s.monthly) + '/mo', 'ok', 4500, function () { undo(); });
  },

  /* --- income --- */
  addIncome: function () { App.incomeForm(); },
  editIncome: function (el) { App.incomeForm(el.dataset.id); },

  /* --- debts --- */
  setStrategy: function (el) { V.debtStrategy = el.dataset.id; App.render(); },
  bumpExtra: function (el) { V.debtExtra = Math.min(5000, V.debtExtra + Number(el.dataset.id)); App.render(); },
  setExtra: function (el) { V.debtExtra = Number(el.dataset.id) || 0; App.render(); },
  focusDebt: function (el) {
    var d = byId(DB.debts, el.dataset.id);
    if (!d) return;
    V.debtStrategy = 'custom';
    App.render();
    App.toast('Extra payments now target ' + esc(d.name), 'ok', 3800);
  },
  addDebt: function () { App.debtForm(); },
  delDebt: function (el) {
    var d = byId(DB.debts, el.dataset.id);
    if (!d) return;
    App.confirm({
      title: 'Remove “' + esc(d.name) + '”?', body: 'The balance stops counting toward net worth and payoff plans.', danger: true, ok: 'Remove',
      onOk: function () {
        snapshot('remove debt');
        DB.debts = DB.debts.filter(function (x) { return x.id !== d.id; });
        save(); App.render(); App.toast('Removed', 'ok', 3800, function () { undo(); });
      }
    });
  },

  /* --- goals --- */
  addGoal: function () { App.goalForm(); },
  editGoal: function (el) { App.goalForm(el.dataset.id); },
  quickGoal: function (el) {
    snapshot('add goal');
    DB.goals.push({
      id: uid('goal'), name: el.dataset.id, target: 2000, saved: 0,
      date: ymd(addMonths(today(), 12)), icon: '\uD83C\uDFAF', color: '#38bdf8', monthly: 100, accountId: 'sav'
    });
    save(); App.goals_openLast();
  },
  contribute: function (el) {
    var g = byId(DB.goals, el.dataset.id);
    if (!g) return;
    var gi = goalInfo(g);
    App.modal({
      title: 'Add to ' + esc(g.name),
      sub: gi.remaining > 0 ? money(gi.remaining) + ' to go' : 'Already funded — nice.',
      body:
        '<label class="field"><span class="lb">Amount</span><input type="number" step="0.01" id="cAmt" value="' + Math.min(gi.monthly || 50, Math.max(0, gi.remaining) || 50) + '"></label>' +
        '<div class="row wrap" style="gap:8px;margin-top:12px">' +
        [25, 50, 100, 250].map(function (v) { return '<button class="btn xs" data-act="cQuick" data-id="' + v + '">+' + money0(v) + '</button>'; }).join('') +
        '</div>' +
        '<label class="check" style="margin-top:14px"><input type="checkbox" id="cLog" checked> Also log it as a transfer in my spending log</label>',
      foot: '<button class="btn" data-close>Cancel</button><button class="btn primary" id="cOk">Add money</button>',
      after: function (root) {
        root.querySelectorAll('[data-act=cQuick]').forEach(function (b) {
          b.onclick = function () { root.querySelector('#cAmt').value = (Number(root.querySelector('#cAmt').value) || 0) + Number(b.dataset.id); };
        });
        root.querySelector('#cOk').onclick = function () {
          var amt = Number(root.querySelector('#cAmt').value) || 0;
          snapshot('goal deposit');
          g.saved = r2((Number(g.saved) || 0) + amt);
          if (root.querySelector('#cLog').checked && amt > 0) {
            DB.tx.push({
              id: uid('tx'), date: ymd(today()), amount: -amt, catId: 'other', accountId: g.accountId || 'sav',
              note: g.name + ' deposit', tags: ['goal'], type: 'savings', cleared: true
            });
          }
          save(); App.closeModal(); App.render();
          App.toast(money(amt) + ' added to ' + esc(g.name), 'ok', 4500, function () { undo(); });
        };
      }
    });
  },
  goals_openLast: function () {
    App.goalsEditNewest = true;
    App.render();
    var g = DB.goals[DB.goals.length - 1];
    if (g) setTimeout(function () { App.goalForm(g.id); }, 60);
  },
  delGoal: function (el) {
    var g = byId(DB.goals, el.dataset.id);
    if (!g) return;
    App.confirm({
      title: 'Delete “' + esc(g.name) + '”?', body: 'Deposits already logged stay in your spending log.', danger: true, ok: 'Delete',
      onOk: function () {
        snapshot('delete goal');
        DB.goals = DB.goals.filter(function (x) { return x.id !== g.id; });
        save(); App.render(); App.toast('Goal deleted', 'ok', 4000, function () { undo(); });
      }
    });
  },

  /* --- settings --- */
  setTheme: function (el) { DB.settings.theme = el.dataset.id; App.applyTheme(); save(); App.render(); },
  afterCurrency: function () { DB.settings.locale = localeForCurrency(DB.settings.currency); save(); App.render(); },
  bufferLive: function () { },
  addAccount: function () {
    snapshot('add account');
    DB.accounts.push({ id: uid('acct'), name: 'New account', kind: 'checking', balance: 0, includeInSafe: true });
    save(); App.render();
  },
  delAccount: function (el) {
    if (DB.accounts.length <= 1) { App.toast('Keep at least one account', 'warn'); return; }
    snapshot('delete account');
    DB.accounts = DB.accounts.filter(function (a) { return a.id !== el.dataset.id; });
    save(); App.render(); App.toast('Account removed', 'ok', 4000, function () { undo(); });
  },
  snapshot: function () {
    snapshot('snapshot');
    DB.snaps.push({ date: ymd(today()), netWorth: netWorth() });
    save(); App.render();
    App.toast('Net-worth snapshot saved: ' + money(netWorth()), 'ok', 4000, function () { undo(); });
  },

  /* --- data --- */
  exportJson: function () {
    var name = (BRAND.name + '-backup-' + ymd(today()) + '.json').toLowerCase().replace(/\s+/g, '-');
    if (App.download(name, exportJSON(), 'application/json')) {
      DB.settings.lastBackup = ymd(today());
      save(true); App.render();
      App.toast('Backup downloaded — store it somewhere safe', 'ok', 5000);
    }
  },
  dismissBackup: function () {
    DB.settings.dismiss.backupNudge = true;
    save(); App.render();
    App.toast('Backup reminders off. Settings \u2192 Your data always has the button.', 'ok', 4500);
  },
  exportCsv: function (el) {
    var kind = el.dataset.id;
    var rows = [], name;
    if (kind === 'tx') {
      name = 'transactions-' + ymd(today()) + '.csv';
      rows.push(['Date', 'Type', 'Category', 'Note', 'Account', 'Amount', 'Tags']);
      sortBy(DB.tx, function (t) { return parseYMD(t.date).getTime(); }).forEach(function (t) {
        rows.push([ymd(parseYMD(t.date)), t.type || (t.amount > 0 ? 'income' : 'expense'), App.cat(t.catId).name,
        t.note || '', (byId(DB.accounts, t.accountId) || {}).name || '', t.amount, (t.tags || []).join(' ')]);
      });
    } else {
      name = 'monthly-summary-' + ymd(today()) + '.csv';
      rows.push(['Month', 'Income', 'Spending', 'Net', 'Savings rate %']);
      var keys = {};
      DB.tx.forEach(function (t) { keys[t.date.slice(0, 7)] = 1; });
      Object.keys(keys).sort().forEach(function (k) {
        var s = monthSummary(k.replace('-', ' ').slice(0, 7).replace(' ', '-'));
        var d0 = parseMonthKey(k);
        var s2 = monthSummary(monthKey(d0));
        rows.push([monthKey(d0), s2.income, s2.expense, s2.net, s2.income ? ((s2.net / s2.income) * 100).toFixed(1) : '']);
      });
    }
    var csv = rows.map(function (r) {
      return r.map(function (c) {
        var v = String(c === undefined || c === null ? '' : c);
        return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(',');
    }).join('\n');
    if (App.download(name, csv, 'text/csv;charset=utf-8')) App.toast('CSV exported — opens straight in Excel or Sheets', 'ok', 5000);
  },
  importJson: function () {
    var input = document.createElement('input');
    input.type = 'file'; input.accept = '.json,application/json';
    input.onchange = function () {
      var file = input.files && input.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          snapshot('restore');
          importJSON(String(reader.result));
          App.applyTheme();
          document.body.classList.toggle('privacy', !!DB.settings.privacy);
          App.render();
          App.toast('Backup restored', 'ok', 5000, function () { undo(); });
        } catch (e) {
          App.toast('That file could not be read as a ' + BRAND.name + ' backup.', 'err', 6000);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  },
  wipe: function () {
    App.confirm({
      title: 'Erase everything?',
      body: 'Every transaction, bill, goal and setting in this browser is deleted. Download a backup first if there is any chance you want it back.',
      danger: true, ok: 'Erase it all',
      onOk: function () {
        snapshot('wipe');
        try { localStorage.removeItem(STORAGE_KEY); } catch (e) { }
        resetBlank();
        App.render();
        App.toast('Erased. The studio is empty.', 'ok', 6000, function () { undo(); });
      }
    });
  },
  printReport: function () { window.print(); }
});

/* ------------------------------------------------------------------ forms */
App.incomeForm = function (id) {
  var i = id ? byId(DB.income, id) : null;
  var newId = uid('inc');
  var accts = DB.accounts.map(function (a) {
    return '<option value="' + a.id + '"' + ((i && i.accountId === a.id) || (!i && a.id === 'chk') ? ' selected' : '') + '>' + esc(a.name) + '</option>';
  }).join('');
  var freqs = FREQ.map(function (f) { return '<option value="' + f.id + '"' + (i && i.freq === f.id ? ' selected' : '') + '>' + f.label + '</option>'; }).join('');
  App.modal({
    title: i ? 'Edit income' : 'Add income',
    sub: 'Salaried, freelance, benefits, side hustles — anything that arrives on a schedule.',
    body:
      '<div class="grid g-2" style="gap:12px">' +
      '<label class="field" style="grid-column:1/-1"><span class="lb">Source</span><input type="text" id="iName" value="' + (i ? esc(i.name) : '') + '" placeholder="Paycheck — Day Job"></label>' +
      '<label class="field"><span class="lb">Amount per payment</span><input type="number" step="0.01" id="iAmt" value="' + (i ? i.amount : '') + '"></label>' +
      '<label class="field"><span class="lb">Arrives</span><select id="iFreq">' + freqs + '</select></label>' +
      '<label class="field"><span class="lb">Next date</span><input type="date" id="iDate" value="' + (i ? String(i.nextDate).slice(0, 10) : ymd(addDays(today(), 14))) + '"></label>' +
      '<label class="field"><span class="lb">Deposited into</span><select id="iAcct">' + accts + '</select></label>' +
      '</div>' +
      '<label class="check" style="margin-top:14px"><input type="checkbox" id="iVar"' + (i && i.variable ? ' checked' : '') + '> Amount changes each time</label>',
    foot: '<button class="btn" data-close>Cancel</button><button class="btn primary" id="iOk">' + (i ? 'Save' : 'Add income') + '</button>',
    after: function (root) {
      root.querySelector('#iOk').onclick = function () {
        var name = root.querySelector('#iName').value.trim();
        var amt = Number(root.querySelector('#iAmt').value) || 0;
        if (!name || !amt) { App.toast('Name and amount required', 'warn'); return; }
        snapshot(i ? 'edit income' : 'add income');
        var payload = {
          name: name, amount: amt, freq: root.querySelector('#iFreq').value,
          nextDate: root.querySelector('#iDate').value, accountId: root.querySelector('#iAcct').value,
          active: true, variable: root.querySelector('#iVar').checked
        };
        if (i) { for (var k in payload) i[k] = payload[k]; } else { payload.id = newId; DB.income.push(payload); }
        save(); App.closeModal(); App.render();
        App.toast(i ? 'Income updated' : 'Income added', 'ok', 4500, function () { undo(); });
      };
    }
  });
};

App.debtForm = function (id) {
  var d = id ? byId(DB.debts, id) : null;
  var newId = uid('dbt');
  App.modal({
    title: d ? 'Edit debt' : 'Add a debt',
    sub: 'Credit cards, loans, buy-now-pay-later, money owed to family — all fair game.',
    body:
      '<div class="grid g-2" style="gap:12px">' +
      '<label class="field"><span class="lb">Name</span><input type="text" id="dName" value="' + (d ? esc(d.name) : '') + '" placeholder="Rewards Card"></label>' +
      '<label class="field"><span class="lb">Icon</span><input type="text" id="dIcon" maxlength="4" value="' + (d ? esc(d.icon || '') : '\uD83D\uDCB3') + '"></label>' +
      '<label class="field"><span class="lb">Current balance</span><input type="number" step="0.01" id="dBal" value="' + (d ? d.balance : '') + '"></label>' +
      '<label class="field"><span class="lb">Interest rate % APR</span><input type="number" step="0.01" id="dApr" value="' + (d ? (d.apr || 0) : '') + '"></label>' +
      '<label class="field"><span class="lb">Minimum payment</span><input type="number" step="0.01" id="dMin" value="' + (d ? d.minPayment : '') + '"></label>' +
      '<label class="field"><span class="lb">Due day of month</span><input type="number" min="1" max="31" id="dDue" value="' + (d ? (d.dueDay || 1) : 15) + '"></label>' +
      '</div>',
    foot: '<button class="btn" data-close>Cancel</button><button class="btn primary" id="dOk">' + (d ? 'Save' : 'Add debt') + '</button>',
    after: function (root) {
      root.querySelector('#dOk').onclick = function () {
        var name = root.querySelector('#dName').value.trim();
        if (!name) { App.toast('Give it a name', 'warn'); return; }
        snapshot(d ? 'edit debt' : 'add debt');
        var payload = {
          name: name, icon: root.querySelector('#dIcon').value, balance: Number(root.querySelector('#dBal').value) || 0,
          apr: Number(root.querySelector('#dApr').value) || 0, minPayment: Number(root.querySelector('#dMin').value) || 0,
          dueDay: Math.min(31, Math.max(1, Number(root.querySelector('#dDue').value) || 1)), extra: 0
        };
        if (d) { for (var k in payload) d[k] = payload[k]; } else { payload.id = newId; DB.debts.push(payload); }
        save(); App.closeModal(); App.render();
        App.toast(d ? 'Debt updated' : 'Debt added — check the payoff planner', 'ok', 4500, function () { undo(); });
      };
    }
  });
};

App.goalForm = function (id) {
  var g = id ? byId(DB.goals, id) : null;
  var newId = uid('goal');
  App.modal({
    title: g ? 'Edit goal' : 'New savings goal',
    sub: 'Name it, price it, and give it a monthly deposit.',
    body:
      '<div class="grid g-2" style="gap:12px">' +
      '<label class="field" style="grid-column:1/-1"><span class="lb">What are you saving for?</span><input type="text" id="gName" value="' + (g ? esc(g.name) : '') + '" placeholder="Emergency Fund"></label>' +
      '<label class="field"><span class="lb">Target amount</span><input type="number" step="0.01" id="gTarget" value="' + (g ? g.target : '') + '"></label>' +
      '<label class="field"><span class="lb">Already saved</span><input type="number" step="0.01" id="gSaved" value="' + (g ? g.saved : 0) + '"></label>' +
      '<label class="field"><span class="lb">Monthly deposit</span><input type="number" step="0.01" id="gMonthly" value="' + (g ? (g.monthly || '') : '') + '" placeholder="150"></label>' +
      '<label class="field"><span class="lb">Target date</span><input type="date" id="gDate" value="' + (g && g.date ? String(g.date).slice(0, 10) : ymd(addMonths(today(), 12))) + '"></label>' +
      '<label class="field"><span class="lb">Icon</span><input type="text" id="gIcon" maxlength="4" value="' + (g ? esc(g.icon || '') : '\uD83C\uDFAF') + '"></label>' +
      '<label class="field"><span class="lb">Colour</span><input type="color" id="gColor" value="' + (g ? g.color : '#38bdf8') + '" style="padding:4px"></label>' +
      '</div>',
    foot: '<button class="btn" data-close>Cancel</button><button class="btn primary" id="gOk">' + (g ? 'Save' : 'Create goal') + '</button>',
    after: function (root) {
      root.querySelector('#gOk').onclick = function () {
        var name = root.querySelector('#gName').value.trim();
        var target = Number(root.querySelector('#gTarget').value) || 0;
        if (!name || !target) { App.toast('Name and target are required', 'warn'); return; }
        snapshot(g ? 'edit goal' : 'add goal');
        var payload = {
          name: name, target: target, saved: Number(root.querySelector('#gSaved').value) || 0,
          monthly: Number(root.querySelector('#gMonthly').value) || 0, date: root.querySelector('#gDate').value,
          icon: root.querySelector('#gIcon').value, color: root.querySelector('#gColor').value, accountId: 'sav'
        };
        if (g) { for (var k in payload) g[k] = payload[k]; } else { payload.id = newId; DB.goals.push(payload); }
        save(); App.closeModal(); App.render();
        App.toast(g ? 'Goal updated' : 'Goal created', 'ok', 4500, function () { undo(); });
      };
    }
  });
};

/* --- delegated view-field inputs (search boxes, filters, sliders) --- */
document.addEventListener('input', function (e) {
  var el = e.target;
  if (el.dataset && el.dataset.viewField) {
    V[el.dataset.viewField] = el.value;
    if (el.dataset.viewField === 'txSearch' && el.value.length > 0) { /* live filter */ }
    App.render();
    return;
  }
  if (el.dataset && el.dataset.act === 'setExtraLive') {
    V.debtExtra = Number(el.value) || 0;
  }
});
document.addEventListener('change', function (e) {
  var el = e.target;
  if (el.dataset && el.dataset.act === 'setExtraLive') {
    V.debtExtra = Number(el.value) || 0;
    App.render();
  }
  if (el.dataset && el.dataset.act === 'bufferLive') {
    DB.settings.safetyBuffer = Number(el.value) || 0;
    save(); App.render();
  }
});
