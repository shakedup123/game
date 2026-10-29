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


let soundOn = true;
function playSound(name){
  if(!soundOn) return;
  const sound = new Audio("sounds/" + name + ".wav");
  sound.volume = 0.5;
  sound.play().catch(() => {});
}
function changeHealth(amount){
  G.health = Math.max(0, Math.min(100, G.health + amount));
}
function changeWorkerAnger(amount){
  G.tension = Math.max(0, Math.min(100, G.tension + amount));
}
function changeHappiness(amount){
  G.happiness = Math.max(0, Math.min(100, G.happiness + amount));
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
    health: 80, happiness: 65, tension: 15,
    conditions: 1, employerCondition: 1, job:null, housing:null,
    forcedDecentNext: false, coop:false, reform:false, socialism:false, snapshot:null,
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
  const board = document.getElementById("board");
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
  const f = document.getElementById("feed"); f.prepend(div);
  while(f.children.length > 40) f.lastChild.remove();
}


function netWorth(){
  let w = G.money;
  TILES.forEach(t => { if(t.owner === "you") w += t.price; });
  return w;
}
function render(){
  if(!G) return;
  document.getElementById("monthBadge").textContent = G.phase === "epilogue"
    ? `Last part: ${G.epilogueLeft} month(s) left`
    : `Month ${G.month}`;
  const badge = document.getElementById("roleBadge");
  badge.textContent = G.role === "bourg" ? "BOURGEOISIE (owner)" : "PROLETARIAT (worker)";
  badge.className = "role-badge " + G.role;
  const sb = document.getElementById("statsBox");
  if(G.role === "bourg"){
    sb.innerHTML = `
      <div class="stat"><div class="s-label">Cash</div><div class="s-val ${G.money<0?"neg":""}">${((G.money) < 0 ? "-$" : "$") + Math.abs(Math.round((G.money))).toLocaleString()}</div></div>
      <div class="stat"><div class="s-label">Total value: cash plus your places (goal ${((CFG.bourgWinNetWorth) < 0 ? "-$" : "$") + Math.abs(Math.round((CFG.bourgWinNetWorth))).toLocaleString()})</div><div class="s-val">${((netWorth()) < 0 ? "-$" : "$") + Math.abs(Math.round((netWorth()))).toLocaleString()}</div></div>
      <div class="stat"><div class="s-label">Workers' health</div><div class="s-val">${Math.round(G.health)}%</div></div>`;
    document.getElementById("meterName").textContent = "Worker anger. At 100% you lose";
    document.getElementById("meterVal").textContent = Math.round(G.tension) + "%";
    document.getElementById("meterFill").style.width = Math.max((0), Math.min((100), (G.tension))) + "%";
    document.getElementById("meterFill").style.background = G.tension > 70 ? "var(--red)" : "var(--amber)";
    const cond = CONDITIONS[G.conditions];
    document.getElementById("assetsBox").innerHTML = `What you own<br>` +
      (TILES.map((t,i)=> t.owner==="you" ? (t.type === "property" ? `${t.name}: ${((t.rent) < 0 ? "-$" : "$") + Math.abs(Math.round((t.rent))).toLocaleString()} rent a month` : `${t.name}: business`) : null).filter(Boolean).join("<br>") || "Nothing yet.") +
      `<br>Conditions now: ${cond.name}`;
    document.getElementById("actionBox").innerHTML = `<h3>Working conditions</h3><div class="cond-row">` + CONDITIONS.map((c,i)=>
      `<button class="cond-btn ${G.conditions===i?"selected":""}" data-cond="${i}">${c.name}<br>wages x${c.wageMult}</button>`).join("") + `</div><p class="tiny-note">Bad conditions mean more lawsuits.</p>`;
    document.getElementById("actionBox").innerHTML += `<h3>Make money (once a month)</h3><div class="exploit-grid">
      <button class="exploit-btn" data-exploit="rent" ${G.usedActions.rent ? "disabled" : ""}>Rent up +$220</button>
      <button class="exploit-btn" data-exploit="dock" ${G.usedActions.dock ? "disabled" : ""}>Take pay +$220</button>
      <button class="exploit-btn" data-exploit="overtime" ${G.usedActions.overtime ? "disabled" : ""}>Overtime +$170</button>
      <button class="exploit-btn" data-exploit="safety" ${G.usedActions.safety ? "disabled" : ""}>Cut safety +$150</button></div><p class="tiny-note">These make workers and tenants angry.</p>`;
    document.querySelectorAll("[data-cond]").forEach(b => b.onclick = () => {
      G.conditions = +b.dataset.cond; render();
      feed(`You set conditions to ${CONDITIONS[G.conditions].name}.`, G.conditions===0 ? "warn" : "info");
    });
    document.querySelectorAll("[data-exploit]").forEach(b => b.onclick = () => doExploit(b.dataset.exploit));
  } else {
    sb.innerHTML = `
      <div class="stat"><div class="s-label">Money</div><div class="s-val ${G.money<0?"neg":"pos"}">${((G.money) < 0 ? "-$" : "$") + Math.abs(Math.round((G.money))).toLocaleString()}</div></div>
      <div class="stat"><div class="s-label">Savings goal</div><div class="s-val">${((CFG.proleWinSavings) < 0 ? "-$" : "$") + Math.abs(Math.round((CFG.proleWinSavings))).toLocaleString()}</div></div>
      <div class="stat"><div class="s-label">Health</div><div class="s-val">${Math.round(G.health)}%</div></div>
      <div class="stat"><div class="s-label">Happiness</div><div class="s-val">${Math.round(G.happiness)}%</div></div>
`;
    document.getElementById("meterLabel").style.display = "none"; document.getElementById("meterBar").style.display = "none";
    document.getElementById("meterFill").style.background = "var(--blue)";
    document.getElementById("assetsBox").innerHTML =
      `Job: ${G.job ? `${G.job.title}, ${((G.job.wage) < 0 ? "-$" : "$") + Math.abs(Math.round((G.job.wage))).toLocaleString()} a month` : "none"}<br>` +
      `Home: ${G.housing ? `${G.housing.name}, ${((G.housing.rent) < 0 ? "-$" : "$") + Math.abs(Math.round((G.housing.rent))).toLocaleString()} a month` : "none"}<br>` +
      `Bills each month: rent, food and other bills.`;
    document.getElementById("actionBox").innerHTML = `<h3>Fight back (once a month each)</h3>
      <button class="act-btn" id="walkBtn" ${G.usedActions.walkout ? "disabled" : ""}><b>Stop work together</b><small>Win and your pay goes up. Lose and pay gets cut.</small></button>
      <button class="act-btn" id="rentBtn" ${G.usedActions.rentfight ? "disabled" : ""}><b>Open a lawsuit</b><small>Sue your landlord over a rent charge you do not owe.</small></button>`;
    document.getElementById("walkBtn").onclick = () => { if(G.usedActions.walkout || G.busy) return; G.usedActions.walkout = true; bossClash("Stop work together", "You and your coworkers stop work and stand outside together. Your boss comes out with security."); };
    document.getElementById("rentBtn").onclick = () => { if(G.usedActions.rentfight || G.busy) return; G.usedActions.rentfight = true; triggerLawsuit("You are opening a lawsuit against your landlord over a rent charge you do not owe."); };
  }
  refreshBoard();
}


