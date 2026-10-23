"use strict";

const CFG = {
  monthsBeforeBreakingPoint: 3,   
  epilogueMonths: 2,               
  proleStartMoney: 350,
  bourgStartMoney: 2600,
  bourgWinNetWorth: 5500,
  proleWinSavings: 800,
  groceryBase: 320, transport: 90, utilities: 110,
  inflationPerMonth: 0.04,         
};
const DICE_FACES = ["⚀","⚁","⚂","⚃","⚄","⚅"];
const $ = id => document.getElementById(id);
const money = n => (n < 0 ? "-$" : "$") + Math.abs(Math.round(n)).toLocaleString();
const rand = (a,b) => Math.floor(Math.random()*(b-a+1))+a;
const pick = arr => arr[Math.floor(Math.random()*arr.length)];
const clamp = (n,a,b) => Math.max(a, Math.min(b, n));


let audioCtx = null, soundOn = true;
function tone(freq, dur, type, delay, vol){
  if(!soundOn) return;
  try {
    if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if(audioCtx.state === "suspended") audioCtx.resume();
    const t = audioCtx.currentTime + (delay || 0);
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.type = type || "sine"; osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol || 0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(t); osc.stop(t + dur);
  } catch(e) {  }
}
function playSound(name){
  if(name === "click") tone(600, 0.06, "square", 0, 0.05);
  else if(name === "dice"){ tone(220, 0.05, "square", 0, 0.07); tone(300, 0.05, "square", 0.09, 0.07); tone(260, 0.05, "square", 0.18, 0.07); }
  else if(name === "step") tone(500, 0.03, "sine", 0, 0.03);
  else if(name === "cash"){ tone(880, 0.09, "sine", 0, 0.09); tone(1320, 0.14, "sine", 0.08, 0.09); }
  else if(name === "bad"){ tone(220, 0.16, "sawtooth", 0, 0.06); tone(160, 0.22, "sawtooth", 0.12, 0.06); }
  else if(name === "gavel"){ tone(90, 0.18, "square", 0, 0.14); tone(90, 0.18, "square", 0.22, 0.14); }
  else if(name === "win"){ [523,659,784,1046].forEach((f,i) => tone(f, 0.14, "sine", i * 0.09, 0.09)); }
  else if(name === "lose"){ [400,340,280,200].forEach((f,i) => tone(f, 0.18, "triangle", i * 0.12, 0.09)); }
}


const CONDITIONS = [
  { name:"Cut corners", wageMult:0.8,  costPerBiz:0,   healthHit:-6, lawsuitChance:0.18, tension:+7, desc:"Low pay and long hours. Safety gear is old and some of it is broken." },
  { name:"Standard",    wageMult:1.0,  costPerBiz:100, healthHit:-2,  lawsuitChance:0.05, tension:+2,  desc:"Normal pay and normal hours." },
  { name:"Decent",      wageMult:1.25, costPerBiz:250, healthHit:+4,  lawsuitChance:0.01, tension:-4,  desc:"Better pay, proper breaks and safe equipment. It costs more." },
];


const TILES = [
  { name:"PAYDAY",        sub:"Start · payday", type:"payday", cls:"payday corner" },
  { name:"Maple Apartments",   sub:"Buy $300 · Rent $70", type:"property", price:300, rent:70 },
  { name:"Work Shift",    sub:"Put in hours", type:"work" },
  { name:"Chance",        sub:"?", type:"chance", cls:"chance" },
  { name:"FreshMart",     sub:"Buy $400", type:"business", price:400, revenue:1050, workers:3 },
  { name:"Rent Due",      sub:"Landlord calls", type:"rentdue" },
  { name:"Café Rio",      sub:"Buy $350", type:"business", price:350, revenue:900, workers:2 },
  { name:"Union Hall",    sub:"Meet workers", type:"union", cls:"union corner" },
  { name:"Elm Apartments",sub:"Buy $450 · Rent $95", type:"property", price:450, rent:95 },
  { name:"Overtime?",     sub:"Your call", type:"overtime" },
  { name:"Courthouse",    sub:"Someone files suit", type:"court", cls:"court" },
  { name:"Warehouse",     sub:"Buy $500", type:"business", price:500, revenue:1200, workers:4 },
  { name:"Utilities Bill",sub:"Pay up", type:"bills" },
  { name:"Clinic",        sub:"Health matters", type:"clinic" },
  { name:"High Court",    sub:"Lawsuit tile", type:"court", cls:"court corner" },
  { name:"Luxury Lofts",  sub:"Buy $700 · Rent $160", type:"property", price:700, rent:160 },
  { name:"Work Shift",    sub:"Put in hours", type:"work" },
  { name:"Chance",        sub:"?", type:"chance", cls:"chance" },
  { name:"Steel Factory", sub:"Buy $600", type:"business", price:600, revenue:1500, workers:5 },
  { name:"Rent Due",      sub:"Landlord calls", type:"rentdue" },
  { name:"Delivery Depot",sub:"Buy $450", type:"business", price:450, revenue:1000, workers:3 },
  { name:"Public Park",   sub:"Rest · free", type:"rest", cls:"corner" },
  { name:"Studio Apartments",  sub:"Buy $380 · Rent $80", type:"property", price:380, rent:80 },
  { name:"Extra Job?",  sub:"Your call", type:"hustle" },
  { name:"Bus Fare",      sub:"Pay fare", type:"tax" },
  { name:"Office Block",  sub:"Buy $650", type:"business", price:650, revenue:1350, workers:4 },
  { name:"Injury Risk",   sub:"Work hurts", type:"injury" },
  { name:"Chance",        sub:"?", type:"chance", cls:"chance" },
];
TILES.forEach(t => t.owner = null); 


let G = null;
function newGame(role){
  TILES.forEach(t => t.owner = null);
  G = {
    role, pos:0, month:1, phase:"normal", epilogueLeft:0, resolution:null,
    money: role === "bourg" ? CFG.bourgStartMoney : CFG.proleStartMoney,
    health: 80, happiness: 65, solidarity: 10, tension: 15,
    conditions: 1, employerCondition: 1, job:null, housing:null,
    forcedDecentNext: false, coop:false, reform:false, snapshot:null,
    usedActions: {}, dockPay: false,
    busy:false, over:false, started:false,
  };
  if(role === "bourg"){
    
    TILES[6].owner = "you"; TILES[1].owner = "you";
    TILES.forEach(t => { if((t.type==="property"||t.type==="business") && t.owner===null && Math.random()<0.55) t.owner="ai"; });
  } else {
    TILES.forEach(t => { if(t.type==="property"||t.type==="business") t.owner="ai"; });
  }
}


function tileXY(i){
  if(i <= 7)  return [i, 0];
  if(i <= 14) return [7, i-7];
  if(i <= 21) return [7-(i-14), 7];
  return [0, 7-(i-21)];
}
let tileEls = [];
function buildBoard(){
  const board = $("board");
  board.querySelectorAll(".tile").forEach(e => e.remove());
  tileEls = TILES.map((t,i) => {
    const [c,r] = tileXY(i);
    const el = document.createElement("div");
    el.className = "tile " + (t.cls || "");
    el.style.left = (c*12.5) + "%"; el.style.top = (r*12.5) + "%";
    el.innerHTML = `<div class="t-name">${t.name}</div><div class="token"></div><div class="t-sub">${t.sub}</div>`;
    board.appendChild(el);
    return el;
  });
  refreshBoard();
}
function refreshBoard(){
  TILES.forEach((t,i) => {
    tileEls[i].classList.toggle("owned-you", t.owner === "you");
    tileEls[i].classList.toggle("owned-ai", t.owner === "ai");
    const tok = tileEls[i].querySelector(".token");
    tok.textContent = (G && G.pos === i) ? "⬤" : "";
    tok.style.color = G && G.role === "bourg" ? "#e8b33a" : "#6ec1ff";
    tok.style.fontSize = "16px";
  });
}
function feed(text, kind="info"){
  const div = document.createElement("div");
  div.className = kind; div.innerHTML = text;
  const f = $("feed"); f.prepend(div);
  while(f.children.length > 40) f.lastChild.remove();
}
function setCard(html){}


