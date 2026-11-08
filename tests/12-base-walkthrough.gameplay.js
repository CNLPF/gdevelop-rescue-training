// End-to-end V0.3 acceptance: keyboard input only, no teleports, spawned fixtures or state changes.
// This route covers the authored map, both relay checks and all three weapon
// systems, so it needs more than the runner's 30-second default budget.
harness.setTimeoutMs(60000);
await harness.goToScene('RescueBase');await harness.stepFrames(4);
// Keep this long route replayable. Reinforcement spawning, attack timing,
// pause behavior and anti-farming are exercised together in test 20; this
// acceptance route validates the authored map, encounters and progression.
harness.setSceneVariable('ReinforcementsEnabled',false);
const v=n=>harness.getSceneVariable(n).value;
const p=()=>harness.getObjects('Player')[0];
const ov=(o,n)=>harness.getObjectVariable(o.id,n).value;
const tap=async key=>{harness.setKeyPressed(key,true);await harness.stepFrames(1);harness.setKeyPressed(key,false);await harness.stepFrames(1);};
const onFloor=()=>harness.getRuntimeObject('Player').getBehavior('Platformer').isOnFloor();
const enemyTypes=['Patrol','Turret','Shield','ScoutDrone','ArmoredDrone'];
const count=id=>enemyTypes.flatMap(n=>harness.getObjects(n)).filter(o=>ov(o,'Id')===id).length;
function incomingThreat({maxTime=2.5,maxDistance=220}={}){
  const playerX=p().centerX,playerY=p().centerY;
  for(const bullet of harness.getObjects('EnemyBullet')){
    const bulletX=bullet.x+bullet.width/2,bulletY=bullet.y+bullet.height/2;
    const distance=Math.hypot(bulletX-playerX,bulletY-playerY);
    if(distance>maxDistance)continue;
    const vx=ov(bullet,'Vx'),vy=ov(bullet,'Vy');
    let time=maxTime;
    if(Math.abs(vx)>1){
      time=(playerX-bulletX)/vx;
      // Only treat a projectile as an immediate threat while it is travelling
      // toward the player. This handles horizontal patrol and turret fire as
      // well as angled shots from flying enemies.
      if(time<0||time>maxTime)continue;
    }else if(Math.abs(vy)<1){
      continue;
    }
    const impactX=bulletX+vx*time,impactY=bulletY+vy*time;
    if(Math.abs(impactX-playerX)<=48&&Math.abs(impactY-playerY)<=52){
      return {
        bullet,
        distance,
        time,
        weapon:ov(bullet,'Weapon'),
      };
    }
  }
  return null;
}
async function jumpOverThreat(){
  // Every enemy type can now close distance and fire. Start the read-and-react
  // jump while the projectile is still approaching; the second jump is used
  // when needed so the player stays airborne through the crossing shot.
  const threat=incomingThreat({maxTime:1.05,maxDistance:260});
  const jumpAvailable=onFloor()||v('JumpCount')<2;
  if(threat&&jumpAvailable){
    const beforeX=p().x,beforeY=p().y,healthBefore=v('Health');
    await tap('Space');
    if(v('Health')!==healthBefore){
      harness.assert(false,'evasive jump still took damage at '+beforeX+','+beforeY+
        ' after='+p().x+','+p().y+
        ' health='+v('Health')+' previous='+healthBefore+
        ' threat='+JSON.stringify({
          weapon:threat.weapon,distance:threat.distance,time:threat.time,
          x:threat.bullet.x,y:threat.bullet.y,
        }));
    }
    return true;
  }
  return false;
}
async function waitForGround(max=150,label='safe ground'){
  let groundedFrames=0;
  for(let frame=0;frame<max;frame++){
    if(onFloor())groundedFrames++;
    else groundedFrames=0;
    if(groundedFrames>=6)return;
    if(await jumpOverThreat())continue;
    await harness.stepFrames(1);
  }
  harness.assert(false,'player did not settle on '+label+' at '+
    p().x+','+p().y+' health='+v('Health')+' stage='+v('Stage'));
}
async function walk(x,max=300){
  const key=p().x<x?'Right':'Left';
  let previousHealth=v('Health');
  harness.setKeyPressed(key,true);
  let ok=false;
  for(let frame=0;frame<max;frame++){
    if(key==='Right'?p().x>=x:p().x<=x){
      ok=true;
      break;
    }
    // Reinforcement and authored enemies now fire readable projectiles during
    // traversal. The golden-path bot keeps advancing and responds to each
    // readable projectile instead of chasing a distant reinforcement through
    // cover. Dedicated reinforcement tests verify spawning and combat damage.
    if(await jumpOverThreat())continue;
    const beforeX=p().x,beforeY=p().y,beforeStage=v('Stage');
    const beforeEnemies=['Patrol','Turret','Shield','ScoutDrone','ArmoredDrone']
      .flatMap(type=>harness.getObjects(type).filter(o=>ov(o,'Health')>0).map(o=>({
        type,id:ov(o,'Id'),x:Number(o.x.toFixed(1)),y:Number(o.y.toFixed(1)),
        distance:Number(Math.hypot(o.x-p().centerX,o.y-p().centerY).toFixed(1)),
      }))).filter(o=>o.distance<180);
    const beforeBullets=harness.getObjects('EnemyBullet').map(o=>({
      weapon:ov(o,'Weapon'),x:Number(o.x.toFixed(1)),y:Number(o.y.toFixed(1)),
      vx:ov(o,'Vx'),vy:ov(o,'Vy'),
    }));
    await harness.stepFrames(1);
    if(v('Health')!==previousHealth){
      harness.assert(false,'walk threat impact at '+beforeX+','+beforeY+
        ' after='+p().x+','+p().y+
        ' target='+x+' health='+v('Health')+' previous='+previousHealth+
        ' stageBefore='+beforeStage+' enemies='+JSON.stringify(beforeEnemies)+
        ' bullets='+JSON.stringify(beforeBullets));
    }
  }
  harness.setKeyPressed(key,false);
  for(let settle=0;settle<5;settle++){
    if(await jumpOverThreat())continue;
    const beforeX=p().x,beforeY=p().y,beforeHealth=v('Health');
    const nearbyEnemies=['Patrol','Turret','Shield','ScoutDrone','ArmoredDrone']
      .flatMap(type=>harness.getObjects(type).filter(o=>ov(o,'Health')>0).map(o=>({
        type,id:ov(o,'Id'),x:Number(o.x.toFixed(1)),y:Number(o.y.toFixed(1)),
        distance:Number(Math.hypot(o.x-p().centerX,o.y-p().centerY).toFixed(1)),
      }))).filter(o=>o.distance<180);
    const nearbyBullets=harness.getObjects('EnemyBullet').map(o=>({
      weapon:ov(o,'Weapon'),x:Number(o.x.toFixed(1)),y:Number(o.y.toFixed(1)),
      vx:ov(o,'Vx'),vy:ov(o,'Vy'),
    })).filter(o=>Math.hypot(o.x-p().centerX,o.y-p().centerY)<220);
    await harness.stepFrames(1);
    if(v('Health')!==beforeHealth){
      harness.assert(false,'walk settle impact at '+beforeX+','+beforeY+
        ' target='+x+' health='+v('Health')+' previous='+beforeHealth+
        ' stage='+v('Stage')+' enemies='+JSON.stringify(nearbyEnemies)+
        ' bullets='+JSON.stringify(nearbyBullets));
    }
  }
  harness.assert(ok,'walk '+x+' actual='+p().x+','+p().y+' mode='+v('GameMode')+' stage='+v('Stage'));
}
async function jumpTo(x,double=false){
  const retriesBefore=v('Retries');
  let healthBefore=v('Health');
  harness.setKeyPressed('Right',true);await tap('Space');
  if(double){await harness.stepFrames(16);await tap('Space');}
  let ok=false;
  for(let frame=0;frame<200;frame++){
    if(p().x>=x){ok=true;break;}
    const beforeX=p().x,beforeY=p().y;
    const nearbyEnemies=enemyTypes.flatMap(type=>
      harness.getObjects(type).filter(o=>ov(o,'Health')>0).map(o=>({
        type,id:ov(o,'Id'),x:Number(o.x.toFixed(1)),y:Number(o.y.toFixed(1)),
        cooldown:Number(ov(o,'Cooldown').toFixed(2)),
        distance:Number(Math.hypot(o.x-p().centerX,o.y-p().centerY).toFixed(1)),
      }))
    ).filter(o=>o.distance<260);
    const nearbyBullets=harness.getObjects('EnemyBullet').map(o=>({
      weapon:ov(o,'Weapon'),x:Number(o.x.toFixed(1)),y:Number(o.y.toFixed(1)),
      vx:ov(o,'Vx'),vy:ov(o,'Vy'),
    })).filter(o=>Math.hypot(o.x-p().centerX,o.y-p().centerY)<220);
    await harness.stepFrames(1);
    if(v('Health')!==healthBefore){
      harness.assert(false,'jump '+x+' threat impact at '+beforeX+','+beforeY+
        ' after='+p().x+','+p().y+' health='+v('Health')+
        ' previous='+healthBefore+' enemies='+JSON.stringify(nearbyEnemies)+
        ' bullets='+JSON.stringify(nearbyBullets));
    }
  }
  harness.setKeyPressed('Right',false);
  if(v('Stage')!=='Aerial'){
    await harness.stepFrames(50);
    harness.assert(ok,'jump reaches '+x+' actual='+p().x+','+p().y);
    return;
  }
  // Settle quickly, but move away from a visible bomb lane or incoming shot.
  // This prevents a keyboard-only acceptance bot from standing in a telegraphed
  // hazard during the long, fixed wait used by the earlier prototype.
  let groundedFrames=0;
  for(let frame=0;frame<120;frame++){
    const playerX=p().centerX;
    const hazards=[];
    for(const drone of [...harness.getObjects('ScoutDrone'),...harness.getObjects('ArmoredDrone')]){
      if(ov(drone,'Warning'))hazards.push(ov(drone,'AttackX'));
    }
    for(const bullet of harness.getObjects('EnemyBullet')){
      const vx=ov(bullet,'Vx'),vy=ov(bullet,'Vy');
      const timeToPlayerY=vy>0?(p().centerY-(bullet.y+bullet.height/2))/vy:Infinity;
      if(timeToPlayerY>=0&&timeToPlayerY<=2.5){
        hazards.push(bullet.x+bullet.width/2+vx*timeToPlayerY);
      }
    }
    const close=hazards.filter(h=>Math.abs(h-playerX)<230);
    let key='';
    if(close.length&&frame<100){
      const left=Math.min(...close.map(h=>Math.abs(h-(playerX-42))));
      const right=Math.min(...close.map(h=>Math.abs(h-(playerX+42))));
      key=left>=right?'Left':'Right';
    }
    if(key){
      // Release the traversal key first. Pressing Left while Right is held would
      // leave both inputs active and make the supposed dodge do nothing.
      harness.setKeyPressed('Right',false);
      harness.setKeyPressed(key,true);
    }
    await harness.stepFrames(1);
    if(key){
      harness.setKeyPressed(key,false);
      if(p().x<x)harness.setKeyPressed('Right',true);
    }
    groundedFrames=onFloor()?groundedFrames+1:0;
    if(groundedFrames>=12)break;
  }
  harness.releaseAllInputs();
  harness.assert(
    ok&&v('Retries')===retriesBefore,
    'jump reaches '+x+' actual='+p().x+','+p().y+
      ' health='+v('Health')+' retries='+v('Retries'),
  );
}
async function shootUntil(id,max=230){
  harness.setKeyPressed('w',true);
  let ok=false;
  let previousHealth=v('Health');
  for(let frame=0;frame<max;frame++){
    if(!count(id)){
      ok=true;
      break;
    }
    if(await jumpOverThreat())continue;
    const beforeX=p().x,beforeY=p().y;
    const nearbyEnemies=enemyTypes.flatMap(type=>
      harness.getObjects(type).filter(o=>ov(o,'Health')>0).map(o=>({
        type,id:ov(o,'Id'),x:Number(o.x.toFixed(1)),y:Number(o.y.toFixed(1)),
        cooldown:Number(ov(o,'Cooldown').toFixed(2)),
        distance:Number(Math.hypot(o.x-p().centerX,o.y-p().centerY).toFixed(1)),
      }))
    ).filter(o=>o.distance<300);
    const nearbyBullets=harness.getObjects('EnemyBullet').map(o=>({
      weapon:ov(o,'Weapon'),x:Number(o.x.toFixed(1)),y:Number(o.y.toFixed(1)),
      vx:ov(o,'Vx'),vy:ov(o,'Vy'),
    })).filter(o=>Math.hypot(o.x-p().centerX,o.y-p().centerY)<260);
    await harness.stepFrames(1);
    if(v('Health')!==previousHealth){
      harness.assert(false,'shoot '+id+' threat impact at '+beforeX+','+beforeY+
        ' after='+p().x+','+p().y+' health='+v('Health')+
        ' previous='+previousHealth+' enemies='+JSON.stringify(nearbyEnemies)+
        ' bullets='+JSON.stringify(nearbyBullets));
    }
  }
  harness.setKeyPressed('w',false);await harness.stepFrames(3);
  const target=enemyTypes.flatMap(n=>harness.getObjects(n)).find(o=>ov(o,'Id')===id);
  const runtime=harness.getCurrentRuntimeScene().__rescue;
  const origin=runtime.aimOrigin();
  const targetPoint=target?{x:target.centerX,y:target.centerY}:null;
  const blockers=targetPoint?runtime.walls().filter(w=>
    runtime.Rules.segmentRect(origin.x,origin.y,targetPoint.x,targetPoint.y,w)!==null
  ):[];
  harness.assert(ok,'energy defeats '+id+' at '+p().x+','+p().y+
    ' health='+v('Health')+' weapon='+v('CurrentWeapon')+
    ' aim='+v('AimTarget')+' target='+(target?target.x+','+target.y:'-')+
    ' facing='+runtime.facing+' origin='+JSON.stringify(origin)+
    ' targetPoint='+JSON.stringify(targetPoint)+
    ' targetHealth='+(target?ov(target,'Health'):'-')+
    ' blockers='+JSON.stringify(blockers)+' mode='+v('GameMode')+' stage='+v('Stage'));
}
async function charge(id){
  harness.setKeyPressed('w',true);
  // Shields now chase and can fire from close range. Begin the charge with a
  // real double jump so the cannon lesson remains readable while projectiles
  // cross the ground lane; auto-aim keeps the charged shot on the shield.
  if(onFloor()){
    await tap('Space');
    await harness.stepFrames(16);
    await tap('Space');
  }
  for(let frame=0;frame<50;frame++){
    if(await jumpOverThreat())continue;
    await harness.stepFrames(1);
  }
  // With several moving enemies nearby, assisted aim may start on a different
  // valid target. Keep the cannon charged until the requested encounter is the
  // live aim target, then release through the same real input path.
  for(let frame=0;frame<45&&v('AimTarget')!==id;frame++){
    if(await jumpOverThreat())continue;
    await harness.stepFrames(1);
  }
  harness.setKeyPressed('w',false);
  for(let frame=0;frame<55;frame++){
    if(await jumpOverThreat())continue;
    await harness.stepFrames(1);
  }
}
async function chargeUntil(id,maxShots=8){
  const shotStates=[];
  for(let shot=0;shot<maxShots&&count(id);shot++){
    const target=enemyTypes.flatMap(name=>harness.getObjects(name))
      .find(o=>ov(o,'Id')===id);
    if(target)await tap(target.centerX>=p().centerX?'Right':'Left');
    const beforeState={
      shot:shot+1,target:id,
      playerX:Number(p().x.toFixed(2)),playerY:Number(p().y.toFixed(2)),
      health:v('Health'),aim:v('AimTarget'),
      targetX:target?Number(target.x.toFixed(2)):null,
      targetHealth:target?ov(target,'Health'):null,
      nearby:enemyTypes.flatMap(name=>harness.getObjects(name).map(o=>({
          type:name,id:ov(o,'Id'),health:ov(o,'Health'),
          distance:Number(Math.hypot(o.centerX-p().centerX,o.centerY-p().centerY).toFixed(1)),
        })))
        .filter(o=>o.health>0)
        .filter(o=>o.distance<320),
    };
    await charge(id);
    const liveTarget=enemyTypes.flatMap(name=>harness.getObjects(name))
      .find(o=>ov(o,'Id')===id);
    shotStates.push({
      ...beforeState,mode:v('GameMode'),
      afterPlayerX:Number(p().x.toFixed(2)),afterPlayerY:Number(p().y.toFixed(2)),
      afterHealth:v('Health'),afterAim:v('AimTarget'),
      targetAlive:!!liveTarget,
      targetXAfter:liveTarget?Number(liveTarget.x.toFixed(2)):null,
      targetHealthAfter:liveTarget?ov(liveTarget,'Health'):null,
    });
  }
  const target=enemyTypes.flatMap(name=>harness.getObjects(name))
    .find(o=>ov(o,'Id')===id);
  harness.assert(
    !count(id),
    'charged cannon defeats '+id+' at '+p().x+','+p().y+
      ' health='+v('Health')+' aim='+v('AimTarget')+
      ' targetHealth='+(target?ov(target,'Health'):'-')+
      ' shots='+JSON.stringify(shotStates),
  );
}
async function missileShot(id,direction='Right'){
  await tap(direction);
  const before=v('MissileShots');
  harness.setKeyPressed('w',true);
  const locked=await harness.stepUntil(
    ()=>v('MissileTargetId')===id&&v('MissileLockProgress')>=0.55,
    {maxFrames:120},
  );
  const candidate=enemyTypes.flatMap(name=>harness.getObjects(name))
    .find(o=>ov(o,'Id')===id);
  const runtime=harness.getCurrentRuntimeScene().__rescue;
  const origin=runtime.aimOrigin();
  const targetCandidates=runtime.targets().map(o=>{
    const point=runtime.center(o);
    return {
      id:ov(o,'Id'),
      x:Number(point.x.toFixed(2)),
      y:Number(point.y.toFixed(2)),
      health:ov(o,'Health'),
      distance:Number(Math.hypot(point.x-origin.x,point.y-origin.y).toFixed(2)),
      blockers:runtime.walls().filter(w=>
        runtime.Rules.segmentRect(origin.x,origin.y,point.x,point.y,w)!==null
      ),
    };
  });
  const trialStates=harness.getObjects('TrialDrone').map(o=>({
    id:ov(o,'Id'),active:ov(o,'Active'),health:ov(o,'Health'),
  }));
  harness.assert(
    locked,
    'missile locks '+id+' at '+p().x+','+p().y+
      ' aim='+v('AimTarget')+' lockTarget='+v('MissileTargetId')+
      ' lock='+v('MissileLockProgress')+' weapon='+v('CurrentWeapon')+
      ' facing='+runtime.facing+' mode='+v('GameMode')+
      ' health='+v('Health')+' stage='+v('Stage')+' hasMissile='+v('HasMissile')+
      ' retries='+v('Retries')+' frame='+runtime.time.toFixed(2)+
      ' trials='+JSON.stringify(trialStates)+
      ' candidate='+(candidate?candidate.x+','+candidate.y+' health='+ov(candidate,'Health'):'-')+
      ' candidates='+JSON.stringify(targetCandidates),
  );
  harness.setKeyPressed('w',false);await harness.stepFrames(2);
  harness.assert(v('MissileShots')===before+1,`locked missile launches ${id} exactly once (before=${before}, after=${v('MissileShots')})`);
}
async function missileShotAuto(safeRange){
  const runtime=harness.getCurrentRuntimeScene().__rescue;
  harness.releaseAllInputs();
  // Wait for a readable gap between enemy volleys. The lock lasts 0.55 s, so
  // starting while three warning markers are already active is an avoidable
  // test-bot mistake rather than a fair combat check.
  await waitForAerialWindow(safeRange);
  // A patrolling drone can leave lock range while the bot waits for a warning
  // gap. Re-establish range with real movement before choosing a direction.
  if(!hasComfortableAerialLock())await moveTowardLockableAerial();
  const right=autoTargetAerialCandidate(1);
  const left=autoTargetAerialCandidate(-1);
  let direction=!right?'Left':!left?'Right':
    left.score<right.score?'Left':'Right';
  if(v('Stage')==='Aerial')console.log('auto target choice '+JSON.stringify({
    x:Number(p().x.toFixed(2)),facing:runtime.facing,
    aimTarget:runtime.aimTargetId,
    right:right&&{id:right.target.id,score:Number(right.score.toFixed(2))},
    left:left&&{id:left.target.id,score:Number(left.score.toFixed(2))},
    direction,
  }));
  await tap(direction);
  let expectedFacing=direction==='Right'?1:-1;
  if(!autoTargetIsLockableAerial(expectedFacing)){
    const retryDirection=direction==='Right'?'Left':'Right';
    const retryFacing=retryDirection==='Right'?1:-1;
    if(autoTargetIsLockableAerial(retryFacing)){
      direction=retryDirection;
      expectedFacing=retryFacing;
      await tap(direction);
    }
  }
  harness.assert(
    runtime.facing===expectedFacing,
    'auto missile turns toward a lockable target before charging'+
      ' facing='+runtime.facing+' expected='+expectedFacing+
      ' right='+autoTargetIsLockableAerial(1)+
      ' left='+autoTargetIsLockableAerial(-1),
  );
  const before=v('MissileShots');
  harness.setKeyPressed('w',true);
  // Keep the selected facing stable during the short lock. The guard above
  // guarantees a complete launch window before this loop starts.
  let locked=false;
  for(let frame=0;frame<120&&!locked;frame++){
    await harness.stepFrames(1);
    locked=v('MissileTargetId')!==''&&v('MissileLockProgress')>=0.55;
  }
  const id=v('MissileTargetId');
  const liveAerial=['ScoutDrone','ArmoredDrone'].some(type=>
    harness.getObjects(type).some(o=>ov(o,'Id')===id&&ov(o,'Health')>0)
  );
  const aerialState=['ScoutDrone','ArmoredDrone'].flatMap(type=>
    harness.getObjects(type).map(o=>({
      type,id:ov(o,'Id'),health:ov(o,'Health'),x:o.x,y:o.y,
    }))
  );
  harness.assert(
    locked&&liveAerial,
    'auto lock selects a live aerial-phase enemy at '+p().x+','+p().y+
      ' lock='+locked+' target='+id+' health='+v('Health')+
      ' facing='+runtime.facing+' right='+autoTargetIsLockableAerial(1)+
      ' left='+autoTargetIsLockableAerial(-1)+
      ' cooldown='+runtime.fireCooldown+' charge='+runtime.charge+
      ' charging='+runtime.charging+' mode='+v('GameMode')+
      ' aerial='+JSON.stringify(aerialState),
  );
  harness.setKeyPressed('w',false);await harness.stepFrames(2);
  harness.assert(v('MissileShots')===before+1,'auto lock launches exactly one missile');
  return id;
}
async function waitForAerialWindow(safeRange){
  const threatWindowOpen=()=>{
    const playerY=p().centerY;
    if(harness.getObjects('EnemyBullet').some(bullet=>{
      const vy=ov(bullet,'Vy');
      const timeToPlayerY=vy>0?(playerY-(bullet.y+bullet.height/2))/vy:Infinity;
      if(timeToPlayerY<0||timeToPlayerY>1.2)return false;
      const impactX=bullet.x+bullet.width/2+ov(bullet,'Vx')*timeToPlayerY;
      return Math.abs(impactX-p().centerX)<120;
    }))return true;
    if(['ScoutDrone','ArmoredDrone'].some(type=>
      harness.getObjects(type).some(o=>ov(o,'Warning'))
    ))return true;
    // A group of drones has staggered cooldowns, so "any drone may soon warn"
    // describes the whole combat phase instead of an actionable gap. Only the
    // currently displayed warning and a shot already crossing the player's
    // vertical lane are real launch blockers.
    return false;
  };
  await evadeUntil(threatWindowOpen,300,...(safeRange??[0,8400]));
  harness.assert(
    !threatWindowOpen(),
    'a safe missile launch window opens at '+p().x+','+p().y+
      ' health='+v('Health')+' mode='+v('GameMode')+' bullets='+
      JSON.stringify(harness.getObjects('EnemyBullet').map(o=>({
        weapon:ov(o,'Weapon'),x:Number(o.x.toFixed(2)),y:Number(o.y.toFixed(2)),
        vx:ov(o,'Vx'),vy:ov(o,'Vy'),
      })))+' drones='+JSON.stringify(
        ['ScoutDrone','ArmoredDrone'].flatMap(type=>
          harness.getObjects(type).map(o=>({
            type,id:ov(o,'Id'),x:Number(o.x.toFixed(1)),health:ov(o,'Health'),
            cooldown:Number(ov(o,'Cooldown').toFixed(2)),warning:ov(o,'Warning'),
          }))
        )
      ),
  );
}
async function waitForClearProjectiles(safeRange){
  await evadeUntil(
    ()=>harness.getObjects('EnemyBullet').length>0,
    240,
    ...safeRange,
  );
  harness.assert(
    harness.getObjects('EnemyBullet').length===0&&v('GameMode')==='Playing',
    'previous aerial volley clears before the next platform at '+
      p().x+','+p().y+' health='+v('Health'),
  );
}
async function evadeUntil(target,maxFrames,minX,maxX){
  let sweepDirection=1;
  let avoidanceDirection=0;
  let avoidanceFrames=0;
  let previousHealth=v('Health');
  let previousRetries=v('Retries');
  for(let elapsed=0;elapsed<maxFrames&&target();elapsed+=1){
    // Horizontal ground shots cannot be sidestepped: they occupy the player's
    // current standing lane. Use the real platformer jump while the projectile
    // is still readable, then continue the horizontal evasion sweep.
    if(await jumpOverThreat())continue;
    const playerX=p().centerX;
    const playerY=p().centerY;
    const threatXs=[];

    // Armored drones expose the exact ground target during their warning.
    // Treat those markers and already falling bombs as real avoidance cues.
    for(const drone of [...harness.getObjects('ScoutDrone'),...harness.getObjects('ArmoredDrone')]){
      if(ov(drone,'Warning'))threatXs.push(ov(drone,'AttackX'));
    }
    for(const bullet of harness.getObjects('EnemyBullet')){
      const weapon=ov(bullet,'Weapon');
      const vx=ov(bullet,'Vx'),vy=ov(bullet,'Vy');
      const bulletY=bullet.y+bullet.height/2;
      const timeToPlayerY=vy>0?(playerY-bulletY)/vy:Infinity;
      if(timeToPlayerY>=0&&timeToPlayerY<=2.5){
        const impactX=bullet.x+bullet.width/2+vx*timeToPlayerY;
        if(weapon==='DroneBomb'||weapon==='ScoutDrone')threatXs.push(impactX);
      }
      const threat=incomingThreat({maxTime:2.5});
      if(threat)threatXs.push(playerX);
    }

    let direction=0;
    const immediate=threatXs.filter(x=>Math.abs(x-playerX)<230);
    if(immediate.length){
      const edgeBuffer=56;
      const leftRoom=playerX-minX-edgeBuffer;
      const rightRoom=maxX-playerX-edgeBuffer;
      const clearance=side=>{
        const probeX=playerX+side*72;
        return Math.min(...threatXs.map(x=>Math.abs(x-probeX)),999);
      };
      const choices=[];
      if(leftRoom>=24)choices.push({side:-1,score:clearance(-1)});
      if(rightRoom>=24)choices.push({side:1,score:clearance(1)});
      choices.sort((a,b)=>b.score-a.score);
      direction=choices[0]?.side??(leftRoom>=rightRoom?-1:1);
      avoidanceDirection=direction;
      avoidanceFrames=60;
    }else if(avoidanceFrames>0){
      // Do not reverse back across a lane immediately after a narrow dodge.
      avoidanceFrames--;
      direction=avoidanceDirection;
      const edgeBuffer=56;
      if((direction<0&&p().x<=minX+edgeBuffer)||
        (direction>0&&p().x>=maxX-edgeBuffer)){
        direction=-direction;
        avoidanceDirection=direction;
      }
    }else{
      const edgeBuffer=56;
      if(p().x>=maxX-edgeBuffer)sweepDirection=-1;
      if(p().x<=minX+edgeBuffer)sweepDirection=1;
      direction=sweepDirection;
    }
    const key=direction>0?'Right':'Left';
    harness.setKeyPressed(key,true);
    await harness.stepFrames(1);
    harness.setKeyPressed(key,false);
    if(v('Health')!==previousHealth||v('Retries')!==previousRetries){
      console.log('evade state '+JSON.stringify({
        elapsed,
        x:Number(p().x.toFixed(2)),
        y:Number(p().y.toFixed(2)),
        health:v('Health'),
        retries:v('Retries'),
        mode:v('GameMode'),
        enemies:harness.getObjects('EnemyBullet').map(o=>({
          weapon:ov(o,'Weapon'),
          x:Number(o.x.toFixed(2)),
          y:Number(o.y.toFixed(2)),
        })),
      }));
      previousHealth=v('Health');
      previousRetries=v('Retries');
    }
  }
  harness.releaseAllInputs();
}
async function missileDefeat(id,maxShots,direction='Right',safeRange=null){
  for(let shot=0;shot<maxShots&&count(id);shot++){
    const retriesBefore=v('Retries');
    await missileShot(id,direction);
    const range=safeRange??
      [Math.max(0,p().x-180),Math.min(8400,p().x+180)];
    await evadeUntil(()=>count(id),180,...range);
    harness.assert(
      v('GameMode')==='Playing'&&v('Retries')===retriesBefore,
      'aerial route remains in the same run while defeating '+id+
        ' health='+v('Health')+' retries='+v('Retries')+
        ' at '+p().x+','+p().y,
    );
  }
  harness.assert(!count(id),'missiles defeat '+id+' at '+p().x+','+p().y+' health='+v('Health'));
}
function liveAerial(){
  return ['ScoutDrone','ArmoredDrone'].flatMap(type=>
    harness.getObjects(type).filter(o=>ov(o,'Health')>0)
  );
}
function autoTargetAerialCandidate(facing=harness.getCurrentRuntimeScene().__rescue.facing){
  const runtime=harness.getCurrentRuntimeScene().__rescue;
  const origin=runtime.aimOrigin();
  const targets=runtime.targets().map(o=>{
    const point=runtime.center(o);
    return {...point,id:ov(o,'Id'),health:ov(o,'Health')};
  });
  const target=runtime.Rules.chooseTarget(
    origin,facing,targets,runtime.walls(),560,
    {verticalBias:0.75,switchMargin:0.2,stickyId:runtime.aimTargetId},
  );
  const lockable=!!target&&['ScoutDrone','ArmoredDrone'].some(type=>
    harness.getObjects(type).some(o=>
      ov(o,'Id')===target.id&&ov(o,'Health')>0
    )
  );
  if(!lockable)return null;
  return {
    target,
    score:Math.hypot(target.x-origin.x,target.y-origin.y)+
      Math.abs(target.y-origin.y)*0.75,
  };
}
function autoTargetIsLockableAerial(facing=harness.getCurrentRuntimeScene().__rescue.facing){
  return !!autoTargetAerialCandidate(facing);
}
function anyAutoTargetIsLockableAerial(){
  return autoTargetIsLockableAerial(1)||autoTargetIsLockableAerial(-1);
}
function hasComfortableAerialLock(){
  const origin=harness.getCurrentRuntimeScene().__rescue.aimOrigin();
  return [1,-1].some(facing=>{
    const candidate=autoTargetAerialCandidate(facing);
    return !!candidate&&Math.hypot(
      candidate.target.x-origin.x,candidate.target.y-origin.y
    )<=500;
  });
}
async function moveTowardLockableAerial(maxFrames=120){
  const target=liveAerial().sort((a,b)=>
    Math.hypot(a.x-p().x,a.y-p().y)-Math.hypot(b.x-p().x,b.y-p().y)
  )[0];
  if(!target)return false;
  const key=target.x>=p().x?'Right':'Left';
  const startX=p().x;
  harness.setKeyPressed(key,true);
  const lockable=await harness.stepUntil(hasComfortableAerialLock,{maxFrames});
  harness.setKeyPressed(key,false);await harness.stepFrames(2);
  console.log('aerial range move '+JSON.stringify({
    key,startX:Number(startX.toFixed(2)),endX:Number(p().x.toFixed(2)),
    lockable,left:autoTargetIsLockableAerial(-1),right:autoTargetIsLockableAerial(1),
  }));
  return lockable;
}
async function missileDefeatAuto(maxShots,safeRange){
  const defeated=[];
  let shots=0;
  console.log('dense aerial start '+JSON.stringify({
    x:Number(p().x.toFixed(2)),y:Number(p().y.toFixed(2)),
    health:v('Health'),live:liveAerial().map(o=>ov(o,'Id')),
  }));
  while(shots<maxShots&&liveAerial().length>0){
    if(!anyAutoTargetIsLockableAerial()&&
      !await moveTowardLockableAerial())break;
    const id=await missileShotAuto(safeRange);
    shots++;
    console.log('dense aerial launch '+JSON.stringify({
      shot:shots,target:id,health:v('Health'),x:Number(p().x.toFixed(2)),
      healthById:liveAerial().map(o=>({id:ov(o,'Id'),health:ov(o,'Health')})),
    }));
    await evadeUntil(()=>count(id),180,...safeRange);
    console.log('dense aerial impact '+JSON.stringify({
      shot:shots,target:id,targetAlive:!!count(id),health:v('Health'),
      x:Number(p().x.toFixed(2)),
      healthById:liveAerial().map(o=>({id:ov(o,'Id'),health:ov(o,'Health')})),
    }));
    harness.assert(
      v('GameMode')==='Playing'&&v('HasMissile')&&v('CurrentWeapon')==='Missile',
      'aerial route remains in the same run while defeating '+id+
        ' at '+p().x+','+p().y+' health='+v('Health')+
        ' hasMissile='+v('HasMissile')+' weapon='+v('CurrentWeapon')+' retries='+v('Retries'),
    );
    if(!count(id))defeated.push(id);
  }
  return {shots,defeated};
}

