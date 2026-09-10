/* =====================================================================
   Part 3: views (Debts / Goals / What-If / Insights / Settings)
===================================================================== */
let debtExtra=200,debtMethod="snowball";

/* ---------- DEBTS ---------- */
function vDebts(){
  const ds=debtSummary();
  const snow=simulateDebts(S.debts,debtExtra,"snowball"),ava=simulateDebts(S.debts,debtExtra,"avalanche");
  const pick=debtMethod==="snowball"?snow:ava;
  const freeDate=addDays(today(),pick.months*30);
  const payoff=pick.months>=600?"Never (raise payment!)":freeDate.toLocaleDateString("en-US",{month:"short",year:"numeric"});
  $("#view").innerHTML=`
  <div class="view-head"><div><h1>Debt payoff 🔥</h1><p>Snowball for motivation. Avalanche for math. Either way — freedom.</p></div>
  <div class="head-actions"><button class="btn primary sm" onclick="mDebt()">＋ Add debt</button></div></div>
  <div class="grid g3">
    <div class="kpi bad"><div class="l">Total debt</div><div class="v amt">${money(ds.total,0)}</div><div class="s">${S.debts.length} balance${S.debts.length===1?"":"s"}</div></div>
    <div class="kpi warn"><div class="l">Minimums / month</div><div class="v amt">${money(ds.mins,0)}</div><div class="s">+ ${money(debtExtra,0)} extra = ${money(ds.mins+debtExtra,0)}</div></div>
    <div class="kpi good"><div class="l">Debt-free by</div><div class="v">${S.debts.length?payoff:"—"}</div><div class="s">${S.debts.length?pick.months+" months · "+money(pick.interest,0)+" interest":"Add a debt to simulate"}</div></div>
  </div>
  <div class="grid g2 mt">
    <div class="card"><h3><span class="q">◈</span> Your debts</h3><div class="rows">
      ${S.debts.length?S.debts.map(d=>`<div class="rowitem"><div class="ric" style="background:linear-gradient(135deg,#f87171,#b91c1c)">💳</div>
        <div class="rinfo"><div class="t">${esc(d.name)}</div><div class="s">${d.apr}% APR · min ${money(d.min)}/mo</div></div>
        <div class="ramt neg amt">${money(d.balance)}</div>
        <button class="iconbtn" onclick="mDebt('${d.id}')" title="Edit">✎</button>
        <button class="iconbtn" onclick="delDebt('${d.id}')" title="Delete">🗑</button></div>`).join(""):'<div class="empty"><span class="big">🎉</span>Debt-free! Add one if that changes.</div>'}
    </div></div>
    <div class="card"><h3><span class="q">◈</span> Payoff simulator</h3>
      <div class="chips"><span class="chip ${debtMethod==="snowball"?"on":""}" onclick="debtMethod='snowball';render()">⛄ Snowball (smallest first)</span>
      <span class="chip ${debtMethod==="avalanche"?"on":""}" onclick="debtMethod='avalanche';render()">🏔️ Avalanche (highest APR)</span></div>
      <label class="lbl">Extra payment: <span id="debtExtraLbl">${money(debtExtra,0)}/month</span></label>
      <input type="range" min="0" max="2000" step="25" value="${debtExtra}" oninput="debtExtra=+this.value;document.querySelector('#debtExtraLbl').textContent=money(debtExtra,0)+'/month'" onchange="render()">
      <table class="plan"><tr><th>Strategy</th><th>Months</th><th>Interest</th><th>Debt-free</th></tr>
        <tr style="${debtMethod==="snowball"?"font-weight:800":""}"><td>⛄ Snowball</td><td>${snow.months>=600?"—":snow.months}</td><td class="amt">${money(snow.interest,0)}</td><td>${snow.months>=600?"—":addDays(today(),snow.months*30).toLocaleDateString("en-US",{month:"short",year:"numeric"})}</td></tr>
        <tr style="${debtMethod==="avalanche"?"font-weight:800":""}"><td>🏔️ Avalanche</td><td>${ava.months>=600?"—":ava.months}</td><td class="amt">${money(ava.interest,0)}</td><td>${ava.months>=600?"—":addDays(today(),ava.months*30).toLocaleDateString("en-US",{month:"short",year:"numeric"})}</td></tr></table>
      ${S.debts.length?`<div class="legend"><span>🎯 Attack order: <b>${pick.order.map(esc).join(" → ")}</b></span></div>
      <div class="alert good" style="margin-top:10px">💡 Paying <b class="amt">${money(ds.mins+debtExtra,0)}/mo</b> instead of minimums saves <b class="amt">${money(Math.max(0,simulateDebts(S.debts,0,debtMethod).interest-pick.interest),0)}</b> in interest.</div>`:""}
    </div>
  </div>`;
}

