import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CONFIG,segmentRect,chooseTarget,purchase,resolveJump,overlaps} from '../src/rules.js';

test('upgrade costs exactly ten coins; nine never deducts',()=>{
  assert.deepEqual(purchase(9,false),{ok:false,reason:'funds',coins:9,owned:false});
  assert.deepEqual(purchase(10,false),{ok:true,reason:'purchased',coins:0,owned:true});
  assert.deepEqual(purchase(14,false),{ok:true,reason:'purchased',coins:4,owned:true});
});
test('owned upgrade never charges twice',()=>{
  for(const coins of [0,4,9,10,100])assert.deepEqual(purchase(coins,true),{ok:false,reason:'owned',coins,owned:true});
});
test('aim picks a living visible enemy in the facing direction',()=>{
  const targets=[{id:'behind',x:-10,y:0,health:1},{id:'far',x:180,y:0,health:1},{id:'near',x:100,y:0,health:1},{id:'dead',x:20,y:0,health:0}];
  assert.equal(chooseTarget({x:0,y:0},1,targets,[]).id,'near');
  assert.equal(chooseTarget({x:0,y:0},-1,targets,[]).id,'behind');
});
test('weighted aim prefers a horizontal target over a slightly nearer overhead target',()=>{
  const targets=[
    {id:'horizontal',x:150,y:0,health:1},
    {id:'overhead',x:100,y:-80,health:1},
  ];
  assert.equal(chooseTarget({x:0,y:0},1,targets,[]).id,'horizontal');
});
test('vertical bias still lets a clearly easier overhead target win',()=>{
  const targets=[
    {id:'horizontal',x:120,y:0,health:1},
    {id:'overhead',x:50,y:-40,health:1},
  ];
  assert.equal(chooseTarget({x:0,y:0},1,targets,[]).id,'overhead');
  assert.equal(chooseTarget({x:0,y:0},1,targets,[],600,{verticalBias:0}).id,'overhead');
});
test('aim excludes out-of-range targets and walls block the ray',()=>{
  assert.equal(chooseTarget({x:0,y:0},1,[{x:601,y:0,health:1}],[]),null);
  assert.equal(chooseTarget({x:0,y:0},1,[{x:100,y:0,health:1}],[{x:40,y:-20,w:8,h:40}]),null);
  assert.equal(chooseTarget({x:0,y:0},1,[{id:'above',x:100,y:-100,health:1}],[{x:40,y:-20,w:8,h:40}]).id,'above');
});
test('current target remains sticky until a candidate is at least twenty percent better',()=>{
  const origin={x:0,y:0};
  const sticky={id:'sticky',x:160,y:0,health:1};
  const smallerGain={id:'candidate',x:140,y:0,health:1};
  const exactSwitch={id:'candidate',x:128,y:0,health:1};
  const clearSwitch={id:'candidate',x:120,y:0,health:1};
  assert.equal(chooseTarget(origin,1,[sticky,smallerGain],[],600,{stickyId:'sticky'}).id,'sticky');
  assert.equal(chooseTarget(origin,1,[sticky,exactSwitch],[],600,{stickyId:'sticky'}).id,'candidate');
  assert.equal(chooseTarget(origin,1,[sticky,clearSwitch],[],600,{stickyId:'sticky'}).id,'candidate');
});
test('stale sticky ids are ignored and equal scores use deterministic id order',()=>{
  const origin={x:0,y:0};
  const targets=[
    {id:'zeta',x:100,y:-30,health:1},
    {id:'alpha',x:100,y:30,health:1},
  ];
  assert.equal(chooseTarget(origin,1,targets,[],600,{stickyId:'missing'}).id,'alpha');
  assert.equal(chooseTarget(origin,1,[...targets].reverse(),[],600,{stickyId:'missing'}).id,'alpha');
  assert.equal(chooseTarget(origin,1,[...targets,{id:'dead',x:20,y:0,health:0}],[],600,{stickyId:'dead'}).id,'alpha');
});
test('swept projectiles hit thin walls even when crossing them in one step',()=>{
  assert.equal(segmentRect(0,10,100,10,{x:50,y:0,w:2,h:20}),0.5);
  assert.equal(segmentRect(0,30,100,30,{x:50,y:0,w:2,h:20}),null);
  assert.equal(segmentRect(50,10,50,10,{x:50,y:0,w:2,h:20}),0);
});
test('jump resolver consumes only floor/coyote plus one air jump',()=>{
  assert.deepEqual(resolveJump({grounded:true,coyote:0,count:0,buffer:.12,pending:false}),{count:1,air:false});
  assert.deepEqual(resolveJump({grounded:false,coyote:.01,count:0,buffer:.12,pending:false}),{count:1,air:false});
  assert.deepEqual(resolveJump({grounded:false,coyote:0,count:1,buffer:.12,pending:false}),{count:2,air:true});
  assert.equal(resolveJump({grounded:false,coyote:0,count:2,buffer:.12,pending:false}),null);
  assert.equal(resolveJump({grounded:true,coyote:0,count:0,buffer:0,pending:false}),null);
  assert.equal(resolveJump({grounded:true,coyote:.1,count:1,buffer:.12,pending:true}),null);
});
test('contact requires actual overlap, not adjacent edges',()=>{
  assert.equal(overlaps({x:0,y:0,w:40,h:56},{x:40,y:0,w:24,h:24}),false);
  assert.equal(overlaps({x:0,y:0,w:40,h:56},{x:39,y:10,w:24,h:24}),true);
});
test('project balance guarantees an affordable upgrade and equal weapon handling',()=>{
  assert.ok(8+2*3>=CONFIG.upgradeCost);
  assert.equal(CONFIG.bulletSpeed,720);assert.equal(CONFIG.range,600);assert.equal(CONFIG.fireInterval,.3);
});
