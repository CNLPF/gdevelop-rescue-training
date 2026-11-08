export function attachBasePresentation(r){
  attachHud(r);
  const enemyTypes=['Patrol','Turret','Shield','Dummy','ScoutDrone','ArmoredDrone','JammerCore','TrialDrone'];
  r.registerEnemyPresentation=(o,type)=>{
    if(r.labelMap.has(o))return;
    const label=r.create('EnemyLabel',o.getX(),o.getY()-30);label.setZOrder(20);r.labelMap.set(o,{label,type});
  };
  for(const type of enemyTypes)for(const o of r.objects(type))r.registerEnemyPresentation(o,type);
  attachSharedAimReticle(r);

  const displayType={Patrol:'巡逻',Turret:'炮台',Shield:'◀ 护盾',Dummy:'练习靶',ScoutDrone:'侦察无人机',ArmoredDrone:'装甲无人机',JammerCore:'中继核心',TrialDrone:'补给浮标'};

  r.presentation=()=>{
    const camera=Math.max(480,Math.min(BASE.width-480,r.player.getX()+80));
    for(const name of ['Gameplay','Effects']){r.scene.getLayer(name).setCameraX(camera);r.scene.getLayer(name).setCameraY(320);}
    r.player.setOpacity(r.invulnerable>0&&Math.floor(r.time*12)%2===0?100:255);
    const weapon=r.string('CurrentWeapon'),upgraded=r.boolean(weapon+'Upgraded'),w=BASE.weapons[weapon];
    const here=BASE.zones.find(z=>r.player.getX()>=z.start&&r.player.getX()<z.end)||BASE.zones[0];
    const fixedDefeated=r.number('EnemiesDefeated');
    const ratio=weapon==='Energy'?1-r.fireCooldown/w.interval:r.charging?r.charge/(weapon==='Cannon'?w.charge:w.lock):1-r.fireCooldown/w.interval;
    r.renderHud({weapon:w.name,upgraded,status:here.name+'\n固定 '+fixedDefeated+'/'+BASE.enemies.length+' · 增援 '+r.number('ReinforcementsDefeated'),
      cannon:weapon==='Cannon',missile:weapon==='Missile',meter:ratio,
      charging:r.charging&&(weapon==='Cannon'||weapon==='Missile'),chargeX:r.player.getX()+4,chargeY:r.player.getY()+60,
      chargeColor:weapon==='Missile'?'255;174;76':'181;150;255'});

    const orb=r.object('ChargeGlow');
    if(orb){
      const showGlow=r.charging&&weapon==='Cannon';
      orb.hide(!showGlow);orb.setPosition(r.player.getX()+(r.facing>0?30:-18),r.player.getY()+13);
      orb.setWidth(18+24*r.charge/w.charge);orb.setHeight(18+24*r.charge/w.charge);orb.setOpacity(130+Math.sin(r.time*16)*50);
    }
    r.text('PromptText','');r.object('PromptText')?.hide(true);r.object('KeyHelp')?.hide(true);

    for(const [o,{label,type}]of [...r.labelMap]){
      const exists=r.objects(type).includes(o);
      const variables=o.getVariables();
      const active=!variables.has('Active')||variables.get('Active').getAsBoolean();
      label.hide(!exists||!active||r.ov(o,'Health').getAsNumber()<=0);
      if(!exists){label.deleteFromScene();r.labelMap.delete(o);continue;}
      const labelOffset=type==='ScoutDrone'||type==='ArmoredDrone'?-80:type==='Turret'||type==='JammerCore'?-38:-32;
      label.setPosition(o.getX()-12,o.getY()+labelOffset);
      const health=r.ov(o,'Health').getAsNumber();
      let suffix='';
      if(type==='Dummy')suffix=' · 命中 '+r.ov(o,'RoundHits').getAsNumber();
      if(type==='JammerCore')suffix=' · 仅制导导弹';
      if(type==='TrialDrone')suffix=' · +4';
      label.setString(displayType[type]+' '+health+suffix);
      const flash=r.ov(o,'Flash').getAsNumber();if(r.mode()==='Playing')r.ov(o,'Flash').setNumber(Math.max(0,flash-r.dt));o.setOpacity(flash>0?140:255);
    }

    presentSharedAimReticle(r);

    r.object('CannonCrate')?.setOpacity(r.boolean('HasCannon')?135:255);
    if(r.mode()==='Shop'){
      const shop=BASE.shops.find(s=>s.id===r.activeShop);
      r.text('ModalTitle',(shop?.type==='missile'?'天空武器店':'基地补给站')+' · 金币 '+r.number('Coins'));
      const items=r.shopItems();
      const costLabel=item=>{
        if(item.key==='trial')return '免费 · 每轮最多 +12';
        if(item.key==='MissilePurchase')return BASE.weapons.Missile.purchaseCost+' 金币';
        if(item.key==='heal')return '5 金币';
        return BASE.weapons[item.key].upgradeCost+' 金币';
      };
      const ownedLabel=item=>{
        if(item.key==='trial')return '三浮标重置';
        if(item.key==='MissilePurchase')return r.boolean('HasMissile')?'已拥有':'通关必要武器';
        if(item.key==='heal')return r.ledger('ShopStock',r.activeShop).getAsBoolean()?'本店已购买':r.number('Health')>=3?'生命已满':'恢复 3 格生命';
        if(item.key==='Cannon'&&!r.boolean('HasCannon'))return '需先免费领炮';
        return r.boolean(item.key+'Upgraded')?'本局已购买':'伤害升级';
      };
      r.text('ModalBody',items.map((item,i)=>(i===r.menuIndex?'▶ ':'   ')+item.label+'  ·  '+ownedLabel(item)+'  ·  '+costLabel(item)).join('\n\n')+'\n\n↑↓ 选择 · Enter 确认 · Esc 返回');
      r.text('ModalFoot',r.shopFeedback||(shop?.type==='missile'?'补给试炼可重复 · 即使余额为零也能赚够 20 金币':'世界已暂停 · 升级非通关必需 · 每处补血限购一次'));
    }else if(r.mode()==='Portal'){
      r.text('ModalTitle','返回捷径 · 去哪里？');
      r.text('ModalBody',r.portalOptions().map((p,i)=>(i===r.menuIndex?'▶ ':'   ')+p.name).join('\n\n')+'\n\n↑↓ 选择 · Enter 传送 · Esc 返回');
      r.text('ModalFoot','只返回已经到达的区域 · 金币、敌人与进度保持');
    }else if(r.mode()==='RestartConfirm'){
      r.text('ModalTitle','新开一局救援？');
      r.text('ModalBody','保留未花费的金币余额。\n敌人、地图金币、武器升级、门与捷径恢复初始状态。\n\nEnter 新开一局\nEsc 继续当前救援');
      r.text('ModalFoot','购买已花费的金币不退回');
    }else if(r.mode()==='Complete'){
      r.text('ModalTitle','救援成功 · 伙伴已归队！');
      r.text('ModalBody',
        '金币：本局收入 '+r.number('CoinsCollected')+' · 支出 '+r.number('CoinsSpent')+' · 余额 '+r.number('Coins')+
        '\n带入余额 '+r.number('WalletAtStart')+' · 地图 '+r.number('MapCoinsCollected')+'/32 · 试炼 '+r.number('TrialCoinsEarned')+
        '\n击败：巡逻 '+r.number('PatrolDefeated')+' / 炮台 '+r.number('TurretDefeated')+' / 护盾 '+r.number('ShieldDefeated')+
        '\n飞行：侦察 '+r.number('ScoutDroneDefeated')+' / 装甲 '+r.number('ArmoredDroneDefeated')+' · 中继 '+(r.boolean('JammerCoreDefeated')?'已破坏':'未破坏')+
        '\n随机增援：生成 '+r.number('ReinforcementsSpawned')+' / 击败 '+r.number('ReinforcementsDefeated')+
        '\n导弹：发射 '+r.number('MissileShots')+' / 锁定 '+r.number('MissileLockedShots')+' / 命中 '+r.number('MissileHits')+
        '\n能量枪 '+r.number('EnergyShots')+'/'+r.number('EnergyHits')+' · 穿盾炮 '+r.number('CannonShots')+'/'+r.number('CannonHits')+
        '\n升级 '+r.number('UpgradesBought')+' · 导弹购买 '+r.number('MissileBought')+' · 补血 '+r.number('HealsBought')+
        '\n掉坑 '+r.number('Retries')+' · 行动用时 '+Math.floor(r.number('ElapsedSeconds'))+' 秒（不含菜单）');
      r.text('ModalFoot','按 R 再试一次 · 以上只记录本局实际操作');
    }
    if(r.mode()==='Playing')for(const fx of [...r.effects]){
      fx.life-=r.dt;fx.o.setOpacity(Math.max(0,fx.life/0.22*230));fx.o.setAngle(fx.o.getAngle()+r.dt*200);
      if(fx.life<=0){fx.o.deleteFromScene();r.effects.splice(r.effects.indexOf(fx),1);}
    }
  };
}
