export const ABILITIES = Object.freeze({
  left:{name:'Left surge',cost:35,warning:1.2,duration:1.8,cooldown:6,family:'surge'},
  right:{name:'Right surge',cost:35,warning:1.2,duration:1.8,cooldown:6,family:'surge'},
  slip:{name:'Slippery tires',cost:55,warning:1.4,duration:3,cooldown:10,family:'slip'},
});
export function createSabotage(){return {energy:70,protection:3,pending:null,active:null,cooldowns:{surge:0,slip:0},uses:0};}
export function blockReason(s,id){
  const a=ABILITIES[id];
  if(!a)return 'Unknown ability';
  if(s.protection>0)return `Protected ${s.protection.toFixed(1)}s`;
  if(s.pending||s.active)return 'One sabotage at a time';
  if(s.cooldowns[a.family]>0)return `Cooling down ${s.cooldowns[a.family].toFixed(1)}s`;
  if(s.energy<a.cost)return 'Recharging';
  return '';
}
export function requestSabotage(s,id){
  if(blockReason(s,id))return false;
  const a=ABILITIES[id];s.energy-=a.cost;s.pending={id,remaining:a.warning};s.cooldowns[a.family]=a.cooldown;s.uses++;return true;
}
export function protectCar(s){s.pending=null;s.active=null;s.protection=4;}
export function tickSabotage(s,dt){
  s.energy=Math.min(100,s.energy+8*dt);s.protection=Math.max(0,s.protection-dt);
  for(const key of Object.keys(s.cooldowns))s.cooldowns[key]=Math.max(0,s.cooldowns[key]-dt);
  if(s.pending){s.pending.remaining-=dt;if(s.pending.remaining<=0){const id=s.pending.id;s.pending=null;s.active={id,remaining:ABILITIES[id].duration};}}
  else if(s.active){s.active.remaining-=dt;if(s.active.remaining<=0)s.active=null;}
}
export function sabotageEffects(s){return {surgeSide:s.active?.id==='left'?'left':s.active?.id==='right'?'right':null,gripFactor:s.active?.id==='slip'?.12:1};}
export function createRound(duration=180){return {running:true,duration,elapsed:0,crashes:0,recoveries:0,crashCooldown:0,gates:new Set(),outcome:null};}
export function tickRound(round,dt,{impact=0,recovered=false,gate=null}={}){
  if(!round?.running)return;
  round.elapsed=Math.min(round.duration,round.elapsed+dt);round.crashCooldown=Math.max(0,round.crashCooldown-dt);
  if(impact>6&&round.crashCooldown===0){round.crashes++;round.crashCooldown=1.5;}
  if(recovered)round.recoveries++;
  if(gate!==null)round.gates.add(gate);
  if(round.elapsed>=round.duration)endRound(round,'Time up');
}
export function endRound(round,outcome){if(round?.running){round.running=false;round.outcome=outcome;}}
export function clockText(seconds){const s=Math.max(0,Math.ceil(seconds));return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;}
