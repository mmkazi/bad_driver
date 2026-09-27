import test from 'node:test';
import assert from 'node:assert/strict';
import {createSabotage,requestSabotage,tickSabotage,sabotageEffects,protectCar,createRound,tickRound,endRound} from '../src/rules.js';
import {createCar,stepCar,DEFAULTS} from '../src/physics.js';
const advance=(s,seconds)=>{for(let i=0;i<seconds*120;i++)tickSabotage(s,1/120);};
test('attacks charge once, warn before activation, and cannot overlap',()=>{
  const s=createSabotage();assert.equal(requestSabotage(s,'left'),false);advance(s,3.1);
  const energy=s.energy;assert.equal(requestSabotage(s,'left'),true);assert.equal(s.energy,energy-35);
  assert.equal(requestSabotage(s,'right'),false);assert.equal(sabotageEffects(s).surgeSide,null);
  advance(s,1.3);assert.equal(sabotageEffects(s).surgeSide,'left');advance(s,2);assert.equal(s.active,null);
  assert.equal(requestSabotage(s,'right'),false);advance(s,3);assert.equal(requestSabotage(s,'right'),true);
});
test('recovery cancels pending and active effects and grants protection',()=>{
  const s=createSabotage();advance(s,4);requestSabotage(s,'slip');advance(s,1.5);
  assert.equal(sabotageEffects(s).gripFactor,.12);protectCar(s);
  assert.equal(sabotageEffects(s).gripFactor,1);assert.equal(s.pending,null);assert.equal(requestSabotage(s,'left'),false);
  advance(s,4.1);assert.equal(requestSabotage(s,'left'),true);protectCar(s);assert.equal(s.pending,null);
});
test('resource budget rejects unaffordable attacks and regeneration caps at 100',()=>{
  const s=createSabotage();s.protection=0;s.energy=34;assert.equal(requestSabotage(s,'left'),false);
  advance(s,30);assert.equal(s.energy,100);
});
test('round gates are unique, collision incidents are debounced, and timeout is final',()=>{
  const r=createRound(3);tickRound(r,.1,{impact:10,recovered:true,gate:0});tickRound(r,.1,{impact:10,gate:0});
  assert.equal(r.crashes,1);assert.equal(r.gates.size,1);assert.equal(r.recoveries,1);
  tickRound(r,1.6,{impact:10,gate:1});assert.equal(r.crashes,2);tickRound(r,2);
  assert.equal(r.outcome,'Time up');const time=r.elapsed;tickRound(r,3,{impact:20,gate:3});assert.equal(r.elapsed,time);assert.equal(r.gates.size,2);
  endRound(r,'Course complete!');assert.equal(r.outcome,'Time up');
});
test('a surge physically turns the car and braking that side reduces it',()=>{
  const surged=createCar({course:false}),countered=createCar({course:false});
  for(let i=0;i<120;i++){
    stepCar(surged,{left:0,right:0},DEFAULTS,1/120,{surgeSide:'left'});
    stepCar(countered,{left:-.65,right:0},DEFAULTS,1/120,{surgeSide:'left'});
  }
  assert.ok(surged.yaw>.05);assert.ok(Math.abs(countered.yaw)<Math.abs(surged.yaw));
});
test('slippery tires preserve more lateral velocity than normal grip',()=>{
  const normal=createCar({course:false}),slip=createCar({course:false});
  for(const car of [normal,slip]){for(let i=0;i<120;i++)stepCar(car,{left:0,right:0},DEFAULTS,1/120);car.body.velocity.x=6;}
  for(let i=0;i<36;i++){
    stepCar(normal,{left:0,right:0},DEFAULTS,1/120);
    stepCar(slip,{left:0,right:0},DEFAULTS,1/120,{gripFactor:.12});
  }
  assert.ok(Math.abs(slip.vx)>Math.abs(normal.vx)*1.5);
});
