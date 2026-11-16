// End-to-end mobile touch coverage through GDevelop's real multi-touch input
// manager. Coordinates are in reference HUD coordinates (960x640 landscape).
const TOUCH={
  left:{x:60,y:568},right:{x:144,y:568},jump:{x:760,y:572},
  fire:{x:856,y:564},switch:{x:761,y:479},interact:{x:859,y:479},
  restart:{x:909,y:46},
};
const value=name=>harness.getSceneVariable(name).value;
const optionalValue=(name,fallback=0)=>{try{return value(name)}catch{return fallback}};
const shotTotal=()=>optionalValue('EnergyShots')+optionalValue('CannonShots')+optionalValue('MissileShots');
const player=()=>harness.getObjects('Player')[0];
const rescue=()=>harness.getCurrentRuntimeScene().__rescue;
const actions=()=>new Set(harness.getObjects('TouchButton').map(o=>harness.getObjectVariable(o.id,'Action').value));

async function waitForTouchControls(sceneName){
  await harness.goToScene(sceneName);
  harness.setSceneVariable('TouchControlsMode','on');
  harness.setSceneVariable('ReinforcementsEnabled',false);
  await harness.stepFrames(4);
  harness.assert(value('TouchControlsVisible')===true,sceneName+' shows landscape touch controls in forced-on mode');
  harness.assert(actions().size===7,sceneName+' has one unique button for every physical action');
  const rotate=harness.getObjects('TouchRotateOverlay');
  harness.assert(rotate.length===1,sceneName+' has exactly one orientation overlay');
  harness.assert(rotate[0].width>=900&&rotate[0].height>=600,sceneName+' overlay covers the landscape reference canvas');
  for(const [action,expected] of Object.entries({
    left:[24,532,72,72],right:[108,532,72,72],jump:[724,536,72,72],
    fire:[812,520,88,88],switch:[726,446,70,66],interact:[824,446,70,66],
    restart:[878,16,62,60],
  })){
    const button=harness.getObjects('TouchButton').find(o=>harness.getObjectVariable(o.id,'Action').value===action);
    harness.assert(button&&button.x===expected[0]&&button.y===expected[1]&&button.width===expected[2]&&button.height===expected[3],sceneName+' '+action+' button uses the shared safe layout');
  }
}

async function hold(id,action){harness.touchStart(id,TOUCH[action].x,TOUCH[action].y,'HUD');await harness.stepFrames(1);}
async function release(id){harness.touchEnd(id);await harness.stepFrames(2);}
async function tap(id,action){await hold(id,action);await release(id);}

async function verifyCombinedControls(sceneName){
  await waitForTouchControls(sceneName);
  harness.setObjectPosition(player().id,150,504);
  await harness.stepFrames(3);
  const x0=player().x;
  const shots0=shotTotal();
  await hold(10,'right');
  await hold(11,'fire');
  await hold(12,'jump');
  await harness.stepFrames(4);
  harness.assert(player().x>x0+1,sceneName+' right touch moves the player');
  harness.assert(shotTotal()>shots0,sceneName+' attack touch fires the equipped weapon');
  harness.assert(value('JumpCount')>=1,sceneName+' jump touch enters the real platform jump controller');
  await harness.stepFrames(50);
  harness.assert(value('Jumps')===1,sceneName+' holding jump does not repeatedly jump');
  await release(11);
  const shotsReleased=shotTotal();
  await harness.stepFrames(24);
  harness.assert(shotTotal()===shotsReleased,sceneName+' releasing attack stops held fire');
  await release(10);
  await release(12);
  await harness.stepFrames(3);
  harness.assert(!rescue().keys.left&&!rescue().keys.right&&!rescue().keys.fire&&!rescue().keys.jump,sceneName+' releases clear all touch actions');
}

await verifyCombinedControls('TrainingRoom');
await verifyCombinedControls('RescueBase');

// A quick physical tap must produce exactly one air jump and a held jump must
// consume at most the ground jump, regardless of touch duration.
await waitForTouchControls('TrainingRoom');
harness.setObjectPosition(player().id,150,504);
await harness.stepFrames(5);
await hold(20,'jump');await release(20);await harness.stepFrames(5);
await hold(21,'jump');await release(21);
harness.assert(value('JumpCount')===2&&value('DoubleJumps')===1,'touch tap-release-tap performs one deliberate double jump');
await harness.releaseAllInputs();await harness.stepFrames(70);

// The cannon must remain charged while the finger is held, then fire exactly
// once on release. This path uses the production weapon state machine.
await waitForTouchControls('RescueBase');
harness.setSceneVariable('HasCannon',true);
harness.setSceneVariable('CurrentWeapon','Cannon');
await harness.stepFrames(3);
const cannon0=value('CannonShots');
await hold(30,'fire');
await harness.stepFrames(48);
harness.assert(value('Charge')>=0.79&&value('CannonShots')===cannon0,'held touch keeps cannon fully charged without auto firing');
await release(30);
harness.assert(value('CannonShots')===cannon0+1&&value('ChargedShots')>=1,'releasing attack fires the charged cannon once');

