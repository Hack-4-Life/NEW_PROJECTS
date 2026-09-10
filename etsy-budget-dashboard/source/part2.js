/* =====================================================================
   Part 2: SVG charts + views (Today / Spend / Bills)
===================================================================== */
function accent(){return getComputedStyle(document.documentElement).getPropertyValue("--accent").trim()||"#d8b45a";}
function trackC(){return getComputedStyle(document.documentElement).getPropertyValue("--track").trim()||"#2a3347";}
function subC(){return getComputedStyle(document.documentElement).getPropertyValue("--sub").trim()||"#9aa3b5";}

/* ---------- gauge (safe-to-spend) ---------- */
function gaugeSVG(pct,size=168){
  pct=clamp(pct,0,1);const r=70,c=2*Math.PI*r,off=c*(1-pct*0.75);
  const col=pct>0.5?"var(--good)":pct>0.25?"var(--warn)":"var(--bad)";
  return `<svg width="${size}" height="${size}" viewBox="0 0 168 168">
    <circle cx="84" cy="84" r="${r}" fill="none" stroke="${trackC()}" stroke-width="14" stroke-linecap="round" stroke-dasharray="${c*0.75} ${c}" transform="rotate(135 84 84)"/>
    <circle cx="84" cy="84" r="${r}" fill="none" stroke="${col}" stroke-width="14" stroke-linecap="round" stroke-dasharray="${c*0.75} ${c}" stroke-dashoffset="${c*0.75*(1-pct)}" transform="rotate(135 84 84)" style="transition:stroke-dashoffset .6s"/>
    <text x="84" y="80" text-anchor="middle" fill="${subC()}" font-size="11" font-weight="700" letter-spacing="2">SAFE</text>
    <text x="84" y="104" text-anchor="middle" fill="currentColor" font-size="26" font-weight="800">${Math.round(pct*100)}%</text>
  </svg>`;
}
/* ---------- ring ---------- */
function ringSVG(pct,size=120,stroke=12,label=""){
  pct=clamp(pct,0,1);const r=(size-stroke)/2,c=2*Math.PI*r;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${trackC()}" stroke-width="${stroke}"/>
    <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${accent()}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c*(1-pct)}" transform="rotate(-90 ${size/2} ${size/2})"/>
    <text x="${size/2}" y="${size/2+2}" text-anchor="middle" dominant-baseline="middle" fill="currentColor" font-size="${size*0.2}" font-weight="800">${label}</text>
  </svg>`;
}
/* ---------- donut ---------- */
function donutSVG(segs,size=190){
  const stroke=30,r=(size-stroke)/2,c=2*Math.PI*r;let acc=0,html="";
  const total=segs.reduce((s,x)=>s+x.v,0)||1;
  for(const g of segs){
    const frac=g.v/total;if(frac<=0)continue;
    html+=`<circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${g.color}" stroke-width="${stroke}" stroke-dasharray="${c*frac} ${c}" stroke-dashoffset="${-c*acc}" transform="rotate(-90 ${size/2} ${size/2})"/>`;
    acc+=frac;
  }
  if(!html)html=`<circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${trackC()}" stroke-width="${stroke}"/>`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${html}
    <text x="${size/2}" y="${size/2-6}" text-anchor="middle" fill="${subC()}" font-size="12" font-weight="700">SPENT</text>
    <text x="${size/2}" y="${size/2+18}" text-anchor="middle" fill="currentColor" font-size="20" font-weight="800">${esc(money(total,0))}</text></svg>`;
}
/* ---------- bars ---------- */
function barsSVG(data,w=560,h=220){
  const max=Math.max(1,...data.flatMap(d=>[d.inc,d.exp]));
  const n=data.length,gw=w/n,bw=Math.min(26,(gw-22)/2);
  let html=`<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">`;
  for(let i=0;i<4;i++){const y=10+(h-44)*i/3;html+=`<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="${trackC()}" stroke-width="1"/>`;}
  data.forEach((d,i)=>{
    const cx=gw*i+gw/2,ih=(h-44)*(d.inc/max),eh=(h-44)*(d.exp/max);
    html+=`<rect x="${cx-bw-2}" y="${h-30-ih}" width="${bw}" height="${Math.max(2,ih)}" rx="5" fill="var(--good)" opacity=".85"/>
    <rect x="${cx+2}" y="${h-30-eh}" width="${bw}" height="${Math.max(2,eh)}" rx="5" fill="${accent()}" opacity=".9"/>
    <text x="${cx}" y="${h-10}" text-anchor="middle" fill="${subC()}" font-size="12" font-weight="700">${esc(d.label)}</text>`;
  });
  return html+"</svg>";
}
/* ---------- line (projection) ---------- */
function lineSVG(pts,w=560,h=220){
  const vals=pts.map(p=>p.bal);let min=Math.min(0,...vals),max=Math.max(0,...vals);
  if(max-min<10)max=min+10;
  const X=i=>8+(w-16)*i/(pts.length-1), Y=v=>10+(h-44)*(1-(v-min)/(max-min));
  let d="M"+X(0)+","+Y(pts[0].bal);
  for(let i=1;i<pts.length;i++)d+=" L"+X(i).toFixed(1)+","+Y(pts[i].bal).toFixed(1);
  const zeroY=Y(0);
  let html=`<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">`;
  html+=`<line x1="0" y1="${zeroY}" x2="${w}" y2="${zeroY}" stroke="var(--bad)" stroke-width="1" stroke-dasharray="5 4" opacity=".7"/>`;
  for(let i=0;i<4;i++){const y=10+(h-44)*i/3;html+=`<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="${trackC()}" stroke-width="1"/>`;}
  html+=`<path d="${d} L${X(pts.length-1)},${h-30} L${X(0)},${h-30} Z" fill="${accent()}" opacity=".14"/>
  <path d="${d}" fill="none" stroke="${accent()}" stroke-width="2.5" stroke-linejoin="round"/>`;
  const low=vals.indexOf(Math.min(...vals));
  html+=`<circle cx="${X(low)}" cy="${Y(vals[low])}" r="4.5" fill="var(--bad)"/>
  <text x="${clamp(X(low),60,w-60)}" y="${Y(vals[low])-10}" text-anchor="middle" fill="var(--bad)" font-size="12" font-weight="800">Low ${esc(money(vals[low],0))}</text>
  <text x="8" y="${h-10}" fill="${subC()}" font-size="11" font-weight="700">Today</text>
  <text x="${w-8}" y="${h-10}" text-anchor="end" fill="${subC()}" font-size="11" font-weight="700">Day ${pts.length-1}</text></svg>`;
  return html;
}