function netWorth(){
  let w = G.money;
  TILES.forEach(t => { if(t.owner === "you") w += t.price; });
  return w;
}
function render(){
  if(!G) return;
  $("monthBadge").textContent = G.phase === "epilogue"
    ? `Last part: ${G.epilogueLeft} month(s) left`
    : `Month ${G.month}`;
  const badge = $("roleBadge");
  badge.textContent = G.role === "bourg" ? "BOURGEOISIE (owner)" : "PROLETARIAT (worker)";
  badge.className = "role-badge " + G.role;
  const sb = $("statsBox");
  if(G.role === "bourg"){
    sb.innerHTML = `
      <div class="stat"><div class="s-label">Cash</div><div class="s-val ${G.money<0?"neg":""}">${money(G.money)}</div></div>
      <div class="stat"><div class="s-label">Total value: cash plus your places (goal ${money(CFG.bourgWinNetWorth)})</div><div class="s-val">${money(netWorth())}</div></div>
      <div class="stat"><div class="s-label">Workers' health</div><div class="s-val">${Math.round(G.health)}%</div></div>`;
    $("meterName").textContent = "Worker anger. At 100% you lose";
    $("meterVal").textContent = Math.round(G.tension) + "%";
    $("meterFill").style.width = clamp(G.tension,0,100) + "%";
    $("meterFill").style.background = G.tension > 70 ? "var(--red)" : "var(--amber)";
    const cond = CONDITIONS[G.conditions];
    $("assetsBox").innerHTML = `What you own<br>` +
      (TILES.map((t,i)=> t.owner==="you" ? (t.type === "property" ? `${t.name}: ${money(t.rent)} rent a month` : `${t.name}: business`) : null).filter(Boolean).join("<br>") || "Nothing yet.") +
      `<br>Conditions now: ${cond.name}`;
    $("actionBox").innerHTML = `<h3>Working conditions</h3><div class="cond-row">` + CONDITIONS.map((c,i)=>
      `<button class="cond-btn ${G.conditions===i?"selected":""}" data-cond="${i}">${c.name}<br>wages x${c.wageMult}</button>`).join("") + `</div><p class="tiny-note">Bad conditions mean more lawsuits.</p>`;
    document.querySelectorAll("[data-cond]").forEach(b => b.onclick = () => {
      G.conditions = +b.dataset.cond; render();
      feed(`You set conditions to ${CONDITIONS[G.conditions].name}.`, G.conditions===0 ? "warn" : "info");
    });
    $("actionBox").innerHTML += `<h3>Make money (once a month)</h3><div class="exploit-grid">
      <button class="exploit-btn" data-exploit="rent" ${G.usedActions.rent ? "disabled" : ""}>Rent up +$220</button>
      <button class="exploit-btn" data-exploit="dock" ${G.usedActions.dock ? "disabled" : ""}>Take pay +$220</button>
      <button class="exploit-btn" data-exploit="overtime" ${G.usedActions.overtime ? "disabled" : ""}>Overtime +$170</button>
      <button class="exploit-btn" data-exploit="safety" ${G.usedActions.safety ? "disabled" : ""}>Cut safety +$150</button></div><p class="tiny-note">These make workers and tenants angry.</p>`;
    document.querySelectorAll("[data-exploit]").forEach(b => b.onclick = () => doExploit(b.dataset.exploit));
  } else {
    sb.innerHTML = `
      <div class="stat"><div class="s-label">Money</div><div class="s-val ${G.money<0?"neg":"pos"}">${money(G.money)}</div></div>
      <div class="stat"><div class="s-label">Savings goal</div><div class="s-val">${money(CFG.proleWinSavings)}</div></div>
      <div class="stat"><div class="s-label">Health</div><div class="s-val">${Math.round(G.health)}%</div></div>
`;
    $("meterLabel").style.display = "none"; $("meterBar").style.display = "none";
    $("meterVal").textContent = Math.round(G.solidarity) + "%";
    $("meterFill").style.width = clamp(G.solidarity,0,100) + "%";
    $("meterFill").style.background = "var(--blue)";
    $("assetsBox").innerHTML =
      `Job: ${G.job ? `${G.job.title}, ${money(G.job.wage)} a month` : "none"}<br>` +
      `Home: ${G.housing ? `${G.housing.name}, ${money(G.housing.rent)} a month` : "none"}<br>` +
      `Bills each month: rent, food and other bills.`;
    $("actionBox").innerHTML = `<h3>Fight back (once a month each)</h3>
      <button class="act-btn" id="walkBtn" ${G.usedActions.walkout ? "disabled" : ""}><b>Stop work together</b><small>Win and your pay goes up. Lose and pay gets cut.</small></button>
      <button class="act-btn" id="rentBtn" ${G.usedActions.rentfight ? "disabled" : ""}><b>Open a lawsuit</b><small>Sue your landlord over a rent charge you do not owe.</small></button>`;
    $("walkBtn").onclick = () => { if(G.usedActions.walkout || G.busy) return; G.usedActions.walkout = true; bossClash("Stop work together", "You and your coworkers stop work and stand outside together. Your boss comes out with security."); };
    $("rentBtn").onclick = () => { if(G.usedActions.rentfight || G.busy) return; G.usedActions.rentfight = true; triggerLawsuit("You are opening a lawsuit against your landlord over a rent charge you do not owe."); };
  }
  refreshBoard();
}


function showModal(html){ $("modalBox").innerHTML = html; $("modalOverlay").classList.remove("hidden"); }
function hideModal(){ $("modalOverlay").classList.add("hidden"); }
function choiceBtn(label, sub){ return `<button class="choice-btn"><b>${label}</b>${sub ? `<small>${sub}</small>` : ""}</button>`; }
function wireChoices(fn){
  document.querySelectorAll("#modalBox .choice-btn").forEach((b,i) => b.onclick = () => { hideModal(); fn(i); });
}


const JOB_TITLES = ["Warehouse picker","Café barista","Delivery rider","Factory line worker","Supermarket stacker","Cleaner (nights)","Call-centre agent","Fast-food crew"];
function genJobs(){
  return [0,1,2].map(() => {
    const cond = Math.random() < 0.45 ? 0 : (Math.random() < 0.65 ? 1 : 2);
    const base = rand(1250, 1650);
    const wage = Math.round(base * (cond === 0 ? 1.12 : cond === 2 ? 0.94 : 1.0)); 
    return { title: pick(JOB_TITLES), wage, cond };
  });
}
function jobModal(first){
  const jobs = genJobs();
  showModal(`<h2>${first ? "First: find work" : "Job centre"}</h2>
    <p>These are the jobs you can pick from. Some jobs pay more and have worse conditions. Pick one to start.</p>
    ${jobs.map(j => choiceBtn(`${j.title}, ${money(j.wage)}/month`, `Conditions: ${CONDITIONS[j.cond].name}. ${CONDITIONS[j.cond].desc}`)).join("")}`);
  wireChoices(i => {
    G.job = jobs[i]; G.employerCondition = jobs[i].cond;
    feed(`You start as a <b>${G.job.title}</b> at ${money(G.job.wage)}/month. Conditions: ${CONDITIONS[G.employerCondition].name}.`, "info");
    render();
    if(first) housingModal(true); else if(!checkEnd()) paydayLawsuitCheck();
  });
}
const HOUSING = [
  { name:"Shared house room. The walls are damp.", rent:520, health:-3, happy:-4 },
  { name:"Small apartment. The landlord is good.", rent:780, health:0, happy:+2 },
  { name:"New apartment near work.", rent:1050, health:+2, happy:+6 },
];
function housingModal(first){
  showModal(`<h2>${first ? "Now: find somewhere to live" : "Move house"}</h2>
    <p>Pick a place to live. Rent is taken out every month, even if you had a bad month at work.</p>
    ${HOUSING.map(h => choiceBtn(`${h.name}, ${money(h.rent)}/month`, `Health ${h.health>0?"+":""}${h.health} a month`)).join("")}`);
  wireChoices(i => {
    G.housing = HOUSING[i];
    feed(`You move into: <b>${G.housing.name}</b> (${money(G.housing.rent)}/month).`, "info");
    render();
    if(first) finishSetup();
  });
}
function finishSetup(){
  G.started = true; render();
  feed("Month 1. Roll the dice and work your shifts. When you pass PAYDAY you get your wage and then rent and bills are taken out.", "warn");
  $("centreMsg").textContent = "Roll the dice to start. Watch your money and your health.";
}


