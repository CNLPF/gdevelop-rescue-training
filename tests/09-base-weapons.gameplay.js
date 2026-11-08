// Fixtures isolate weapon inputs; shots and damage always use the real gameplay events.
await harness.goToScene('RescueBase');await harness.stepFrames(4);
const v=n=>harness.getSceneVariable(n).value;
const p=()=>harness.getObjects('Player')[0];
const ov=(o,n)=>harness.getObjectVariable(o.id,n).value;
const tap=async key=>{harness.setKeyPressed(key,true);await harness.stepFrames(1);harness.setKeyPressed(key,false);await harness.stepFrames(1);};
await tap('q');harness.assert(v('CurrentWeapon')==='Energy','Q cannot equip unavailable cannon');
// At the real free weapon crate. No wallet edit or purchase is needed.
harness.setObjectPosition(p().id,2510,504);await harness.stepFrames(3);await tap('e');
harness.assert(v('HasCannon')&&v('CurrentWeapon')==='Cannon'&&v('Coins')===0,'real crate grants cannon for free');
await harness.stepFrames(3);harness.setKeyPressed('w',true);await harness.stepFrames(60);
harness.assert(v('Charge')>=0.8&&v('CannonShots')===0,'full charge holds without auto firing');
harness.setKeyPressed('w',false);await harness.stepFrames(1);
harness.assert(v('CannonShots')===1&&v('ChargedShots')===1,'release fires one charged shot');
const charged=harness.getObjects('Bullet').find(o=>ov(o,'PierceShield'));
harness.assert(charged&&ov(charged,'Damage')===4&&ov(charged,'Range')===480,'charged bullet has correct damage and range');
await tap('w');harness.assert(v('CannonShots')===1,'cooldown prevents immediate second shot');
await harness.stepFrames(45);await tap('w');
harness.assert(v('CannonShots')===2&&v('ChargedShots')===1,'short tap fires weak shot');
const weak=harness.getObjects('Bullet').find(o=>!ov(o,'PierceShield'));
harness.assert(weak&&ov(weak,'Damage')===1,'weak cannon damage is one');
await harness.stepFrames(45);harness.setKeyPressed('w',true);await harness.stepFrames(20);await tap('q');
harness.assert(v('CurrentWeapon')==='Energy'&&v('Charge')===0,'switching cancels charge');
const before=v('EnergyShots');await harness.stepFrames(24);
harness.assert(v('EnergyShots')===before,'held W cannot fire after switching');
harness.setKeyPressed('w',false);await harness.stepFrames(2);await tap('w');
harness.assert(v('EnergyShots')===before+1,'release then fresh press restores shooting');
// Shield remains its real instance, positioned on flat ground away from cover.
for(const name of ['Bullet','Dummy'])for(const o of harness.getObjects(name))harness.removeObject(o.id);
const shield=harness.getObjects('Shield')[0];harness.setObjectPosition(shield.id,2750,504);
for(const [k,value]of Object.entries({MinX:2750,MaxX:2750,Health:8}))harness.setObjectVariable(shield.id,k,value);
harness.setObjectPosition(p().id,2670,504);await harness.stepFrames(45);await tap('w');await harness.stepFrames(20);
harness.assert(ov(shield,'Health')===8&&v('ShieldBlocks')>=1,'front energy shot is visibly blocked');
await tap('q');await harness.stepFrames(3);harness.setKeyPressed('w',true);await harness.stepFrames(50);harness.setKeyPressed('w',false);await harness.stepFrames(20);
harness.assert(ov(shield,'Health')===4,'full cannon passes shield and deals four');
await harness.stepFrames(45);await tap('w');await harness.stepFrames(20);
harness.assert(ov(shield,'Health')===4,'weak cannon is also blocked');
// Rear hit uses genuine left-facing player fire.
await tap('q');harness.setObjectPosition(p().id,2850,504);await tap('Left');await harness.stepFrames(45);await tap('w');await harness.stepFrames(20);
harness.assert(ov(shield,'Health')===3,'ordinary rear shot damages guard');
harness.assert(v('EnergyHits')+v('CannonHits')===v('Hits'),'weapon hit counters sum to real hits');
await harness.takeScreenshot('Shield and weapon comparison');
