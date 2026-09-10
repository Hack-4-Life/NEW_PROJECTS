/* =====================================================================
   TrueSpend — Budget Command Center (single-file, offline, private)
   Part 1: utils + demo data + store + calculations
===================================================================== */
"use strict";
const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
const uid=()=> 'id'+Date.now().toString(36)+Math.floor(Math.random()*1e6).toString(36);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const KEY="truespend_v1";

/* ---------- currency ---------- */
const CURS={USD:{s:"$",p:"before"},EUR:{s:"€",p:"before"},GBP:{s:"£",p:"before"},JPY:{s:"¥",p:"before"},INR:{s:"₹",p:"before"},SEK:{s:"kr",p:"after"},NOK:{s:"kr",p:"after"},DKK:{s:"kr",p:"after"},CAD:{s:"$",p:"before"},AUD:{s:"$",p:"before"},ZAR:{s:"R",p:"before"},BRL:{s:"R$",p:"before"},MXN:{s:"$",p:"before"}};
let CUR="USD";
function money(v,dec){
  const c=CURS[CUR]||CURS.USD; v=Number(v)||0;
  const neg=v<0, a=Math.abs(v);
  const str=dec===0?Math.round(a).toLocaleString("en-US"):a.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
  const out=c.p==="before"?c.s+str:str+" "+c.s;
  return (neg?"-":"")+out;
}

/* ---------- dates ---------- */
const DAY=86400000;
function dstr(d){d=new Date(d);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function today(){const n=new Date();n.setHours(0,0,0,0);return n;}
function parseD(s){const[a,b,c]=String(s).split("-").map(Number);return new Date(a,b-1,c);}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x;}
function monthKey(d){d=new Date(d);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");}
function fmtD(s){return parseD(s).toLocaleDateString("en-US",{month:"short",day:"numeric"});}
function fmtDlong(s){return parseD(s).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});}
function daysBetween(a,b){return Math.round((parseD(b)-parseD(a))/DAY);}

/* ---------- category meta ---------- */
const CATS={
  groceries:{icon:"🛒",color:"#4ade80",label:"Groceries"},
  dining:{icon:"🍔",color:"#fb923c",label:"Dining Out"},
  transport:{icon:"🚗",color:"#38bdf8",label:"Transport"},
  housing:{icon:"🏠",color:"#a78bfa",label:"Housing"},
  utilities:{icon:"💡",color:"#facc15",label:"Utilities"},
  fun:{icon:"🎉",color:"#f472b6",label:"Fun"},
  shopping:{icon:"🛍️",color:"#fb7185",label:"Shopping"},
  health:{icon:"💊",color:"#2dd4bf",label:"Health"},
  pets:{icon:"🐾",color:"#d946ef",label:"Pets"},
  travel:{icon:"✈️",color:"#60a5fa",label:"Travel"},
  kids:{icon:"🧸",color:"#fbbf24",label:"Kids"},
  personal:{icon:"💈",color:"#c084fc",label:"Personal"},
  income:{icon:"💰",color:"#4ade80",label:"Income"},
  other:{icon:"📦",color:"#94a3b8",label:"Other"}
};
function catOf(id){return CATS[id]||CATS.other;}