function showModal(html){ document.getElementById("modalBox").innerHTML = html; document.getElementById("modalOverlay").classList.remove("hidden"); }
function hideModal(){ document.getElementById("modalOverlay").classList.add("hidden"); }
function choiceBtn(label, sub){ return `<button class="choice-btn"><b>${label}</b>${sub ? `<small>${sub}</small>` : ""}</button>`; }
function wireChoices(fn){
  document.querySelectorAll("#modalBox .choice-btn").forEach((b,i) => b.onclick = () => { hideModal(); fn(i); });
}


const JOB_TITLES = ["Warehouse picker","Café barista","Delivery rider","Factory line worker","Supermarket stacker","Cleaner (nights)","Call-centre agent","Fast-food crew"];
function genJobs(){
  return [0,1,2].map(() => {
    const cond = Math.random() < 0.45 ? 0 : (Math.random() < 0.65 ? 1 : 2);
    const base = (1250 + Math.floor(Math.random() * ((1650) - (1250) + 1)));
    const wage = Math.round(base * (cond === 0 ? 1.12 : cond === 2 ? 0.94 : 1.0));
    return { title: ((JOB_TITLES)[Math.floor(Math.random() * (JOB_TITLES).length)]), wage, cond };
  });
}
function jobModal(first){
  const jobs = genJobs();
  showModal(`<h2>${first ? "First: find work" : "Job centre"}</h2>
    <p>These are the jobs you can pick from. Some jobs pay more and have worse conditions. Pick one to start.</p>
    ${jobs.map(j => choiceBtn(`${j.title}, ${((j.wage) < 0 ? "-$" : "$") + Math.abs(Math.round((j.wage))).toLocaleString()}/month`, `Conditions: ${CONDITIONS[j.cond].name}. ${CONDITIONS[j.cond].desc}`)).join("")}`);
  wireChoices(i => {
    G.job = jobs[i]; G.employerCondition = jobs[i].cond;
    feed(`You start as a <b>${G.job.title}</b> at ${((G.job.wage) < 0 ? "-$" : "$") + Math.abs(Math.round((G.job.wage))).toLocaleString()}/month. Conditions: ${CONDITIONS[G.employerCondition].name}.`, "info");
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
    ${HOUSING.map(h => choiceBtn(`${h.name}, ${((h.rent) < 0 ? "-$" : "$") + Math.abs(Math.round((h.rent))).toLocaleString()}/month`, `Health ${h.health>0?"+":""}${h.health} a month`)).join("")}`);
  wireChoices(i => {
    G.housing = HOUSING[i];
    feed(`You move into: <b>${G.housing.name}</b> (${((G.housing.rent) < 0 ? "-$" : "$") + Math.abs(Math.round((G.housing.rent))).toLocaleString()}/month).`, "info");
    render();
    if(first) finishSetup();
  });
}
function finishSetup(){
  G.started = true; render();
  feed("Month 1. Roll the dice and work your shifts. When you pass PAYDAY you get your wage and then rent and bills are taken out.", "warn");
  document.getElementById("centreMsg").textContent = "Roll the dice to start. Watch your money, health and happiness.";
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
    <p>A judge will decide who wins. <b>Both sides roll one die. Highest total wins.</b> Before the roll, each side can
    spend money on lawyers. Each tier adds points to that side's roll, so the side with more money starts ahead.</p>
    <p>${youAreWorker ? "The company has already paid its lawyers. It has a legal department for this. " : "Your worker has saved up what they can for a lawyer. "}How much do you spend?</p>
    ${choiceBtn(youAreWorker ? "Take $300 and end the case" : "Pay $350 and end the case", "The case ends here. Nobody rolls the dice.")}
    ${LAWYER_TIERS.map((t,i) => choiceBtn(`${t.label}, ${((t.cost) < 0 ? "-$" : "$") + Math.abs(Math.round((t.cost))).toLocaleString()}`, G.money < t.cost ? "You cannot afford this one." : `Your roll gets +${t.bonus}`)).join("")}`);
  document.querySelectorAll("#modalBox .choice-btn").forEach((b,i) => {
    if(i > 0 && G.money < LAWYER_TIERS[i-1].cost) b.style.opacity = .45;
    b.onclick = () => {
      if(i === 0){
        hideModal();
        if(youAreWorker){ G.money += 300; feed("You took the $300 and ended the case.", "info"); }
        else { G.money -= 350; changeWorkerAnger(2); feed("You paid $350 to end the case. Nobody rolled the dice.", "info"); }
        playSound("cash"); render(); checkEnd(); return;
      }
      if(G.money < LAWYER_TIERS[i-1].cost){ feed("You cannot afford that lawyer.", "bad"); return; }
      resolveLawsuit(LAWYER_TIERS[i-1], opp, youAreWorker);
    };
  });
}
function resolveLawsuit(you, opp, youAreWorker){
  G.money -= you.cost;
  const yourDie = (1 + Math.floor(Math.random() * ((6) - (1) + 1))), oppDie = (1 + Math.floor(Math.random() * ((6) - (1) + 1)));
  const yourTotal = yourDie + you.bonus, oppTotal = oppDie + opp.bonus;
  const tied = yourTotal === oppTotal;
  const youWin = yourTotal > oppTotal;
  const workerWins = !tied && (youAreWorker ? youWin : !youWin);
  showModal(`<h2>The judge decides</h2>
    <div class="lawsuit-dice">
      <div class="side">YOU (${youAreWorker ? "worker" : "owner"})<div class="big-die">${DICE_FACES[yourDie-1]}</div>rolled ${yourDie} + ${you.bonus} lawyers = <b>${yourTotal}</b><br>spent ${((you.cost) < 0 ? "-$" : "$") + Math.abs(Math.round((you.cost))).toLocaleString()}</div>
      <div class="side">${youAreWorker ? "THE COMPANY" : "YOUR WORKER"}<div class="big-die">${DICE_FACES[oppDie-1]}</div>rolled ${oppDie} + ${opp.bonus} lawyers = <b>${oppTotal}</b><br>spent ${((opp.cost) < 0 ? "-$" : "$") + Math.abs(Math.round((opp.cost))).toLocaleString()}</div>
    </div>
    <p id="lawsuitResult"></p>
    <button class="choice-btn" id="lawsuitOk"><b>Continue</b></button>`);
  const res = document.getElementById("lawsuitResult");
  if(tied){
    if(youAreWorker){ }
    else { changeWorkerAnger(3); }
    res.innerHTML = `<b>It is a tie.</b> Both sides got ${yourTotal}. Nobody wins and nobody pays anything more. You still paid ${((you.cost) < 0 ? "-$" : "$") + Math.abs(Math.round((you.cost))).toLocaleString()} for your lawyers.`;
    feed(`Lawsuit tied ${yourTotal} to ${oppTotal}. Nobody won.`, "warn");
  } else if(workerWins && youAreWorker){
    G.money += 600; 
    res.innerHTML = `<b>You win.</b> The company has to pay you <b>$600</b> and fix the conditions. Your coworkers heard about it and solidarity goes up by 12. It still cost you ${((you.cost) < 0 ? "-$" : "$") + Math.abs(Math.round((you.cost))).toLocaleString()} to fight it.`;
    feed(" You <b>won</b> your lawsuit and got $600. Your coworkers are talking about it.", "good");
  } else if(workerWins && !youAreWorker){
    G.money -= 500; changeWorkerAnger(-8); changeHealth(5);
    res.innerHTML = `<b>Your worker wins.</b> You pay <b>$500</b>. They rolled a ${oppDie} and you rolled a ${yourDie}.`;
    feed(" You <b>lost</b> a lawsuit and paid $500.", "bad");
  } else if(!workerWins && youAreWorker){
    G.money -= 150; changeHealth(-3); 
    res.innerHTML = `<b>You lose.</b> You pay <b>$150</b> in costs. You rolled a ${yourDie}. Their lawyers added +${opp.bonus} to their roll. Your coworkers are angry about it.`;
    feed(" You <b>lost</b> your lawsuit and paid $150 in costs.", "bad");
  } else {
    changeWorkerAnger(8);
    res.innerHTML = `<b>You win.</b> The case is dropped and you pay nothing. Your workers saw you spend ${((you.cost) < 0 ? "-$" : "$") + Math.abs(Math.round((you.cost))).toLocaleString()} on lawyers to win a case about unsafe work. Worker anger goes up by 8.`;
    feed(" You won the lawsuit. Worker anger goes up by 8 because your workers saw how much you spent on lawyers.", "warn");
  }
  playSound(tied ? "click" : (youWin ? "win" : "lose"));
  document.getElementById("lawsuitOk").onclick = () => { hideModal(); render(); checkEnd(); };
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
  const yourDie = (1 + Math.floor(Math.random() * ((6) - (1) + 1))), oppDie = (1 + Math.floor(Math.random() * ((6) - (1) + 1)));
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
  document.getElementById("clashOk").onclick = () => { hideModal(); render(); checkEnd(); };
  render();
}
function doExploit(kind){
  if(!G || G.busy || G.over || G.usedActions[kind]) return;
  G.usedActions[kind] = true;
  playSound("bad");
  if(kind === "rent"){
    G.money += 220; changeWorkerAnger(9);
    feed("You put every rent up and collected an extra $220. Your tenants are furious. Worker anger goes up by 9.", "warn");
    render();
    if(Math.random() < 0.5) setTimeout(() => startClash("Tenants fight the rent rise", "Your tenants will not pay the higher rent. They come to your office together to tell you.", "YOUR TENANTS", 1,
      () => { G.money += 100; changeWorkerAnger(5); feed("You kept the rise and charged $100 in fees on top.", "warn"); },
      () => { G.money -= 260; changeWorkerAnger(-12); feed("The tenants won. You drop the rise and hand back $260.", "bad"); }), 350);
  }
  if(kind === "dock"){
    G.dockPay = true; changeHealth(-5); changeWorkerAnger(8);
    feed("You docked pay across your businesses. You will keep an extra $220 at payday. Workers health goes down by 5 and tension goes up by 8.", "warn");
    render();
    if(Math.random() < 0.4) setTimeout(() => workersClash("Workers fight the pay cut", "Your workers found out about the docked pay before payday. They stopped the line and are waiting for you."), 350);
  }
  if(kind === "overtime"){
    G.money += 170; changeHealth(-6); changeWorkerAnger(7);
    feed("You forced weekend overtime and made $170. Workers health goes down by 6 and tension goes up by 7.", "warn");
    render();
  }
  if(kind === "safety"){
    G.money += 150; changeHealth(-8); changeWorkerAnger(5);
    feed("You cut the safety budget and saved $150. Workers health goes down by 8.", "warn");
    render();
    if(Math.random() < 0.35) setTimeout(() => triggerLawsuit("A worker was hurt after you cut the safety budget. He is suing you."), 350);
  }
  checkEnd();
}
function workersClash(title, text){
  startClash(title, text, "YOUR WORKERS", Math.floor(G.tension / 30),
    () => { G.money -= 250; changeWorkerAnger(-18); changeHealth(4); feed("Your workers won. You agree to pay $250 more in wages this month and fix one problem on site.", "bad"); },
    () => { changeWorkerAnger(6); changeHealth(-3); feed("Your workers lost and went back in. They are angrier now.", "warn"); });
}
function bossClash(title, text){
  startClash(title, text, G.employerCondition === 0 ? "THE BOSS AND SECURITY" : "THE BOSS", G.employerCondition === 0 ? 2 : 1,
    () => { G.money += 180; if(G.job) G.job.wage += 60; feed("You won. Your boss backs down and your wage goes up by $60 a month.", "good"); },
    () => { G.money -= 100; changeHealth(-4); feed("You lost. You pay $100 in docked pay and your coworkers saw you try.", "bad"); });
}
function landlordClash(){
  startClash("Rent fight", "Your landlord added a charge you never agreed to. Other tenants in the building are watching to see what you do.", "THE LANDLORD", 1,
    () => { G.money += 160; feed("You won. The charge is dropped and last month overcharge of $160 comes back to you.", "good"); },
    () => { G.money -= 120; feed("You lost. You pay the $120 charge.", "bad"); });
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
    if(G.job) wage += G.coop ? 450 : (G.socialism ? 250 : 0);
    const rent = G.housing ? Math.round(G.housing.rent * (G.reform ? 0.8 : 1)) : 0;
    const bills = Math.round((CFG.groceryBase + CFG.transport + CFG.utilities) * infl);
    const healthHit = G.job ? Math.round(CONDITIONS[G.employerCondition].healthHit * (G.coop ? 0.5 : (G.socialism ? 0.75 : 1))) : 0;
    G.money += wage - rent - bills;
    changeHealth(healthHit + (G.housing ? G.housing.health : 0));
    
    changeHappiness((G.housing ? G.housing.happy : 0) - (G.employerCondition === 0 ? 5 : 0));
    if(G.employerCondition === 0) 
    playSound(wage - rent - bills >= 0 ? "cash" : "bad");
    feed(`PAYDAY<br>Wage: +${((wage) < 0 ? "-$" : "$") + Math.abs(Math.round((wage))).toLocaleString()}<br>Rent: -${((rent) < 0 ? "-$" : "$") + Math.abs(Math.round((rent))).toLocaleString()}<br>Food and other bills: -${((bills) < 0 ? "-$" : "$") + Math.abs(Math.round((bills))).toLocaleString()}<br>Health change from work: ${healthHit}`, wage - rent - bills >= 0 ? "info" : "bad");
  } else {
    let income = 0, costs = 0, detail = [];
    const condIdx = G.forcedDecentNext ? 2 : G.conditions;
    const cond = CONDITIONS[condIdx];
    TILES.forEach(t => {
      if(t.owner !== "you") return;
      if(t.type === "property"){ const r = Math.round(t.rent * (G.reform ? 0.8 : 1)); income += r; detail.push(`${t.name}: +${((r) < 0 ? "-$" : "$") + Math.abs(Math.round((r))).toLocaleString()} rent`); }
      if(t.type === "business"){
        const rev = Math.round(t.revenue * (G.coop ? 0.82 : 1));
        const wages = Math.round(t.workers * 330 * cond.wageMult * (G.coop ? 1.35 : 1));
        income += rev; costs += wages + cond.costPerBiz;
        detail.push(`${t.name}: +${((rev) < 0 ? "-$" : "$") + Math.abs(Math.round((rev))).toLocaleString()}, wages -${((wages) < 0 ? "-$" : "$") + Math.abs(Math.round((wages))).toLocaleString()}, work conditions -${((cond.costPerBiz) < 0 ? "-$" : "$") + Math.abs(Math.round((cond.costPerBiz))).toLocaleString()}`);
      }
    });
    if(G.dockPay){ income += 220; G.dockPay = false; detail.push("Extra from taking pay: +$220"); }
    G.money += income - costs;
    changeHealth(cond.healthHit);
    changeWorkerAnger(cond.tension + (G.health < 40 ? 8 : 0) - (G.coop ? 14 : 0));
    if(G.forcedDecentNext){ G.forcedDecentNext = false; feed("Court order: you ran Decent conditions this month.", "warn"); }
    playSound(income - costs >= 0 ? "cash" : "bad");
    feed(`PAYDAY<br>${detail.join("<br>") || "No places yet."}<br>Money made this month: ${((income - costs) < 0 ? "-$" : "$") + Math.abs(Math.round((income - costs))).toLocaleString()}<br>Workers health: ${Math.round(G.health)}%<br>Worker anger: ${Math.round(G.tension)}%`, income - costs >= 0 ? "info" : "bad");
  }
  render();
  if(G.money <= 0){ checkEnd(); return; }
  setTimeout(() => { if(!G.over) paydayLawsuitCheck(); }, 350);
}