/* =====================================================================
   Router + shell
===================================================================== */
const VIEWS=[
  {id:"today",label:"Today",ico:"☀️"},
  {id:"spend",label:"Spend",ico:"🧾"},
  {id:"bills",label:"Bills",ico:"📅"},
  {id:"debts",label:"Debts",ico:"🔥"},
  {id:"goals",label:"Goals",ico:"🎯"},
  {id:"whatif",label:"What-If",ico:"🔮"},
  {id:"insights",label:"Insights",ico:"📊"},
  {id:"settings",label:"Settings",ico:"⚙️"}
];
let cur="today", spendFilter={q:"",cat:"all"}, billMonth=new Date();
function nav(){
  $("#mainNav").innerHTML=VIEWS.map(v=>`<button data-v="${v.id}" class="${cur===v.id?"active":""}"><span class="ico">${v.ico}</span>${v.label}</button>`).join("");
  $("#bottomNav").innerHTML=VIEWS.map(v=>`<button data-v="${v.id}" class="${cur===v.id?"active":""}"><span class="ico">${v.ico}</span>${v.label}</button>`).join("");
  $$("#mainNav button, #bottomNav button").forEach(b=>b.onclick=()=>go(b.dataset.v));
  const np=nextPayday(),dd=Math.max(0,Math.round((np-today())/DAY));
  $("#payPill").textContent=`💵 Payday ${dd===0?"today!":dd===1?"tomorrow":"in "+dd+"d"}`;
}
function go(v){cur=v;save();render();window.scrollTo({top:0});}
function render(){CUR=S.profile.currency||"USD";nav();applyTheme();
  ({today:vToday,spend:vSpend,bills:vBills,debts:vDebts,goals:vGoals,whatif:vWhatif,insights:vInsights,settings:vSettings})[cur]();
  updateSimple();
}
function updateSimple(){
  const s=safeToSpend();
  $("#simpleAmount").textContent=money(s.safe,0);
  $("#simpleSub").textContent=`${money(s.perDay,0)} per day · ${s.days} day${s.days===1?"":"s"} until payday`;
}