/* ---------- GOALS ---------- */
function vGoals(){
  const total=S.goals.reduce((s,g)=>s+Number(g.saved),0);
  const target=S.goals.reduce((s,g)=>s+Number(g.target),0);
  const pct=target>0?total/target:0;
  const moExp=Math.max(1,monthTotals(today()).exp||2500);
  const em=S.goals.find(g=>/emergency/i.test(g.name));
  const emMonths=em?Number(em.saved)/moExp:0;
  $("#view").innerHTML=`
  <div class="view-head"><div><h1>Savings goals 🎯</h1><p>Your debt down. Your goals up.</p></div>
  <div class="head-actions"><button class="btn primary sm" onclick="mGoal()">＋ New goal</button></div></div>
  <div class="grid g-hero">
    <div class="card"><h3><span class="q">◈</span> All goals — ${Math.round(pct*100)}% funded</h3>
      <div class="pbar"><i style="width:${clamp(pct*100,0,100)}%"></i></div>
      <div class="legend"><span class="amt"><b>${money(total,0)}</b> saved of <b>${money(target,0)}</b></span><span class="amt">Still to go: <b>${money(Math.max(0,target-total),0)}</b></span></div>
      <div class="rows" style="margin-top:14px">
      ${S.goals.length?S.goals.map(g=>{const p=g.target>0?Number(g.saved)/Number(g.target):0;
        const left=Math.max(0,Number(g.target)-Number(g.saved));
        return `<div class="rowitem"><div class="ric" style="background:${esc(g.color||"#d8b45a")}">${esc(g.icon||"🎯")}</div>
        <div class="rinfo" style="flex:2"><div class="t">${esc(g.name)}</div>
          <div class="pbar thin"><i style="width:${clamp(p*100,0,100)}%;background:${esc(g.color||"var(--accent)")}"></i></div>
          <div class="s"><span class="amt"><b>${money(g.saved,0)}</b> / ${money(g.target,0)} (${Math.round(p*100)}%)</span>${g.deadline?" · by "+fmtD(g.deadline):""}${left>0&&g.deadline?" · "+money(left/Math.max(1,Math.ceil(daysBetween(dstr(today()),g.deadline)/30)),0)+"/mo needed":""}</div></div>
        <button class="btn sm" onclick="mContrib('${g.id}')">＋ Add</button>
        <button class="iconbtn" onclick="mGoal('${g.id}')" title="Edit">✎</button>
        <button class="iconbtn" onclick="delGoal('${g.id}')" title="Delete">🗑</button></div>`;}).join(""):'<div class="empty"><span class="big">🎯</span>No goals yet — dream a little!</div>'}
      </div></div>
    <div class="card" style="text-align:center"><h3><span class="q">◈</span> Emergency fund</h3>
      ${em?ringSVG(clamp(emMonths/6,0,1),150,14,Math.round(clamp(emMonths/6,0,1)*100)+"%"):'<div class="empty"><span class="big">🛟</span>Add a goal named “Emergency Fund” to track months of safety.</div>'}
      ${em?`<div class="legend" style="justify-content:center"><span class="amt"><b>${money(em.saved,0)}</b> ≈ <b>${emMonths.toFixed(1)} months</b> of spending</span></div>
      <div class="legend" style="justify-content:center"><span>Target: 3–6 months. You're ${emMonths>=3?"✅ covered":"⏳ building"}.</span></div>
      <div style="margin-top:12px"><button class="btn primary sm" onclick="mContrib('${em.id}')">＋ Boost fund</button></div>`:""}
    </div>
  </div>`;
}

