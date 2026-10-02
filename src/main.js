import { createCar, respawnCar as respawnPhysicsCar, SPAWN, CLIFF_START, DEFAULTS, inputsFor, stepCar, GATES, crossedGate } from './physics.js';
import { BRIDGE_START, TRAFFIC_START, FORK_START, BRANCH_POINTS, FINISH, ROAD_POINTS, COURSE_LENGTH, LAKE } from './course.js';
import {PRESETS,SEATS,crewInputs,mixCrew} from './crew.js';
import {createBot,tickBot} from './bots.js';
import {readGamepads,gatedGamepadInput} from './gamepads.js';
import { resetTraffic } from './traffic.js';
import { ABILITIES, createSabotage, requestSabotage, blockReason, protectCar, tickSabotage, sabotageEffects, createRound, tickRound, endRound, clockText } from './rules.js';
import {MAP_ID,MAP_NAME,IS_PINEWATER} from './course.js';

const $ = id => document.getElementById(id);
$('mapSelect').value=MAP_ID;
$('mapSelect').onchange=()=>{const url=new URL(location.href);url.searchParams.set('map',$('mapSelect').value);location.assign(url);};
document.querySelector('.location').lastChild.textContent=' '+MAP_NAME.toUpperCase();
if(IS_PINEWATER){
  // Keep the full route a surprise. The original map keeps its overview.
  document.querySelector('.route-map').hidden=true;
  $('cliffButton').textContent='↗ Lake overlook';$('bridgeButton').textContent='≈ Island bridge';$('trafficButton').textContent='≈ Lower shore';
  $('newRound').textContent='Start 10-minute round';
}
// Set up the visible 3D world first. If the browser cannot create it, show a
// readable message rather than leaving an empty game area.
let world;
try {
  const { createWorld } = await import('./world.js');
  world = createWorld($('game'));
} catch (error) {
  $('loadError').hidden = false;
  $('errorMessage').textContent = `The 3D renderer could not start. Use a WebGL-enabled browser and run the local server after installing dependencies. (${error.message})`;
  throw error;
}
// Keep the car, course progress and practice state together here. Physics owns
// movement; this file decides which controls reach it and when a run advances.
let car=createCar({obstacles:world.obstacles,traffic:true}), mode='shared', paused=false, gateIndex=0, finalGateCrossed=false, stoppedTime=0, complete=false;
const keys=new Set(), tune={...DEFAULTS};
let scheme='split',weights=[...PRESETS[4]];
const arcadeTune={response:.1,turning:1.5,grip:1};
const sources=['human','human','human','human'];
let pads=[],padSignature='';
const armedPads=new Set();

// A selected controller contributes nothing until the player lets its stick
// and triggers return to rest. That prevents an already-held trigger from
// suddenly accelerating when the player assigns it or resumes the game.
function controllerInput(source){
  const index=Number(source.slice(4)),pad=pads.find(p=>p.index===index);
  const result=gatedGamepadInput(pad,armedPads.has(index));
  if(result.armed)armedPads.add(index);else armedPads.delete(index);
  return result.input;
}

// Check controller connections once per screen update. Rebuild the seat menus
// when devices appear or disappear, and pause if a seat loses its controller.
function pollControllers(){
  pads=readGamepads();
  const signature=JSON.stringify(pads.map(p=>[p.index,p.id,p.mapping]));
  if(signature===padSignature)return;
  padSignature=signature;armedPads.clear();
  if(scheme==='crew'&&!$('crewRehearsal').checked&&sources.slice(0,weights.length).some(s=>s.startsWith('pad:')&&!pads.some(p=>`pad:${p.index}`===s&&p.mapping==='standard'))){setPaused(true);$('pauseReason').textContent='A selected controller disconnected. Reconnect it, or change that seat in practice.';}
  renderSeats();updateSessionUI();
  $('controllerHint').textContent=pads.some(p=>p.mapping!=='standard')?'An unmapped controller was detected. This demo supports standard-mapped gamepads only.':pads.length?'Left stick / D-pad steer · RT/R2 gas · LT/L2 brake/reverse. Release controls after assigning or resuming.':'Connect a controller, then press a button to reveal it here. Left stick steers; RT/R2 gas, LT/L2 brake/reverse.';
}
let bots=sources.map(()=>createBot());