/* ---------- demo data (relative to today so it always looks alive) ---------- */
function demoData(){
  const t=today(), Y=t.getFullYear(), M=t.getMonth();
  const D=(day,off=0)=>dstr(new Date(Y,M+off,clamp(day,1,28)));
  const env=[
    {id:"groceries",cap:520},{id:"dining",cap:220},{id:"transport",cap:180},
    {id:"fun",cap:150},{id:"shopping",cap:200},{id:"health",cap:120},{id:"other",cap:100}
  ];
  const T=[];let n=0;
  const push=(date,merchant,cat,amount,note)=>T.push({id:"t"+(++n),date,merchant,cat,amount,note:note||""});
  push(D(1),"Whole Foods","groceries",-86.42);push(D(1),"Shell","transport",-45.00);
  push(D(2),"Salary — Acme Co","income",2450.00);push(D(2),"Netflix","fun",-15.99);
  push(D(3),"Trader Joe's","groceries",-64.18);push(D(3),"Chipotle","dining",-24.60);
  push(D(4),"CVS","health",-32.75);push(D(5),"Uber","transport",-18.40);
  push(D(6),"Target","shopping",-112.30);push(D(7),"Starbucks","dining",-12.85);
  push(D(8),"Shell","transport",-52.10);push(D(9),"Whole Foods","groceries",-94.55);
  push(D(10),"Amazon","shopping",-67.99);push(D(11),"Olive Garden","dining",-58.20);
  push(D(12),"Freelance payout","income",420.00);push(D(12),"PetSmart","other",-44.12);
  push(D(13),"Trader Joe's","groceries",-71.33);push(D(14),"Cinema","fun",-34.00);
  push(D(15),"Salary — Acme Co","income",2450.00);push(D(15),"Rent","housing",-1450.00);
  push(D(16),"AT&T","utilities",-78.40);push(D(17),"Chipotle","dining",-21.15);
  push(D(18),"Whole Foods","groceries",-88.90);push(D(19),"Uber","transport",-22.75);
  push(D(20),"Amazon","shopping",-89.50);push(D(21),"Gym","health",-39.00);
  push(D(22),"Trader Joe's","groceries",-58.44);push(D(23),"Starbucks","dining",-9.60);
  push(D(24),"Spotify","fun",-11.99);push(D(25),"Shell","transport",-48.25);
  push(D(26),"Target","shopping",-74.18);push(D(27),"Chipotle","dining",-26.40);
  push(D(28),"Whole Foods","groceries",-79.61);
  // prior months for insights
  for(let m=1;m<=5;m++){
    push(D(2,-m),"Salary — Acme Co","income",2450);push(D(15,-m),"Salary — Acme Co","income",2450);
    push(D(15,-m),"Rent","housing",-1450);
    push(D(5,-m),"Groceries (month)","groceries",-(380+Math.round(Math.random()*120)));
    push(D(12,-m),"Dining (month)","dining",-(140+Math.round(Math.random()*90)));
    push(D(18,-m),"Transport (month)","transport",-(120+Math.round(Math.random()*60)));
    push(D(22,-m),"Shopping (month)","shopping",-(110+Math.round(Math.random()*120)));
    push(D(25,-m),"Fun (month)","fun",-(70+Math.round(Math.random()*80)));
  }
  const nextPay=addDays(t,((5-t.getDay()+7)%7)||7); // next Friday
  return {
    version:1, setupDone:true, demo:true,
    profile:{name:"Alex",currency:"USD",theme:"midnight",freq:"semimonthly",nextPayday:dstr(nextPay),payAmount:2450,checking:3284.12,simpleMode:false,privacy:false,monthStart:1},
    incomes:[{id:uid(),name:"Salary — Acme Co",amount:2450,freq:"semimonthly"}],
    envelopes:env,
    transactions:T,
    bills:[
      {id:uid(),name:"Rent",amount:1450,dueDay:1,autopay:true,cat:"housing",sub:false,paid:{}},
      {id:uid(),name:"Electric — City Power",amount:96.20,dueDay:9,autopay:true,cat:"utilities",sub:false,paid:{}},
      {id:uid(),name:"AT&T Internet",amount:78.40,dueDay:16,autopay:true,cat:"utilities",sub:false,paid:{}},
      {id:uid(),name:"Car Insurance",amount:142.00,dueDay:21,autopay:false,cat:"transport",sub:false,paid:{}},
      {id:uid(),name:"Visa — min payment",amount:85.00,dueDay:24,autopay:false,cat:"other",sub:false,paid:{}},
      {id:uid(),name:"Netflix",amount:15.99,dueDay:2,autopay:true,cat:"fun",sub:true,paid:{}},
      {id:uid(),name:"Spotify",amount:11.99,dueDay:24,autopay:true,cat:"fun",sub:true,paid:{}},
      {id:uid(),name:"Gym",amount:39.00,dueDay:21,autopay:true,cat:"health",sub:true,paid:{}},
      {id:uid(),name:"iCloud+",amount:2.99,dueDay:11,autopay:true,cat:"other",sub:true,paid:{}}
    ],
    debts:[
      {id:uid(),name:"Visa •• 4412",balance:3420,apr:21.9,min:85},
      {id:uid(),name:"Car Loan",balance:8750,apr:6.4,min:240},
      {id:uid(),name:"Student Loan",balance:5200,apr:4.8,min:110}
    ],
    goals:[
      {id:uid(),name:"Emergency Fund",target:9000,saved:5760,deadline:dstr(new Date(Y+1,5,1)),color:"#d8b45a",icon:"🛟"},
      {id:uid(),name:"Japan Trip",target:3200,saved:1450,deadline:dstr(new Date(Y,11,15)),color:"#38bdf8",icon:"✈️"},
      {id:uid(),name:"New Laptop",target:1800,saved:640,deadline:dstr(new Date(Y,M+4,1)),color:"#f472b6",icon:"💻"}
    ]
  };
}

