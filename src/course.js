// Shared by the drawn road and the invisible solid road beneath it. Keeping
// both shapes from these same points helps them stay lined up.
export const ROAD_WIDTH = 14;
export const ROAD_THICKNESS = 0.6;
export const CLIFF_START = Object.freeze({ x: 0, y: 8, z: -39, yaw: 0 });
export const BRIDGE_START = Object.freeze({ x: 88, y: 3, z: 32, yaw: Math.PI/2 });
export const LAKE = Object.freeze({ minX:92, maxX:134, minZ:-3, maxZ:68, surface:-.35, bottom:-5 });
export const BOUNDS = Object.freeze({ minX:-85, maxX:265, minZ:-90, maxZ:330 });
export const FINISH = Object.freeze({ minX:56, maxX:68, minZ:275, maxZ:285 });
export const TRAFFIC_START = Object.freeze({x:16,y:0,z:176,yaw:Math.PI/2});
export function inLake(x,z){return x>LAKE.minX&&x<LAKE.maxX&&z>LAKE.minZ&&z<LAKE.maxZ;}
const points = [];
function line(a, b, width=14, endWidth=width, section='road') {
  // Break long straight or sloping pieces into short even sections. The physics
  // and 3D renderer use those sections to build smooth-looking road surfaces.
  const count = Math.ceil(Math.hypot(b.x-a.x, b.y-a.y, b.z-a.z) / 2.5);
  for (let i=0; i<count; i++) {
    const t=i/count;
    points.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t,width:width+(endWidth-width)*t,section});
  }
}
function arc(cx, cz, radius, from, to, y, width=14) {
  // Lay points along a circular bend. Smaller spacing makes tighter bends smooth.
  const count=Math.ceil(Math.abs(to-from)*radius/2);
  for(let i=0;i<count;i++){
    const angle=from+(to-from)*i/count;
    points.push({x:cx+Math.cos(angle)*radius,y,z:cz+Math.sin(angle)*radius,width,section:'road'});
  }
}
line({x:0,y:0,z:44},{x:0,y:0,z:0});
line({x:0,y:0,z:0},{x:0,y:8,z:-32});
line({x:0,y:8,z:-32},{x:0,y:8,z:-46});
arc(14,-46,14,Math.PI,Math.PI*1.5,8);
line({x:14,y:8,z:-60},{x:28,y:8,z:-60});
arc(28,-46,14,-Math.PI/2,0,8);
line({x:42,y:8,z:-46},{x:42,y:8,z:-40});
line({x:42,y:8,z:-40},{x:42,y:0,z:0});
line({x:42,y:0,z:0},{x:42,y:0,z:12});
arc(62,12,20,Math.PI,Math.PI/2,0);
line({x:62,y:0,z:32},{x:70,y:0,z:32});
line({x:70,y:0,z:32},{x:86,y:3,z:32},14,7,'approach');
line({x:86,y:3,z:32},{x:140,y:3,z:32},7,7,'bridge');
line({x:140,y:3,z:32},{x:158,y:0,z:32},7,12,'approach');
line({x:158,y:0,z:32},{x:170,y:0,z:32},12);
arc(170,52,20,-Math.PI/2,0,0,12);
line({x:190,y:0,z:52},{x:190,y:0,z:80},12);
arc(166,80,24,0,Math.PI/2,0,12);
// Two gentle Bezier bends and one low rise on the woodland return. The curve
// points let the road change direction without an abrupt corner.
function bend(a,b,c,d){
  for(let i=0;i<26;i++){
    const t=i/26,u=1-t,x=u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0];
    points.push({x,y:2*Math.sin(Math.PI*(166-x)/82)**2,z:u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1],width:12,section:'woodland'});
  }
}
bend([166,104],[147,104],[144,88],[124,88]);
bend([124,88],[106,88],[102,104],[84,104]);
line({x:84,y:0,z:104},{x:0,y:0,z:104},12);
arc(0,130,26,-Math.PI/2,-Math.PI,0,12);
line({x:-26,y:0,z:130},{x:-26,y:0,z:150},12);
arc(0,150,26,Math.PI,Math.PI/2,0,12);
line({x:0,y:0,z:176},{x:18,y:0,z:176},12,16);
line({x:18,y:0,z:176},{x:160,y:0,z:176},16,16,'village');
line({x:160,y:0,z:176},{x:190,y:0,z:176},16,14);
arc(190,206,30,-Math.PI/2,0,0,14);
line({x:220,y:0,z:206},{x:220,y:5,z:250},14);
arc(190,250,30,0,Math.PI/2,5,14);
line({x:190,y:5,z:280},{x:150,y:5,z:280},14);
line({x:150,y:5,z:280},{x:110,y:0,z:280},14);
line({x:110,y:0,z:280},{x:48,y:0,z:280},14);
points.push({x:48,y:0,z:280,width:14,section:'road'});
export const ROAD_POINTS=points;
export const ROAD_SEGMENTS=points.slice(0,-1).map((a,index)=>{
  const b=points[index+1],dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;
  return {x:(a.x+b.x)/2,y:(a.y+b.y)/2+.015,z:(a.z+b.z)/2,
    width:(a.width+b.width)/2,section:a.section,
    length:Math.hypot(dx,dy,dz),yaw:Math.atan2(dx,dz),pitch:-Math.atan2(dy,Math.hypot(dx,dz)),index};
});
export const COURSE_LENGTH=ROAD_SEGMENTS.reduce((sum,s)=>sum+s.length,0);
export const FORK_START={x:78,y:0,z:104,yaw:-Math.PI/2};
// A second, narrower road branches left through the forest. The main road still
// makes the wide loop. Both paths meet again before SHARE THE ROAD, so the same
// checkpoints count on either route.
export const BRANCH_POINTS=[];
for(const [a,b,c,d] of [
  [[48,104],[20,104],[20,126],[20,140]],
  [[20,140],[20,158],[-8,176],[16,176]],
])for(let i=0;i<40;i++){
  const t=i/40,u=1-t;BRANCH_POINTS.push({x:u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0],z:u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1],y:.045,width:7,section:'shortcut'});
}
BRANCH_POINTS.push({x:16,y:.045,z:176,width:7,section:'shortcut'});
export const SHORTCUT_POSTS=BRANCH_POINTS.flatMap((p,i)=>{
  // Add solid posts along the sides of the narrow part to make the shortcut risky.
  if(i<16||i>62||i%4)return [];
  const next=BRANCH_POINTS[i+1],dx=next.x-p.x,dz=next.z-p.z,length=Math.hypot(dx,dz);
  return [-1,1].map(side=>({x:p.x-dz/length*side*4,z:p.z+dx/length*side*4,radius:.4,height:1.2,kind:'post'}));
});
export const BRANCH_SEGMENTS=BRANCH_POINTS.slice(0,-1).map((a,index)=>{
  const b=BRANCH_POINTS[index+1],dx=b.x-a.x,dz=b.z-a.z;
  return {x:(a.x+b.x)/2,y:.06,z:(a.z+b.z)/2,width:7,section:'shortcut',length:Math.hypot(dx,dz),yaw:Math.atan2(dx,dz),pitch:0,index};
});
export const GATES=Object.freeze([
  {x:0,y:0,z:8,yaw:0,label:'TEAMWORK',title:'Find your rhythm',text:'Match your power, then head for the hill.',spawn:{x:0,y:0,z:5,yaw:0}},
  {x:0,y:8,z:-36,yaw:0,label:'THE HIGH ROAD',title:'The high road',text:'Climb the ramp. Ease off as you reach the crest.',spawn:CLIFF_START},
  {x:42,y:0,z:3,yaw:Math.PI,label:'LAKESIDE',title:'Down to the lake',text:'Follow the ridge, descend, then bend left toward the water.',spawn:{x:42,y:0,z:7,yaw:Math.PI}},
  {x:90,y:3,z:32,yaw:Math.PI/2,halfWidth:3,label:'EASY DOES IT',title:'One car wide',text:'The road narrows to 7 metres. Match power across the bridge.',spawn:{x:91,y:3,z:32,yaw:Math.PI/2}},
  {x:151,y:7/6,z:32,yaw:Math.PI/2,label:'WOODLAND RUN',title:'Back on dry land',text:'Follow the broad right bend into the rolling woodland road.',spawn:{x:156,y:1/3,z:32,yaw:Math.PI/2}},
  {x:64,y:0,z:104,yaw:-Math.PI/2,label:'CHOOSE YOUR WAY',title:'Agree on a direction',text:'Straight: wide forest loop. Left: short, narrow cut-through. Both rejoin.',spawn:{x:61,y:0,z:104,yaw:-Math.PI/2}},
  {x:24,y:0,z:176,yaw:Math.PI/2,label:'SHARE THE ROAD',title:'A little company',text:'Traffic joins here. Keep right and leave room at the merges.',spawn:{x:30,y:0,z:176,yaw:Math.PI/2}},
  {x:220,y:20/11,z:222,yaw:Math.PI,label:'ORCHARD HILL',title:'One more hill',text:'Leave the village, climb the hill, then follow the right bend.',spawn:{x:220,y:25/11,z:226,yaw:Math.PI}},
  {x:72,y:0,z:280,yaw:-Math.PI/2,label:'HOME AT LAST',title:'Bring it home',text:'Roll downhill and stop inside the finish box.',spawn:{x:70,y:0,z:280,yaw:-Math.PI/2}},
]);
