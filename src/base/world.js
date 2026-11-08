export function attachBaseWorld(r){
  r.portalOptions=()=>BASE.portals.filter(p=>r.ledger('UnlockedPortals',p.id).getAsBoolean());
  r.world=()=>{
    if(r.mode()==='Respawning'){
      if(r.modeTime>=0.45){
        // Falling returns the same run to spawn. Keep friendly projectiles and
        // clear only hostile attacks that could otherwise arrive without warning.
        for(const o of [...r.objects('EnemyBullet')])o.deleteFromScene();
        r.setAttackRecovery(0.8);r.teleport(80,504);r.setMode('Playing');
      }
      return;
    }
    if(r.mode()!=='Playing')return;
    r.elapsed+=r.dt;r.set('ElapsedSeconds',r.elapsed);r.invulnerable=Math.max(0,r.invulnerable-r.dt);
    r.player.setX(Math.max(16,Math.min(BASE.width-56,r.player.getX())));
    if(r.player.getY()>720){r.respawn();return;}
    const box=r.box(r.player);
    for(const coin of [...r.objects('Coin')])if(r.Rules.overlaps(box,r.box(coin))){
      const id=r.ov(coin,'Id').getAsString();
      if(!r.ledger('CollectedCoins',id).getAsBoolean()){
        r.ledger('CollectedCoins',id).setBoolean(true);r.add('Coins');r.add('CoinsCollected');r.add(r.ov(coin,'Reward').getAsBoolean()?'RewardCoinsCollected':'MapCoinsCollected');r.flash(coin.getX()+12,coin.getY()+12,'255;190;57');
      }coin.deleteFromScene();
    }
    for(const type of ['Patrol','Turret','Shield','ScoutDrone','ArmoredDrone'])for(const o of r.objects(type))if(r.Rules.overlaps(box,r.box(o)))r.hurtPlayer();
    if(r.mode()!=='Playing')return;
    for(const p of BASE.portals)if(r.player.getX()>=p.unlockX&&!r.ledger('UnlockedPortals',p.id).getAsBoolean()){
      r.ledger('UnlockedPortals',p.id).setBoolean(true);r.toast(p.name+'捷径已开启 · 掉坑后可在出生点按 E 返回');
    }
  };
  r.progress=()=>{
    if(r.mode()!=='Playing')return;
    const defeated=zone=>BASE.enemies.filter(e=>e.zone===zone).every(e=>r.ledger('DefeatedEnemies',e.id).getAsBoolean());
    if(r.stage()==='Entry'&&r.boolean('DoubleJumpDone')&&r.Rules.overlaps(r.box(r.player),r.box(r.object('JumpBeacon')))){r.openGate('entry');r.setStage('Corridor');}
    if(r.stage()==='Corridor'&&defeated('Corridor')){r.openGate('corridor');r.setStage('Supply');}
    if(r.stage()==='Supply'&&r.boolean('HasCannon')){r.openGate('supply');r.setStage('Shield');}
    if(r.stage()==='Shield'&&defeated('Shield')){r.openGate('shield');r.setStage('Energy');}
    if(r.stage()==='Energy'&&defeated('Energy')){r.openGate('energy');r.setStage('Aerial');}
    if(r.stage()==='Aerial'){
      const core=r.object('JammerCore');
      if(core&&!r.ov(core,'Active').getAsBoolean()&&defeated('Aerial')){
        r.ov(core,'Active').setBoolean(true);
        r.toast('航线已清空 · 中继核心现在可被制导导弹锁定');
      }
    }
    if(r.stage()==='Aerial'&&r.boolean('JammerCoreDefeated')){r.openGate('relay');r.setStage('Rescue');}
    if(r.stage()==='Rescue'&&r.Rules.overlaps(r.box(r.player),r.box(r.object('Exit')))){
      r.set('Completed',true);r.set('ElapsedSeconds',r.elapsed);r.setMode('Complete');
    }
  };
}
