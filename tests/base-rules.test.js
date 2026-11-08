import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BASE,basePurchase,baseShot,enemyAttackEligible,enemyAttackTiming,missileTurn,reinforcementDelay,reinforcementSite,reinforcementZone,shieldBlocks,trialReward,weaponCycle} from '../src/base/config.js';
import {chooseTarget,segmentRect} from '../src/rules.js';
test('authored level has 32 coins, 22 unique enemies and 98 available base income',()=>{
  assert.equal(BASE.width,8400);assert.equal(BASE.coins.length,32);assert.equal(BASE.enemies.length,22);
  assert.equal(new Set(BASE.enemies.map(e=>e.id)).size,22);
  assert.deepEqual(['Patrol','Turret','Shield','ScoutDrone','ArmoredDrone'].map(t=>BASE.enemies.filter(e=>e.type===t).length),[6,5,4,4,3]);
  assert.equal(BASE.coins.length+BASE.enemies.length*3,98);
  assert.equal(BASE.zones.length,7);assert.equal(BASE.zones.at(-1).end,BASE.width);
});
test('combat density rises as a readable sawtooth and attack tempo stays bounded',()=>{
  assert.deepEqual(BASE.combatBeats.map(beat=>beat.type),['teach','combat','rest','combat','combat','rest','climax','release']);
  const byZone=Object.fromEntries(BASE.zones.map(zone=>[zone.id,zone.tempo]));
  assert.ok(byZone.Entry>byZone.Corridor);
  assert.ok(byZone.Corridor>byZone.Shield);
  assert.ok(byZone.Shield>byZone.Energy);
  assert.ok(byZone.Energy>byZone.Aerial);
  assert.ok(byZone.Supply>byZone.Shield&&byZone.Rescue>byZone.Aerial);
  const turretFast=enemyAttackTiming('Turret',0.75);
  assert.equal(turretFast.tempo,0.75);
  assert.ok(Math.abs(turretFast.period-1.65)<1e-9);
  assert.equal(turretFast.warning,0.7);
  assert.deepEqual(enemyAttackTiming('ScoutDrone',0.5).tempo,0.65);
  assert.deepEqual(enemyAttackTiming('ArmoredDrone',2).tempo,1.25);
  const patrolFast=enemyAttackTiming('Patrol',0.75);
  assert.equal(patrolFast.tempo,0.75);
  assert.ok(Math.abs(patrolFast.period-2.1)<1e-9);
  assert.equal(patrolFast.warning,0.62);
  const shieldFast=enemyAttackTiming('Shield',0.95);
  assert.equal(shieldFast.tempo,0.95);
  assert.ok(Math.abs(shieldFast.period-3.04)<1e-9);
  assert.equal(shieldFast.warning,0.7);
});
test('shop validates exact price, ownership, missing weapon and full life without spending',()=>{
  for(const item of ['Energy','Cannon','Missile']){const cost=BASE.weapons[item].upgradeCost;
    assert.equal(basePurchase({coins:cost-1,item,hasCannon:true,hasMissile:true}).reason,'funds');
    assert.equal(basePurchase({coins:cost,item,hasCannon:true,hasMissile:true}).coins,0);
    assert.equal(basePurchase({coins:100,item,owned:true,hasCannon:true,hasMissile:true}).coins,100);
  }
  assert.equal(basePurchase({coins:16,item:'Cannon'}).reason,'locked');
  assert.equal(basePurchase({coins:18,item:'Missile'}).reason,'missile-locked');
  assert.equal(basePurchase({coins:BASE.weapons.Missile.purchaseCost-1,item:'MissilePurchase'}).reason,'funds');
  assert.equal(basePurchase({coins:BASE.weapons.Missile.purchaseCost,item:'MissilePurchase'}).coins,0);
  assert.equal(basePurchase({coins:5,item:'heal',health:3}).reason,'full');
  assert.equal(basePurchase({coins:4,item:'heal',health:1}).coins,4);
  assert.equal(basePurchase({coins:5,item:'heal',health:1}).coins,0);
  assert.equal(basePurchase({coins:10,item:'heal',health:1,stock:true}).reason,'owned');
});
test('charge threshold and upgrades are independent; weak cannon never pierces',()=>{
  assert.equal(baseShot('Energy',false).damage,1);assert.equal(baseShot('Energy',true).damage,2);
  for(const upgraded of [false,true]){
    const weak=baseShot('Cannon',upgraded,0.799);assert.equal(weak.damage,upgraded?2:1);assert.equal(weak.pierceShield,false);
    for(const charge of [0.8,1,10]){const shot=baseShot('Cannon',upgraded,charge);assert.equal(shot.damage,upgraded?8:4);assert.equal(shot.pierceShield,true);}
  }
});
test('missile lock, weak fire, independent upgrade and configured turning are deterministic',()=>{
  for(const upgraded of [false,true]){
    const weak=baseShot('Missile',upgraded,0.549);assert.equal(weak.locked,false);assert.equal(weak.damage,upgraded?2:1);
    for(const lock of [0.55,1]){const shot=baseShot('Missile',upgraded,lock);assert.equal(shot.locked,true);assert.equal(shot.damage,upgraded?5:3);}
  }
  const straight=missileTurn(360,0,{x:0,y:100},0.01,240);
  assert.ok(straight.vy>0);assert.ok(Math.abs(Math.hypot(straight.vx,straight.vy)-360)<1e-9);
  assert.deepEqual(trialReward(3),{count:3,coins:12});assert.deepEqual(trialReward(99),{count:3,coins:12});
});
test('Q cycles only owned weapons in the authored order and repeats after Missile',()=>{
  assert.equal(weaponCycle({current:'Energy'}),'Energy');
  assert.equal(weaponCycle({current:'Energy',hasCannon:true}),'Cannon');
  assert.equal(weaponCycle({current:'Cannon',hasCannon:true}),'Energy');
  assert.equal(weaponCycle({current:'Cannon',hasCannon:true,hasMissile:true}),'Missile');
  assert.equal(weaponCycle({current:'Missile',hasCannon:true,hasMissile:true}),'Energy');
});
test('shield uses visible facing, permits rear damage and charged front hits',()=>{
  const a={shield:true,facing:-1,centerX:100,impactX:90,pierceShield:false};
  assert.equal(shieldBlocks(a),true);assert.equal(shieldBlocks({...a,impactX:110}),false);assert.equal(shieldBlocks({...a,pierceShield:true}),false);
  assert.equal(shieldBlocks({...a,shield:false}),false);
});
test('all weapon aim ranges honor facing and cover',()=>{
  const origin={x:0,y:0},targets=[{id:'enemy',x:500,y:0,health:2}];
  assert.equal(chooseTarget(origin,1,targets,[],BASE.weapons.Energy.range).id,'enemy');assert.equal(chooseTarget(origin,1,targets,[],BASE.weapons.Cannon.range),null);
  assert.equal(chooseTarget(origin,-1,targets,[]),null);assert.equal(chooseTarget(origin,1,targets,[{x:240,y:-20,w:40,h:40}]),null);
  assert.equal(chooseTarget(origin,1,targets,[],BASE.weapons.Missile.lockRange).id,'enemy');
  assert.equal(segmentRect(0,0,720,0,{x:400,y:-20,w:2,h:40}),400/720);
});
test('every weapon uses the same vertical bias and twenty percent switch margin',()=>{
  for(const weapon of Object.values(BASE.weapons)){
    assert.equal(weapon.verticalBias,0.75);
    assert.equal(weapon.switchMargin,0.2);
  }
  const targets=[
    {id:'horizontal',x:150,y:0,health:1},
    {id:'overhead',x:100,y:-80,health:1},
  ];
  for(const weapon of Object.values(BASE.weapons)){
    const result=chooseTarget({x:0,y:0},1,targets,[],weapon.range,weapon);
    assert.equal(result.id,'horizontal',weapon.id);
  }
});
test('ground enemies land safely, flying enemies stay in zones, and portals return to safe ground',()=>{
  const flying=new Set(['ScoutDrone','ArmoredDrone']);
  for(const e of BASE.enemies){
    const zone=BASE.zones.find(z=>z.id===e.zone);assert.ok(zone,e.id);
    assert.ok(e.x>=zone.start&&e.x<zone.end,e.id);
    if(!flying.has(e.type))assert(BASE.terrain.some(([x,y,w])=>e.x>=x&&e.x+56<=x+w&&e.y+(e.type==='Patrol'?48:56)===y),e.id);
  }
  for(const p of BASE.portals){assert(BASE.terrain.some(([x,y,w])=>p.x>=x&&p.x+40<=x+w&&p.y+56===y));assert(BASE.enemies.every(e=>Math.abs(p.x-e.x)>120));}
  assert.equal(BASE.gates.length,6);assert.equal(new Set(BASE.gates.map(g=>g.id)).size,6);
});
test('flying-enemy attacks stay inside the 960px viewport and pause with clear line of sight',()=>{
  const player={x:100,y:0};
  assert.equal(enemyAttackEligible({cameraX:0,enemy:{x:480,y:0},player,range:600}),true);
  assert.equal(enemyAttackEligible({cameraX:0,enemy:{x:480.01,y:0},player,range:600}),false);
  assert.equal(enemyAttackEligible({cameraX:0,enemy:{x:-480,y:0},player,range:600}),true);
  assert.equal(enemyAttackEligible({cameraX:0,enemy:{x:-480.01,y:0},player,range:600}),false);
  assert.equal(enemyAttackEligible({paused:true,cameraX:0,enemy:{x:100,y:0},player,range:600}),false);
  assert.equal(enemyAttackEligible({cameraX:0,enemy:{x:100,y:0},player,range:600,blocked:true}),false);
  assert.equal(enemyAttackEligible({cameraX:0,enemy:{x:100,y:0},player:{x:200,y:0},range:50}),false);
});
test('reinforcements use only safe combat sites, respect spacing and remain deterministic',()=>{
  for(const x of [0,500,2500,7900])assert.equal(reinforcementZone(x),null,x);
  for(const id of ['Corridor','Shield','Energy','Aerial']){
    const zone=BASE.zones.find(item=>item.id===id);
    assert.equal(reinforcementZone(zone.start+20).id,id);
  }
  for(let seed=0;seed<100;seed++){
    const delay=reinforcementDelay(seed);
    assert.ok(delay>=5&&delay<=7,'delay '+seed+'='+delay);
    assert.equal(delay,reinforcementDelay(seed));
  }
  const zone='Corridor';
  const first=reinforcementSite({zone,seed:17,playerX:1500});
  const repeat=reinforcementSite({zone,seed:17,playerX:1500});
  assert.deepEqual(first,repeat);
  assert.equal(first.zone,zone);
  assert.ok(Math.abs(first.x-1500)>=BASE.reinforcements.safeSpawnDistance);
  const withoutFirst=reinforcementSite({zone,seed:17,occupied:[first.key],playerX:1500});
  assert.notEqual(withoutFirst?.key,first.key);
  for(const site of BASE.reinforcements.sites){
    assert.equal(reinforcementZone(site.x).id,site.zone,site.key);
    if(site.type==='Patrol')assert(BASE.terrain.some(([x,y,w])=>site.x>=x&&site.x+56<=x+w&&site.y+48===y),site.key);
  }
  assert.deepEqual(
    [...new Set(BASE.reinforcements.sites.map(site=>site.type))].sort(),
    ['ArmoredDrone','Patrol','ScoutDrone','Shield','Turret'],
  );
  assert.deepEqual(
    [...new Set(BASE.trainingReinforcements.sites.map(site=>site.type))].sort(),
    ['ArmoredDrone','Patrol','ScoutDrone','Shield','Turret'],
  );
  assert.equal(BASE.reinforcements.maxActive,3);
  assert.equal(BASE.trainingReinforcements.maxActive,3);
  assert.equal(BASE.enemyStats.Turret.speedBullet,270);
});
test('all five enemy types have active attack rules and mobile enemies can chase',()=>{
  for(const type of ['Patrol','Shield','Turret','ScoutDrone','ArmoredDrone']){
    const stats=BASE.enemyStats[type];
    assert.ok(stats.period>0,type);
    assert.ok(stats.warning>0,type);
    assert.ok(stats.range>0,type);
    assert.ok(stats.speedBullet>0||stats.bombSpeed>0,type);
  }
  for(const type of ['Patrol','Shield','Turret'])assert.ok(BASE.enemyStats[type].speed>0,type);
  for(const type of ['ScoutDrone','ArmoredDrone'])assert.ok(BASE.enemyStats[type].verticalChase>0,type);
  for(const type of ['Patrol','Shield','Turret','ScoutDrone','ArmoredDrone']){
    assert.ok(BASE.enemyStats[type].preferredDistance>0,type);
    assert.ok(BASE.enemyStats[type].chaseRange>0,type);
    assert.ok(BASE.enemyStats[type].standoffDistance>0,type);
    assert.ok(BASE.enemyStats[type].standoffDistance<BASE.enemyStats[type].preferredDistance,type);
  }
});
test('patrol shooting also respects distance, line of sight and vertical reach',()=>{
  const common={cameraX:0,range:BASE.enemyStats.Patrol.range,verticalRange:BASE.enemyStats.Patrol.verticalRange};
  assert.equal(enemyAttackEligible({...common,enemy:{x:100,y:0},player:{x:300,y:100}}),true);
  assert.equal(enemyAttackEligible({...common,enemy:{x:100,y:0},player:{x:300,y:161}}),false);
  assert.equal(enemyAttackEligible({...common,enemy:{x:100,y:0},player:{x:500,y:0}}),false);
  assert.equal(enemyAttackEligible({...common,enemy:{x:100,y:0},player:{x:300,y:0},blocked:true}),false);
});
