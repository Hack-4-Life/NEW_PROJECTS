/* ============================================================================
   Waypoint Budget Studio — App shell
   Routing, rendering, modals, toasts, quick-add, onboarding, guided tour.
   ========================================================================== */
'use strict';

var BRAND = { name: 'Waypoint', tag: 'Budget Studio' };
var ROUTE_KEY = 'waypoint.route';

var ICON = {
  today: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><circle cx="12" cy="12" r="5"/>',
  spend: '<path d="M3 7h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M3 10h18M7 15h3"/>',
  bills: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z"/><path d="M9 8h6M9 12h6"/>',
  debts: '<path d="M3 6h18v12H3z"/><path d="M3 10h18"/><path d="M7 15h4"/>',
  goals: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/>',
  reports: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M4.2 7l2.6 1.5M17.2 15.5l2.6 1.5M4.2 17l2.6-1.5M17.2 8.5l2.6-1.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  chevL: '<path d="m15 18-6-6 6-6"/>',
  chevR: '<path d="m9 18 6-6-6-6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>',
  down: '<path d="M12 3v14M6 12l6 6 6-6M4 21h16"/>',
  up: '<path d="M12 21V7M6 12l6-6 6 6M4 3h16"/>',
  warn: '<path d="M10.3 4.3 2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>'
};
function svgIcon(name, size) {
  return '<svg viewBox="0 0 24 24" width="' + (size || 18) + '" height="' + (size || 18) +
    '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    (ICON[name] || '') + '</svg>';
}

var THEMES = [
  { id: 'midnight', label: 'Midnight', swatch: '#f5c451' },
  { id: 'vault', label: 'Vault', swatch: '#34d399' },
  { id: 'blush', label: 'Blush', swatch: '#f472b6' },
  { id: 'daylight', label: 'Daylight', swatch: '#4f46e5' },
  { id: 'paper', label: 'Paper', swatch: '#b45309' }
];

