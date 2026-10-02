// One entry in this list is one player's share of the car's controls.
// The last active seat is always treated as the saboteur in this experiment.
export const PRESETS={2:[1.4,.7],3:[.8,.8,.6],4:[.5,.5,.5,.5]};

// These keys let several people share one keyboard. A seat gets its own set
// so that one player's input can be mixed with everyone else's independently.
export const SEATS=[
  {label:'W A S D',gas:'KeyW',brake:'KeyS',left:'KeyA',right:'KeyD'},
  {label:'↑ ← ↓ →',gas:'ArrowUp',brake:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'},
  {label:'I J K L',gas:'KeyI',brake:'KeyK',left:'KeyJ',right:'KeyL'},
  {label:'T F G H',gas:'KeyT',brake:'KeyG',left:'KeyF',right:'KeyH'},
];

// Let strong agreement go a little past normal power, but keep it bounded.
// This makes extra agreeing players noticeable without letting input grow forever.
export function softLimit(value){const n=Math.abs(value);return Math.sign(value)*(n<=1?n:1+.35*(1-Math.exp(-(n-1)/.35)));}

// Scale each seat's positive/negative gas and steering by its chosen weight,
// then add everything together. Braking counts as negative gas, so drivers who
// press gas and brake against each other partly cancel out.
export function mixCrew(players,weights){
  const raw=players.reduce((sum,p,i)=>({drive:sum.drive+p.drive*weights[i],steer:sum.steer+p.steer*weights[i]}),{drive:0,steer:0});
  const drive=softLimit(raw.drive),steer=softLimit(raw.steer);
  return {arcade:true,left:drive,right:drive,steer,raw,players};
}

// Turn the current key presses into one positive/negative input per player.
// Releasing a key simply contributes zero; unused seats do not affect the car.
export function crewInputs(keys,weights){
  const pressed=k=>Number(keys.has(k));
  return mixCrew(SEATS.slice(0,weights.length).map(s=>({drive:pressed(s.gas)-pressed(s.brake),steer:pressed(s.right)-pressed(s.left)})),weights);
}
