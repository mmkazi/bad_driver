// Distances are metres. North is negative Z; heights are above the lake.
// Keep detours separate so we never draw a road between unrelated ends.
export const ROAD_WIDTH=12, ROAD_THICKNESS=.6;
export const LAKE={minX:80,maxX:680,minZ:-460,maxZ:0,surface:-.35,bottom:-10};
export const BOUNDS={minX:-470,maxX:810,minZ:-620,maxZ:440};
export const ISLAND={x:310,z:-270,radius:28,y:3};
export const SPAWN={x:-180,y:64,z:320,yaw:0};
export const FINISH={minX:302,maxX:318,minZ:-279,maxZ:-261,y:3};
// All three arms meet at one level patch. The wider blending ring eases the
// downhill approaches into it, instead of letting one road sit over another.
export const JUNCTIONS=[{x:-180,y:64,z:0,radius:22},{x:540,y:32,z:-100,radius:22},{x:310,y:5,z:-505,radius:22}];
export function junctionAt(p){return JUNCTIONS.find(j=>Math.abs(p.y-j.y)<5&&Math.hypot(p.x-j.x,p.z-j.z)<j.radius);}
export function inLake(x,z){return x>LAKE.minX&&x<LAKE.maxX&&z>LAKE.minZ&&z<LAKE.maxZ&&Math.hypot(x-ISLAND.x,z-ISLAND.z)>ISLAND.radius;}

