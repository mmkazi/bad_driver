import * as THREE from 'three';
import {SOLIDS,TREES,ISLAND,TURNABOUT,TURNABOUT_GROVE,ROAD_POINTS,ROAD_SEGMENTS,BRANCH_SEGMENTS,SIDE_ROUTES,JUNCTIONS,junctionAt} from './pinewater.js';

// Equal coordinates always get the same bump, including the duplicated corners
// of neighbouring triangles. That roughens the stone without opening cracks.
function noise(x,y,z){return (Math.sin(x*17.13+y*37.7+z*11.91)*43758.5453)%1;}
function rockShape(kind){
  const shape=new THREE.BoxGeometry(1,1,1,2,8,2).toNonIndexed(),p=shape.attributes.position,colors=[];
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),n=noise(x,y,z);
    const bulge=kind==='infill'?.01:kind==='rock'?.08:.055;
    p.setXYZ(i,x+Math.sign(x)*Math.abs(n)*bulge,y+(kind==='bank'?0:Math.sin(x*13+z*9)*.025),z+Math.sign(z)*Math.abs(n)*.05);
    // Muted warm/cool bands read as layers of rock rather than painted stripes.
    const shade=.78+Math.sin(y*24+x*3)*.07+n*.06;
    colors.push(shade*.97,shade,shade*.97);
  }
  shape.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));shape.computeVertexNormals();return shape;
}

function addJunctions(scene,material){
  const routes=[ROAD_POINTS,...SIDE_ROUTES];
  function surface(points,y,color){
    const flat=points.map(p=>new THREE.Vector2(p.x,p.z));
    const triangles=THREE.ShapeUtils.triangulateShape(flat,[]),positions=points.flatMap(p=>[p.x,y,p.z]);
    const shape=new THREE.BufferGeometry();shape.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    shape.setIndex(triangles.flatMap(t=>[t[2],t[1],t[0]]));shape.computeVertexNormals();
    const mesh=new THREE.Mesh(shape,material(color));mesh.receiveShadow=true;scene.add(mesh);
  }
  for(const j of JUNCTIONS){
    const mouths=[];
    for(const route of routes)for(let i=0;i<route.length;i++){
      const p=route[i];if(junctionAt(p))continue;
      if(![route[i-1],route[i+1]].some(q=>q&&junctionAt(q)===j))continue;
      const a=route[Math.max(0,i-1)],b=route[Math.min(route.length-1,i+1)],length=Math.hypot(b.x-a.x,b.z-a.z);
      const nx=-(b.z-a.z)/length,nz=(b.x-a.x)/length,angle=Math.atan2(p.z-j.z,p.x-j.x);
      const edges=[-1,1].map(side=>({x:p.x+nx*p.width/2*side,z:p.z+nz*p.width/2*side}));
      const relative=e=>Math.atan2(Math.sin(Math.atan2(e.z-j.z,e.x-j.x)-angle),Math.cos(Math.atan2(e.z-j.z,e.x-j.x)-angle));
      edges.sort((a,b)=>relative(a)-relative(b));mouths.push({angle,edges});
    }
    mouths.sort((a,b)=>a.angle-b.angle);
    const outline=[],curves=[];
    mouths.forEach((mouth,i)=>{
      const [a,b]=mouth.edges,c=mouths[(i+1)%mouths.length].edges[0];outline.push(a,b);
      // A rounded inward edge joins each pair of arms. Leave the mouths open:
      // no line continues across the fork to advertise one preferred branch.
      const control={x:j.x*.65+(b.x+c.x)*.175,z:j.z*.65+(b.z+c.z)*.175},curve=[b];
      for(let k=1;k<=16;k++){
        const t=k/16,u=1-t,p={x:u*u*b.x+2*u*t*control.x+t*t*c.x,z:u*u*b.z+2*u*t*control.z+t*t*c.z};
        curve.push(p);if(k<16)outline.push(p);
      }
      curves.push(curve);
    });
    surface(outline,j.y+.015,0x79867e);
    for(const curve of curves){
      const outer=[],inner=[];
      for(const p of curve){
        const dx=j.x-p.x,dz=j.z-p.z,n=Math.hypot(dx,dz);
        outer.push({x:p.x+dx/n*.125,z:p.z+dz/n*.125});inner.push({x:p.x+dx/n*.475,z:p.z+dz/n*.475});
      }
      surface([...outer,...inner.reverse()],j.y+.04,0xe9c897);
    }
  }
}

