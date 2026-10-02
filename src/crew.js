// Full controls per player. The final active seat is the known saboteur.
export const PRESETS={2:[1.4,.7],3:[.8,.8,.6],4:[.5,.5,.5,.5]};
export const SEATS=[
  {label:'W A S D',gas:'KeyW',brake:'KeyS',left:'KeyA',right:'KeyD'},
  {label:'↑ ← ↓ →',gas:'ArrowUp',brake:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'},
  {label:'I J K L',gas:'KeyI',brake:'KeyK',left:'KeyJ',right:'KeyL'},
  {label:'T F G H',gas:'KeyT',brake:'KeyG',left:'KeyF',right:'KeyH'},
];
export function softLimit(value){const n=Math.abs(value);return Math.sign(value)*(n<=1?n:1+.35*(1-Math.exp(-(n-1)/.35)));}
export function mixCrew(players,weights){
  const raw=players.reduce((sum,p,i)=>({drive:sum.drive+p.drive*weights[i],steer:sum.steer+p.steer*weights[i]}),{drive:0,steer:0});
  const drive=softLimit(raw.drive),steer=softLimit(raw.steer);
  return {arcade:true,left:drive,right:drive,steer,raw,players};
}
export function crewInputs(keys,weights){
  const pressed=k=>Number(keys.has(k));
  return mixCrew(SEATS.slice(0,weights.length).map(s=>({drive:pressed(s.gas)-pressed(s.brake),steer:pressed(s.right)-pressed(s.left)})),weights);
}
