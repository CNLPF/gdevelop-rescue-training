// Missile, relay-core and repeatable-trial checks use real input/damage events.
const v=n=>harness.getSceneVariable(n).value;
const p=()=>harness.getObjects('Player')[0];
const ov=(o,n)=>harness.getObjectVariable(o.id,n).value;
const tap=async key=>{harness.setKeyPressed(key,true);await harness.stepFrames(1);harness.setKeyPressed(key,false);await harness.stepFrames(2);};
const spawnImpact=(target,{weapon='Energy',damage=1,locked=false,targetId=''}={})=>{
  const bullet=harness.spawn('Bullet',target.centerX-8,target.centerY-8,undefined,'Gameplay');
  for(const [key,value]of Object.entries({Vx:360,Vy:0,Distance:0,Range:720,Damage:damage}))harness.setObjectVariable(bullet.id,key,value);
  harness.setObjectVariable(bullet.id,'Weapon',weapon);harness.setObjectVariable(bullet.id,'PierceShield',false);
  harness.setObjectVariable(bullet.id,'Locked',locked);harness.setObjectVariable(bullet.id,'TargetId',targetId);
  return bullet;
};

// Normal weapons are rejected before core health or reward state changes.
await harness.goToScene('RescueBase');await harness.stepFrames(4);
let core=harness.getObjects('JammerCore')[0];
harness.setObjectVariable(core.id,'Active',true);
const relayShot=spawnImpact(core,{weapon:'Energy',damage:2});await harness.stepFrames(2);
const relayShotLive=harness.getObjects('Bullet').find(o=>o.id===relayShot.id);
harness.assert(
  ov(core,'Health')===12&&v('JammerBlocks')===1&&!v('JammerCoreDefeated')&&!relayShotLive,
  `ordinary weapons are blocked and removed without damaging the relay core (health=${ov(core,'Health')}, blocks=${v('JammerBlocks')}, defeated=${v('JammerCoreDefeated')}, bulletExists=${!!relayShotLive})`
);

// Missile shop respects the exact 20-coin purchase boundary.
harness.setSceneVariable('Coins',19);harness.setObjectPosition(p().id,5740,504);await harness.stepFrames(3);await tap('e');
harness.assert(v('GameMode')==='Shop','missile shop opens through the real interaction');
await tap('Return');harness.assert(v('Coins')===19&&!v('HasMissile'),'19 coins cannot buy the missile');
harness.setSceneVariable('Coins',20);await tap('Return');
harness.assert(v('Coins')===0&&v('HasMissile')&&v('CurrentWeapon')==='Missile'&&v('MissileBought')===1,'20 coins buy and equip the missile once');
await tap('Return');harness.assert(v('CoinsSpent')===20&&v('MissileBought')===1,'repeated confirmation cannot charge twice');

// A missile powered by four real hits destroys the relay and opens the final gate.
await harness.goToScene('RescueBase');await harness.stepFrames(4);
core=harness.getObjects('JammerCore')[0];harness.setObjectVariable(core.id,'Active',true);harness.setSceneVariable('Stage','Aerial');
for(let hit=0;hit<4;hit++){spawnImpact(core,{weapon:'Missile',damage:3,locked:true,targetId:'relay-core'});await harness.stepFrames(2);}
harness.assert(v('JammerCoreDefeated')&&v('JammerCoresDefeated')===1&&v('Stage')==='Rescue','four missiles destroy the relay and advance the stage');
harness.assert(!harness.getObjects('Gate').some(o=>ov(o,'Id')==='relay'),'relay gate opens only after the core is destroyed');

