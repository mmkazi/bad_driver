import * as CANNON from 'cannon-es';
import { ROAD_SEGMENTS, BRANCH_SEGMENTS, SHORTCUT_POSTS, ROAD_THICKNESS, CLIFF_START, GATES, LAKE, BOUNDS, BRIDGE_RAILS, inLake } from './course.js';
import { createTraffic, tickTraffic } from './traffic.js';

export { CLIFF_START, GATES };
export const DEFAULTS = Object.freeze({ response: 0.45, turning: 1, grip: 0.75 });
export const SPAWN = Object.freeze({ x: 0, y: 0, z: 36, yaw: 0 });
export const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const MASS=650, RIDE_HEIGHT=1.35, WHEEL_RADIUS=.65;
const UP=new CANNON.Vec3(0,1,0), FORWARD=new CANNON.Vec3(0,0,-1);
const WHEELS=[-1.45,1.45].flatMap(x=>[-1.48,1.48].map(z=>new CANNON.Vec3(x,-.1,z)));

// Convert the older split-wheel keyboard into power on each side of the car.
// Solo mode mixes throttle and steering into those same left/right controls.
export function inputsFor(keys,mode='shared'){
  const pressed=key=>keys.has(key)?1:0;
  if(mode==='shared')return {left:pressed('KeyW')-pressed('KeyS'),right:pressed('ArrowUp')-pressed('ArrowDown')};
  const throttle=pressed('KeyW')-pressed('KeyS'),turn=pressed('KeyD')-pressed('KeyA');
  return {left:clamp(throttle+turn*.8,-1,1),right:clamp(throttle-turn*.8,-1,1)};
}
function staticBox(world,halfExtents,position,quaternion){
  // Mass zero makes this part of the world: it can stop the car, but the car
  // cannot push it out of place.
  const body=new CANNON.Body({mass:0,collisionFilterGroup:1});
  body.addShape(new CANNON.Box(halfExtents));body.position.copy(position);
  if(quaternion)body.quaternion.copy(quaternion);
  body.aabbNeedsUpdate=true;
  world.addBody(body);return body;
}
export function createCar({course=true,obstacles=[],traffic=false}={}){
  // The physics world contains the floor, road pieces, props and one movable
  // car body. The drawn model is only a view of this body, not its physics.
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
  if(course)for(const s of [...ROAD_SEGMENTS,...BRANCH_SEGMENTS]){
    // Road pieces are solid boxes rotated to match the sloped/curved course.
    // The separate points come from course.js, shared with the visible road.
    const q=new CANNON.Quaternion();q.setFromEuler(s.pitch,s.yaw,0,'YXZ');const n=q.vmult(UP);
    staticBox(world,new CANNON.Vec3(s.width/2,ROAD_THICKNESS/2,s.length/2+.12),
      new CANNON.Vec3(s.x-n.x*ROAD_THICKNESS/2,s.y-n.y*ROAD_THICKNESS/2,s.z-n.z*ROAD_THICKNESS/2),q);
  }
  if(course)for(const rail of BRIDGE_RAILS)staticBox(world,new CANNON.Vec3(rail.width/2,rail.height/2,rail.depth/2),new CANNON.Vec3(rail.x,rail.y,rail.z));
  for(const o of [...obstacles,...(course?SHORTCUT_POSTS:[])]){
    if(o.kind==='cone')continue;
    const height=o.height??(o.kind==='building'?6:1.5);
    const q=new CANNON.Quaternion();q.setFromEuler(0,o.yaw||0,0);
    staticBox(world,new CANNON.Vec3(o.width?o.width/2:o.radius,height/2,o.depth?o.depth/2:o.radius),new CANNON.Vec3(o.x,(o.y||0)+height/2,o.z),q);
  }
  for(const x of [BOUNDS.minX,BOUNDS.maxX])staticBox(world,new CANNON.Vec3(.5,1,(BOUNDS.maxZ-BOUNDS.minZ)/2),new CANNON.Vec3(x,1,(BOUNDS.minZ+BOUNDS.maxZ)/2));
  for(const z of [BOUNDS.minZ,BOUNDS.maxZ])staticBox(world,new CANNON.Vec3((BOUNDS.maxX-BOUNDS.minX)/2,1,.5),new CANNON.Vec3((BOUNDS.minX+BOUNDS.maxX)/2,1,z));
  const body=new CANNON.Body({mass:MASS,collisionFilterGroup:2,linearDamping:.06,angularDamping:.18});
  // Two simple boxes give the car solid physics with a low frame and higher
  // cabin. Suspension and tire forces below keep its wheels on the ground.
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
  // Copy the physics body's position and motion into easy-to-read values for
  // the camera, dashboard and checkpoint logic.
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
  // Put the car back at the last safe point and clear all motion. The same
  // function handles the reset button and automatic recovery after a fall.
  const b=car.body;b.position.set(spawn.x,spawn.y+RIDE_HEIGHT+.12,spawn.z);
  b.previousPosition.copy(b.position);b.interpolatedPosition.copy(b.position);
  b.quaternion.setFromEuler(0,-spawn.yaw,0);b.previousQuaternion.copy(b.quaternion);b.interpolatedQuaternion.copy(b.quaternion);
  b.velocity.setZero();b.angularVelocity.setZero();b.force.setZero();b.torque.setZero();
  b.aabbNeedsUpdate=true;b.wakeUp();car.world.broadphase.dirty=true;
  car.left=car.right=car.steer=car.overturnedTime=car.airTime=car.hit=car.impact=car.waterTime=car.arcadeDisruption=0;
  car.grounded=0;car.yaw=spawn.yaw;car.respawned=true;syncState(car);
}

