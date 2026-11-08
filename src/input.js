export function attachInput(r) {
  r.requestRestart = () => {r.previousMode=r.mode();r.setMode('RestartConfirm');};
  r.input = () => {
    if(r.pressed.restart && !['Respawning','RestartConfirm'].includes(r.mode())){r.requestRestart();return;}
    if(r.mode()==='RestartConfirm'){
      if(r.pressed.cancel)r.setMode(r.previousMode);
      else if(r.pressed.confirm)r.startNewRun();
      return;
    }
    if(r.mode()==='Shop'){
      if(r.pressed.cancel){r.setMode('Playing');return;}
      if(r.pressed.confirm){
        const result=r.Rules.purchase(r.number('Coins'),r.boolean('UpgradePurchased'));
        if(result.ok){r.set('Coins',result.coins);r.set('UpgradePurchased',true);r.set('WeaponForm','Upgrade');r.add('Purchases');r.shopFeedback='升级成功！Esc 返回训练，Q 切换比较';r.toast('升级成功！每发伤害变为 2 · Q 切换比较');}
        else{r.shopFeedback=result.reason==='owned'?'已经拥有升级，无需再次购买':'还差 '+(10-r.number('Coins'))+' 枚金币，Esc 返回探索';r.toast(r.shopFeedback);}
      }
      return;
    }
    if(r.mode()!=='Playing')return;
    if(r.number('Health')<=0){r.startNewRun();return;}
    const shop=r.object('Shop');
    if(r.pressed.interact && Math.abs(r.center(r.player).x-r.center(shop).x)<100 && ['Purchase','Compare','Finish'].includes(r.stage())){
      r.shopFeedback='';r.setMode('Shop');return;
    }
    if(r.pressed.interact && Math.abs(r.player.getX()-2460)<150 && ['Compare','Finish'].includes(r.stage()))r.resetDummy();
    if(r.pressed.switch){
      if(!r.boolean('UpgradePurchased'))r.toast('先收集 10 枚金币，到商店升级能量枪');
      else{r.set('WeaponForm',r.string('WeaponForm')==='Base'?'Upgrade':'Base');r.toast(r.string('WeaponForm')==='Base'?'基础形态 · 每发伤害 1':'升级形态 · 每发伤害 2');}
    }
    r.move();
    r.fireCooldown=Math.max(0,r.fireCooldown-r.dt);
    if(r.keys.fire && r.fireCooldown<=0){r.fire();r.fireCooldown=r.config.fireInterval;}
  };
  // Shared by both scenes: a single adapter for the native platform behavior.
  r.move = () => {
    if(r.keys.left&&!r.keys.right){r.body.simulateLeftKey();r.facing=-1;}
    if(r.keys.right&&!r.keys.left){r.body.simulateRightKey();r.facing=1;}
    r.player.flipX(r.facing<0);
    // Native platformer has both upward jump speed and accumulated falling speed.
    // Sustain the native 720 px/s impulse until fall speed reaches 720, then abort
    // that impulse at the apex. This yields the specified 144 px / 0.4 s arc with
    // gravity 1800, using the same native collision controller for the entire jump.
    // Native repeated input is enabled, but setCanJump is granted ONLY by the
    // edge-triggered, two-slot resolver below; a held physical key cannot re-jump.
    if(r.body.isJumping()){
      if(r.body.getCurrentFallSpeed()>=r.config.jumpSpeed)r.body.abortJump();
      else r.body.simulateJumpKey();
    }
    const grounded=r.body.isOnFloor();
    if(!grounded)r.jumpPending=false;
    if(grounded&&!r.jumpPending){r.set('JumpCount',0);r.coyote=r.config.coyote;}
    else r.coyote=Math.max(0,r.coyote-r.dt);
    if(!grounded && r.coyote<=0 && r.number('JumpCount')===0)r.set('JumpCount',1);
    r.buffer=Math.max(0,r.buffer-r.dt);
    if(r.pressed.jump)r.buffer=r.config.jumpBuffer;
    const jump=r.Rules.resolveJump({grounded,coyote:r.coyote,count:r.number('JumpCount'),buffer:r.buffer,pending:r.jumpPending});
    if(jump){
      r.body.setCanJump();r.body.simulateJumpKey();r.set('JumpCount',jump.count);r.jumpPending=true;r.buffer=0;r.coyote=0;
      r.add('Jumps');if(jump.air){r.set('DoubleJumpDone',true);r.add('DoubleJumps');r.flash(r.player.getX()+20,r.player.getY()+55,'75;182;255');}
    }
    r.set('CoyoteRemaining',r.coyote);r.set('JumpBufferRemaining',r.buffer);
  };
}