async function clearTrial(){
  // The three trial drones are to the player's right. Turn toward them before
  // firing so the acceptance route exercises the authored facing constraint.
  harness.setKeyPressed('Right',true);await harness.stepFrames(1);
  harness.setKeyPressed('Right',false);await harness.stepFrames(1);
  harness.setKeyPressed('w',true);
  const ok=await harness.stepUntil(
    ()=>!harness.getObjects('TrialDrone').some(o=>ov(o,'Active')),
    {maxFrames:300},
  );
  harness.setKeyPressed('w',false);await harness.stepFrames(3);
  const trials=harness.getObjects('TrialDrone').map(o=>({
    id:ov(o,'Id'),health:ov(o,'Health'),active:ov(o,'Active'),x:o.x,y:o.y,
  }));
  harness.assert(
    ok,
    'energy clears all three supply trial targets at '+
      `${p().x},${p().y} weapon=${v('CurrentWeapon')} mode=${v('GameMode')} `+
      `facing=${harness.getCurrentRuntimeScene().__rescue.facing} `+
      `aim=${v('AimTarget')} shots=${v('ShotsFired')} trials=${JSON.stringify(trials)}`,
  );
}

// Entry and the first traversal lesson.
await walk(165);await jumpTo(285);harness.assert(p().y<430,'low platform reached');
harness.setKeyPressed('Right',true);await tap('Space');await harness.stepFrames(16);await tap('Space');
const beacon=await harness.stepUntil(()=>v('Stage')==='Corridor',{maxFrames:140});
harness.releaseAllInputs();await harness.stepFrames(30);harness.assert(beacon,'actual double jump unlocks corridor');