/* =====================================================================
   VIEW: Today
===================================================================== */
function vToday(){
  const s=safeToSpend(),mt=monthTotals(today());
  const cls=s.safe<=0?"bad":s.perDay<25?"warn":"good";
  const upcoming=billsDueBetween(today(),addDays(today(),14)).slice(0,5);
  const recent=S.transactions.slice().sort((a,b)=>a.date<b.date?1:-1).slice(0,6);
  const spent=spentByCat(today());
  const proj=projection(45);
  const alerts=[];
  for(const e of S.envelopes){const sp=spent[e.id]||0;
    if(e.cap>0&&sp>e.cap)alerts.push(`<div class="alert bad">⚠️ <b>${esc(catOf(e.id).label)}</b> is ${money(sp-e.cap,0)} over its ${money(e.cap,0)} cap.</div>`);
    else if(e.cap>0&&sp>e.cap*0.85)alerts.push(`<div class="alert warn">👀 <b>${esc(catOf(e.id).label)}</b> is ${Math.round(sp/e.cap*100)}% through its cap.</div>`);}
  const overdue=billsDueBetween(addDays(today(),-40),addDays(today(),-1),true).slice(-3).reverse();
  for(const o of overdue)alerts.push(`<div class="alert bad">🔴 <b>${esc(o.bill.name)}</b> ${money(o.bill.amount)} was due ${fmtD(dstr(o.date))} — mark it paid?</div>`);
  const el=$("#view");
  el.innerHTML=`
  <div class="view-head"><div><h1>Good ${new Date().getHours()<12?"morning":new Date().getHours()<18?"afternoon":"evening"}${S.profile.name?", "+esc(S.profile.name):""} ☀️</h1>
  <p>${fmtDlong(dstr(today()))} · Payday ${fmtD(dstr(s.np))} · ${s.days} day${s.days===1?"":"s"} to go</p></div>
  <div class="head-actions"><button class="btn primary sm" onclick="mTx()">＋ Log expense</button>
  <button class="btn sm" onclick="mBill()">＋ Bill</button></div></div>

  <div class="grid g-hero">
    <div class="hero"><div class="hero-gauge">${gaugeSVG(clamp(s.safe/Math.max(1,(Number(S.profile.checking)||0)+(Number(s.inc)||0)),0,1))}</div>
      <div class="hero-info"><div class="hero-label">Safe to spend</div>
      <div class="hero-amount ${cls} amt">${money(s.safe,0)}</div>
      <div class="hero-sub"><b class="amt">${money(s.perDay,0)}</b> per day until payday · checking <b class="amt">${money(s.checking,0)}</b></div>
      <div class="hero-stats">
        <div class="hstat"><div class="v amt">${money(s.billTotal,0)}</div><div class="l">Bills due</div></div>
        <div class="hstat"><div class="v amt">${money(s.debtMin,0)}</div><div class="l">Debt mins</div></div>
        <div class="hstat"><div class="v amt">+${money(s.inc,0)}</div><div class="l">Income coming</div></div>
      </div></div></div>
    <div class="card"><h3><span class="q">◈</span> This month</h3>
      <div class="kpi accent" style="margin-bottom:10px"><div class="l">Net cash flow</div><div class="v amt">${money(mt.net,0)}</div><div class="s"><span class="amt" style="color:var(--good)">+${money(mt.inc,0)}</span> in · <span class="amt" style="color:var(--bad)">−${money(mt.exp,0)}</span> out</div></div>
      <div class="chips"><span class="chip">Savings rate ${mt.inc>0?Math.round(mt.net/mt.inc*100):0}%</span><span class="chip">~${money(avgDailySpend(),0)}/day burn</span></div>
      <div style="margin-top:12px">${alerts.length?alerts.slice(0,3).join(""):'<div class="alert good">✅ <b>All clear.</b> No envelopes over cap, no overdue bills.</div>'}</div>
    </div>
  </div>

  <div class="grid g2">
    <div class="card"><h3><span class="q">◈</span> 45-day balance forecast</h3><div class="svgwrap">${lineSVG(proj.filter((_,i)=>i%1===0))}</div>
    <div class="legend"><span><i class="dot" style="background:var(--accent)"></i>Projected balance</span><span><i class="dot" style="background:var(--bad)"></i>Low point</span><span>Paydays + bills + avg spend</span></div></div>
    <div class="card"><h3><span class="q">◈</span> Bills due soon</h3>
      <div class="rows">${upcoming.length?upcoming.map(o=>{
        const b=o.bill,c=catOf(b.cat||"other"),dd=Math.round((o.date-today())/DAY);
        return `<div class="rowitem"><div class="ric" style="background:${c.color}">${c.icon}</div>
        <div class="rinfo"><div class="t">${esc(b.name)}</div><div class="s">${dd===0?"Due today":dd===1?"Due tomorrow":fmtD(dstr(o.date))} ${b.autopay?'· <span class="badge auto">autopay</span>':""}</div></div>
        <div class="ramt neg amt">${money(b.amount)}</div>
        <button class="iconbtn" title="Mark paid" onclick="payBill('${b.id}','${dstr(o.date)}')">✓</button></div>`;}).join(""):'<div class="empty"><span class="big">🎉</span>Nothing due in the next 14 days.</div>'}</div>
      <div style="margin-top:12px"><button class="btn ghost sm block" onclick="go('bills')">Open bill calendar →</button></div></div>
  </div>

  <div class="grid g2 mt">
    <div class="card"><h3><span class="q">◈</span> Recent activity</h3>
      <div class="rows">${recent.length?recent.map(t=>txRow(t)).join(""):'<div class="empty"><span class="big">🧾</span>No transactions yet — log your first one!</div>'}</div></div>
    <div class="card"><h3><span class="q">◈</span> Envelopes this month</h3>
      ${S.envelopes.map(e=>{const sp=spent[e.id]||0,p=e.cap>0?sp/e.cap:0,c=catOf(e.id);
        return `<div class="envrow"><div class="envtop"><span class="n">${c.icon} ${c.label}</span>
        <span class="a"><b class="amt">${money(sp,0)}</b> / ${money(e.cap,0)} ${p>1?'<span class="over">OVER</span>':""}</span></div>
        <div class="pbar thin"><i style="width:${clamp(p*100,0,100)}%;${p>1?"background:var(--bad)":p>0.85?"background:var(--warn)":""}"></i></div></div>`;}).join("")}
      <div style="margin-top:12px"><button class="btn ghost sm block" onclick="go('spend')">Manage envelopes →</button></div></div>
  </div>`;
}
function txRow(t){
  const c=catOf(t.cat);
  return `<div class="rowitem"><div class="ric" style="background:${c.color}">${t.amount>=0?"💰":c.icon}</div>
  <div class="rinfo"><div class="t">${esc(t.merchant)}</div><div class="s">${c.label} · ${fmtD(t.date)}${t.note?" · "+esc(t.note):""}</div></div>
  <div class="ramt ${t.amount<0?"neg":"pos"} amt">${t.amount<0?"−":"+"}${money(Math.abs(t.amount))}</div>
  <button class="iconbtn" onclick="mTx('${t.id}')" title="Edit">✎</button>
  <button class="iconbtn" onclick="delTx('${t.id}')" title="Delete">🗑</button></div>`;
}

