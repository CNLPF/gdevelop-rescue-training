// TrainingRoom keeps the original five-stage lesson and exposes the V0.3
// aerial layer through the same real input, projectile and ledger paths.
const v=n=>harness.getSceneVariable(n).value;
const ov=(o,n)=>harness.getObjectVariable(o.id,n).value;
const p=()=>harness.getObjects('Player')[0];
const tap=async key=>{
  harness.setKeyPressed(key,true);await harness.stepFrames(1);
  harness.setKeyPressed(key,false);await harness.stepFrames(2);
};
const spawnImpact=(target,{weapon='Energy',damage=1}={})=>{
  const runtime=harness.getCurrentRuntimeScene().__rescue;
  const targetId=target.variables?.find(item=>item.name==='Id')?.value;
  const liveTarget=runtime.objects(target.name).find(object=>
    object.getVariables().has('Id')&&object.getVariables().get('Id').getAsString()===targetId);
  const point=liveTarget?runtime.center(liveTarget):{x:target.centerX,y:target.centerY};
  const bullet=harness.spawn('Bullet',point.x-8,point.y-8,undefined,'Gameplay');
  for(const [key,value]of Object.entries({Vx:360,Vy:0,Distance:0,Range:720,Damage:damage}))harness.setObjectVariable(bullet.id,key,value);
  harness.setObjectVariable(bullet.id,'Weapon',weapon);
  harness.setObjectVariable(bullet.id,'PierceShield',false);
  harness.setObjectVariable(bullet.id,'Locked',false);
  harness.setObjectVariable(bullet.id,'TargetId','');
  return bullet;
};

await harness.goToScene('TrainingRoom');await harness.stepFrames(4);
const schemaProbe=harness.spawn('Bullet',0,0,undefined,'Gameplay');
const probeTargetType=harness.getObjectVariable(schemaProbe.id,'TargetId').type;
const probeLockedType=harness.getObjectVariable(schemaProbe.id,'Locked').type;
harness.assert(probeTargetType==='string'&&probeLockedType==='boolean',
  `training bullet uses shared string/boolean variable schema (target=${probeTargetType}, locked=${probeLockedType})`);
harness.removeObject(schemaProbe.id);
harness.assert(harness.getObjects('ScoutDrone').length===1&&harness.getObjects('ArmoredDrone').length===1,'training exposes both V0.3 flying enemy types');
harness.assert(harness.getObjects('TrialDrone').length===3&&harness.getObjects('CannonCrate').length===1,'training includes the missile crate and all three trial targets');
harness.assert(v('Stage')==='Jump'&&v('CurrentWeapon')==='Energy'&&!v('HasMissile'),'aerial additions do not replace the original teaching stage');

// The crate grants the missile immediately; no online service or real-money
// store is involved in the training-room demonstration.
const crate=harness.getObjects('CannonCrate')[0];
harness.setObjectPosition(p().id,crate.centerX-70,crate.y);
await harness.stepFrames(2);await tap('e');
harness.assert(v('HasMissile')&&v('CurrentWeapon')==='Missile'&&v('MissileBought')===1,'training missile crate grants and equips the missile through E');