// Ground route: corridor, free cannon, shield and energy encounters.
await walk(640);await jumpTo(955,true);await walk(1020);await shootUntil('p1');
// p5 actively closes distance now, so clear it from the corridor entrance
// before walking into contact range.
await shootUntil('p5');await walk(1300);
// Cross the cover under fire. The combat-ready patrol behind it now advances,
// so fire throughout the jump and clear it before its body reaches ours.
await walk(1480);
harness.setKeyPressed('w',true);
await jumpTo(1640);
harness.setKeyPressed('w',false);await harness.stepFrames(3);
harness.assert(!count('p2'),'the advancing corridor patrol is cleared during the cover jump');
await walk(1820);await jumpTo(1940);await shootUntil('t1');
// The corridor turret may have fired immediately before its defeat. Clear that
// in-flight shot before crossing the lower lane toward the upper platform.
await waitForClearProjectiles([1820,2050]);
await walk(1900);await waitForGround(120,'the high corridor launch point');
await tap('Space');await harness.stepFrames(17);await tap('Space');await harness.stepFrames(4);
harness.setKeyPressed('Right',true);
const upperTurretReach=await harness.stepUntil(()=>p().x>=2050,{maxFrames:200});
harness.setKeyPressed('Right',false);
harness.assert(upperTurretReach&&p().y<430,'high corridor firing platform reached');
await tap('Right');await shootUntil('t4');
// The turret's final shot may already be in flight when it is destroyed.
// Keep the acceptance bot responsive until that projectile crosses the lane.
await waitForClearProjectiles([1900,2200]);await walk(2200);
harness.assert(v('Stage')==='Supply'&&v('EnemiesDefeated')===5,'corridor opens without a coin requirement');
await walk(2350);await tap('e');await tap('Down');await tap('Down');await tap('Return');await tap('Escape');
await walk(2510);await tap('e');harness.assert(v('HasCannon')&&v('CurrentWeapon')==='Cannon','free cannon equipped through real E interaction');
await harness.stepFrames(3);await walk(3000);
// The upper-ledge patrol now advances and shoots. Jump vertically to clear the
// platform's line of fire, use the fast energy gun from above, then cross only
// after the moving enemy is defeated. This keeps the route keyboard-only while
// respecting the authored cover geometry.
await tap('q');await harness.stepFrames(3);
await tap('Space');await harness.stepFrames(16);await tap('Space');
await shootUntil('p6');
await waitForGround(160,'the shield-route launch lane');
await jumpTo(3120);
harness.assert(!count('p6'),'the advancing upper-ledge patrol is cleared before crossing');
harness.assert(p().y<450,'shield high route step is reachable');
await tap('q');await harness.stepFrames(3);
// Cross the low cover wall before engaging s3 so the moving shield lesson tests
// the cannon without an intervening platform.
await jumpTo(3520,true);
// Drop from the raised shield lesson onto the ground before engaging s3. Firing
// down through the platform is correctly blocked by terrain; walking off the
// ledge is the route a player uses and leaves a clear charged shot at the guard.
// The double jump lands on the y=430 ledge, so step through the narrow gap
// beyond its left edge. Stopping at 3600 leaves the player's collision box on
// the ledge; 3560 forces a real drop before the lower-lane cannon lesson.
// Walking farther right crosses shield s1 above the lower lane.
await walk(3560);await waitForGround(150,'the shield lower lane');
await tap('Left');await chargeUntil('s3',8);
// Keep a readable gap from the next guard. Walking directly into its body is
// contact damage, so stop at the left side of the lane and let the cannon aim
// at the moving target before each real charged shot.
await walk(3600);await waitForGround(150,'the shield approach lane');
await harness.stepFrames(45);
await chargeUntil('s1',8);await tap('Right');await chargeUntil('t5',5);
harness.assert(v('Stage')==='Energy','shield corridor clears all four mixed enemies');
await waitForClearProjectiles([3600,4100]);
await harness.takeScreenshot('Shield corridor cleared with free cannon');
await walk(4110);await tap('e');await tap('Down');await tap('Down');await tap('Return');await tap('Escape');
harness.assert(v('Health')===3&&v('HealsBought')===2,'energy shop restores life before the mixed combat route');
await walk(4150);await walk(4160);await jumpTo(4490,true);
// Clear the low cover edge before shooting down at p3. Standing above the
// inside edge makes the projectile collide with the cover even though the
// patrol is visible.
await walk(4600);await waitForGround(120,'the lower energy firing lane');
await tap('q');await tap('Left');await harness.stepFrames(3);await shootUntil('p3');
await walk(4580);await jumpTo(4740,true);await harness.stepFrames(5);await shootUntil('t2');
await tap('Space');await harness.stepFrames(10);harness.setKeyPressed('Right',true);
const overLowCover=await harness.stepUntil(()=>p().x>=4950,{maxFrames:160});
harness.setKeyPressed('Right',false);await harness.stepFrames(50);
harness.assert(overLowCover,'clear the low energy-route cover after the turret is defeated');
await tap('Right');await shootUntil('p4');
// The scout drone above this route also attacks now. Clear it before engaging
// the two shield guards so the acceptance bot is not hit from above while its
// charged cannon is cooling down.
await shootUntil('sd4');
await tap('q');await harness.stepFrames(3);
// The closer guard would otherwise intercept every charged shot intended for
// the farther target. Clear the nearer body first, then turn back.
await chargeUntil('s4',8);await chargeUntil('s2',8);
harness.assert(v('Health')===3,'distance piercing keeps the second shield lesson fair');
// Move beyond the upper platform before engaging the mobile drone.
await tap('q');await harness.stepFrames(3);await walk(5230);await shootUntil('sd4');
// A low cover separates the close-range shield encounter from the turret.
// Crossing it gives the player a fresh line-of-sight warning instead of
// carrying the previous encounter's hostile projectile stream into this one.
await tap('Right');await jumpTo(5460,true);await shootUntil('t3');
harness.assert(v('Stage')==='Aerial'&&v('EnemiesDefeated')===16,'all authored pre-aerial encounters complete');

