import * as sunny from './sunnyside.js';
import * as pinewater from './pinewater.js';

// Reloading on a map change gives physics, bots and scenery the same fresh
// course, with no old bodies left behind. The URL can also be shared.
export const MAP_ID = new URLSearchParams(globalThis.location?.search || '').get('map') === 'pinewater' ? 'pinewater' : 'sunny';
export const IS_PINEWATER = MAP_ID === 'pinewater';
const selected = IS_PINEWATER ? pinewater : sunny;
export const {ROAD_WIDTH,ROAD_THICKNESS,CLIFF_START,BRIDGE_START,TRAFFIC_START,FORK_START,
  LAKE,BOUNDS,FINISH,ROAD_POINTS,ROAD_SEGMENTS,BRANCH_POINTS,BRANCH_SEGMENTS,
  SHORTCUT_POSTS,GATES,COURSE_LENGTH,inLake} = selected;
export const MAP_NAME = IS_PINEWATER ? 'Pinewater Pass' : 'Sunny Side Highlands';
export const MAP_SPAWN = IS_PINEWATER ? pinewater.SPAWN : {x:0,y:0,z:36,yaw:0};
export const SIDE_ROUTES = IS_PINEWATER ? pinewater.SIDE_ROUTES : [sunny.BRANCH_POINTS];
export const ALL_ROUTES = [ROAD_POINTS,...SIDE_ROUTES];
export const MAP_SOLIDS = IS_PINEWATER ? pinewater.SOLIDS : [];
export const COLLISION_ROADS = IS_PINEWATER ? pinewater.COLLISION_SEGMENTS : [...ROAD_SEGMENTS,...BRANCH_SEGMENTS];