var App = {
  route: 'today',
  views: {},
  actions: {},
  hooks: [],
  _chartData: {},

  /* ------------------------------------------------------------- lifecycle */
  init: function () {
    var res = load();
    this.applyTheme();
    document.body.classList.toggle('privacy', !!DB.settings.privacy);
    try { this.route = localStorage.getItem(ROUTE_KEY) || 'today'; } catch (e) { }
    if (!this.views[this.route]) this.route = 'today';

    this.bindGlobal();
    this.render();

    if (res.corrupt) this.toast('That budget file looked damaged — started a fresh one. Old copy kept in your browser.', 'warn', 9000);
    if (!DB.done.welcome) {
      var self = this;
      setTimeout(function () { self.onboard(); }, 380);
    } else if (!DB.done.tour && DB.tx.length) {
      var s2 = this;
      setTimeout(function () { s2.startTour(); }, 700);
    }
  },

  applyTheme: function () {
    var t = DB.settings.theme || 'midnight';
    document.documentElement.setAttribute('data-theme', t);
    var meta = document.querySelector('meta[name=color-scheme]');
    if (meta) meta.setAttribute('content', (t === 'daylight' || t === 'paper') ? 'light dark' : 'dark light');
  },

  bindGlobal: function () {
    var self = this;

    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-act]');
      if (t && self.actions[t.dataset.act]) {
        if (t.tagName === 'BUTTON' && t.type !== 'submit') e.preventDefault();
        self.actions[t.dataset.act](t, e);
        return;
      }
      var close = e.target.closest('[data-close]');
      if (close) { self.closeModal(); return; }
      if (e.target.id === 'modal-root' || e.target.classList.contains('scrim')) self.closeModal();
    });

    document.addEventListener('change', function (e) {
      var el = e.target;
      if (el.dataset && el.dataset.field) {
        self.commitField(el);
      }
    });
    document.addEventListener('input', function (e) {
      var el = e.target;
      if (el.dataset && el.dataset.live) {
        var out = document.getElementById(el.dataset.live);
        if (out) out.textContent = el.dataset.liveFmt === 'money' ? money(Number(el.value)) : el.value;
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { self.closeModal(); self.endTour(); }
      if (e.key === 'n' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); self.actions.addTx(); }
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        var q = document.getElementById('qaInput'); if (q) q.focus();
      }
      if (e.key === 'z' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); undo(); }
    });

    var qa = document.getElementById('quickAdd');
    qa.addEventListener('submit', function (e) {
      e.preventDefault();
      var inp = document.getElementById('qaInput');
      self.quickAdd(inp.value);
      inp.value = '';
    });
  },

  /* --------------------------------------------------- field binding layer */
  commitField: function (el) {
    var f = el.dataset.field, id = el.dataset.id || el.dataset.idx;
    var v = el.type === 'checkbox' ? el.checked : el.value;
    if (el.type === 'number' || el.dataset.num !== undefined) v = Number(v) || 0;
    var target = null;
    switch (f) {
      case 'setting': target = DB.settings; break;
      case 'cat': target = byId(DB.cats, id); break;
      case 'account': target = byId(DB.accounts, id); break;
      case 'bill': target = byId(DB.bills, id); break;
      case 'income': target = byId(DB.income, id); break;
      case 'debt': target = byId(DB.debts, id); break;
      case 'goal': target = byId(DB.goals, id); break;
      case 'tx': target = byId(DB.tx, id); break;
      default: target = DB.settings;
    }
    if (!target) return;
    var key = el.dataset.key;
    if (key) target[key] = v;
    else target[f] = v;
    if (el.dataset.after && this.actions[el.dataset.after]) { this.actions[el.dataset.after](el); return; }
    save();
    this.render();
  },

  /* --------------------------------------------------------------- routing */
  go: function (route) {
    if (!this.views[route]) return;
    this.route = route;
    try { localStorage.setItem(ROUTE_KEY, route); } catch (e) { }
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    this.closeModal();
    this.render();
  },

  focusKey: function (el) {
    if (!el || !el.dataset) return null;
    return [el.dataset.field, el.dataset.key, el.dataset.id || el.dataset.idx, el.tagName, el.type].join('|');
  },

  render: function () {
    var active = document.activeElement;
    var key = this.focusKey(active);
    var scroll = window.scrollY, selStart = null;
    if (active && active.setSelectionRange) { try { selStart = active.selectionStart; } catch (e) { } }

    this.renderNav();
    this.renderSidebar();

    var view = this.views[this.route] || this.views.today;
    document.getElementById('pageTitle').textContent = typeof view.title === 'function' ? view.title() : view.title;
    document.getElementById('pageCrumb').textContent = typeof view.crumb === 'function' ? view.crumb() : (view.crumb || '');
    this._chartData = {};
    document.getElementById('view').innerHTML = view.html();
    this.hooks = [];
    if (view.after) view.after();

    if (key) {
      var found = null;
      var all = document.querySelectorAll('[data-field]');
      for (var i = 0; i < all.length; i++) { if (this.focusKey(all[i]) === key) { found = all[i]; break; } }
      if (found) {
        found.focus();
        if (selStart !== null && found.setSelectionRange) { try { found.setSelectionRange(selStart, selStart); } catch (e) { } }
      } else { window.scrollTo(0, scroll); }
    }
  },

  renderNav: function () {
    var items = ['today', 'spend', 'bills', 'debts', 'goals', 'calendar', 'reports', 'settings'];
    var labels = { today: 'Today', spend: 'Spend', bills: 'Bills', debts: 'Debts', goals: 'Goals', calendar: 'Calendar', reports: 'Reports', settings: 'Settings' };
    var self = this;
    var dueCount = billOccurrences(today(), nextPayday(today())).filter(function (o) { return !o.paid; }).length;
    var env = envelopes().filter(function (e) { return e.over; }).length;
    var badgeFor = { bills: dueCount, spend: env };
    var html = items.map(function (k) {
      var b = badgeFor[k];
      return '<button class="nav-item' + (self.route === k ? ' on' : '') + '" data-act="go" data-view="' + k + '">' +
        svgIcon(k) + '<span>' + labels[k] + '</span>' +
        (b ? '<span class="badge' + (k === 'spend' ? '' : ' soft') + '">' + b + '</span>' : '') + '</button>';
    }).join('');
    document.getElementById('nav').innerHTML = html;

    var tabs = ['today', 'spend', 'bills', 'debts', 'goals'];
    document.getElementById('tabbar').innerHTML = tabs.map(function (k) {
      return '<button class="' + (self.route === k ? 'on' : '') + '" data-act="go" data-view="' + k + '">' +
        svgIcon(k, 19) + '<span>' + labels[k] + '</span></button>';
    }).join('');

    document.getElementById('brandName').textContent = BRAND.name;
  },

  renderSidebar: function () {
    var sts = safeToSpend();
    var days = diffDays(today(), sts.payday);
    var due = sts.billsList.length;
    document.getElementById('sidePayday').innerHTML =
      '<div class="lbl">Next payday</div>' +
      '<div class="big num">' + fmtDate(sts.payday, 'short') + '</div>' +
      '<div class="sub">' + (days === 0 ? 'Today — money in!' : days === 1 ? 'Tomorrow' : 'in ' + days + ' days') + '</div>' +
      '<div class="count">' + svgIcon('bills', 13) + due + ' bill' + (due === 1 ? '' : 's') + ' · ' + money0(sts.bills) + '</div>';
  },

  /* ---------------------------------------------------------------- views
     Component helpers used by every view                                     */
  M: function (v, cls) { return '<span class="amt' + (cls ? ' ' + cls : '') + '">' + money(v) + '</span>'; },
  cat: function (id) {
    return byId(DB.cats, id) || { id: id, name: id === 'income' ? 'Income' : 'Other', icon: '\uD83D\uDCE6', color: 'var(--muted)' };
  },
  catChip: function (id) {
    var c = this.cat(id);
    return '<span class="chip ghost" style="color:' + c.color + '">' + c.icon + ' ' + esc(c.name) + '</span>';
  },
  empty: function (em, title, sub, action) {
    return '<div class="empty"><div class="em">' + em + '</div><b>' + esc(title) + '</b>' +
      '<span class="small">' + esc(sub) + '</span>' + (action || '') + '</div>';
  },
  head: function (t, s, right, id) {
    return '<div class="card-head"' + (id ? ' data-tour="' + id + '"' : '') + '><div><div class="t">' + t + '</div>' +
      (s ? '<div class="s">' + s + '</div>' : '') + '</div><div class="right">' + (right || '') + '</div></div>';
  },
  chip: function (text, kind) { return '<span class="chip ' + (kind || '') + '">' + text + '</span>'; },

  /* ----------------------------------------------------------- quick add */
  quickAdd: function (text) {
    var d = parseQuickAdd(text);
    if (!d.amount) { this.toast('Add an amount — e.g. "12.50 coffee"', 'warn'); return; }
    if (!d.catId) d.catId = d.type === 'income' ? 'income' : 'other';
    if (!d.accountId) d.accountId = (DB.accounts[0] || {}).id || 'chk';
    var tx = {
      id: uid('tx'), date: d.date, amount: d.type === 'income' ? d.amount : -d.amount,
      catId: d.catId, accountId: d.accountId, note: d.note || this.cat(d.catId).name,
      tags: ['quick'], type: d.type, cleared: true
    };
    snapshot('quick add');
    DB.tx.push(tx);
    var acct = byId(DB.accounts, d.accountId);
    if (acct && acct.kind !== 'credit') acct.balance = r2((Number(acct.balance) || 0) + tx.amount);
    save();
    this.render();
    var self = this;
    this.toast((tx.amount < 0 ? 'Logged ' : 'Added ') + money(Math.abs(tx.amount)) + ' \u2192 ' + this.cat(tx.catId).name, 'ok', 6000,
      function () { undo(); });
  },

  /* --------------------------------------------------------------- toasts */
  toast: function (msg, kind, ms, undoFn) {
    var root = document.getElementById('toast-root');
    var el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.innerHTML = '<span>' + msg + '</span>';
    if (undoFn) {
      var b = document.createElement('button');
      b.className = 'undo'; b.textContent = 'Undo';
      b.onclick = function () { undoFn(); el.remove(); };
      el.appendChild(b);
    }
    root.appendChild(el);
    setTimeout(function () {
      el.classList.add('out');
      setTimeout(function () { el.remove(); }, 260);
    }, ms || 3200);
  },

  /* --------------------------------------------------------------- modals */
  modal: function (o) {
    var root = document.getElementById('modal-root');
    root.innerHTML =
      '<div class="scrim"></div>' +
      '<div class="modal' + (o.wide ? ' wide' : '') + '" role="dialog" aria-modal="true">' +
      '<button class="modal-x" data-close aria-label="Close">' + svgIcon('x') + '</button>' +
      (o.title ? '<h3>' + o.title + '</h3>' : '') +
      (o.sub ? '<div class="sub">' + o.sub + '</div>' : '') +
      '<div class="modal-body">' + (o.body || '') + '</div>' +
      (o.foot ? '<div class="modal-foot">' + o.foot + '</div>' : '') +
      '</div>';
    root.classList.add('open');
    if (o.after) o.after(root);
    var f = root.querySelector('input,select,textarea,button.primary');
    if (f && !o.noFocus) setTimeout(function () { try { f.focus(); if (f.select) f.select(); } catch (e) { } }, 60);
    return root;
  },
  closeModal: function () {
    var root = document.getElementById('modal-root');
    root.classList.remove('open');
    root.innerHTML = '';
  },
  confirm: function (o) {
    var self = this;
    this.modal({
      title: o.title || 'Are you sure?',
      body: '<p class="small muted">' + (o.body || '') + '</p>',
      foot: '<button class="btn" data-close>Cancel</button>' +
        '<button class="btn ' + (o.danger ? 'danger' : 'primary') + '" id="cfmOk">' + (o.ok || 'Confirm') + '</button>',
      after: function (root) {
        root.querySelector('#cfmOk').onclick = function () { self.closeModal(); o.onOk && o.onOk(); };
      }
    });
  },

  /* ------------------------------------------------------------- finances */
  addTx: function () {
    var self = this;
    var d = ymd(today());
    var cats = DB.cats.map(function (c) { return '<option value="' + c.id + '">' + c.icon + ' ' + esc(c.name) + '</option>'; }).join('');
    var accts = DB.accounts.map(function (a) { return '<option value="' + a.id + '">' + esc(a.name) + '</option>'; }).join('');
    this.modal({
      title: 'Log a transaction',
      sub: 'Expenses are negative, income is positive. Categories drive your envelopes.',
      body:
        '<div class="grid g-2" style="gap:12px">' +
        '<label class="field"><span class="lb">Amount</span><input type="number" step="0.01" id="txAmount" placeholder="0.00" inputmode="decimal"></label>' +
        '<label class="field"><span class="lb">Type</span><select id="txType"><option value="expense">Expense (money out)</option><option value="income">Income (money in)</option></select></label>' +
        '<label class="field"><span class="lb">Date</span><input type="date" id="txDate" value="' + d + '"></label>' +
        '<label class="field"><span class="lb">Account</span><select id="txAcct">' + accts + '</select></label>' +
        '<label class="field" style="grid-column:1/-1"><span class="lb">Note / merchant</span><input type="text" id="txNote" placeholder="Trader Joe\'s"></label>' +
        '<label class="field" style="grid-column:1/-1"><span class="lb">Category</span><select id="txCat">' + cats + '</select></label>' +
        '</div>' +
        '<label class="check" style="margin-top:14px"><input type="checkbox" id="txAdjust" checked> Also adjust the account balance</label>',
      foot: '<button class="btn" data-close>Cancel</button><button class="btn primary" id="txSave">Save transaction</button>',
      after: function (root) {
        root.querySelector('#txSave').onclick = function () {
          var amt = Math.abs(Number(root.querySelector('#txAmount').value) || 0);
          if (!amt) { self.toast('Enter an amount first', 'warn'); return; }
          var type = root.querySelector('#txType').value;
          var tx = {
            id: uid('tx'), date: root.querySelector('#txDate').value || d,
            amount: type === 'income' ? amt : -amt,
            catId: type === 'income' ? 'income' : root.querySelector('#txCat').value,
            accountId: root.querySelector('#txAcct').value,
            note: root.querySelector('#txNote').value || (type === 'income' ? 'Income' : self.cat(root.querySelector('#txCat').value).name),
            tags: [], type: type, cleared: true
          };
          snapshot('new transaction');
          DB.tx.push(tx);
          if (root.querySelector('#txAdjust').checked) {
            var a = byId(DB.accounts, tx.accountId);
            if (a) a.balance = r2((Number(a.balance) || 0) + tx.amount);
          }
          save(); self.closeModal(); self.render();
          self.toast('Transaction saved', 'ok', 5000, function () { undo(); });
        };
      }
    });
  },

  editTx: function (id) {
    var tx = byId(DB.tx, id);
    if (!tx) return;
    var self = this;
    var cats = DB.cats.map(function (c) {
      return '<option value="' + c.id + '"' + (c.id === tx.catId ? ' selected' : '') + '>' + c.icon + ' ' + esc(c.name) + '</option>';
    }).join('');
    var accts = DB.accounts.map(function (a) {
      return '<option value="' + a.id + '"' + (a.id === tx.accountId ? ' selected' : '') + '>' + esc(a.name) + '</option>';
    }).join('');
    this.modal({
      title: 'Edit transaction',
      body:
        '<div class="grid g-2" style="gap:12px">' +
        '<label class="field"><span class="lb">Amount (use \u2212 for expense)</span><input type="number" step="0.01" id="exAmt" value="' + tx.amount + '"></label>' +
        '<label class="field"><span class="lb">Date</span><input type="date" id="exDate" value="' + String(tx.date).slice(0, 10) + '"></label>' +
        '<label class="field" style="grid-column:1/-1"><span class="lb">Note</span><input type="text" id="exNote" value="' + esc(tx.note) + '"></label>' +
        '<label class="field"><span class="lb">Category</span><select id="exCat">' + cats + '</select></label>' +
        '<label class="field"><span class="lb">Account</span><select id="exAcct">' + accts + '</select></label>' +
        '</div>',
      foot: '<button class="btn danger" id="exDel">Delete</button><span style="flex:1"></span>' +
        '<button class="btn" data-close>Cancel</button><button class="btn primary" id="exSave">Save changes</button>',
      after: function (root) {
        root.querySelector('#exSave').onclick = function () {
          snapshot('edit');
          tx.amount = Number(root.querySelector('#exAmt').value) || 0;
          tx.date = root.querySelector('#exDate').value;
          tx.note = root.querySelector('#exNote').value;
          tx.catId = root.querySelector('#exCat').value;
          tx.accountId = root.querySelector('#exAcct').value;
          tx.type = tx.amount >= 0 ? 'income' : 'expense';
          save(); self.closeModal(); self.render();
          self.toast('Updated', 'ok', 5000, function () { undo(); });
        };
        root.querySelector('#exDel').onclick = function () {
          snapshot('delete');
          DB.tx = DB.tx.filter(function (x) { return x.id !== id; });
          save(); self.closeModal(); self.render();
          self.toast('Deleted', 'ok', 5000, function () { undo(); });
        };
      }
    });
  },

  /* ---------------------------------------------------------- bill helpers */
  paidState: function (billId, date) {
    var v = DB.paid[occurrenceKey(billId, date)];
    if (!v) return null;
    return v === 'skip' ? 'skip' : 'paid';
  },

  payBill: function (billId, dateStr) {
    var bill = byId(DB.bills, billId);
    if (!bill) return;
    var self = this;
    var dt = dateStr || ymd(today());
    var accts = DB.accounts.map(function (a) { return '<option value="' + a.id + '"' + (a.id === bill.accountId ? ' selected' : '') + '>' + esc(a.name) + '</option>'; }).join('');
    this.modal({
      title: 'Mark paid — ' + esc(bill.name),
      sub: 'Recorded against ' + fmtDate(dt, 'medium') + '. Due ' + money(bill.amount) + '.',
      body:
        '<div class="grid g-2" style="gap:12px">' +
        '<label class="field"><span class="lb">Amount paid</span><input type="number" step="0.01" id="pbAmt" value="' + bill.amount + '"></label>' +
        '<label class="field"><span class="lb">Date paid</span><input type="date" id="pbDate" value="' + dt + '"></label>' +
        '<label class="field" style="grid-column:1/-1"><span class="lb">Paid from</span><select id="pbAcct">' + accts + '</select></label>' +
        '</div>' +
        '<label class="check" style="margin-top:14px"><input type="checkbox" id="pbLog" checked> Add it to my spending log</label>',
      foot: '<button class="btn" data-close>Cancel</button>' +
        '<button class="btn" id="pbSkip">Skip this month</button>' +
        '<button class="btn primary" id="pbOk">Mark paid</button>',
      after: function (root) {
        root.querySelector('#pbOk').onclick = function () {
          var amt = Number(root.querySelector('#pbAmt').value) || bill.amount;
          var when = root.querySelector('#pbDate').value || dt;
          snapshot('bill payment');
          var d0 = parseYMD(when);
          DB.paid[occurrenceKey(bill.id, parseYMD(dt))] = when;
          if (root.querySelector('#pbLog').checked) {
            var acctId = root.querySelector('#pbAcct').value;
            DB.tx.push({
              id: uid('tx'), date: when, amount: -Math.abs(amt), catId: bill.catId,
              accountId: acctId, note: bill.name, tags: ['bill'], type: 'expense', cleared: true
            });
            var a = byId(DB.accounts, acctId);
            if (a && a.kind !== 'credit') a.balance = r2((Number(a.balance) || 0) - Math.abs(amt));
          }
          if (bill.freq === 'bimonthly') { /* no auto-advance for multi-month cycles */ }
          save(); self.closeModal(); self.render();
          self.toast(esc(bill.name) + ' marked paid', 'ok', 5000, function () { undo(); });
        };
        root.querySelector('#pbSkip').onclick = function () {
          snapshot('skip');
          DB.paid[occurrenceKey(bill.id, parseYMD(dt))] = 'skip';
          save(); self.closeModal(); self.render();
          self.toast('Skipped this cycle', 'ok', 4000, function () { undo(); });
        };
      }
    });
  },

  billForm: function (id) {
    var b = id ? byId(DB.bills, id) : null;
    var self = this;
    var newId = uid('bill');
    var cats = DB.cats.map(function (c) {
      return '<option value="' + c.id + '"' + (b && b.catId === c.id ? ' selected' : '') + '>' + c.icon + ' ' + esc(c.name) + '</option>';
    }).join('');
    var accts = DB.accounts.map(function (a) {
      return '<option value="' + a.id + '"' + ((b && b.accountId === a.id) || (!b && a.id === 'chk') ? ' selected' : '') + '>' + esc(a.name) + '</option>';
    }).join('');
    var freqs = FREQ.map(function (f) {
      return '<option value="' + f.id + '"' + (b && b.freq === f.id ? ' selected' : '') + '>' + f.label + '</option>';
    }).join('');
    this.modal({
      title: b ? 'Edit bill' : 'New recurring bill',
      sub: b ? '' : 'Anything that repeats: rent, utilities, subscriptions, insurance, daycare.',
      body:
        '<div class="grid g-2" style="gap:12px">' +
        '<label class="field" style="grid-column:1/-1"><span class="lb">Bill name</span><input type="text" id="bName" value="' + (b ? esc(b.name) : '') + '" placeholder="Rent"></label>' +
        '<label class="field"><span class="lb">Amount</span><input type="number" step="0.01" id="bAmt" value="' + (b ? b.amount : '') + '" placeholder="0.00"></label>' +
        '<label class="field"><span class="lb">Icon (optional emoji)</span><input type="text" id="bIcon" maxlength="4" value="' + (b ? esc(b.icon || '') : '') + '" placeholder="\uD83C\uDFE0"></label>' +
        '<label class="field"><span class="lb">Repeats</span><select id="bFreq">' + freqs + '</select></label>' +
        '<label class="field"><span class="lb">Next due date</span><input type="date" id="bDate" value="' + (b ? String(b.nextDate).slice(0, 10) : ymd(addDays(today(), 7))) + '"></label>' +
        '<label class="field"><span class="lb">Category</span><select id="bCat">' + cats + '</select></label>' +
        '<label class="field"><span class="lb">Paid from</span><select id="bAcct">' + accts + '</select></label>' +
        '</div>' +
        '<div class="row wrap" style="margin-top:14px;gap:18px">' +
        '<label class="check"><input type="checkbox" id="bAuto"' + (b && b.autopay ? ' checked' : '') + '> On autopay</label>' +
        '<label class="check"><input type="checkbox" id="bVar"' + (b && b.variable ? ' checked' : '') + '> Amount varies each cycle</label>' +
        '</div>',
      foot: '<button class="btn" data-close>Cancel</button><button class="btn primary" id="bSave">' + (b ? 'Save' : 'Add bill') + '</button>',
      after: function (root) {
        root.querySelector('#bSave').onclick = function () {
          var name = root.querySelector('#bName').value.trim();
          var amt = Number(root.querySelector('#bAmt').value) || 0;
          if (!name || !amt) { self.toast('Name and amount are required', 'warn'); return; }
          snapshot(b ? 'edit bill' : 'new bill');
          var payload = {
            name: name, amount: amt, freq: root.querySelector('#bFreq').value,
            nextDate: root.querySelector('#bDate').value, catId: root.querySelector('#bCat').value,
            accountId: root.querySelector('#bAcct').value, icon: root.querySelector('#bIcon').value,
            autopay: root.querySelector('#bAuto').checked, variable: root.querySelector('#bVar').checked,
            active: true, reminder: 3
          };
          if (b) { for (var k in payload) b[k] = payload[k]; }
          else { payload.id = newId; DB.bills.push(payload); }
          save(); self.closeModal(); self.render();
          self.toast(b ? 'Bill updated' : 'Bill added', 'ok', 5000, function () { undo(); });
        };
      }
    });
  },

  /* -------------------------------------------------------------- budgets */
  editCats: function () {
    var self = this;
    var rows = DB.cats.map(function (c) {
      return '<tr><td><input type="text" data-field="cat" data-key="name" data-id="' + c.id + '" value="' + esc(c.name) + '" style="height:34px"></td>' +
        '<td class="hide-xs"><input type="text" data-field="cat" data-key="icon" data-id="' + c.id + '" value="' + esc(c.icon) + '" style="height:34px;width:56px;text-align:center"></td>' +
        '<td><input type="number" data-field="cat" data-key="cap" data-id="' + c.id + '" value="' + (c.cap || 0) + '" style="height:34px;width:96px"></td>' +
        '<td class="hide-xs"><input type="color" data-field="cat" data-key="color" data-id="' + c.id + '" value="' + (c.color || '#888888') + '" style="height:34px;width:46px;padding:3px"></td>' +
        '<td class="r"><button class="btn xs danger" data-act="delCat" data-id="' + c.id + '">' + svgIcon('trash', 13) + '</button></td></tr>';
    }).join('');
    this.modal({
      wide: true,
      title: 'Envelope budgets',
      sub: 'A cap of 0 means the category is tracked but not limited. Caps reset on the 1st of each month.',
      body: '<div style="max-height:52vh;overflow:auto"><table><thead><tr><th>Category</th><th class="hide-xs">Icon</th><th>Monthly cap</th><th class="hide-xs">Colour</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '<button class="btn sm" data-act="addCat" style="margin-top:12px">' + svgIcon('plus', 14) + ' Add category</button>',
      foot: '<span class="tiny dim" style="margin-right:auto;align-self:center">Changes save as you type</span><button class="btn primary" data-close>Done</button>'
    });
  },

  /* ---------------------------------------------------------- onboarding */
  onboard: function () {
    var self = this;
    var step = 0;
    var draft = { name: DB.settings.name || '', currency: DB.settings.currency, payMode: DB.settings.payMode, anchor: DB.settings.anchor };
    function body() {
      if (step === 0) {
        return '<p class="small muted" style="margin-bottom:14px">Welcome. This is a private, offline budget studio — everything is stored in this browser only. Two minutes to set up, then it runs itself.</p>' +
          '<label class="field"><span class="lb">What should we call you?</span><input type="text" id="obName" value="' + esc(draft.name) + '" placeholder="First name or nickname"></label>' +
          '<div style="height:12px"></div>' +
          '<label class="field"><span class="lb">Currency</span><select id="obCur">' +
          CURRENCIES.map(function (c) { return '<option value="' + c.code + '"' + (c.code === draft.currency ? ' selected' : '') + '>' + c.code + ' — ' + c.label + '</option>'; }).join('') +
          '</select></label>';
      }
      if (step === 1) {
        return '<p class="small muted" style="margin-bottom:14px">When does money land? This drives your safe-to-spend countdown.</p>' +
          '<label class="field"><span class="lb">Pay cycle</span><select id="obPay">' +
          [['weekly', 'Weekly'], ['biweekly', 'Every 2 weeks (most common)'], ['semimonthly', 'Twice a month (1st & 15th)'], ['monthly', 'Monthly']]
            .map(function (p) { return '<option value="' + p[0] + '"' + (p[0] === draft.payMode ? ' selected' : '') + '>' + p[1] + '</option>'; }).join('') +
          '</select></label><div style="height:12px"></div>' +
          '<label class="field"><span class="lb">Date of your next (or most recent) payday</span><input type="date" id="obAnchor" value="' + draft.anchor + '"></label>' +
          '<p class="tiny dim" style="margin-top:10px">You can add exact income sources later — this just gets the countdown right.</p>';
      }
      return '<p class="small muted" style="margin-bottom:14px">Start from a clean slate or load a fully-populated example you can edit.</p>' +
        '<div class="grid g-2" style="gap:12px">' +
        '<button class="btn" data-act="obDemo" style="height:auto;padding:18px;flex-direction:column;align-items:flex-start;gap:6px;text-align:left">' +
        '<b>Load the sample budget</b><span class="tiny dim">5 months of transactions, 14 bills, 4 debts, 5 goals. Best way to see everything working.</span></button>' +
        '<button class="btn" data-act="obBlank" style="height:auto;padding:18px;flex-direction:column;align-items:flex-start;gap:6px;text-align:left">' +
        '<b>Start empty</b><span class="tiny dim">Add your own bills, income and envelopes at your own pace.</span></button>' +
        '</div>' +
        '<div style="margin-top:16px"><div class="lb tiny dim" style="font-weight:700;letter-spacing:.05em;text-transform:uppercase;margin-bottom:8px">Or start from a preset</div>' +
        '<div class="row wrap" style="gap:8px">' +
        ['Student', 'Family of four', 'Freelancer', 'Debt crusher'].map(function (p) {
          return '<button class="btn sm" data-act="obPreset" data-id="' + p + '">' + p + '</button>';
        }).join('') + '</div></div>';
    }
    function open() {
      self.modal({
        title: 'Set up ' + BRAND.name,
        sub: 'Step ' + (step + 1) + ' of 3',
        body: body(),
        noFocus: true,
        foot: (step > 0 ? '<button class="btn" data-act="obBack">Back</button>' : '<button class="btn ghost" id="obSkip">Skip — just show me around</button>') +
          '<span style="flex:1"></span>' +
          (step < 2 ? '<button class="btn primary" data-act="obNext">Continue</button>' : '')
      });
    }
    this.actions.obNext = function () {
      var root = document.getElementById('modal-root');
      if (step === 0) {
        draft.name = (root.querySelector('#obName') || {}).value || '';
        draft.currency = (root.querySelector('#obCur') || {}).value || 'USD';
      } else if (step === 1) {
        draft.payMode = (root.querySelector('#obPay') || {}).value || 'biweekly';
        draft.anchor = (root.querySelector('#obAnchor') || {}).value || ymd(today());
      }
      step++; open();
    };
    this.actions.obBack = function () { step--; open(); };
    this.actions.obDemo = function () {
      applyDraft(); seedDemo(); DB.done = { welcome: true, tour: false }; DB.settings.name = draft.name;
      save(true); self.closeModal(); self.render();
      self.toast('Sample budget loaded — have a look around', 'ok', 5000);
      setTimeout(function () { self.startTour(); }, 900);
    };
    this.actions.obBlank = function () {
      applyDraft(); resetBlank(); DB.done = { welcome: true, tour: true };
      save(true); self.closeModal(); self.render();
      self.toast('Blank studio ready. Add a bill or an income source to begin.', 'ok', 5000);
      self.actions.addBill();
    };
    this.actions.obPreset = function (el) {
      applyDraft(); seedPreset(el.dataset.id); save(true);
      self.closeModal(); self.render();
      self.toast('Preset applied — tweak anything in Settings', 'ok', 5000);
      setTimeout(function () { self.startTour(); }, 900);
    };
    function applyDraft() {
      DB.settings.name = draft.name;
      DB.settings.currency = draft.currency;
      DB.settings.locale = localeForCurrency(draft.currency);
      DB.settings.payMode = draft.payMode;
      DB.settings.anchor = draft.anchor;
    }
    open();
  },

  startTour: function () {
    var self = this;
    var steps = [
      { view: 'today', sel: '#safeCard', title: 'Start here: safe to spend', body: 'The one number that matters. It already subtracts every bill, debt minimum and goal deposit due before your next payday — then keeps a buffer.' },
      { view: 'today', sel: '[data-tour="math"]', title: 'Never guess again', body: 'Tap “Show the math” any time to see exactly how the number was built. No black boxes.' },
      { view: 'today', sel: '[data-tour="forecast"]', title: '45-day cash forecast', body: 'Your real balance projected forward with every bill and payday marked — so you can see a tight week before it arrives.' },
      { view: 'spend', sel: '[data-tour="envelopes"]', title: 'Envelopes that pace you', body: 'Caps per category with a daily allowance so the money lasts the whole month, not three weeks.' },
      { view: 'bills', sel: '[data-tour="billlist"]', title: 'Every bill, on time', body: 'One tap marks a bill paid and logs the expense. Skip a cycle when a bill doesn’t hit.' },
      { view: 'debts', sel: '[data-tour="debtplan"]', title: 'Debt payoff simulator', body: 'Snowball, avalanche or your own order. See the exact payoff date and the interest you avoid.' },
      { view: 'goals', sel: '[data-tour="goals"]', title: 'Goals that finish', body: 'Set a target and a monthly amount; the app tells you the finish line and whether you are on track.' },
      { view: 'reports', sel: '[data-tour="reports"]', title: 'Reports for the big picture', body: 'Trends, net worth, top merchants and a savings-rate streak — plus CSV export.' }
    ];
    var i = 0;
    var root = document.getElementById('tour-root');
    root.classList.add('on');

    function paint() {
      var s = steps[i];
      if (self.route !== s.view) self.go(s.view);
      setTimeout(function () {
        var el = document.querySelector(s.sel);
        var rect = el ? el.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };
        var pad = 8;
        root.innerHTML =
          '<div class="tour-scrim"></div>' +
          '<div class="tour-spot" style="left:' + (rect.left - pad) + 'px;top:' + (rect.top - pad) + 'px;width:' + (rect.width + pad * 2) + 'px;height:' + (rect.height + pad * 2) + 'px"></div>' +
          '<div class="tour-pop" style="left:' + Math.min(Math.max(14, rect.left), window.innerWidth - 360) + 'px;top:' + Math.min(rect.bottom + 14, window.innerHeight - 230) + 'px">' +
          '<div class="row between"><h4>' + s.title + '</h4><span class="tiny dim">' + (i + 1) + ' / ' + steps.length + '</span></div>' +
          '<p>' + s.body + '</p>' +
          '<div class="row" style="margin-top:14px;gap:8px">' +
          '<button class="btn sm ghost" data-act="tourEnd">Skip tour</button><span style="flex:1"></span>' +
          (i > 0 ? '<button class="btn sm" data-act="tourPrev">Back</button>' : '') +
          '<button class="btn sm primary" data-act="tourNext">' + (i === steps.length - 1 ? 'Finish' : 'Next') + '</button>' +
          '</div></div>';
      }, 120);
    }
    this.actions.tourNext = function () {
      if (i === steps.length - 1) { self.endTour(); return; }
      i++; paint();
    };
    this.actions.tourPrev = function () { if (i > 0) { i--; paint(); } };
    this.actions.tourEnd = function () { self.endTour(); };
    paint();
  },
  endTour: function () {
    var root = document.getElementById('tour-root');
    if (!root.classList.contains('on')) return;
    root.classList.remove('on'); root.innerHTML = '';
    DB.done.tour = true; save(true);
    this.toast('Tour done. Press <b>/</b> to quick-add, <b>?</b>… well, the sidebar has everything.', 'ok', 6000);
  },

  seedPreset: function (name) {
    var t = today(), presets = {
      'Student': {
        pay: 'semimonthly', anchor: ymd(addDays(t, 5)),
        income: [['Part-time job', 780, 'semimonthly'], ['Family support', 300, 'monthly']],
        bills: [['Rent (shared)', 620, 'monthly', 6, 'home', '\uD83C\uDFE0'], ['Phone', 35, 'monthly', 12, 'home', '\uD83D\uDCF1'],
          ['Spotify Student', 5.99, 'monthly', 9, 'subs', '\uD83C\uDFB5'], ['Gym', 22, 'monthly', 20, 'health', '\uD83C\uDFCB\uFE0F'],
          ['Textbooks', 240, 'semiannual', 40, 'home', '\uD83D\uDCDA'], ['Meal plan top-up', 120, 'monthly', 3, 'groceries', '\uD83C\uDF5C']],
        goals: [['Emergency Fund', 1500, 260, '\uD83D\uDEE1\uFE0F']]
      },
      'Family of four': {
        pay: 'biweekly', anchor: ymd(addDays(t, 4)),
        income: [['Paycheck', 2650, 'biweekly'], ['Side business', 480, 'monthly']],
        bills: [['Mortgage', 1980, 'monthly', 1, 'home', '\uD83C\uDFE0'], ['Electric + Gas', 210, 'monthly', 14, 'home', '\u26A1'],
          ['Water', 68, 'bimonthly', 22, 'home', '\uD83D\uDCA7'], ['Internet', 79, 'monthly', 8, 'home', '\uD83D\uDCF6'],
          ['Phone (2 lines)', 110, 'monthly', 17, 'home', '\uD83D\uDCF1'], ['Car Insurance', 168, 'monthly', 5, 'transport', '\uD83D\uDE97'],
          ['Daycare', 640, 'semimonthly', 3, 'kids', '\uD83E\uDDF8'], ['Streaming bundle', 34, 'monthly', 11, 'subs', '\uD83C\uDFAC'],
          ['Life Insurance', 62, 'monthly', 25, 'home', '\uD83D\uDEE1\uFE0F']],
        goals: [['Emergency Fund', 15000, 400, '\uD83D\uDEE1\uFE0F'], ['Family Holiday', 3000, 180, '\u2708\uFE0F'], ['Kids Education', 8000, 250, '\uD83C\uDF93']]
      },
      'Freelancer': {
        pay: 'monthly', anchor: ymd(addDays(t, 9)),
        income: [['Client retainers', 4200, 'monthly'], ['Project work', 1600, 'monthly']],
        bills: [['Rent', 1750, 'monthly', 2, 'home', '\uD83C\uDFE0'], ['Health Insurance', 385, 'monthly', 15, 'health', '\uD83D\uDC8A'],
          ['Software stack', 148, 'monthly', 6, 'subs', '\uD83D\uDD01'], ['Coworking', 175, 'monthly', 1, 'home', '\uD83D\uDCBB'],
          ['Quarterly taxes', 3100, 'quarterly', 30, 'fees', '\uD83C\uDFE6'], ['Accountant', 450, 'annual', 120, 'fees', '\uD83D\uDCC4']],
        goals: [['Tax Buffer', 9000, 700, '\uD83C\uDFE6'], ['New Equipment', 3500, 250, '\uD83D\uDDA5\uFE0F'], ['Emergency Fund', 12000, 400, '\uD83D\uDEE1\uFE0F']]
      },
      'Debt crusher': {
        pay: 'biweekly', anchor: ymd(addDays(t, 3)),
        income: [['Paycheck', 1980, 'biweekly'], ['Overtime', 320, 'semimonthly']],
        bills: [['Rent', 1250, 'monthly', 1, 'home', '\uD83C\uDFE0'], ['Utilities', 165, 'monthly', 12, 'home', '\u26A1'],
          ['Internet', 55, 'monthly', 9, 'home', '\uD83D\uDCF6'], ['Phone', 42, 'monthly', 18, 'home', '\uD83D\uDCF1'],
          ['Car Insurance', 128, 'monthly', 7, 'transport', '\uD83D\uDE97'], ['Minimum subscriptions', 26, 'monthly', 21, 'subs', '\uD83D\uDD01']],
        goals: [['Emergency Fund (1 month)', 3000, 150, '\uD83D\uDEE1\uFE0F']]
      }
    };
    var p = presets[name];
    if (!p) return;
    var db = blankDB();
    db.settings = DB.settings;
    db.settings.payMode = p.pay;
    db.settings.anchor = p.anchor;
    db.accounts = [
      { id: 'chk', name: 'Everyday Checking', kind: 'checking', balance: 0, includeInSafe: true },
      { id: 'sav', name: 'Savings', kind: 'savings', balance: 0, includeInSafe: false }
    ];
    db.income = p.income.map(function (i) {
      return { id: uid('inc'), name: i[0], amount: i[1], freq: i[2], nextDate: ymd(addDays(t, 10)), accountId: 'chk', active: true };
    });
    db.bills = p.bills.map(function (b) {
      return {
        id: uid('bill'), name: b[0], amount: b[1], freq: b[2], nextDate: ymd(addDays(t, b[3])),
        catId: b[4], accountId: 'chk', icon: b[5], autopay: true, active: true, reminder: 3
      };
    });
    db.goals = p.goals.map(function (g) {
      return { id: uid('goal'), name: g[0], target: g[1], saved: 0, date: ymd(addMonths(t, 12)), icon: g[2], color: '#38bdf8', monthly: g[3], accountId: 'sav' };
    });
    db.debts = name === 'Debt crusher' ? [
      { id: uid('dbt'), name: 'Credit Card', balance: 5400, apr: 24.9, minPayment: 150, extra: 0, icon: '\uD83D\uDCB3' },
      { id: uid('dbt'), name: 'Personal Loan', balance: 7800, apr: 11.5, minPayment: 220, extra: 0, icon: '\uD83C\uDFE6' },
      { id: uid('dbt'), name: 'Car Loan', balance: 11500, apr: 7.2, minPayment: 340, extra: 0, icon: '\uD83D\uDE97' }
    ] : [];
    db.done = { welcome: true, tour: true };
    DB = db;
    save(true);
  },

  /* -------------------------------------------------------------- exports */
  download: function (filename, text, mime) {
    try {
      var blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1200);
      return true;
    } catch (e) {
      this.toast('Download blocked by the browser — try opening the file from a folder instead of a preview pane.', 'err', 7000);
      return false;
    }
  },

  /* ------------------------------------------------------- dashboard view */
  dashboard: {
    title: function () { return greeting() + (DB.settings.name ? ', ' + esc(DB.settings.name) : ''); },
    crumb: function () {
      var sts = safeToSpend();
      return fmtDate(today(), 'day') + ' · ' + sts.daysLeft + ' days until ' + fmtDate(sts.payday, 'medium');
    },
    html: function () {
      if (!DB.tx.length && !DB.bills.length && !DB.income.length) return App.welcomeState();
      var sts = safeToSpend();
      var pace = paceForCurrentMonth();
      var f = forecast(45);
      var env = envelopes().filter(function (e) { return e.cap > 0 || e.spent > 0; });
      var topCats = sortBy(envelopes().filter(function (e) { return e.spent > 0; }), function (e) { return e.spent; }, 'desc').slice(0, 6);
      var score = moneyScore();
      var up = upcoming(7);
      var savingsRate = DB.tx.length ? (function () {
        var inc = 0, exp = 0;
        for (var i = 0; i < 3; i++) { var m = monthSummary(monthKey(addMonths(today(), -i))); inc += m.income; exp += m.expense; }
        return inc > 0 ? (inc - exp) / inc * 100 : null;
      })() : null;

      var alerts = buildAlerts(sts, pace);

      var safeColor = sts.safe < 0 ? 'var(--danger)' : sts.safe < sts.perDay * 5 ? 'var(--warn)' : 'var(--accent)';

      return alerts +

        /* ---- hero ---- */
        '<div class="hero" style="margin-top:' + (alerts ? '16px' : '0') + '">' +
        '<section class="card safe-card" id="safeCard" data-tour="safeCard">' +
        '<div class="row between" style="align-items:flex-start">' +
        '<div><div class="card-head" style="margin:0"><div class="t">Safe to spend</div></div>' +
        '<div class="safe-num" style="color:' + safeColor + '">' + money(sts.safe) + '</div>' +
        '<div class="safe-sub">' + (sts.safe < 0
          ? 'You are <b class="danger">' + money(Math.abs(sts.safe)) + '</b> short of covering what is already committed before ' + fmtDate(sts.payday, 'short') + '.'
          : 'Yours to spend between now and <b>' + fmtDate(sts.payday, 'medium') + '</b> without touching a single bill.') +
        '</div></div>' +
        '<div class="center">' + Chart.gauge({ value: Math.max(0, sts.safe), max: Math.max(1, sts.cash), size: 190, stroke: 16, color: safeColor }) + '</div>' +
        '</div>' +

        '<div class="safe-perday">' +
        '<span class="chip accent">' + money(sts.perDay) + ' / day</span>' +
        '<span class="chip">' + sts.daysLeft + ' days to payday</span>' +
        (sts.debtList.length ? '<span class="chip">' + sts.debtList.length + ' debt payment' + (sts.debtList.length === 1 ? '' : 's') + ' due</span>' : '') +
        '</div>' +

        '<div class="row wrap" style="margin-top:16px;gap:9px">' +
        '<button class="btn primary" data-act="addTx">' + svgIcon('plus', 15) + ' Log a spend</button>' +
        '<button class="btn" data-act="toggleMath" data-tour="math">' + svgIcon('search', 15) + ' Show the math</button>' +
        '<button class="btn ghost" data-act="whatif">' + svgIcon('spark', 15) + ' Can I afford it?</button>' +
        '</div>' +

        '<div class="ledger' + (DB.settings.dismiss.mathOpen ? ' open' : '') + '" id="mathLedger">' + ledgerHTML(sts) + '</div>' +
        '</section>' +

        '<div class="stack">' +
        '<section class="card">' + App.head('Cash on hand', 'Balances you can actually spend') +
        '<div class="list">' + DB.accounts.map(function (a) {
          return '<div class="li"><div class="ic">' + (a.kind === 'savings' ? '\uD83C\uDFE6' : a.kind === 'credit' ? '\uD83D\uDCB3' : '\uD83C\uDFE7') + '</div>' +
            '<div class="tx"><b>' + esc(a.name) + '</b><span>' + (a.includeInSafe === false ? 'Excluded from safe-to-spend' : 'Counted in safe-to-spend') + '</span></div>' +
            '<div class="va num">' + App.M(a.balance) + '</div></div>';
        }).join('') + '</div>' +
        '<div class="row between" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--line)">' +
        '<span class="small muted">Net worth</span><b class="num">' + App.M(netWorth()) + '</b></div>' +
        '</section>' +

        '<section class="card">' + App.head('Next 7 days', up.length + ' scheduled items') +
        (up.length ? '<div class="list">' + up.slice(0, 5).map(function (u) {
          return '<div class="li"><div class="ic">' + (u.icon || (u.kind === 'income' ? '\uD83D\uDCB0' : '\uD83D\uDCC5')) + '</div>' +
            '<div class="tx"><b>' + esc(u.name) + '</b><span>' + relDay(u.date) + ' · ' + fmtDate(u.date, 'short') + '</span></div>' +
            '<div class="va num ' + (u.amount > 0 ? 'good' : '') + '">' + (u.amount > 0 ? '+' : '\u2212') + money(Math.abs(u.amount)).replace('-', '') + '</div></div>';
        }).join('') + '</div>' : App.empty('\u2600\uFE0F', 'Nothing due this week', 'Enjoy the breathing room.')) +
        '</section>' +
        '</div></div>' +

        /* ---- second row ---- */
        '<div class="grid g-3" style="margin-top:16px">' +
        '<section class="card">' + App.head('This month', MONTHS[today().getMonth()] + ' ' + today().getFullYear(),
          '<button class="btn xs ghost" data-act="go" data-view="spend">Details ' + svgIcon('chevR', 12) + '</button>') +
        '<div class="row" style="gap:16px;align-items:flex-end">' +
        '<div><div class="tiny dim">Spent</div><div class="big" style="font-size:26px">' + App.M(pace.month.expense) + '</div></div>' +
        '<div class="spacer"></div>' +
        '<div style="text-align:right"><div class="tiny dim">Budgeted' + (pace.rollover > 0.5 ? ' <span title="Includes unspent money carried over">(+' + money0(pace.rollover) + ' carried)</span>' : '') + '</div>' +
        '<div class="num" style="font-weight:650">' + App.M(pace.caps) + '</div></div>' +
        '</div>' +
        '<div style="margin-top:12px">' + Chart.progress(pace.caps ? (pace.month.expense / pace.caps) * 100 : 0, { color: pace.month.expense > pace.caps ? 'var(--danger)' : 'var(--accent)' }) + '</div>' +
        '<div class="row between" style="margin-top:9px">' +
        '<span class="tiny ' + (pace.projected > pace.caps ? 'warn' : 'good') + '">On pace to finish at ' + money0(pace.projected) + '</span>' +
        '<span class="tiny dim">' + pace.daysLeft + ' days left</span></div>' +
        '<hr class="sep">' +
        '<div class="row between"><span class="small muted">Still scheduled</span><b class="num small">' + App.M(pace.scheduledLeft) + '</b></div>' +
        '<div class="row between" style="margin-top:7px"><span class="small muted">Everyday pace</span><b class="num small">' + App.M(pace.everydayAverage) + ' / day</b></div>' +
        '<div class="row between" style="margin-top:7px"><span class="small muted">Envelope money left</span><b class="num small ' + (pace.remainingEnvelope < 0 ? 'danger' : 'good') + '">' + App.M(pace.remainingEnvelope) + '</b></div>' +
        (savingsRate !== null ? '<div class="row between" style="margin-top:7px"><span class="small muted">3-month savings rate</span><b class="num small ' + (savingsRate > 15 ? 'good' : savingsRate > 0 ? '' : 'danger') + '">' + savingsRate.toFixed(0) + '%</b></div>' : '') +
        '</section>' +

        '<section class="card">' + App.head('Where it went', 'This month by envelope') +
        (topCats.length ?
          '<div class="row" style="gap:18px;align-items:center;flex-wrap:wrap">' +
          '<div style="width:150px;flex:0 0 auto">' + Chart.donut(topCats.map(function (e) {
            return { value: e.spent, color: e.cat.color, label: e.cat.name, display: money(e.spent) };
          }), { size: 150, stroke: 18 }) + '</div>' +
          '<div class="legend" style="flex:1;min-width:130px">' + topCats.map(function (e) {
            return '<div class="legend-item"><span class="sw" style="background:' + e.cat.color + '"></span>' +
              '<span class="nm">' + e.cat.icon + ' ' + esc(e.cat.name) + '</span><span class="vl num">' + money0(e.spent) + '</span></div>';
          }).join('') + '</div></div>'
          : App.empty('\uD83E\uDDEE', 'No spending logged yet', 'Add a transaction and this fills in instantly.')) +
        '</section>' +

        '<section class="card">' + App.head('Money score', score.grade,
          '<button class="btn xs ghost" data-act="scoreInfo">How?</button>') +
        '<div class="row" style="gap:16px;align-items:center">' +
        '<div style="position:relative;width:104px;flex:0 0 auto">' + Chart.ring(score.score, { size: 104, stroke: 11, color: scoreColor(score.score) }) +
        '<div style="position:absolute;inset:0;display:grid;place-items:center"><div class="center"><b style="font-size:24px" class="num">' + score.score + '</b>' +
        '<div class="tiny dim">/ 100</div></div></div></div>' +
        '<div class="legend" style="flex:1;min-width:0">' + score.parts.slice(0, 3).map(function (p) {
          return '<div class="legend-item"><span class="sw" style="background:' + scoreColor(p.value) + '"></span>' +
            '<span class="nm">' + esc(p.key) + '</span><span class="vl num">' + Math.round(p.value) + '</span></div>';
        }).join('') + '</div></div>' +
        '<p class="tiny dim" style="margin-top:12px">' + esc(score.parts[0].detail) + '</p>' +
        '</section>' +
        '</div>' +

        /* ---- forecast ---- */
        '<section class="card" style="margin-top:16px" data-tour="forecast">' +
        App.head('Cash forecast — next 45 days',
          'Every bill, debt minimum and payday applied to your real balances',
          '<div class="pill-group" id="fcRange">' +
          '<button data-act="fcRange" data-id="45" class="on">45d</button>' +
          '<button data-act="fcRange" data-id="90">90d</button></div>') +
        '<div class="grid g-32" style="gap:20px">' +
        '<div>' + forecastChart(f) +
        '<div class="row wrap" style="gap:16px;margin-top:10px">' +
        '<span class="tiny dim"><span class="chip good" style="padding:1px 7px">●</span> payday</span>' +
        '<span class="tiny dim"><span class="chip" style="padding:1px 7px">●</span> bill or debt payment</span>' +
        '<span class="tiny dim"><span class="chip warn" style="padding:1px 7px">— —</span> safety buffer</span>' +
        '<span class="tiny dim">— — projected everyday spending of ' + money(f.pace) + '/day</span>' +
        '</div></div>' +
        '<div class="stack">' +
        '<div class="metric"><div class="l">Lowest balance</div><div class="v ' + (f.low < 0 ? 'danger' : f.low < DB.settings.safetyBuffer ? 'warn' : '') + '">' + App.M(f.low) + '</div>' +
        '<div class="d">' + (f.low < 0 ? 'You go negative around ' + fmtDate(f.lowDate, 'medium') :
          f.riskDays ? 'Dips under your buffer on ' + fmtDate(f.firstRisk.date, 'medium') + ' — ' + f.riskDays + ' tight day' + (f.riskDays === 1 ? '' : 's') :
            'Never dips below your buffer. Nice runway.') + '</div></div>' +
        '<div class="metric"><div class="l">Projected in 45 days</div><div class="v">' + App.M(f.end) + '</div>' +
        '<div class="d">' + (f.end - f.start >= 0 ? '+' : '\u2212') + money(Math.abs(f.end - f.start)) + ' vs today</div></div>' +
        '<div class="metric"><div class="l">Committed outflows</div><div class="v">' + App.M(sum(f.points, function (p) { return sum(p.events.filter(function (e) { return e.amount < 0; }), function (e) { return Math.abs(e.amount); }); })) + '</div>' +
        '<div class="d">Bills + debt minimums scheduled</div></div>' +
        '</div></div></section>' +

        /* ---- envelopes + goals ---- */
        '<div class="grid g-2" style="margin-top:16px">' +
        '<section class="card">' + App.head('Envelope health', 'Caps vs. what is left',
          '<button class="btn xs ghost" data-act="editCats">Edit caps</button>') +
        (env.length ? '<div class="stack">' + sortBy(env, function (e) { return e.pct; }, 'desc').slice(0, 5).map(envRow).join('') + '</div>'
          : App.empty('\uD83D\uDCB0', 'No envelope caps yet', 'Caps keep categories from running hot. Add a few.', '<button class="btn sm" data-act="editCats" style="margin-top:8px">Set caps</button>')) +
        '</section>' +

        '<section class="card">' + App.head('Savings goals', DB.goals.length + ' active',
          '<button class="btn xs ghost" data-act="go" data-view="goals">All goals ' + svgIcon('chevR', 12) + '</button>') +
        (DB.goals.length ? '<div class="stack">' + sortBy(DB.goals, function (g) { return goalInfo(g).pct; }, 'desc').slice(0, 4).map(function (g) {
          var gi = goalInfo(g);
          return '<div class="goal-card"><div class="goal-ring">' + Chart.ring(gi.pct, { size: 78, stroke: 8, color: g.color }) +
            '<div class="pc">' + Math.round(gi.pct) + '%</div></div>' +
            '<div class="meta"><b class="small">' + esc(g.name) + '</b>' +
            '<div class="tiny dim" style="margin-top:2px">' + money(gi.saved) + ' of ' + money(gi.target) +
            (gi.eta ? ' · done ' + fmtDate(gi.eta, 'short') : ' · add a monthly amount') + '</div>' +
            '<div style="margin-top:7px">' + Chart.progress(gi.pct, { thin: true, color: g.color }) + '</div></div></div>';
        }).join('') + '</div>' : App.empty('\uD83C\uDFAF', 'No goals yet', 'Goals turn spare money into something real.')) +
        '</section></div>';
    },
    after: function () { bindForecastHover(); }
  },

  /* registered after the object literal so views.js can add the rest */
  welcomeState: function () {
    return '<section class="card" style="text-align:center;padding:44px 22px">' +
      '<div style="font-size:40px;margin-bottom:10px">\uD83E\uDDED</div>' +
      '<h2 style="font-size:22px">Your studio is ready</h2>' +
      '<p class="muted small" style="max-width:52ch;margin:10px auto 0">Nothing here yet — and nothing is sent anywhere. Load the sample budget to explore every screen, or start with your own numbers.</p>' +
      '<div class="row" style="justify-content:center;gap:10px;margin-top:22px;flex-wrap:wrap">' +
      '<button class="btn primary" data-act="loadDemo">' + svgIcon('spark', 15) + ' Load the sample budget</button>' +
      '<button class="btn" data-act="addBill">' + svgIcon('plus', 15) + ' Add my first bill</button>' +
      '<button class="btn ghost" data-act="startTour">' + svgIcon('today', 15) + ' Take the tour</button>' +
      '</div></section>';
  }
};

