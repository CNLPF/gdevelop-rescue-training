// Explicit fixtures isolate attack timing, cover and input cancellation boundaries.
await harness.goToScene('RescueBase');await harness.stepFrames(4);
const v=n=>harness.getSceneVariable(n).value;
const p=()=>harness.getObjects('Player')[0];
const ov=(o,n)=>harness.getObjectVariable(o.id,n).value;
const tap=async key=>{harness.setKeyPressed(key,true);await harness.stepFrames(1);harness.setKeyPressed(key,false);await harness.stepFrames(1);};
const turret=harness.getObjects('Turret').find(o=>ov(o,'Id')==='t1');
harness.setObjectPosition(p().id,1550,504);harness.setObjectVariable(turret.id,'Cooldown',0.1);await harness.stepFrames(5);
harness.assert(!ov(turret,'Warning')&&v('EnemyShots')===0,'out-of-range turret cannot attack');
harness.setObjectPosition(p().id,1800,504);harness.setObjectVariable(turret.id,'Cooldown',0.1);await harness.stepFrames(5);
harness.assert(!ov(turret,'Warning')&&v('EnemyShots')===0,'nearby wall blocks attack timing and fire');
harness.setObjectPosition(p().id,1950,504);await harness.stepFrames(3);harness.setObjectVariable(turret.id,'Cooldown',0.76);await harness.stepFrames(5);
harness.assert(
  ov(turret,'Warning')&&v('EnemyShots')===0,
  'clear line of sight starts attack timing before firing '+JSON.stringify({
    warning:ov(turret,'Warning'),cooldown:ov(turret,'Cooldown'),mode:v('GameMode'),
    player:{x:p().x,y:p().y},turret:{x:turret.x,y:turret.y},
  }),
);
harness.assert(
  !harness.getObjects('AimLine').length&&
  !harness.getObjects('TurretWarning').length&&
  !harness.getObjects('BombMarker').length,
  'enemy attack timing has no visible aiming guide',
);
await harness.stepFrames(40);harness.assert(v('EnemyShots')===0,'attack timing lasts before the projectile');
await harness.stepFrames(7);
const enemyShot=harness.getObjects('EnemyBullet')[0];
harness.assert(v('EnemyShots')===1&&!!enemyShot,'attack timing ends in one genuine projectile');
await harness.stepFrames(5);
harness.assert(v('EnemyShots')===1,'one turret attack cycle can only produce one projectile');
const vx=ov(enemyShot,'Vx'),vy=ov(enemyShot,'Vy');
harness.assert(Math.abs(Math.hypot(vx,vy)-270)<0.01,'turret bullet uses configured speed');
harness.setObjectPosition(p().id,1950,380);await harness.stepFrames(2);
harness.assert(ov(enemyShot,'Vx')===vx&&ov(enemyShot,'Vy')===vy,'projectile direction stays fixed after player moves');