const LAWYER_TIERS = [ {cost:0,bonus:0,label:"No lawyer, speak for yourself"}, {cost:100,bonus:1,label:"Cheap lawyer (+1)"}, {cost:300,bonus:2,label:"Good law firm (+2)"}, {cost:600,bonus:3,label:"Best law firm (+3)"} ];
function triggerLawsuit(reason){
  if(G.over) return;
  playSound("gavel");
  const youAreWorker = (G.role === "prole");
  
  const oppRoll = Math.random();
  const oppTier = youAreWorker
    ? (oppRoll < 0.55 ? 1 : oppRoll < 0.9 ? 2 : 3)  
    : (oppRoll < 0.7 ? 0 : oppRoll < 0.95 ? 1 : 2); 
  const opp = LAWYER_TIERS[oppTier];
  showModal(`<h2> Lawsuit</h2>
    <p>${reason}</p>
    <p>A judge will decide who wins. Both sides roll one die. Highest total wins. Before the roll, each side can
    spend money on lawyers. Each tier adds points to that side's roll, so the side with more money starts ahead.</p>
    <p>${youAreWorker ? "The company has already paid its lawyers. It has a legal department for this. " : "Your worker has saved up what they can for a lawyer. "}How much do you spend?</p>
    ${choiceBtn(youAreWorker ? "Take $300 and end the case" : "Pay $350 and end the case", "The case ends here. Nobody rolls the dice.")}
    ${LAWYER_TIERS.map((t,i) => choiceBtn(`${t.label}, ${money(t.cost)}`, G.money < t.cost ? "You cannot afford this one." : `Your roll gets +${t.bonus}`)).join("")}`);
  document.querySelectorAll("#modalBox .choice-btn").forEach((b,i) => {
    if(i > 0 && G.money < LAWYER_TIERS[i-1].cost) b.style.opacity = .45;
    b.onclick = () => {
      if(i === 0){
        hideModal();
        if(youAreWorker){ G.money += 300; G.solidarity = clamp(G.solidarity + 5, 0, 100); feed("You took the $300 and ended the case.", "info"); }
        else { G.money -= 350; G.tension = clamp(G.tension + 2, 0, 100); feed("You paid $350 to end the case. Nobody rolled the dice.", "info"); }
        playSound("cash"); render(); checkEnd(); return;
      }
      if(G.money < LAWYER_TIERS[i-1].cost){ feed("You cannot afford that lawyer.", "bad"); return; }
      resolveLawsuit(LAWYER_TIERS[i-1], opp, youAreWorker);
    };
  });
}
function resolveLawsuit(you, opp, youAreWorker){
  G.money -= you.cost;
  const yourDie = rand(1,6), oppDie = rand(1,6);
  const yourTotal = yourDie + you.bonus, oppTotal = oppDie + opp.bonus;
  const tied = yourTotal === oppTotal;
  const youWin = yourTotal > oppTotal;
  const workerWins = !tied && (youAreWorker ? youWin : !youWin);
  showModal(`<h2>The judge decides</h2>
    <div class="lawsuit-dice">
      <div class="side">YOU (${youAreWorker ? "worker" : "owner"})<div class="big-die">${DICE_FACES[yourDie-1]}</div>rolled ${yourDie} + ${you.bonus} lawyers = <b>${yourTotal}</b><br>spent ${money(you.cost)}</div>
      <div class="side">${youAreWorker ? "THE COMPANY" : "YOUR WORKER"}<div class="big-die">${DICE_FACES[oppDie-1]}</div>rolled ${oppDie} + ${opp.bonus} lawyers = <b>${oppTotal}</b><br>spent ${money(opp.cost)}</div>
    </div>
    <p id="lawsuitResult"></p>
    <button class="choice-btn" id="lawsuitOk"><b>Continue</b></button>`);
  const res = $("lawsuitResult");
  if(tied){
    if(youAreWorker){ G.solidarity = clamp(G.solidarity + 3, 0, 100); }
    else { G.tension = clamp(G.tension + 3, 0, 100); }
    res.innerHTML = `<b>It is a tie.</b> Both sides got ${yourTotal}. Nobody wins and nobody pays anything more. You still paid ${money(you.cost)} for your lawyers.`;
    feed(`Lawsuit tied ${yourTotal} to ${oppTotal}. Nobody won.`, "warn"); setCard(`<b>Lawsuit tied.</b> Both sides got ${yourTotal}. Nobody paid anything more.`);
  } else if(workerWins && youAreWorker){
    G.money += 600; G.solidarity = clamp(G.solidarity + 12, 0, 100); G.happiness = clamp(G.happiness + 8, 0, 100);
    res.innerHTML = `<b>You win.</b> The company has to pay you <b>$600</b> and fix the conditions. Your coworkers heard about it and solidarity goes up by 12. It still cost you ${money(you.cost)} to fight it.`;
    feed(" You <b>won</b> your lawsuit and got $600. Your coworkers are talking about it.", "good"); setCard(" <b>Lawsuit won.</b> You got $600.");
  } else if(workerWins && !youAreWorker){
    G.money -= 500; G.tension = clamp(G.tension - 8, 0, 100); G.health = clamp(G.health + 5, 0, 100);
    res.innerHTML = `<b>Your worker wins.</b> You pay <b>$500</b>. They rolled a ${oppDie} and you rolled a ${yourDie}.`;
    feed(" You <b>lost</b> a lawsuit and paid $500.", "bad"); setCard(" <b>Lawsuit lost.</b> You paid $500.");
  } else if(!workerWins && youAreWorker){
    G.money -= 150; G.health = clamp(G.health - 3, 0, 100); G.happiness = clamp(G.happiness - 5, 0, 100); G.solidarity = clamp(G.solidarity + 5, 0, 100);
    res.innerHTML = `<b>You lose.</b> You pay <b>$150</b> in costs. You rolled a ${yourDie}. Their lawyers added +${opp.bonus} to their roll. Your coworkers are angry about it.`;
    feed(" You <b>lost</b> your lawsuit and paid $150 in costs.", "bad"); setCard(" <b>Lawsuit lost.</b> You paid $150 in costs. Their lawyer bonus helped them win.");
  } else {
    G.tension = clamp(G.tension + 8, 0, 100);
    res.innerHTML = `<b>You win.</b> The case is dropped and you pay nothing. Your workers saw you spend ${money(you.cost)} on lawyers to win a case about unsafe work. Worker anger goes up by 8.`;
    feed(" You won the lawsuit. Worker anger goes up by 8 because your workers saw how much you spent on lawyers.", "warn"); setCard(" <b>Lawsuit won.</b> You paid nothing.");
  }
  playSound(tied ? "click" : (youWin ? "win" : "lose"));
  $("lawsuitOk").onclick = () => { hideModal(); render(); checkEnd(); };
  render();
}


