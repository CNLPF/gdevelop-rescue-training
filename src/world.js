export function attachWorld(r) {
  const spawn = {x:r.player.getX(),y:r.player.getY()};
  r.startNewRun = () => {
    if(r.mode()==='Restarting')return;
    const globals=r.scene.getGame().getVariables();
    globals.get('RescueWallet').setNumber(r.number('Coins'));
    globals.get('RescueCarryWallet').setBoolean(true);
    r.setMode('Restarting');
    gdjs.evtTools.runtimeScene.replaceScene(r.scene,'TrainingRoom',false);
  };
  r.clearBullets = () => {for(const name of ['Bullet','EnemyBullet'])for(const o of [...r.objects(name)])o.deleteFromScene();};
  r.hurtPlayer = () => {
    if(r.mode()!=='Playing'||r.invulnerable>0)return;
    r.add('Health',-1);r.add('DamageTaken');r.invulnerable=1.2;
    r.flash(r.player.getX()+20,r.player.getY()+20,'255;97;103');
    if(r.number('Health')<=0)r.startNewRun();else r.toast('受击了！闪烁时会短暂保护你');
  };
  r.respawn = () => {
    if(r.mode()!=='Playing')return;
    r.add('Retries');r.setMode('Respawning');
    r.toast('回到出生点 · 生命、金币和关卡状态保留');
  };
  r.resetDummy = () => {
    const target=r.object('Dummy');r.ov(target,'Health').setNumber(4);target.hide(false);
    r.set('DummyHealth',4);r.set('DummyHits',0);r.toast('训练靶已恢复 · 当前形态每发伤害 '+(r.string('WeaponForm')==='Upgrade'?2:1));
  };
  r.world = () => {
    if(r.mode()==='Respawning'){
      if(r.modeTime>=0.45){
        r.player.setPosition(spawn.x,spawn.y);
        r.body.setCurrentSpeed(0);r.body.abortJump();r.body.setCurrentFallSpeed(0);
        r.set('JumpCount',0);r.coyote=0;r.buffer=0;r.jumpPending=false;r.invulnerable=1.2;r.setMode('Playing');
      }
      return;
    }
    if(r.mode()!=='Playing')return;
    r.invulnerable=Math.max(0,r.invulnerable-r.dt);
    r.player.setX(Math.max(16,Math.min(3144,r.player.getX())));
    if(r.player.getY()>720){r.respawn();return;}
    const playerBox=r.box(r.player);
    for(const coin of [...r.objects('Coin')])if(r.Rules.overlaps(playerBox,r.box(coin))){
      const id=r.ov(coin,'Id').getAsString();const ledger=r.vars.get('CollectedCoins');
      if(!ledger.getChild(id).getAsBoolean()){
        ledger.getChild(id).setBoolean(true);r.add('Coins');r.add('CoinsCollected');
        r.add(r.ov(coin,'Reward').getAsBoolean()?'RewardCoinsCollected':'MapCoinsCollected');r.flash(coin.getX()+12,coin.getY()+12,'255;190;57');
      }
      coin.deleteFromScene();
    }
    for(const name of ['Patrol','Turret'])for(const enemy of r.objects(name))if(r.Rules.overlaps(playerBox,r.box(enemy)))r.hurtPlayer();
    if(r.mode()!=='Playing')return;
    if(r.player.getX()>=950)r.checkpoint(960);
    if(r.player.getX()>=1850)r.checkpoint(1880);
  };
  r.progress = () => {
    if(r.mode()!=='Playing')return;
    if(r.stage()==='Jump'){
      const beacon=r.object('JumpBeacon');
      if(r.boolean('DoubleJumpDone')&&r.Rules.overlaps(r.box(r.player),r.box(beacon))){r.openGate('jump');r.setStage('Combat');}
    }
    if(r.stage()==='Combat' && r.number('EnemiesDefeated')>=2 && r.number('Coins')>=10){r.openGate('combat');r.setStage('Purchase');}
    if(r.stage()==='Purchase' && r.boolean('UpgradePurchased')){r.openGate('shop');r.setStage('Compare');}
    if(r.stage()==='Compare' && r.boolean('UpgradedDummyHit') && r.boolean('DummyDestroyed')){r.openGate('exit');r.setStage('Finish');}
    if(r.stage()==='Finish' && r.Rules.overlaps(r.box(r.player),r.box(r.object('Exit')))){
      r.set('Completed',true);r.setMode('Complete');r.toast('伙伴已获救！这就是你的本次训练记录');
    }
  };
}