// Smoothly connect hand-placed landmarks. Short pieces are used by both the
// paint and solid road. Blend height too, so descents don't have sharp steps.
export function path(knots,width=12){
  const result=[];
  for(let k=0;k<knots.length-1;k++){
    const a=knots[Math.max(0,k-1)],b=knots[k],c=knots[k+1],d=knots[Math.min(knots.length-1,k+2)];
    const count=Math.ceil(Math.hypot(c[0]-b[0],c[1]-b[1],c[2]-b[2])/2);
    for(let i=0;i<count;i++){
      const t=i/count,t2=t*t,t3=t2*t;
      const p=b.slice(0,3).map((v,j)=>.5*((2*v)+(-a[j]+c[j])*t+(2*a[j]-5*v+4*c[j]-d[j])*t2+(-a[j]+3*v-3*c[j]+d[j])*t3));
      result.push({x:p[0],y:p[1],z:p[2],width:b[3]==='bridge'?8:width,section:b[3]||'shore'});
    }
  }
  const end=knots.at(-1);result.push({x:end[0],y:end[1],z:end[2],width,section:end[3]||'shore'});
  for(const p of result)for(const j of JUNCTIONS){
    const distance=Math.hypot(p.x-j.x,p.z-j.z);
    if(distance>48||Math.abs(p.y-j.y)>8)continue;
    const t=Math.max(0,Math.min(1,(distance-26)/22)),blend=t*t*(3-2*t);
    p.y=j.y+(p.y-j.y)*blend;
  }
  return result;
}
export function segments(points){return points.slice(0,-1).map((a,index)=>{
  const b=points[index+1],dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;
  return {x:(a.x+b.x)/2,y:(a.y+b.y)/2+.015,z:(a.z+b.z)/2,width:(a.width+b.width)/2,section:a.section,
    length:Math.hypot(dx,dy,dz),yaw:Math.atan2(dx,dz),pitch:-Math.atan2(dy,Math.hypot(dx,dz)),index};
});}
export const ROAD_POINTS=path([
  [-180,64,350,'forest'],[-180,64,290,'forest'],[-210,65,225,'forest'],[-155,64,150,'forest'],[-190,64,75,'forest'],
  [-180,64,0,'forest'],[-135,64,-28,'tunnel'],[-80,64,-35,'tunnel'],[-25,64,-35,'tunnel'],[30,64,-30,'cliff'],
  [95,61,25,'cliff'],[210,55,38,'cliff'],[330,47,25,'cliff'],[455,38,-15,'cliff'],[540,32,-100,'cliff'],
  [605,29,-95,'cliff'],[660,26,-40,'cliff'],[650,23,45,'cliff'],[590,21,80,'tunnel'],
  [460,17,92,'tunnel'],[300,13,85,'tunnel'],[140,9,65,'tunnel'],[55,6,15,'shore'],
  [42,6,-80,'shore'],[40,5,-245,'shore'],[65,5,-410,'shore'],[120,5,-490,'shore'],
  [220,5,-505,'shore'],[310,5,-505,'shore'],[310,5,-465,'bridge'],[310,4,-395,'bridge'],
  [310,3,-305,'shore'],[310,3,-270,'shore'],[310,3,-255,'shore'],
]);
// The first wrong turn returns behind spawn. The second ends at a turning
// circle. The final alternative follows the far shore and rejoins the low road.
export const FOREST_LOOP=path([
  [-180,64,0,'forest'],[-195,64,-25,'forest'],[-245,62,-40,'forest'],[-315,57,-5,'forest'],[-370,55,75,'forest'],
  [-330,57,180,'forest'],[-380,59,270,'forest'],[-320,63,355,'forest'],[-230,64,370,'forest'],[-180,64,340,'forest'],
]);
export const DEAD_END=path([[540,32,-100,'cliff'],[542,32,-145,'cliff'],[500,30,-178,'cliff'],[448,29,-190,'cliff'],[425,28,-195,'cliff']],12);
export const SHORE_LOOP=path([
  [310,5,-505,'shore'],[420,5,-505,'shore'],[605,5,-490,'shore'],[720,5,-400,'shore'],
  [735,5,-210,'shore'],[730,5,-20,'shore'],[650,5,140,'shore'],[440,5,175,'shore'],[230,5,180,'shore'],
  [65,5,115,'shore'],[42,6,-80,'shore'],
]);
export const SIDE_ROUTES=[FOREST_LOOP,DEAD_END,SHORE_LOOP];
export const BRANCH_POINTS=FOREST_LOOP;
export const ROAD_SEGMENTS=segments(ROAD_POINTS);
export const BRANCH_SEGMENTS=SIDE_ROUTES.flatMap(segments);
// Physics does not need every two-metre drawing point. Use six-metre pieces,
// but always retain section boundaries and endpoints. This keeps the larger
// course responsive without changing its visible bends or tunnel entrances.
export const COLLISION_SEGMENTS=[ROAD_POINTS,...SIDE_ROUTES].flatMap(route=>segments(route.filter((p,i)=>i%3===0||i===route.length-1||p.section!==route[i-1]?.section||p.section!==route[i+1]?.section)));
export const SHORTCUT_POSTS=[];
export const COURSE_LENGTH=ROAD_SEGMENTS.reduce((sum,s)=>sum+s.length,0);
export const TURNABOUT={x:425,y:28,z:-195,radius:18};
export const TURNABOUT_GROVE={x:425,y:27.8,z:-195,radius:38,depth:37.8};