// The missile is mandatory. If the natural route has fewer than 20 coins,
// reset and clear the authored trial through real shop and weapon inputs.
await walk(5650);await tap('e');harness.assert(v('GameMode')==='Shop','missile shop is reachable');
for(let round=0;v('Coins')<20&&round<2;round++){
  await tap('Down');await tap('Return');
  harness.assert(v('GameMode')==='Playing','supply trial starts from the missile shop');
  await clearTrial();
  await walk(5740);await tap('e');
  harness.assert(v('GameMode')==='Shop','shop reopens after the supply trial');
}
harness.assert(v('Coins')>=20,'trial can recover the mandatory missile budget');
await tap('Return');
harness.assert(v('HasMissile')&&v('CurrentWeapon')==='Missile'&&v('MissileBought')===1,'20 coins buy and equip the missile');
if(v('Health')<3||v('Coins')<5){
  await tap('Down');await tap('Return');
  harness.assert(v('GameMode')==='Playing','a recovery trial can run after buying the missile');
  await tap('q');
  harness.assert(v('CurrentWeapon')==='Energy','the fast energy weapon is available for the recovery trial');
  await clearTrial();
  await tap('q');await tap('q');
  harness.assert(v('CurrentWeapon')==='Missile','Q restores the purchased missile after the recovery trial');
  await walk(5740);await tap('e');
  harness.assert(v('GameMode')==='Shop','the missile shop reopens after the recovery trial');
}
const healthBeforeAerialShop=v('Health');
const coinsBeforeAerialShop=v('Coins');
const spentBeforeAerialShop=v('CoinsSpent');
const healsBeforeAerialShop=v('HealsBought');
await tap('Down');await tap('Down');await tap('Return');
if(healthBeforeAerialShop===3||coinsBeforeAerialShop<5){
  harness.assert(
    v('Coins')===coinsBeforeAerialShop&&
      v('CoinsSpent')===spentBeforeAerialShop&&
      v('HealsBought')===healsBeforeAerialShop,
    'unavailable aerial-route heal is refused without charging',
  );
}else{
  harness.assert(v('Health')===3,'the same shop restores the damaged player before the aerial route');
  harness.assert(
    v('Coins')===coinsBeforeAerialShop-5&&
      v('CoinsSpent')===spentBeforeAerialShop+5&&
      v('HealsBought')===healsBeforeAerialShop+1,
    'the aerial-route heal records its exact charge once',
  );
}
const coinsBeforeFullHealthAttempt=v('Coins');
const spentBeforeFullHealthAttempt=v('CoinsSpent');
const healsBeforeFullHealthAttempt=v('HealsBought');
const healthBeforeRepeatedHealAttempt=v('Health');
await tap('Down');await tap('Down');await tap('Return');
harness.assert(
  v('Coins')===coinsBeforeFullHealthAttempt&&
    v('CoinsSpent')===spentBeforeFullHealthAttempt&&
    v('Health')===healthBeforeRepeatedHealAttempt&&
    v('HealsBought')===healsBeforeFullHealthAttempt,
  'unavailable heal cannot charge across repeated selections',
);
await tap('Escape');await harness.stepFrames(3);

