import * as CANNON from 'cannon-es';
import { ROAD_SEGMENTS, ROAD_THICKNESS, CLIFF_START, GATES, LAKE, BOUNDS, BRIDGE_RAILS, inLake } from './course.js';
import { createTraffic, tickTraffic } from './traffic.js';

export { CLIFF_START, GATES };
export const DEFAULTS = Object.freeze({ response: 0.45, turning: 1, grip: 0.75 });
export const SPAWN = Object.freeze({ x: 0, y: 0, z: 36, yaw: 0 });
export const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const MASS=650, RIDE_HEIGHT=1.35, WHEEL_RADIUS=.65;
const UP=new CANNON.Vec3(0,1,0), FORWARD=new CANNON.Vec3(0,0,-1);
const WHEELS=[-1.45,1.45].flatMap(x=>[-1.48,1.48].map(z=>new CANNON.Vec3(x,-.1,z)));

export function inputsFor(keys,mode='shared'){
  const pressed=key=>keys.has(key)?1:0;
  if(mode==='shared')return {left:pressed('KeyW')-pressed('KeyS'),right:pressed('ArrowUp')-pressed('ArrowDown')};
  const throttle=pressed('KeyW')-pressed('KeyS'),turn=pressed('KeyD')-pressed('KeyA');
  return {left:clamp(throttle+turn*.8,-1,1),right:clamp(throttle-turn*.8,-1,1)};
}
function staticBox(world,halfExtents,position,quaternion){
  const body=new CANNON.Body({mass:0,collisionFilterGroup:1});
  body.addShape(new CANNON.Box(halfExtents));body.position.copy(position);
  if(quaternion)body.quaternion.copy(quaternion);
  body.aabbNeedsUpdate=true;
  world.addBody(body);return body;
}
export function createCar({course=true,obstacles=[],traffic=false}={}){
  const world=new CANNON.World({gravity:new CANNON.Vec3(0,-18,0)});
  world.broadphase=new CANNON.SAPBroadphase(world);world.solver.iterations=12;
  world.defaultContactMaterial.friction=.35;world.defaultContactMaterial.restitution=.12;
  function terrain(x1,x2,z1,z2,top=-.07){staticBox(world,new CANNON.Vec3((x2-x1)/2,3,(z2-z1)/2),new CANNON.Vec3((x1+x2)/2,top-3,(z1+z2)/2));}
  if(course){
    terrain(BOUNDS.minX,LAKE.minX,BOUNDS.minZ,BOUNDS.maxZ);
    terrain(LAKE.maxX,BOUNDS.maxX,BOUNDS.minZ,BOUNDS.maxZ);
    terrain(LAKE.minX,LAKE.maxX,BOUNDS.minZ,LAKE.minZ);
    terrain(LAKE.minX,LAKE.maxX,LAKE.maxZ,BOUNDS.maxZ);
    terrain(LAKE.minX,LAKE.maxX,LAKE.minZ,LAKE.maxZ,LAKE.bottom);
  }else terrain(BOUNDS.minX,BOUNDS.maxX,BOUNDS.minZ,BOUNDS.maxZ);
  if(course)for(const s of ROAD_SEGMENTS){
    const q=new CANNON.Quaternion();q.setFromEuler(s.pitch,s.yaw,0,'YXZ');const n=q.vmult(UP);
    staticBox(world,new CANNON.Vec3(s.width/2,ROAD_THICKNESS/2,s.length/2+.12),
      new CANNON.Vec3(s.x-n.x*ROAD_THICKNESS/2,s.y-n.y*ROAD_THICKNESS/2,s.z-n.z*ROAD_THICKNESS/2),q);
  }
  if(course)for(const rail of BRIDGE_RAILS)staticBox(world,new CANNON.Vec3(rail.width/2,rail.height/2,rail.depth/2),new CANNON.Vec3(rail.x,rail.y,rail.z));
  for(const o of obstacles){
    if(o.kind==='cone')continue;
    const height=o.kind==='building'?6:1.5;
    staticBox(world,new CANNON.Vec3(o.radius,height/2,o.radius),new CANNON.Vec3(o.x,(o.y||0)+height/2,o.z));
  }
  for(const x of [BOUNDS.minX,BOUNDS.maxX])staticBox(world,new CANNON.Vec3(.5,1,(BOUNDS.maxZ-BOUNDS.minZ)/2),new CANNON.Vec3(x,1,(BOUNDS.minZ+BOUNDS.maxZ)/2));
  for(const z of [BOUNDS.minZ,BOUNDS.maxZ])staticBox(world,new CANNON.Vec3((BOUNDS.maxX-BOUNDS.minX)/2,1,.5),new CANNON.Vec3((BOUNDS.minX+BOUNDS.maxX)/2,1,z));
  const body=new CANNON.Body({mass:MASS,collisionFilterGroup:2,linearDamping:.06,angularDamping:.18});
  body.addShape(new CANNON.Box(new CANNON.Vec3(1.38,.5,2.2)),new CANNON.Vec3(0,-.12,0));
  body.addShape(new CANNON.Box(new CANNON.Vec3(1.14,.54,1.14)),new CANNON.Vec3(0,.72,.15));
  world.addBody(body);
  const car={world,body,obstacles,course,waterTime:0,recoveryReason:'',checkpoint:{...SPAWN},left:0,right:0,distance:0,hit:0,impact:0,
    grounded:0,airTime:0,overturnedTime:0,respawned:false,recoveries:0,wheelHeights:[.65,.65,.65,.65]};
  body.addEventListener('collide',event=>{car.impact=Math.max(car.impact,Math.abs(event.contact.getImpactVelocityAlongNormal()));});
  if(traffic)car.traffic=createTraffic(world);
  respawnCar(car,SPAWN);car.respawned=false;return car;
}
function syncState(car){
  const {position:p,velocity:v,quaternion:q}=car.body;
  const forward=q.vmult(FORWARD),up=q.vmult(UP);
  car.x=p.x;car.y=p.y-RIDE_HEIGHT;car.z=p.z;
  car.vx=v.x;car.vz=v.z;car.speed=Math.hypot(v.x,v.z);car.verticalSpeed=v.y;
  car.forwardSpeed=v.dot(forward);car.upY=up.y;
  if(Math.hypot(forward.x,forward.z)>.2)car.yaw=Math.atan2(forward.x,-forward.z);
  car.yawRate=-car.body.angularVelocity.y;
  car.quaternion={x:q.x,y:q.y,z:q.z,w:q.w};
}
export function respawnCar(car,spawn=car.checkpoint){
  const b=car.body;b.position.set(spawn.x,spawn.y+RIDE_HEIGHT+.12,spawn.z);
  b.previousPosition.copy(b.position);b.interpolatedPosition.copy(b.position);
  b.quaternion.setFromEuler(0,-spawn.yaw,0);b.previousQuaternion.copy(b.quaternion);b.interpolatedQuaternion.copy(b.quaternion);
  b.velocity.setZero();b.angularVelocity.setZero();b.force.setZero();b.torque.setZero();
  b.aabbNeedsUpdate=true;b.wakeUp();car.world.broadphase.dirty=true;
  car.left=car.right=car.overturnedTime=car.airTime=car.hit=car.impact=car.waterTime=0;
  car.grounded=0;car.yaw=spawn.yaw;car.respawned=true;syncState(car);
}

