// Shared weighted targeting: all owned weapons select one visible target,
// prefer horizontal targets, retain that target through small score changes,
// and clear transient lock state when combat is interrupted.
const v=n=>harness.getSceneVariable(n).value;
const ov=(o,n)=>harness.getObjectVariable(o.id,n).value;
const p=()=>harness.getObjects('Player')[0];
const one=n=>harness.getObjects(n)[0];
const tap=async key=>{
  harness.setKeyPressed(key,true);await harness.stepFrames(1);
  harness.setKeyPressed(key,false);await harness.stepFrames(1);
};
const setCenter=(o,x,y)=>harness.setObjectPosition(o.id,x-o.width/2,y-Math.min(10,Math.max(6,o.height*0.25)));

await harness.goToScene('RescueBase');await harness.stepFrames(4);
// Keep the ground collision floor, but isolate target selection from authored
// platforms whose cover is covered by the dedicated occlusion rules.
for(const terrain of [...harness.getObjects('Terrain')])if(terrain.y<560)harness.removeObject(terrain.id);
for(const type of ['Patrol','Turret','Shield','ScoutDrone','ArmoredDrone','JammerCore','TrialDrone']){
  for(const object of [...harness.getObjects(type)])harness.removeObject(object.id);
}

let runtime=harness.getCurrentRuntimeScene().__rescue;
for(const dummy of [...harness.getObjects('Dummy')])harness.removeObject(dummy.id);
const horizontal=harness.spawn('Dummy',1240,520,undefined,'Gameplay');
const overhead=harness.spawn('Dummy',1260,400,undefined,'Gameplay');
harness.setObjectVariable(horizontal.id,'Id','horizontal-fixture');
harness.setObjectVariable(overhead.id,'Id','overhead-fixture');
harness.setObjectVariable(horizontal.id,'Health',100);
harness.setObjectVariable(overhead.id,'Health',100);
const horizontalId=ov(horizontal,'Id'),overheadId=ov(overhead,'Id');
harness.setObjectPosition(p().id,1200,504);
harness.setSceneVariable('GameMode','Playing');
harness.setSceneVariable('HasCannon',true);
harness.setSceneVariable('HasMissile',true);

const aimOrigin=()=>{
  runtime=harness.getCurrentRuntimeScene().__rescue;
  return {
    x:p().x+(runtime.facing>0?42:-2),
    y:p().y+29,
  };
};

for(const weapon of ['Energy','Cannon','Missile']){
  const origin=aimOrigin();
  setCenter(horizontal,origin.x+180,origin.y);
  setCenter(overhead,origin.x+120,origin.y-120);
  harness.setSceneVariable('CurrentWeapon',weapon);
  await harness.stepFrames(3);
  const reticle=one('MissileReticle');
  harness.assert(
    runtime.aimTargetId===horizontalId,
    weapon+' chooses the better horizontal target (selected='+runtime.aimTargetId+', horizontal='+horizontalId+', overhead='+overheadId+')'
  );
  const liveReticle=runtime.missileReticle;
  harness.assert(
    reticle&&!reticle.hidden&&liveReticle&&!liveReticle.isHidden(),
    weapon+' shows one visible shared reticle (harness='+(reticle&&!reticle.hidden)+', runtime='+(liveReticle&&!liveReticle.isHidden())+')'
  );
  const liveTarget=runtime.targets().find(o=>runtime.ov(o,'Id').getAsString()===horizontalId);
  const livePoint=liveTarget&&{
    x:liveTarget.getX()+liveTarget.getWidth()/2,
    y:liveTarget.getY()+Math.min(10,Math.max(6,liveTarget.getHeight()*0.25)),
  };
  const currentHorizontal=harness.getObjects('Dummy').find(o=>ov(o,'Id')===horizontalId);
  const currentPoint=currentHorizontal&&{
    x:currentHorizontal.x+currentHorizontal.width/2,
    y:currentHorizontal.y+Math.min(10,Math.max(6,currentHorizontal.height*0.25)),
  };
  harness.assert(
    currentPoint&&Math.abs(reticle.centerX-currentPoint.x)<8&&Math.abs(reticle.centerY-currentPoint.y)<8&&
      livePoint&&Math.abs(reticle.centerX-livePoint.x)<8&&Math.abs(reticle.centerY-livePoint.y)<8,
    weapon+' centers the reticle on the shared upper-body target (reticle='+reticle.centerX+','+reticle.centerY+
      ', harness='+(currentPoint?currentPoint.x+','+currentPoint.y:'missing')+
      ', runtime='+(livePoint?livePoint.x+','+livePoint.y:'missing')+')'
  );
}

