import test from 'node:test';
import assert from 'node:assert/strict';
import {BOUNDS,ROAD_POINTS} from '../src/course.js';
import {MOUNTAINS,GARAGE_PARTS,garageColliders,treeCollider} from '../src/scenery.js';
import {createCar,respawnCar,stepCar,DEFAULTS} from '../src/physics.js';

test('entire mountain footprints stay outside the play area and clear of every road point',()=>{
  for(const m of MOUNTAINS){
    assert.ok(m.x+m.radius<=BOUNDS.minX-39||m.x-m.radius>=BOUNDS.maxX+39||m.z+m.radius<=BOUNDS.minZ-39||m.z-m.radius>=BOUNDS.maxZ+39);
    for(const p of ROAD_POINTS)assert.ok(Math.hypot(m.x-p.x,m.z-p.z)>m.radius+p.width/2+15);
  }
});
test('garage parts join without overlapping volumes or coincident exterior patches',()=>{
  for(let i=0;i<GARAGE_PARTS.length;i++)for(let j=i+1;j<GARAGE_PARTS.length;j++){
    const a=GARAGE_PARTS[i],b=GARAGE_PARTS[j];
    assert.ok(Math.abs(a.x-b.x)>=(a.width+b.width)/2-1e-9||Math.abs(a.y-b.y)>=(a.height+b.height)/2-1e-9||Math.abs(a.z-b.z)>=(a.depth+b.depth)/2-1e-9);
  }
});
test('tree trunk blocks a moving car at ground level',()=>{
  const car=createCar({course:false,obstacles:[treeCollider(0,28,1)]});let impact=0;
  for(let i=0;i<360;i++)impact=Math.max(impact,stepCar(car,{left:1,right:1},DEFAULTS,1/120));
  assert.ok(impact>2);assert.ok(car.z>30);assert.ok(car.speed<1);
});
test('rotated garage has an open entrance and a solid back wall',()=>{
  const yaw=Math.PI/2,car=createCar({course:false,obstacles:garageColliders(0,0,yaw)});
  respawnCar(car,{x:-12,y:0,z:0,yaw:Math.PI/2});let entered=false,impact=0;
  for(let i=0;i<480;i++){impact=Math.max(impact,stepCar(car,{left:.5,right:.5},DEFAULTS,1/120));if(car.x>0)entered=true;}
  assert.ok(entered);assert.ok(impact>1);assert.ok(car.x<3.1);assert.ok(Math.abs(car.z)<.1);
});