// Suspension rays and tire forces act on an unconstrained rigid chassis.
// Airborne motion has gravity and angular momentum, with no orientation snap.
export function stepCar(car,input,tune,dt,effects={}){
  const b=car.body;car.respawned=false;car.impact=0;
  const ramp=1-Math.exp(-dt/Math.max(.05,tune.response));
  car.left+=(input.left-car.left)*ramp;car.right+=(input.right-car.right)*ramp;
  car.leftDrive=car.left+(effects.surgeSide==='left'?.65:0);
  car.rightDrive=car.right+(effects.surgeSide==='right'?.65:0);
  const gripFactor=effects.gripFactor??1;
  const up=b.quaternion.vmult(UP),forward=b.quaternion.vmult(FORWARD);
  let contacts=0;const normalSum=new CANNON.Vec3();
  for(let i=0;i<WHEELS.length;i++){
    const relative=b.quaternion.vmult(WHEELS[i]),origin=b.position.vadd(relative),end=origin.vadd(up.scale(-1.8));
    const result=new CANNON.RaycastResult();car.wheelHeights[i]=.48;
    if(up.y<.15||!car.world.raycastClosest(origin,end,{collisionFilterMask:1,skipBackfaces:true},result))continue;
    const normal=result.hitNormalWorld,velocity=new CANNON.Vec3();b.getVelocityAtWorldPoint(origin,velocity);
    const spring=clamp((1.45-result.distance)*22000-velocity.dot(normal)*2400,0,24000);
    if(spring<=0)continue;
    contacts++;normalSum.vadd(normal,normalSum);
    car.wheelHeights[i]=RIDE_HEIGHT+WHEELS[i].y-result.distance+WHEEL_RADIUS;
    b.applyForce(normal.scale(spring),relative);
    const tangent=forward.vsub(normal.scale(forward.dot(normal)));tangent.normalize();
    const right=tangent.cross(normal);right.normalize();
    const along=velocity.dot(tangent),sideways=velocity.dot(right);
    let power=i<2?car.leftDrive:car.rightDrive;
    if(Math.sign(power)!==Math.sign(along)&&Math.abs(along)>.5)power*=1.7;
    const traction=power*MASS*10/4-along*Math.abs(along)*MASS*.009/4-along*MASS*.12/4;
    const lateral=clamp(-sideways*MASS*(2+tune.grip*9)*gripFactor/4,-spring*(.5+tune.grip)*gripFactor,spring*(.5+tune.grip)*gripFactor);
    const force=tangent.scale(clamp(traction,-spring*1.6,spring*1.6)).vadd(right.scale(lateral));
    const tirePoint=b.quaternion.vmult(new CANNON.Vec3(WHEELS[i].x,-.35,WHEELS[i].z));b.applyForce(force,tirePoint);
  }
  if(contacts>=2&&up.y>.35){
    normalSum.normalize();const speed=Math.abs(b.velocity.dot(forward));
    const target=-(car.leftDrive-car.rightDrive)*tune.turning*(.35+Math.min(speed/13,1)*.7);
    const current=b.angularVelocity.dot(normalSum);
    b.torque.vadd(normalSum.scale((target-current)*b.inertia.y*4*contacts/4*Math.sqrt(gripFactor)),b.torque);
  }
  if(car.traffic)tickTraffic(car.traffic,{x:b.position.x,y:b.position.y,z:b.position.z},dt);
  car.world.step(dt);car.grounded=contacts;car.airTime=contacts===0?car.airTime+dt:0;
  syncState(car);car.distance+=car.speed*dt;car.hit=Math.max(0,car.hit-dt*3);
  for(const o of car.obstacles){
    if(o.kind!=='cone'||o.knocked||Math.abs(car.y-(o.y||0))>2)continue;
    const dx=o.x-car.x,dz=o.z-car.z,d=Math.hypot(dx,dz);
    if(d<2&&car.speed>.6){o.knocked=true;o.kick={x:dx/(d||1),z:dz/(d||1)};}
  }
  const restingContact=car.world.contacts.some(c=>c.bi===b||c.bj===b);
  const overturned=car.upY<.25&&restingContact&&b.velocity.length()<3;
  car.overturnedTime=overturned?car.overturnedTime+dt:0;
  const impact=car.impact;if(impact>2)car.hit=1;
  const submerged=car.course&&inLake(car.x,car.z)&&b.position.y<LAKE.surface+.65;
  car.waterTime=submerged?car.waterTime+dt:0;
  if(submerged){b.velocity.scale(Math.exp(-dt*3),b.velocity);b.angularVelocity.scale(Math.exp(-dt*2),b.angularVelocity);}
  const outside=car.x<BOUNDS.minX-15||car.x>BOUNDS.maxX+15||car.z<BOUNDS.minZ-15||car.z>BOUNDS.maxZ+15;
  if(car.waterTime>.65||car.overturnedTime>1.8||b.position.y< -18||outside){
    car.recoveryReason=car.waterTime>.65?'water':'overturned';
    if(car.recoveryReason==='water')car.lastSplash={x:car.x,z:car.z};
    car.recoveries++;respawnCar(car);
  }
  return impact;
}
export function crossedGate(previous,car,gate){
  const signed=p=>(p.x-gate.x)*Math.sin(gate.yaw)-(p.z-gate.z)*Math.cos(gate.yaw);
  const before=signed(previous),after=signed(car);if(before>=0||after<0)return false;
  const t=-before/(after-before),x=previous.x+(car.x-previous.x)*t,z=previous.z+(car.z-previous.z)*t;
  const y=(previous.y??car.y??0)+((car.y??0)-(previous.y??car.y??0))*t;
  return Math.abs((x-gate.x)*Math.cos(gate.yaw)+(z-gate.z)*Math.sin(gate.yaw))<(gate.halfWidth??5.1)&&Math.abs(y-gate.y)<2.5;
}