/* ---------- store ---------- */
let S=null;
function save(){try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}}
function load(){
  try{const raw=localStorage.getItem(KEY);if(raw){S=JSON.parse(raw);return;}}catch(e){}
  S=demoData();S.setupDone=false;S.demo=true; // first run: demo preloaded, wizard on top
  try{save();}catch(e){}
}
function resetDemo(){S=demoData();save();}
function freshStart(){S={version:1,setupDone:false,demo:false,
  profile:{name:"",currency:"USD",theme:"midnight",freq:"biweekly",nextPayday:dstr(addDays(today(),7)),payAmount:0,checking:0,simpleMode:false,privacy:false,monthStart:1},
  incomes:[],envelopes:[{id:"groceries",cap:500},{id:"dining",cap:200},{id:"transport",cap:180},{id:"fun",cap:150},{id:"shopping",cap:200},{id:"other",cap:100}],
  transactions:[],bills:[],debts:[],goals:[]};}
function applyTheme(){document.documentElement.setAttribute("data-theme",S.profile.theme||"midnight");
  document.body.classList.toggle("privacy",!!S.profile.privacy);
  const meta=document.querySelector('meta[name="theme-color"]');
  const dark=["midnight","vault","blush","ocean"].includes(S.profile.theme);
  if(meta)meta.setAttribute("content",dark?"#0d1017":"#f4efe6");
}

