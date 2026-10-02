import {ROAD_POINTS,BRANCH_POINTS,FINISH} from './course.js';
const clamp=(v,a=-1,b=1)=>Math.max(a,Math.min(b,v));
const angle=v=>Math.atan2(Math.sin(v),Math.cos(v));
const neutral=()=>({drive:0,steer:0});

// Keep a little private memory for each bot: its delayed controls, current
// fork guess, and saboteur mode timer. A seeded random function helps tests
// repeat the same decisions; normal play uses the browser's usual randomness.
export function createBot(random=Math.random){
  return {random,reaction:0,output:neutral(),route:null,forkTime:0,forkChoice:null,
    danger:false,mode:'nominal',interval:0,changes:0,edgeSide:random()<.5?-1:1,bias:(random()-.5)*.07};
}

// Project the car onto each straight piece of road and remember the nearest
// one. Comparing height as well as map distance avoids picking a road directly
// below the car when it is on an elevated section.
export function nearestRoad(points,car){
  let best=null;
  for(let i=0;i<points.length-1;i++){
    const a=points[i],b=points[i+1],dx=b.x-a.x,dz=b.z-a.z,n=dx*dx+dz*dz;
    const t=clamp(((car.x-a.x)*dx+(car.z-a.z)*dz)/n,0,1);
    const x=a.x+dx*t,z=a.z+dz*t,y=a.y+(b.y-a.y)*t,distance=Math.hypot(car.x-x,car.z-z);
    const score=distance**2+((car.y-y)*2)**2;
    if(!best||score<best.score)best={i,t,x,y,z,distance,score,width:a.width,heading:Math.atan2(dx,-dz),section:a.section};
  }
  return best;
}