/* ---------- WHAT-IF ---------- */
let wi={price:250,cat:"shopping"};
function vWhatif(){
  const s=safeToSpend();
  const price=Math.max(0,Number(wi.price)||0);
  const spent=spentByCat(today());
  const env=S.envelopes.find(e=>e.id===wi.cat);
  const envSpent=spent[wi.cat]||0, envCap=env?Number(env.cap):0, envLeft=envCap-envSpent-price;
  const newSafe=s.safe-price;
  const ds=debtSummary();
  const delay=ds.mins+debtExtra>0?(price/(ds.mins+debtExtra)):0;
  let verdict,cls,msg;
  if(newSafe<0){verdict="SKIP IT ⛔";cls="skip";msg=`This puts you ${money(-newSafe,0)} past safe-to-spend. Wait until after payday (${fmtD(dstr(s.np))}).`;}
  else if(env&&envLeft<0){verdict="TIGHT ⚠️";cls="tight";msg=`You can afford it overall, but it busts your ${catOf(wi.cat).label} cap by ${money(-envLeft,0)}. Borrow from another envelope or wait.`;}
  else if(s.perDay>0&&price>s.perDay*3){verdict="THINK 🤔";cls="tight";msg=`That's ${(price/s.perDay).toFixed(1)} days of daily budget in one purchase. Sleep on it — if you still want it tomorrow, go.`;}
  else{verdict="GO FOR IT ✅";cls="go";msg=`Fits your budget with ${money(newSafe,0)} safe-to-spend left. Enjoy it guilt-free!`;}
  $("#view").innerHTML=`
  <div class="view-head"><div><h1>Before you spend 🔮</h1><p>Test any “what if” in seconds — no guilt, no math.</p></div></div>
  <div class="grid g2">
    <div class="card"><h3><span class="q">◈</span> The temptation</h3>
      <label class="lbl">Price: <span id="wiPriceLbl">${money(price,0)}</span></label>
      <input type="range" min="5" max="2000" step="5" value="${clamp(price,5,2000)}" oninput="wi.price=+this.value;document.querySelector('#wiPriceLbl').textContent=money(wi.price,0)" onchange="render()">
      <div class="row2" style="margin-top:10px">
        <div><label class="lbl">Exact price</label><input type="number" min="0" step="0.01" value="${price}" onchange="wi.price=+this.value;render()"></div>
        <div><label class="lbl">Envelope</label><select onchange="wi.cat=this.value;render()">${S.envelopes.map(e=>`<option value="${e.id}" ${e.id===wi.cat?"selected":""}>${catOf(e.id).icon} ${catOf(e.id).label}</option>`).join("")}</select></div>
      </div>
      <div class="verdict ${cls}"><div class="vv">${verdict}</div><div style="margin-top:6px;font-size:14px">${msg}</div></div>
    </div>
    <div class="card"><h3><span class="q">◈</span> Impact breakdown</h3>
      <div class="setrow"><div><div class="t">Safe to spend</div><div class="s">Before → after</div></div><div class="amt" style="font-weight:800">${money(s.safe,0)} → <span class="${newSafe<0?"over":""}">${money(Math.max(0,newSafe),0)}</span></div></div>
      <div class="setrow"><div><div class="t">${catOf(wi.cat).icon} ${catOf(wi.cat).label} envelope</div><div class="s">${money(envSpent,0)} spent of ${money(envCap,0)} cap</div></div><div class="amt" style="font-weight:800" class="${envLeft<0?"over":""}">${money(envLeft,0)} left</div></div>
      <div class="setrow"><div><div class="t">Daily budget drain</div><div class="s">${money(s.perDay,0)}/day until payday</div></div><div style="font-weight:800">${s.perDay>0?(price/s.perDay).toFixed(1)+" days":"—"}</div></div>
      <div class="setrow"><div><div class="t">Debt freedom delay</div><div class="s">If the cash went to debt instead</div></div><div style="font-weight:800">~${delay<0.1?"0":delay.toFixed(1)} mo</div></div>
      <div style="margin-top:14px"><button class="btn primary block" onclick="buyIt()">I bought it — log ${money(price,0)} →</button></div>
    </div>
  </div>`;
}
function buyIt(){
  const price=Math.max(0,Number(wi.price)||0);if(!price){toast("Set a price first");return;}
  S.transactions.push({id:uid(),date:dstr(today()),merchant:"What-If purchase",cat:wi.cat,amount:-price,note:""});
  S.profile.checking=Math.round(((Number(S.profile.checking)||0)-price)*100)/100;
  save();go("spend");toast(`Logged ${money(price)}`);
}