/* =====================================================================
   VIEW: Spend
===================================================================== */
function vSpend(){
  const spent=spentByCat(today());
  const segs=S.envelopes.map(e=>({label:catOf(e.id).label,color:catOf(e.id).color,v:spent[e.id]||0})).filter(x=>x.v>0);
  let list=S.transactions.slice().sort((a,b)=>a.date<b.date?1:-1);
  if(spendFilter.cat!=="all")list=list.filter(t=>t.cat===spendFilter.cat);
  if(spendFilter.q)list=list.filter(t=>(t.merchant+" "+(t.note||"")).toLowerCase().includes(spendFilter.q.toLowerCase()));
  const el=$("#view");
  el.innerHTML=`
  <div class="view-head"><div><h1>Spend 🧾</h1><p>Log purchases in seconds. Caps keep every category honest.</p></div>
  <div class="head-actions"><button class="btn primary sm" onclick="mTx()">＋ Log</button>
  <button class="btn sm" onclick="mEnvelope()">✉️ Envelopes</button>
  <button class="btn ghost sm" onclick="exportCSV()">⬇ CSV</button></div></div>
  <div class="grid g-hero">
    <div class="card"><h3><span class="q">◈</span> Where it went — ${today().toLocaleDateString("en-US",{month:"long"})}</h3>
      <div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">
        <div>${donutSVG(segs)}</div>
        <div style="flex:1;min-width:200px">${S.envelopes.map(e=>{const sp=spent[e.id]||0,p=e.cap>0?sp/e.cap:0,c=catOf(e.id);
          return `<div class="envrow"><div class="envtop"><span class="n">${c.icon} ${c.label}</span><span class="a"><b class="amt">${money(sp,0)}</b> of ${money(e.cap,0)} left: <b class="amt ${e.cap-sp<0?"over":""}">${money(e.cap-sp,0)}</b></span></div>
          <div class="pbar thin"><i style="width:${clamp(p*100,0,100)}%;${p>1?"background:var(--bad)":p>0.85?"background:var(--warn)":""}"></i></div></div>`;}).join("")}</div>
      </div></div>
    <div class="card"><h3><span class="q">◈</span> Quick add</h3>
      <label class="lbl">Amount</label><input id="qaAmt" type="number" step="0.01" min="0" placeholder="0.00" inputmode="decimal">
      <label class="lbl">What was it?</label><input id="qaMerch" placeholder="e.g. Trader Joe's">
      <label class="lbl">Envelope</label><select id="qaCat">${S.envelopes.map(e=>`<option value="${e.id}">${catOf(e.id).icon} ${catOf(e.id).label}</option>`).join("")}</select>
      <div style="margin-top:14px"><button class="btn primary block" onclick="quickAdd()">Log expense →</button></div>
      <div class="legend"><span>Tip: negative = expense. Income? Use ＋Log → Income.</span></div></div>
  </div>
  <div class="card mt"><h3><span class="q">◈</span> All transactions (${list.length})</h3>
    <div class="searchbar"><input id="spQ" placeholder="🔍 Search merchant or note…" value="${esc(spendFilter.q)}" oninput="spendFilter.q=this.value;vSpendList()"></div>
    <div class="chips" style="margin-bottom:12px">
      <span class="chip ${spendFilter.cat==="all"?"on":""}" onclick="spendFilter.cat='all';render()">All</span>
      ${S.envelopes.map(e=>`<span class="chip ${spendFilter.cat===e.id?"on":""}" onclick="spendFilter.cat='${e.id}';render()">${catOf(e.id).icon} ${catOf(e.id).label}</span>`).join("")}
      <span class="chip ${spendFilter.cat==="income"?"on":""}" onclick="spendFilter.cat='income';render()">💰 Income</span>
    </div>
    <div class="rows" id="spList">${list.slice(0,60).map(t=>txRow(t)).join("")||'<div class="empty"><span class="big">🔍</span>Nothing matches.</div>'}</div>
    ${list.length>60?`<div class="legend"><span>Showing 60 of ${list.length} — search to narrow down.</span></div>`:""}</div>`;
  const q=$("#spQ");if(q){q.focus();q.setSelectionRange(q.value.length,q.value.length);}
}
function vSpendList(){
  let list=S.transactions.slice().sort((a,b)=>a.date<b.date?1:-1);
  if(spendFilter.cat!=="all")list=list.filter(t=>t.cat===spendFilter.cat);
  if(spendFilter.q)list=list.filter(t=>(t.merchant+" "+(t.note||"")).toLowerCase().includes(spendFilter.q.toLowerCase()));
  $("#spList").innerHTML=list.slice(0,60).map(t=>txRow(t)).join("")||'<div class="empty"><span class="big">🔍</span>Nothing matches.</div>';
}
function quickAdd(){
  const amt=parseFloat($("#qaAmt").value),merch=$("#qaMerch").value.trim(),cat=$("#qaCat").value;
  if(!amt||amt<=0||!merch){toast("Enter an amount and a name");return;}
  S.transactions.push({id:uid(),date:dstr(today()),merchant:merch,cat,amount:-Math.abs(amt),note:""});
  S.profile.checking=Math.round(((Number(S.profile.checking)||0)-amt)*100)/100;
  save();render();toast(`Logged ${money(amt)} at ${merch}`);
}