// Read each gate's direction from the road. A recovery starts a little past
// the crossed gate, facing along the bend rather than toward its edge.
function gate(x,z,label,title,text){
  let i=0;ROAD_POINTS.forEach((p,j)=>{if(Math.hypot(p.x-x,p.z-z)<Math.hypot(ROAD_POINTS[i].x-x,ROAD_POINTS[i].z-z))i=j;});
  const p=ROAD_POINTS[i],next=ROAD_POINTS[Math.min(i+2,ROAD_POINTS.length-1)],yaw=Math.atan2(next.x-p.x,-(next.z-p.z));
  return {...p,yaw,label,title,text,spawn:{...next,yaw}};
}
export const GATES=[
  gate(-180,295,'INTO THE PINES','Into the pines','Follow the forest road. Agree on your turns.'),
  gate(-184,35,'CHOOSE YOUR WAY','A fork in the forest','Pick a road. Not every road takes you forward.'),
  gate(95,25,'LAKE REVEAL','A lake below','Follow the mountainside. Watch your speed on the descent.'),
  gate(480,-35,'ANOTHER CHOICE','Around the bend','The trees hide what comes next.'),
  gate(42,-80,'WATERLINE','Down by the water','You have reached the lower shore. Look for the island.'),
  gate(245,-505,'THE FAR SHORE','The far shore','The finish flag is out on the lake.'),
  gate(310,-310,'ISLAND ARRIVAL','One last crossing','Cross to the island and stop by the flag.'),
];
export const CLIFF_START=GATES[2].spawn, BRIDGE_START={x:310,y:5,z:-470,yaw:Math.PI};
export const TRAFFIC_START=GATES[4].spawn, FORK_START=GATES[1].spawn;
export const FORKS=[{x:-180,y:64,z:0,route:FOREST_LOOP},{x:540,y:32,z:-100,route:DEAD_END},{x:310,y:5,z:-505,route:SHORE_LOOP}];