/* ---------- INSIGHTS ---------- */
function vInsights(){
  const data=last6();
  const avgSave=data.reduce((s,d)=>s+(d.inc-d.exp),0)/Math.max(1,data.length);
  const best=data.reduce((b,d)=>(d.inc-d.exp)>(b.inc-b.exp)?d:b,data[0]);
  const spent=spentByCat(today());
  const top=Object.entries(spent).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const maxTop=top.length?top[0][1]:1;
  const mt=monthTotals(today());
  $("#view").innerHTML=`
  <div class="view-head"><div><h1>Insights 📊</h1><p>Six months. Zero spreadsheets. The big picture.</p></div>
  <div class="head-actions"><button class="btn ghost sm" onclick="exportCSV()">⬇ Export CSV</button>
  <button class="btn ghost sm" onclick="exportJSON()">⬇ Backup</button></div></div>
  <div class="grid g3">
    <div class="kpi ${avgSave>=0?"good":"bad"}"><div class="l">Avg monthly savings</div><div class="v amt">${money(avgSave,0)}</div><div class="s">last 6 months</div></div>
    <div class="kpi good"><div class="l">Best month</div><div class="v">${esc(best.label)}</div><div class="s amt">kept ${money(best.inc-best.exp,0)}</div></div>
    <div class="kpi accent"><div class="l">Savings rate</div><div class="v">${mt.inc>0?Math.round(mt.net/mt.inc*100):0}%</div><div class="s">this month (aim 20%+)</div></div>
  </div>
  <div class="grid g2 mt">
    <div class="card"><h3><span class="q">◈</span> Income vs spending — 6 months</h3><div class="svgwrap">${barsSVG(data)}</div>
    <div class="legend"><span><i class="dot" style="background:var(--good)"></i>Income</span><span><i class="dot" style="background:var(--accent)"></i>Spending</span></div></div>
    <div class="card"><h3><span class="q">◈</span> Top envelopes this month</h3>
    ${top.length?top.map(([id,v])=>{const c=catOf(id);return `<div class="envrow"><div class="envtop"><span class="n">${c.icon} ${c.label}</span><span class="a"><b class="amt">${money(v,0)}</b></span></div><div class="pbar thin"><i style="width:${v/maxTop*100}%;background:${c.color}"></i></div></div>`;}).join(""):'<div class="empty"><span class="big">📊</span>No spending logged this month.</div>'}
    <div class="legend"><span>💡 Your #1 lever is almost always the top bar. Trim it 10% = ${money((top[0]?.[1]||0)*0.1*12,0)}/year.</span></div></div>
  </div>`;
}

