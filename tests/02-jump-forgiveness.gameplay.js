const player=()=>harness.getObjects('Player')[0];
const grounded=()=>harness.getRuntimeObject('Player').getBehavior('Platformer').isOnFloor();
await harness.goToScene('TrainingRoom');await harness.stepFrames(4);
// Arrange at the real edge; all motion and jumping after setup use actual keys.
harness.setObjectPosition(player().id,750,504);await harness.stepFrames(2);
harness.setKeyPressed('Right',true);
const leftEdge=await harness.stepUntil(()=>!grounded(),{maxFrames:30});
harness.assert(leftEdge,'walks off the actual platform edge');
harness.setKeyPressed('Right',false);harness.setKeyPressed('Space',true);await harness.stepFrames(3);
harness.assert(harness.getSceneVariable('JumpCount').value===1,'coyote jump uses the first jump slot');
harness.assert(harness.getSceneVariable('DoubleJumps').value===0,'coyote time is not an extra air jump');
harness.releaseAllInputs();

await harness.goToScene('TrainingRoom');await harness.stepFrames(4);
harness.setObjectPosition(player().id,750,504);await harness.stepFrames(2);
harness.setKeyPressed('Right',true);await harness.stepUntil(()=>!grounded(),{maxFrames:30});
harness.releaseAllInputs();await harness.stepFrames(9);
harness.assert(harness.getSceneVariable('JumpCount').value===1,'walking off beyond grace consumes the floor slot');
harness.setKeyPressed('Space',true);await harness.stepFrames(3);
harness.assert(harness.getSceneVariable('JumpCount').value===2,'only one air jump remains after walking off');
harness.setKeyPressed('Space',false);await harness.stepFrames(2);harness.setKeyPressed('Space',true);await harness.stepFrames(2);
harness.assert(harness.getSceneVariable('Jumps').value===1,'cannot acquire a third opportunity after grace expires');

await harness.goToScene('TrainingRoom');await harness.stepFrames(4);
harness.setKeyPressed('Space',true);await harness.stepFrames(12);
harness.setKeyPressed('Space',false);await harness.stepFrames(2);harness.setKeyPressed('Space',true);await harness.stepFrames(3);harness.releaseAllInputs();
const nearLanding=await harness.stepUntil(()=>player().y>478&&harness.getRuntimeObject('Player').getBehavior('Platformer').isFalling(),{maxFrames:120});
harness.assert(nearLanding,'reaches a landing approach after consuming both jumps');
const before=harness.getSceneVariable('Jumps').value;
harness.setKeyPressed('Space',true);await harness.stepFrames(1);
harness.assert(harness.getSceneVariable('Jumps').value===before,'third press is buffered rather than jumping in midair');
await harness.stepFrames(7);
harness.assert(harness.getSceneVariable('Jumps').value===before+1,'buffered input triggers one jump on landing');
harness.assert(harness.getSceneVariable('DoubleJumps').value===1,'landing buffer does not add an extra double jump');
harness.releaseAllInputs();