/* =====================================================================
   Calculations
===================================================================== */
function paydaysBetween(fromD,count){
  // generate next `count` paydays from profile.freq starting at nextPayday
  const out=[];let d=parseD(S.profile.nextPayday||"");
  if(isNaN(d))d=addDays(today(),7);
  const f=S.profile.freq;
  if(f==="semimonthly"){
    // paydays on 1st & 15th — find upcoming
    let cur=new Date(Math.max(d,today()));
    for(let guard=0;guard<400&&out.length<count;guard++){
      const dt=new Date(cur.getFullYear(),cur.getMonth(),cur.getDate());
      if((dt.getDate()===1||dt.getDate()===15)&&dt>=today())out.push(new Date(dt));
      cur=addDays(cur,1);
    }
    return out;
  }
  const step=f==="weekly"?7:f==="monthly"?30:14;
  let cur=new Date(d);
  while(cur<today())cur=addDays(cur,step);
  for(let i=0;i<count;i++){out.push(new Date(cur));cur=addDays(cur,step);}
  return out;
}
function nextPayday(){const p=paydaysBetween(today(),1);return p.length?p[0]:addDays(today(),14);}
function billDueDate(bill,refDate){
  const r=new Date(refDate);let dt=new Date(r.getFullYear(),r.getMonth(),clamp(bill.dueDay,1,28));
  return dt;
}
function isBillPaid(bill,refDate){
  const k=monthKey(refDate);
  if(bill.paid&&bill.paid[k])return true;
  // auto-match: a transaction this month with same name-ish & negative amount?
  return false;
}
function billsDueBetween(a,b,includePast){
  // bills with due dates in [a,b], walking month by month
  const out=[];let cur=new Date(a.getFullYear(),a.getMonth(),1);
  const end=new Date(b.getFullYear(),b.getMonth(),1);
  while(cur<=end){
    for(const bill of S.bills){
      const dt=new Date(cur.getFullYear(),cur.getMonth(),clamp(bill.dueDay,1,28));
      if((includePast||dt>=today())&&dt>=a&&dt<=b&&!isBillPaid(bill,dt))out.push({bill,date:dt});
    }
    cur=new Date(cur.getFullYear(),cur.getMonth()+1,1);
  }
  return out.sort((x,y)=>x.date-y.date);
}
function incomeBetween(a,b){
  let total=0;const pays=paydaysBetween(a,12);
  for(const p of pays){if(p>=a&&p<=b)total+=Number(S.profile.payAmount)||0;}
  return total;
}
function txInMonth(refDate){
  const k=monthKey(refDate);
  return S.transactions.filter(t=>monthKey(parseD(t.date))===k);
}
function spentByCat(refDate){
  const m={};for(const t of txInMonth(refDate)){if(t.amount<0)m[t.cat]=(m[t.cat]||0)+Math.abs(t.amount);}
  return m;
}
function monthTotals(refDate){
  let inc=0,exp=0;for(const t of txInMonth(refDate)){if(t.amount>=0)inc+=t.amount;else exp+=Math.abs(t.amount);}
  return{inc,exp,net:inc-exp};
}
function avgDailySpend(){
  const last30=S.transactions.filter(t=>t.amount<0&&daysBetween(t.date,dstr(today()))>=0&&daysBetween(t.date,dstr(today()))<=30);
  let s=0;for(const t of last30)s+=Math.abs(t.amount);
  return last30.length?s/30:45;
}
/* Safe-to-spend: checking + income before next payday − bills due before payday − debt mins − 5% buffer */
function safeToSpend(){
  const t=today(), np=nextPayday();
  const checking=Number(S.profile.checking)||0;
  const inc=incomeBetween(t,addDays(np,-1))+(dstr(np)===dstr(t)?(Number(S.profile.payAmount)||0):0);
  const bills=billsDueBetween(t,np);
  const billTotal=bills.reduce((s,x)=>s+Number(x.bill.amount),0);
  const debtMin=S.debts.reduce((s,d)=>s+Number(d.min),0);
  const buffer=Math.max(0,(checking+inc)*0.03);
  const safe=Math.max(0,checking+inc-billTotal-debtMin-buffer);
  const days=Math.max(1,Math.round((np-t)/DAY));
  return{safe,checking,inc,billTotal,debtMin,buffer,days,perDay:safe/days,bills,np};
}
/* 45-day balance projection */
function projection(days=45){
  const t=today();let bal=Number(S.profile.checking)||0;
  const pays=paydaysBetween(t,8).map(dstr);
  const billMap={};
  for(const b of S.bills){
    for(let m=0;m<3;m++){
      const ref=new Date(t.getFullYear(),t.getMonth()+m,1);
      const dt=new Date(ref.getFullYear(),ref.getMonth(),clamp(b.dueDay,1,28));
      const k=dstr(dt);
      if(!isBillPaid(b,dt))billMap[k]=(billMap[k]||0)+Number(b.amount);
    }
  }
  const daily=avgDailySpend()*0.55; // discretionary burn estimate
  const pts=[{d:dstr(t),bal}];
  for(let i=1;i<=days;i++){
    const dt=addDays(t,i),k=dstr(dt);
    if(pays.includes(k))bal+=Number(S.profile.payAmount)||0;
    if(billMap[k])bal-=billMap[k];
    bal-=daily;
    pts.push({d:k,bal});
  }
  return pts;
}
/* Debt payoff simulator: returns {months,interest,order[]} */
function simulateDebts(debts,extra,method){
  const ds=debts.map(d=>({...d,balance:Number(d.balance),apr:Number(d.apr),min:Number(d.min)}));
  const order=ds.slice().sort((a,b)=>method==="snowball"?a.balance-b.balance:b.apr-a.apr).map(d=>d.id);
  const rank={};order.forEach((id,i)=>rank[id]=i);
  let months=0,interest=0,payment=0;
  const baseMin=ds.reduce((s,d)=>s+d.min,0);
  const monthly=baseMin+Math.max(0,extra);
  for(let guard=0;guard<600;guard++){
    if(ds.every(d=>d.balance<=0))break;
    months++;
    for(const d of ds){if(d.balance>0){const i=d.balance*(d.apr/100/12);d.balance+=i;interest+=i;}}
    let pool=monthly;
    const act=ds.filter(d=>d.balance>0).sort((a,b)=>rank[a.id]-rank[b.id]);
    for(const d of act){const p=Math.min(d.balance,Math.min(d.min,pool));d.balance-=p;pool-=p;payment+=p;}
    for(const d of act){if(pool<=0.005)break;if(d.balance>0){const p=Math.min(d.balance,pool);d.balance-=p;pool-=p;payment+=p;}}
    if(months>=600)break;
  }
  const names=order.map(id=>{const d=debts.find(x=>x.id===id);return d?d.name:"";});
  return{months,interest,totalPaid:payment+interest*0+payment*0+ (function(){return 0;})(),order:names,monthly};
}
function debtSummary(){
  const total=S.debts.reduce((s,d)=>s+Number(d.balance),0);
  const mins=S.debts.reduce((s,d)=>s+Number(d.min),0);
  return{total,mins};
}
/* Insights: last 6 months income vs expense */
function last6(){
  const t=today(),out=[];
  for(let i=5;i>=0;i--){
    const ref=new Date(t.getFullYear(),t.getMonth()-i,1);
    const{inc,exp}=monthTotals(ref);
    out.push({label:ref.toLocaleDateString("en-US",{month:"short"}),inc,exp});
  }
  return out;
}