// Suspension rays and tire forces act on a freely moving car frame.
// Airborne motion has gravity and angular momentum, with no orientation snap.
export function stepCar(car,input,tune,dt,effects={}){
  // One short physics update. Inputs build up over time rather than snapping
  // instantly; the chosen arcade tune makes the everyone-drives mode quicker.
  const b=car.body;car.respawned=false;car.impact=0;
  car.arcadeDisruption=Math.max(0,(car.arcadeDisruption||0)-dt);
  car.steer=((car.steer||0)+((input.steer||0)-(car.steer||0))*(1-Math.exp(-dt/(input.arcade?.07:.14))));
  const ramp=1-Math.exp(-dt/Math.max(.05,tune.response));
  car.left+=(input.left-car.left)*ramp;car.right+=(input.right-car.right)*ramp;
  car.leftDrive=car.left+(effects.surgeSide==='left'?.65:0);
  car.rightDrive=car.right+(effects.surgeSide==='right'?.65:0);
  const gripFactor=effects.gripFactor??1;
  const up=b.quaternion.vmult(UP),forward=b.quaternion.vmult(FORWARD);
  let contacts=0,arcadeTarget=null;const normalSum=new CANNON.Vec3();
  for(let i=0;i<WHEELS.length;i++){
    // A ray checks below each wheel. If it touches road, a spring pushes up
    // against gravity, then engine power and sideways grip act at that wheel.
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
    // The front/back pair shares the same side's power. Opposing the direction
    // already moving gets a little extra force, helping braking slow the car.
    if(Math.sign(power)!==Math.sign(along)&&Math.abs(along)>.5)power*=1.7;
    // Engine force is reduced as speed rises, with a smaller drag term and
    // regular rolling resistance. The arcade version has stronger power and
    // less drag; its grip limit also rises so tires can use the extra power.
    const traction=power*MASS*(input.arcade?21:10)/4-along*Math.abs(along)*MASS*(input.arcade?.012:.009)/4-along*MASS*.12/4;
    const lateral=clamp(-sideways*MASS*(2+tune.grip*9)*gripFactor/4,-spring*(.5+tune.grip)*gripFactor,spring*(.5+tune.grip)*gripFactor);
    // Tire grip depends on how firmly the wheel is pushed into the road. Cap
    // forward force to stop the engine asking for more grip than the car has.
    const tractionLimit=spring*(input.arcade?3.2:1.6);
    const force=tangent.scale(clamp(traction,-tractionLimit,tractionLimit)).vadd(right.scale(lateral));
    const tirePoint=b.quaternion.vmult(new CANNON.Vec3(WHEELS[i].x,-.35,WHEELS[i].z));b.applyForce(force,tirePoint);
  }
  if(contacts>=2&&up.y>.35){
    // When enough wheels touch the ground, choose a turn rate. Arcade steering
    // follows one shared steering input; split-wheel mode turns from the
    // difference between left and right power.
    normalSum.normalize();const speed=Math.abs(b.velocity.dot(forward));
    const target=input.arcade
      ? -car.steer*Math.sign(b.velocity.dot(forward))*Math.min(speed/6,1)*Math.min(1.375,7/Math.max(speed,1))*tune.turning
      : -(car.leftDrive-car.rightDrive)*tune.turning*(.35+Math.min(speed/13,1)*.7);
    const current=b.angularVelocity.dot(normalSum);
    b.torque.vadd(normalSum.scale((target-current)*b.inertia.y*4*contacts/4*Math.sqrt(gripFactor)),b.torque);
    if(input.arcade&&contacts>=3&&up.y>.8&&car.arcadeDisruption===0&&gripFactor===1){
      // While upright on the road, normal driving gently corrects sideways
      // drift. This helper is disabled after a hard hit and while in the air,
      // so collisions and falls still behave like physical motion.
      arcadeTarget=target;
      // Arcade lane following only while supported. Never straighten airborne
      // cars or erase the immediate spin from a collision / grip-loss effect.
      // Remove the part of forward that points into the road to get a flat
      // direction. Keep the road normal intact for the later turn-rate limit.
      const tangent=forward.vsub(normalSum.scale(forward.dot(normalSum),new CANNON.Vec3()));tangent.normalize();
      const side=tangent.cross(normalSum);side.normalize();
      b.velocity.vsub(side.scale(b.velocity.dot(side)*(1-Math.exp(-dt*14))),b.velocity);
      b.angularVelocity.vadd(normalSum.scale((target-current)*(1-Math.exp(-dt*12))),b.angularVelocity);
      // Keep normalSum unchanged: the same road direction is needed below to
      // limit the turn rate. Writing yawVelocity into it would weaken that cap.
      const tilt=up.cross(normalSum),yawVelocity=normalSum.scale(b.angularVelocity.dot(normalSum),new CANNON.Vec3());
      const rocking=b.angularVelocity.vsub(yawVelocity);
      b.torque.vadd(new CANNON.Vec3((tilt.x*16-rocking.x*6)*b.inertia.x,(tilt.y*16-rocking.y*6)*b.inertia.y,(tilt.z*16-rocking.z*6)*b.inertia.z),b.torque);
    }
  }
  // Move local traffic and the player through the same physics world, then
  // check for water, falls and upside-down recovery after the step.
  if(car.traffic)tickTraffic(car.traffic,{x:b.position.x,y:b.position.y,z:b.position.z},dt);
  car.world.step(dt);car.grounded=contacts;car.airTime=contacts===0?car.airTime+dt:0;
  if(arcadeTarget!==null&&car.impact<=2){
    // Bring the car back to the chosen turn rate after the physics step. Use a
    // separate temporary vector so normalSum stays a unit road direction.
    const correction=normalSum.scale(arcadeTarget-b.angularVelocity.dot(normalSum),new CANNON.Vec3());
    b.angularVelocity.vadd(correction,b.angularVelocity);
    // A small lean can turn the car's roll and pitch into extra motion around
    // world-up. Keep the dashboard-visible steering rate within the same cap.
    const yawLimit=Math.abs(arcadeTarget);
    b.angularVelocity.y=clamp(b.angularVelocity.y,-yawLimit,yawLimit);
  }
  syncState(car);car.distance+=car.speed*dt;car.hit=Math.max(0,car.hit-dt*3);
  for(const o of car.obstacles){
    if(o.kind!=='cone'||o.knocked||Math.abs(car.y-(o.y||0))>2)continue;
    const dx=o.x-car.x,dz=o.z-car.z,d=Math.hypot(dx,dz);
    if(d<2&&car.speed>.6){o.knocked=true;o.kick={x:dx/(d||1),z:dz/(d||1)};}
  }
  const restingContact=car.world.contacts.some(c=>c.bi===b||c.bj===b);
  const overturned=car.upY<.25&&restingContact&&b.velocity.length()<3;
  car.overturnedTime=overturned?car.overturnedTime+dt:0;
  const impact=car.impact;if(impact>2){car.hit=1;car.arcadeDisruption=.8;}
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
  // A quick car can travel past a thin checkpoint between two physics steps.
  // Check the whole path it took, then confirm the crossing point is inside
  // the gate's width and height instead of only checking its final position.
  const signed=p=>(p.x-gate.x)*Math.sin(gate.yaw)-(p.z-gate.z)*Math.cos(gate.yaw);
  const before=signed(previous),after=signed(car);if(before>=0||after<0)return false;
  const t=-before/(after-before),x=previous.x+(car.x-previous.x)*t,z=previous.z+(car.z-previous.z)*t;
  const y=(previous.y??car.y??0)+((car.y??0)-(previous.y??car.y??0))*t;
  return Math.abs((x-gate.x)*Math.cos(gate.yaw)+(z-gate.z)*Math.sin(gate.yaw))<(gate.halfWidth??5.1)&&Math.abs(y-gate.y)<2.5;
}
