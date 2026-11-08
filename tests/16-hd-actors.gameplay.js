// Fixtures position real objects; weapon acquisition and pose changes use real keyboard input.
const one=n=>harness.getObjects(n)[0];
const tap=async key=>{harness.setKeyPressed(key,true);await harness.stepFrames(1);harness.setKeyPressed(key,false);await harness.stepFrames(2);};
await harness.goToScene('RescueBase');await harness.stepFrames(5);
harness.assert(one('Player').width===40&&one('Player').height===56,'HD editor preview preserves native player collision dimensions');
harness.assert(one('Patrol').width===48&&one('Turret').width===56&&one('Shield').width===56,'enemy gameplay proxies keep previous dimensions');
harness.assert(one('ArtHero').width===176&&one('ArtHero').height===128,'HD hero owns the new source canvas');
harness.assert(one('ArtShield').width===88&&one('ArtShield').height===96,'HD shield guard uses authored larger artwork');
harness.assert(Math.abs(one('ArtHero').y+116-(one('Player').y+56))<1.2,'authored feet align with physics floor');
await harness.takeScreenshot('HD player at entrance',{fullResolution:true});
harness.setObjectPosition(one('Player').id,1450,504);await harness.stepFrames(6);
await harness.takeScreenshot('HD patrol and turret in unchanged level',{fullResolution:true});
// Keep the pose fixture away from the corridor contact enemies so invulnerability
// cannot replace the authored shooting pose with the hurt pose.
harness.setObjectPosition(one('Player').id,1050,504);await harness.stepFrames(80);
harness.setKeyPressed('w',true);await harness.stepFrames(2);
harness.assert(
  one('ArtHero').animation==='SHOOT'&&one('ArtGun').hidden,
  'source shooting pose hides duplicate held gun (pose='+one('ArtHero').animation+
    ', gunHidden='+one('ArtGun').hidden+')'
);
harness.releaseAllInputs();await harness.stepFrames(20);
harness.assert(!one('ArtGun').hidden,'separate extracted gun returns in idle');
harness.setObjectPosition(one('Player').id,2510,504);await harness.stepFrames(4);await tap('e');
harness.assert(harness.getSceneVariable('HasCannon').value,'real crate still grants cannon');
await harness.stepFrames(30);harness.setKeyPressed('w',true);await harness.stepFrames(52);
harness.assert(one('ArtHero').animation==='CHARGE'&&one('ArtGun').hidden&&one('ChargeGlow').hidden,'authored cannon pose has no duplicate weapon or ring');
harness.assert(!one('ChargeFill').hidden,'tiny feet charge meter remains functional');
await harness.takeScreenshot('HD cannon charge from supplied artwork',{fullResolution:true});
harness.releaseAllInputs();await harness.stepFrames(1);
harness.assert(one('ArtHero').animation==='FIRE'&&one('ArtGun').hidden,'release displays authored cannon firing pose');
harness.setObjectPosition(one('Player').id,3550,504);await harness.stepFrames(25);
await harness.takeScreenshot('HD shield guard facing player',{fullResolution:true});
await tap('Left');
harness.assert(harness.getRuntimeObject('ArtHero').isFlippedX(),'HD actor faces movement direction');
await harness.goToScene('TrainingRoom');await harness.stepFrames(5);
harness.assert(one('ArtHero').width===176&&one('Player').width===40,'training room shares HD art and original physics');
