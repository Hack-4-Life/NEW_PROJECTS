/* =====================================================================
   Part 4: modals + import/export + wizard + init
===================================================================== */
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.remove("hidden");clearTimeout(t._h);t._h=setTimeout(()=>t.classList.add("hidden"),2400);}
function openModal(html){$("#modalBox").innerHTML=html;$("#modalOverlay").classList.remove("hidden");}
function closeModal(){$("#modalOverlay").classList.add("hidden");}
$("#modalOverlay").addEventListener("click",e=>{if(e.target.id==="modalOverlay")closeModal();});

/* ---------- transaction modal ---------- */
function mTx(id){
  const t=id?S.transactions.find(x=>x.id===id):null;
  const isInc=t?t.amount>=0:false;
  openModal(`<h2>${t?"Edit":"Log"} ${isInc?"income":"transaction"}</h2><div class="msub">${t?"Fix a mistake in seconds.":"Every dollar gets a job."}</div>
  <div class="chips" id="txType"><span class="chip ${!isInc?"on":""}" onclick="txMode='exp';mTxPaint()">− Expense</span><span class="chip ${isInc?"on":""}" onclick="txMode='inc';mTxPaint()">＋ Income</span></div>
  <label class="lbl">Amount</label><input id="mAmt" type="number" step="0.01" min="0" value="${t?Math.abs(t.amount):""}" placeholder="0.00" inputmode="decimal">
  <label class="lbl">Merchant / description</label><input id="mMerch" value="${t?esc(t.merchant):""}" placeholder="e.g. Trader Joe's">
  <div class="row2"><div><label class="lbl">Date</label><input id="mDate" type="date" value="${t?t.date:dstr(today())}"></div>
  <div id="mCatWrap"><label class="lbl">Envelope</label><select id="mCat">${S.envelopes.map(e=>`<option value="${e.id}" ${t&&t.cat===e.id?"selected":""}>${catOf(e.id).icon} ${catOf(e.id).label}</option>`).join("")}</select></div></div>
  <label class="lbl">Note (optional)</label><input id="mNote" value="${t?esc(t.note||""):""}" placeholder="…">
  <div class="mrow"><button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="saveTx('${id||""}')">Save ✓</button></div>`);
  window.txMode=isInc?"inc":"exp";mTxPaint(true);
  setTimeout(()=>{const a=$("#mAmt");if(a&&!t)a.focus();},50);
}
function mTxPaint(keep){
  $$("#txType .chip")[0].classList.toggle("on",txMode==="exp");
  $$("#txType .chip")[1].classList.toggle("on",txMode==="inc");
  if(txMode==="inc")$("#mCatWrap").innerHTML=`<label class="lbl">Type</label><input value="💰 Income" disabled>`;
  else if(!keep||!$("#mCat"))$("#mCatWrap").innerHTML=`<label class="lbl">Envelope</label><select id="mCat">${S.envelopes.map(e=>`<option value="${e.id}">${catOf(e.id).icon} ${catOf(e.id).label}</option>`).join("")}</select>`;
}
function saveTx(id){
  const amt=Math.abs(parseFloat($("#mAmt").value)||0),merch=$("#mMerch").value.trim()||"Untitled";
  const date=$("#mDate").value||dstr(today()),cat=txMode==="inc"?"income":($("#mCat")?$("#mCat").value:"other");
  const note=$("#mNote").value.trim();
  if(!amt){toast("Enter an amount");return;}
  const signed=txMode==="inc"?amt:-amt;
  if(id){const t=S.transactions.find(x=>x.id===id);
    if(t){ // adjust checking by delta
      const oldEff=t.cat==="income"?t.amount:t.amount; // signed already
      S.profile.checking=Math.round(((Number(S.profile.checking)||0)-oldEff+signed)*100)/100;
      Object.assign(t,{merchant:merch,cat,amount:signed,date,note});
    }
  }else{
    S.transactions.push({id:uid(),merchant:merch,cat,amount:signed,date,note});
    S.profile.checking=Math.round(((Number(S.profile.checking)||0)+signed)*100)/100;
  }
  save();closeModal();render();toast("Saved ✓");
}
function delTx(id){if(!confirm("Delete this transaction?"))return;
  const t=S.transactions.find(x=>x.id===id);
  if(t)S.profile.checking=Math.round(((Number(S.profile.checking)||0)-t.amount)*100)/100;
  S.transactions=S.transactions.filter(x=>x.id!==id);save();render();toast("Deleted");}

