import { createCar, respawnCar, SPAWN, CLIFF_START, DEFAULTS, inputsFor, stepCar, GATES, crossedGate } from './physics.js';
import { BRIDGE_START, TRAFFIC_START, FINISH, ROAD_POINTS, COURSE_LENGTH, LAKE } from './course.js';
import { resetTraffic } from './traffic.js';
import { ABILITIES, createSabotage, requestSabotage, blockReason, protectCar, tickSabotage, sabotageEffects, createRound, tickRound, endRound, clockText } from './rules.js';

const $ = id => document.getElementById(id);
let world;
try {
  const { createWorld } = await import('./world.js');
  world = createWorld($('game'));
} catch (error) {
  $('loadError').hidden = false;
  $('errorMessage').textContent = `The 3D renderer could not start. Use a WebGL-enabled browser and run the local server after installing dependencies. (${error.message})`;
  throw error;
}
let car=createCar({obstacles:world.obstacles,traffic:true}), mode='shared', paused=false, gateIndex=0, finalGateCrossed=false, stoppedTime=0, complete=false;
const keys=new Set(), tune={...DEFAULTS};
let sabotage=createSabotage(),round=null;
let toastTimer=0, collisionCooldown=0, lastTime=performance.now(), accumulator=0, elapsed=0;
const FIXED=1/120;
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');toastTimer=3;}
function updateLesson(){
  const gate=GATES[Math.min(gateIndex,GATES.length-1)];
  $('lessonNumber').textContent=`${String(Math.min(gateIndex+1,GATES.length)).padStart(2,'0')} / ${String(GATES.length).padStart(2,'0')}`;
  $('lessonTitle').textContent=complete?'Scenic route survived':gate.title;
  $('lessonText').textContent=complete?'Nine gates, one friendship. Reset for another road trip.':gate.text;
  $('lessonCheck').textContent=complete?'✓':'↗';
}
function reset(){round=null;sabotage=createSabotage();resetTraffic(car.traffic);car.checkpoint={...SPAWN};respawnCar(car,SPAWN);keys.clear();gateIndex=0;finalGateCrossed=false;stoppedTime=0;complete=false;world.reset();updateLesson();toast('Fresh start. Same questionable crew.');updateHUD({left:0,right:0});}
function cliffStart(){car.checkpoint={...CLIFF_START};respawnCar(car,CLIFF_START);keys.clear();gateIndex=2;finalGateCrossed=false;stoppedTime=0;complete=false;world.snapCamera();updateLesson();setPaused(false);toast('Eight metres up. Turn right, or investigate gravity.');}
function bridgeStart(){car.checkpoint={...BRIDGE_START};respawnCar(car,BRIDGE_START);keys.clear();gateIndex=3;finalGateCrossed=false;stoppedTime=0;complete=false;world.snapCamera();updateLesson();setPaused(false);toast('A little less road. A lot more water.');}
function setPaused(value){paused=value;keys.clear();accumulator=0;$('pauseOverlay').hidden=!value;$('pauseReason').textContent='Press Escape or resume when you’re ready.';}
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
function startRound(){if(results.open)results.close();reset();round=createRound(240);setPaused(false);toast('Four minutes. Two drivers. One saboteur.');updateSessionUI();}
function showResults(outcome){
  if(!round)return;endRound(round,outcome);keys.clear();sabotage.pending=sabotage.active=null;
  $('resultsTitle').textContent=round.outcome;$('resultsMode').textContent=mode==='solo'?'Solo-driver test round':'Two drivers versus one saboteur';
  $('resultGates').textContent=`${round.gates.size} / ${GATES.length}`;$('resultTime').textContent=clockText(round.elapsed);
  $('resultCrashes').textContent=round.crashes;$('resultRecoveries').textContent=round.recoveries;$('resultSabotages').textContent=sabotage.uses;
  updateSessionUI();if(!results.open)results.showModal();
}
$('newRound').onclick=startRound;$('playAgain').onclick=startRound;
$('endRound').onclick=()=>showResults('Run ended');
$('backPractice').onclick=()=>{results.close();reset();setPaused(false);};
results.addEventListener('cancel',event=>event.preventDefault());
function attack(id){
  if(paused||help.open||results.open||complete)return;
  if(!requestSabotage(sabotage,id))toast(blockReason(sabotage,id));
  updateSessionUI();
}
$('surgeLeft').onclick=()=>attack('left');$('surgeRight').onclick=()=>attack('right');$('slippery').onclick=()=>attack('slip');
function updateSessionUI(){
  const locked=!!round?.running;
  for(const id of ['cliffButton','bridgeButton','trafficButton','resetButton','sharedMode','soloMode','response','turning','grip','cameraDistance','defaultsButton','newRound'])$(id).disabled=locked;
  $('endRound').hidden=!locked;$('roundClock').textContent=locked?clockText(round.duration-round.elapsed):'Practice';
  $('mischiefValue').textContent=`${Math.floor(sabotage.energy)} / 100`;$('mischiefMeter').value=sabotage.energy;
  for(const [id,button] of [['left','surgeLeft'],['right','surgeRight'],['slip','slippery']]){
    const reason=blockReason(sabotage,id);$(button).disabled=!!reason||paused||help.open||results.open||complete;
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
  if(event.target instanceof HTMLInputElement)return;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(event.code))event.preventDefault();
  if(event.repeat)return;
  if(event.code==='Escape'){setPaused(!paused);return;}
  if(event.code==='KeyR'){if(round?.running)toast('End the run to reset.');else reset();return;}
  if(['KeyJ','KeyK','KeyL'].includes(event.code)){attack({KeyJ:'left',KeyK:'slip',KeyL:'right'}[event.code]);return;}
  if(!paused)keys.add(event.code);
});
window.addEventListener('keyup',event=>keys.delete(event.code));
window.addEventListener('blur',()=>{if(!help.open)setPaused(true);keys.clear();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();if(!help.open)setPaused(true);}});
$('game').addEventListener('pointerdown',()=>{$('game').focus();if(paused)setPaused(false);});
$('game').addEventListener('webglcontextlost',event=>{event.preventDefault();setPaused(true);$('pauseReason').textContent='The graphics context was lost. Reload the page to restart the renderer.';});
function updateHUD(input){
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
  $('trafficCount').textContent=`${car.traffic.vehicles.filter(v=>v.active).length} LOCALS ON THE MOVE`;
  updateSessionUI();
}
const map=$('routeMap').getContext('2d');
function drawMap(){
  const sx=x=>(x+40)/280*120+5,sz=z=>(z+75)/370*93+5;
  map.clearRect(0,0,130,103);map.fillStyle='#87bfbd';map.fillRect(sx(LAKE.minX),sz(LAKE.minZ),sx(LAKE.maxX)-sx(LAKE.minX),sz(LAKE.maxZ)-sz(LAKE.minZ));
  map.strokeStyle='#81927e';map.lineWidth=2.4;map.beginPath();ROAD_POINTS.forEach((p,i)=>i?map.lineTo(sx(p.x),sz(p.z)):map.moveTo(sx(p.x),sz(p.z)));map.stroke();
  GATES.forEach((g,i)=>{map.fillStyle=i<gateIndex?'#488775':i===gateIndex?'#edab4b':'#e9eadb';map.beginPath();map.arc(sx(g.x),sz(g.z),2.6,0,Math.PI*2);map.fill();});
  car.traffic.vehicles.filter(v=>v.active).forEach(v=>{map.fillStyle='#467ba0';map.fillRect(sx(v.body.position.x)-1,sz(v.body.position.z)-1,2,2);});
  map.save();map.translate(sx(car.x),sz(car.z));map.rotate(car.yaw);map.fillStyle='#d65f3f';map.strokeStyle='#fff4da';map.lineWidth=1;map.beginPath();map.moveTo(0,-5);map.lineTo(3.5,3);map.lineTo(-3.5,3);map.closePath();map.fill();map.stroke();map.restore();
}
$('routeLength').textContent=`${Math.round(COURSE_LENGTH)} m · ${GATES.length} GATES`;
function tick(now){
  const dt=Math.min((now-lastTime)/1000,.05);lastTime=now;
  if(!paused&&!help.open&&!results.open){
    elapsed+=dt;accumulator+=dt;collisionCooldown=Math.max(0,collisionCooldown-dt);
    const input=inputsFor(keys,mode);
    while(accumulator>=FIXED){
      tickSabotage(sabotage,FIXED);
      const previous={x:car.x,y:car.y,z:car.z};
      const impact=stepCar(car,input,tune,FIXED,sabotageEffects(sabotage));
      let passedGate=null;
      if(car.respawned){protectCar(sabotage);keys.clear();input.left=input.right=0;finalGateCrossed=false;stoppedTime=0;world.snapCamera();toast(car.recoveryReason==='water'?'Not a boat. Back to the last dry checkpoint.':'Wheels belong underneath. Back to your last safe spot.');}
      else if(impact>5&&collisionCooldown===0){toast('A very hands-on physics experiment.');collisionCooldown=2;}
      if(!car.respawned&&gateIndex<GATES.length&&crossedGate(previous,car,GATES[gateIndex])){
        passedGate=gateIndex;
        if(gateIndex<GATES.length-1){
          car.checkpoint={...GATES[gateIndex].spawn};
          gateIndex++;updateLesson();toast(`Next up: ${GATES[gateIndex].title}`);
        }
        else finalGateCrossed=true;
      }
      tickRound(round,FIXED,{impact,recovered:car.respawned,gate:passedGate});
      if(finalGateCrossed&&!complete){
        const inBox=car.x>FINISH.minX&&car.x<FINISH.maxX&&car.z>FINISH.minZ&&car.z<FINISH.maxZ&&Math.abs(car.y)<1&&car.upY>.7;
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
updateTuning();updateLesson();requestAnimationFrame(tick);
