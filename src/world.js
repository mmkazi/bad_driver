import * as THREE from 'three';
import { TRAFFIC_ROUTES, sampleRoute } from './traffic.js';
import { MOUNTAINS, GARAGE_PARTS, garageColliders, treeCollider } from './scenery.js';
import { GATES } from './physics.js';
import { ROAD_SEGMENTS, ROAD_POINTS, BRANCH_POINTS, BRANCH_SEGMENTS, SHORTCUT_POSTS, ROAD_WIDTH, ROAD_THICKNESS, LAKE, BOUNDS, FINISH, BRIDGE_RAILS, inLake } from './course.js';

const colors = { grass: 0xb6c79a, road: 0x7c897d, cream: 0xf8efd8, orange: 0xe78350, dark: 0x33473f, mint: 0x7dd4ad };
const materials = new Map();
function material(color) {
  if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: .88 }));
  return materials.get(color);
}
function box(parent, w, h, d, color, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color));
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function cylinder(parent, rt, rb, h, color, x, y, z, sides = 8) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, sides), material(color));
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function label(parent, text, width, color = '#f7efd6', background = '#3e6250') {
  const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 160;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = background; ctx.fillRect(0, 0, 768, 160);
  ctx.fillStyle = color; ctx.font = 'bold 70px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 384, 85);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, width * 160 / 768), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
  parent.add(plane); return plane;
}
function seeded(seed = 1729) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0xb9dce4); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xb9dce4);
  scene.fog = new THREE.Fog(0xb9dce4, 110, 245);
  const camera = new THREE.PerspectiveCamera(58, 1, .15, 320);
  const ambient = new THREE.HemisphereLight(0xfff3d4, 0x789270, 1.8); scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xfff0ce, 2.6); sun.position.set(-35, 65, 20); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -100; sun.shadow.camera.right = 100; sun.shadow.camera.top = 100; sun.shadow.camera.bottom = -100; sun.shadow.camera.far = 180; sun.shadow.normalBias = .05;
  scene.add(sun); scene.add(sun.target);
  function terrain(x1,x2,z1,z2,top=-.07,color=colors.grass){
    const ground=box(scene,x2-x1,5,z2-z1,color,(x1+x2)/2,top-2.5,(z1+z2)/2);ground.castShadow=false;
  }
  terrain(-240,LAKE.minX,-240,420);terrain(LAKE.maxX,380,-240,420);
  terrain(LAKE.minX,LAKE.maxX,-240,LAKE.minZ);terrain(LAKE.minX,LAKE.maxX,LAKE.maxZ,420);
  terrain(LAKE.minX,LAKE.maxX,LAKE.minZ,LAKE.maxZ,LAKE.bottom,0xada57c);
  const water=new THREE.Mesh(new THREE.PlaneGeometry(LAKE.maxX-LAKE.minX,LAKE.maxZ-LAKE.minZ),new THREE.MeshStandardMaterial({color:0x56b5c5,roughness:.27,metalness:.12,transparent:true,opacity:.9}));
  water.rotation.x=-Math.PI/2;water.position.set((LAKE.minX+LAKE.maxX)/2,LAKE.surface,(LAKE.minZ+LAKE.maxZ)/2);scene.add(water);
  const ripples=[];
  for(let i=0;i<38;i++){
    const ripple=box(scene,1.2+i%4,.012,.1,0xb5e6db,LAKE.minX+3+(i*7.37)%(LAKE.maxX-LAKE.minX-6),LAKE.surface+.025,LAKE.minZ+2+(i*11.13)%(LAKE.maxZ-LAKE.minZ-4));
    ripple.castShadow=false;ripples.push(ripple);
  }
  for(const x of [LAKE.minX,LAKE.maxX])box(scene,1,.15,LAKE.maxZ-LAKE.minZ+1,0xd8c998,x,-.1,(LAKE.minZ+LAKE.maxZ)/2);
  for(const z of [LAKE.minZ,LAKE.maxZ])box(scene,LAKE.maxX-LAKE.minX,.15,1,0xd8c998,(LAKE.minX+LAKE.maxX)/2,-.1,z);

  // Painted asphalt and road markings are generated locally, without image assets.
  const surface = document.createElement('canvas'); surface.width = surface.height = 2048;
  const ctx = surface.getContext('2d'), scale = 2048 / 150;
  ctx.fillStyle = '#b6c79a'; ctx.fillRect(0, 0, 2048, 2048);
  ctx.save(); ctx.translate(1024, 1024); ctx.scale(scale, scale);
  // Spawn apron, parking bays, and the braking box.
  ctx.fillStyle = '#7d8a7e'; ctx.fillRect(-17, 27, 30, 18);
  ctx.strokeStyle = '#d8d9bd'; ctx.lineWidth = .15;
  for (let x = -15; x < -2; x += 4) { ctx.beginPath(); ctx.moveTo(x, 29); ctx.lineTo(x, 37); ctx.lineTo(x + 3.5, 37); ctx.stroke(); }
  ctx.fillStyle = '#eee7c9'; ctx.font = 'bold 1.4px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('S T A R T', 0, 42);
  ctx.restore();
  const texture = new THREE.CanvasTexture(surface); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), new THREE.MeshStandardMaterial({ map: texture, roughness: 1 })); yard.rotation.x = -Math.PI / 2; yard.position.y = -.035; yard.receiveShadow = true; scene.add(yard);

  const cameraObstacles=[];
  const obstacles = [], cones = [], gates = [];
  // A continuous ribbon avoids coplanar overlap seams on the curved deck.
  function roadRibbon(offset,width,color,lift,route=ROAD_POINTS){
    const vertices=[],indices=[];
    route.forEach((point,i)=>{
      const before=route[Math.max(0,i-1)],after=route[Math.min(route.length-1,i+1)];
      const dx=after.x-before.x,dz=after.z-before.z,length=Math.hypot(dx,dz);
      const rx=-dz/length,rz=dx/length;
      for(const side of [1,-1]){
        const distance=(typeof offset==='function'?offset(point):offset)+side*(typeof width==='function'?width(point):width)/2;
        vertices.push(point.x+rx*distance,point.y+.015+lift,point.z+rz*distance);
      }
      if(i<route.length-1){const a=i*2;indices.push(a,a+2,a+1,a+2,a+3,a+1);}
    });
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
    route.slice(0,-1).forEach((p,i)=>geometry.addGroup(i*6,6,p.section==='bridge'&&typeof width==='function'?1:0));
    const mesh=new THREE.Mesh(geometry,[material(color),material(0xb49a72)]);mesh.receiveShadow=true;mesh.castShadow=true;scene.add(mesh);return mesh;
  }
  cameraObstacles.push(roadRibbon(0,p=>p.width,0x79867e,0));
  roadRibbon(p=>-p.width/2+.3,.35,0xe9c897,.025);roadRibbon(p=>p.width/2-.3,.35,0xe9c897,.025);
  cameraObstacles.push(roadRibbon(0,p=>p.width,0xa39474,0,BRANCH_POINTS));
  roadRibbon(-3.2,.2,0xf2d49a,.025,BRANCH_POINTS);roadRibbon(3.2,.2,0xf2d49a,.025,BRANCH_POINTS);
  const hiddenTop=new THREE.MeshStandardMaterial({visible:false});
  for(const segment of [...ROAD_SEGMENTS,...BRANCH_SEGMENTS]){
    const roadGroup=new THREE.Group();scene.add(roadGroup);
    roadGroup.position.set(segment.x,segment.y,segment.z);
    roadGroup.rotation.set(segment.pitch,segment.yaw,0,'YXZ');
    const slab=box(roadGroup,segment.width,ROAD_THICKNESS,segment.length+.24,0x79867e,0,-ROAD_THICKNESS/2);
    const sideMaterial=material(0x929d8b);
    slab.material=[sideMaterial,sideMaterial,hiddenTop,sideMaterial,sideMaterial,sideMaterial];
    cameraObstacles.push(slab);
    if(segment.y>2&&segment.index%2===0)for(const x of [-segment.width/2+.3,segment.width/2-.3])box(roadGroup,.35,.02,segment.length*.75,0xe88d65,x,.05);
    if(segment.section==='bridge'){
      for(let z=-segment.length/2;z<segment.length/2;z+=.6)box(roadGroup,segment.width-.2,.015,.035,0x807558,0,.025,z);
    }else if(segment.index%2===0)box(roadGroup,.16,.025,1.25,0xe8e3c9,0,.02);
    if(segment.y>2&&segment.index%5===0){
      for(const x of [-segment.width/2+1.2,segment.width/2-1.2]){
        const support=new THREE.Vector3(x,-ROAD_THICKNESS,0).applyEuler(roadGroup.rotation).add(roadGroup.position);
        box(scene,1.1,support.y,1.1,0xb0af97,support.x,support.y/2,support.z);
      }
    }
  }
  // Raised paint sits above the road deck rather than underneath it.
  for(let x=FINISH.minX;x<FINISH.maxX;x+=1.2){
    for(const z of [FINISH.minZ,FINISH.maxZ]){const stripe=box(scene,.18,.025,1.1,0xf1deb2,x,.045,z);stripe.rotation.y=-.6;}
  }
  for(const x of [FINISH.minX,FINISH.maxX])box(scene,.18,.025,10,0xf1deb2,x,.045,(FINISH.minZ+FINISH.maxZ)/2);
  for(const rail of BRIDGE_RAILS){
    const beam=box(scene,rail.width,rail.height,rail.depth,0x917b59,rail.x,rail.y,rail.z);cameraObstacles.push(beam);
    box(scene,.3,1.6,.3,0xd3b484,rail.x-1.4,3.75,rail.z);
    box(scene,rail.width,.13,.3,0xe8c797,rail.x,rail.y+.48,rail.z);
  }
  function sign(x,y,z,yaw,text){
    const group=new THREE.Group();group.position.set(x,y,z);group.rotation.y=-yaw;scene.add(group);
    cylinder(group,.1,.1,3,0x7b8268,0,1.5,0,6);const board=label(group,text,5.5,'#fff5d9','#447e78');board.position.y=3.2;
  }
  sign(51,0,13,Math.PI,'←  LAKE CROSSING');
  sign(75,1,23,Math.PI/2,'NARROW BRIDGE');
  sign(145,2,23,Math.PI/2,'KEEP IT STEADY');
  sign(180,0,67,Math.PI,'WOODLAND LOOP  →');
  sign(82,0,112,-Math.PI/2,'VILLAGE LOOP');
  sign(64,0,95,-Math.PI/2,'STRAIGHT: WIDE LOOP');
  sign(48,0,115,-Math.PI/2,'← SHORT / NARROW');
  sign(28,0,133,Math.PI,'BOTH WAYS REJOIN');
  for(const p of SHORTCUT_POSTS){box(scene,.8,1.2,.8,0x9d805b,p.x,.6,p.z);box(scene,.83,.15,.83,0xf1d49c,p.x,1.05,p.z);}
  sign(20,0,166,Math.PI/2,'KEEP RIGHT');
  sign(50,0,188,Math.PI/2,'TRAFFIC MERGING');
  sign(210,0,211,Math.PI,'ORCHARD HILL');
  sign(100,0,290,-Math.PI/2,'FINISH AHEAD');
  for(const route of TRAFFIC_ROUTES){
    const vertices=[],indices=[];
    route.points.forEach((p,i)=>{
      const pose=sampleRoute(route,p.s);
      for(const side of [-1,1])vertices.push(p.x-pose.fz*side*2.8,.028,p.z+pose.fx*side*2.8);
      if(i<route.points.length-1){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
    });
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
    const road=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0x79867e,side:THREE.DoubleSide}));road.receiveShadow=true;scene.add(road);
    for(const end of [false,true]){
      const pose=sampleRoute(route,end?route.length:0),garage=new THREE.Group();scene.add(garage);garage.position.set(pose.x,0,pose.z);garage.rotation.y=-pose.yaw+(end?Math.PI:0);
      for(const p of GARAGE_PARTS)cameraObstacles.push(box(garage,p.width,p.height,p.depth,p.color,p.x,p.y,p.z));
      obstacles.push(...garageColliders(pose.x,pose.z,garage.rotation.y));
      const board=label(garage,end?'DELIVERIES':'SUNNY TRANSIT',9);board.position.set(0,5.5,-6.1);board.rotation.y=Math.PI;
    }
  }
  const cliffSign=new THREE.Group();cliffSign.position.set(-8.5,8,-42);scene.add(cliffSign);
  cylinder(cliffSign,.1,.1,3.2,0x747f66,0,1.6,0,6);
  const caution=label(cliffSign,'RIGHT TURN  →',5.5,'#fff3d0','#c97849');caution.position.y=3.4;
  const dropSign=label(cliffSign,'NO GUARDRAILS',4,'#fff3d0','#c97849');dropSign.position.y=2.5;
  MOUNTAINS.forEach((m,i)=>cylinder(scene,0,m.radius,m.height,i%2?0x96b7a0:0xa8bfa6,m.x,m.height/2-.07,m.z,5));
  for(let i=0;i<7;i++){
    const cloud=new THREE.Group();scene.add(cloud);cloud.position.set(-100+i*34,40+i%3*7,-100-i%2*35);
    for(let j=0;j<3;j++){
      const puff=new THREE.Mesh(new THREE.IcosahedronGeometry(5-j*.7,1),material(0xf4f4df));
      puff.position.set(j*5,Math.sin(j*2)*2,0);puff.scale.set(1.5,.5,1);cloud.add(puff);
    }
  }

  function cone(x, z) {
    const group = new THREE.Group(); group.position.set(x, 0, z); scene.add(group);
    box(group, .95, .13, .95, 0x505847, 0, .065, 0);
    cylinder(group, .12, .37, 1.1, colors.orange, 0, .67, 0);
    cylinder(group, .21, .27, .26, colors.cream, 0, .65, 0);
    const collider = { x, z, radius: .42, kind: 'cone', knocked: false, mesh: group }; obstacles.push(collider); cones.push(collider);
  }
  [[-6,31],[6,31],[-6,22],[6,22],[-6,12],[6,12],[-6,2],[6,2],[50,8],[35,8],[37,20],[30,29],[21,17],[17,30]].forEach(([x,z]) => cone(x,z));
  function barrier(x, z, yaw = 0) {
    const group = new THREE.Group(); scene.add(group); group.position.set(x, 0, z); group.rotation.y = yaw;
    box(group, 5.4, .45, 1.2, 0xddd8bd, 0, .25);
    box(group, 5, 1, .7, colors.cream, 0, .9);
    for (let i = -2; i <= 2; i += 1.1) box(group, .55, .72, .72, colors.orange, i, 1);
    for (let i = -1.8; i <= 1.8; i += 1.8) obstacles.push({ x: x + i * Math.cos(yaw), z: z - i * Math.sin(yaw), radius: .9, kind: 'barrier' });
  }
  [[-12,17,0],[-12,10,0],[-12,3,0],[19,-37,0],[26,-37,0]].forEach(args => barrier(...args));
  GATES.forEach((gate, i) => {
    const group = new THREE.Group(); group.position.set(gate.x, gate.y, gate.z); group.rotation.y = -gate.yaw; scene.add(group);
    const parts = [];
    for (const x of [-6.3, 6.3]) { parts.push(box(group, .6, 5.5, .6, colors.mint, x, 2.75)); box(group, 1.4, .25, 1.4, colors.cream, x, .125); }
    parts.push(box(group, 13.2, .65, .65, colors.mint, 0, 5.35));
    const sign = label(group, `0${i + 1}  ${gate.label}`, 6.8); sign.position.set(0, 5.4, .36);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.6, .12, 6, 24), material(colors.mint)); ring.position.set(0, 3.4, 0); group.add(ring);
    gates.push({ group, parts, ring });
  });

  const random = seeded();
  function tree(x, z, size = 1) {
    const group = new THREE.Group(); scene.add(group); group.position.set(x, 0, z); group.scale.setScalar(size);
    cylinder(group, .2, .3, 2.5, 0x938566, 0, 1.25, 0, 5);
    obstacles.push(treeCollider(x,z,size));
    cylinder(group, 0, 2.2, 4.5, [0x849d68,0x6c8e64,0x93a773][Math.floor(random()*3)], 0, 4, 0, 6);
    cylinder(group, 0, 1.7, 3, 0x9ab37e, 0, 6, 0, 6);
  }
  for (let i = 0; i < 290; i++) {
    const x = random() * 330 - 70, z = random() * 410 - 85;
    if(inLake(x,z)||[...ROAD_POINTS,...BRANCH_POINTS].some(p=>Math.hypot(p.x-x,p.z-z)<p.width/2+6)||TRAFFIC_ROUTES.some(r=>r.points.some(p=>Math.hypot(p.x-x,p.z-z)<12))||(x>40&&x<130&&z>140&&z<215))continue;
    tree(x, z, .7 + random() * .7);
  }
  [[22,-3,.8],[27,0,1.1],[19,2,.65],[30,8,.8]].forEach(args => tree(...args));
  for(const [i,x,z] of [[0,56,151],[1,85,151],[2,116,151],[3,68,202],[4,105,202]]){
    const house=new THREE.Group();scene.add(house);house.position.set(x,0,z);house.rotation.y=z>176?Math.PI:0;
    box(house,13,7,10,[0xe4bd8d,0xe4d8ac,0xa6c0ad][i%3],0,3.5);
    for(const side of [-1,1]){const roof=box(house,8,.6,12,0xb77758,side*3.4,8,0);roof.rotation.z=-side*.35;}
    box(house,2.4,4,.12,0x547b70,0,2,5.1);
    for(const side of [-1,1])box(house,2.4,2,.15,0x719a99,side*4,4.1,5.12);
    const board=label(house,['GENERAL STORE','POST OFFICE','BAKERY','SUNNY CAFE','BIKE SHOP'][i],10);board.position.set(0,6,5.2);
    obstacles.push({x,z,radius:7,kind:'building'});cameraObstacles.push(...house.children.filter(c=>c.isMesh));
  }
  for(let row=0;row<3;row++)for(let col=0;col<4;col++){
    const x=150+col*12,z=239+row*10;tree(x,z,.7);
    for(let fruit=0;fruit<3;fruit++){const apple=new THREE.Mesh(new THREE.IcosahedronGeometry(.4,0),material(0xe39353));apple.position.set(x+Math.cos(fruit*2)*1.1,2.7,z+Math.sin(fruit*2)*1.1);scene.add(apple);}
  }
  const windmill=new THREE.Group();windmill.position.set(245,0,253);scene.add(windmill);
  cylinder(windmill,2,3.5,12,0xe3d3a8,0,6,0,6);cylinder(windmill,0,3,3,0xae795c,0,13,0,6);
  const sails=new THREE.Group();sails.position.set(0,10,-3);windmill.add(sails);
  box(sails,.6,14,.3,0xf5ebcf);box(sails,14,.6,.3,0xf5ebcf);
  for(const x of [133,145,157])cylinder(scene,1.4,1.4,2.5,0xd6bc72,x,1.4,306,10);
  // A small workshop and a water tower give the yard a sense of place.
  const shed = new THREE.Group(); shed.position.set(-29, 0, -17); scene.add(shed);
  box(shed, 13, 6, 10, 0xd8b078, 0, 3); box(shed, 14.5, .6, 11.5, 0x648676, 0, 6.3);
  box(shed, 5, 4.7, .15, 0x647d6a, 0, 2.35, 5.08);
  for (let i=0;i<6;i++) box(shed, 4.8,.06,.1,0x8c9d80,0,.7+i*.65,5.18);
  const shedSign = label(shed,'SUNNY SIDE',8); shedSign.position.set(0,5.6,5.42);
  obstacles.push({x:-29,z:-17,radius:8.3,kind:'building'});
  cameraObstacles.push(...shed.children.filter(child=>child.isMesh));
  const tower = new THREE.Group(); tower.position.set(61,0,-37); scene.add(tower);
  for (const x of [-2,2]) for (const z of [-2,2]) box(tower,.35,11,.35,0x929775,x,5.5,z);
  cylinder(tower,3.7,3.7,5,0xd0bf95,0,12,0,10); cylinder(tower,0,4.1,1.8,0x80987b,0,15.4,0,10);
  obstacles.push({x:61,z:-37,radius:3,kind:'building'});
  for(let x=BOUNDS.minX;x<BOUNDS.maxX;x+=10)for(const z of [BOUNDS.minZ,BOUNDS.maxZ]){box(scene,.35,1.8,.35,0xa0a985,x,.9,z);box(scene,10,.18,.18,0xb6b798,x+5,1.25,z);}
  for(let z=BOUNDS.minZ;z<BOUNDS.maxZ;z+=10)for(const x of [BOUNDS.minX,BOUNDS.maxX]){box(scene,.35,1.8,.35,0xa0a985,x,.9,z);box(scene,.18,.18,10,0xb6b798,x,1.25,z+5);}
  // Pennant string at the start.
  for (const x of [-9,9]) cylinder(scene,.08,.08,6,colors.cream,x,3,38,6);
  const string = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-9,5.9,38), new THREE.Vector3(0,5.1,38), new THREE.Vector3(9,5.9,38)]);
  scene.add(new THREE.Line(string,new THREE.LineBasicMaterial({color:0x768167})));
  for(let i=0;i<15;i++){
    const x=-8.5+i*1.2,y=5.1+Math.abs(x)/9*.8;
    const shape=new THREE.Shape();shape.moveTo(-.43,0);shape.lineTo(.43,0);shape.lineTo(0,-.85);shape.closePath();
    const flag=new THREE.Mesh(new THREE.ShapeGeometry(shape),new THREE.MeshStandardMaterial({color:[0xe99c67,0xf4e4b2,0x72a48c][i%3],side:THREE.DoubleSide}));flag.position.set(x,y,38);scene.add(flag);
  }

  // Physics orientation rotates around the chassis centre of mass, not the road.
  const car = new THREE.Group(); scene.add(car);
  const model=new THREE.Group();model.position.y=-1.35;car.add(model);
  const body = new THREE.Group(); model.add(body);
  box(body,2.85,.9,4.6,0xe87950,0,1.08,0);
  box(body,2.7,.38,4.3,0xf3a96c,0,1.62,0);
  box(body,2.38,1.22,2.3,0xf4d69c,0,2.02,.15);
  box(body,2.02,.78,.08,0x557a77,0,2.14,-1.03);
  box(body,2.02,.72,.08,0x557a77,0,2.14,1.34);
  for(const x of [-1.2,1.2]){box(body,.06,.74,1.77,0x668f86,x,2.12,.14);box(body,.08,.85,.11,0xf4d69c,x,2.12,.15);}
  box(body,2.57,.2,2.62,0xf7e0ab,0,2.69,.15);
  box(body,2.95,.24,.25,0xe6dec3,0,.84,-2.4);box(body,2.95,.24,.25,0xe6dec3,0,.84,2.4);
  box(body,1.1,.3,.08,0x4c5e50,0,1.1,-2.34);
  for(const x of [-.97,.97]){box(body,.5,.37,.1,0xffefb9,x,1.39,-2.34);box(body,.48,.28,.1,0xc7553e,x,1.39,2.34);}
  const wheels=[];
  for(const x of [-1.5,1.5])for(const z of [-1.48,1.48]){
    const wheel=new THREE.Group();wheel.position.set(x,.66,z);model.add(wheel);
    const tire=cylinder(wheel,.65,.65,.47,0x34423c,0,0,0,12);tire.rotation.z=Math.PI/2;
    const hub=cylinder(wheel,.31,.31,.49,0xeee2bf,0,0,0,8);hub.rotation.z=Math.PI/2;
    box(wheel,.51,.11,.47,0xacb49d);wheels.push(wheel);
  }
  // Color-coded side badges echo the power gauges.
  box(body,.07,.35,.65,0xefb28a,-1.44,1.3,0);box(body,.07,.35,.65,0x91baa0,1.44,1.3,0);
  const antenna = cylinder(body,.025,.025,1.1,0x4c6250,.8,3.25,.8,5);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(.15,8,6),material(0xe98451));ball.position.set(.8,3.85,.8);body.add(ball);
  const follow = new THREE.Vector3(0,0,36);
  const trafficMeshes=Array.from({length:6},(_,id)=>{
    const group=new THREE.Group();scene.add(group);group.visible=false;
    box(group,2.5,1.1,4.6,[0x7cbaa4,0xe1c776,0x7eabc1][id%3],0,.1);
    box(group,2.15,1.1,2.4,0xe5dfc3,0,1.1,.2);box(group,1.9,.7,.08,0x507779,0,1.15,-1.03);
    const lights=[];
    for(const x of [-.9,.9]){box(group,.45,.28,.1,0xffedaf,x,.2,-2.34);lights.push(box(group,.45,.28,.1,0x965744,x,.2,2.34));}
    const tires=[];
    for(const x of [-1.3,1.3])for(const z of [-1.45,1.45]){const tire=cylinder(group,.55,.55,.32,0x34423c,x,-.43,z,10);tire.rotation.z=Math.PI/2;tires.push(tire);}
    return {group,lights,tires};
  });
  const cameraTarget=new THREE.Vector3(),desiredCamera=new THREE.Vector3(),cameraDirection=new THREE.Vector3();
  const cameraRay=new THREE.Raycaster();
  let cameraYaw=0,cameraSnap=true,wheelRotation=0;
  const dust=[];
  for(let i=0;i<20;i++){const puff=new THREE.Mesh(new THREE.IcosahedronGeometry(.25,0),new THREE.MeshStandardMaterial({color:0xdedbc0,transparent:true,opacity:0,depthWrite:false}));scene.add(puff);dust.push({mesh:puff,life:0});}
  let dustIndex=0,dustTimer=0;
  function resize(){const width=canvas.parentElement.clientWidth,height=canvas.parentElement.clientHeight;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();}
  const observer=new ResizeObserver(resize);observer.observe(canvas.parentElement);resize();
  function reset(){cameraSnap=true;cones.forEach(c=>{c.knocked=false;c.kick=null;c.mesh.position.set(c.x,0,c.z);c.mesh.rotation.set(0,0,0);});dust.forEach(p=>{p.life=0;p.mesh.material.opacity=0;});}
  function snapCamera(){cameraSnap=true;}
  function render(state,dt,time,gateIndex,cameraDistance=18,traffic=[]){
    sails.rotation.z=time*.3;
    trafficMeshes.forEach((mesh,i)=>{const v=traffic[i];mesh.group.visible=!!v?.active;if(!v?.active)return;mesh.group.position.copy(v.body.position);mesh.group.quaternion.copy(v.body.quaternion);mesh.lights.forEach(l=>l.material=material(v.braking?0xff654e:0x965744));mesh.tires.forEach(t=>t.rotation.x-=v.speed*dt/.55);});
    sun.position.set(state.x-35,65,state.z+20);sun.target.position.set(state.x,0,state.z);
    ripples.forEach((r,i)=>{r.scale.x=1+Math.sin(time*.8+i)*.2;r.position.y=LAKE.surface+.025+Math.sin(time+i)*.018;});
    car.position.set(state.x,state.y+1.35,state.z);car.quaternion.copy(state.quaternion);
    antenna.rotation.z=Math.sin(time*8)*Math.min(state.speed*.01,.18);
    wheelRotation-=state.forwardSpeed*dt/.65;wheels.forEach((w,i)=>{w.rotation.x=wheelRotation;w.position.y=THREE.MathUtils.damp(w.position.y,state.wheelHeights[i],16,dt);});
    if(cameraSnap){cameraYaw=state.yaw;follow.set(state.x,state.y,state.z);}
    else{
      // Keep a level horizon during tumbles; follow yaw only while upright.
      const delta=Math.atan2(Math.sin(state.yaw-cameraYaw),Math.cos(state.yaw-cameraYaw));
      if(state.upY>.4&&state.grounded>0)cameraYaw+=delta*(1-Math.exp(-dt*5));
      follow.lerp(new THREE.Vector3(state.x,state.y,state.z),1-Math.exp(-dt*9));
    }
    const fx=Math.sin(cameraYaw),fz=-Math.cos(cameraYaw);
    cameraTarget.set(follow.x+fx*6,Math.max(1.2,follow.y+2.1),follow.z+fz*6);
    desiredCamera.set(follow.x-fx*cameraDistance,Math.max(2,follow.y+6.8),follow.z-fz*cameraDistance);
    cameraDirection.subVectors(desiredCamera,cameraTarget);const cameraLength=cameraDirection.length();cameraDirection.normalize();
    cameraRay.set(cameraTarget,cameraDirection);cameraRay.far=cameraLength;
    scene.updateMatrixWorld();
    const cameraHits=cameraRay.intersectObjects(cameraObstacles,false);
    if(cameraHits.length)desiredCamera.copy(cameraTarget).addScaledVector(cameraDirection,Math.max(2,cameraHits[0].distance-.6));
    camera.position.copy(desiredCamera);camera.lookAt(cameraTarget);cameraSnap=false;
    gates.forEach((g,i)=>{g.ring.visible=i===gateIndex;g.ring.position.y=3.3+Math.sin(time*2)*.25;g.ring.rotation.y=time*.7;g.parts.forEach(p=>{p.material=material(i<gateIndex?0xe7d69b:i===gateIndex?colors.mint:0x8ba995);});});
    cones.forEach(c=>{if(!c.knocked)return;c.mesh.rotation.x=THREE.MathUtils.damp(c.mesh.rotation.x,c.kick.z*1.45,7,dt);c.mesh.rotation.z=THREE.MathUtils.damp(c.mesh.rotation.z,-c.kick.x*1.45,7,dt);c.mesh.position.x=THREE.MathUtils.damp(c.mesh.position.x,c.x+c.kick.x*1.8,6,dt);c.mesh.position.z=THREE.MathUtils.damp(c.mesh.position.z,c.z+c.kick.z*1.8,6,dt);});
    dustTimer+=dt;
    if(state.grounded>0&&state.speed>4&&dustTimer>.06){dustTimer=0;const p=dust[dustIndex++%dust.length];p.life=1;p.mesh.position.set(state.x-Math.sin(state.yaw)*2,state.y+.3,state.z+Math.cos(state.yaw)*2);}
    dust.forEach(p=>{if(p.life<=0)return;p.life-=dt*1.5;p.mesh.position.y+=dt*.7;p.mesh.scale.setScalar(1+(1-p.life)*2);p.mesh.material.opacity=Math.max(0,p.life*.22);});
    renderer.render(scene,camera);
  }
  return { render, reset, snapCamera, obstacles, renderer, scene, camera };
}