// Solid walls and roofs use these same sizes in the renderer. The opening
// leaves room above the car for its chase camera, even on the descending tunnel.
export const SOLIDS=[];
// Build the hillside down to the ground, not as a floating ribbon. Only leave
// an overhang where another, lower road needs room to pass underneath.
for(const s of COLLISION_SEGMENTS){
  if(s.section==='bridge')continue;
  const below=[ROAD_POINTS,...SIDE_ROUTES].some(route=>route.some(p=>p.y<s.y-15&&Math.hypot(p.x-s.x,p.z-s.z)<29));
  const height=below?16:Math.max(.5,s.y+10);
  SOLIDS.push({x:s.x,z:s.z,y:s.y-height-.2,width:s.section==='forest'?64:32,height,depth:s.length+.8,yaw:s.yaw,kind:'bank'});
}
for(const s of COLLISION_SEGMENTS.filter(s=>s.section==='tunnel')){
  const right={x:Math.cos(s.yaw),z:-Math.sin(s.yaw)};
  const center=s.y<25?9.5:9,width=s.y<25?4:3;
  for(const side of [-1,1])SOLIDS.push({x:s.x+right.x*side*center,z:s.z+right.z*side*center,y:s.y-.5,width,height:13,depth:s.length+.8,yaw:s.yaw,kind:'rock'});
  SOLIDS.push({x:s.x,z:s.z,y:s.y+11.5,width:21,height:7,depth:s.length+.8,yaw:s.yaw,kind:'roof'});
}
// The uphill side of the high road has a rocky ridge; the lake side stays
// open. Skip rocks near any other road so a lower lane stays unobstructed.
for(const s of COLLISION_SEGMENTS.filter(s=>s.section==='cliff'&&s.index%2===0)){
  const x=s.x-Math.cos(s.yaw)*29,z=s.z+Math.sin(s.yaw)*29;
  if([ROAD_POINTS,...SIDE_ROUTES].some(route=>route.some(p=>Math.hypot(p.x-x,p.z-z)<24)))continue;
  SOLIDS.push({x,z,y:s.y-5,width:22,height:25+Math.sin(s.index)*4,depth:s.length*2+3,yaw:s.yaw,kind:'ridge'});
}
export const TREES=[];
const routes=[ROAD_POINTS,...SIDE_ROUTES];
// Join the downhill tunnel's outer wall to the high road's mountainside.
// Stop inside each existing rock wall, not at the lane edge. These pieces run
// down to the lake bed so the connection doesn't leave a floating underside.
export const TUNNEL_INFILL=[];
const upper=[...ROAD_POINTS.filter(p=>p.section==='cliff'),...SOLIDS.filter(p=>p.kind==='ridge').map(p=>({x:p.x,z:p.z,y:p.y+p.height-4,kind:'ridge'}))];
for(const s of COLLISION_SEGMENTS.filter(s=>s.section==='tunnel'&&s.y<25&&s.x>90)){
  const candidates=upper.filter(p=>p.y>s.y+8);
  if(!candidates.length)continue;
  const high=candidates.reduce((best,p)=>Math.hypot(p.x-s.x,p.z-s.z)<Math.hypot(best.x-s.x,best.z-s.z)?p:best);
  const dx=high.x-s.x,dz=high.z-s.z,distance=Math.hypot(dx,dz);
  if(distance<20||distance>100)continue;
  const start=11,end=distance-(high.kind==='ridge'?0:12),width=end-start;
  if(width<1)continue;
  const piece={x:s.x+dx/distance*(start+end)/2,z:s.z+dz/distance*(start+end)/2,y:-10,
    width,height:Math.max(high.y+12,s.y+20)+10,depth:s.length+3,yaw:Math.atan2(-dz,dx),kind:'infill'};
  const c=Math.cos(piece.yaw),n=Math.sin(piece.yaw);
  // Protect every road, including the lane returning underneath the first exit.
  const blocked=routes.some(route=>route.some(p=>{
    const x=p.x-piece.x,z=p.z-piece.z;
    return p.y<piece.y+piece.height+3&&Math.abs(x*c-z*n)<width/2+p.width/2+1.25&&Math.abs(x*n+z*c)<piece.depth/2+p.width/2+1.25;
  }));
  if(!blocked){TUNNEL_INFILL.push(piece);SOLIDS.push(piece);}
}
let seed=913;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
for(const route of routes)for(let i=0;i<route.length-1;i+=5){
  const p=route[i],q=route[i+1],length=Math.hypot(q.x-p.x,q.z-p.z);
  if(p.section==='tunnel'||p.section==='bridge')continue;
  // Tall, dense forest; a lighter row on the shore. At the blind dead end,
  // crowns on both sides deliberately hide the turning circle until close up.
  const dense=p.section==='forest'||route===DEAD_END;
  if(!dense&&i%15)continue;
  for(const side of [-1,1])for(let row=0;row<(dense?2:1);row++){
    const offset=(dense?12:12)+row*9+random()*3;
    const x=p.x-(q.z-p.z)/length*offset*side,z=p.z+(q.x-p.x)/length*offset*side;
    if(JUNCTIONS.some(j=>Math.hypot(x-j.x,z-j.z)<27))continue;
    if(routes.some(points=>points.some(t=>Math.abs(t.y-p.y)<16&&Math.hypot(t.x-x,t.z-z)<t.width/2+3)))continue;
    if(Math.hypot(x-ISLAND.x,z-ISLAND.z)<ISLAND.radius+12)continue;
    TREES.push({x,z,y:p.y-.12,size:dense?1.9+random()*.7:1.3+random()*.5});
  }
}
// Screen the clearing itself, not just its approach. Stagger two rings and
// lower growth to close sightlines between trunks. Leave the access road open.
export const TURNABOUT_SCREEN=[];
for(const [radius,count] of [[24,30],[31,35]])for(let i=0;i<count;i++){
  const angle=i/count*Math.PI*2+(radius===31?.09:0);
  const x=TURNABOUT.x+Math.cos(angle)*radius,z=TURNABOUT.z+Math.sin(angle)*radius;
  if(routes.some(route=>route.some(p=>Math.abs(p.y-TURNABOUT.y)<20&&Math.hypot(p.x-x,p.z-z)<p.width/2+4)))continue;
  TURNABOUT_SCREEN.push({x,z,y:TURNABOUT.y-.1,size:2.4+random()*.5});
  if(i%2===0)TURNABOUT_SCREEN.push({x:x+Math.cos(angle)*2,z:z+Math.sin(angle)*2,y:TURNABOUT.y-.1,size:1+random()*.3});
}
TREES.push(...TURNABOUT_SCREEN);