/* ---------- bill modal ---------- */
function mBill(id){
  const b=id?S.bills.find(x=>x.id===id):null;
  openModal(`<h2>${b?"Edit":"Add"} bill</h2><div class="msub">Bills land on your calendar + forecast automatically.</div>
  <label class="lbl">Name</label><input id="bName" value="${b?esc(b.name):""}" placeholder="e.g. Electric bill">
  <div class="row2"><div><label class="lbl">Amount</label><input id="bAmt" type="number" step="0.01" min="0" value="${b?b.amount:""}" placeholder="0.00"></div>
  <div><label class="lbl">Due day</label><input id="bDay" type="number" min="1" max="28" value="${b?b.dueDay:1}"></div></div>
  <div class="row2"><div><label class="lbl">Envelope</label><select id="bCat">${Object.keys(CATS).filter(k=>k!=="income").map(k=>`<option value="${k}" ${b&&b.cat===k?"selected":""}>${CATS[k].icon} ${CATS[k].label}</option>`).join("")}</select></div>
  <div><label class="lbl">Type</label><select id="bSub"><option value="0" ${b&&!b.sub?"selected":""}>🧾 Bill</option><option value="1" ${b&&b.sub?"selected":""}>🔁 Subscription</option></select></div></div>
  <div class="setrow"><div><div class="t">Autopay on?</div><div class="s">Still counts in your forecast either way</div></div><div class="toggle ${b&&b.autopay?"on":""}" id="bAuto" onclick="this.classList.toggle('on')"></div></div>
  <div class="mrow"><button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="saveBill('${id||""}')">Save ✓</button></div>`);
}
function saveBill(id){
  const name=$("#bName").value.trim()||"Untitled bill",amount=Math.abs(parseFloat($("#bAmt").value)||0);
  const dueDay=clamp(parseInt($("#bDay").value)||1,1,28),cat=$("#bCat").value;
  const sub=$("#bSub").value==="1",autopay=$("#bAuto").classList.contains("on");
  if(!amount){toast("Enter an amount");return;}
  if(id)Object.assign(S.bills.find(x=>x.id===id),{name,amount,dueDay,cat,sub,autopay});
  else S.bills.push({id:uid(),name,amount,dueDay,cat,sub,autopay,paid:{}});
  save();closeModal();render();toast("Bill saved ✓");
}
function delBill(id){if(!confirm("Delete this bill?"))return;S.bills=S.bills.filter(x=>x.id!==id);save();render();toast("Deleted");}

/* ---------- debt modal ---------- */
function mDebt(id){
  const d=id?S.debts.find(x=>x.id===id):null;
  openModal(`<h2>${d?"Edit":"Add"} debt</h2><div class="msub">The simulator does the snowball math for you.</div>
  <label class="lbl">Name</label><input id="dName" value="${d?esc(d.name):""}" placeholder="e.g. Visa •• 4412">
  <label class="lbl">Balance owed</label><input id="dBal" type="number" step="0.01" min="0" value="${d?d.balance:""}" placeholder="0.00">
  <div class="row2"><div><label class="lbl">APR %</label><input id="dApr" type="number" step="0.1" min="0" value="${d?d.apr:""}"></div>
  <div><label class="lbl">Min / month</label><input id="dMin" type="number" step="0.01" min="0" value="${d?d.min:""}" placeholder="0.00"></div></div>
  <div class="mrow"><button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="saveDebt('${id||""}')">Save ✓</button></div>`);
}
function saveDebt(id){
  const name=$("#dName").value.trim()||"Debt",balance=Math.abs(parseFloat($("#dBal").value)||0);
  const apr=Math.abs(parseFloat($("#dApr").value)||0),min=Math.abs(parseFloat($("#dMin").value)||0);
  if(!balance){toast("Enter a balance");return;}
  if(id)Object.assign(S.debts.find(x=>x.id===id),{name,balance,apr,min});
  else S.debts.push({id:uid(),name,balance,apr,min});
  save();closeModal();render();toast("Debt saved ✓");
}
function delDebt(id){if(!confirm("Delete this debt?"))return;S.debts=S.debts.filter(x=>x.id!==id);save();render();toast("Deleted");}

