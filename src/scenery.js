import { BOUNDS } from './course.js';

// Keep the full mountain footprint beyond the fenced play area, including
// future road extensions within it. These are backdrop meshes, not terrain.
export const MOUNTAINS=Array.from({length:16},(_,i)=>{
  const angle=i*Math.PI/8,c=Math.cos(angle),s=Math.sin(angle),edge=Math.max(Math.abs(c),Math.abs(s));
  const radius=24+i%3*8,height=25+i%4*12;
  return {x:(BOUNDS.minX+BOUNDS.maxX)/2+c/edge*((BOUNDS.maxX-BOUNDS.minX)/2+radius+40),
    z:(BOUNDS.minZ+BOUNDS.maxZ)/2+s/edge*((BOUNDS.maxZ-BOUNDS.minZ)/2+radius+40),radius,height};
});

// Side walls end at the inner face of the back wall. Previously they extended
// through it, leaving coincident exterior faces that flickered as the camera moved.
export const GARAGE_PARTS=[
  {width:1,height:6,depth:11,x:-5,y:3,z:-.5,color:0xd5bd91},
  {width:1,height:6,depth:11,x:5,y:3,z:-.5,color:0xd5bd91},
  {width:11,height:6,depth:1,x:0,y:3,z:5.5,color:0x536e62},
  {width:12,height:.7,depth:13,x:0,y:6.35,z:0,color:0x668b7a},
];
export function garageColliders(x,z,yaw){
  return GARAGE_PARTS.map(p=>({kind:'building',width:p.width,height:p.height,depth:p.depth,
    x:x+Math.cos(yaw)*p.x+Math.sin(yaw)*p.z,z:z-Math.sin(yaw)*p.x+Math.cos(yaw)*p.z,
    y:p.y-p.height/2,yaw}));
}
export function treeCollider(x,z,size){return {x,z,y:0,radius:.3*size,height:2.5*size,kind:'tree'};}
