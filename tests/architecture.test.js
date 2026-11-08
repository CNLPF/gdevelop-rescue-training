import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {BASE} from '../src/base/config.js';
import {chooseTarget,segmentRect} from '../src/rules.js';
import {attachAiming,resolveShotAim,targetAimPoint} from '../src/shared/aiming.js';
import {updateWeaponInput} from '../src/shared/weapon-input.js';

globalThis.BASE=BASE;

function mockVariable(value){
  return {
    getAsNumber:()=>Number(value),
    getAsString:()=>String(value),
    getAsBoolean:()=>Boolean(value),
    setNumber:next=>{value=next;},
    setString:next=>{value=next;},
    setBoolean:next=>{value=next;},
  };
}

function mockTarget(id,x,y,{health=2,active=true}={}){
  const variables=new Map([
    ['Id',mockVariable(id)],
    ['Health',mockVariable(health)],
    ['Active',mockVariable(active)],
  ]);
  return {
    name:'Patrol',
    x,y,
    getX:()=>x-28,
    getY:()=>y-24,
    getWidth:()=>56,
    getHeight:()=>48,
    getVariables:()=>variables,
    get(name){return this[name];},
  };
}

function makeRuntime(targets,walls=[]){
  const sceneVariables=new Map([
    ['Charge',mockVariable(0)],
    ['MissileLockProgress',mockVariable(0)],
    ['MissileTargetId',mockVariable('')],
  ]);
  return {
    player:{getX:()=>0,getY:()=>0},
    facing:1,
    Rules:{chooseTarget,segmentRect},
    objects:name=>targets.filter(target=>target.name===name),
    ov:(o,name)=>o.getVariables().get(name),
    center:o=>({x:o.x,y:o.y}),
    walls:()=>walls,
    set:(name,value)=>sceneVariables.get(name).setString(value),
    vars:{get:name=>sceneVariables.get(name)},
  };
}

test('enemy upper-body aim point is not hidden by the ledge it stands on',()=>{
  const target=mockTarget('ledge-patrol',180,52);
  const ledge={x:140,y:40,w:60,h:20};
  assert.deepEqual(targetAimPoint(target),{x:180,y:38});
  assert.equal(chooseTarget({x:42,y:29},1,[{id:'ledge-patrol',x:180,y:52,health:2}],[ledge]),null);

  const runtime=makeRuntime([target],[ledge]);
  attachAiming(runtime);
  assert.equal(runtime.updateAimTarget(BASE.weapons.Energy.range).id,'ledge-patrol');
  const shot=resolveShotAim(runtime,'Energy',{locked:false},{x:42,y:29});
  assert.equal(shot.target,target);
  assert.ok(shot.dy>0&&shot.dy<0.3,'shot rises toward the upper body without entering the ledge');
});

test('one aim target registry filters living and active objects in every scene',()=>{
  const targets=[
    mockTarget('alive',200,0),
    mockTarget('dead',120,0,{health:0}),
    mockTarget('inactive',100,0,{active:false}),
  ];
  const runtime=makeRuntime(targets);
  attachAiming(runtime);
  assert.deepEqual(runtime.aimTargetTypes,BASE.aimTargetTypes);
  assert.deepEqual(runtime.targets().map(o=>runtime.ov(o,'Id').getAsString()),['alive']);
  assert.equal(runtime.updateAimTarget(BASE.weapons.Energy.range).id,'alive');
  assert.equal(runtime.aimTargetId,'alive');
});

test('one weapon state machine locks, fires and clears missile target data',()=>{
  const runtime=makeRuntime([mockTarget('target',200,0)]);
  Object.assign(runtime,{
    dt:0.1,
    keys:{fire:true},
    released:{fire:false},
    charging:false,
    charge:0,
    fireCooldown:0,
    fireLocked:false,
    aimTargetId:'target',
    shots:[],
  });
  attachAiming(runtime);
  runtime.aimTargetId='target';
  runtime.fire=charge=>runtime.shots.push(charge);
  for(let count=0;count<6;count++)updateWeaponInput(runtime,'Missile',BASE.weapons.Missile);
  assert.equal(runtime.charging,true);
  assert.equal(runtime.missileTargetId,'target');
  assert.ok(Math.abs(runtime.charge-0.55)<1e-9);
  runtime.keys.fire=false;
  runtime.released.fire=true;
  updateWeaponInput(runtime,'Missile',BASE.weapons.Missile);
  assert.deepEqual(runtime.shots,[0.55]);
  assert.equal(runtime.charging,false);
  assert.equal(runtime.missileTargetId,'');
  assert.equal(runtime.vars.get('MissileTargetId').getAsString(),'');
});