/* ---------- SETTINGS ---------- */
function vSettings(){
  const p=S.profile;
  const themes=[["midnight","Midnight Gold","linear-gradient(135deg,#0d1017 60%,#d8b45a)"],["vault","Vault Green","linear-gradient(135deg,#0a1511 60%,#c9a24b)"],["paper","Paper Light","linear-gradient(135deg,#f4efe6 60%,#b07a2e)"],["blush","Blush Noir","linear-gradient(135deg,#160f16 60%,#e5a4c4)"],["ocean","Ocean","linear-gradient(135deg,#08131f 60%,#38bdf8)"],["lavender","Lavender Mist","linear-gradient(135deg,#efeef7 60%,#6d5bd0)"]];
  $("#view").innerHTML=`
  <div class="view-head"><div><h1>Settings ⚙️</h1><p>Your money, your rules. Everything stays on this device.</p></div></div>
  <div class="grid g2">
    <div class="card"><h3><span class="q">◈</span> You & payday</h3>
      <label class="lbl">Name</label><input value="${esc(p.name)}" onchange="S.profile.name=this.value;save();render()" placeholder="e.g. Alex">
      <div class="row2"><div><label class="lbl">Pay frequency</label><select onchange="S.profile.freq=this.value;save();render()">
        ${["weekly","biweekly","semimonthly","monthly"].map(f=>`<option ${p.freq===f?"selected":""} value="${f}">${f[0].toUpperCase()+f.slice(1)}${f==="semimonthly"?" (1st & 15th)":""}</option>`).join("")}</select></div>
      <div><label class="lbl">Next payday</label><input type="date" value="${p.nextPayday}" onchange="S.profile.nextPayday=this.value;save();render()"></div></div>
      <div class="row2"><div><label class="lbl">Paycheck amount (${esc(CURS[CUR]?.s||"$")})</label><input type="number" min="0" step="0.01" value="${p.payAmount}" onchange="S.profile.payAmount=+this.value;save();render()"></div>
      <div><label class="lbl">Checking balance (${esc(CURS[CUR]?.s||"$")})</label><input type="number" step="0.01" value="${p.checking}" onchange="S.profile.checking=+this.value;save();render()"></div></div>
    </div>
    <div class="card"><h3><span class="q">◈</span> Look & feel</h3>
      <label class="lbl">Currency</label><select onchange="S.profile.currency=this.value;save();render()">${Object.keys(CURS).map(k=>`<option ${CUR===k?"selected":""} value="${k}">${k} (${CURS[k].s})</option>`).join("")}</select>
      <label class="lbl">Theme (6 included)</label>
      <div class="themes">${themes.map(([id,n,sw])=>`<div class="theme-pick ${p.theme===id?"on":""}" onclick="S.profile.theme='${id}';save();render()"><div class="sw" style="background:${sw}"></div><div class="tn">${n}</div></div>`).join("")}</div>
      <div class="setrow"><div><div class="t">👁 Privacy blur</div><div class="s">Hide all amounts when others can see</div></div><div class="toggle ${p.privacy?"on":""}" onclick="S.profile.privacy=!S.profile.privacy;save();render()"></div></div>
    </div>
  </div>
  <div class="grid g2 mt">
    <div class="card"><h3><span class="q">◈</span> Envelopes & caps</h3>
      ${S.envelopes.map(e=>{const c=catOf(e.id);return `<div class="setrow"><div><div class="t">${c.icon} ${c.label}</div><div class="s">Monthly cap</div></div>
      <div style="display:flex;gap:6px;align-items:center"><input type="number" min="0" step="10" value="${e.cap}" style="width:110px" onchange="setCap('${e.id}',this.value)"><button class="iconbtn" onclick="delEnv('${e.id}')">🗑</button></div></div>`;}).join("")}
      <div style="margin-top:12px"><button class="btn ghost sm block" onclick="mEnvelope()">＋ Add envelope</button></div></div>
    <div class="card"><h3><span class="q">◈</span> Data — private & portable</h3>
      <div class="alert good">🔒 <b>100% offline.</b> Your data lives only in this browser. No accounts, no uploads, ever.</div>
      <div class="mrow" style="margin-top:6px"><button class="btn sm" onclick="exportJSON()">⬇ Backup</button><button class="btn sm" onclick="$('#fileInput').click()">⬆ Restore</button></div>
      <div class="mrow"><button class="btn ghost sm" onclick="exportCSV()">⬇ Transactions CSV</button><button class="btn ghost sm" onclick="if(confirm('Start fresh? This erases ALL your data.')){freshStart();save();location.reload();}">🗑 Start fresh</button></div>
      <div class="mrow"><button class="btn ghost sm" onclick="if(confirm('Reload the demo data? Your data will be replaced.')){resetDemo();render();toast('Demo reloaded');}">↩ Reload demo</button></div>
      <div class="legend"><span>TrueSpend v1.0 · single-file app · works in any browser · Add to Home Screen for an app feel</span></div></div>
  </div>`;
}
function setCap(id,v){const e=S.envelopes.find(x=>x.id===id);if(e){e.cap=Math.max(0,+v||0);save();render();}}
function delEnv(id){if(S.envelopes.length<=1){toast("Keep at least one envelope");return;}
  if(!confirm("Delete this envelope? Its transactions stay."))return;
  S.envelopes=S.envelopes.filter(e=>e.id!==id);save();render();}
