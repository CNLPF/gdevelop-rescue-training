// Shared enemy AI and the controlled reinforcement generator. The fixtures use
// real scene objects and the production AI event, not a test-only movement path.
const enemyTypes=['Patrol','Shield','Turret','ScoutDrone','ArmoredDrone'];
const v=name=>harness.getSceneVariable(name).value;
const p=()=>harness.getObjects('Player')[0];
const ov=(object,name)=>harness.getObjectVariable(object.id,name).value;
const dynamicEnemies=()=>enemyTypes
  .flatMap(type=>harness.getObjects(type).map(object=>({object,type})))
  .filter(({object})=>ov(object,'Dynamic'));
const clearVisibleGuides=()=>{
  for(const type of ['AimLine','TurretWarning','BombMarker']){
    harness.assert(!harness.getObjects(type).length,`${type} is not present on the gameplay path`);
  }
};

async function freshRescue(playerX=1300,playerY=504){
  await harness.goToScene('RescueBase');
  await harness.stepFrames(4);
  harness.setSceneVariable('ReinforcementsEnabled',false);
  for(const type of enemyTypes){
    for(const enemy of [...harness.getObjects(type)])harness.removeObject(enemy.id);
  }
  harness.setObjectPosition(p().id,playerX,playerY);
  await harness.stepFrames(2);
  return harness.getCurrentRuntimeScene().__rescue;
}

async function spawnControlledEnemy(type,{
  x=1000,y=type==='ScoutDrone'||type==='ArmoredDrone'?300:512,
  min=x,max=x+300,dropY=520,sequence=900,
}={}){
  const runtime=harness.getCurrentRuntimeScene().__rescue;
  const site={
    key:`fixture-${type}-${sequence}`,zone:'Corridor',type,x,y,min,max,dropY,
    hoverY:y,
  };
  harness.assert(runtime.spawnReinforcement(site,sequence),`${type} fixture spawns through the shared reinforcement entry point`);
  await harness.stepFrames(2);
  return harness.getObjects(type).find(object=>ov(object,'Id')===`reinforce-${sequence}`);
}

// Deterministic seeds prove that every authored enemy type can be selected by
// the real random reinforcement generator. These seeds are classroom fixtures,
// while a normal run uses a generated scene seed.
const generationCases=[
  {type:'Patrol',seed:0,zoneX:1200},
  {type:'ScoutDrone',seed:1,zoneX:1200},
  {type:'Turret',seed:2,zoneX:1200},
  {type:'Shield',seed:16,zoneX:1200},
  {type:'ArmoredDrone',seed:2,zoneX:3100},
];
for(const fixture of generationCases){
  await harness.goToScene('RescueBase');
  await harness.stepFrames(4);
  harness.setSceneVariable('ReinforcementsEnabled',true);
  harness.setSceneVariable('ReinforcementSeed',fixture.seed);
  harness.setSceneVariable('ReinforcementSequence',0);
  harness.setSceneVariable('ReinforcementTimer',0);
  harness.setObjectPosition(p().id,fixture.zoneX,504);
  await harness.stepFrames(2);
  const spawned=dynamicEnemies();
  harness.assert(
    spawned.length===1&&spawned[0].type===fixture.type&&v('ReinforcementsSpawned')===1,
    `the controlled random generator can spawn ${fixture.type}`,
  );
}

// The RescueBase generator stops at three active enemies, never spawns in a
// recovery zone, and a later-safe spawn cannot collide with an occupied site.
await harness.goToScene('RescueBase');
await harness.stepFrames(4);
harness.setSceneVariable('ReinforcementsEnabled',true);
harness.setSceneVariable('ReinforcementSeed',12345);
harness.setSceneVariable('ReinforcementSequence',0);
harness.setObjectPosition(p().id,4200,504);
for(let expected=1;expected<=3;expected+=1){
  harness.setSceneVariable('ReinforcementTimer',0);
  await harness.stepFrames(2);
  harness.assert(dynamicEnemies().length===expected,`random reinforcements fill slot ${expected} of three`);
}
for(const {object} of dynamicEnemies())harness.setObjectVariable(object.id,'Cooldown',999);
harness.setSceneVariable('ReinforcementTimer',0);
await harness.stepFrames(90);
harness.assert(dynamicEnemies().length===3,'the active reinforcement cap cannot exceed three');
for(const {object} of dynamicEnemies())harness.removeObject(object.id);
harness.setObjectPosition(p().id,2500,504);
harness.setSceneVariable('ReinforcementTimer',0);
await harness.stepFrames(20);
harness.assert(v('ReinforcementsSpawned')===3,'safe recovery zones never create random reinforcements');

