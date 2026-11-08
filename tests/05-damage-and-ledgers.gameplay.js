const value=n=>harness.getSceneVariable(n).value;
const p=()=>harness.getObjects('Player')[0];
const hit=()=>{
  const a=p();const b=harness.spawn('EnemyBullet',a.centerX-6,a.centerY-6,undefined,'Gameplay');
  harness.setObjectVariable(b.id,'Vx',0);harness.setObjectVariable(b.id,'Vy',0);harness.setObjectVariable(b.id,'Distance',0);
};
await harness.goToScene('TrainingRoom');await harness.stepFrames(4);
hit();await harness.stepFrames(1);harness.assert(value('Health')===2&&value('DamageTaken')===1,'enemy bullet deals one damage');
hit();await harness.stepFrames(1);harness.assert(value('Health')===2&&value('DamageTaken')===1,'invulnerability rejects repeated immediate damage');
await harness.stepFrames(74);hit();await harness.stepFrames(1);
harness.assert(value('Health')===1&&value('DamageTaken')===2,'damage can apply after protection expires');
const coin=harness.getObjects('Coin').find(o=>o.variables.some(v=>v.name==='Id'&&v.value==='map-0'));
harness.setObjectPosition(coin.id,p().x,p().y);await harness.stepFrames(1);
harness.assert(value('Coins')===1&&value('CoinsCollected')===1,'a pickup increments actual wallet and record');
const duplicate=harness.spawn('Coin',p().x,p().y,undefined,'Gameplay');harness.setObjectVariable(duplicate.id,'Id','map-0');await harness.stepFrames(1);
harness.assert(value('Coins')===1&&value('CoinsCollected')===1,'stable pickup ID prevents a second reward');
harness.setObjectPosition(p().id,80,740);await harness.stepFrames(35);
harness.assert(value('Retries')===1&&value('Coins')===1&&value('Health')===1,'fall preserves earned coins and remaining health');
const again=harness.spawn('Coin',p().x,p().y,undefined,'Gameplay');harness.setObjectVariable(again.id,'Id','map-0');await harness.stepFrames(1);
harness.assert(value('Coins')===1&&value('CoinsCollected')===1,'retry does not reset pickup ledger');

await harness.goToScene('TrainingRoom');await harness.stepFrames(4);harness.setSceneVariable('Stage','Combat');
const patrol=harness.getObjects('Patrol')[0];harness.setObjectPosition(patrol.id,80,512);harness.setObjectVariable(patrol.id,'MinX',80);harness.setObjectVariable(patrol.id,'MaxX',80);
harness.setObjectPosition(p().id,80,420);await harness.stepFrames(30);
harness.assert(harness.getObjectVariable('Patrol','Health').value===2,'landing on a patrol does not stomp it');
harness.assert(value('DamageTaken')>=1,'landing contact hurts the player');

await harness.goToScene('TrainingRoom');await harness.stepFrames(4);harness.setSceneVariable('Stage','Combat');
harness.setObjectPosition(p().id,1510,504);await harness.stepFrames(4);
const turret=harness.getObjects('Turret')[0];harness.setObjectVariable(turret.id,'Cooldown',0.65);await harness.stepFrames(5);
harness.assert(harness.getObjectVariable('Turret','Warning').value===true,'turret enters attack timing before firing');
await harness.stepFrames(37);
harness.assert(harness.getObjects('EnemyBullet').length>=1||value('DamageTaken')>=1,'turret attack timing ends in a real projectile');
const shots=harness.getObjects('EnemyBullet');
if(shots.length){const b=shots[0];const vx=harness.getObjectVariable(b.id,'Vx').value,vy=harness.getObjectVariable(b.id,'Vy').value;harness.setObjectPosition(p().id,1510,360);await harness.stepFrames(2);if(harness.getObjects('EnemyBullet').some(o=>o.id===b.id))harness.assert(harness.getObjectVariable(b.id,'Vx').value===vx&&harness.getObjectVariable(b.id,'Vy').value===vy,'enemy projectiles do not track a moving player');}