// Missile lock uses the same touch charge/release edges and the real target
// registry. Officers use a deterministic nearby patrol fixture.
await waitForTouchControls('RescueBase');
harness.setSceneVariable('HasMissile',true);
harness.setSceneVariable('CurrentWeapon','Missile');
harness.setObjectPosition(player().id,150,504);
const patrol=harness.getObjects('Patrol')[0];
harness.setObjectPosition(patrol.id,320,504);
harness.setObjectVariable(patrol.id,'Health',2);
harness.setObjectVariable(patrol.id,'MinX',320);
harness.setObjectVariable(patrol.id,'MaxX',320);
await harness.stepFrames(5);
const missile0=value('MissileShots');
await hold(31,'fire');
await harness.stepFrames(40);
const lockDiag={progress:value('MissileLockProgress'),target:value('MissileTargetId'),aim:rescue().aimTargetId,weapon:value('CurrentWeapon'),facing:rescue().facing,player:{x:player().x,y:player().y},keys:{...rescue().keys},targets:harness.getObjects('Patrol').map(o=>({id:harness.getObjectVariable(o.id,'Id').value,x:o.x,y:o.y,health:harness.getObjectVariable(o.id,'Health').value,active:harness.getObjectVariable(o.id,'Active').value}))};
harness.assert(value('MissileLockProgress')>=0.54&&value('MissileTargetId'),'held touch locks a visible target before missile release '+JSON.stringify(lockDiag));
await release(31);
harness.assert(value('MissileShots')===missile0+1,'releasing a locked missile touch fires once');
const missile=harness.getObjects('Bullet').find(o=>harness.getObjectVariable(o.id,'Weapon').value==='Missile');
harness.assert(missile&&harness.getObjectVariable(missile.id,'Locked').value===true,'released missile carries the touch-acquired lock data');

// Q and E remain distinct physical buttons. Menu context maps interject to
// confirm and weapon to back while leaving directional selection intact.
await waitForTouchControls('RescueBase');
harness.setSceneVariable('HasCannon',true);
harness.setSceneVariable('HasMissile',true);
harness.setSceneVariable('CurrentWeapon','Energy');
await tap(40,'switch');
harness.assert(value('CurrentWeapon')==='Cannon','weapon touch cycles only through owned weapons');
await tap(41,'switch');
harness.assert(value('CurrentWeapon')==='Missile','second weapon touch reaches missile');
const shop=harness.getObjects('Shop').find(o=>harness.getObjectVariable(o.id,'Id').value==='shop-supply');
harness.assert(shop,'a real supply shop exists for menu touch testing');
harness.setObjectPosition(player().id,shop.x,shop.y);
harness.setSceneVariable('Stage','Purchase');
harness.setSceneVariable('Coins',12);
await harness.stepFrames(4);
await tap(42,'interact');
harness.assert(value('GameMode')==='Shop','interact touch opens the real shop');
const coins0=value('Coins');
await tap(43,'interact');
harness.assert(value('GameMode')==='Shop'&&value('Coins')<coins0,'a fresh interact touch confirms the selected shop item');
await tap(44,'switch');
harness.assert(value('GameMode')==='Playing','weapon touch becomes back/cancel inside the shop');

// Restart is an edge action; opening the confirm modal blocks the same finger
// from immediately confirming, and a fresh tap starts a new run.
await waitForTouchControls('RescueBase');
await tap(50,'restart');
harness.assert(value('GameMode')==='RestartConfirm','restart touch opens confirmation');
await tap(51,'interact');
await harness.stepFrames(5);
harness.assert(value('GameMode')==='Playing'&&value('Health')===3,'fresh confirm touch starts a full-health new run');

// Dropping into a pit blocks every touch owner until all fingers lift, so the
// player cannot resume firing on arrival merely because a touch stayed down.
await waitForTouchControls('RescueBase');
await hold(60,'right');await hold(61,'fire');
harness.setObjectPosition(player().id,player().x,740);
await harness.stepFrames(2);
harness.assert(value('GameMode')==='Respawning','fall enters the returning state');
harness.assert(Object.keys(rescue().touchState.owners).length===0&&!rescue().touchState.down.fire,'fall invalidates held touch owners');
await harness.stepFrames(35);
harness.assert(value('GameMode')==='Playing','fall returns to play without restarting the whole scene');
const afterReturn=shotTotal();
await harness.stepFrames(20);
harness.assert(shotTotal()===afterReturn,'held touches cannot resume attacks after returning from a pit');
await release(60);await release(61);
await harness.stepFrames(2);
harness.assert(!rescue().keys.fire&&!rescue().keys.right,'lifting invalidated fingers fully clears input');

// Touch disablement is explicit for desktop/classroom troubleshooting and the
// portrait policy pauses gameplay behind the rotation overlay rather than
// attempting an unsupported vertical layout.
await harness.goToScene('RescueBase');await harness.stepFrames(3);
harness.setSceneVariable('TouchControlsMode','off');await harness.stepFrames(2);
harness.assert(value('TouchControlsVisible')===false,'off mode hides all touch gameplay controls');
harness.setSceneVariable('TouchControlsMode','on');
harness.setGameResolutionSize(640,960);
await harness.stepFrames(3);
harness.assert(value('TouchControlsVisible')===false,'portrait viewport disables the landscape touch layout');
harness.assert(harness.getCurrentRuntimeScene().getLayer('Gameplay').getTimeScale()===0,'portrait viewport pauses gameplay');
await harness.setGameResolutionSize(960,640);
harness.setSceneVariable('TouchControlsMode','off');
await harness.stepFrames(2);
await harness.takeScreenshot('Landscape multi-touch controls and rotation policy');