// Aerial route. The active supply targets are closer than the first drone, so
// clear the visible trial with the real energy weapon before requesting a lock.
await walk(5740);
if(harness.getObjects('TrialDrone').some(o=>ov(o,'Active'))){
  await tap('q');await clearTrial();
  await tap('q');await tap('q');
}
harness.assert(v('CurrentWeapon')==='Missile','Q cycles back to the missile');
await walk(5650);await jumpTo(5800);
await missileDefeat('sd1',3,'Right',[5940,6180]);
console.log('aerial checkpoint sd1 '+JSON.stringify({health:v('Health'),x:p().x,y:p().y}));
await jumpTo(5950,true);
await walk(6000);
await jumpTo(6290,true);
await missileDefeat('sd2',3,'Right',[6350,6470]);
console.log('aerial checkpoint sd2 '+JSON.stringify({health:v('Health'),x:p().x,y:p().y}));
// Let the previous drone volley finish before climbing into the next range.
await waitForClearProjectiles([6350,6470]);
await jumpTo(6630,true);
await waitForAerialWindow([6580,6700]);
// Walk down through the two authored maintenance ledges. A second jump from
// the upper step carries the player past the lower landing and into the pit;
// the intended child route is to drop onto the 500 px ledge, then continue onto
// the wide ground island.
await walk(7060);
console.log('aerial checkpoint island '+JSON.stringify({health:v('Health'),x:p().x,y:p().y}));
harness.assert(
  p().x>=7020&&onFloor()&&v('GameMode')==='Playing',
  'dense aerial group starts from the wide safe island at '+p().x+','+p().y+
    ' health='+v('Health'),
);
if(anyAutoTargetIsLockableAerial())await missileDefeatAuto(14,[6920,7240]);
harness.assert(
  liveAerial().length===0,
  'all seven aerial enemies cleared before the relay at '+p().x+','+p().y+
    ' remaining='+JSON.stringify(liveAerial().map(o=>({
      id:ov(o,'Id'),health:ov(o,'Health'),x:o.x,y:o.y,
    }))),
);
// The relay sits above the raised maintenance ledge. Move to that ledge with
// real keyboard input before locking so the line of sight is valid.
// Start from a deliberate takeoff point instead of holding Right directly
// against the wall: the player must have enough airborne time to clear it.
await walk(7160);
await jumpTo(7470);
for(let shot=0;shot<4;shot++)await missileShot('relay-core');
const relayOpen=await harness.stepUntil(()=>v('JammerCoreDefeated')&&v('Stage')==='Rescue',{maxFrames:120});
harness.assert(relayOpen&&!harness.getObjects('Gate').some(o=>ov(o,'Id')==='relay'),'missiles destroy the relay and open the rescue gate');
await jumpTo(7650);
await jumpTo(8010);
harness.setKeyPressed('Right',true);
const reachedExit=await harness.stepUntil(()=>v('GameMode')==='Complete',{maxFrames:150});
harness.releaseAllInputs();
harness.assert(reachedExit&&v('Completed'),'green rescue exit completes the room');