// Runtime reinforcements remain non-farmable and only use their own ledger.
await harness.goToScene('RescueBase');
await harness.stepFrames(4);
harness.setSceneVariable('ReinforcementsEnabled',true);
harness.setSceneVariable('ReinforcementSeed',9876);
harness.setSceneVariable('ReinforcementSequence',0);
harness.setSceneVariable('ReinforcementTimer',0);
harness.setObjectPosition(p().id,1200,504);
await harness.stepFrames(2);
const rewardEnemy=dynamicEnemies()[0]?.object;
harness.assert(rewardEnemy,'a runtime enemy exists for the no-farm fixture');
const coinsBefore=harness.getObjects('Coin').length;
const impact=harness.spawn('Bullet',rewardEnemy.centerX-5,rewardEnemy.centerY-5,undefined,'Gameplay');
for(const [key,value]of Object.entries({Vx:0,Vy:0,Damage:99,Range:600}))harness.setObjectVariable(impact.id,key,value);
const rewardRuntime=harness.getCurrentRuntimeScene().__rescue;
const liveRewardEnemy=rewardRuntime.objects(rewardEnemy.name)
  .find(object=>object.getVariables().get('Id').getAsString()===ov(rewardEnemy,'Id'));
const liveImpact=rewardRuntime.objects('Bullet')
  .find(object=>object.id===impact.id);
harness.assert(liveRewardEnemy&&liveImpact,'runtime reward fixture resolves live engine objects');
rewardRuntime.damageTarget(liveRewardEnemy,liveImpact,liveRewardEnemy.getX());
liveImpact.deleteFromScene();
await harness.stepFrames(1);
harness.assert(v('ReinforcementsDefeated')===1,'runtime reinforcement defeat uses its own counter');
harness.assert(harness.getObjects('Coin').length===coinsBefore,'runtime reinforcements never create farmable coins');

// Every enemy type closes distance and then attacks. No type creates an aiming
// guide.
const movementFixtures=[
  {type:'Patrol',x:1000,y:512,playerX:1300,playerY:504},
  // Start outside the turret's 280px firing distance so this fixture proves
  // pursuit rather than accidentally beginning at its stop-and-fire boundary.
  {type:'Turret',x:1000,y:504,playerX:1400,playerY:504},
  {type:'Shield',x:1000,y:512,playerX:1300,playerY:504},
  {type:'ScoutDrone',x:1000,y:300,playerX:1300,playerY:504},
  // A clear entry corridor isolates vertical chase and bombardment from the
  // raised platforms used as cover elsewhere in the authored room.
  {type:'ArmoredDrone',x:1000,y:260,playerX:1400,playerY:420},
];
for(const fixture of movementFixtures){
  await freshRescue(fixture.playerX,fixture.playerY);
  const enemy=await spawnControlledEnemy(fixture.type,{
    x:fixture.x,y:fixture.y,min:Math.min(fixture.x,980),max:1320,
  });
  const counter=`${fixture.type}Attacks`;
  const attacksBefore=v(counter);
  const startX=enemy.x,startY=enemy.y;
  harness.setObjectVariable(enemy.id,'Cooldown',0.14);
  await harness.stepFrames(10);
  const moved=harness.getObjects(fixture.type).find(object=>object.id===enemy.id);
  harness.assert(!!moved,`${fixture.type} remains alive while attacking`);
  if(fixture.type==='ScoutDrone'||fixture.type==='ArmoredDrone'){
    harness.assert(
      moved.x>startX+1&&Math.abs(moved.y-startY)>1,
      `${fixture.type} approaches on both horizontal and vertical axes `+JSON.stringify({
        startX,startY,movedX:moved.x,movedY:moved.y,playerX:p().x,playerY:p().y,
      }),
    );
  }else{
    harness.assert(
      moved.x>startX+1,
      `${fixture.type} actively approaches the player `+JSON.stringify({
        startX,movedX:moved.x,playerX:p().x,
        minX:ov(enemy,'MinX'),maxX:ov(enemy,'MaxX'),zone:ov(enemy,'Zone'),
      }),
    );
  }
  await harness.stepUntil(()=>v(counter)>attacksBefore,{maxFrames:90});
  const liveAfterAttack=harness.getObjects(fixture.type).find(object=>object.id===enemy.id);
  harness.assert(v(counter)>attacksBefore,`${fixture.type} actively attacks in its configured range `+JSON.stringify({
    attacks:v(counter),attacksBefore,cooldown:liveAfterAttack?ov(liveAfterAttack,'Cooldown'):null,
    warning:liveAfterAttack?ov(liveAfterAttack,'Warning'):null,
    enemy:liveAfterAttack?{x:liveAfterAttack.x,y:liveAfterAttack.y}:null,
    player:{x:p().x,y:p().y},
  }));
  clearVisibleGuides();
}

// TrainingRoom shares both the generator and the AI. The jump lesson remains
// safe, while the combat lesson uses the same three-slot cap and adds labels.
await harness.goToScene('TrainingRoom');
await harness.stepFrames(4);
harness.setSceneVariable('Stage','Jump');
harness.setSceneVariable('ReinforcementTimer',0);
await harness.stepFrames(90);
harness.assert(v('ReinforcementsSpawned')===0,'the training jump lesson never spawns combat reinforcements');