/* ---------- goal modals ---------- */
const GOAL_COLORS=["#d8b45a","#38bdf8","#f472b6","#4ade80","#a78bfa","#fb923c","#2dd4bf","#f87171"];
function mGoal(id){
  const g=id?S.goals.find(x=>x.id===id):null;
  openModal(`<h2>${g?"Edit":"New"} savings goal</h2><div class="msub">Name it. Fund it. Watch the bar move.</div>
  <label class="lbl">Goal name</label><input id="gName" value="${g?esc(g.name):""}" placeholder="e.g. Japan Trip ✈️">
  <div class="row2"><div><label class="lbl">Target</label><input id="gT" type="number" step="0.01" min="0" value="${g?g.target:""}" placeholder="0.00"></div>
  <div><label class="lbl">Saved so far</label><input id="gS" type="number" step="0.01" min="0" value="${g?g.saved:0}"></div></div>
  <label class="lbl">Deadline (optional)</label><input id="gD" type="date" value="${g&&g.deadline?g.deadline:""}">
  <label class="lbl">Color</label><div class="chips">${GOAL_COLORS.map(c=>`<span class="chip ${g&&g.color===c?"on":""}" style="background:${c};color:#fff;border:0" onclick="pickGoalColor('${c}',this)">●</span>`).join("")}</div>
  <div class="mrow"><button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="saveGoal('${id||""}')">Save ✓</button></div>`);
  window._gc=g?g.color:GOAL_COLORS[0];
}
function pickGoalColor(c,el){window._gc=c;$$("#modalBox .chip").forEach(x=>x.classList.remove("on"));el.classList.add("on");}
function saveGoal(id){
  const name=$("#gName").value.trim()||"My goal",target=Math.abs(parseFloat($("#gT").value)||0);
  const saved=Math.abs(parseFloat($("#gS").value)||0),deadline=$("#gD").value||"";
  if(!target){toast("Enter a target");return;}
  if(id)Object.assign(S.goals.find(x=>x.id===id),{name,target,saved,deadline,color:window._gc});
  else S.goals.push({id:uid(),name,target,saved,deadline,color:window._gc,icon:"🎯"});
  save();closeModal();render();toast("Goal saved ✓");
}
function delGoal(id){if(!confirm("Delete this goal?"))return;S.goals=S.goals.filter(x=>x.id!==id);save();render();toast("Deleted");}
function mContrib(id){
  const g=S.goals.find(x=>x.id===id);if(!g)return;
  openModal(`<h2>＋ Add to ${esc(g.name)}</h2><div class="msub"><span class="amt">${money(g.saved,0)}</span> of <span class="amt">${money(g.target,0)}</span> · <span class="amt">${money(Math.max(0,g.target-g.saved),0)}</span> to go</div>
  <label class="lbl">Amount</label><input id="cAmt" type="number" step="0.01" min="0" placeholder="0.00" inputmode="decimal">
  <div class="mrow"><button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="saveContrib('${id}')">Add ✓</button></div>`);
  setTimeout(()=>$("#cAmt").focus(),50);
}
function saveContrib(id){
  const g=S.goals.find(x=>x.id===id),amt=Math.abs(parseFloat($("#cAmt").value)||0);
  if(!amt){toast("Enter an amount");return;}
  g.saved=Math.round((Number(g.saved)+amt)*100)/100;
  S.transactions.push({id:uid(),date:dstr(today()),merchant:"→ "+g.name,cat:"other",amount:-amt,note:"savings"});
  S.profile.checking=Math.round(((Number(S.profile.checking)||0)-amt)*100)/100;
  save();closeModal();render();toast(`Added ${money(amt)} 🎉${g.saved>=g.target?" — GOAL REACHED! 🏆":""}`);
}