function drawChance(){
  const proleCards = [
    () => { G.money -= 90; return ["bad", " Bus fares went up and your shifts changed. You pay <b>$90</b> extra this month."]; },
    () => { G.money -= 40; changeHappiness(10); return ["good", " It is a coworker's birthday. You put $40 in for a gift and cake. Happiness goes up by 10."]; },
    () => { return ["info", " A coworker showed everyone the pay list. A new worker is paid more than people who have been there for five years. Your coworkers are on your side more now."]; },
    () => { changeHealth(-8); G.money -= 120; return ["bad", " You got sick. You lose a paid day and you buy medicine. You pay $120 and health goes down by 8."]; },
    () => { G.money += 150; changeHealth(-5); return ["warn", " A neighbour pays you $150 to help him move house all weekend. You get the money and health goes down by 5."]; },
    () => { G.money -= 200; return ["bad", " Payroll made a mistake and $200 is missing from your pay. They say they will look into it. You lose $200 for now."]; },
    () => choiceCard(" Hours cut", "Your manager cuts everyone's hours by about a fifth. He says business is slow. The company still posted a profit this quarter.",
      [["Accept the cut", "Your wage will be lower next payday.", () => { if(G.job) G.job.wage = Math.round(G.job.wage * 0.85); }],
       ["Complain together with your coworkers", "Your manager does not like it.", () => { }]]),
    () => choiceCard(" The boss cut the break", "Your boss says the paid break is gone from today. Your coworkers look at you. The shift has not started yet.",
      [["Refuse and stay out together", "Fight it as a group.", () => bossClash("Break room fight", "You and your coworkers refuse to start until the paid break comes back. Your boss calls security.")],
       ["Start the shift", "You start work and lose the break. Happiness goes down by 5.", () => { changeHappiness(-5); }]]),
    () => choiceCard(" Rent rise letter", "Your landlord put the rent up by $120 a month and put a letter under your door. Other people in your building got the same letter this morning.",
      [["Knock on doors and fight it together", "Take the landlord on with your neighbours behind you.", () => landlordClash()],
       ["Pay it", "Rent takes more of your wage from now on.", () => { if(G.housing) G.housing = { ...G.housing, rent: G.housing.rent + 60 }; }]]),
    () => choiceCard(" Payday loan offer", "Rent is due on Friday and you get paid on Monday. A loan shop offers you $300 now and you pay back $390.",
      [["Take the loan", "You get $300 now. In a few seconds of game time the shop will take $390 back.", () => { G.money += 300; setTimeout(()=>{ if(!G.over){ G.money -= 390; feed(" The loan shop took <b>$390</b> back. Borrowing $300 cost you $90.", "bad"); render(); checkEnd(); } }, 6000); }],
       ["Say no", "You move money around to pay the bills. Happiness goes down by 5.", () => { changeHappiness(-5); }]]),
  ];
  const bourgCards = [
    () => { G.money -= 220; return ["bad", " The boiler broke in one of your buildings. Repairs cost you $220. Your tenants have no hot water this week and they are angry."]; },
    () => { changeWorkerAnger(7); G.money += 200; return ["warn", " You put the rent up. You gain $200 and your tenants are angry. Worker anger goes up by 7."]; },
    () => { G.money += 300; return ["good", " Another business on the street closed down. Their customers start coming to yours. You gain $300."]; },
    () => { changeHealth(-6); changeWorkerAnger(6); return ["bad", " One of your workers got injured and it was in the local news. Workers health goes down by 6 and tension goes up by 6."]; },
    () => choiceCard(" Workers demand a meeting", "Your workers stop work ten minutes early and ask for a meeting about pay. They picked the busiest hour of the day to do it.",
      [["Meet them head on", "Fight it out now. Security costs extra, as usual.", () => workersClash("Meeting turns into a fight", "The meeting went loud fast. Your workers are standing together by the door.")],
       ["Give them $120 and send them back", "It costs you now and buys a quiet month.", () => { G.money -= 120; changeWorkerAnger(-6); }]]),
    () => choiceCard(" Tenants withhold rent", "Tenants in one of your buildings stopped paying rent together. They want the repairs done before paying their rent.",
      [["Go and face them", "A group of tenants will be there. You can bring help.", () => startClash("Tenants stop paying rent", "Your tenants are waiting together in the hall. They have a long list of repairs they want done.", "YOUR TENANTS", 2,
        () => { G.money += 200; changeWorkerAnger(7); feed("You got $200 in back rent moving again. The hallway hates you.", "warn"); },
        () => { G.money -= 240; changeWorkerAnger(-14); feed("The tenants won. You pay $240 for repairs now.", "bad"); })],
       ["Pay $180 for repairs", "The rent starts again and worker anger drops.", () => { G.money -= 180; changeWorkerAnger(-8); }]]),
    () => choiceCard(" A buyout offer", "A bigger company offers $900 cash for your best business. You can sell it or keep it and keep getting monthly income from it.",
      [["Sell it", "+$900 now. One less thing making you money every month.", () => { const b = TILES.find(t=>t.owner==="you" && t.type==="business"); if(b){ b.owner="ai"; G.money += 900; } }],
       ["Keep the business", "You keep the monthly income. Worker anger +3 because your staff heard about the offer and got worried.", () => { changeWorkerAnger(3); }]]),
    () => choiceCard(" Inspection due", "A safety inspector is coming next week. Your paperwork is not in good shape. Your lawyer offers to sort it out for $250.",
      [["Pay the lawyer $250", "The paperwork gets fixed before the inspector comes.", () => { G.money -= 250; }],
       ["Face the inspection honestly", "You get a $150 fine and a warning. Worker anger +3.", () => { G.money -= 150; changeWorkerAnger(3); }]]),
  ];
  const result = ((G.role === "prole" ? proleCards : bourgCards)[Math.floor(Math.random() * (G.role === "prole" ? proleCards : bourgCards).length)])();
  if(result){ feed(result[1], result[0]); render(); }
}
function choiceCard(title, text, options){
  showModal(`<h2>${title}</h2><p>${text}</p>${options.map(o => choiceBtn(o[0], o[1])).join("")}`);
  wireChoices(i => { options[i][2](); feed(`${title}: you chose <b>${options[i][0]}</b>.`, "info"); render(); checkEnd(); });
  return null;
}


