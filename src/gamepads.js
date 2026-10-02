const clamp=(v,min=-1,max=1)=>Number.isFinite(v)?Math.max(min,Math.min(max,v)):0;

// Ignore tiny stick movements near the centre. Scale the remaining movement
// back across the full range so a real turn can still reach full steering.
export function stick(value){value=clamp(value);return Math.abs(value)<=.15?0:Math.sign(value)*(Math.abs(value)-.15)/.85;}

// Read the common controller layout the browser recognizes: left stick or
// D-pad turns; the lower triggers accelerate and brake/reverse.
export function gamepadInput(pad){
  if(!pad?.connected||pad.mapping!=='standard')return {drive:0,steer:0};
  const button=i=>clamp(pad.buttons?.[i]?.value,0,1);
  const dpad=button(15)-button(14);
  return {drive:button(7)-button(6),steer:dpad||stick(pad.axes?.[0])};
}

// A browser may hide controller details until the player presses a button.
// Treat browser errors or a missing API as “no controllers” instead of crashing.
export function readGamepads(api=globalThis.navigator){
  try{return Array.from(api?.getGamepads?.()||[]).filter(p=>p?.connected);}catch{return [];}
}
// Require released controls after assignment, pause or reconnect. No surprise
// throttle when resuming while someone is still squeezing a trigger.
export function gatedGamepadInput(pad,armed){
  const input=gamepadInput(pad);
  if(!pad?.connected||pad.mapping!=='standard')return {input:{drive:0,steer:0},armed:false};
  const released=Math.abs(pad.axes?.[0]||0)<=.15&&[6,7,14,15].every(i=>(pad.buttons?.[i]?.value||0)<.05);
  return {input:armed?input:{drive:0,steer:0},armed:armed||released};
}
