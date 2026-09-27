import test from 'node:test';
import assert from 'node:assert/strict';
import * as CANNON from 'cannon-es';
import {createTraffic,tickTraffic,resetTraffic,TRAFFIC_ROUTES,sampleRoute} from '../src/traffic.js';
const far={x:-70,y:1,z:-70};
function setup(){const world=new CANNON.World({gravity:new CANNON.Vec3(0,-18,0)});return createTraffic(world);}
function run(t,seconds,player=far){for(let i=0;i<seconds*120;i++){tickTraffic(t,player,1/120);t.world.step(1/120);}}
test('traffic completes both depot routes and recycles a bounded body pool',()=>{
  const t=setup();run(t,120);
  assert.ok(t.spawned>12,`spawned ${t.spawned}`);assert.ok(t.departed>8,`departed ${t.departed}`);
  assert.ok(t.world.bodies.length<=6);assert.equal(t.spawned-t.departed,t.world.bodies.length);
  for(const v of t.vehicles.filter(v=>v.active)){assert.ok(Number.isFinite(v.body.position.x));assert.ok(Math.abs(v.body.position.y-.98)<.01);}
  resetTraffic(t);assert.equal(t.world.bodies.length,0);assert.equal(t.spawned,0);
});
test('no cars materialize near the player at the entry garage',()=>{
  const t=setup();run(t,6,{...sampleRoute(TRAFFIC_ROUTES[0],0),y:1});
  assert.equal(t.vehicles.filter(v=>v.active&&v.route===0).length,0);
  assert.ok(t.vehicles.some(v=>v.active&&v.route===1));
});
test('arrivals wait at their depot until the player is far enough away',()=>{
  const t=setup();run(t,.1);const v=t.vehicles.find(v=>v.active),route=TRAFFIC_ROUTES[v.route],end=sampleRoute(route,route.length);
  v.s=route.length-.1;v.body.position.set(end.x,.98,end.z);
  tickTraffic(t,{...end,y:1},1/120);assert.ok(v.active&&v.waiting);
  tickTraffic(t,far,1/120);assert.equal(v.active,false);assert.equal(t.departed,1);
});
test('locals brake for a player ahead in their lane',()=>{
  const t=setup();run(t,12);const v=t.vehicles.find(v=>v.active&&v.route===0),pose=sampleRoute(TRAFFIC_ROUTES[0],v.s);
  tickTraffic(t,{x:v.body.position.x+pose.fx*9,y:1,z:v.body.position.z+pose.fz*9},1/120);
  assert.equal(v.braking,true);
});
test('traffic rigid bodies transfer collision impulses to a player chassis',()=>{
  const t=setup();run(t,.1);const v=t.vehicles.find(v=>v.active),p=v.body.position;
  const player=new CANNON.Body({mass:650,collisionFilterGroup:2,shape:new CANNON.Box(new CANNON.Vec3(1.3,.7,2.3))});
  player.position.set(p.x,.98,p.z-6);player.velocity.set(0,0,12);t.world.addBody(player);
  let hits=0;player.addEventListener('collide',()=>hits++);
  for(let i=0;i<60;i++)t.world.step(1/120);
  assert.ok(hits>0);assert.ok(v.body.velocity.z>1);
});