/* --------------------------------------------------------------- helpers */
function greeting() {
  var h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}
function esc(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function localeForCurrency(code) {
  var map = {
    USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB', CAD: 'en-CA', AUD: 'en-AU', NZD: 'en-NZ',
    INR: 'en-IN', ZAR: 'en-ZA', SEK: 'sv-SE', NOK: 'nb-NO', DKK: 'da-DK', CHF: 'de-CH',
    PLN: 'pl-PL', BRL: 'pt-BR', MXN: 'es-MX', JPY: 'ja-JP', SGD: 'en-SG', HKD: 'en-HK',
    PHP: 'en-PH', MYR: 'ms-MY', THB: 'th-TH', IDR: 'id-ID', AED: 'en-AE', ILS: 'he-IL',
    TRY: 'tr-TR', NGN: 'en-NG'
  };
  return map[code] || 'en-US';
}
function scoreColor(v) { return v >= 75 ? 'var(--good)' : v >= 50 ? 'var(--accent)' : v >= 30 ? 'var(--warn)' : 'var(--danger)'; }

function ledgerHTML(sts) {
  return '<div class="ledger-row"><span class="lbl">Cash counted (' + DB.accounts.filter(function (a) { return a.includeInSafe !== false && a.kind !== 'credit' && a.kind !== 'loan' && (a.kind !== 'savings' || DB.settings.includeSavingsInSafe); }).length + ' account' + (DB.accounts.filter(function (a) { return a.includeInSafe !== false && a.kind !== 'credit' && a.kind !== 'loan' && (a.kind !== 'savings' || DB.settings.includeSavingsInSafe); }).length === 1 ? '' : 's') + ')</span><b>' + money(sts.cash) + '</b></div>' +
    '<div class="ledger-row"><span class="lbl">\u2212 Bills due before ' + fmtDate(sts.scopeEnd, 'short') + ' (' + sts.billCount + ')</span><b>' + money(sts.bills) + '</b></div>' +
    (sts.debtMin ? '<div class="ledger-row"><span class="lbl">\u2212 Debt minimums in the same window</span><b>' + money(sts.debtMin) + '</b></div>' : '') +
    (sts.goalReserve ? '<div class="ledger-row"><span class="lbl">\u2212 Goal deposits for this window</span><b>' + money(sts.goalReserve) + '</b></div>' : '') +
    (sts.paceReserve ? '<div class="ledger-row"><span class="lbl">\u2212 Everyday spending you have not logged yet</span><b>' + money(sts.paceReserve) + '</b></div>' : '') +
    '<div class="ledger-row"><span class="lbl">\u2212 Safety buffer</span><b>' + money(sts.buffer) + '</b></div>' +
    '<div class="ledger-row total"><span>Safe to spend</span><b>' + money(sts.safe) + '</b></div>' +
    '<div class="ledger-foot">Change any of this in Settings \u2192 Safe-to-spend rules. Turn on “realistic mode” to also hold back everyday spending you have not logged yet.</div>';
}

function buildAlerts(sts, pace) {
  var out = [];
  var t = today();

  /* gentle backup nudge — promised in the guide, and the one thing that
     actually protects a browser-stored budget */
  var last = DB.settings.lastBackup;
  var stale = !last || diffDays(parseYMD(last), t) >= 30;
  if (DB.tx.length > 25 && stale && !DB.settings.dismiss.backupNudge) {
    out.push('<div class="alert info"><span class="em">\uD83D\uDCBE</span><span>It has been ' +
      (last ? diffDays(parseYMD(last), t) + ' days' : 'a while') + ' since your last backup. Ten seconds now saves your whole budget later.</span>' +
      '<span class="row" style="margin-left:auto;gap:6px">' +
      '<button class="btn xs" data-act="exportJson">Download backup</button>' +
      '<button class="btn xs ghost" data-act="dismissBackup" title="Do not remind me again">&times;</button></span></div>');
  }
  var next3 = billOccurrences(t, addDays(t, 3)).filter(function (o) { return !o.paid; });
  if (next3.length) {
    out.push('<div class="alert info"><span class="em">\uD83D\uDD14</span><span>' +
      next3.map(function (o) { return '<b>' + esc(o.bill.name) + '</b> ' + money(o.amount) + ' ' + relDay(o.date).toLowerCase(); }).join(' &nbsp;·&nbsp; ') +
      '</span></div>');
  }
  if (sts.safe < 0) {
    out.push('<div class="alert danger"><span class="em">\u26A0\uFE0F</span><span>Your committed bills are <b>' + money(Math.abs(sts.safe)) + '</b> more than the cash you have set aside. Move money in, or delay a bill.</span></div>');
  }
  var over = envelopes().filter(function (e) { return e.over; });
  if (over.length) {
    var worst = sortBy(over, function (e) { return e.spent - e.cap; }, 'desc')[0];
    out.push('<div class="alert warn"><span class="em">\uD83D\uDCE6</span><span><b>' + esc(worst.cat.name) + '</b> is <b>' + money(worst.spent - worst.cap) + '</b> over its ' + money0(worst.cap) + ' cap this month' +
      (over.length > 1 ? ' — ' + (over.length - 1) + ' other envelope' + (over.length > 2 ? 's' : '') + ' also over.' : '.') + '</span></div>');
  }
  var f = forecast(30);
  if (f.firstRisk && !over.length) {
    out.push('<div class="alert warn"><span class="em">\uD83D\uDCC9</span><span>Cash dips to <b>' + money(f.firstRisk.balance) + '</b> around <b>' + fmtDate(f.firstRisk.date, 'medium') + '</b>. Move a payment or trim an envelope.</span></div>');
  }
  if (!out.length && pace.projected <= pace.caps && pace.caps > 0) {
    out.push('<div class="alert good"><span class="em">\u2705</span><span>You are on pace to finish the month <b>' + money(pace.caps - pace.projected) + '</b> under your envelopes. Keep going.</span></div>');
  }
  return '<div class="stack">' + out.slice(0, 3).join('') + '</div>';
}

function envRow(e) {
  var badge = e.over ? '<span class="chip danger">over by ' + money0(Math.abs(e.left)) + '</span>'
    : e.hot ? '<span class="chip warn">running hot</span>'
      : e.ahead ? '<span class="chip good">ahead of pace</span>'
        : e.mostlyBills ? '<span class="chip">fixed bills</span>' : '<span class="chip good">on pace</span>';
  return '<div class="env-card"><div class="env-head"><div class="ic">' + e.cat.icon + '</div>' +
    '<div><div class="nm">' + esc(e.cat.name) + '</div><div class="tiny dim">' + (e.cap ? money0(Math.max(0, e.left)) + ' left of ' + money0(e.cap) : 'no cap set') + '</div></div>' +
    '<div class="amt">' + money0(e.spent) + '</div></div>' +
    '<div>' + Chart.progress(e.cap ? e.pct : 0, { color: e.over ? 'var(--danger)' : e.cat.color }) + '</div>' +
    '<div class="env-foot"><span>' + badge + '</span><span>' + (e.cap ? Math.round(e.pct) + '% used' : 'tracked only') + '</span></div></div>';
}

function forecastChart(f, key) {
  App._chartData[key || 'forecast'] = f;
  var labels = [], points = [];
  f.points.forEach(function (p, i) {
    labels.push(fmtDate(p.date, 'short'));
    points.push({ y: p.balance, label: fmtDate(p.date, 'short') });
  });
  var markers = [];
  f.points.forEach(function (p, i) {
    p.events.forEach(function (e) { markers.push({ i: i, kind: e.kind === 'income' ? 'pay' : 'bill' }); });
  });
  var lowI = 0;
  f.points.forEach(function (p, i) { if (p.balance <= f.points[lowI].balance) lowI = i; });
  markers.push({ i: lowI, kind: 'low' });
  var step = Math.max(1, Math.floor(f.points.length / 6));
  var xticks = Math.min(7, Math.ceil(f.points.length / 7));
  return Chart.line(points, {
    height: 260, markers: markers, gid: 'fc',
    extraLines: [{ value: DB.settings.safetyBuffer, label: 'safety buffer', color: 'var(--warn)' }],
    xTicks: Math.max(3, Math.round(f.points.length / 8)),
    color: f.low < 0 ? 'var(--danger)' : 'var(--accent-2)'
  });
}

/* ------------------------------------------------- forecast hover scrubber */
function bindForecastHover() {
  var f = App._chartData.forecast;
  if (!f) return;
  var svg = document.querySelector('.chart-line');
  if (!svg) return;
  var hit = svg.querySelector('.hit');
  var layer = svg.querySelector('.hover-layer');
  if (!hit || !layer) return;
  var W = 720, padL = 52, padR = 14;
  var tip = document.createElement('div');
  tip.className = 'chart-tip';
  tip.style.cssText = 'position:fixed;pointer-events:none;z-index:90;background:var(--surface-3);border:1px solid var(--line);' +
    'border-radius:11px;padding:9px 12px;font-size:12.5px;box-shadow:var(--shadow);opacity:0;transition:opacity .12s;max-width:230px';
  document.body.appendChild(tip);
  function clearTip() { if (tip.parentNode) tip.remove(); else tip.style.display = 'none'; }
  svg.addEventListener('mousemove', function (e) {
    var r = svg.getBoundingClientRect();
    var rel = (e.clientX - r.left) / r.width * W;
    var frac = (rel - padL) / (W - padL - padR);
    var i = Math.round(clamp(frac, 0, 1) * (f.points.length - 1));
    var p = f.points[i];
    var vals = f.points.map(function (x) { return x.balance; });
    var max = Math.max.apply(null, vals), min = Math.min.apply(null, vals);
    max = max + (max - min) * 0.08; min = min - (max - min) * 0.06;
    var H = 260, padT = 16, padB = 28;
    var y = padT + (H - padT - padB) * (1 - (p.balance - min) / Math.max(1, max - min));
    layer.setAttribute('opacity', '1');
    layer.innerHTML = '<line x1="' + (padL + (W - padL - padR) * (i / (f.points.length - 1))) + '" y1="16" x2="' +
      (padL + (W - padL - padR) * (i / (f.points.length - 1))) + '" y2="' + (H - 28) + '" stroke="var(--muted)" stroke-width="1" stroke-dasharray="3 3"/>' +
      '<circle cx="' + (padL + (W - padL - padR) * (i / (f.points.length - 1))) + '" cy="' + y + '" r="4.5" fill="var(--accent-2)" stroke="var(--surface)" stroke-width="2"/>';
    tip.innerHTML = '<b>' + fmtDate(p.date, 'weekday') + '</b><div class="num" style="font-size:15px;font-weight:700;margin:3px 0">' + money(p.balance) + '</div>' +
      (p.events.length ? p.events.map(function (ev) {
        return '<div style="color:' + (ev.amount > 0 ? 'var(--good)' : 'var(--muted)') + '">' + (ev.amount > 0 ? '+' : '\u2212') + money(Math.abs(ev.amount)).replace('-', '') + ' ' + esc(ev.name) + '</div>';
      }).join('') : '<div class="dim">no scheduled items</div>');
    tip.style.opacity = '1';
    var tw = Math.min(240, window.innerWidth - 30);
    tip.style.left = Math.min(e.clientX + 16, window.innerWidth - tw - 12) + 'px';
    tip.style.top = Math.max(12, e.clientY - 70) + 'px';
    tip.style.display = 'block';
  });
  svg.addEventListener('mouseleave', function () {
    layer.setAttribute('opacity', '0');
    tip.style.opacity = '0';
    setTimeout(function () { tip.style.display = 'none'; }, 150);
  });
  window.addEventListener('scroll', function () { tip.style.opacity = '0'; }, { passive: true });
  /* keep a handle so view teardown can remove it */
  App.hooks.push(clearTip);
}

/* ------------------------------------------------------------- app actions */
App.actions = Object.assign(App.actions, {
  go: function (el) { App.go(el.dataset.view); },
  addTx: function () { App.addTx(); },
  loadDemo: function () {
    App.confirm({
      title: 'Load the sample budget?',
      body: 'This replaces what is in the studio right now with a fully populated example: 5 months of spending, 14 bills, 4 debts and 5 goals. You can reset to blank any time in Settings.',
      ok: 'Load sample', onOk: function () {
        snapshot('load sample'); seedDemo(); App.render();
        App.toast('Sample budget loaded', 'ok', 5000, function () { undo(); });
        setTimeout(function () { App.startTour(); }, 800);
      }
    });
  },
  toggleMath: function () {
    var led = document.getElementById('mathLedger');
    led.classList.toggle('open');
    DB.settings.dismiss = DB.settings.dismiss || {};
    DB.settings.dismiss.mathOpen = led.classList.contains('open');
    save();
  },
  togglePrivacy: function (el) {
    DB.settings.privacy = !DB.settings.privacy;
    document.body.classList.toggle('privacy', DB.settings.privacy);
    if (el) el.classList.toggle('on', DB.settings.privacy);
    save();
    App.toast(DB.settings.privacy ? 'Privacy goggles on — amounts are blurred' : 'Privacy goggles off', 'ok', 2200);
  },
  cycleTheme: function () {
    var i = 0;
    THEMES.forEach(function (t, k) { if (t.id === DB.settings.theme) i = k; });
    i = (i + 1) % THEMES.length;
    DB.settings.theme = THEMES[i].id;
    App.applyTheme(); save(); App.render();
    App.toast('Theme: ' + THEMES[i].label, 'ok', 1800);
  },
  startTour: function () { App.startTour(); },
  whatif: function () {
    var sts = safeToSpend();
    App.modal({
      title: 'Can I afford it?',
      sub: 'Type a price and see what it does to your safe-to-spend, this month and your debt-free date.',
      body:
        '<label class="field"><span class="lb">What are you thinking about buying?</span><input type="text" id="wiName" placeholder="New headphones"></label>' +
        '<div style="height:12px"></div>' +
        '<label class="field"><span class="lb">Price: <b id="wiOut">' + money(150) + '</b></span>' +
        '<input type="range" id="wiPrice" min="5" max="3000" step="5" value="150" data-live="wiOut" data-live-fmt="money"></label>' +
        '<div style="height:6px"></div>' +
        '<label class="check"><input type="checkbox" id="wiUseDebt" checked> Compare against extra debt payment instead</label>' +
        '<div id="wiResult" style="margin-top:16px"></div>',
      foot: '<button class="btn" data-close>Close</button><button class="btn primary" id="wiLog">Log it as a purchase</button>',
      after: function (root) {
        function calc() {
          var price = Number(root.querySelector('#wiPrice').value);
          var useDebt = root.querySelector('#wiUseDebt').checked;
          var after = sts.safe - price;
          var dsi = debtSummary();
          var withExtra = debtPlan('avalanche', dsi.minPay - dsi.minPay + price / 12);
          var now = debtPlan('avalanche', 0);
          var monthsSaved = now.months - withExtra.months;
          var interestSaved = now.totalInterest - withExtra.totalInterest;
          root.querySelector('#wiResult').innerHTML =
            '<div class="metric" style="margin-bottom:10px"><div class="l">Safe to spend after this</div>' +
            '<div class="v ' + (after < 0 ? 'danger' : after < 100 ? 'warn' : 'good') + '">' + money(after) + '</div>' +
            '<div class="d">' + (after < 0
              ? 'That is ' + money(Math.abs(after)) + ' more than you have free before payday.'
              : 'Leaves you ' + money(after) + ' plus your ' + money0(DB.settings.safetyBuffer) + ' buffer untouched.') + '</div></div>' +
            (useDebt && dsi.count ? '<div class="metric"><div class="l">…or put it on debt instead</div>' +
              '<div class="v good">' + (monthsSaved > 0 ? monthsSaved + ' months sooner' : 'small dent') + '</div>' +
              '<div class="d">Saves about ' + money(Math.max(0, interestSaved)) + ' in interest. Debt-free ' + fmtDate(withExtra.payoffDate, 'medium') + '.</div></div>' : '') +
            '<div style="margin-top:12px"><div class="row between tiny dim"><span>Envelope pressure this month</span><span>' + money0(paceForCurrentMonth().month.expense + price) + ' of ' + money0(paceForCurrentMonth().caps) + '</span></div>' +
            Chart.progress(paceForCurrentMonth().caps ? ((paceForCurrentMonth().month.expense + price) / paceForCurrentMonth().caps) * 100 : 0, { thin: true, color: (paceForCurrentMonth().month.expense + price) > paceForCurrentMonth().caps ? 'var(--danger)' : 'var(--accent)' }) + '</div>';
        }
        root.querySelector('#wiPrice').addEventListener('input', calc);
        root.querySelector('#wiUseDebt').addEventListener('change', calc);
        root.querySelector('#wiLog').onclick = function () {
          var price = Number(root.querySelector('#wiPrice').value);
          var name = root.querySelector('#wiName').value || 'Purchase';
          snapshot('purchase');
          DB.tx.push({ id: uid('tx'), date: ymd(today()), amount: -price, catId: 'shopping', accountId: (DB.accounts[0] || {}).id || 'chk', note: name, tags: [], type: 'expense', cleared: true });
          save(); App.closeModal(); App.render();
          App.toast('Logged ' + money(price) + ' \u2192 Shopping', 'ok', 5000, function () { undo(); });
        };
        calc();
      }
    });
  },
  scoreInfo: function () {
    var s = moneyScore();
    App.modal({
      title: 'Your money score',
      sub: 'A single number built from five things that actually predict financial calm. Updated live.',
      body: '<div class="stack">' + s.parts.map(function (p) {
        return '<div class="metric"><div class="row between"><div class="l">' + esc(p.key) + ' · weight ' + p.weight + '%</div>' +
          '<b class="num">' + Math.round(p.value) + '</b></div>' +
          '<div style="margin:7px 0 6px">' + Chart.progress(p.value, { thin: true, color: scoreColor(p.value) }) + '</div>' +
          '<div class="d">' + esc(p.detail) + '</div></div>';
      }).join('') + '</div>',
      foot: '<button class="btn primary" data-close>Got it</button>'
    });
  },
  addBill: function () { App.billForm(); },
  editBill: function (el) { App.billForm(el.dataset.id); },
  delBill: function (el) {
    var b = byId(DB.bills, el.dataset.id);
    if (!b) return;
    App.confirm({
      title: 'Delete “' + esc(b.name) + '”?', body: 'Past transactions stay in your log. The bill just stops appearing in upcoming lists.', danger: true, ok: 'Delete',
      onOk: function () {
        snapshot('delete bill');
        DB.bills = DB.bills.filter(function (x) { return x.id !== b.id; });
        save(); App.render(); App.toast('Bill deleted', 'ok', 4500, function () { undo(); });
      }
    });
  },
  toggleBillActive: function (el) {
    var b = byId(DB.bills, el.dataset.id);
    if (!b) return;
    snapshot('pause bill');
    b.active = b.active === false;
    save(); App.render();
    App.toast(b.name + (b.active ? ' resumed' : ' paused'), 'ok', 4000, function () { undo(); });
  },
  pay: function (el) { App.payBill(el.dataset.id, el.dataset.date); },
  unpair: function (el) {
    var key = el.dataset.key;
    snapshot('undo payment');
    delete DB.paid[key];
    save(); App.render(); App.toast('Payment unmarked', 'ok', 4500, function () { undo(); });
  },
  fcRange: function (el) {
    var n = Number(el.dataset.id);
    document.querySelectorAll('#fcRange button').forEach(function (b) { b.classList.toggle('on', b === el); });
    var f = forecast(n);
    var host = document.querySelector('[data-tour="forecast"] .grid > div');
    if (host) {
      host.innerHTML = forecastChart(f) + host.querySelector('div:last-child').outerHTML;
      bindForecastHover();
    }
  },
  editCats: function () { App.editCats(); },
  addCat: function () {
    snapshot('add category');
    DB.cats.push({ id: uid('cat'), name: 'New category', icon: '\uD83C\uDFF7\uFE0F', color: '#8b9bb4', cap: 0, rollover: false });
    save(); App.editCats(); App.render();
  },
  delCat: function (el) {
    var id = el.dataset.id;
    var used = DB.tx.filter(function (t) { return t.catId === id; }).length;
    if (DB.cats.length <= 1) return;
    App.confirm({
      title: 'Delete this category?',
      body: used ? used + ' transactions use it — they will move to “Other”.' : 'No transactions use it yet.',
      danger: true, ok: 'Delete',
      onOk: function () {
        snapshot('delete category');
        DB.cats = DB.cats.filter(function (c) { return c.id !== id; });
        DB.tx.forEach(function (t) { if (t.catId === id) t.catId = 'other'; });
        DB.bills.forEach(function (b) { if (b.catId === id) b.catId = 'other'; });
        save(); App.editCats(); App.render();
      }
    });
  }
});

/* view registration + boot ------------------------------------------------ */
App.views.today = App.dashboard;

(function boot() {
  var start = function () { App.init(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