// From the nearest road point, look ahead a chosen distance along the route.
// This gives the bot somewhere to aim instead of chasing its current position.
function lookAhead(points,near,distance){
  let last=near;
  for(let i=near.i+1;i<points.length;i++){
    const p=points[i],length=Math.hypot(p.x-last.x,p.z-last.z);
    if(length>=distance){const t=distance/(length||1);return {x:last.x+(p.x-last.x)*t,z:last.z+(p.z-last.z)*t};}
    distance-=length;last=p;
  }
  return points.at(-1);
}
// Bots only return ordinary player inputs. They never move the car directly,
// checkpoints, traffic, weights, or the physics engine.
export function tickBot(bot,car,{role='driver',gateIndex=0,traffic=[],complete=false}={},dt){
  if(dt<=0)return bot.output;
  if(complete||car.upY<.5||car.airTime>.15){bot.output=neutral();return bot.output;}
  // The two routes share a checkpoint. Until the car is clearly on one path,
  // keep reconsidering the guess so a human can steer the group elsewhere.
  const main=nearestRoad(ROAD_POINTS,car),branch=nearestRoad(BRANCH_POINTS,car);
  if(gateIndex===6){
    // Commit to where the human actually took the car, not the bot's guess.
    if(!bot.route&&car.z>114&&branch.distance+3<main.distance)bot.route='shortcut';
    if(!bot.route&&car.x<24&&main.distance+3<branch.distance)bot.route='main';
  }
  if(gateIndex>6||car.z>169&&car.x>16){bot.route=null;bot.forkChoice=null;bot.forkTime=0;}
  const choosing=gateIndex===6&&!bot.route&&car.x>23&&car.x<66&&car.z>94&&car.z<119;
  if(choosing){
    if(bot.forkChoice===null){bot.forkChoice=bot.random()<.5?'main':'shortcut';bot.forkTime=0;}
    bot.forkTime+=dt;
    if(bot.forkTime>=2){bot.forkTime%=2;bot.forkChoice=bot.random()<.5?'main':'shortcut';}
  }else if(!bot.route){bot.forkChoice=null;bot.forkTime=0;}
  // Follow the bot's current guess at the fork, but otherwise follow the road
  // the car is physically closest to. Its other guess is released for a beat.
  const useBranch=bot.route==='shortcut'||choosing&&bot.forkChoice==='shortcut';
  const points=useBranch?BRANCH_POINTS:ROAD_POINTS,near=useBranch?branch:main;
  const target=lookAhead(points,near,clamp(3+car.speed*.6,4,10));
  const heading=Math.atan2(target.x-car.x,-(target.z-car.z)),error=angle(heading-car.yaw);
  const fx=Math.sin(car.yaw),fz=-Math.cos(car.yaw);
  // Only worry about traffic ahead in roughly the same lane. Nearby cars going
  // the other way or on another level should not cause sudden reactions.
  let vehicle=null,vehicleDistance=Infinity;
  for(const v of traffic){
    const p=v.body?.position||v;
    if(v.active===false||Math.abs((p.y??1)-car.y-1)>3)continue;
    const dx=p.x-car.x,dz=p.z-car.z,ahead=dx*fx+dz*fz,side=dx*(-fz)+dz*fx,distance=Math.hypot(dx,dz);
    if(ahead>0&&ahead<20&&Math.abs(side)<5&&distance<vehicleDistance){vehicle={...p,side};vehicleDistance=distance;}
  }
  // Judge danger from the road under the car, not the road the bot happened
  // to guess at the fork.
  const surface=main.score<=branch.score?main:branch;
  const drop=surface.y>2,edge=surface.distance>surface.width/2-2;
  const danger=drop||edge||vehicle!==null;
  // A safe stretch looks completely normal. Near danger, the saboteur picks
  // either helpful driving or an outward/traffic-directed steer for a random
  // half to one-and-a-half seconds before making another choice.
  if(role==='saboteur'&&danger){
    bot.interval-=dt;
    if(!bot.danger||bot.interval<=0){
      bot.mode=bot.random()<.5?'nominal':'sabotage';bot.interval=.5+bot.random();bot.changes++;
    }
  }else{if(bot.mode==='sabotage')bot.reaction=0;bot.mode='nominal';bot.interval=0;}
  bot.danger=danger;
  bot.reaction-=dt;
  // During the give-way half-cycle the seat really releases both axes.
  if(choosing&&bot.forkTime>=1){bot.output=neutral();return bot.output;}
  if(bot.reaction>0)return bot.output;
  bot.reaction=.2+bot.random()*.15;
  // Bots stay well below the car's new player-controlled top speed. That gives
  // them time to read bends and keeps “normal” driving believable rather than
  // asking them to corner as fast as a human can hold the throttle.
  let speed=clamp(11.5-Math.abs(error)*7,3.5,11.5);
  if(drop||near.width<9)speed=Math.min(speed,6);
  if(edge)speed=Math.min(speed,4);
  if(choosing)speed=Math.min(speed,4.5);
  if(vehicle)speed=Math.min(speed,Math.max(0,(vehicleDistance-7)*.6));
  let steer=clamp(error*1.6-car.yawRate*.12+bot.bias);
  if(vehicle&&vehicleDistance<12)steer=clamp(steer-(Math.sign(vehicle.side)||bot.edgeSide)*.18);
  let drive=clamp((speed-car.speed)*.3+.13);
  if(bot.mode==='sabotage'){
    if(vehicle){steer=clamp(angle(Math.atan2(vehicle.x-car.x,-(vehicle.z-car.z))-car.yaw)*2);}
    else{
      const rx=Math.cos(near.heading),rz=Math.sin(near.heading);
      const side=(car.x-near.x)*rx+(car.z-near.z)*rz;
      steer=Math.abs(side)>.8?Math.sign(side):bot.edgeSide;
    }
    drive=.85;
  }
  // Nominal bots brake into the finish box instead of overshooting it.
  if(gateIndex>=8&&car.z>FINISH.minZ-5&&car.z<FINISH.maxZ+5&&car.x<100&&bot.mode==='nominal'){
    const remaining=car.x-(FINISH.minX+FINISH.maxX)/2;
    const finishSpeed=clamp(remaining*.55,0,6);
    drive=car.speed<.3&&remaining<1?0:clamp((finishSpeed-car.forwardSpeed)*.45);
  }
  bot.output={drive,steer};return bot.output;
}
