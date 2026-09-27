import test from 'node:test';
import assert from 'node:assert/strict';
import {createCar,respawnCar,stepCar,inputsFor,DEFAULTS,GATES,crossedGate,CLIFF_START} from '../src/physics.js';
import { ROAD_POINTS, ROAD_SEGMENTS, BRIDGE_START, LAKE, COURSE_LENGTH } from '../src/course.js';
const simulate=(input,seconds=3,tune=DEFAULTS,car=createCar({course:false}))=>{
  for(let i=0;i<Math.round(seconds*120);i++)stepCar(car,input,tune,1/120);
  return car;
};
const idle={left:0,right:0},forward={left:1,right:1};
test('equal power drives straight on four suspended wheels',()=>{
  const car=simulate(forward);
  assert.ok(car.z<15);assert.ok(Math.abs(car.x)<.001);assert.ok(Math.abs(car.yaw)<.001);
  assert.equal(car.grounded,4);assert.ok(car.upY>.99);
});
test('independent wheel inputs give mirrored turns',()=>{
  const left=simulate({left:1,right:0}),right=simulate({left:0,right:1});
  assert.ok(left.x>1&&right.x< -1);assert.ok(Math.abs(left.x+right.x)<.02);
  assert.ok(Math.abs(left.z-right.z)<.02);
});
test('braking slows forward movement and then reverses',()=>{
  const car=simulate(forward,2),speed=car.speed;
  simulate({left:-1,right:-1},.8,DEFAULTS,car);assert.ok(car.speed<speed);
  simulate({left:-1,right:-1},3,DEFAULTS,car);assert.ok(car.forwardSpeed< -1);
});
test('power ramps and decays at the selected response rate',()=>{
  const fast=simulate(forward,.2,{...DEFAULTS,response:.05});
  const slow=simulate(forward,.2,{...DEFAULTS,response:1.2});assert.ok(fast.left>slow.left*3);
  const previous=slow.left;simulate(idle,1,DEFAULTS,slow);assert.ok(slow.left<previous*.2);
});
test('physical barrier blocks the chassis',()=>{
  const car=createCar({course:false,obstacles:[{x:0,z:28,radius:3,kind:'barrier'}]});
  simulate(forward,3,DEFAULTS,car);assert.ok(car.z>30);assert.ok(car.speed<3);
});
test('cones tip when hit near their elevation',()=>{
  const cone={x:0,z:30,radius:.4,kind:'cone'};
  const car=createCar({course:false,obstacles:[cone]});simulate(forward,2,DEFAULTS,car);
  assert.equal(cone.knocked,true);
});
test('the car climbs the actual ramp and reaches the eight metre deck',()=>{
  const car=createCar();simulate(forward,5.8,DEFAULTS,car);
  assert.ok(car.z< -36);assert.ok(car.y>7.5&&car.y<9);assert.ok(car.upY>.9);
});
test('airborne chassis retains angular momentum and ignores drive forces',()=>{
  const a=createCar({course:false}),b=createCar({course:false});
  for(const car of [a,b]){car.body.position.set(20,16,0);car.body.angularVelocity.set(0,0,2);}
  simulate({left:1,right:-1},.4,DEFAULTS,a);simulate(idle,.4,DEFAULTS,b);
  assert.equal(a.grounded,0);assert.ok(a.verticalSpeed< -6);assert.ok(a.upY<.85);
  assert.ok(Math.abs(a.x-b.x)<1e-9);
  for(const axis of ['x','y','z','w'])assert.ok(Math.abs(a.body.quaternion[axis]-b.body.quaternion[axis])<1e-8);
});
test('an upright fall lands without forcing a respawn',()=>{
  const car=createCar({course:false});car.body.position.set(20,10,0);
  simulate(idle,3,DEFAULTS,car);assert.equal(car.recoveries,0);assert.ok(car.upY>.95);assert.ok(Math.abs(car.y)<.3);assert.equal(car.grounded,4);
});
test('a settled upside-down chassis recovers at its saved clifftop checkpoint',()=>{
  const car=createCar();car.checkpoint={...CLIFF_START};
  car.body.position.set(20,2,0);car.body.quaternion.setFromEuler(0,0,Math.PI);
  simulate(idle,5,DEFAULTS,car);
  assert.equal(car.recoveries,1);assert.ok(car.upY>.99);assert.ok(Math.abs(car.x-CLIFF_START.x)<.1);
  assert.ok(Math.abs(car.z-CLIFF_START.z)<.1);assert.ok(car.y>7.8);
});
test('respawn clears all linear and angular momentum and wheel power',()=>{
  const car=simulate(forward,1);car.body.angularVelocity.set(3,2,1);respawnCar(car,CLIFF_START);
  assert.equal(car.body.velocity.length(),0);assert.equal(car.body.angularVelocity.length(),0);
  assert.equal(car.left,0);assert.equal(car.right,0);assert.equal(car.yaw,0);
});
test('gates require correct direction, width, and elevation',()=>{
  assert.equal(crossedGate({x:0,y:0,z:9},{x:0,y:0,z:7},GATES[0]),true);
  assert.equal(crossedGate({x:0,y:0,z:7},{x:0,y:0,z:9},GATES[0]),false);
  assert.equal(crossedGate({x:8,y:0,z:9},{x:8,y:0,z:7},GATES[0]),false);
  assert.equal(crossedGate({x:0,y:0,z:-35},{x:0,y:0,z:-37},GATES[1]),false);
  assert.equal(crossedGate({x:0,y:8,z:-35},{x:0,y:8,z:-37},GATES[1]),true);
});
test('solo controls mix the same left and right power inputs',()=>{
  assert.deepEqual(inputsFor(new Set(['KeyW','ArrowUp'])),forward);
  assert.deepEqual(inputsFor(new Set(['KeyW']),'solo'),forward);
  const right=inputsFor(new Set(['KeyW','KeyD']),'solo');assert.ok(right.left>right.right);
});
test('all nine checkpoints are traversable across the extended course',()=>{
  const car=createCar();let waypoint=4,gate=0;
  const limit=(v,a,b)=>Math.max(a,Math.min(b,v));
  for(let i=0;i<120*300&&gate<GATES.length;i++){
    while(waypoint<ROAD_POINTS.length-1&&Math.hypot(car.x-ROAD_POINTS[waypoint].x,car.z-ROAD_POINTS[waypoint].z)<4)waypoint++;
    const target=ROAD_POINTS[waypoint];
    const desired=Math.atan2(target.x-car.x,-(target.z-car.z));
    const error=Math.atan2(Math.sin(desired-car.yaw),Math.cos(desired-car.yaw));
    const throttle=limit((6-car.speed)*.18+.15,-.8,.8),difference=limit(error*2,-1.4,1.4);
    const previous={x:car.x,y:car.y,z:car.z};
    stepCar(car,{left:limit(throttle+difference/2,-1,1),right:limit(throttle-difference/2,-1,1)},DEFAULTS,1/120);
    if(crossedGate(previous,car,GATES[gate]))gate++;
    assert.ok(car.upY>.8,'A controlled traversal should stay upright');
  }
  assert.equal(gate,GATES.length);assert.equal(car.recoveries,0);
});
test('the bridge narrows physically and carries the car above water',()=>{
  const car=createCar();respawnCar(car,BRIDGE_START);
  simulate(forward,3,DEFAULTS,car);
  assert.ok(car.x>LAKE.minX&&car.x<LAKE.maxX);assert.ok(car.y>2.8);assert.equal(car.recoveries,0);
  assert.ok(ROAD_SEGMENTS.filter(s=>s.section==='bridge').every(s=>s.width===7));
  assert.ok(COURSE_LENGTH>450);
});
test('falling into water recovers at the most recent dry checkpoint',()=>{
  const car=createCar();car.checkpoint={...GATES[3].spawn};
  car.body.position.set(112,5,45);simulate(idle,4,DEFAULTS,car);
  assert.equal(car.recoveries,1);assert.equal(car.recoveryReason,'water');
  assert.ok(Math.abs(car.x-car.checkpoint.x)<.2);assert.ok(car.y>2.8);
});
test('leaving the bridge edge loses support instead of driving on hidden road',()=>{
  const car=createCar();respawnCar(car,{x:112,y:3,z:40,yaw:Math.PI/2});
  simulate(idle,.4,DEFAULTS,car);assert.equal(car.grounded,0);assert.ok(car.verticalSpeed< -5);
});