function yourClashBonus(){
  if(G.role === "prole") return 1;
  return Math.floor(Math.min(3000, Math.max(0, G.money)) / 1500);
}
function startClash(title, text, oppLabel, oppBonus, onWin, onLose){
  if(G.over) return;
  playSound("gavel");
  const baseBonus = yourClashBonus();
  showModal(`<h2> ${title}</h2>
    <p>${text}</p>
    <p>Both sides roll one die. Highest total wins. Your bonus is <b>+${baseBonus}</b>.</p>
    <p>The other side is <b>${oppLabel}</b> with a bonus of <b>+${oppBonus}</b>.</p>
    ${choiceBtn("Fight with what you have", `Your total will be your die roll plus ${baseBonus}.`)}
    ${G.role === "bourg" ? choiceBtn("Hire security for $150", "Your bonus goes up by 2 for this fight.") : choiceBtn("Fight as a group", "Your bonus is already added above.")}`);
  wireChoices(i => {
    let bonus = baseBonus;
    if(i === 1 && G.role === "bourg"){
      if(G.money > 150){ G.money -= 150; bonus += 2; feed("You paid $150 for security before the fight.", "warn"); }
      else { feed("You did not have $150 spare for security.", "bad"); }
    }
    rollClash(title, bonus, oppLabel, oppBonus, onWin, onLose);
  });
}
function rollClash(title, yourBonus, oppLabel, oppBonus, onWin, onLose){
  const yourDie = rand(1,6), oppDie = rand(1,6);
  const yourTotal = yourDie + yourBonus, oppTotal = oppDie + oppBonus;
  const tied = yourTotal === oppTotal;
  const youWin = yourTotal > oppTotal;
  showModal(`<h2> ${title}</h2>
    <div class="lawsuit-dice">
      <div class="side">YOU (${G.role === "prole" ? "worker" : "owner"})<div class="big-die">${DICE_FACES[yourDie-1]}</div>rolled ${yourDie} plus ${yourBonus} equals <b>${yourTotal}</b></div>
      <div class="side">${oppLabel}<div class="big-die">${DICE_FACES[oppDie-1]}</div>rolled ${oppDie} plus ${oppBonus} equals <b>${oppTotal}</b></div>
    </div>
    <p>${tied ? "<b>It is a tie.</b> Nobody wins this one." : (youWin ? "<b>You win the fight.</b>" : "<b>You lose the fight.</b>")}</p>
    <button class="choice-btn" id="clashOk"><b>Continue</b></button>`);
  playSound(tied ? "click" : (youWin ? "win" : "lose"));
  if(!tied){ if(youWin) onWin(); else onLose(); }
  feed(` ${title}: ${tied ? "tied" : (youWin ? "you <b>won</b>" : "you <b>lost</b>")} ${yourTotal} to ${oppTotal}.`, tied ? "warn" : (youWin ? "good" : "bad"));
  $("clashOk").onclick = () => { hideModal(); render(); checkEnd(); };
  render();
}
function doExploit(kind){
  if(!G || G.busy || G.over || G.usedActions[kind]) return;
  G.usedActions[kind] = true;
  playSound("bad");
  if(kind === "rent"){
    G.money += 220; G.tension = clamp(G.tension + 9, 0, 100);
    feed("You put every rent up and collected an extra $220. Your tenants are furious. Worker anger goes up by 9.", "warn");
    render();
    if(Math.random() < 0.5) setTimeout(() => startClash("Tenants fight the rent rise", "Your tenants will not pay the higher rent. They come to your office together to tell you.", "YOUR TENANTS", 1,
      () => { G.money += 100; G.tension = clamp(G.tension + 5, 0, 100); feed("You kept the rise and charged $100 in fees on top.", "warn"); },
      () => { G.money -= 260; G.tension = clamp(G.tension - 12, 0, 100); feed("The tenants won. You drop the rise and hand back $260.", "bad"); }), 350);
  }
  if(kind === "dock"){
    G.dockPay = true; G.health = clamp(G.health - 5, 0, 100); G.tension = clamp(G.tension + 8, 0, 100);
    feed("You docked pay across your businesses. You will keep an extra $220 at payday. Workers health goes down by 5 and tension goes up by 8.", "warn");
    render();
    if(Math.random() < 0.4) setTimeout(() => workersClash("Workers fight the pay cut", "Your workers found out about the docked pay before payday. They stopped the line and are waiting for you."), 350);
  }
  if(kind === "overtime"){
    G.money += 170; G.health = clamp(G.health - 6, 0, 100); G.tension = clamp(G.tension + 7, 0, 100);
    feed("You forced weekend overtime and made $170. Workers health goes down by 6 and tension goes up by 7.", "warn");
    render();
  }
  if(kind === "safety"){
    G.money += 150; G.health = clamp(G.health - 8, 0, 100); G.tension = clamp(G.tension + 5, 0, 100);
    feed("You cut the safety budget and saved $150. Workers health goes down by 8.", "warn");
    render();
    if(Math.random() < 0.35) setTimeout(() => triggerLawsuit("A worker was hurt after you cut the safety budget. He is suing you."), 350);
  }
  checkEnd();
}
function workersClash(title, text){
  startClash(title, text, "YOUR WORKERS", Math.floor(G.tension / 30),
    () => { G.money -= 250; G.tension = clamp(G.tension - 18, 0, 100); G.health = clamp(G.health + 4, 0, 100); feed("Your workers won. You agree to pay $250 more in wages this month and fix one problem on site.", "bad"); },
    () => { G.tension = clamp(G.tension + 6, 0, 100); G.health = clamp(G.health - 3, 0, 100); feed("Your workers lost and went back in. They are angrier now.", "warn"); });
}
function bossClash(title, text){
  startClash(title, text, G.employerCondition === 0 ? "THE BOSS AND SECURITY" : "THE BOSS", G.employerCondition === 0 ? 2 : 1,
    () => { G.money += 180; if(G.job) G.job.wage += 60; G.solidarity = clamp(G.solidarity + 10, 0, 100); feed("You won. Your boss backs down and your wage goes up by $60 a month.", "good"); },
    () => { G.money -= 100; G.health = clamp(G.health - 4, 0, 100); G.solidarity = clamp(G.solidarity + 6, 0, 100); feed("You lost. You pay $100 in docked pay and your coworkers saw you try.", "bad"); });
}
function landlordClash(){
  startClash("Rent fight", "Your landlord added a charge you never agreed to. Other tenants in the building are watching to see what you do.", "THE LANDLORD", 1,
    () => { G.money += 160; G.happiness = clamp(G.happiness + 6, 0, 100); feed("You won. The charge is dropped and last month overcharge of $160 comes back to you.", "good"); },
    () => { G.money -= 120; G.happiness = clamp(G.happiness - 5, 0, 100); feed("You lost. You pay the $120 charge.", "bad"); });
}