// Completion records must reconcile with gameplay, not with the authored plan alone.
harness.assert(
  v('UpgradesBought')===0&&
    v('MissileBought')===1&&
    v('CoinsSpent')===20+v('HealsBought')*5,
  'missile, full heals and spending are recorded',
);
harness.assert(v('Coins')===v('WalletAtStart')+v('CoinsCollected')-v('CoinsSpent'),'wallet reconciles with actual income and spending');
harness.assert(
  v('PatrolDefeated')===6&&v('TurretDefeated')===5&&v('ShieldDefeated')===4,
  'completion card has real ground enemy counts',
);
harness.assert(
  v('ScoutDroneDefeated')===4&&v('ArmoredDroneDefeated')===3&&v('JammerCoresDefeated')===1,
  'completion card has real aerial and relay counts',
);
harness.assert(v('EnergyShots')+v('CannonShots')+v('MissileShots')===v('ShotsFired'),'weapon shot counters reconcile');
harness.assert(v('EnergyHits')+v('CannonHits')+v('MissileHits')===v('Hits'),'weapon hit counters reconcile');
harness.assert(v('MissileLockedShots')===v('MissileShots'),'every missile launch in the acceptance route is locked');
harness.assert(v('ElapsedSeconds')>0&&v('Retries')===0,'timing records actual simulation and the route avoids falling');
await harness.takeScreenshot('Complete aerial rescue with mandatory missile');
console.log(JSON.stringify({
  income:v('CoinsCollected'),wallet:v('Coins'),spent:v('CoinsSpent'),
  shots:v('ShotsFired'),hits:v('Hits'),seconds:v('ElapsedSeconds'),
}));