// Hundreds of trees and rock pieces share a few shapes. Draw each collection
// together instead of sending a separate drawing request for every leaf crown.
export function addPinewater(scene,cameraObstacles,obstacles,{box,cylinder,material,label}){
  addJunctions(scene,material);
  const transform=new THREE.Object3D();
  function instances(shape,color,items,pose){
    const mesh=new THREE.InstancedMesh(shape,material(color),items.length);
    items.forEach((item,i)=>{transform.position.set(0,0,0);transform.rotation.set(0,0,0);transform.scale.set(1,1,1);pose(item,transform,i);transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix);});
    mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);return mesh;
  }
  for(const kind of ['bank','rock','roof','ridge','infill']){
    const pieces=SOLIDS.filter(p=>p.kind===kind);
    const mesh=instances(kind==='ridge'?new THREE.IcosahedronGeometry(1,0):rockShape(kind),kind==='bank'?0x92917f:0x9b9e94,pieces,(p,o)=>{
      o.position.set(p.x,p.y+p.height/2,p.z);o.rotation.y=p.yaw;
      const variation=kind==='ridge'?1+noise(p.x,0,p.z)*.3:1;
      o.scale.set(p.width*(kind==='ridge'?.75:1),p.height*(kind==='ridge'?.8*variation:1),p.depth*(kind==='ridge'?1.2:1));
      if(kind==='ridge'){o.rotation.z=noise(p.x,1,p.z)*.3;o.rotation.y+=noise(p.x,2,p.z)*.4;}
    });
    if(kind!=='ridge'){mesh.material=mesh.material.clone();mesh.material.vertexColors=true;}
    if(kind==='bank'){
      const side=mesh.material,top=new THREE.MeshStandardMaterial({visible:false});
      mesh.material=[side,side,top,side,side,side];
    }
    cameraObstacles.push(mesh);
  }
  const roads=[...ROAD_SEGMENTS,...BRANCH_SEGMENTS],bridge=roads.filter(s=>s.section==='bridge');
  instances(new THREE.BoxGeometry(1,1,1),0x8b8170,bridge,(p,o)=>{o.position.set(p.x,p.y-.32,p.z);o.rotation.set(p.pitch,p.yaw,0,'YXZ');o.scale.set(p.width,.6,p.length+.25);});
  instances(new THREE.BoxGeometry(1,1,1),0xe8e3c9,roads.filter(s=>s.section!=='bridge'&&s.index%5===0&&!JUNCTIONS.some(j=>Math.hypot(s.x-j.x,s.z-j.z)<27)),(p,o)=>{o.position.set(p.x,p.y+.025,p.z);o.rotation.set(p.pitch,p.yaw,0,'YXZ');o.scale.set(.16,.025,2);});
  instances(new THREE.BoxGeometry(1,1,1),0x7b705a,bridge,(p,o)=>{o.position.set(p.x,p.y+.02,p.z);o.rotation.set(p.pitch,p.yaw,0,'YXZ');o.scale.set(p.width-.2,.015,.045);});
  for(const p of bridge.filter(s=>s.index%15===0))for(const side of [-1,1])box(scene,.7,p.y+2,.7,0x9a9178,p.x+side*3,p.y/2-1,p.z);
  // Partly buried outcrops break up the tall cliff faces. Keep them below the
  // shoulder and away from every road, especially the lane under the high exit.
  const outcrops=[];
  SOLIDS.filter(p=>p.kind==='bank'&&p.height>14).forEach((p,i)=>{
    if(i%2||Math.abs(noise(p.x,2,p.z))<.2)return;
    for(const side of [-1,1])for(const row of [0,1,2]){
      const n=noise(p.x,row+side*.13,p.z),level=.12+row*.29+n*.12;
      const sx=3+Math.abs(n)*4,sy=3+Math.abs(noise(p.x,4+row,p.z))*7,sz=3+Math.abs(n)*6;
      const along=noise(p.x,row+8,p.z)*p.depth;
      const x=p.x+Math.cos(p.yaw)*(p.width/2-1.5)*side+Math.sin(p.yaw)*along,z=p.z-Math.sin(p.yaw)*(p.width/2-1.5)*side+Math.cos(p.yaw)*along,y=p.y+p.height*level;
      if(y+sy>p.y+p.height-.8)continue;
      if([ROAD_POINTS,...SIDE_ROUTES].some(route=>route.some(q=>Math.abs(q.y-y)<sy+4&&Math.hypot(q.x-x,q.z-z)<q.width/2+6)))continue;
      outcrops.push({x,y,z,sx,sy,sz,yaw:p.yaw+n*.7,tilt:n*.5});
    }
  });
  instances(new THREE.IcosahedronGeometry(1,0),0x91958b,outcrops,(p,o)=>{o.position.set(p.x,p.y,p.z);o.scale.set(p.sx,p.sy,p.sz);o.rotation.set(p.tilt,p.yaw,p.tilt*.6);});
  // Broad crowns close the view between trunks. The trunks are solid, while
  // leaves remain decorative so brushing a branch doesn't stop the car.
  instances(new THREE.CylinderGeometry(.22,.38,2.7,7),0x786f57,TREES,(p,o)=>{
    o.position.set(p.x,p.y+1.35*p.size,p.z);o.scale.setScalar(p.size);
  });
  const leaf=new THREE.IcosahedronGeometry(1,1);
  for(const [dx,dy,dz,sx,sy,sz,color] of [[-1,3.5,0,1.8,2,1.7,0x496f55],[1,3.8,.2,1.8,2,1.7,0x5f805c],[0,5.2,0,1.8,2,1.8,0x77966a]]){
    instances(leaf,color,TREES,(p,o)=>{o.position.set(p.x+dx*p.size,p.y+dy*p.size,p.z+dz*p.size);o.scale.set(sx*p.size,sy*p.size,sz*p.size);});
  }
  TREES.forEach(p=>obstacles.push({x:p.x,z:p.z,y:p.y,radius:.38*p.size,height:2.7*p.size,kind:'tree'}));

  // A few enormous distant peaks frame the lake without covering a road.
  for(const [x,z,r,h] of [[-410,-360,140,180],[-160,-580,110,170],[220,-730,125,200],[500,-750,135,220],[840,-540,110,165],[930,-160,110,170],[870,280,100,170]]){
    cylinder(scene,0,r,h,0x7d958b,x,h/2-5,z,7);
    cylinder(scene,0,r*.22,h*.23,0xe3e9df,x,h*.885-5,z,7);
  }
  // Raised rock along the tunnel roof makes it read as a ridge, rather than
  // a freestanding tube. The mouth remains clear; no scenery covers the road.
  const tunnel=ROAD_SEGMENTS.filter(s=>s.section==='tunnel'&&s.index%16===0);
  instances(new THREE.IcosahedronGeometry(1,0),0x7f9083,tunnel,(p,o)=>{const n=noise(p.x,5,p.z);o.position.set(p.x,p.y+24+n*2,p.z);o.scale.set(23+n*3,10+n*3,25);o.rotation.y=n;});
  for(let i=0;i<ROAD_POINTS.length-1;i++){
    const p=ROAD_POINTS[i];if(p.section!=='tunnel'||i%28)continue;
    const lamp=box(scene,.8,.12,1.5,0xffe5a0,p.x,p.y+10.7,p.z);
    lamp.material=new THREE.MeshBasicMaterial({color:0xffe5a0});
  }
  const grove=TURNABOUT_GROVE;
  cylinder(scene,grove.radius,grove.radius,grove.depth,0x829078,grove.x,grove.y-grove.depth/2,grove.z,32);
  for(const p of [ISLAND,TURNABOUT]){
    cylinder(scene,p.radius,p.radius+3,2,p===ISLAND?0xa9b781:0x7e8b80,p.x,p.y-1,p.z,32);
  }
  // The goal is visible as a landmark across the water, not as a helpful sign
  // at every fork. A small clearing gives the crew somewhere to stop together.
  cylinder(scene,.16,.2,16,0xf5e9cc,ISLAND.x+9,ISLAND.y+8,ISLAND.z,10);
  const flag=box(scene,7,3,.12,0xe9784c,ISLAND.x+12.5,ISLAND.y+14.5,ISLAND.z);
  const finish=label(scene,'FINISH',11);finish.position.set(ISLAND.x,ISLAND.y+5,ISLAND.z+7);finish.rotation.y=Math.PI;
  for(let i=0;i<8;i++)for(let j=0;j<2;j++)box(scene,2,.025,2,(i+j)%2?0x334d45:0xf4e7c2,303+i*2,3.055,-280+j*2);
  return flag;
}