// Give each bot its own remembered fork guess and sabotage timing.
function resetBots(){bots=sources.map(()=>createBot());}

// All respawns also clear controller arming and bot thoughts, so an old input
// or half-finished plan cannot carry through a fall or a reset.
function respawnCar(...args){resetBots();armedPads.clear();return respawnPhysicsCar(...args);}

// Gather one signed drive/steer pair from every active seat, then add them
// using that seat's weight. The original split-wheel mode bypasses this mixer.
function currentInput(dt=0){
  if(botRecovery!==car.recoveries){resetBots();armedPads.clear();botRecovery=car.recoveries;}
  if(scheme==='split')return inputsFor(keys,mode);
  if($('crewRehearsal').checked)return crewInputs(keys,[1]);
  const players=crewInputs(keys,weights).players.map((input,i)=>sources[i]==='human'?input:sources[i].startsWith('pad:')?controllerInput(sources[i]):tickBot(bots[i],car,{role:i===weights.length-1?'saboteur':'driver',gateIndex,traffic:car.traffic.vehicles,complete},dt));
  return mixCrew(players,weights);
}
let botRecovery=car.recoveries;

// Rebuild the setup controls from the selected number of seats. Each seat can
// use keys, a bot, or one connected standard-layout gamepad.
function renderSeats(){
  $('crewSeats').replaceChildren();
  weights.forEach((weight,i)=>{
    const seat=document.createElement('div');seat.className='crew-seat'+(i===weights.length-1?' traitor':'');
    const label=document.createElement('label');label.textContent=`P${i+1} · ${i===weights.length-1?'SABOTEUR':'DRIVER'} · weight `;
    const field=document.createElement('input');field.type='number';field.min='0';field.max='2';field.step='.05';field.value=weight;field.setAttribute('aria-label',`Player ${i+1} weight`);
    field.onchange=()=>{const n=Number(field.value);weights[i]=Number.isFinite(n)?Math.max(0,Math.min(2,n)):weight;field.value=weights[i];keys.clear();};
    label.append(field);seat.append(label);const text=document.createElement('small');text.textContent=`${SEATS[i].label} · gas / steer / brake`;seat.append(text);$('crewSeats').append(seat);
    const source=document.createElement('select');source.setAttribute('aria-label',`Player ${i+1} controller`);
    for(const [value,title] of [['human','Keyboard'],['bot',i===weights.length-1?'Saboteur bot':'Driver bot']]){const option=document.createElement('option');option.value=value;option.textContent=title;source.append(option);}
    for(const pad of pads.filter(p=>p.mapping==='standard')){
      const option=document.createElement('option');option.value=`pad:${pad.index}`;option.textContent=`Controller ${pad.index+1} · ${pad.id}`;
      option.disabled=sources.some((s,j)=>j!==i&&j<weights.length&&s===option.value);source.append(option);
    }
    if(sources[i].startsWith('pad:')&&!Array.from(source.options).some(o=>o.value===sources[i])){const option=document.createElement('option');option.value=sources[i];option.textContent=`Controller ${Number(sources[i].slice(4))+1} · disconnected`;option.disabled=true;source.append(option);}
    source.value=sources[i];source.onchange=()=>{
      if(source.value.startsWith('pad:'))sources.forEach((s,j)=>{if(j!==i&&s===source.value)sources[j]='human';});
      sources[i]=source.value;keys.clear();armedPads.clear();resetBots();renderSeats();updateSessionUI();
    };seat.append(source);
    const status=document.createElement('small');status.id=`botStatus${i}`;seat.append(status);
  });
  $('crewBadge').textContent=scheme==='crew'?`${weights.length-1} DRIVERS + 1 DRIVING SABOTEUR`:'2 DRIVERS + 1 MENACE';
}
function setScheme(next){
  // Switching modes clears held controls to avoid carrying throttle or steering
  // from one layout into a different one.
  scheme=next;keys.clear();armedPads.clear();resetBots();sabotage=createSabotage();car.left=car.right=car.steer=0;
  $('crewPanel').hidden=scheme!=='crew';
  $('game').setAttribute('aria-label',scheme==='crew'?'3D driving course. Full controls per seat: WASD, arrow keys, IJKL, TFGH. Last active seat sabotages. R resets.':'3D driving course. Split wheels: W/S left, up/down right. J/K/L sabotage. R resets.');
  for(const selector of ['.driver-card','.tip','.saboteur-panel','#modeDescription','[aria-label="Driving mode"]'])document.querySelectorAll(selector).forEach(el=>el.hidden=scheme==='crew');
  for(const id of ['response','turning','grip'])$(id).closest('.slider-row').hidden=scheme==='crew';
  for(const [id,value] of [['splitScheme','split'],['crewScheme','crew']]){$(id).classList.toggle('active',scheme===value);$(id).setAttribute('aria-pressed',String(scheme===value));}
  renderSeats();updateSessionUI();toast(scheme==='crew'?'Everyone has a steering wheel. Agree on where to go.':'Original split-wheel controls restored.');
}
$('splitScheme').onclick=()=>setScheme('split');$('crewScheme').onclick=()=>setScheme('crew');
$('playerCount').onchange=()=>{weights=[...PRESETS[$('playerCount').value]];keys.clear();armedPads.clear();resetBots();renderSeats();};
$('weightDefaults').onclick=()=>{weights=[...PRESETS[$('playerCount').value]];keys.clear();renderSeats();};
$('crewRehearsal').onchange=()=>{keys.clear();armedPads.clear();resetBots();car.left=car.right=car.steer=0;};
$('fillBots').onclick=()=>{sources.fill('bot');sources[0]='human';$('crewRehearsal').checked=false;resetBots();keys.clear();renderSeats();$('game').focus();toast('You are P1 on WASD. The other seats are bots; the last one sabotages.');};
let sabotage=createSabotage(),round=null;
let toastTimer=0, collisionCooldown=0, lastTime=performance.now(), accumulator=0, elapsed=0;
const FIXED=1/120;
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');toastTimer=3;}
function updateLesson(){
  const gate=GATES[Math.min(gateIndex,GATES.length-1)];
  $('lessonNumber').textContent=`${String(Math.min(gateIndex+1,GATES.length)).padStart(2,'0')} / ${String(GATES.length).padStart(2,'0')}`;
  $('lessonTitle').textContent=complete?'Scenic route survived':gate.title;
  $('lessonText').textContent=complete?'All gates, one friendship. Reset for another road trip.':gate.text;
  $('lessonCheck').textContent=complete?'✓':'↗';
}
// A full reset returns the car, moving traffic, checkpoints, timers and scenery
// to their opening state, while keeping the player's chosen seats and weights.
function reset(){round=null;sabotage=createSabotage();resetTraffic(car.traffic);car.checkpoint={...SPAWN};respawnCar(car,SPAWN);keys.clear();gateIndex=0;finalGateCrossed=false;stoppedTime=0;complete=false;world.reset();updateLesson();toast('Fresh start. Same questionable crew.');updateHUD({left:0,right:0});}
function cliffStart(){car.checkpoint={...CLIFF_START};respawnCar(car,CLIFF_START);keys.clear();gateIndex=2;finalGateCrossed=false;stoppedTime=0;complete=false;world.snapCamera();updateLesson();setPaused(false);toast('Eight metres up. Turn right, or investigate gravity.');}
function bridgeStart(){car.checkpoint={...BRIDGE_START};respawnCar(car,BRIDGE_START);keys.clear();gateIndex=3;finalGateCrossed=false;stoppedTime=0;complete=false;world.snapCamera();updateLesson();setPaused(false);toast('A little less road. A lot more water.');}
function setPaused(value){paused=value;keys.clear();armedPads.clear();accumulator=0;$('pauseOverlay').hidden=!value;$('pauseReason').textContent='Press Escape or resume when you’re ready.';}
function setMode(next){mode=next;keys.clear();car.left=car.right=0;
  $('sharedMode').classList.toggle('active',mode==='shared');$('soloMode').classList.toggle('active',mode==='solo');
  $('sharedMode').setAttribute('aria-pressed',String(mode==='shared'));$('soloMode').setAttribute('aria-pressed',String(mode==='solo'));
  $('modeDescription').textContent=mode==='shared'?'Grab a friend. Pick a side of the keyboard.':'W / S to drive. A / D to balance the wheels.';
  $('leftGo').textContent='W';$('leftBrake').textContent='S';$('rightGo').textContent=mode==='shared'?'↑':'W';$('rightBrake').textContent=mode==='shared'?'↓':'S';
  toast(mode==='shared'?'Two drivers. One shared responsibility.':'Solo test: W / S drive, A / D turn.');
}
$('sharedMode').onclick=()=>setMode('shared');$('soloMode').onclick=()=>setMode('solo');
$('resetButton').onclick=reset;$('resumeButton').onclick=()=>setPaused(false);
$('cliffButton').onclick=()=>{sabotage=createSabotage();resetTraffic(car.traffic);cliffStart();};
$('bridgeButton').onclick=()=>{sabotage=createSabotage();resetTraffic(car.traffic);bridgeStart();};
$('trafficButton').onclick=()=>{sabotage=createSabotage();resetTraffic(car.traffic);car.checkpoint={...TRAFFIC_START};respawnCar(car,TRAFFIC_START);keys.clear();gateIndex=6;finalGateCrossed=false;stoppedTime=0;complete=false;world.snapCamera();updateLesson();setPaused(false);toast('Keep right. The locals have places to be.');};
const results=$('resultsDialog');
$('forkButton').onclick=()=>{sabotage=createSabotage();resetTraffic(car.traffic);car.checkpoint={...FORK_START};respawnCar(car,FORK_START);keys.clear();gateIndex=5;finalGateCrossed=false;stoppedTime=0;complete=false;world.snapCamera();updateLesson();setPaused(false);toast('Straight: wide forest loop. Left: shorter, narrower cut-through.');};
function startRound(){if(results.open)results.close();reset();round=createRound(IS_PINEWATER?600:240);setPaused(false);toast(IS_PINEWATER?'Ten minutes. Find your way to the island.':scheme==='crew'?'Four minutes. Everyone drives—including the saboteur.':'Four minutes. Two drivers. One saboteur.');updateSessionUI();}
function showResults(outcome){
  if(!round)return;endRound(round,outcome);keys.clear();sabotage.pending=sabotage.active=null;
  $('resultsTitle').textContent=round.outcome;$('resultsMode').textContent=scheme==='crew'?($('crewRehearsal').checked?'Everyone drives · solo rehearsal':`Everyone drives · ${weights.length} seats · final seat sabotages`):mode==='solo'?'Solo-driver test round':'Two drivers versus one saboteur';
  $('resultGates').textContent=`${round.gates.size} / ${GATES.length}`;$('resultTime').textContent=clockText(round.elapsed);
  $('resultCrashes').textContent=round.crashes;$('resultRecoveries').textContent=round.recoveries;$('resultSabotages').textContent=sabotage.uses;
  updateSessionUI();if(!results.open)results.showModal();
}
$('newRound').onclick=startRound;$('playAgain').onclick=startRound;
$('endRound').onclick=()=>showResults('Run ended');
$('backPractice').onclick=()=>{results.close();reset();setPaused(false);};
results.addEventListener('cancel',event=>event.preventDefault());
function attack(id){
  if(scheme==='crew'||paused||help.open||results.open||complete)return;
  if(!requestSabotage(sabotage,id))toast(blockReason(sabotage,id));
  updateSessionUI();
}
$('surgeLeft').onclick=()=>attack('left');$('surgeRight').onclick=()=>attack('right');$('slippery').onclick=()=>attack('slip');
function updateSessionUI(){
  // During a timed round, prevent setup changes that could alter the rules in
  // the middle of play. Refresh buttons and status text from the current state.
  const locked=!!round?.running;
  $('mapSelect').disabled=locked;
  for(const id of ['cliffButton','bridgeButton','trafficButton','resetButton','sharedMode','soloMode','response','turning','grip','cameraDistance','defaultsButton','newRound'])$(id).disabled=locked;
  for(const id of ['splitScheme','crewScheme','playerCount','weightDefaults','crewRehearsal','forkButton'])$(id).disabled=locked;
  $('fillBots').disabled=locked;
  document.querySelectorAll('#crewSeats input, #crewSeats select').forEach(el=>el.disabled=locked);
  $('endRound').hidden=!locked;$('roundClock').textContent=locked?clockText(round.duration-round.elapsed):'Practice';
  $('mischiefValue').textContent=`${Math.floor(sabotage.energy)} / 100`;$('mischiefMeter').value=sabotage.energy;
  for(const [id,button] of [['left','surgeLeft'],['right','surgeRight'],['slip','slippery']]){
    const reason=blockReason(sabotage,id);$(button).disabled=scheme==='crew'||!!reason||paused||help.open||results.open||complete;
    $(button).title=reason||`${ABILITIES[id].warning}s warning · ${ABILITIES[id].duration}s effect`;
    $(button).querySelector('small').textContent=sabotage.cooldowns[ABILITIES[id].family]>0?`${sabotage.cooldowns[ABILITIES[id].family].toFixed(1)}s cooldown`:`${ABILITIES[id].cost} energy`;
  }
  const event=sabotage.pending||sabotage.active,warning=$('sabotageWarning');
  warning.hidden=!event;
  if(event){warning.classList.toggle('active',!!sabotage.active);warning.textContent=`${sabotage.pending?'INCOMING':'ACTIVE'} · ${ABILITIES[event.id].name.toUpperCase()} · ${event.remaining.toFixed(1)}s`+(event.id==='slip'?' — ease off!':` — brake ${event.id}!`);}
  $('sabotageStatus').textContent=sabotage.protection>0?`Recovery shield · ${sabotage.protection.toFixed(1)}s`:event?`${ABILITIES[event.id].name} ${sabotage.pending?'arming':'active'}`:paused?'Paused with the drivers.':'Pick your moment. No overlapping attacks.';
}
function updateTuning(){
  for(const key of ['response','turning','grip'])tune[key]=Number($(key).value);
  $('responseValue').value=`${tune.response.toFixed(2)} s`;$('turningValue').value=`${tune.turning.toFixed(1)}×`;$('gripValue').value=`${Math.round(tune.grip*100)}%`;
  $('cameraDistanceValue').value=`${$('cameraDistance').value} m`;
}
for(const key of ['response','turning','grip'])$(key).addEventListener('input',updateTuning);
$('cameraDistance').addEventListener('input',updateTuning);
$('defaultsButton').onclick=()=>{for(const key of Object.keys(DEFAULTS))$(key).value=DEFAULTS[key];$('cameraDistance').value=18;updateTuning();toast('Handling restored to the house blend.');};
const help=$('helpDialog');let pausedBeforeHelp=false;
$('helpButton').onclick=()=>{pausedBeforeHelp=paused;setPaused(true);help.showModal();};
const closeHelp=()=>help.close();$('closeHelp').onclick=closeHelp;$('startButton').onclick=closeHelp;
help.addEventListener('close',()=>setPaused(pausedBeforeHelp));
window.addEventListener('keydown',event=>{
  if(help.open||results.open)return;
  if(event.target instanceof HTMLInputElement||event.target instanceof HTMLSelectElement)return;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(event.code))event.preventDefault();
  if(event.repeat)return;
  if(event.code==='Escape'){setPaused(!paused);return;}
  if(event.code==='KeyR'){if(round?.running)toast('End the run to reset.');else reset();return;}
  if(scheme==='split'&&['KeyJ','KeyK','KeyL'].includes(event.code)){attack({KeyJ:'left',KeyK:'slip',KeyL:'right'}[event.code]);return;}
  if(!paused)keys.add(event.code);
});
window.addEventListener('keyup',event=>keys.delete(event.code));
window.addEventListener('blur',()=>{if(!help.open)setPaused(true);keys.clear();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();if(!help.open)setPaused(true);}});
$('game').addEventListener('pointerdown',()=>{$('game').focus();if(paused)setPaused(false);});
$('game').addEventListener('webglcontextlost',event=>{event.preventDefault();setPaused(true);$('pauseReason').textContent='The graphics context was lost. Reload the page to restart the renderer.';});
function updateHUD(input){
  // Display the state produced by the last physics step, plus the input we just
  // sent in. The seat rows are useful for spotting conflicting controls.
  $('speed').textContent=Math.round(car.speed*3.6);
  $('motionState').textContent=car.waterTime>0?'NOT A BOAT':car.overturnedTime>0?`RECOVERING IN ${Math.max(0,1.8-car.overturnedTime).toFixed(1)} s`:car.airTime>.12?'AIRBORNE':car.speed<.5?'READY TO ROLL':car.forwardSpeed<-.5?'BACKING IT UP':Math.abs(car.yawRate)>.65?'TALK TO EACH OTHER':'LOOKING GOOD';
  $('altitude').textContent=`${Math.max(0,car.y).toFixed(1)} m`;
  $('groundContact').textContent=car.airTime>.12?'IN THE AIR':`${car.grounded} / 4 TIRES DOWN`;
  for(const side of ['left','right']){
    const power=car[side]+(sabotage.active?.id===side?.65:0);$(side+'Percent').textContent=`${Math.round(power*100)}%`;
    $(side+'Power').style.width=`${Math.min(100,Math.abs(power)*100)}%`;$(side+'Power').classList.toggle('reverse',power<-.01);
    $(side+'Target').style.left=`calc(${Math.abs(input[side])*100}% - 1px)`;
  }
  drawMap();
  if(scheme==='crew'){
    const mix=input.raw||{drive:0,steer:0};
    $('crewMix').textContent=`${$('crewRehearsal').checked?'REHEARSAL · ':''}Drive ${mix.drive.toFixed(2)} · Turn ${mix.steer.toFixed(2)} → ${Number(input.steer||0).toFixed(2)}`;
    weights.forEach((_,i)=>{
      const output=input.players?.[i]||{drive:0,steer:0};
      $(`botStatus${i}`).textContent=sources[i]!=='bot'?'':$('crewRehearsal').checked?'Bot bypassed in rehearsal':`Gas ${output.drive.toFixed(2)} · steer ${output.steer.toFixed(2)}`+($('revealBots').checked?` · ${bots[i].forkChoice&&bots[i].forkTime>=1?'yielding':bots[i].mode}`:'');
      if(sources[i].startsWith('pad:'))$(`botStatus${i}`).textContent=$('crewRehearsal').checked?'Controller bypassed in rehearsal':!armedPads.has(Number(sources[i].slice(4)))?'Release stick and triggers to arm':`Gas ${output.drive.toFixed(2)} · steer ${output.steer.toFixed(2)}`;
    });
  }
  $('trafficCount').textContent=IS_PINEWATER?'QUIET ROADS · FIND THE ISLAND':`${car.traffic.vehicles.filter(v=>v.active).length} LOCALS ON THE MOVE`;
  updateSessionUI();
}
const map=$('routeMap').getContext('2d');
function drawMap(){
  // Draw the main course, shortcut, checkpoints, traffic and car as a tiny
  // overhead guide. Coordinates are squeezed into the canvas rectangle.
  if(IS_PINEWATER)return;
  const sx=x=>(x+40)/280*120+5,sz=z=>(z+75)/370*93+5;
  map.clearRect(0,0,130,103);map.fillStyle='#87bfbd';map.fillRect(sx(LAKE.minX),sz(LAKE.minZ),sx(LAKE.maxX)-sx(LAKE.minX),sz(LAKE.maxZ)-sz(LAKE.minZ));
  map.strokeStyle='#81927e';map.lineWidth=2.4;map.beginPath();ROAD_POINTS.forEach((p,i)=>i?map.lineTo(sx(p.x),sz(p.z)):map.moveTo(sx(p.x),sz(p.z)));map.stroke();
  map.strokeStyle='#b48646';map.lineWidth=1.6;map.beginPath();BRANCH_POINTS.forEach((p,i)=>i?map.lineTo(sx(p.x),sz(p.z)):map.moveTo(sx(p.x),sz(p.z)));map.stroke();
  GATES.forEach((g,i)=>{map.fillStyle=i<gateIndex?'#488775':i===gateIndex?'#edab4b':'#e9eadb';map.beginPath();map.arc(sx(g.x),sz(g.z),2.6,0,Math.PI*2);map.fill();});
  car.traffic.vehicles.filter(v=>v.active).forEach(v=>{map.fillStyle='#467ba0';map.fillRect(sx(v.body.position.x)-1,sz(v.body.position.z)-1,2,2);});
  map.save();map.translate(sx(car.x),sz(car.z));map.rotate(car.yaw);map.fillStyle='#d65f3f';map.strokeStyle='#fff4da';map.lineWidth=1;map.beginPath();map.moveTo(0,-5);map.lineTo(3.5,3);map.lineTo(-3.5,3);map.closePath();map.fill();map.stroke();map.restore();
}
$('routeLength').textContent=`${Math.round(COURSE_LENGTH)} m MAIN ROUTE · ${GATES.length} GATES · ${IS_PINEWATER?'3 FORKS':'1 FORK'}`;
// Practice shortcuts use this map's own checkpoint order, not the old village
// indices. They are intentionally separate from the blind forks in normal play.
if(IS_PINEWATER){
  function jump(p,index){sabotage=createSabotage();resetTraffic(car.traffic);car.checkpoint={...p};respawnCar(car,p);keys.clear();gateIndex=index;finalGateCrossed=false;stoppedTime=0;complete=false;world.snapCamera();updateLesson();setPaused(false);toast('Practice jump. Reset to explore from the forest.');}
  $('cliffButton').onclick=()=>jump(CLIFF_START,3);$('bridgeButton').onclick=()=>jump(BRIDGE_START,6);
  $('trafficButton').onclick=()=>jump(TRAFFIC_START,5);$('forkButton').onclick=()=>jump(FORK_START,2);
}
function tick(now){
  // Browser frames do not arrive at perfectly even intervals. Run the game in
  // small fixed steps so physics and controller reads behave consistently.
  pollControllers();
  const dt=Math.min((now-lastTime)/1000,.05);lastTime=now;
  if(!paused&&!help.open&&!results.open){
    elapsed+=dt;accumulator+=dt;collisionCooldown=Math.max(0,collisionCooldown-dt);
    let input=currentInput();
    while(accumulator>=FIXED){
      // Re-read each bot/controller for every physics step. This keeps gamepad
      // triggers responsive even when the display runs at a different frame rate.
      input=currentInput(FIXED);
      if(scheme==='split')tickSabotage(sabotage,FIXED);
      const previous={x:car.x,y:car.y,z:car.z};
      const impact=stepCar(car,input,scheme==='crew'?arcadeTune:tune,FIXED,scheme==='crew'?{}:sabotageEffects(sabotage));
      let passedGate=null;
      if(car.respawned){protectCar(sabotage);keys.clear();input.left=input.right=input.steer=0;finalGateCrossed=false;stoppedTime=0;world.snapCamera();toast(car.recoveryReason==='water'?'Not a boat. Back to the last dry checkpoint.':'Wheels belong underneath. Back to your last safe spot.');}
      else if(impact>5&&collisionCooldown===0){toast('A very hands-on physics experiment.');collisionCooldown=2;}
      if(!car.respawned&&gateIndex<GATES.length&&crossedGate(previous,car,GATES[gateIndex])){
        // A gate only counts when the car crosses it in the right direction.
        // Save each reached gate as a respawn point and give credit once.
        passedGate=gateIndex;
        if(gateIndex<GATES.length-1){
          car.checkpoint={...GATES[gateIndex].spawn};
          gateIndex++;updateLesson();toast(`Next up: ${GATES[gateIndex].title}`);
        }
        else finalGateCrossed=true;
      }
      tickRound(round,FIXED,{impact,recovered:car.respawned,gate:passedGate});
      if(finalGateCrossed&&!complete){
        const inBox=car.x>FINISH.minX&&car.x<FINISH.maxX&&car.z>FINISH.minZ&&car.z<FINISH.maxZ&&Math.abs(car.y-(FINISH.y||0))<1&&car.upY>.7;
        stoppedTime=inBox&&car.grounded>=2&&car.speed<.7?stoppedTime+FIXED:0;
        if(stoppedTime>.7){complete=true;gateIndex=GATES.length;updateLesson();toast('Scenic route complete. Somehow still friends.');if(round?.running)showResults('Course complete!');}
      }
      accumulator-=FIXED;
      if(round&&!round.running){if(!results.open)showResults(round.outcome);accumulator=0;break;}
    }
    updateHUD(input);
    toastTimer-=dt;if(toastTimer<=0)$('toast').classList.remove('show');
  }
  updateSessionUI();
  world.render(car,paused||results.open?0:dt,elapsed,gateIndex,Number($('cameraDistance').value),car.traffic.vehicles);
  requestAnimationFrame(tick);
}
renderSeats();updateTuning();updateLesson();requestAnimationFrame(tick);
