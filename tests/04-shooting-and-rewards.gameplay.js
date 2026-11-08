const value=n=>harness.getSceneVariable(n).value;
const p=()=>harness.getObjects('Player')[0];
const tap=async key=>{harness.setKeyPressed(key,true);await harness.stepFrames(1);harness.setKeyPressed(key,false);await harness.stepFrames(1);};
await harness.goToScene('TrainingRoom');await harness.stepFrames(4);
harness.setSceneVariable('Stage','Combat');
const enemy=harness.getObjects('Patrol')[0];
harness.setObjectPosition(enemy.id,300,512);harness.setObjectVariable(enemy.id,'MinX',300);harness.setObjectVariable(enemy.id,'MaxX',300);harness.setObjectVariable(enemy.id,'SpawnX',300);
await tap('w');
const aimRuntime=harness.getCurrentRuntimeScene().__rescue;
const aimCandidate={
  player:harness.getObjects('Player')[0],
  origin:aimRuntime.aimOrigin(),
  facing:aimRuntime.facing,
  walls:aimRuntime.walls(),
  targets:aimRuntime.targets().map(o=>({
    name:o.getName(),
    id:harness.getObjectVariable(o.id,'Id').value,
    health:harness.getObjectVariable(o.id,'Health').value,
    x:o.centerX,
    y:o.centerY,
  })),
  aimTarget:value('AimTarget'),
};
harness.assert(value('AimTarget')==='patrol','aim selects a living enemy in front '+JSON.stringify(aimCandidate));
await harness.stepFrames(21);
harness.assert(harness.getObjectVariable('Patrol','Health').value===1&&value('Hits')===1,'one base bullet deals exactly one damage once');
await tap('w');await harness.stepFrames(23);
harness.assert(harness.getObjects('Patrol').length===0&&value('EnemiesDefeated')===1,'second base hit defeats patrol');
harness.assert(harness.getObjects('Coin').filter(o=>o.variables.some(v=>v.name==='Reward'&&v.value===true)).length===3,'enemy spawns exactly three fixed reward coins');
harness.setKeyPressed('Right',true);await harness.stepFrames(60);harness.releaseAllInputs();
// The step lies in the approach: use a jump to reach the actual reward positions.
await tap('Space');harness.setKeyPressed('Right',true);await harness.stepFrames(30);harness.releaseAllInputs();await harness.stepFrames(60);
harness.assert(value('EnemiesDefeated')===1,'deleted enemy cannot award another defeat');
harness.assert(harness.getObjects('Coin').filter(o=>o.variables.some(v=>v.name==='Reward'&&v.value===true)).length<=3,'reward objects are never duplicated');

await harness.goToScene('TrainingRoom');await harness.stepFrames(4);
// Arrange a target before the tutorial wall to test actual bullets independently of progression.
harness.setObjectPosition(harness.getObjects('Dummy')[0].id,380,480);
harness.setSceneVariable('Stage','Compare');harness.setSceneVariable('UpgradePurchased',true);harness.setSceneVariable('WeaponForm','Upgrade');
await tap('w');await harness.stepFrames(28);
harness.assert(harness.getObjectVariable('Dummy','Health').value===2&&value('DummyHits')===1,'upgraded bullet deals two damage');
await tap('w');await harness.stepFrames(28);
harness.assert(value('DummyHealth')===0&&value('DummyDestroyed')&&value('DummyHits')===2,'two upgrade hits destroy four-health dummy');
harness.assert(value('Coins')===0&&value('EnemiesDefeated')===0,'training target awards no money or enemy defeat');
await harness.stepFrames(20);harness.assert(value('DummyHits')===2,'a destroyed target cannot take repeated damage');

await harness.goToScene('TrainingRoom');await harness.stepFrames(4);
const dummy=harness.getObjects('Dummy')[0];harness.setObjectPosition(dummy.id,380,480);
const wall=harness.spawn('Wall',250,464,undefined,'Gameplay');
await tap('w');harness.assert(value('AimTarget')==='','wall prevents assisted targeting');
await harness.stepFrames(65);
harness.assert(harness.getObjectVariable('Dummy','Health').value===4,'real projectiles do not pass through wall');
harness.assert(harness.getObjects('Bullet').length===0,'wall hit destroys bullet');
harness.removeObject(wall.id);harness.setObjectPosition(dummy.id,20,480);await harness.stepFrames(2);await tap('w');
harness.assert(value('AimTarget')==='','enemy behind player is not auto-targeted');
const bullet=harness.getObjects('Bullet')[0];
harness.assert(harness.getObjectVariable(bullet.id,'Vx').value===720&&harness.getObjectVariable(bullet.id,'Vy').value===0,'no target gives a horizontal non-homing shot');
await harness.stepFrames(70);harness.assert(harness.getObjects('Bullet').length===0,'bullets expire at their range limit');