// The current target only changes after a clearly better candidate appears.
let origin=aimOrigin();
setCenter(horizontal,origin.x+180,origin.y);
setCenter(overhead,origin.x+85,origin.y-60);
harness.setSceneVariable('CurrentWeapon','Missile');
await harness.stepFrames(3);
harness.assert(runtime.aimTargetId===horizontalId,'small weighted-score improvements do not move the sticky reticle');

origin=aimOrigin();
setCenter(overhead,origin.x+20,origin.y-80);
await harness.stepFrames(3);
harness.assert(runtime.aimTargetId===overheadId,'a clearly better vertical target becomes selected '+JSON.stringify({aim:runtime.aimTargetId,horizontal:horizontalId,overhead:overheadId,origin:aimOrigin(),horizontalPoint:{x:horizontal.centerX,y:horizontal.centerY},overheadPoint:{x:overhead.centerX,y:overhead.centerY},blockers:runtime.walls()}));

for(const bullet of [...harness.getObjects('Bullet')])harness.removeObject(bullet.id);
harness.setSceneVariable('CurrentWeapon','Energy');
await harness.stepFrames(2);
await tap('w');
const energyBullet=one('Bullet');
harness.assert(
  (!!energyBullet&&ov(energyBullet,'Vy')<-1)||ov(overhead,'Health')<100,
  'the energy gun fires toward the shared weighted target instead of choosing again ('+JSON.stringify({
    aim:runtime.aimTargetId,weapon:v('CurrentWeapon'),
    horizontal:{x:horizontal.centerX,y:horizontal.centerY,health:ov(horizontal,'Health')},
    overhead:{x:overhead.centerX,y:overhead.centerY,health:ov(overhead,'Health')},
    bullet:energyBullet?{x:energyBullet.centerX,y:energyBullet.centerY,vx:ov(energyBullet,'Vx'),vy:ov(energyBullet,'Vy')}:null,
    origin:aimOrigin(),
  })+')'
);
for(const bullet of [...harness.getObjects('Bullet')])harness.removeObject(bullet.id);

// A completed missile lock belongs to one weapon state. Q cancels it and
// requires a fresh W press, preventing a held input from becoming an accidental shot.
harness.setSceneVariable('CurrentWeapon','Missile');
await harness.stepFrames(3);
harness.setKeyPressed('w',true);await harness.stepFrames(40);
runtime=harness.getCurrentRuntimeScene().__rescue;
harness.assert(
  runtime.charging&&v('MissileTargetId')===overheadId&&v('MissileLockProgress')>0,
  'holding W through the previous shot cooldown starts missile lock without a release'
);
await harness.stepFrames(20);
runtime=harness.getCurrentRuntimeScene().__rescue;
harness.assert(
  v('MissileTargetId')===overheadId&&v('MissileLockProgress')>=0.55,
  'missile lock uses the shared selected target (target='+v('MissileTargetId')+
    ', expected='+overheadId+', aim='+runtime.aimTargetId+
    ', lock='+v('MissileLockProgress')+', charge='+v('Charge')+
    ', charging='+runtime.charging+', cooldown='+runtime.fireCooldown+
    ', fireLocked='+runtime.fireLocked+', held='+runtime.keys.fire+')'
);
const energyShotsBefore=v('EnergyShots');
harness.setKeyPressed('q',true);await harness.stepFrames(1);
harness.setKeyPressed('q',false);
harness.assert(
  v('CurrentWeapon')==='Energy'&&v('Charge')===0&&v('MissileTargetId')===''&&v('MissileLockProgress')===0,
  'Q clears the old missile target and lock progress'
);
await harness.stepFrames(10);
harness.assert(v('EnergyShots')===energyShotsBefore,'held W cannot fire immediately after a weapon switch');
harness.setKeyPressed('w',false);await harness.stepFrames(2);