function paydayLawsuitCheck(){
  
  if(G.role === "bourg" && G.tension >= 40 && Math.random() < 0.35){
    workersClash("Strike at payday", "Your workers saw their low pay together and walked out. They want the pay you took back and better working conditions.");
    return;
  }
  if(G.role === "prole" && G.employerCondition === 0 && Math.random() < 0.3){
    showModal(`<h2> Stop work at payday?</h2>
      <p>Your pay is low again. Your coworkers are talking about it.</p>
      ${choiceBtn("Stop work together", "Fight your boss as a group.")}
      ${choiceBtn("Go back to work", "Nothing changes this month.")}`);
    wireChoices(i => { if(i === 0) bossClash("Stop work at payday", "You and your coworkers stop work at payday. Your boss meets you at the front door."); else feed("You all went back to work. The pay stayed the same.", "warn"); });
    return;
  }
  if(G.role === "bourg"){
    const biz = TILES.filter(t => t.owner === "you" && t.type === "business");
    for(const b of biz){
      if(Math.random() < CONDITIONS[G.conditions].lawsuitChance){
        triggerLawsuit(`A worker at <b>${b.name}</b> was hurt working under your "${CONDITIONS[G.conditions].name}" conditions and is suing you.`);
        return;
      }
    }
  } else if(G.job && G.employerCondition === 0 && Math.random() < 0.3){
    showModal(`<h2> Enough?</h2>
      <p>Another month of bad conditions at the ${G.job.title} job. A coworker hurt his back and the safety guard is still missing. People at work are talking about filing a <b>lawsuit</b>.</p>
      ${choiceBtn("File the lawsuit", "A lawyer costs money if you hire one. You still have to pay even if you lose.")}
      ${choiceBtn("Keep your head down", "Nothing changes. Health keeps taking the hit.")}`);
    wireChoices(i => {
      if(i === 0) triggerLawsuit(`You're suing your employer over unsafe, corner-cut working conditions at the ${G.job.title} job.`);
      else { feed("You keep your head down. The guard is still missing.", "warn"); render(); }
    });
  }
}
function payday(){
  G.usedActions = {};
  const infl = Math.pow(1 + CFG.inflationPerMonth, G.month - 1);
  if(G.role === "prole"){
    let wage = G.job ? G.job.wage : 0;
    if(G.coop && G.job) wage += 450; 
    const rent = G.housing ? Math.round(G.housing.rent * (G.reform ? 0.8 : 1)) : 0;
    const bills = Math.round((CFG.groceryBase + CFG.transport + CFG.utilities) * infl);
    const healthHit = G.job ? Math.round(CONDITIONS[G.employerCondition].healthHit * (G.coop ? 0.5 : 1)) : 0;
    G.money += wage - rent - bills;
    G.health = clamp(G.health + healthHit + (G.housing ? G.housing.health : 0), 0, 100);
    G.happiness = clamp(G.happiness + (G.housing ? G.housing.happy : 0) - (G.employerCondition === 0 ? 5 : 0), 0, 100);
    if(G.employerCondition === 0) G.solidarity = clamp(G.solidarity + 6, 0, 100);
    playSound(wage - rent - bills >= 0 ? "cash" : "bad");
    feed(`PAYDAY<br>Wage: +${money(wage)}<br>Rent: -${money(rent)}<br>Food and other bills: -${money(bills)}<br>Health change from work: ${healthHit}`, wage - rent - bills >= 0 ? "info" : "bad");
    setCard(` <b>Payday.</b> You earned ${money(wage)}. After rent and bills you have ${money(wage - rent - bills)} left from it.`);
  } else {
    let income = 0, costs = 0, detail = [];
    const condIdx = G.forcedDecentNext ? 2 : G.conditions;
    const cond = CONDITIONS[condIdx];
    TILES.forEach(t => {
      if(t.owner !== "you") return;
      if(t.type === "property"){ const r = Math.round(t.rent * (G.reform ? 0.8 : 1)); income += r; detail.push(`${t.name}: +${money(r)} rent`); }
      if(t.type === "business"){
        const rev = Math.round(t.revenue * (G.coop ? 0.82 : 1));
        const wages = Math.round(t.workers * 330 * cond.wageMult * (G.coop ? 1.35 : 1));
        income += rev; costs += wages + cond.costPerBiz;
        detail.push(`${t.name}: +${money(rev)}, wages -${money(wages)}, work conditions -${money(cond.costPerBiz)}`);
      }
    });
    if(G.dockPay){ income += 220; G.dockPay = false; detail.push("Extra from taking pay: +$220"); }
    G.money += income - costs;
    G.health = clamp(G.health + cond.healthHit, 0, 100);
    G.tension = clamp(G.tension + cond.tension + (G.health < 40 ? 8 : 0) - (G.coop ? 14 : 0), 0, 100);
    if(G.forcedDecentNext){ G.forcedDecentNext = false; feed("Court order: you ran Decent conditions this month.", "warn"); }
    playSound(income - costs >= 0 ? "cash" : "bad");
    feed(`PAYDAY<br>${detail.join("<br>") || "No places yet."}<br>Money made this month: ${money(income - costs)}<br>Workers health: ${Math.round(G.health)}%<br>Worker anger: ${Math.round(G.tension)}%`, income - costs >= 0 ? "info" : "bad");
    setCard(` <b>Payday.</b> Rent and business income came in. Wages and condition costs went out. The rest is your profit.`);
  }
  render();
  if(G.money <= 0){ checkEnd(); return; }
  setTimeout(() => { if(!G.over) paydayLawsuitCheck(); }, 350);
}