// A held W completes a real target lock and releasing W creates the configured
// missile projectile. The original Patrol/Turret/Dummy teaching objects remain.
harness.releaseAllInputs();
harness.setSceneVariable('Stage','Combat');
harness.setSceneVariable('GameMode','Playing');
harness.setObjectPosition(p().id,980,504);
harness.setKeyPressed('Right',true);await harness.stepFrames(1);harness.setKeyPressed('Right',false);
harness.setObjectPosition(p().id,980,504);
const scout=harness.getObjects('ScoutDrone')[0];
for(const [key,value]of Object.entries({MinX:1100,MaxX:1100,HoverY:360,Health:3}))harness.setObjectVariable(scout.id,key,value);
harness.setObjectPosition(scout.id,1100,360);
// Isolate the lock fixture from the other valid teaching targets. Shared
// weighted targeting intentionally chooses the best visible candidate, so
// this test must provide only the drone as a candidate before pressing W.
for(const type of ['Patrol','Turret','Dummy','ArmoredDrone','TrialDrone']){
  for(const object of harness.getObjects(type)){
    if(object.id!==scout.id)harness.setObjectVariable(object.id,'Health',0);
  }
}
await harness.stepFrames(3);
const lockRuntime=harness.getCurrentRuntimeScene().__rescue;
harness.assert(lockRuntime.aimTargetId==='training-sd1','training lock fixture exposes only the scout drone to shared targeting');
harness.setKeyPressed('w',true);await harness.stepFrames(40);
harness.assert(v('MissileTargetId')==='training-sd1'&&v('MissileLockProgress')>=0.55,'training W input completes a visible missile lock');
harness.setKeyPressed('w',false);await harness.stepFrames(1);
const guided=harness.getObjects('Bullet').find(o=>ov(o,'Weapon')==='Missile'&&ov(o,'Locked'));
harness.assert(!!guided&&ov(guided,'TargetId')==='training-sd1'&&ov(guided,'Damage')===3,
  'training release creates one locked missile with its stable target ID and configured damage');
harness.releaseAllInputs();

// Unified training damage and reward ledgers apply to the new enemy type.
for(const bullet of [...harness.getObjects('Bullet')])harness.removeObject(bullet.id);
harness.setObjectVariable(scout.id,'Health',3);
const rewardCoinsBefore=v('RewardCoinsCollected');
const trainingImpact=spawnImpact(scout,{weapon:'Energy',damage:3});await harness.stepFrames(2);
const liveScout=harness.getObjects('ScoutDrone').find(o=>o.id===scout.id);
const liveImpact=harness.getObjects('Bullet').find(o=>o.id===trainingImpact.id);
harness.assert(
  !liveScout&&v('ScoutDroneDefeated')===1,
  `training drone damage advances the real aerial defeat ledger once (scoutHealth=${liveScout?ov(liveScout,'Health'):'removed'}, defeated=${v('ScoutDroneDefeated')}, bullet=${liveImpact?'still flying':'removed'})`
);
const rewardDrops=harness.getObjects('Coin').filter(o=>ov(o,'Reward'));
harness.assert(
  rewardDrops.length+v('RewardCoinsCollected')-rewardCoinsBefore===3,
  `a defeated training drone accounts for exactly three reward coins (remaining=${rewardDrops.length}, rewardCollected=${v('RewardCoinsCollected')-rewardCoinsBefore})`
);
for(const coin of rewardDrops){harness.setObjectPosition(p().id,coin.x,coin.y);await harness.stepFrames(1);}
harness.assert(
  v('RewardCoinsCollected')-rewardCoinsBefore===3,
  `collecting the training drone rewards adds exactly three tracked reward coins (reward=${v('RewardCoinsCollected')-rewardCoinsBefore}, remaining=${harness.getObjects('Coin').filter(o=>ov(o,'Reward')).length})`
);
await harness.stepFrames(8);
harness.assert(v('RewardCoinsCollected')-rewardCoinsBefore===3&&v('ScoutDroneDefeated')===1,'the same training drone cannot award twice');

// A paused shop prevents aerial attacks while preserving the training lesson.
await harness.goToScene('TrainingRoom');await harness.stepFrames(4);
harness.setSceneVariable('Stage','Combat');
harness.setObjectPosition(p().id,980,504);
harness.setSceneVariable('GameMode','Shop');await harness.stepFrames(90);
harness.assert(v('ScoutDroneAttacks')===0&&v('ArmoredDroneAttacks')===0,'training flying enemies do not attack while the shop pauses the world');

await harness.goToScene('TrainingRoom');await harness.stepFrames(4);
harness.assert(harness.getObjects('ScoutDrone').length===1&&harness.getObjects('ArmoredDrone').length===1&&harness.getObjects('TrialDrone').length===3,'a new training run restores all V0.3 encounters and trials');
await harness.takeScreenshot('Training room with V0.3 aerial systems');