// Locked fire stores its target; losing that target disables guidance but not flight.
await harness.goToScene('RescueBase');await harness.stepFrames(4);
const target=harness.getObjects('ScoutDrone').find(o=>ov(o,'Id')==='sd1');
const otherTypes=['Patrol','Turret','Shield','Dummy','ScoutDrone','ArmoredDrone','JammerCore','TrialDrone'];
for(const type of otherTypes)for(const object of harness.getObjects(type))if(object.id!==target.id)harness.removeObject(object.id);
harness.setObjectPosition(p().id,6000,504);await tap('Right');harness.setObjectPosition(p().id,6000,504);
harness.setObjectPosition(target.id,6250,470);
for(const [key,value]of Object.entries({MinX:6250,MaxX:6250,HoverY:470,Health:3}))harness.setObjectVariable(target.id,key,value);
harness.setSceneVariable('HasMissile',true);harness.setSceneVariable('CurrentWeapon','Missile');
harness.setKeyPressed('w',false);await harness.stepFrames(3);
harness.setKeyPressed('w',true);await harness.stepFrames(40);
const lockTarget=harness.getObjects('ScoutDrone').find(o=>o.id===target.id);
const lockRuntime=harness.getCurrentRuntimeScene().__rescue;
const lockOrigin={x:p().x+(lockRuntime.facing>0?42:-2),y:p().y+29};
const lockDroneStates=lockRuntime.objects('ScoutDrone').map(o=>({id:ov(o,'Id'),health:ov(o,'Health'),hasActive:o.getVariables().has('Active'),active:o.getVariables().has('Active')?ov(o,'Active'):'missing'}));
const lockCandidates=lockRuntime.targets().map(o=>({...lockRuntime.center(o),id:ov(o,'Id'),health:ov(o,'Health')}));
const lockPick=lockRuntime.Rules.chooseTarget(lockOrigin,lockRuntime.facing,lockCandidates,lockRuntime.walls(),560);
harness.assert(
  v('MissileTargetId')==='sd1'&&v('MissileLockProgress')>=0.55,
  `holding W completes the shared visible target lock (targetId=${v('MissileTargetId')}, progress=${v('MissileLockProgress')}, charge=${v('Charge')}, mode=${v('GameMode')}, weapon=${v('CurrentWeapon')}, player=${p().x},${p().y}, target=${lockTarget?.x},${lockTarget?.y}, health=${lockTarget?ov(lockTarget,'Health'):'missing'}, active=${lockTarget?ov(lockTarget,'Active'):'missing'}, facing=${lockRuntime.facing}, fireLocked=${lockRuntime.fireLocked}, cooldown=${lockRuntime.fireCooldown}, charging=${lockRuntime.charging}, pressedFire=${lockRuntime.pressed.fire}, keyFire=${lockRuntime.keys.fire}, drones=${JSON.stringify(lockDroneStates)}, candidates=${JSON.stringify(lockCandidates)}, origin=${JSON.stringify(lockOrigin)}, pick=${JSON.stringify(lockPick)})`
);
harness.setKeyPressed('w',false);await harness.stepFrames(1);
const guided=harness.getObjects('Bullet').find(o=>ov(o,'Weapon')==='Missile'&&ov(o,'Locked'));
harness.assert(!!guided&&ov(guided,'TargetId')==='sd1'&&ov(guided,'Damage')===3,'locked missile stores target and configured damage');
harness.removeObject(target.id);await harness.stepFrames(1);
harness.assert(harness.getObjects('Bullet').some(o=>o.id===guided.id)&&!ov(guided,'Locked'),'dead target removes guidance while missile continues straight');
await harness.stepFrames(130);
harness.assert(!harness.getObjects('Bullet').some(o=>o.id===guided.id),'unguided missile expires at its configured range');

// A missile is removed by walls and applies one hit before its single deletion.
await harness.goToScene('RescueBase');await harness.stepFrames(4);
const wallShot=harness.spawn('Bullet',1848,500,undefined,'Gameplay');
for(const [key,value]of Object.entries({Vx:360,Vy:0,Distance:0,Range:720,Damage:3,Weapon:'Missile',Locked:false}))harness.setObjectVariable(wallShot.id,key,value);
await harness.stepFrames(2);harness.assert(!harness.getObjects('Bullet').some(o=>o.id===wallShot.id),'missile cannot pass through a wall');
const single=harness.getObjects('ScoutDrone').find(o=>ov(o,'Id')==='sd1');harness.setObjectVariable(single.id,'Health',3);
spawnImpact(single,{weapon:'Missile',damage:3,locked:true,targetId:'sd1'});await harness.stepFrames(2);
harness.assert(!harness.getObjects('ScoutDrone').some(o=>o.id===single.id)&&v('ScoutDroneDefeated')===1,'missile settles one hit and one defeat');
await harness.stepFrames(8);harness.assert(v('ScoutDroneDefeated')===1,'a missile cannot award the same defeat twice');

// Zero-balance players can repeat the three-target trial to earn the mandatory missile.
await harness.goToScene('RescueBase');await harness.stepFrames(4);
const defeatTrial=async()=>{
  for(const target of [...harness.getObjects('TrialDrone')].filter(o=>ov(o,'Active'))){
    spawnImpact(target,{weapon:'Energy',damage:2});await harness.stepFrames(2);
  }
};
await defeatTrial();
harness.assert(v('Coins')===12&&v('TrialCoinsEarned')===12&&v('TrialTargetsDefeated')===3,'first trial pays four coins per target');
harness.setObjectPosition(p().id,5740,504);await harness.stepFrames(2);await tap('e');await tap('Down');await tap('Return');
harness.assert(v('TrialRound')===1&&v('GameMode')==='Playing','missile shop resets the trial without charging coins');
await defeatTrial();
harness.assert(v('Coins')===24&&v('TrialCoinsEarned')===24&&v('TrialRound')===1,'repeatable trial reaches the missile budget from zero');
await tap('e');await tap('Return');
harness.assert(v('HasMissile')&&v('Coins')===4&&v('MissileBought')===1,'earned trial coins purchase the mandatory missile');
await harness.takeScreenshot('Missile relay and repeatable supply trial');
