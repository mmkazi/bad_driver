import test from 'node:test';
import assert from 'node:assert/strict';
import {PRESETS,crewInputs,mixCrew,softLimit} from '../src/crew.js';
import {createCar,respawnCar,stepCar,DEFAULTS,GATES,crossedGate} from '../src/physics.js';
import {BRANCH_POINTS,ROAD_POINTS,FORK_START} from '../src/course.js';
const tune={response:.1,turning:1,grip:1};

test('peppy arcade motor accelerates promptly and agreeing seats add speed',()=>{
 const speeds=[];
 for(const power of [.5,1,softLimit(2)]){
  const car=createCar({course:false});
  for(let i=0;i<120;i++)stepCar(car,{arcade:true,left:power,right:power,steer:0},tune,1/120);
  speeds.push(car.speed);
 }
 assert.ok(speeds[0]>4);assert.ok(speeds[1]>speeds[0]*1.5);assert.ok(speeds[2]>speeds[1]);
 const car=createCar({course:false});
 for(let i=0;i<12;i++)stepCar(car,{arcade:true,left:1,right:1,steer:1},tune,1/120);
 assert.ok(car.left>.6&&car.steer>.7);
});
test('three agreeing half-strength seats beat the fourth by exactly normal input',()=>{
  const input=mixCrew([{drive:1,steer:1},{drive:1,steer:1},{drive:1,steer:1},{drive:-1,steer:-1}],PRESETS[4]);
  assert.equal(input.left,1);assert.equal(input.steer,1);
  assert.equal(softLimit(1),1);assert.ok(softLimit(2)>1&&softLimit(2)<1.35);assert.equal(softLimit(-2),-softLimit(2));
});
test('two and three player presets retain their proposed weighted advantage',()=>{
  for(const [n,expected] of [[2,.7],[3,1]]){
    const input=mixCrew(PRESETS[n].map((_,i)=>({drive:i===n-1?-1:1,steer:0})),PRESETS[n]);
    assert.ok(Math.abs(input.left-expected)<1e-8);
  }
});
test('each active seat has independent steering, gas and brake with unused seats ignored',()=>{
  assert.equal(crewInputs(new Set(['KeyW','ArrowUp','KeyI','KeyG']),PRESETS[4]).left,1);
  assert.equal(crewInputs(new Set(['KeyD','ArrowRight','KeyL','KeyF']),PRESETS[4]).steer,1);
  assert.equal(crewInputs(new Set(['KeyI','KeyL']),PRESETS[2]).left,0);
  assert.equal(crewInputs(new Set(['KeyW','KeyS','KeyA','KeyD']),[1]).left,0);
  assert.equal(crewInputs(new Set(['KeyW','KeyS','KeyA','KeyD']),[1]).steer,0);
});
test('arcade full-throttle turning stays upright and returns to straight driving',()=>{
  // Match the quicker steering setup used by Everyone drives. The steering
  // input, speed scaling, 1.375 rate cap and 1.5 multiplier set the limit.
  const livelyTune={...tune,turning:1.5};
  const car=createCar({course:false});respawnCar(car,{x:-50,y:0,z:160,yaw:0});
  for(let i=0;i<120*12;i++){
    stepCar(car,{arcade:true,left:softLimit(2),right:softLimit(2),steer:softLimit(2)},livelyTune,1/120);
    assert.ok(car.upY>.9,`up ${car.upY}`);
    // A hard body hit deliberately releases steering help for 0.8 seconds, so
    // its spin can carry on after contact ends. Check the rate cap while normal
    // driving help is active, and check upright stability on every step.
    if(car.impact<=2&&car.arcadeDisruption===0)assert.ok(Math.abs(car.yawRate)<2.5,`yaw ${car.yawRate}, speed ${car.speed}`);
  }
  for(let i=0;i<120;i++)stepCar(car,{arcade:true,left:1,right:1,steer:0},livelyTune,1/120);
  assert.ok(Math.abs(car.yawRate)<.05);assert.equal(car.recoveries,0);
});
test('arcade input does not erase airborne angular momentum',()=>{
  const car=createCar({course:false});car.body.position.set(40,20,100);car.body.angularVelocity.set(0,0,2);
  for(let i=0;i<40;i++)stepCar(car,{arcade:true,left:1,right:1,steer:1},tune,1/120);
  assert.equal(car.grounded,0);assert.ok(car.upY<.9);assert.ok(car.body.angularVelocity.z>1);
});
test('arcade braking slows the car and holding it through a stop reverses',()=>{
  const car=createCar({course:false});
  for(let i=0;i<240;i++)stepCar(car,{arcade:true,left:1,right:1,steer:0},tune,1/120);
  const speed=car.speed;
  for(let i=0;i<96;i++)stepCar(car,{arcade:true,left:-1,right:-1,steer:0},tune,1/120);
  assert.ok(car.speed<speed);
  for(let i=0;i<360;i++)stepCar(car,{arcade:true,left:-1,right:-1,steer:0},tune,1/120);
  assert.ok(car.forwardSpeed< -1);
});
test('arcade collision releases ordinary-driving stabilization',()=>{
  const car=createCar({course:false,obstacles:[{x:0,z:28,radius:3,kind:'barrier'}]});let released=false;
  for(let i=0;i<360;i++){
    const impact=stepCar(car,{arcade:true,left:1,right:1,steer:0},tune,1/120);
    if(impact>2){assert.ok(car.arcadeDisruption>.7);released=true;}
  }
  assert.ok(released);assert.ok(car.z>30);
});
test('arcade handling traverses all nine gates on the main course',()=>{
  const car=createCar();let waypoint=4,gate=0;
  for(let i=0;i<120*300&&gate<GATES.length;i++){
    while(waypoint<ROAD_POINTS.length-1&&Math.hypot(car.x-ROAD_POINTS[waypoint].x,car.z-ROAD_POINTS[waypoint].z)<3)waypoint++;
    const p=ROAD_POINTS[waypoint],desired=Math.atan2(p.x-car.x,-(p.z-car.z));
    const error=Math.atan2(Math.sin(desired-car.yaw),Math.cos(desired-car.yaw));
    const gas=Math.max(-.6,Math.min(.8,(6-car.speed)*.3+.15)),previous={x:car.x,y:car.y,z:car.z};
    stepCar(car,{arcade:true,left:gas,right:gas,steer:Math.max(-1,Math.min(1,error*2))},tune,1/120);
    if(crossedGate(previous,car,GATES[gate]))gate++;
    assert.ok(car.upY>.8);
  }
  assert.equal(gate,GATES.length);assert.equal(car.recoveries,0);
});
test('both fork choices reach the same next checkpoint with arcade controls',()=>{
  const split=ROAD_POINTS.findIndex(p=>p.x<=48&&p.z===104&&p.x>40);
  const rejoin=ROAD_POINTS.findIndex(p=>p.z===176&&p.x>=16);
  for(const shortcut of [false,true]){
    const route=shortcut?[...BRANCH_POINTS,...ROAD_POINTS.slice(rejoin,rejoin+10)]:ROAD_POINTS.slice(split,rejoin+10);
    const car=createCar();respawnCar(car,{x:48,y:0,z:104,yaw:-Math.PI/2});
    let waypoint=1,reached=false;
    for(let i=0;i<120*70&&!reached;i++){
      while(waypoint<route.length-1&&Math.hypot(car.x-route[waypoint].x,car.z-route[waypoint].z)<3)waypoint++;
      const p=route[waypoint],desired=Math.atan2(p.x-car.x,-(p.z-car.z));
      const error=Math.atan2(Math.sin(desired-car.yaw),Math.cos(desired-car.yaw));
      const gas=Math.max(-.6,Math.min(.7,(5-car.speed)*.3+.12)),previous={x:car.x,y:car.y,z:car.z};
      stepCar(car,{arcade:true,left:gas,right:gas,steer:Math.max(-1,Math.min(1,error*2))},tune,1/120);
      reached=crossedGate(previous,car,GATES[6]);
    }
    assert.ok(reached,shortcut?'shortcut':'wide loop');assert.equal(car.recoveries,0);
  }
});