// The authored zone tempo must change attack frequency without changing the
// fixed-duration timing phase that starts before each shot.
harness.setObjectPosition(p().id,1950,504);
for(const shot of [...harness.getObjects('EnemyBullet')])harness.removeObject(shot.id);
const shotsBeforeTempo=v('EnemyShots');
harness.setObjectVariable(turret.id,'Tempo',1);
harness.setObjectVariable(turret.id,'Cooldown',0.01);
await harness.stepFrames(1);
const normalCooldown=ov(turret,'Cooldown');
harness.assert(v('EnemyShots')===shotsBeforeTempo+1,'tempo fixture fires once');
harness.assert(Math.abs(normalCooldown-2.2)<0.05,'tempo one uses the base turret period');
for(const shot of [...harness.getObjects('EnemyBullet')])harness.removeObject(shot.id);
harness.setObjectVariable(turret.id,'Tempo',0.8);
harness.setObjectVariable(turret.id,'Cooldown',0.01);
await harness.stepFrames(1);
const fastCooldown=ov(turret,'Cooldown');
harness.assert(v('EnemyShots')===shotsBeforeTempo+2,'faster tempo still fires exactly once');
harness.assert(Math.abs(fastCooldown-2.2*0.8)<0.05,'tempo 0.8 shortens the next turret cycle');
harness.assert(fastCooldown<normalCooldown,'higher pressure tempo advances attacks sooner');
// A swept projectile must not cross a thin wall, even when its next step crosses it.
const shot=harness.spawn('Bullet',1848,500,undefined,'Gameplay');
for(const [k,x]of Object.entries({Vx:720,Vy:0,Damage:1,Range:600}))harness.setObjectVariable(shot.id,k,x);
await harness.stepFrames(2);harness.assert(!harness.getObjects('Bullet').some(o=>o.id===shot.id),'bullet is consumed on wall impact');
const ranged=harness.spawn('Bullet',100,200,undefined,'Gameplay');
for(const [k,x]of Object.entries({Vx:720,Vy:0,Range:600}))harness.setObjectVariable(ranged.id,k,x);
await harness.stepFrames(51);harness.assert(!harness.getObjects('Bullet').some(o=>o.id===ranged.id),'unobstructed bullet expires at range');
// Start a real charge near a shop, then enter a modal while W stays held.
harness.setObjectPosition(p().id,2350,504);harness.setSceneVariable('HasCannon',true);harness.setSceneVariable('CurrentWeapon','Cannon');
await harness.stepFrames(3);harness.setKeyPressed('w',true);await harness.stepFrames(20);
harness.assert(v('Charge')>0,'charging begins before menu');
harness.setKeyPressed('Right',true);
await tap('e');harness.assert(v('GameMode')==='Shop'&&v('Charge')===0,'shop opening cancels charge');
const pausedPatrol=harness.getObjects('Patrol')[0];
const pausedDrone=harness.getObjects('ScoutDrone').find(o=>ov(o,'Id')==='sd1');
const pausedShot=harness.spawn('EnemyBullet',1850,300,undefined,'Gameplay');
for(const [key,value]of Object.entries({Vx:120,Vy:0,Range:700,Distance:0}))harness.setObjectVariable(pausedShot.id,key,value);
harness.setObjectVariable(pausedShot.id,'Weapon','Turret');
harness.setObjectVariable(turret.id,'Cooldown',0.43);
harness.setObjectVariable(turret.id,'Warning',true);
const pausedBefore={
  playerX:p().x,patrolX:pausedPatrol.x,droneX:pausedDrone.x,droneY:pausedDrone.y,
  warning:ov(turret,'Warning'),cooldown:ov(turret,'Cooldown'),
  shotX:pausedShot.x,shotY:pausedShot.y,enemyShots:v('EnemyShots'),
};
const fired=v('ShotsFired');await harness.stepFrames(60);
const pausedAfter={
  playerX:p().x,
  patrolX:harness.getObjects('Patrol').find(o=>o.id===pausedPatrol.id)?.x,
  droneX:harness.getObjects('ScoutDrone').find(o=>o.id===pausedDrone.id)?.x,
  droneY:harness.getObjects('ScoutDrone').find(o=>o.id===pausedDrone.id)?.y,
  warning:ov(turret,'Warning'),cooldown:ov(turret,'Cooldown'),
  shotX:harness.getObjects('EnemyBullet').find(o=>o.id===pausedShot.id)?.x,
  shotY:harness.getObjects('EnemyBullet').find(o=>o.id===pausedShot.id)?.y,
  enemyShots:v('EnemyShots'),
};
harness.assert(pausedAfter.playerX===pausedBefore.playerX,'shop freezes player movement');
harness.assert(pausedAfter.patrolX===pausedBefore.patrolX,'shop freezes ground enemy movement');
harness.assert(pausedAfter.droneX===pausedBefore.droneX&&pausedAfter.droneY===pausedBefore.droneY,'shop freezes flying enemy movement');
harness.assert(pausedAfter.warning===pausedBefore.warning&&pausedAfter.cooldown===pausedBefore.cooldown,'shop freezes attack timing and cooldown');
harness.assert(pausedAfter.shotX===pausedBefore.shotX&&pausedAfter.shotY===pausedBefore.shotY,'shop freezes hostile projectile position');
harness.assert(pausedAfter.enemyShots===pausedBefore.enemyShots,'shop cannot create an enemy attack');
harness.setKeyPressed('Right',false);
await tap('Escape');await harness.stepFrames(50);
harness.assert(v('ShotsFired')===fired&&v('Charge')===0,'held W cannot charge or fire after menu');
harness.setKeyPressed('w',false);await harness.stepFrames(2);await tap('w');
harness.assert(v('ShotsFired')===fired+1,'fresh W press and release fires again');
await harness.takeScreenshot('Turret attack timing without guides and shop charge cancellation');