/* ---------- envelope modal ---------- */
function mEnvelope(){
  const avail=Object.keys(CATS).filter(k=>k!=="income"&&!S.envelopes.find(e=>e.id===k));
  openModal(`<h2>Add envelope</h2><div class="msub">Give every dollar a category + a monthly cap.</div>
  ${avail.length?`<label class="lbl">Category</label><select id="eCat">${avail.map(k=>`<option value="${k}">${CATS[k].icon} ${CATS[k].label}</option>`).join("")}</select>
  <label class="lbl">Monthly cap</label><input id="eCap" type="number" step="10" min="0" value="150">
  <div class="mrow"><button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="saveEnv()">Add ✓</button></div>`
  :'<div class="empty"><span class="big">✉️</span>All categories already have envelopes.</div><div class="mrow"><button class="btn primary" onclick="closeModal()">Done</button></div>'}`);
}
function saveEnv(){const id=$("#eCat").value,cap=Math.abs(parseFloat($("#eCap").value)||0);
  S.envelopes.push({id,cap});save();closeModal();render();toast("Envelope added ✓");}

/* ---------- export / import ---------- */
function download(name,text,type){
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),2000);
}
function exportJSON(){download("truespend-backup-"+dstr(today())+".json",JSON.stringify(S,null,1),"application/json");toast("Backup downloaded ⬇");}
function exportCSV(){
  const rows=[["Date","Merchant","Category","Amount","Note"]];
  for(const t of S.transactions.slice().sort((a,b)=>a.date<b.date?-1:1))
    rows.push([t.date,'"'+String(t.merchant).replace(/"/g,'""')+'"',catOf(t.cat).label,t.amount,'"'+String(t.note||"").replace(/"/g,'""')+'"']);
  download("truespend-transactions.csv",rows.map(r=>r.join(",")).join("\n"),"text/csv");toast("CSV downloaded ⬇");
}
$("#fileInput").addEventListener("change",e=>{
  const f=e.target.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=()=>{try{const d=JSON.parse(r.result);
      if(!d.profile||!Array.isArray(d.transactions))throw 0;
      S=d;save();render();toast("Backup restored ✓");
    }catch(err){toast("That file didn't work");}};
  r.readAsText(f);e.target.value="";
});