function drawChance(){
  const proleCards = [
    () => { G.money -= 90; return ["bad", " Bus fares went up and your shifts changed. You pay <b>$90</b> extra this month."]; },
    () => { G.happiness = clamp(G.happiness + 10,0,100); G.money -= 40; return ["good", " It is a coworker's birthday. You put $40 in for a gift and cake. You had a good day."]; },
    () => { G.solidarity = clamp(G.solidarity + 10,0,100); return ["info", " A coworker showed everyone the pay list. A new worker is paid more than people who have been there for five years. Your coworkers are on your side more now."]; },
    () => { G.health = clamp(G.health - 8,0,100); G.money -= 120; return ["bad", " You got sick. You lose a paid day and you buy medicine. You pay $120 and health goes down by 8."]; },
    () => { G.money += 150; G.health = clamp(G.health - 5,0,100); return ["warn", " A neighbour pays you $150 to help him move house all weekend. You get the money and health goes down by 5."]; },
    () => { G.money -= 200; return ["bad", " Payroll made a mistake and $200 is missing from your pay. They say they will look into it. You lose $200 for now."]; },
    () => choiceCard(" Hours cut", "Your manager cuts everyone's hours by about a fifth. He says business is slow. The company still posted a profit this quarter.",
      [["Accept the cut", "Your wage will be lower next payday.", () => { if(G.job) G.job.wage = Math.round(G.job.wage * 0.85); G.happiness = clamp(G.happiness-6,0,100); }],
       ["Complain together with your coworkers", "Your manager does not like it.", () => { G.solidarity = clamp(G.solidarity+12,0,100); }]]),
    () => choiceCard(" The boss cut the break", "Your boss says the paid break is gone from today. Your coworkers look at you. The shift has not started yet.",
      [["Refuse and stay out together", "Fight it as a group.", () => bossClash("Break room fight", "You and your coworkers refuse to start until the paid break comes back. Your boss calls security.")],
       ["Start the shift", "You start work and lose the break.", () => { G.happiness = clamp(G.happiness - 5, 0, 100); }]]),
    () => choiceCard(" Rent rise letter", "Your landlord put the rent up by $120 a month and put a letter under your door. Other people in your building got the same letter this morning.",
      [["Knock on doors and fight it together", "Take the landlord on with your neighbours behind you.", () => landlordClash()],
       ["Pay it", "Rent takes more of your wage from now on.", () => { if(G.housing) G.housing = { ...G.housing, rent: G.housing.rent + 60 }; }]]),
    () => choiceCard(" Payday loan offer", "Rent is due on Friday and you get paid on Monday. A loan shop offers you $300 now and you pay back $390.",
      [["Take the loan", "You get $300 now. In a few seconds of game time the shop will take $390 back.", () => { G.money += 300; setTimeout(()=>{ if(!G.over){ G.money -= 390; feed(" The loan shop took <b>$390</b> back. Borrowing $300 cost you $90.", "bad"); render(); checkEnd(); } }, 6000); }],
       ["Say no", "You move money around to pay the bills.", () => { G.happiness = clamp(G.happiness-5,0,100); }]]),
  ];
  const bourgCards = [
    () => { G.money -= 220; return ["bad", " The boiler broke in one of your buildings. Repairs cost you $220. Your tenants have no hot water this week and they are angry."]; },
    () => { G.tension = clamp(G.tension + 7,0,100); G.money += 200; return ["warn", " You put the rent up. You gain $200 and your tenants are angry. Worker anger goes up by 7."]; },
    () => { G.money += 300; return ["good", " Another business on the street closed down. Their customers start coming to yours. You gain $300."]; },
    () => { G.health = clamp(G.health - 6,0,100); G.tension = clamp(G.tension + 6,0,100); return ["bad", " One of your workers got injured and it was in the local news. Workers health goes down by 6 and tension goes up by 6."]; },
    () => choiceCard(" Workers demand a meeting", "Your workers stop work ten minutes early and ask for a meeting about pay. They picked the busiest hour of the day to do it.",
      [["Meet them head on", "Fight it out now. Security costs extra, as usual.", () => workersClash("Meeting turns into a fight", "The meeting went loud fast. Your workers are standing together by the door.")],
       ["Give them $120 and send them back", "It costs you now and buys a quiet month.", () => { G.money -= 120; G.tension = clamp(G.tension - 6, 0, 100); }]]),
    () => choiceCard(" Tenants withhold rent", "Tenants in one of your buildings stopped paying rent together. They want the repairs done before paying their rent.",
      [["Go and face them", "A group of tenants will be there. You can bring help.", () => startClash("Tenants stop paying rent", "Your tenants are waiting together in the hall. They have a long list of repairs they want done.", "YOUR TENANTS", 2,
        () => { G.money += 200; G.tension = clamp(G.tension + 7, 0, 100); feed("You got $200 in back rent moving again. The hallway hates you.", "warn"); },
        () => { G.money -= 240; G.tension = clamp(G.tension - 14, 0, 100); feed("The tenants won. You pay $240 for repairs now.", "bad"); })],
       ["Pay $180 for repairs", "The rent starts again and worker anger drops.", () => { G.money -= 180; G.tension = clamp(G.tension - 8, 0, 100); }]]),
    () => choiceCard(" A buyout offer", "A bigger company offers $900 cash for your best business. You can sell it or keep it and keep getting monthly income from it.",
      [["Sell it", "+$900 now. One less thing making you money every month.", () => { const b = TILES.find(t=>t.owner==="you" && t.type==="business"); if(b){ b.owner="ai"; G.money += 900; } }],
       ["Keep the business", "You keep the monthly income. Worker anger +3 because your staff heard about the offer and got worried.", () => { G.tension = clamp(G.tension+3,0,100); }]]),
    () => choiceCard(" Inspection due", "A safety inspector is coming next week. Your paperwork is not in good shape. Your lawyer offers to sort it out for $250.",
      [["Pay the lawyer $250", "The paperwork gets fixed before the inspector comes.", () => { G.money -= 250; }],
       ["Face the inspection honestly", "You get a $150 fine and a warning. Worker anger +3.", () => { G.money -= 150; G.tension = clamp(G.tension+3,0,100); }]]),
  ];
  const result = pick(G.role === "prole" ? proleCards : bourgCards)();
  if(result){ feed(result[1], result[0]); setCard(result[1]); render(); }
}
function choiceCard(title, text, options){
  showModal(`<h2>${title}</h2><p>${text}</p>${options.map(o => choiceBtn(o[0], o[1])).join("")}`);
  wireChoices(i => { options[i][2](); feed(`${title}: you chose <b>${options[i][0]}</b>.`, "info"); setCard(`<b>${title}.</b> ${text}`); render(); checkEnd(); });
  return null;
}


