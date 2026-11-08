// Real rendering states with unchanged gameplay proxies. Setup only unlocks cannon for visual QA.
const one=n=>harness.getObjects(n)[0];
await harness.goToScene('RescueBase');await harness.stepFrames(5);
const probe=await harness.resetSceneAndProbeControls('Player',['Left','Right','Space'],{frames:12});
harness.assert(probe.keys.Right.dx>probe.baseline.dx+10&&probe.keys.Space.minDy<probe.baseline.minDy-20,'native controls still drive the physics player');
await harness.stepFrames(5);
harness.assert(one('Player').width===40&&one('Player').height===56,'physics proxy remains 40x56');
harness.assert(one('ArtHero').width===176&&one('ArtHero').height===128,'hero uses separate HD art with stable foot anchor');
harness.assert(one('HudPanel').width===304&&one('HudPanel').height===44,'shared compact HUD uses the current 304x44 footprint');
harness.assert(harness.getObjects('ArtGun').length===1&&harness.getObjects('ArtWeaponIcon').length===1,'weapon and HUD icon are separate shared objects');
harness.assert(one('Player').opacity===0&&one('ArtHero').opacity>0,'only the visual hero renders');
harness.assert(harness.getObjects('ArtPatrol').length===6&&harness.getObjects('ArtTurret').length===5&&harness.getObjects('ArtShield').length===4,'all enemies have matching V2 visual instances');
harness.assert(harness.getObjects('ArtScoutDrone').length===4&&harness.getObjects('ArtArmoredDrone').length===3,'flying enemies have matching local visual instances');
harness.assert(harness.getObjects('ArtJammerCore').length===1&&harness.getObjects('ArtTrialDrone').length===3,'relay core and trial targets have local visual instances');
await harness.takeScreenshot('V2 base entrance',{fullResolution:true});
harness.setKeyPressed('Right',true);await harness.stepFrames(10);harness.releaseAllInputs();
harness.assert(one('ArtHero').animation==='RUN','movement selects authored run key pose');
await harness.stepFrames(2);harness.setKeyPressed('w',true);await harness.stepFrames(2);
harness.assert(one('ArtHero').animation==='SHOOT'&&harness.getObjects('ArtProjectile').length>0,'actual W fire selects shooting pose and projectile art');
harness.releaseAllInputs();await harness.stepFrames(2);
harness.setSceneVariable('HasCannon',true);harness.setSceneVariable('CurrentWeapon','Cannon');
harness.setObjectPosition(one('Player').id,2670,504);await harness.stepFrames(24);
harness.setKeyPressed('w',true);await harness.stepFrames(52);
harness.assert(one('ArtGun').animation==='Cannon'&&one('ArtHero').animation==='CHARGE',`equipped cannon and charge pose match current weapon: gun=${one('ArtGun').animation}, hero=${one('ArtHero').animation}, charging=${harness.getSceneVariable('Charge').value}`);
harness.assert(!one('ChargeFill').hidden&&one('ChargeFill').width===32,'full charge remains at feet');
await harness.takeScreenshot('V2 supply station and charged cannon',{fullResolution:true});
harness.releaseAllInputs();await harness.stepFrames(1);
harness.assert(one('ArtHero').animation==='FIRE'&&one('ChargeFill').hidden,'release selects fire pose and hides meter');
harness.setObjectPosition(one('Player').id,3550,504);await harness.stepFrames(5);
await harness.takeScreenshot('V2 shield direction and platform art',{fullResolution:true});
await harness.goToScene('TrainingRoom');await harness.stepFrames(5);
harness.assert(one('ArtHero')&&one('ArtGun')&&one('ArtHeart'),'training room shares V2 actor and HUD art');
harness.assert(harness.getObjects('ArtScoutDrone').length===1&&harness.getObjects('ArtArmoredDrone').length===1,'training room now renders both V0.3 flying enemy art instances');
harness.assert(harness.getObjects('ArtTrialDrone').length===3,'training room now renders all three missile-trial targets');
harness.assert(!one('KeyHelp').hidden,'training tutorial remains available');
await harness.takeScreenshot('V2 training room',{fullResolution:true});

// The supplied V2 air fighter owns all four presentation states. Logic
// counters decide when Attack is real, so a cancelled warning cannot emit it.
await harness.goToScene('RescueBase');await harness.stepFrames(5);
const scout=harness.getObjects('ScoutDrone').find(o=>harness.getObjectVariable(o.id,'Id').value==='sd1');
harness.assert(scout,'authored scout drone exists for V2 air-art state test');
for(const type of ['ScoutDrone','ArmoredDrone'])for(const enemy of harness.getObjects(type)){
  harness.setObjectVariable(enemy.id,'Active',enemy.id===scout.id);
  harness.setObjectVariable(enemy.id,'Cooldown',999);
}
harness.setObjectVariable(scout.id,'MinX',6240);
harness.setObjectVariable(scout.id,'MaxX',6240);
harness.setObjectVariable(scout.id,'HoverY',352);
harness.setObjectPosition(scout.id,6240,352);
harness.setSceneVariable('Stage','Aerial');
harness.setObjectPosition(one('Player').id,6000,504);
// The camera updates at the end of the presentation event. Let the authored
// scout enter the visible area before injecting the short attack cooldown.
await harness.stepFrames(2);
harness.setObjectVariable(scout.id,'Cooldown',0.1);
harness.stepFrames(3);
const nearestScoutArt=()=>harness.getObjects('ArtScoutDrone').reduce((nearest,art)=>
  !nearest||Math.abs(art.x-scout.x)<Math.abs(nearest.x-scout.x)?art:nearest,null);
harness.assert(
  nearestScoutArt()?.animation==='Warn',
  `air fighter shows Warn while the attack warning is active: art=${nearestScoutArt()?.animation}, warning=${harness.getObjectVariable(scout.id,'Warning').value}, cooldown=${harness.getObjectVariable(scout.id,'Cooldown').value}, active=${harness.getObjectVariable(scout.id,'Active').value}, playerX=${one('Player').x}, scoutX=${scout.x}`
);
await harness.takeScreenshot('V2 air fighter warning pose',{fullResolution:true});
let sawAttack=false;
for(let frame=0;frame<60&&!sawAttack;frame++){
  await harness.stepFrames(1);
  if(nearestScoutArt()?.animation==='Attack'){
    sawAttack=true;
    await harness.takeScreenshot('V2 air fighter attack pose',{fullResolution:true});
  }
}
harness.assert(sawAttack,'air fighter shows the Attack pose only when an actual attack is emitted');
harness.setObjectVariable(scout.id,'Flash',0.2);await harness.stepFrames(1);
harness.assert(nearestScoutArt()?.animation==='Hit','air fighter shows Hit feedback while damage flash is active');
harness.setObjectVariable(scout.id,'Flash',0);await harness.stepFrames(12);
harness.assert(nearestScoutArt()?.animation==='Idle','air fighter returns to Idle after Attack and Hit states finish');
harness.assert(one('ScoutDrone').width===72&&one('ScoutDrone').height===40,'scout collision proxy keeps its original 72x40 footprint');
harness.assert(one('ArmoredDrone').width===90&&one('ArmoredDrone').height===50,'armored collision proxy keeps its original 90x50 footprint');
harness.assert(harness.getObjects('ArtScoutDrone')[0].width===96&&harness.getObjects('ArtArmoredDrone')[0].width===108,'air art uses a smaller visual canvas than its 144px source');