// Falling is a respawn, not a new run. It must still discard targeting state
// so returning to the spawn cannot resume an old charge or lock.
harness.setObjectPosition(p().id,1050,504);
setCenter(horizontal,1230,533);
setCenter(overhead,1130,433);
harness.setSceneVariable('CurrentWeapon','Missile');
await harness.stepFrames(3);
harness.setKeyPressed('w',true);await harness.stepFrames(20);
const fallTargets=harness.getObjects('Dummy').map(o=>({
  id:ov(o,'Id'),health:ov(o,'Health'),
  x:o.centerX,y:o.centerY,hidden:o.hidden,
}));
harness.assert(
  v('MissileTargetId')!=='',
  'fixture has a live target before falling ('+
    'weapon='+v('CurrentWeapon')+', facing='+harness.getCurrentRuntimeScene().__rescue.facing+
    ', aim='+harness.getCurrentRuntimeScene().__rescue.aimTargetId+
    ', lock='+v('MissileTargetId')+', charging='+harness.getCurrentRuntimeScene().__rescue.charging+
    ', cooldown='+harness.getCurrentRuntimeScene().__rescue.fireCooldown+
    ', player='+p().centerX+','+p().centerY+', dummies='+JSON.stringify(fallTargets)+')'
);
harness.setObjectPosition(p().id,820,740);await harness.stepFrames(1);
harness.assert(v('GameMode')==='Respawning'&&v('MissileTargetId')===''&&v('Charge')===0,'falling clears target-specific charge state');
harness.setKeyPressed('w',false);await harness.stepFrames(35);
runtime=harness.getCurrentRuntimeScene().__rescue;
harness.assert(p().x<100&&runtime.aimTargetId===''&&v('MissileTargetId')==='','returning to spawn clears stale targeting');
harness.assert(one('MissileReticle').hidden,'no target means the reticle is hidden');

// TrainingRoom uses the same policy through its additive aerial adapter.
await harness.goToScene('TrainingRoom');await harness.stepFrames(4);
for(const type of ['Patrol','Turret','Shield','ScoutDrone','ArmoredDrone','JammerCore','TrialDrone']){
  for(const object of [...harness.getObjects(type)])harness.removeObject(object.id);
}
const trainingDummies=harness.getObjects('Dummy');
for(const object of trainingDummies.slice(1))harness.removeObject(object.id);
const trainingTarget=trainingDummies[0];
harness.setSceneVariable('Stage','Combat');
harness.setSceneVariable('GameMode','Playing');
harness.setObjectPosition(p().id,120,504);
// Put the fixture above the low entry step so the test measures target
// selection instead of intentionally triggering the wall-occlusion rule.
setCenter(trainingTarget,330,430);
runtime=harness.getCurrentRuntimeScene().__rescue;
for(const weapon of ['Energy','Cannon','Missile']){
  harness.setSceneVariable('CurrentWeapon',weapon);
  harness.setSceneVariable('HasMissile',true);
  await harness.stepFrames(3);
  runtime=harness.getCurrentRuntimeScene().__rescue;
  const liveTrainingTarget=runtime.targets().find(o=>runtime.ov(o,'Id').getAsString()===ov(trainingTarget,'Id'));
  const liveTrainingPoint=liveTrainingTarget&&runtime.center(liveTrainingTarget);
  const trainingOrigin={x:p().x+42,y:p().y+29};
  const trainingBlockers=liveTrainingPoint?runtime.walls().filter(w=>runtime.Rules.segmentRect(
    trainingOrigin.x,trainingOrigin.y,liveTrainingPoint.x,liveTrainingPoint.y,w
  )!==null):[];
  harness.assert(
    runtime.aimTargetId===ov(trainingTarget,'Id'),
    'training room shares '+weapon+' target selection (selected='+runtime.aimTargetId+
      ', expected='+ov(trainingTarget,'Id')+', targetHealth='+ov(trainingTarget,'Health')+
      ', player='+p().centerX+','+p().centerY+', target='+
      (liveTrainingPoint?liveTrainingPoint.x+','+liveTrainingPoint.y:'missing')+
      ', origin='+trainingOrigin.x+','+trainingOrigin.y+', facing='+runtime.facing+
      ', blockers='+trainingBlockers.length+')'
  );
}
await harness.takeScreenshot('Shared weighted targeting in both scenes');
