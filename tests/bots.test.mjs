import test from 'node:test';
import assert from 'node:assert/strict';
import {createBot,tickBot} from '../src/bots.js';
import {createCar,stepCar,GATES,crossedGate} from '../src/physics.js';
import {mixCrew} from '../src/crew.js';
import {FINISH} from '../src/course.js';
const sample={x:0,y:0,z:30,yaw:0,yawRate:0,speed:5,forwardSpeed:5,upY:1,airTime:0};
test('safe saboteurs drive normally; reactions hold inputs and pause freezes decisions',()=>{
 const a=createBot(()=>.6),b=createBot(()=>.6);
 assert.deepEqual(tickBot(a,sample,{},.01),tickBot(b,sample,{role:'saboteur'},.01));
 const output=a.output;
 assert.equal(tickBot(a,{...sample,yaw:1},{},.01),output);
 const state=JSON.stringify(a);tickBot(a,sample,{},0);assert.equal(JSON.stringify(a),state);
});
test('fork guesses yield for a second and accept the actual shortcut',()=>{
 const bot=createBot(()=>.2),car={...sample,x:45,z:104,yaw:-Math.PI/2};
 tickBot(bot,car,{gateIndex:6},.5);assert.equal(bot.forkChoice,'main');
 assert.deepEqual(tickBot(bot,car,{gateIndex:6},.6),{drive:0,steer:0});
 tickBot(bot,{...car,x:20,z:130},{gateIndex:6},.01);assert.equal(bot.route,'shortcut');
});
test('traffic causes caution; danger triggers bounded randomized sabotage intervals',()=>{
 const traffic=[{x:0,y:1,z:21,active:true}];
 const safe=tickBot(createBot(()=>.8),sample,{},.01);
 const cautious=tickBot(createBot(()=>.8),sample,{traffic},.01);
 assert.ok(cautious.drive<safe.drive);
 const bot=createBot(()=>.8);tickBot(bot,sample,{traffic,role:'saboteur'},.01);
 assert.equal(bot.mode,'sabotage');assert.ok(bot.interval>=.5&&bot.interval<=1.5);
 const changes=bot.changes;tickBot(bot,sample,{traffic,role:'saboteur'},.5);assert.equal(bot.changes,changes);
 tickBot(bot,sample,{role:'saboteur'},.01);assert.equal(bot.mode,'nominal');
 assert.deepEqual(tickBot(bot,{...sample,upY:0},{},.01),{drive:0,steer:0});
});
test('a nominal bot traverses the course through ordinary arcade inputs',()=>{
 for(const guess of [.25,.75]){
 const bot=createBot(()=>guess),car=createCar();let gate=0,finished=false;
 for(let i=0;i<120*360&&!finished;i++){
  const previous={x:car.x,y:car.y,z:car.z};
  const input=tickBot(bot,car,{gateIndex:gate},1/120);
  assert.ok(Math.abs(input.drive)<=1&&Math.abs(input.steer)<=1);
  stepCar(car,mixCrew([input],[1]),{response:.1,turning:1,grip:1},1/120);
  if(gate<GATES.length&&crossedGate(previous,car,GATES[gate]))gate++;
  finished=gate===GATES.length&&car.x>FINISH.minX&&car.x<FINISH.maxX&&car.z>FINISH.minZ&&car.z<FINISH.maxZ&&car.speed<.7;
 }
 assert.equal(gate,GATES.length,`gate ${gate}, car ${car.x}, ${car.z}`);assert.equal(car.recoveries,0);
 assert.ok(finished,`finish box: ${car.x}, ${car.z}, speed ${car.speed}`);
 }
});