test('shared shot resolver uses the selected instance upper-body point for its projectile vector',()=>{
  const targetObject={
    id:42,
    getX:()=>114,
    getY:()=>75,
    getWidth:()=>56,
    getHeight:()=>48,
  };
  const runtime={
    facing:1,
    aimTargetId:'target',
    missileTargetId:'',
    center:()=>({x:142,y:99}),
    targetById:id=>id==='target'?targetObject:null,
  };
  const aimed=resolveShotAim(runtime,'Energy',{locked:false},{x:100,y:80});
  assert.equal(aimed.target,targetObject);
  assert.equal(Number.isFinite(aimed.dx),true);
  assert.equal(Number.isFinite(aimed.dy),true);
  assert.ok(aimed.dx>0);
  assert.ok(aimed.dy>0);
  assert.equal(Math.hypot(aimed.dx,aimed.dy),1);
});

test('both authored scenes attach shared aiming and weapon-input modules',()=>{
  const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
  const runtimeSources=[
    read('src/base/runtime.js'),
    read('src/training-aerial.js'),
  ];
  for(const source of runtimeSources){
    assert.match(source,/attachAiming\(r\)/);
    assert.doesNotMatch(source,/r\.updateAimTarget\s*=/);
    assert.doesNotMatch(source,/r\.cancelCharge\s*=/);
  }
  assert.match(read('src/base/input.js'),/updateWeaponInput\(r,weapon,config\)/);
  assert.match(read('src/training-aerial.js'),/updateWeaponInput\(r,currentWeapon,currentConfig\)/);
  const build=read('scripts/build-base.cjs');
  assert.match(build,/'shared\/aiming'/);
  assert.match(build,/'shared\/weapon-input'/);
});

test('supplied V2 air fighter assets are validated, mapped and kept presentation-only',()=>{
  const root=new URL('../',import.meta.url);
  const manifest=JSON.parse(fs.readFileSync(new URL('assets/ASSET_MANIFEST_V2.json',root),'utf8'));
  const states={
    idle:'ENM_AIR_FIGHTER_IDLE_R_V02.svg',
    warn:'ENM_AIR_FIGHTER_WARN_R_V02.svg',
    attack:'ENM_AIR_FIGHTER_ATTACK_R_V02.svg',
    hit:'ENM_AIR_FIGHTER_HIT_R_V02.svg',
  };
  for(const [state,sourceName] of Object.entries(states)){
    const runtimeFile=`assets/air-fighter-${state}.svg`;
    const source=fs.readFileSync(new URL(runtimeFile,root),'utf8');
    assert.match(source,/<svg\b[^>]*width="144"[^>]*height="144"/i);
    assert.doesNotMatch(source,/<script\b|<foreignObject\b|\bon[a-z]+\s*=/i);
    assert.doesNotMatch(source,/\b(?:href|src)\s*=\s*["'](?!#)/i);
    assert.doesNotMatch(source,/\burl\(\s*(?!["']?#)/i);
    const sourceAsset=fs.readFileSync(new URL(`art-source/V2-air-enemies-v02/Mecha_Buddies_Air_Enemy_SVG_V02/${sourceName}`,root));
    assert.equal(crypto.createHash('sha256').update(source).digest('hex'),crypto.createHash('sha256').update(sourceAsset).digest('hex'));
    const record=manifest.assets.find(asset=>asset.file===runtimeFile);
    assert.ok(record,`${state} asset has a manifest record`);
    assert.equal(record.sha256,crypto.createHash('sha256').update(source).digest('hex'));
    assert.match(record.source,/User-supplied V2 air enemy SVG/);
  }
  for(const state of ['Idle','Warn','Attack','Hit']){
    assert.equal(manifest.runtime[`AirFighter${state}`],`assets/air-fighter-${state.toLowerCase()}.svg`);
  }
  const build=fs.readFileSync(new URL('scripts/build-base.cjs',root),'utf8');
  const apply=fs.readFileSync(new URL('scripts/apply-art-v2.cjs',root),'utf8');
  const presenter=fs.readFileSync(new URL('src/art-v2.js',root),'utf8');
  assert.match(build,/function loadAirFighterAssets\(\)/);
  assert.match(build,/'base-scout-drone\.svg': svg\(72, 40/);
  assert.match(build,/'base-armored-drone\.svg': svg\(90, 50/);
  assert.match(apply,/global\('ArtScoutDrone',airFighter\)/);
  assert.match(apply,/global\('ArtArmoredDrone',airFighter\)/);
  assert.match(presenter,/flash>0\?'Hit':warning\?'Warn':attackTime>0\?'Attack':'Idle'/);
  assert.match(presenter,/v\.flipX\(r\.ov\(o,'Direction'\)\.getAsNumber\(\)<0\)/);
});