/* =====================================================================
   VIEW: Bills
===================================================================== */
function vBills(){
  const y=billMonth.getFullYear(),m=billMonth.getMonth();
  const first=new Date(y,m,1),startDay=first.getDay();
  const dim=new Date(y,m+1,0).getDate();
  const pays=paydaysBetween(new Date(y,m,1),6).map(dstr);
  const subs=S.bills.filter(b=>b.sub), regs=S.bills.filter(b=>!b.sub);
  const subTotal=subs.reduce((s,b)=>s+Number(b.amount),0);
  const regTotal=regs.reduce((s,b)=>s+Number(b.amount),0);
  const unpaid=regs.filter(b=>!isBillPaid(b,new Date(y,m,clamp(b.dueDay,1,28))));
  let cells="";
  ["S","M","T","W","T","F","S"].forEach(d=>cells+=`<div class="cal-dow">${d}</div>`);
  const prevDim=new Date(y,m,0).getDate();
  for(let i=startDay-1;i>=0;i--)cells+=`<div class="cal-day dim"><div class="dn">${prevDim-i}</div></div>`;
  for(let d=1;d<=dim;d++){
    const dt=new Date(y,m,d),k=dstr(dt),isT=k===dstr(today()),isPay=pays.includes(k);
    let evs="";
    if(isPay)evs+=`<div class="cal-ev pay">💵 Payday</div>`;
    for(const b of S.bills){
      if(clamp(b.dueDay,1,28)===d){
        const paid=isBillPaid(b,dt);
        evs+=`<div class="cal-ev bill ${paid?"paid":""}" title="${esc(b.name)} ${money(b.amount)}">${paid?"✓ ":""}${esc(b.name.length>12?b.name.slice(0,12)+"…":b.name)}</div>`;
      }
    }
    cells+=`<div class="cal-day ${isT?"today":""} ${isPay?"payday":""}"><div class="dn">${d}</div>${evs}</div>`;
  }
  const monthName=first.toLocaleDateString("en-US",{month:"long",year:"numeric"});
  $("#view").innerHTML=`
  <div class="view-head"><div><h1>Bills & subscriptions 📅</h1><p>Every bill, every payday — one calm calendar.</p></div>
  <div class="head-actions"><button class="btn primary sm" onclick="mBill()">＋ Add bill</button></div></div>
  <div class="grid g3">
    <div class="kpi warn"><div class="l">Unpaid this month</div><div class="v amt">${money(unpaid.reduce((s,b)=>s+Number(b.amount),0),0)}</div><div class="s">${unpaid.length} bill${unpaid.length===1?"":"s"} left</div></div>
    <div class="kpi"><div class="l">Monthly bills</div><div class="v amt">${money(regTotal,0)}</div><div class="s">${regs.length} recurring</div></div>
    <div class="kpi bad"><div class="l">Subscriptions</div><div class="v amt">${money(subTotal,0)}/mo</div><div class="s">${money(subTotal*12,0)}/year — audit below 👇</div></div>
  </div>
  <div class="card mt"><h3><span class="q">◈</span> ${monthName} &nbsp; <button class="iconbtn" onclick="billMonth=new Date(${y},${m-1},1);render()">‹</button> <button class="iconbtn" onclick="billMonth=new Date();render()">•</button> <button class="iconbtn" onclick="billMonth=new Date(${y},${m+1},1);render()">›</button></h3>
    <div class="cal">${cells}</div></div>
  <div class="grid g2 mt">
    <div class="card"><h3><span class="q">◈</span> Bills (${regs.length})</h3><div class="rows">
      ${regs.length?regs.slice().sort((a,b)=>a.dueDay-b.dueDay).map(b=>billRow(b,new Date())).join(""):'<div class="empty"><span class="big">📭</span>No bills yet.</div>'}</div></div>
    <div class="card"><h3><span class="q">◈</span> Subscription stack (${subs.length}) — ${money(subTotal,0)}/mo</h3><div class="rows">
      ${subs.length?subs.slice().sort((a,b)=>b.amount-a.amount).map(b=>billRow(b,new Date())).join(""):'<div class="empty"><span class="big">📺</span>No subscriptions tracked.</div>'}
    </div><div class="legend"><span>💡 Cancel one ${money(15)}/mo sub = ${money(180,0)}/year back.</span></div></div>
  </div>`;
}
function billRow(b,ref){
  const paid=isBillPaid(b,ref),c=catOf(b.cat||"other");
  const due=new Date(ref.getFullYear(),ref.getMonth(),clamp(b.dueDay,1,28));
  const dd=Math.round((due-today())/DAY);
  const badge=paid?'<span class="badge paid">✓ paid</span>':dd<0?'<span class="badge overdue">overdue</span>':dd<=3?'<span class="badge due">due soon</span>':b.autopay?'<span class="badge auto">autopay</span>':"";
  return `<div class="rowitem"><div class="ric" style="background:${c.color}">${b.sub?"🔁":c.icon}</div>
  <div class="rinfo"><div class="t">${esc(b.name)}</div><div class="s">Due ${b.dueDay}${["","st","nd","rd"][b.dueDay]||"th"} · ${badge}</div></div>
  <div class="ramt neg amt">${money(b.amount)}</div>
  ${paid?`<button class="iconbtn" title="Undo paid" onclick="unpayBill('${b.id}')">↩</button>`:`<button class="iconbtn" title="Mark paid" onclick="payBill('${b.id}')">✓</button>`}
  <button class="iconbtn" onclick="mBill('${b.id}')" title="Edit">✎</button>
  <button class="iconbtn" onclick="delBill('${b.id}')" title="Delete">🗑</button></div>`;
}
function payBill(id,datestr){
  const b=S.bills.find(x=>x.id===id);if(!b)return;
  const ref=datestr?parseD(datestr):new Date();
  b.paid=b.paid||{};b.paid[monthKey(ref)]=true;
  // also log the spend + reduce checking
  S.transactions.push({id:uid(),date:dstr(today()),merchant:b.name,cat:b.cat||"other",amount:-Math.abs(Number(b.amount)),note:"bill"});
  S.profile.checking=Math.round(((Number(S.profile.checking)||0)-Number(b.amount))*100)/100;
  save();render();toast(`${b.name} marked paid`);
}
function unpayBill(id){
  const b=S.bills.find(x=>x.id===id);if(!b||!b.paid)return;
  delete b.paid[monthKey(new Date())];save();render();toast("Undone");
}