function resolveTile(){
  if(G.over) return;
  const t = TILES[G.pos];
  document.getElementById("tileInfo").textContent = "";
  const ownable = t.type === "property" || t.type === "business";
  if(ownable && G.role === "bourg" && t.owner === null){
    showModal(`<h2>${t.name}</h2><p>For sale: <b>${((t.price) < 0 ? "-$" : "$") + Math.abs(Math.round((t.price))).toLocaleString()}</b>. ${t.type === "property" ? `Tenants would pay ${((t.rent) < 0 ? "-$" : "$") + Math.abs(Math.round((t.rent))).toLocaleString()}/month in rent.` : `Takes about ${((t.revenue) < 0 ? "-$" : "$") + Math.abs(Math.round((t.revenue))).toLocaleString()}/month; you'd pay ${t.workers} workers and set their conditions.`} You have ${((G.money) < 0 ? "-$" : "$") + Math.abs(Math.round((G.money))).toLocaleString()}.</p>
      ${choiceBtn(`Buy it for ${((t.price) < 0 ? "-$" : "$") + Math.abs(Math.round((t.price))).toLocaleString()}`, G.money >= t.price ? "Yours. Its income lands every payday." : "You can't afford this.")}
      ${choiceBtn("Walk away", "It stays on the market. A rival may take it.")}`);
    wireChoices(i => {
      if(i === 0 && G.money >= t.price){ G.money -= t.price; t.owner = "you"; playSound("cash"); feed(`You bought <b>${t.name}</b> for ${((t.price) < 0 ? "-$" : "$") + Math.abs(Math.round((t.price))).toLocaleString()}.`, "good"); }
      else if(i === 0){ feed("You do not have enough money to buy it.", "bad"); }
      else if(Math.random() < 0.5){ t.owner = "ai"; feed(`Another owner bought <b>${t.name}</b>.`, "warn"); }
      render(); checkEnd();
    });
    return;
  }
  if(ownable && G.role === "bourg" && t.owner === "you"){ G.money += 40; feed(`You visit <b>${t.name}</b>. It is one of yours and it is running fine. You gain $40.`, "good"); }
  else if(ownable && G.role === "prole"){ const fee = t.type === "property" ? 45 : 30; G.money -= fee; feed(`<b>${t.name}</b> belongs to another owner. You have to pay ${((fee) < 0 ? "-$" : "$") + Math.abs(Math.round((fee))).toLocaleString()} while you are here.`, "warn"); }
  else if(ownable && G.role === "bourg" && t.owner === "ai"){ G.money -= 35; feed(`Another owner has <b>${t.name}</b>. You spend $35 on a meeting there.`, "info"); }

  switch(t.type){
    case "payday": break;
    case "work":
      if(G.role === "prole"){ const earn = (90 + Math.floor(Math.random() * ((150) - (90) + 1))); G.money += earn; changeHealth(-2); feed(`You picked up an extra shift and earned ${((earn) < 0 ? "-$" : "$") + Math.abs(Math.round((earn))).toLocaleString()}. Health goes down by 2.`, "info"); }
      else { G.money += 100; changeWorkerAnger(2); feed("You visit one of your workplaces and collect $100. Worker anger goes up by 2.", "info"); }
      break;
    case "chance": drawChance(); break;
    case "rentdue":
      if(G.role === "prole"){ G.money -= 80; changeHappiness(-3); feed("Your landlord charges you an $80 late fee and says the rent will go up soon. Happiness goes down by 3.", "bad"); }
      else { G.money += 140; feed("One of your tenants pays rent early because he is scared of late fees. You gain $140.", "good"); }
      break;
    case "bills": { const c = (100 + Math.floor(Math.random() * ((180) - (100) + 1))); G.money -= c; feed(`You pay ${((c) < 0 ? "-$" : "$") + Math.abs(Math.round((c))).toLocaleString()} for gas, water and electricity.`, "bad"); break; }
    case "tax": { const c = G.role === "bourg" ? (80 + Math.floor(Math.random() * ((160) - (80) + 1))) : (30 + Math.floor(Math.random() * ((70) - (30) + 1))); G.money -= c; feed(`You pay ${((c) < 0 ? "-$" : "$") + Math.abs(Math.round((c))).toLocaleString()} for bus fares.`, "bad"); break; }
    case "clinic":
      if(G.role === "prole") choiceCard(" The clinic", "Your back hurts from work. An appointment this week costs $80. The free clinic can see you in five weeks.",
        [["Pay $80 and get seen", "Health goes up by 14 and you pay $80.", () => { G.money -= 80; changeHealth(14); }],
         ["Wait for the free clinic", "You wait five weeks to be seen. Health goes down by 3.", () => { changeHealth(-3); }]]);
      else { G.money -= 80; feed("You pay $80 for health checks for your staff.", "info"); }
      break;
    case "injury":
      if(G.role === "prole"){ const bad = G.employerCondition === 0; changeHealth(-(bad ? 8 : 4)); feed(bad ? "A pallet nearly fell on you at work because a safety guard was missing. Health goes down by 8." : "You hurt your back at work. Health goes down by 4.", "bad"); if(bad && Math.random() < 0.4) setTimeout(() => triggerLawsuit("You nearly got crushed at work because the safety guard was missing. Your coworkers think you should sue."), 400); }
      else { changeHealth(-3); changeWorkerAnger(4); feed("A worker got injured at one of your businesses. Workers health goes down by 3 and tension goes up by 4.", "bad"); }
      break;
    case "union":
      if(G.role === "prole") choiceCard(" Union Hall", "Workers from a few workplaces are meeting here. People are comparing pay and talking about what to do next.",
        [["Organise and make a plan", "You make a plan with other workers.", () => { }],
         ["Stop work this week", "Win and pay goes up.", () => bossClash("Stop work after the meeting", "Workers from your job stop work after the meeting. Your boss did not think this many people would do it.")]]);
      else { changeWorkerAnger(6); feed("Some of your workers went to a meeting at Union Hall. Worker anger goes up by 6.", "warn"); if(Math.random() < 0.35) setTimeout(() => workersClash("Workers come back from Union Hall", "Your workers came back from the meeting together. They have a list of demands and they are not splitting up."), 350); }
      break;
    case "court":
      if(G.role === "prole") choiceCard(" Free legal clinic", "A law student looks at your payslips. She says you have not been paid for all your overtime and you could sue your boss.",
        [["File a lawsuit", "You sue over unpaid overtime and bad conditions at work.", () => triggerLawsuit("You are suing your boss over unpaid overtime and bad conditions at work.")],
         ["Not today", "You are worried you could lose your job if you sue. Happiness goes down by 3.", () => { changeHappiness(-3); }]]);
      else if(Math.random() < 0.6) triggerLawsuit("A worker who used to work for you is suing you over the conditions at one of your businesses.");
      else feed("You walk past the courthouse. Nothing happens today.", "info");
      break;
    case "overtime":
      choiceCard("⏰ Overtime?", G.role === "prole" ? "Your boss asks if you want to work this weekend. You would earn extra money and lose your days off." : "You can ask your staff to work this weekend. You would earn more money and your workers would get less rest.",
        G.role === "prole"
          ? [["Take it (+$130)", "Health goes down by 7.", () => { G.money += 130; changeHealth(-7); }],
             ["Refuse", "Keep the weekend. Happiness goes up by 6.", () => { changeHappiness(6); }]]
          : [["Order it (+$160)", "Worker anger +7 and workers health goes down by 5.", () => { G.money += 160; changeWorkerAnger(7); changeHealth(-5); }],
             ["Let them rest", "Workers health goes up by 5 and worker anger goes down by 4.", () => { changeHealth(5); changeWorkerAnger(-4); }]]);
      break;
    case "hustle":
      if(G.role === "prole") choiceCard(" Side hustle?", "A delivery app wants you to deliver food after your normal shifts. The app says you can be your own boss.",
        [["Do deliveries (+$110)", "Health goes down by 8.", () => { G.money += 110; changeHealth(-8); }],
         ["Say no", "You keep your evenings free.", () => { }]]);
      else { G.money += 80; feed("Another small investment you own paid you $80.", "good"); }
      break;
    case "rest":
      changeHealth(10);
      if(G.role === "prole") changeHappiness(8);
      feed(G.role === "prole" ? "You sit in the park for an hour. Health goes up by 10 and happiness goes up by 8." : "Your workers get a quiet day and a proper rest. Workers health goes up by 10.", "good");
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
  G.busy = true; document.getElementById("rollBtn").disabled = true;
  const d1 = document.getElementById("die1"), d2 = document.getElementById("die2");
  d1.classList.add("rolling"); d2.classList.add("rolling");
  let ticks = 0;
  const spin = setInterval(() => {
    d1.textContent = ((DICE_FACES)[Math.floor(Math.random() * (DICE_FACES).length)]); d2.textContent = ((DICE_FACES)[Math.floor(Math.random() * (DICE_FACES).length)]);
    if(++ticks > 5){
      clearInterval(spin);
      d1.classList.remove("rolling"); d2.classList.remove("rolling");
      const a = (1 + Math.floor(Math.random() * ((6) - (1) + 1))), b = (1 + Math.floor(Math.random() * ((6) - (1) + 1)));
      d1.textContent = DICE_FACES[a-1]; d2.textContent = DICE_FACES[b-1];
      moveSteps(a + b);
    }
  }, 70);
}
function moveSteps(steps){
  let left = steps;
  const step = () => {
    if(left-- <= 0){
      document.getElementById("centreMsg").textContent = `You landed on ${TILES[G.pos].name}.`;
      G.busy = false; document.getElementById("rollBtn").disabled = false;
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
        if(!document.getElementById("modalOverlay").classList.contains("hidden") || G.busy) return;
        clearInterval(wait); breakingPoint();
      }, 700);
    }
  }
  render();
}


function breakingPoint(){
  if(G.over || G.phase === "epilogue") return;
  G.snapshot = { money:G.money, health:G.health, happiness:G.happiness, tension:G.tension, netWorth:netWorth() };
  G.phase = "epilogue"; G.epilogueLeft = CFG.epilogueMonths;
  showModal(`<h2> Breaking point</h2>
    <p>${G.role === "bourg"
      ? "Your workers are tired of low pay, injuries and lawsuits. They have organised together and they want the workplaces run a different way."
      : "Rent is high, pay is low and the conditions at work are bad. Your coworkers have organised together and want the workplaces run a different way."}</p>
    <p>You will play <b>${CFG.epilogueMonths} more months</b> with the option you pick, so you can see what changes.</p>
    ${choiceBtn(" Communism", "No private owners. Workplaces and homes belong to everyone together. People vote on decisions. Pay is shared more evenly and rent to a private landlord ends.")}
    ${choiceBtn(" Socialism", "Big workplaces are owned by the public and their workers. The bourgeoisie loses the big businesses. Rent is capped and health care and buses are paid for with taxes. People still earn wages.")}
    ${choiceBtn(" Stay capitalist", "Private owners keep businesses and homes. The bourgeoisie keeps taking rent and profit from workers and tenants.")}`);
  wireChoices(i => {
    G.resolution = ["communism","socialism","capitalism"][i];
    G.coop = G.resolution === "communism"; G.socialism = G.resolution === "socialism"; G.reform = G.socialism;
    if(G.coop){ changeWorkerAnger(-35); changeHealth(8); }
    if(G.reform){ changeWorkerAnger(-15); if(G.job) G.job.wage += 200; }
    if(G.resolution === "capitalism"){ changeWorkerAnger(15); }
    feed(`The city picked: <b>${["communism","socialism","staying capitalist"][i]}</b>. ${CFG.epilogueMonths} months to see what changes.`, "warn");
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
  if(G.role === "bourg"){
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
  if(G.over && !early && document.getElementById("modalOverlay").classList.contains("hidden") === false && G.endedShown) return;
  G.over = true; G.endedShown = true;
  const s = G.snapshot || { money:(G.role==="bourg"?CFG.bourgStartMoney:CFG.proleStartMoney), health:80, happiness:65, tension:15, netWorth:CFG.bourgStartMoney };
  const won = !early && (G.role === "bourg" ? (netWorth() >= CFG.bourgWinNetWorth || G.coop) : (G.money >= CFG.proleWinSavings || (G.coop && G.money > 0)));
  let verdict;
  if(early) verdict = earlyText;
  else if(G.instantWin === "bourg") verdict = `You reached your goal by getting to ${((CFG.bourgWinNetWorth) < 0 ? "-$" : "$") + Math.abs(Math.round((CFG.bourgWinNetWorth))).toLocaleString()} in total value and won. Total value is your cash plus what your places are worth. Your workers are at ${Math.round(G.health)}% health and worker anger is at ${Math.round(G.tension)}%.`;
  else if(G.instantWin === "prole") verdict = `You reached your goal by saving ${((CFG.proleWinSavings) < 0 ? "-$" : "$") + Math.abs(Math.round((CFG.proleWinSavings))).toLocaleString()} and won. Your health is at ${Math.round(G.health)}% and your happiness is at ${Math.round(G.happiness)}%.`;
  else if(G.resolution === "communism") verdict = G.role === "bourg"
    ? "The city picked communism. Workplaces are now owned by everyone together and there are no private owners taking profit. The businesses stayed open and workers got paid better. You no longer own places other people pay you for."
    : "The city picked communism. Your workplace is now owned by everyone who works there. There is no boss taking profit out. Your pay went up and the business stayed open.";
  else if(G.resolution === "socialism") verdict = "The city picked socialism. Big businesses are owned by the public and workers now. Rent is capped and health care is cheaper. Owners lost the big workplaces. Look at the numbers above to see how much changed.";
  else if(G.resolution === "capitalism") verdict = "The city stayed capitalist. Private owners keep businesses and homes. Rent and profit still go to the bourgeoisie. Look at the numbers above and compare your money with your health and worker anger.";
  else verdict = "The run ends.";
  showModal(`<h2>${early ? " Run over" : won ? " You made it work" : " Run over"}</h2>
    <p>${verdict}</p>
    ${G.snapshot ? `<table class="compare-table"><tr><th></th><th>Before the breaking point</th><th>After</th></tr>
      <tr><td>Money ${G.role==="bourg" ? "/ Total value" : ""}</td><td>${((s.money) < 0 ? "-$" : "$") + Math.abs(Math.round((s.money))).toLocaleString()}${G.role==="bourg" ? " / " + ((s.netWorth) < 0 ? "-$" : "$") + Math.abs(Math.round((s.netWorth))).toLocaleString() : ""}</td><td>${((G.money) < 0 ? "-$" : "$") + Math.abs(Math.round((G.money))).toLocaleString()}${G.role==="bourg" ? " / " + ((netWorth()) < 0 ? "-$" : "$") + Math.abs(Math.round((netWorth()))).toLocaleString() : ""}</td></tr>
      <tr><td>${G.role==="bourg" ? "Workers' health" : "Health"}</td><td>${Math.round(s.health)}%</td><td>${Math.round(G.health)}%</td></tr>
      ${G.role==="bourg" ? `<tr><td>Worker anger</td><td>${Math.round(s.tension)}%</td><td>${Math.round(G.tension)}%</td></tr>` : ""}</table>` : `<p>Final money: <b>${((G.money) < 0 ? "-$" : "$") + Math.abs(Math.round((G.money))).toLocaleString()}</b> - Health: <b>${Math.round(G.health)}%</b>${G.role==="bourg" ? ` - Total value: <b>${((netWorth()) < 0 ? "-$" : "$") + Math.abs(Math.round((netWorth()))).toLocaleString()}</b> - Worker anger: <b>${Math.round(G.tension)}%</b>` : ""}</p>`}
    <p>Played as: <b>${G.role === "bourg" ? "Bourgeoisie " : "Proletariat ‍"}</b>${G.resolution ? ` · You picked: <b>${{communism:"communism",socialism:"socialism",capitalism:"staying capitalist"}[G.resolution]}</b>` : ""}</p>
    <button class="choice-btn" id="againBtn"><b> Play again and get a new random class</b></button>`);
  document.getElementById("againBtn").onclick = () => location.reload();
  playSound(early || !won ? "lose" : "win");
  render();
}


document.getElementById("playBtn").onclick = () => {
  document.getElementById("startScreen").classList.add("hidden");
  const role = Math.random() < 0.5 ? "bourg" : "prole";
  newGame(role);
  buildBoard();
  document.getElementById("roleScreen").classList.remove("hidden");
  const t = document.getElementById("roleTitle"), d = document.getElementById("roleDesc");
  if(role === "bourg"){
    t.textContent = " BOURGEOISIE"; t.className = "role-title bourg";
    d.innerHTML = "You own a cafe and a apartment building and you have <b>$2,600</b> in the bank. You get money from rent and from your businesses every month. You pick the wages, the working conditions and the rent. Try to grow your money and keep the city calm enough to keep running.";
  } else {
    t.textContent = "‍ PROLETARIAT"; t.className = "role-title prole";
    d.innerHTML = "You have <b>$350</b> and no property. You need to find a job and a place to live. Rent and bills come out every month. Save $800 to win. If your cash hits $0, you lose.";
  }
};
document.getElementById("startGameBtn").onclick = () => {
  document.getElementById("roleScreen").classList.add("hidden");
  document.getElementById("gameScreen").classList.remove("hidden");
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
    document.getElementById("bourgOk").onclick = () => { hideModal(); feed("Month 1. You own Cafe Rio and Maple Apartments. Roll the dice to start.", "warn"); };
  }
};
document.getElementById("rollBtn").onclick = rollDice;
document.getElementById("restartBtn").onclick = () => location.reload();
document.getElementById("soundBtn").onclick = () => { soundOn = !soundOn; document.getElementById("soundBtn").textContent = soundOn ? "Sound: on" : "Sound: off"; if(soundOn) playSound("click"); };
document.getElementById("playBtn").addEventListener("click", () => playSound("click"));
