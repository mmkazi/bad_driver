import test from 'node:test';
import assert from 'node:assert/strict';
import {stick,gamepadInput,readGamepads,gatedGamepadInput} from '../src/gamepads.js';
const pad=()=>({connected:true,mapping:'standard',index:0,id:'Test pad',axes:[0,0],buttons:Array.from({length:17},()=>({value:0}))});
test('analog steering has a scaled dead zone and triggers provide signed driving',()=>{
 const p=pad();p.axes[0]=.575;p.buttons[7].value=.8;p.buttons[6].value=.3;
 assert.ok(Math.abs(gamepadInput(p).steer-.5)<1e-10);assert.equal(gamepadInput(p).drive,.5);
 assert.equal(stick(.14),0);assert.equal(stick(-1),-1);assert.equal(stick(NaN),0);
 p.buttons[14].value=1;assert.equal(gamepadInput(p).steer,-1);
});
test('missing, disconnected and unmapped controllers cannot drive',()=>{
 for(const p of [null,{...pad(),connected:false},{...pad(),mapping:''}])assert.deepEqual(gamepadInput(p),{drive:0,steer:0});
 assert.deepEqual(readGamepads({}),[]);assert.deepEqual(readGamepads({getGamepads(){throw new Error('blocked');}}),[]);
 const p=pad();assert.deepEqual(readGamepads({getGamepads:()=>[null,p,null]}),[p]);
});
test('assignment and resume require all driving controls released, even cancelling triggers',()=>{
 const p=pad();p.buttons[7].value=p.buttons[6].value=1;
 assert.equal(gatedGamepadInput(p,false).armed,false);
 p.buttons[6].value=0;assert.equal(gatedGamepadInput(p,false).input.drive,0);
 p.buttons[7].value=0;assert.equal(gatedGamepadInput(p,false).armed,true);
 p.buttons[7].value=.7;assert.equal(gatedGamepadInput(p,true).input.drive,.7);
 p.connected=false;assert.equal(gatedGamepadInput(p,true).armed,false);
});