/* =====================================================================
   Wizard (first run)
===================================================================== */
let wz={step:0,name:"",currency:"USD",theme:"midnight",freq:"biweekly",nextPayday:dstr(addDays(today(),7)),payAmount:"",checking:""};
function showWizard(){
  const w=$("#wizard");w.classList.remove("hidden");
  const steps=["👋 Welcome","💵 Payday","🎨 Theme"];
  let body="";
  if(wz.step===0)body=`<h1>Meet TrueSpend ◈</h1><div class="wsub">Your entire budget — safe-to-spend, bills, debts & goals — in one private file. 60-second setup.</div>
    <label class="lbl">What should we call you?</label><input id="wName" value="${esc(wz.name)}" placeholder="e.g. Alex" oninput="wz.name=this.value">
    <label class="lbl">Currency</label><select onchange="wz.currency=this.value">${Object.keys(CURS).map(k=>`<option ${wz.currency===k?"selected":""} value="${k}">${k} (${CURS[k].s})</option>`).join("")}</select>
    <div class="wnav"><button class="btn ghost" onclick="wzDemo()">Explore demo first</button><button class="btn primary" onclick="wz.step=1;showWizard()">Next →</button></div>`;
  if(wz.step===1)body=`<h1>Payday setup 💵</h1><div class="wsub">This powers your safe-to-spend number + forecast.</div>
    <div class="row2"><div><label class="lbl">Pay frequency</label><select onchange="wz.freq=this.value">${["weekly","biweekly","semimonthly","monthly"].map(f=>`<option ${wz.freq===f?"selected":""} value="${f}">${f}</option>`).join("")}</select></div>
    <div><label class="lbl">Next payday</label><input type="date" value="${wz.nextPayday}" onchange="wz.nextPayday=this.value"></div></div>
    <div class="row2"><div><label class="lbl">Paycheck amount</label><input type="number" min="0" step="0.01" value="${wz.payAmount}" placeholder="0.00" oninput="wz.payAmount=this.value"></div>
    <div><label class="lbl">Checking balance</label><input type="number" step="0.01" value="${wz.checking}" placeholder="0.00" oninput="wz.checking=this.value"></div></div>
    <div class="wnav"><button class="btn ghost" onclick="wz.step=0;showWizard()">← Back</button><button class="btn primary" onclick="wz.step=2;showWizard()">Next →</button></div>`;
  if(wz.step===2)body=`<h1>Pick your vibe 🎨</h1><div class="wsub">6 themes included. Change anytime in Settings.</div>
    <div class="themes">${[["midnight","Midnight Gold","linear-gradient(135deg,#0d1017 60%,#d8b45a)"],["vault","Vault Green","linear-gradient(135deg,#0a1511 60%,#c9a24b)"],["paper","Paper Light","linear-gradient(135deg,#f4efe6 60%,#b07a2e)"],["blush","Blush Noir","linear-gradient(135deg,#160f16 60%,#e5a4c4)"],["ocean","Ocean","linear-gradient(135deg,#08131f 60%,#38bdf8)"],["lavender","Lavender Mist","linear-gradient(135deg,#efeef7 60%,#6d5bd0)"]].map(([id,n,sw])=>`<div class="theme-pick ${wz.theme===id?"on":""}" onclick="wz.theme='${id}';showWizard()"><div class="sw" style="background:${sw}"></div><div class="tn">${n}</div></div>`).join("")}</div>
    <div class="wnav"><button class="btn ghost" onclick="wz.step=1;showWizard()">← Back</button><button class="btn primary" onclick="wzFinish()">Start budgeting →</button></div>`;
  w.innerHTML=`<div class="wizard-card"><div class="brand"><span class="brand-mark">◈</span><div><div class="brand-name">TrueSpend</div><div class="brand-sub">BUDGET COMMAND CENTER</div></div></div>
  <div class="wsteps"><i class="${wz.step>=0?"on":""}"></i><i class="${wz.step>=1?"on":""}"></i><i class="${wz.step>=2?"on":""}"></i></div>
  <div style="font-size:12px;font-weight:800;color:var(--sub);letter-spacing:1px">STEP ${wz.step+1} OF 3 · ${steps[wz.step]}</div>${body}</div>`;
}
function wzDemo(){resetDemo();$("#wizard").classList.add("hidden");render();}
function wzFinish(){
  freshStart();
  S.setupDone=true;
  S.profile.name=wz.name;S.profile.currency=wz.currency;S.profile.theme=wz.theme;
  S.profile.freq=wz.freq;S.profile.nextPayday=wz.nextPayday;
  S.profile.payAmount=Math.abs(parseFloat(wz.payAmount)||0);
  S.profile.checking=parseFloat(wz.checking)||0;
  if(wz.name)S.incomes=[{id:uid(),name:"Paycheck",amount:S.profile.payAmount,freq:wz.freq}];
  save();$("#wizard").classList.add("hidden");render();
  toast("Welcome"+(wz.name?", "+wz.name:"")+"! 🎉");
}

/* =====================================================================
   Init
===================================================================== */
function init(){
  load();CUR=S.profile.currency||"USD";
  $("#btnSimple").onclick=()=>{$("#simpleOverlay").classList.remove("hidden");updateSimple();};
  $("#btnSimpleExit").onclick=()=>$("#simpleOverlay").classList.add("hidden");
  const tog=()=>{S.profile.privacy=!S.profile.privacy;save();applyTheme();toast(S.profile.privacy?"Privacy on 👁":"Privacy off");};
  $("#btnPrivacy").onclick=tog;$("#btnPrivacyM").onclick=tog;
  $("#btnQuickAdd").onclick=()=>mTx();
  document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeModal();$("#simpleOverlay").classList.add("hidden");}});
  render();
  if(!S.setupDone)showWizard();
}
document.addEventListener("DOMContentLoaded",init);
