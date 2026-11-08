export function attachBaseInput(r){
  r.shopItems=()=>{
    const shop=BASE.shops.find(s=>s.id===r.activeShop);
    if(shop?.type==='missile'){
      const weapon=r.boolean('HasMissile')?'Missile':'MissilePurchase';
      return [
        {key:weapon,label:weapon==='Missile'?'制导导弹伤害升级':'购买制导导弹'},
        {key:'trial',label:'开始 / 重置三目标补给试炼'},
        {key:'heal',label:'恢复全部生命'},
      ];
    }
    return [
      {key:'Energy',label:'能量枪伤害升级'},
      {key:'Cannon',label:'穿盾炮伤害升级'},
      {key:'heal',label:'恢复全部生命'},
    ];
  };
  r.startTrial=()=>{
    for(const target of r.objects('TrialDrone')){
      r.ov(target,'Health').setNumber(BASE.enemyStats.TrialDrone.health);
      r.ov(target,'Active').setBoolean(true);
      r.ov(target,'Flash').setNumber(0);
      r.ledger('TrialPaid',r.ov(target,'Id').getAsString()).setBoolean(false);
    }
    r.add('TrialRound');
    r.toast('补给试炼开始 · 击破 3 个浮标，每个奖励 4 金币');
  };
  r.buy=item=>{
    r.add('ShopActions');
    if(item==='trial'){
      r.startTrial();
      r.shopFeedback='三个浮标已重置 · Esc 返回后继续练习';
      r.setMode('Playing');
      return;
    }
    const purchase=item==='MissilePurchase';
    const owned=purchase?r.boolean('HasMissile'):item!=='heal'&&r.boolean(item+'Upgraded');
    const result=basePurchase({
      coins:r.number('Coins'),item,owned,
      hasCannon:r.boolean('HasCannon'),hasMissile:r.boolean('HasMissile'),
      health:r.number('Health'),
      stock:item==='heal'&&r.ledger('ShopStock',r.activeShop).getAsBoolean(),
    });
    const reasons={
      owned:'这份商品本局已购买',locked:'先从武器箱免费领取穿盾炮',
      'missile-locked':'先取得制导导弹',full:'生命已满，不需要补给',
      funds:'金币不足 · 可开始补给试炼继续赚取',invalid:'商品不可用',
    };
    if(!result.ok){r.shopFeedback=reasons[result.reason];r.toast(r.shopFeedback);return;}
    r.set('Coins',result.coins);r.add('CoinsSpent',result.cost);r.add('Purchases');
    if(item==='heal'){
      r.set('Health',3);r.ledger('ShopStock',r.activeShop).setBoolean(true);r.add('HealsBought');
    }else if(purchase){
      r.set('HasMissile',true);r.set('CurrentWeapon','Missile');r.cancelCharge();r.add('MissileBought');
    }else{
      r.set(item+'Upgraded',true);r.add('UpgradesBought');
    }
    r.shopFeedback=purchase?'制导导弹已装入 · 按住 W 锁定，松开发射':item==='heal'?'生命已恢复！':'升级完成！当前武器伤害已即时更新';
    r.toast(r.shopFeedback);
  };
  r.input=()=>{
    if(r.pressed.restart&&!['Respawning','Restarting','RestartConfirm'].includes(r.mode())){r.requestRestart();return;}
    if(r.mode()==='RestartConfirm'){
      if(r.pressed.cancel)r.setMode(r.previousMode);else if(r.pressed.confirm)r.startNewRun();
      return;
    }
    if(['Shop','Portal'].includes(r.mode())){
      if(r.pressed.cancel){r.setMode('Playing');return;}
      const count=r.mode()==='Shop'?r.shopItems().length:r.portalOptions().length;
      if(!count){r.setMode('Playing');return;}
      if(r.pressed.up||r.pressed.left)r.menuIndex=(r.menuIndex-1+count)%count;
      if(r.pressed.down||r.pressed.right)r.menuIndex=(r.menuIndex+1)%count;
      if(r.pressed.confirm){
        if(r.mode()==='Shop')r.buy(r.shopItems()[r.menuIndex].key);
        else{
          const target=r.portalOptions()[r.menuIndex];
          if(target){r.teleport(target.x,target.y);r.add('Teleports');r.setMode('Playing');r.toast('已返回 '+target.name);}
        }
      }
      return;
    }
    if(r.mode()!=='Playing')return;
    if(r.number('Health')<=0){r.startNewRun();return;}
    if(r.pressed.interact){
      const shop=r.objects('Shop').find(r.near);
      if(shop){
        r.activeShop=r.ov(shop,'Id').getAsString();r.menuIndex=0;r.shopFeedback='';r.setMode('Shop');return;
      }
      if(r.near(r.object('CannonCrate'))){
        if(!r.boolean('HasCannon')){r.set('HasCannon',true);r.set('CurrentWeapon','Cannon');r.cancelCharge();r.toast('获得穿盾炮！按住 W 蓄满，再松开发射');}
        else r.toast('穿盾炮已装入 · Q 自由切换');
      }else if(r.near(r.object('ReturnPortal'))){
        if(r.portalOptions().length){r.menuIndex=0;r.setMode('Portal');return;}
        r.toast('到达后续分区后，自动解锁返回捷径');
      }else{
        const dummy=r.objects('Dummy').find(r.near);
        if(dummy){
          r.ov(dummy,'Health').setNumber(4);dummy.hide(false);r.ov(dummy,'RoundHits').setNumber(0);
          r.toast('训练靶恢复 · 不产金币，不影响通路');
        }
      }
    }
    if(r.pressed.switch){
      r.cancelCharge();
      const next=weaponCycle({current:r.string('CurrentWeapon'),hasCannon:r.boolean('HasCannon'),hasMissile:r.boolean('HasMissile')});
      if(next===r.string('CurrentWeapon'))r.toast(!r.boolean('HasCannon')?'穿盾炮在补给站免费领取':'制导导弹可在天空救援线购买');
      else{r.set('CurrentWeapon',next);r.toast('已切换 '+BASE.weapons[next].name);}
    }
    r.move();
    const weapon=r.string('CurrentWeapon'),config=BASE.weapons[weapon];
    updateWeaponInput(r,weapon,config);
  };
}