// Flying enemies obey the same viewport boundary and use an internal timing
// phase before exactly one attack. No visible warning guide is created.
await harness.goToScene('RescueBase');await harness.stepFrames(4);
const scout=harness.getObjects('ScoutDrone').find(o=>ov(o,'Id')==='sd1');
harness.setObjectPosition(p().id,6100,504);
harness.setObjectPosition(scout.id,5590,520);
for(const [key,value]of Object.entries({MinX:5590,MaxX:5590,HoverY:520,Cooldown:0.1}))harness.setObjectVariable(scout.id,key,value);
await harness.stepFrames(5);
harness.assert(!ov(scout,'Warning')&&v('ScoutDroneAttacks')===0,'scout drone outside the viewport cannot begin attack timing');
harness.setObjectPosition(scout.id,5960,520);
for(const [key,value]of Object.entries({MinX:5960,MaxX:5960,HoverY:520,Cooldown:0.1}))harness.setObjectVariable(scout.id,key,value);
await harness.stepFrames(5);
harness.assert(ov(scout,'Warning')&&v('ScoutDroneAttacks')===0,'onscreen scout drone enters attack timing before firing');
await harness.stepUntil(()=>v('ScoutDroneAttacks')===1,{maxFrames:60});
const scoutShots=harness.getObjects('EnemyBullet').filter(o=>ov(o,'Weapon')==='ScoutDrone');
harness.assert(v('ScoutDroneAttacks')===1&&scoutShots.length===1,'one scout attack cycle produces exactly one projectile');
await harness.stepFrames(5);
harness.assert(v('ScoutDroneAttacks')===1,'the same attack cycle cannot fire twice');
harness.removeObject(scoutShots[0].id);await harness.stepFrames(1);

// The armored drone records one ground target during attack timing and drops
// one bomb, without rendering a visible marker.
const armored=harness.getObjects('ArmoredDrone').find(o=>ov(o,'Id')==='ad1');
harness.setObjectPosition(armored.id,6000,390);
for(const [key,value]of Object.entries({MinX:6000,MaxX:6000,HoverY:390,Cooldown:1}))harness.setObjectVariable(armored.id,key,value);
await harness.stepFrames(10);
const markedX=ov(armored,'AttackX');
harness.assert(ov(armored,'Warning')&&v('ArmoredDroneAttacks')===0,'armored drone starts bomb timing without a visible marker');
harness.setObjectPosition(p().id,6100,504);
const armoredFired=await harness.stepUntil(()=>v('ArmoredDroneAttacks')===1,{maxFrames:80});
const bombs=harness.getObjects('EnemyBullet').filter(o=>ov(o,'Weapon')==='DroneBomb');
harness.assert(armoredFired&&v('ArmoredDroneAttacks')===1&&bombs.length===1,'one armored attack cycle produces one bomb '+JSON.stringify({
  attacks:v('ArmoredDroneAttacks'),bombs:bombs.length,warning:ov(armored,'Warning'),
  cooldown:ov(armored,'Cooldown'),mode:v('GameMode'),
}));
harness.assert(Math.abs(bombs[0].x-(markedX-8))<=1,'bomb uses the position marked before the player moved '+JSON.stringify({
  markedX,bombX:bombs[0].x,attackX:ov(armored,'AttackX'),playerX:p().x,
}));
const healthBefore=v('Health');
harness.setObjectPosition(bombs[0].id,p().centerX-6,p().centerY-6);
await harness.stepFrames(2);
harness.assert(v('Health')===healthBefore-1,'bomb contact applies damage once and removes the bomb');
await harness.takeScreenshot('Flying enemy attack boundaries without guides');
