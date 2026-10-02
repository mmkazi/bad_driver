import test from 'node:test';
import assert from 'node:assert/strict';
// Import the actual selected-map path, just as a fresh browser page does.
globalThis.location={search:'?map=pinewater'};
const course=await import('../src/course.js');
const {ROAD_POINTS,ROAD_SEGMENTS,SIDE_ROUTES,SOLIDS,TREES,ISLAND,TURNABOUT,SPAWN,GATES,JUNCTIONS}=await import('../src/pinewater.js');
const {createCar,respawnCar,stepCar,crossedGate,DEFAULTS}=await import('../src/physics.js');
const {createBot,tickBot}=await import('../src/bots.js');
const {mixCrew}=await import('../src/crew.js');
const {Vec3,RaycastResult}=await import('cannon-es');
const idle={left:0,right:0};
test('scenery connections have valid solid dimensions',()=>{
  assert.ok(SOLIDS.filter(p=>p.kind==='infill').length>20);
  for(const p of SOLIDS)assert.ok(p.width>0&&p.height>0&&p.depth>0);
});
function settle(car,seconds=.6){for(let i=0;i<seconds*120;i++)stepCar(car,idle,DEFAULTS,1/120);}

test('second map is selected with three distinct detours and a three kilometre main road',()=>{
  assert.equal(course.MAP_ID,'pinewater');assert.equal(SIDE_ROUTES.length,3);assert.ok(course.COURSE_LENGTH>2800);
  assert.ok(SIDE_ROUTES[0].at(-1).z>SPAWN.z,'Forest loop returns behind spawn');
  assert.ok(Math.hypot(SIDE_ROUTES[1].at(-1).x-TURNABOUT.x,SIDE_ROUTES[1].at(-1).z-TURNABOUT.z)<1);
  for(const route of [ROAD_POINTS,...SIDE_ROUTES])for(let i=1;i<route.length;i++){
    assert.ok(Math.hypot(route[i].x-route[i-1].x,route[i].z-route[i-1].z)<4,'No discontinuous joins');
    assert.ok(Math.abs(route[i].y-route[i-1].y)<.7,'No abrupt elevation changes');
  }
});
test('tunnel mouths are separated into two stretches with a much lower second exit',()=>{
  const entries=ROAD_POINTS.filter((p,i)=>p.section==='tunnel'&&ROAD_POINTS[i-1]?.section!=='tunnel');
  const exits=ROAD_POINTS.filter((p,i)=>p.section!=='tunnel'&&ROAD_POINTS[i-1]?.section==='tunnel');
  assert.equal(entries.length,2);assert.equal(exits.length,2);assert.ok(exits[0].y-exits[1].y>50);
  assert.ok(Math.hypot(exits[0].x-exits[1].x,exits[0].z-exits[1].z)<65);
  assert.ok(SOLIDS.some(s=>s.kind==='roof'));assert.ok(TREES.length>300);
});
test('all fork arms share the same elevation and the paved opening has support',()=>{
  const car=createCar();
  for(const j of JUNCTIONS){
    for(const route of [ROAD_POINTS,...SIDE_ROUTES])for(const p of route){
      if(Math.hypot(p.x-j.x,p.z-j.z)<26&&Math.abs(p.y-j.y)<8)assert.equal(p.y,j.y);
    }
    for(const [dx,dz] of [[0,0],[8,0],[-8,0],[0,8],[0,-8]]){
      respawnCar(car,{x:j.x+dx,y:j.y,z:j.z+dz,yaw:0});settle(car);
      assert.ok(car.grounded>=2);assert.ok(Math.abs(car.y-j.y)<.3);
    }
  }
});
test('each alternative fork entrance is drivable without a step or obstacle',()=>{
  const car=createCar({obstacles:TREES.map(p=>({x:p.x,z:p.z,y:p.y,radius:.38*p.size,height:2.7*p.size,kind:'tree'}))});
  const clamp=(v,a=-1,b=1)=>Math.max(a,Math.min(b,v));
  for(const route of SIDE_ROUTES){
    const p=route[0],q=route[4];respawnCar(car,{...p,yaw:Math.atan2(q.x-p.x,-(q.z-p.z))});let waypoint=3;
    for(let i=0;i<120*25&&waypoint<35;i++){
      while(waypoint<35&&Math.hypot(car.x-route[waypoint].x,car.z-route[waypoint].z)<4)waypoint++;
      const target=route[waypoint],desired=Math.atan2(target.x-car.x,-(target.z-car.z));
      const error=Math.atan2(Math.sin(desired-car.yaw),Math.cos(desired-car.yaw));
      stepCar(car,mixCrew([{drive:clamp((6-car.speed)*.3+.13),steer:clamp(error*1.6)}],[1]),{response:.1,turning:1.5,grip:1},1/120);
      assert.ok(car.upY>.85);
    }
    assert.ok(waypoint>=35,'Alternative entrance should not trap the driver');assert.equal(car.recoveries,0);
  }
});
test('spawn, gates, both tunnel interiors and the island have physical support',()=>{
  const car=createCar();
  const samples=[SPAWN,...GATES.map(g=>g.spawn),...ROAD_POINTS.filter((p,i)=>p.section==='tunnel'&&i%70===0),ISLAND,TURNABOUT];
  for(const p of samples){respawnCar(car,{...p,yaw:p.yaw||0});settle(car);
    assert.ok(car.grounded>=2,`No support at ${p.x},${p.y},${p.z}`);assert.ok(Math.abs(car.y-p.y)<.6);assert.ok(car.upY>.95);
  }
});
test('lake recovers to this course checkpoint, not the original yard',()=>{
  const car=createCar();car.checkpoint={...GATES[4].spawn};respawnCar(car,{x:400,y:0,z:-250,yaw:0});settle(car,3);
  assert.ok(car.recoveries>0);assert.ok(Math.hypot(car.x-car.checkpoint.x,car.z-car.checkpoint.z)<2);
});
test('tunnel walls and ceiling are solid while the forward opening stays clear',()=>{
  const car=createCar(),p=ROAD_SEGMENTS.find(s=>s.section==='tunnel'&&s.x>-85);
  const start=new Vec3(p.x,p.y+4,p.z),side=new Vec3(p.x+Math.cos(p.yaw)*15,p.y+4,p.z-Math.sin(p.yaw)*15);
  const wall=new RaycastResult(),roof=new RaycastResult();
  assert.ok(car.world.raycastClosest(start,side,{collisionFilterMask:1},wall));assert.ok(wall.distance>6&&wall.distance<10);
  assert.ok(car.world.raycastClosest(start,new Vec3(p.x,p.y+22,p.z),{collisionFilterMask:1},roof));assert.ok(roof.distance>6);
  assert.equal(car.world.raycastClosest(start,new Vec3(p.x+Math.sin(p.yaw)*10,p.y+4,p.z+Math.cos(p.yaw)*10),{collisionFilterMask:1},new RaycastResult()),false);
});
test('bots return finite ordinary controls on every route and can face back from a detour',()=>{
  for(const route of [ROAD_POINTS,...SIDE_ROUTES])for(let i=0;i<route.length-1;i+=30){
    const p=route[i],q=route[i+1],yaw=Math.atan2(q.x-p.x,-(q.z-p.z));
    for(const direction of [0,Math.PI]){
      const output=tickBot(createBot(()=>.7),{...p,yaw:yaw+direction,speed:4,forwardSpeed:4,upY:1,airTime:0,yawRate:0},{},.3);
      assert.ok(Number.isFinite(output.drive)&&Number.isFinite(output.steer));
    }
  }
});
test('a cooperating driver can traverse both tunnels and stop on the island',()=>{
  const obstacles=TREES.map(p=>({x:p.x,z:p.z,y:p.y,radius:.38*p.size,height:2.7*p.size,kind:'tree'}));
  const car=createCar({obstacles}),bot=createBot(()=>.25);let gate=0,finished=false;
  for(let i=0;i<120*800&&!finished;i++){
    const previous={x:car.x,y:car.y,z:car.z};
    const input=tickBot(bot,car,{gateIndex:gate},1/120);
    stepCar(car,mixCrew([input],[1]),{response:.1,turning:1.5,grip:1},1/120);
    if(gate<GATES.length&&crossedGate(previous,car,GATES[gate])){car.checkpoint={...GATES[gate].spawn};gate++;}
    finished=gate===GATES.length&&Math.hypot(car.x-ISLAND.x,car.z-ISLAND.z)<4&&car.speed<.7;
  }
  assert.equal(gate,GATES.length,`Stopped at gate ${gate}: ${car.x}, ${car.y}, ${car.z}`);
  assert.equal(car.recoveries,0);assert.ok(finished,`Did not stop: ${car.x},${car.z}, speed ${car.speed}`);
});