harness.setSceneVariable('Stage','Combat');
harness.setSceneVariable('ReinforcementSeed',31415);
harness.setSceneVariable('ReinforcementSequence',0);
harness.setSceneVariable('ReinforcementTimer',0);
await harness.stepFrames(2);
harness.assert(dynamicEnemies().length===1&&v('ReinforcementsSpawned')===1,'the training combat stage uses the random generator');
const trainingRuntime=harness.getCurrentRuntimeScene().__rescue;
const firstTrainingEnemy=dynamicEnemies()[0].object;
const firstTrainingId=ov(firstTrainingEnemy,'Id');
const firstLiveTrainingEnemy=trainingRuntime.objects(firstTrainingEnemy.name)
  .find(object=>object.getVariables().get('Id').getAsString()===firstTrainingId);
harness.assert(
  firstLiveTrainingEnemy&&trainingRuntime.aerialLabels.has(firstLiveTrainingEnemy),
  'runtime training reinforcements register their own gameplay label',
);
for(const {object} of dynamicEnemies())harness.setObjectVariable(object.id,'Cooldown',999);
for(let expected=2;expected<=3;expected+=1){
  harness.setSceneVariable('ReinforcementTimer',0);
  await harness.stepFrames(2);
  harness.assert(dynamicEnemies().length===expected,`training reinforcements fill slot ${expected} of three`);
  for(const {object} of dynamicEnemies())harness.setObjectVariable(object.id,'Cooldown',999);
}
harness.setSceneVariable('ReinforcementTimer',0);
await harness.stepFrames(90);
harness.assert(dynamicEnemies().length===3,'the training reinforcement cap cannot exceed three');

await harness.goToScene('TrainingRoom');
harness.assert(
  v('ReinforcementsEnabled')&&v('ReinforcementTimer')===5&&
  v('ReinforcementsSpawned')===0&&v('ReinforcementsDefeated')===0,
  'a new training run restores reinforcement limits, counters and initial delay',
);
harness.setSceneVariable('Stage','Combat');
harness.setSceneVariable('GameMode','Shop');
harness.setSceneVariable('ReinforcementTimer',5);
await harness.stepFrames(60);
harness.assert(v('ReinforcementTimer')===5&&v('ReinforcementsSpawned')===0,'menus freeze training reinforcement creation');

// The same spawn clock and active AI stop while any pause menu is open.
await harness.goToScene('RescueBase');
await harness.stepFrames(4);
harness.setSceneVariable('ReinforcementsEnabled',true);
harness.setSceneVariable('ReinforcementSeed',9876);
harness.setObjectPosition(p().id,1200,504);
harness.setSceneVariable('GameMode','Shop');
harness.setSceneVariable('ReinforcementTimer',5);
await harness.stepFrames(60);
harness.assert(v('ReinforcementTimer')===5,'shop pause freezes the RescueBase reinforcement clock');

// A scout that leaves the viewport during its internal timing phase cannot fire
// a delayed projectile after it has flown away. Random generation and its
// attacks were already exercised above, so this uses an authored encounter to
// keep the stale-shot fixture independent of dynamic-site bounds.
await harness.goToScene('RescueBase');
await harness.stepFrames(4);
const scout=harness.getObjects('ScoutDrone').find(object=>ov(object,'Id')==='sd1');
harness.setObjectPosition(p().id,6100,504);
// Let the follow camera settle before starting attack timing. Otherwise the
// first simulated frame still uses the old camera and safely resets cooldown.
await harness.stepFrames(5);
harness.setObjectPosition(scout.id,5960,520);
for(const [key,value] of Object.entries({MinX:5960,MaxX:5960,HoverY:520,Cooldown:0.1})){
  harness.setObjectVariable(scout.id,key,value);
}
const scoutAttacksBefore=v('ScoutDroneAttacks');
await harness.stepFrames(5);
const liveScout=harness.getObjects('ScoutDrone').find(object=>object.id===scout.id);
harness.assert(ov(scout,'Warning'),'onscreen scout starts its internal attack timing '+JSON.stringify({
  cooldown:liveScout?ov(liveScout,'Cooldown'):null,
  warning:liveScout?ov(liveScout,'Warning'):null,
  scout:liveScout?{x:liveScout.x,y:liveScout.y}:null,
  player:{x:p().x,y:p().y},
  cameraX:harness.getCurrentRuntimeScene().getLayer('Gameplay').getCameraX(),
  mode:v('GameMode'),
}));
harness.setObjectPosition(scout.id,5590,520);
harness.setObjectVariable(scout.id,'MinX',5590);
harness.setObjectVariable(scout.id,'MaxX',5590);
harness.setObjectVariable(scout.id,'HoverY',520);
await harness.stepFrames(2);
harness.assert(!ov(scout,'Warning'),'leaving the viewport immediately cancels attack timing');
await harness.stepFrames(60);
harness.assert(v('ScoutDroneAttacks')===scoutAttacksBefore,'an aircraft cannot emit a late shot after flying away');

await harness.takeScreenshot('Five random enemy types with chase and firing but no aiming guides');
