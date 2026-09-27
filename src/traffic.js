import * as CANNON from 'cannon-es';

// The first/last points sit inside garages, off the race course. Cubic ramps
// merge tangentially into two opposite lanes on the village straight.
function path(curves){
  const points=[];
  for(const [a,b,c,d] of curves)for(let i=0;i<40;i++){
    const t=i/40,u=1-t;points.push({x:u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0],z:u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1]});
  }
  const last=curves.at(-1)[3];points.push({x:last[0],z:last[1]});
  let length=0;points.forEach((p,i)=>{if(i)length+=Math.hypot(p.x-points[i-1].x,p.z-points[i-1].z);p.s=length;});
  return {points,length};
}
export const TRAFFIC_ROUTES=[
  path([[[0,236],[0,210],[6,180],[40,180]],[[40,180],[70,180],[104,180],[132,180]],[[132,180],[159,180],[175,200],[175,228]]]),
  path([[[208,130],[208,152],[182,172],[146,172]],[[146,172],[116,172],[78,172],[46,172]],[[46,172],[8,172],[-8,154],[-8,126]]]),
];
export function sampleRoute(route,distance){
  const s=Math.max(0,Math.min(route.length,distance));
  let lo=0,hi=route.points.length-1;
  while(lo+1<hi){const mid=(lo+hi)>>1;if(route.points[mid].s<s)lo=mid;else hi=mid;}
  const a=route.points[lo],b=route.points[hi],t=(s-a.s)/(b.s-a.s||1),dx=b.x-a.x,dz=b.z-a.z,n=Math.hypot(dx,dz);
  return {x:a.x+dx*t,z:a.z+dz*t,fx:dx/n,fz:dz/n,yaw:Math.atan2(dx,-dz)};
}
export function createTraffic(world){
  const vehicles=Array.from({length:6},(_,id)=>{
    const body=new CANNON.Body({mass:900,fixedRotation:true,collisionFilterGroup:4,collisionFilterMask:2|4,linearDamping:.02});
    body.addShape(new CANNON.Box(new CANNON.Vec3(1.25,.65,2.3)));body.updateMassProperties();
    return {id,body,active:false,route:id%2,s:0,speed:0,braking:false,waiting:false};
  });
  return {world,vehicles,timers:[0,3],spawned:0,departed:0};
}
export function resetTraffic(traffic){
  for(const v of traffic.vehicles){if(v.active)traffic.world.removeBody(v.body);v.active=false;v.waiting=false;v.speed=0;}
  traffic.timers=[0,3];traffic.spawned=traffic.departed=0;
}
export function tickTraffic(traffic,player,dt){
  const distance=(p,q)=>Math.hypot(p.x-q.x,p.z-q.z);
  for(let route=0;route<2;route++){
    traffic.timers[route]-=dt;
    if(traffic.timers[route]>0)continue;
    const entry=sampleRoute(TRAFFIC_ROUTES[route],0),free=traffic.vehicles.find(v=>v.route===route&&!v.active);
    const clear=distance(entry,player)>45&&traffic.vehicles.every(v=>!v.active||distance(entry,v.body.position)>14);
    if(free&&clear){
      const b=free.body;b.position.set(entry.x,.98,entry.z);b.previousPosition.copy(b.position);b.interpolatedPosition.copy(b.position);
      b.quaternion.setFromEuler(0,-entry.yaw,0);b.velocity.setZero();b.angularVelocity.setZero();b.force.setZero();b.torque.setZero();b.aabbNeedsUpdate=true;
      free.s=0;free.speed=0;free.active=true;free.waiting=false;traffic.world.addBody(b);traffic.spawned++;traffic.timers[route]=9;
    }else traffic.timers[route]=.5;
  }
  for(const v of traffic.vehicles){
    if(!v.active)continue;
    const route=TRAFFIC_ROUTES[v.route],b=v.body;
    // Progress follows actual motion; impacts cannot advance an invisible path
    // target far ahead and snap the vehicle down the road.
    const here=sampleRoute(route,v.s),forwardSpeed=b.velocity.x*here.fx+b.velocity.z*here.fz;
    v.s=Math.min(route.length,v.s+Math.max(0,forwardSpeed)*dt);
    const pose=sampleRoute(route,v.s),target=sampleRoute(route,Math.min(route.length,v.s+5));
    let desiredSpeed=8;
    for(const other of [player,...traffic.vehicles.filter(o=>o.active&&o!==v).map(o=>o.body.position)]){
      if(Math.abs((other.y||0)-b.position.y)>3)continue;
      const dx=other.x-b.position.x,dz=other.z-b.position.z,ahead=dx*pose.fx+dz*pose.fz,side=Math.abs(dx*pose.fz-dz*pose.fx);
      if(ahead>0&&ahead<20&&side<3.1)desiredSpeed=Math.min(desiredSpeed,Math.max(0,(ahead-7)*.65));
    }
    const depot=sampleRoute(route,route.length),depotDistance=distance(b.position,depot);
    if(v.s>route.length-7)desiredSpeed=Math.min(desiredSpeed,depotDistance*1.5);
    v.braking=desiredSpeed<5;
    const dx=target.x-b.position.x,dz=target.z-b.position.z,n=Math.hypot(dx,dz)||1;
    const vx=dx/n*desiredSpeed,vz=dz/n*desiredSpeed;
    const gain=1-Math.exp(-dt*(v.braking?5:2));
    b.velocity.x+=(vx-b.velocity.x)*gain;b.velocity.z+=(vz-b.velocity.z)*gain;
    // Traffic uses a lane-following rigid proxy: physical collision impulses,
    // but no suspension simulation. Vertical stabilization holds it on this flat route.
    b.force.y+=900*(18+(.98-b.position.y)*30-b.velocity.y*8);
    const targetYaw=Math.atan2(dx,-dz),q=new CANNON.Quaternion();q.setFromEuler(0,-targetYaw,0);
    b.quaternion.slerp(q,1-Math.exp(-dt*5),b.quaternion);b.aabbNeedsUpdate=true;
    v.speed=Math.hypot(b.velocity.x,b.velocity.z);
    if(route.length-v.s<.6&&depotDistance<1){
      v.waiting=true;b.velocity.x=b.velocity.z=0;
      if(distance(b.position,player)>35){traffic.world.removeBody(b);v.active=false;traffic.departed++;}
    }
  }
}