function resolveTile(){
  if(G.over) return;
  const t = TILES[G.pos];
  $("tileInfo").textContent = "";
  const ownable = t.type === "property" || t.type === "business";
  if(ownable && G.role === "bourg" && t.owner === null){
    showModal(`<h2>${t.name}</h2><p>For sale: <b>${money(t.price)}</b>. ${t.type === "property" ? `Tenants would pay ${money(t.rent)}/month in rent.` : `Takes about ${money(t.revenue)}/month; you'd pay ${t.workers} workers and set their conditions.`} You have ${money(G.money)}.</p>
      ${choiceBtn(`Buy it for ${money(t.price)}`, G.money >= t.price ? "Yours. Its income lands every payday." : "You can't afford this.")}
      ${choiceBtn("Walk away", "It stays on the market. A rival may take it.")}`);
    wireChoices(i => {
      if(i === 0 && G.money >= t.price){ G.money -= t.price; t.owner = "you"; playSound("cash"); feed(`You bought <b>${t.name}</b> for ${money(t.price)}.`, "good"); }
      else if(i === 0){ feed("You do not have enough money to buy it.", "bad"); }
      else if(Math.random() < 0.5){ t.owner = "ai"; feed(`Another owner bought <b>${t.name}</b>.`, "warn"); }
      render(); checkEnd();
    });
    return;
  }
  if(ownable && G.role === "bourg" && t.owner === "you"){ G.money += 40; feed(`You visit <b>${t.name}</b>. It is one of yours and it is running fine. You gain $40.`, "good"); }
  else if(ownable && G.role === "prole"){ const fee = t.type === "property" ? 45 : 30; G.money -= fee; feed(`<b>${t.name}</b> belongs to another owner. You have to pay ${money(fee)} while you are here.`, "warn"); }
  else if(ownable && G.role === "bourg" && t.owner === "ai"){ G.money -= 35; feed(`Another owner has <b>${t.name}</b>. You spend $35 on a meeting there.`, "info"); }

  switch(t.type){
    case "payday": break;
    case "work":
      if(G.role === "prole"){ const earn = rand(90, 150); G.money += earn; G.health = clamp(G.health - 2, 0, 100); feed(`You picked up an extra shift and earned ${money(earn)}. Health goes down by 2.`, "info"); }
      else { G.money += 100; G.tension = clamp(G.tension + 2, 0, 100); feed("You visit one of your workplaces and collect $100. Worker anger goes up by 2.", "info"); }
      break;
    case "chance": drawChance(); break;
    case "rentdue":
      if(G.role === "prole"){ G.money -= 80; G.happiness = clamp(G.happiness - 3, 0, 100); feed("Your landlord charges you an $80 late fee and says the rent will go up soon. ", "bad"); }
      else { G.money += 140; feed("One of your tenants pays rent early because he is scared of late fees. You gain $140.", "good"); }
      break;
    case "bills": { const c = rand(100, 180); G.money -= c; feed(`You pay ${money(c)} for gas, water and electricity.`, "bad"); break; }
    case "tax": { const c = G.role === "bourg" ? rand(80, 160) : rand(30, 70); G.money -= c; feed(`You pay ${money(c)} for bus fares.`, "bad"); break; }
    case "clinic":
      if(G.role === "prole") choiceCard(" The clinic", "Your back hurts from work. An appointment this week costs $80. The free clinic can see you in five weeks.",
        [["Pay $80 and get seen", "Health goes up by 14 and you pay $80.", () => { G.money -= 80; G.health = clamp(G.health + 14, 0, 100); }],
         ["Wait for the free clinic", "You wait five weeks to be seen. Health goes down by 3.", () => { G.health = clamp(G.health - 3, 0, 100); }]]);
      else { G.money -= 80; feed("You pay $80 for health checks for your staff.", "info"); }
      break;
    case "injury":
      if(G.role === "prole"){ const bad = G.employerCondition === 0; G.health = clamp(G.health - (bad ? 8 : 4), 0, 100); feed(bad ? "A pallet nearly fell on you at work because a safety guard was missing. Health goes down by 8." : "You hurt your back at work. Health goes down by 4.", "bad"); if(bad && Math.random() < 0.4) setTimeout(() => triggerLawsuit("You nearly got crushed at work because the safety guard was missing. Your coworkers think you should sue."), 400); }
      else { G.health = clamp(G.health - 3, 0, 100); G.tension = clamp(G.tension + 4, 0, 100); feed("A worker got injured at one of your businesses. Workers health goes down by 3 and tension goes up by 4.", "bad"); }
      break;
    case "union":
      if(G.role === "prole") choiceCard(" Union Hall", "Workers from a few workplaces are meeting here. People are comparing pay and talking about what to do next.",
        [["Organize and make a plan", "You make a plan with other workers.", () => { G.solidarity = clamp(G.solidarity + 14, 0, 100); G.happiness = clamp(G.happiness + 5, 0, 100); }],
         ["Stop work this week", "Win and pay goes up.", () => bossClash("Stop work after the meeting", "Workers from your job stop work after the meeting. Your boss did not think this many people would do it.")]]);
      else { G.tension = clamp(G.tension + 6, 0, 100); feed("Some of your workers went to a meeting at Union Hall. Worker anger goes up by 6.", "warn"); if(Math.random() < 0.35) setTimeout(() => workersClash("Workers come back from Union Hall", "Your workers came back from the meeting together. They have a list of demands and they are not splitting up."), 350); }
      break;
    case "court":
      if(G.role === "prole") choiceCard(" Free legal clinic", "A law student looks at your payslips. She says you have not been paid for all your overtime and you could sue your boss.",
        [["File a lawsuit", "You sue over unpaid overtime and bad conditions at work.", () => triggerLawsuit("You are suing your boss over unpaid overtime and bad conditions at work.")],
         ["Not today", "You are worried you could lose your job if you sue. ", () => { G.happiness = clamp(G.happiness - 3, 0, 100); }]]);
      else if(Math.random() < 0.6) triggerLawsuit("A worker who used to work for you is suing you over the conditions at one of your businesses.");
      else feed("You walk past the courthouse. Nothing happens today.", "info");
      break;
    case "overtime":
      choiceCard("Overtime?", G.role === "prole" ? "Your boss asks if you want to work this weekend. You would earn extra money and lose your days off." : "You can ask your staff to work this weekend. You would earn more money and your workers would get less rest.",
        G.role === "prole"
          ? [["Take it (+$130)", "Health goes down by 7.", () => { G.money += 130; G.health = clamp(G.health-7,0,100); G.happiness = clamp(G.happiness-5,0,100); }],
             ["Refuse", "Keep the weekend.", () => { G.happiness = clamp(G.happiness+6,0,100); }]]
          : [["Order it (+$160)", "Worker anger +7 and workers health goes down by 5.", () => { G.money += 160; G.tension = clamp(G.tension+7,0,100); G.health = clamp(G.health-5,0,100); }],
             ["Let them rest", "Workers health goes up by 5 and worker anger goes down by 4.", () => { G.health = clamp(G.health+5,0,100); G.tension = clamp(G.tension-4,0,100); }]]);
      break;
    case "hustle":
      if(G.role === "prole") choiceCard(" Side hustle?", "A delivery app wants you to deliver food after your normal shifts. The app says you can be your own boss.",
        [["Do deliveries (+$110)", "Health goes down by 8.", () => { G.money += 110; G.health = clamp(G.health-8,0,100); G.happiness = clamp(G.happiness-4,0,100); }],
         ["Say no", "You keep your evenings free.", () => { G.happiness = clamp(G.happiness+5,0,100); }]]);
      else { G.money += 80; feed("Another small investment you own paid you $80.", "good"); }
      break;
    case "rest":
      G.health = clamp(G.health + 6, 0, 100); if(G.role === "prole") G.happiness = clamp(G.happiness + 8, 0, 100);
      G.health = clamp(G.health + 4, 0, 100);
      feed(G.role === "prole" ? "You sit in the park for an hour. Health goes up by 10." : "Your workers get a quiet day and a proper rest. Workers health goes up by 10.", "good");
      break;
  }
  render();
  if(!["court","clinic","overtime","hustle","union"].includes(t.type) && !ownable) checkEnd();
  if(ownable && G.role === "prole") checkEnd();
  
  
  const plainTypes = ["work","bills","tax","rest","union","rentdue","injury"];
  if(!G.over && plainTypes.includes(t.type) && Math.random() < 0.4){
    setTimeout(() => { if(!G.over) drawChance(); }, 350);
  }
}


function rollDice(){
  if(!G || G.busy || G.over || !G.started) return;
  playSound("dice");
  G.busy = true; $("rollBtn").disabled = true;
  const d1 = $("die1"), d2 = $("die2");
  d1.classList.add("rolling"); d2.classList.add("rolling");
  let ticks = 0;
  const spin = setInterval(() => {
    d1.textContent = pick(DICE_FACES); d2.textContent = pick(DICE_FACES);
    if(++ticks > 5){
      clearInterval(spin);
      d1.classList.remove("rolling"); d2.classList.remove("rolling");
      const a = rand(1,6), b = rand(1,6);
      d1.textContent = DICE_FACES[a-1]; d2.textContent = DICE_FACES[b-1];
      moveSteps(a + b);
    }
  }, 70);
}
function moveSteps(steps){
  let left = steps;
  const step = () => {
    if(left-- <= 0){
      $("centreMsg").textContent = `You landed on ${TILES[G.pos].name}.`;
      G.busy = false; $("rollBtn").disabled = false;
      resolveTile();
      return;
    }
    G.pos = (G.pos + 1) % TILES.length;
    playSound("step");
    refreshBoard();
    if(G.pos === 0) onPassPayday();
    setTimeout(step, 85);
  };
  step();
}
function onPassPayday(){
  if(G.phase === "epilogue"){
    G.epilogueLeft--;
    payday();
    if(G.over) return;
    if(G.epilogueLeft <= 0){ G.over = true; render(); setTimeout(() => endGame(false), 600); }
  } else {
    payday();
    if(G.over) return;
    G.month++;
    const heated = (G.role === "bourg" && G.tension >= 75);
    if(G.month > CFG.monthsBeforeBreakingPoint || heated){
      G.pendingBreaking = true;
      const wait = setInterval(() => {
        if(!$("modalOverlay").classList.contains("hidden") || G.busy) return;
        clearInterval(wait); breakingPoint();
      }, 700);
    }
  }
  render();
}


function breakingPoint(){
  if(G.over || G.phase === "epilogue") return;
  G.snapshot = { money:G.money, health:G.health, happiness:G.happiness, tension:G.tension, solidarity:G.solidarity, netWorth:netWorth() };
  G.phase = "epilogue"; G.epilogueLeft = CFG.epilogueMonths;
  showModal(`<h2> Breaking point</h2>
    <p>${G.role === "bourg"
      ? "Your workers are tired of low pay, injuries and lawsuits. They organized together and they want the workplaces run a different way."
      : "Rent is high, pay is low and the conditions at work are bad. Your coworkers have organized together and want the workplaces run a different way."}</p>
    <p>You will play <b>${CFG.epilogueMonths} more months</b> with the option you pick, so you can see what changes.</p>
    ${choiceBtn(" Turn the workplaces into worker co-ops", "The workers own the workplace together. They vote on conditions and the profit gets shared between workers.")}
    ${choiceBtn(" Reform the old system", "Rent rises getlimited and the wages go up. The bourgeoisie still own the businesses and the apartments.")}
    ${choiceBtn(" Keep things the same", "You change nothing and keep running things the way you have been.")}`);
  wireChoices(i => {
    G.resolution = ["coop","reform","double"][i];
    G.coop = G.resolution === "coop"; G.reform = G.resolution === "reform";
    if(G.coop){ G.tension = clamp(G.tension - 35, 0, 100); G.solidarity = clamp(G.solidarity + 20, 0, 100); G.health = clamp(G.health + 8, 0, 100); }
    if(G.reform){ G.tension = clamp(G.tension - 15, 0, 100); if(G.job) G.job.wage += 200; }
    if(G.resolution === "double"){ G.tension = clamp(G.tension + 15, 0, 100); }
    feed(`Breaking point reached. The city chose: <b>${["worker co-ops","reform","doubling down"][i]}</b>. ${CFG.epilogueMonths} months to see what that actually means.`, "warn");
    render();
  });
}


function checkEnd(){
  if(!G || G.over) return false;
  if(G.money <= 0){
    endGame(true, G.role === "prole"
      ? "Bankrupt. Your cash hit $0. Rent is still due and you have nothing to pay it with, so you lose your home. Game over."
      : "Bankrupt. Your cash hit $0. The bank takes the properties and sells them to pay what you owe. Game over.");
    return true;
  }
  if(G.role === "borg" || G.role === "bourg"){
    if(netWorth() >= CFG.bourgWinNetWorth){ G.instantWin = "bourg"; endGame(false); return true; }
  }
  if(G.role === "prole"){
    if(G.money >= CFG.proleWinSavings){ G.instantWin = "prole"; endGame(false); return true; }
    if(G.health <= 0){ endGame(true, "Your health hit zero. You end up in hospital and lose the job while you recover. Game over."); return true; }
  } else {
    if(G.tension >= 100){ endGame(true, "Worker anger hit 100%. Your workers walk out together and your tenants stop paying. You lose."); return true; }
    if(G.health <= 0){ endGame(true, "Your workers are too sick and injured to work. The businesses close. Game over."); return true; }
  }
  return false;
}
function endGame(early, earlyText){
  if(G.over && !early && $("modalOverlay").classList.contains("hidden") === false && G.endedShown) return;
  G.over = true; G.endedShown = true;
  const s = G.snapshot || { money:(G.role==="bourg"?CFG.bourgStartMoney:CFG.proleStartMoney), health:80, happiness:65, tension:15, solidarity:10, netWorth:CFG.bourgStartMoney };
  const won = !early && (G.role === "bourg" ? (netWorth() >= CFG.bourgWinNetWorth || G.coop) : (G.money >= CFG.proleWinSavings || (G.coop && G.money > 0)));
  let verdict;
  if(early) verdict = earlyText;
  else if(G.instantWin === "bourg") verdict = `You reached the goal of ${money(CFG.bourgWinNetWorth)} in total value and won early. Total value is your cash plus what your places are worth. Your workers are at ${Math.round(G.health)}% health and worker anger is at ${Math.round(G.tension)}%.`;
  else if(G.instantWin === "prole") verdict = `You saved ${money(CFG.proleWinSavings)} and hit the goal early. That is enough for a deposit. You did it with your health at ${Math.round(G.health)}%.`;
  else if(G.resolution === "coop") verdict = G.role === "bourg"
    ? "The workplaces became co-ops. The businesses stayed open and the workers got paid better. You make less money than before because the profit is now shared with the workers."
    : "Your workplace became a co-op. Your pay went up because the profit is shared with the workers. The business stayed open and your health stopped dropping so fast. Look at the numbers above to see the change.";
  else if(G.resolution === "reform") verdict = "Rent caps and higher low wages made things a bit easier. Workers still do not own the businesses and owners still take the profit. Look at the numbers above to see how much changed.";
  else if(G.resolution === "double") verdict = "You kept the same system. Look at the numbers above and compare your money with your health and worker anger scores.";
  else verdict = "The run ends.";
  showModal(`<h2>${early ? " Run over" : won ? " You made it work" : " Run over"}</h2>
    <p>${verdict}</p>
    ${G.snapshot ? `<table class="compare-table"><tr><th></th><th>Before the breaking point</th><th>After</th></tr>
      <tr><td>Money ${G.role==="bourg" ? "/ Total value" : ""}</td><td>${money(s.money)}${G.role==="bourg" ? " / " + money(s.netWorth) : ""}</td><td>${money(G.money)}${G.role==="bourg" ? " / " + money(netWorth()) : ""}</td></tr>
      <tr><td>${G.role==="bourg" ? "Workers' health" : "Health"}</td><td>${Math.round(s.health)}%</td><td>${Math.round(G.health)}%</td></tr>
      ${G.role==="bourg" ? `<tr><td>Worker anger</td><td>${Math.round(s.tension)}%</td><td>${Math.round(G.tension)}%</td></tr>` : ""}</table>` : `<p>Final money: <b>${money(G.money)}</b> - Health: <b>${Math.round(G.health)}%</b>${G.role==="bourg" ? ` - Total value: <b>${money(netWorth())}</b> - Worker anger: <b>${Math.round(G.tension)}%</b>` : ""}</p>`}
    <p>Played as: <b>${G.role === "bourg" ? "Bourgeoisie " : "Proletariat ‍"}</b>${G.resolution ? ` · You picked: <b>${{coop:"worker co-ops",reform:"reform",double:"keep things the same"}[G.resolution]}</b>` : ""}</p>
    <button class="choice-btn" id="againBtn"><b> Play again and get a new random class</b></button>`);
  $("againBtn").onclick = () => location.reload();
  playSound(early || !won ? "lose" : "win");
  render();
}


$("playBtn").onclick = () => {
  $("startScreen").classList.add("hidden");
  const role = Math.random() < 0.5 ? "bourg" : "prole";
  newGame(role);
  buildBoard();
  $("roleScreen").classList.remove("hidden");
  const t = $("roleTitle"), d = $("roleDesc");
  if(role === "bourg"){
    t.textContent = " BOURGEOISIE"; t.className = "role-title bourg";
    d.innerHTML = "You own a cafe and a apartment building and you have <b>$2,600</b> in the bank. You get money from rent and from your businesses every month. You pick the wages, the working conditions and the rent. Try to grow your money and keep the city calm enough to keep running.";
  } else {
    t.textContent = "‍ PROLETARIAT"; t.className = "role-title prole";
    d.innerHTML = "You have <b>$350</b> and no property. You need to find a job and a place to live. Rent and bills come out every month. Try to save money and look after your health.";
  }
};
$("startGameBtn").onclick = () => {
  $("roleScreen").classList.add("hidden");
  $("gameScreen").classList.remove("hidden");
  render();
  if(G.role === "prole"){ jobModal(true); }
  else {
    G.started = true;
    showModal(`<h2>What you own</h2>
      <p>You own Cafe Rio and Maple Apartments.</p>
      <ul>
        <li>Pass payday to get rent and business money.</li>
        <li>Pay your workers from that money. What is left is yours.</li>
        <li>Buy places when you land on them.</li>
        <li>Pick working conditions on the right.</li>
        <li>Bad conditions can start lawsuits.</li>
        <li>Goal: reach $5,500 in total value.</li>
        <li>If your cash hits $0, you lose.</li>
      </ul>
      <button class="choice-btn" id="bourgOk">Start Month 1</button>`);
    $("bourgOk").onclick = () => { hideModal(); feed("Month 1. You own Cafe Rio and Maple Apartments. Roll the dice to start.", "warn"); };
  }
};
$("rollBtn").onclick = rollDice;
$("restartBtn").onclick = () => location.reload();
$("soundBtn").onclick = () => { soundOn = !soundOn; $("soundBtn").textContent = soundOn ? "Sound: on" : "Sound: off"; if(soundOn) playSound("click"); };
$("playBtn").addEventListener ? $("playBtn").addEventListener("click", () => playSound("click")) : null;
